const {chromium}=require('playwright');
const {serve}=require('./server.cjs');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const KEY='rift-salvage-save-v1',results=[];
const check=(name,fn)=>Promise.resolve().then(fn).then(()=>{results.push({name,status:'PASS'});console.log('PASS',name)});
(async()=>{
 const server=await serve(),baselineDir=fs.mkdtempSync(path.join(os.tmpdir(),'rift-baseline-'));
 fs.writeFileSync(path.join(baselineDir,'index.html'),execFileSync('git',['show','b052277:index.html']));
 const baseline=await serve(baselineDir),browser=await chromium.launch();
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const get=()=>page.evaluate(()=>__RIFT_TEST__.getState());
 const action=(name,...args)=>page.evaluate(({name,args})=>__RIFT_TEST__[name](...args),{name,args});
 const ready=async()=>{await page.waitForFunction(()=>window.__RIFT_TEST__&&__RIFT_TEST__.getArtInfo().status!=='loading');};
 const load=async(save)=>{await page.goto(server.url+'/tests/empty.html');await page.evaluate(({KEY,save})=>localStorage.setItem(KEY,JSON.stringify(save)),{KEY,save});await page.goto(server.url);await ready();};
 await page.goto(server.url);await ready();
 await check('GAME-01 deploy button and decoded independent assets',async()=>{await page.screenshot({path:'tests/evidence/ship.png',fullPage:true});await page.click('#deployBtn');assert((await get()).mission);assert.equal((await page.evaluate(()=>__RIFT_TEST__.getArtInfo())).status,'ready');assert.equal(await page.locator('#gameCanvas').isVisible(),true);});
 const normal=(await get()).save;
 await check('SAVE-01 v0.4 saved mission loads without reset',async()=>{const legacy=JSON.parse(fs.readFileSync('tests/evidence/baseline-save.json'));await load(legacy);const state=await get();assert.equal(state.save.credits,legacy.credits);assert.equal(state.mission.rngValue,legacy.mission.rngValue);assert.deepEqual(state.mission.player,legacy.mission.player);assert.deepEqual(state.mission.map,legacy.mission.map);});
 await page.goto(server.url+'/?showcase=1');await ready();await page.click('#deployBtn');
 const fixture=(await get()).save;fixture.mission=(await get()).mission;fixture.mission.showcase=false;
 await check('Showcase sandbox leaves campaign localStorage byte-for-byte intact',async()=>{const bytes=await page.evaluate(KEY=>localStorage.getItem(KEY),KEY);await action('move',1,0);await action('turn');assert.equal(await page.evaluate(KEY=>localStorage.getItem(KEY),KEY),bytes);});
 const oldContext=await browser.newContext(),old=await oldContext.newPage();await old.goto(baseline.url);
 function scenario(change){const f=structuredClone(fixture);f.mission.enemies=[];f.mission.player.bleed=false;f.mission.rngValue=123;change(f.mission,f);return f;}
 async function differential(name,save,actions,verify){await check(name,async()=>{
   await load(save);await old.goto(baseline.url+'/empty.html');await old.evaluate(({KEY,save})=>localStorage.setItem(KEY,JSON.stringify(save)),{KEY,save});await old.goto(baseline.url);
   for(const [name,...args] of actions){await action(name,...args);await old.evaluate(({name,args})=>__RIFT_TEST__[name](...args),{name,args});}
   const next=await get(),prior=await old.evaluate(()=>__RIFT_TEST__.getState());assert.deepEqual(next,prior);if(verify)verify(next,save);
 });}
 await differential('GAME-02 move advances exactly one turn; animation cannot mutate logic',scenario(()=>{}),[['move',1,0]],(n,o)=>{assert.equal(n.mission.turn,o.mission.turn+1);assert.equal(n.mission.player.x,o.mission.player.x+1)});
 await check('ART-01 independent animation changes pixels without advancing state',async()=>{const a=await get(),before=await page.locator('#gameCanvas').screenshot();await page.waitForTimeout(350);const after=await page.locator('#gameCanvas').screenshot();assert.notDeepEqual(before,after);assert.deepEqual(await get(),a);});
 const guard={x:19,y:20,kind:'guard',hp:39,max:39,id:0};
 await differential('GAME-02 valid shot consumes exactly one round and one turn',scenario(s=>{s.enemies=[guard]}),[['shoot',19,20]],(n,o)=>{assert.equal(n.mission.turn,1);assert.equal(n.mission.player.ammo,o.mission.player.ammo-1);assert(n.mission.enemies[0].hp<39)});
 await differential('GAME-03 blocked shot conserves ammo and turn',scenario(s=>{s.enemies=[guard];s.map[20][18]=2}),[['shoot',19,20]],(n,o)=>{assert.equal(n.mission.player.ammo,o.mission.player.ammo);assert.equal(n.mission.turn,0)});
 await differential('GAME-03 out-of-range shot conserves ammo',scenario(s=>{s.enemies=[{...guard,x:16,y:12}]}),[['shoot',16,12]],(n,o)=>assert.equal(n.mission.player.ammo,o.mission.player.ammo));
 await differential('GAME-02 reload / heal / wait retain old outcomes and RNG',scenario(s=>{s.player.hp=45;s.player.ammo=3;s.player.bleed=true;s.enemies=[guard]}),[['reload'],['med'],['turn']]);
 await differential('GAME-04 kill, loot, data and extract preserve complete economics',scenario(s=>{s.player.x=17;s.player.y=21;s.enemies=[{...guard,x:18,y:20,hp:1}];s.caches=[{x:17,y:22,used:false,value:58}];s.exit={x:17,y:21}}),[['shoot',18,20],['interact',{x:17,y:22}],['interact',{x:18,y:21}],['extract']],n=>{assert.equal(n.mission,null);assert.equal(n.save.wins,1);assert.equal(n.save.credits,353)});
 await differential('GAME-05 death loss and carried module semantics unchanged',scenario((s,save)=>{s.player.hp=1;s.player.bleed=true;s.module='plate';save.modules=['plate'];save.selectedModule='plate';s.cargo=100}),[['turn']],n=>{assert.equal(n.mission,null);assert.equal(n.save.losses,1);assert.deepEqual(n.save.modules,[])});
 await check('GAME-03 100 procedural seeds: every objective/cache/exit reachable',async()=>{
   await load({...normal,mission:null});const report=await page.evaluate(()=>{const t=__RIFT_TEST__,failures=[];for(let seed=1;seed<=100;seed++){
     Math.random=()=>seed/101;t.deploy();const m=t.getState().mission;
     for(const p of [m.terminal,...m.caches,m.exit]){if(p.x===m.player.x&&p.y===m.player.y)continue;if(!t.nextStep(m.player,p,false))failures.push({seed,p});}
     if(!m.map.some(row=>row.includes(2)))failures.push({seed,noCover:true});t.extract();document.getElementById('modalButton').click();
   }return {seeds:100,failures};});assert.deepEqual(report.failures,[]);fs.writeFileSync('tests/evidence/seed-reachability.json',JSON.stringify(report,null,2));
 });
 await check('SAVE-01 suspend/reload retains active mission and inventory',async()=>{await load(fixture);await action('move',1,0);const a=await get();await page.reload();await ready();assert.deepEqual(await get(),a)});
 await check('UI-02 modal / map block clicks and keys',async()=>{await load(fixture);const a=await get();await page.click('#mapToggle');await page.keyboard.press('ArrowRight');await page.evaluate(()=>document.querySelector('[data-dir=right]').click());assert.deepEqual(await get(),a);await page.click('#closeMap');await page.evaluate(()=>document.getElementById('modal').hidden=false);await page.keyboard.press('ArrowRight');await page.evaluate(()=>document.getElementById('reloadBtn').click());assert.deepEqual(await get(),a);});
 await check('UI-02 tap D-pad once; shoot-mode swipe never fires or moves',async()=>{await load(scenario(()=>{}));await page.locator('[data-dir=right]').tap();assert.equal((await get()).mission.turn,1);await page.locator('[data-mode=shoot]').tap();const a=await get();await page.locator('#gameCanvas').dispatchEvent('pointerdown',{clientX:150,clientY:300,pointerId:1});await page.locator('#gameCanvas').dispatchEvent('pointerup',{clientX:200,clientY:300,pointerId:1});assert.deepEqual(await get(),a);});
 await check('ART-02 invisible enemy cannot alter rendered pixels through fog',async()=>{
   const f=scenario(s=>{s.enemies=[{...guard,x:14,y:18}];s.map[19][15]=2;s.seen=s.seen.map(row=>row.map(()=>true));});await load(f);assert.equal(await page.evaluate(()=>__RIFT_TEST__.visible(14,18)),false);await action('setVisualTime',1000);const a=await page.locator('#gameCanvas').screenshot();f.mission.enemies=[];await load(f);await action('setVisualTime',1000);const b=await page.locator('#gameCanvas').screenshot();assert.deepEqual(a,b);
 });
 await check('ART-04 HIGH/ECO changes DPR only, no game state',async()=>{await load(fixture);const a=await get();const width=await page.locator('#gameCanvas').evaluate(c=>c.width);await page.click('#qualityBtn');assert(await page.locator('#gameCanvas').evaluate(c=>c.width)<width);assert.deepEqual(await get(),a);});
 await check('UI-01 mobile widths + landscape; targets and no horizontal overflow',async()=>{
   await load(fixture);for(const [width,height] of [[320,700],[375,812],[390,844],[430,932],[844,390]]){
     await page.setViewportSize({width,height});await action('setVisualTime',1000);
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     const small=await page.locator('#missionScreen button:visible').evaluateAll(bs=>bs.filter(b=>{const r=b.getBoundingClientRect();return r.width<43.9||r.height<43.9}).map(b=>b.id||b.textContent));assert.deepEqual(small,[]);
     await page.screenshot({path:`tests/evidence/layout-${width}.png`,fullPage:true});
   }
 });
 await check('SAVE-01 unavailable storage fallback remains playable',async()=>{const c=await browser.newContext();await c.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('disabled')};Storage.prototype.setItem=()=>{throw Error('disabled')}});const p=await c.newPage();await p.goto(server.url);await p.click('#deployBtn');assert(await p.evaluate(()=>!!__RIFT_TEST__.getState().mission));await c.close()});
 await check('ART loader missing images falls back visibly; game playable',async()=>{const c=await browser.newContext(),p=await c.newPage();await p.route('**/assets/v1/*.png',r=>r.abort());await p.goto(server.url);await p.waitForFunction(()=>__RIFT_TEST__.getArtInfo().status==='fallback');assert(await p.locator('#artNotice').isVisible());await p.click('#deployBtn');assert(await p.evaluate(()=>!!__RIFT_TEST__.getState().mission));await c.close()});
 await check('Reduced motion stops sprite frame cycling and CSS animation',async()=>{const c=await browser.newContext({reducedMotion:'reduce'}),p=await c.newPage();await p.goto(server.url+'/?showcase=1');await p.waitForFunction(()=>__RIFT_TEST__.getArtInfo().status==='ready');await p.click('#deployBtn');const a=await p.locator('#gameCanvas').screenshot();await p.waitForTimeout(240);assert.deepEqual(await p.locator('#gameCanvas').screenshot(),a);await c.close()});
 await check('No JS exceptions',()=>assert.deepEqual(errors,[]));
 fs.writeFileSync('tests/evidence/results.json',JSON.stringify({browser:await browser.version(),platform:process.platform,results},null,2));
 await browser.close();server.close();baseline.close();fs.rmSync(baselineDir,{recursive:true});console.log(`${results.length} checks passed`);
})().catch(e=>{console.error(e);process.exit(1)});
