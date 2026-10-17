// Render-only theme fixtures share identical geometry and outcomes.
const {chromium}=require('playwright'),{serve}=require('./server.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
  const server=await serve(),browser=await chromium.launch();
  const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  const ready=()=>p.waitForFunction(()=>__RIFT_TEST__.getArtInfo().status==='ready');
  await p.goto(server.url+'/?showcase=1');await ready();await p.click('#deployBtn');
  const initial=await p.evaluate(()=>__RIFT_TEST__.getState());
  const load=async save=>{await p.goto(server.url+'/tests/empty.html');await p.evaluate(save=>localStorage.setItem('rift-salvage-save-v1',JSON.stringify(save)),save);await p.goto(server.url);await ready();await p.waitForTimeout(300);await p.evaluate(()=>__RIFT_TEST__.setVisualTime(1000));};
  const results=[],hashes=[];
  for(let contract=0;contract<3;contract++){
    const fixture=structuredClone(initial.save);fixture.contract=contract;fixture.mission=structuredClone(initial.mission);
    fixture.mission.contract=contract;fixture.mission.showcase=false;await load(fixture);
    assert((await p.locator('.map-tag').textContent()).includes(['ASTRA-9','VESTA-6','NEREID-3'][contract]));
    const before=await p.evaluate(()=>__RIFT_TEST__.getState());
    await p.screenshot({path:`tests/evidence/theme-${contract}.png`,fullPage:true});
    hashes.push(crypto.createHash('sha256').update(await p.locator('#gameCanvas').screenshot()).digest('hex'));
    await p.evaluate(()=>{__RIFT_TEST__.setCameraForTest({x:16.4,y:20.3});__RIFT_TEST__.setVisualTime(1300)});
    assert.deepEqual(await p.evaluate(()=>__RIFT_TEST__.getState()),before);
    await p.click('#qualityBtn');assert.deepEqual(await p.evaluate(()=>__RIFT_TEST__.getState()),before);
    await p.reload();await ready();assert.deepEqual(await p.evaluate(()=>__RIFT_TEST__.getState()),before);
    // Normal deployment uses the selected contract's theme without a preview flag.
    const fresh=structuredClone(initial.save);fresh.contract=contract;fresh.mission=null;await load(fresh);await p.click('#deployBtn');
    assert.equal((await p.evaluate(()=>__RIFT_TEST__.getState())).mission.contract,contract);
    await p.screenshot({path:`tests/evidence/normal-theme-${contract}.png`,fullPage:true});
    results.push({theme:contract,status:'PASS',checks:'distinct render; camera/ECO/reload preserve state; normal deployment'});
  }
  assert.equal(new Set(hashes).size,3);
  // Looking into unexplored space must show no texture, props or emissive leaks.
  const fog=structuredClone(initial.save);fog.mission=structuredClone(initial.mission);
  fog.mission.seen=fog.mission.seen.map(row=>row.map(()=>false));await load(fog);
  await p.evaluate(()=>{__RIFT_TEST__.setCameraForTest({x:3,y:3})});await p.waitForTimeout(100);
  await p.evaluate(()=>__RIFT_TEST__.setVisualTime(1000));
  const colors=await p.evaluate(()=>{const c=document.getElementById('gameCanvas'),g=c.getContext('2d'),a=[];for(let y=80;y<c.height-80;y+=19)for(let x=80;x<c.width-80;x+=19)a.push([...g.getImageData(x,y,1,1).data].join(','));return [...new Set(a)];});
  assert.deepEqual(colors,['3,8,13,255']);results.push({status:'PASS',checks:'unexplored area uniformly black; no tile or light leaks'});
  // Previously explored buried wall interiors must also remain solid, not atlas mosaics.
  fog.mission.seen=fog.mission.seen.map(row=>row.map(()=>true));await load(fog);
  await p.evaluate(()=>__RIFT_TEST__.setCameraForTest({x:3,y:3}));await p.waitForTimeout(100);await p.evaluate(()=>__RIFT_TEST__.setVisualTime(1000));
  const buried=await p.evaluate(()=>{const c=document.getElementById('gameCanvas'),g=c.getContext('2d'),a=[],v=__RIFT_TEST__.getView();const x0=v.ox+(2-v.left)*v.tile,y0=v.oy+(2-v.top)*v.tile;for(let y=y0;y<y0+v.tile;y+=7)for(let x=x0;x<x0+v.tile;x+=7)a.push([...g.getImageData(Math.floor(x),Math.floor(y),1,1).data].join(','));return [...new Set(a)];});
  assert.equal(buried.length,1);results.push({status:'PASS',checks:'remembered buried wall interior uniform, no repeated panels'});
  assert.deepEqual(errors,[]);fs.writeFileSync('tests/evidence/themes.json',JSON.stringify({browser:await browser.version(),results,themeHashes:hashes},null,2));
  await browser.close();server.close();console.log('PASS themes: 3 contracts, distinct materials, saves, fog and buried walls');
})().catch(e=>{console.error(e);process.exit(1)});
