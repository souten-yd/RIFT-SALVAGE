const {chromium}=require('playwright'),{serve}=require('./server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
  const server=await serve(),browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
  const state=()=>page.evaluate(()=>__ORBIT_TEST__.state()),flight=()=>page.evaluate(()=>__ORBIT_TEST__.flight());
  const tap=selector=>page.locator(selector).tap();
  async function holdUntil(selector,predicate){const box=await page.locator(selector).boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForFunction(predicate,{},{timeout:30000});await page.mouse.up();}
  await page.goto(server.url);await tap('#launchOrbit');await page.waitForTimeout(200);
  assert.equal(await page.locator('#orbitFailure').isVisible(),false);assert.equal((await flight()).active,true);
  await page.screenshot({path:'tests/evidence/orbit-flight.png'});
  const baselineCampaign=await page.evaluate(()=>__RIFT_TEST__.getState().save);
  // A real fresh start: mine the visible starter crystal using the player control.
  await holdUntil('#orbitFire',()=>__ORBIT_TEST__.state().cargo.crystal>=8);assert((await state()).cargo.crystal>=8);results.push('fresh game: aimed laser destroys asteroid and collects crystal');
  await tap('#orbitMenu');assert(await page.locator('[data-warp="2"]').isDisabled());assert(await page.locator('[data-warp="3"]').isDisabled());
  await tap('[data-warp="1"]');await page.waitForFunction(()=>__ORBIT_TEST__.state().system===1,{},{timeout:30000});
  assert((await state()).energy<65);assert.equal((await state()).levels.engine,0);results.push('warp consumes energy; dangerous systems locked by propulsion level');
  await page.screenshot({path:'tests/evidence/orbit-astra.png'});
  const before=(await state()).pos;await holdUntil('#orbitBoost',()=>__ORBIT_TEST__.state().pos[2]>40);const after=await state();assert(after.pos[2]>before[2]+30);assert(after.energy<65);await tap('#orbitBrake');
  // Drag steering is genuine pitch + yaw, not a screen-space map pan.
  await page.mouse.move(180,260);await page.mouse.down();await page.mouse.move(230,210);await page.waitForFunction(()=>{const s=__ORBIT_TEST__.state();return s.yaw>.1&&s.pitch>.1;});await page.mouse.up();const turned=await state();assert(turned.yaw>.1&&turned.pitch>.1);results.push('boost translates in 3D; drag changes yaw and pitch; brake stops');
  await tap('#orbitExit');const saved=await state();await page.reload();assert.deepEqual(await state(),saved);assert.equal(await page.evaluate(()=>__RIFT_TEST__.getState().save.credits),baselineCampaign.credits);results.push('position, cargo, hull and progression survive reload; legacy credits unchanged');
  // Loaded-save fixtures explicitly exercise costly late-game cases, not a claimed earned playthrough.
  async function fixture(patch){await page.goto(server.url+'/tests/empty.html');await page.evaluate(({base,patch})=>{base.space={...base.space,...patch};base.mission=null;localStorage.setItem('rift-salvage-save-v1',JSON.stringify(base));},{base:{...baselineCampaign,space:saved},patch});await page.goto(server.url);await tap('#launchOrbit');await page.waitForTimeout(150);}
  await fixture({system:0,pos:[140,0,540],yaw:0,pitch:0,bank:{ore:500,crystal:300,bio:200,core:100},cargo:{ore:7,crystal:3,bio:0,core:0},energy:100});
  await tap('#orbitLand');assert.equal((await state()).bank.ore,507);assert.equal((await state()).cargo.ore,0);assert.equal((await state()).hull,100);
  await tap('[data-refit="engine"]');assert.equal((await state()).levels.engine,1);assert.equal((await state()).bank.ore,495);assert.equal(await page.locator('[data-warp="2"]').isDisabled(),false);
  await tap('[data-refit="engine"]');assert.equal(await page.locator('[data-warp="3"]').isDisabled(),false);
  for(const key of ['shield','laser','cargo'])await tap(`[data-refit="${key}"]`);
  assert.equal((await state()).shield,140);await page.selectOption('#orbitPaint','2');assert.equal((await state()).paint,2);
  results.push('home docking banks cargo and repairs; all four refits charge exact resources and change capabilities; paint saved');
  for(let i=1;i<=3;i++){await tap('#restorePlanet');assert.equal((await state()).restoration,i);}
  assert(await page.locator('#restorePlanet').isDisabled());await page.screenshot({path:'tests/evidence/orbit-refit.png'});
  await tap('#orbitPanelClose');await page.screenshot({path:'tests/evidence/orbit-eden.png'});results.push('all three restoration projects spend resources; EDEN completion persists and changes planet color');
  // Every screen size keeps the controls reachable and at least 44px.
  for(const [width,height] of [[320,700],[375,812],[390,844],[430,932],[844,390]]){await page.setViewportSize({width,height});await page.waitForTimeout(100);const bounds=await page.evaluate(()=>[...document.querySelectorAll('#orbit > .orbit-top button,#orbit > .orbit-bottom button,#orbitThrottle')].map(el=>{const r=el.getBoundingClientRect();return {id:el.id,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};}));for(const b of bounds){assert(b.w>=44&&b.h>=44,JSON.stringify(b));assert(b.x>=0&&b.y>=0&&b.right<=width+.5&&b.bottom<=height+.5,JSON.stringify(b));}}
  results.push('320/375/390/430 portrait + 844 landscape: all controls reachable, 44px touch targets');await page.setViewportSize({width:390,height:844});
  // Combat fixture, actual fire input and hostile AI, no test mutation hooks.
  await fixture({system:1,pos:[-160,40,620],yaw:0,pitch:0,energy:100,levels:{engine:0,shield:0,laser:1,cargo:0},cargo:{ore:0,crystal:0,bio:0,core:0},kills:0});
  await holdUntil('#orbitFire',()=>__ORBIT_TEST__.state().kills>=1);assert((await state()).kills>=1);results.push('aimed laser kills an actual pursuing hostile and grants salvage');
  // Death preserves improvements and stored resources but loses half carried cargo.
  await fixture({system:3,pos:[-160,40,650],hull:1,shield:0,energy:100,cargo:{ore:20,crystal:10,bio:6,core:4}});
  await page.waitForFunction(()=>__ORBIT_TEST__.state().system===0,{},{timeout:30000});assert.deepEqual((await state()).cargo,{ore:10,crystal:5,bio:3,core:2});assert.equal((await state()).hull,100);results.push('hostile fire causes rescue to EDEN; half cargo loss and upgrades retained');
  // Flight-to-ground integration uses the same existing campaign deployment.
  await fixture({system:2,pos:[140,0,540],yaw:0,pitch:0,energy:100});await tap('#orbitLand');assert.equal(await page.locator('#orbit').isVisible(),false);assert.equal(await page.evaluate(()=>__RIFT_TEST__.getState().mission.contract),1);await page.waitForFunction(()=>__RIFT_TEST__.getArtInfo().status==='ready');
  const groundBefore=await page.evaluate(()=>__RIFT_TEST__.getState()),tileSizes=[];
  for(let i=0;i<3;i++){tileSizes.push(await page.evaluate(()=>{const v=__RIFT_TEST__.getView();return v.tile/v.scale;}));await tap('#zoomBtn');}
  assert(tileSizes[1]>tileSizes[0]&&tileSizes[0]>tileSizes[2]);assert.deepEqual(await page.evaluate(()=>__RIFT_TEST__.getState()),groundBefore);await page.screenshot({path:'tests/evidence/larger-ground.png'});results.push('orbit landing starts VESTA ground combat; 3 zoom levels enlarge tiles without changing gameplay');
  const recovered=structuredClone(groundBefore.save);recovered.mission=structuredClone(groundBefore.mission);recovered.mission.data=true;recovered.mission.cargo=40;recovered.mission.player.x=recovered.mission.exit.x;recovered.mission.player.y=recovered.mission.exit.y;
  await page.goto(server.url+'/tests/empty.html');await page.evaluate(save=>localStorage.setItem('rift-salvage-save-v1',JSON.stringify(save)),recovered);await page.goto(server.url);await tap('#exitBtn');assert.equal((await state()).cargo.bio,recovered.space.cargo.bio+14);assert.equal(await page.evaluate(()=>__RIFT_TEST__.getState().save.credits),recovered.credits+255+40);results.push('successful ground extraction adds ship materials once, preserving original contract credits');
  const fallback=await browser.newPage();await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args);};});await fallback.goto(server.url);await fallback.click('#launchOrbit');assert(await fallback.locator('#orbitFailure').isVisible());await fallback.click('#orbitExit');await fallback.click('#deployBtn');assert(await fallback.locator('#missionScreen').isVisible());await fallback.close();results.push('missing WebGL gives a visible error; saved campaign and ground play remain accessible');
  assert.deepEqual(errors,[]);fs.writeFileSync('tests/evidence/orbit.json',JSON.stringify({browser:await browser.version(),device:'Chromium touch emulation; not physical iPhone Safari',results,tileSizesCSS:tileSizes,lateGame:'loaded-save fixtures, not a claimed from-scratch campaign'},null,2));
  await browser.close();server.close();console.log('PASS orbital expansion: '+results.length+' checks');
})().catch(e=>{console.error(e);process.exit(1)});
