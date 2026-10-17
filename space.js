import * as THREE from './vendor/three/three.module.min.js';
/* Original orbital exploration. Three.js r180 is vendored locally under MIT. */
(() => {
  'use strict';
  const campaign=window.RiftCampaign;if(!campaign)return;
  const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,n)=>a.map(v=>v*n),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),length=a=>Math.hypot(...a),unit=a=>mul(a,1/(length(a)||1));
  const systems=[
    {name:'EDEN / 母星',risk:0,gate:0,color:[.21,.35,.39],fog:[.012,.027,.045],contract:null,subtitle:'灰に覆われた故郷を、再び青く。'},
    {name:'ASTRA / 採掘帯',risk:1,gate:0,color:[.58,.31,.14],fog:[.025,.02,.035],contract:0,subtitle:'鉱石・結晶 / 廃坑と巡回機'},
    {name:'VESTA / 禁域',risk:2,gate:1,color:[.2,.32,.65],fog:[.018,.02,.06],contract:1,subtitle:'生体種子・結晶 / 強化哨戒機'},
    {name:'NEREID / 断裂域',risk:3,gate:2,color:[.55,.15,.25],fog:[.045,.012,.03],contract:2,subtitle:'古代核 / 重装迎撃機'}
  ];
  const names={ore:'合金',crystal:'結晶',bio:'生体種子',core:'古代核'};
  const modules={engine:{name:'推進器',hint:'巡航・ブースト速度とワープ到達域'},shield:{name:'シールド',hint:'防御容量と回復速度'},laser:{name:'レーザー',hint:'採掘・迎撃ダメージ'},cargo:{name:'貨物室',hint:'一度に持ち帰れる資源量'}};
  const projects=[{name:'大気浄化',cost:{ore:40,crystal:15},text:'有毒雲が薄れ、海が姿を現した。'}, {name:'海洋再生',cost:{ore:60,crystal:30,bio:30},text:'水循環が戻り、種子が発芽を始めた。'}, {name:'生態系再建',cost:{ore:90,crystal:45,bio:60,core:18},text:'EDENに緑が戻った。母星再生完了。これからも星々を探索できる。'}];
  const empty=()=>({ore:0,crystal:0,bio:0,core:0});
  const defaults=()=>({version:1,system:0,pos:[0,0,0],yaw:0,pitch:0,hull:100,shield:80,energy:100,levels:{engine:0,shield:0,laser:0,cargo:0},bank:empty(),cargo:empty(),restoration:0,paint:0,collected:{},kills:0,sortie:0});
  const raw=campaign.readSpace()||{},state={...defaults(),...raw,levels:{...defaults().levels,...raw.levels},bank:{...empty(),...raw.bank},cargo:{...empty(),...raw.cargo},collected:{...raw.collected}};
  let active=false,frame=0,last=0,speed=0,throttle=0,boost=false,firing=false,shotTimer=0,scanTimer=0,saveTimer=0,clock=0,panelOpen=false,warp=null,objects=[],beams=[],target=0,renderer=null,dirty=false;
  const keys=new Set();let stick=null,steer=[0,0];
  // Cosmetic rig only: never written into the campaign or used by flight/combat.
  const rig={yaw:0,pitch:0,bank:0,thrust:0,brake:0,previousSpeed:0};
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  function animateRig(dt){
    const yaw=clamp(steer[0]+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),-1,1);
    const pitch=clamp(steer[1]+(keys.has('arrowup')?1:0)-(keys.has('arrowdown')?1:0),-1,1);
    const boostOn=(boost||keys.has('shift'))&&state.energy>2;
    const targets={yaw,pitch,bank:reducedMotion.matches?0:-yaw*.48,thrust:boostOn?1:Math.min(.48,speed/90),brake:Math.max(0,rig.previousSpeed-speed)/Math.max(.01,dt)>35?1:0};
    const blend=1-Math.exp(-9*dt);for(const key of Object.keys(targets))rig[key]+=(targets[key]-rig[key])*blend;
    rig.previousSpeed=speed;
  }
  const css=document.createElement('style');css.textContent=`
  .orbit-entry{margin:10px 0;padding:18px;border:1px solid #467d8b;background:linear-gradient(120deg,#12323f,#101725);border-radius:8px}.orbit-entry h2{margin:0 0 8px;font-size:22px}.orbit-entry p{color:#acc6d0;font-size:13px;line-height:1.7}.orbit-entry button{width:100%;min-height:50px;background:#11494e;color:#affff0;border:1px solid #62e9d7;font-weight:bold}
  #orbit{position:fixed;inset:0;z-index:100;background:#02060e;color:#dceef2;font-family:ui-monospace,monospace;height:100dvh;overflow:hidden}#orbit[hidden]{display:none}#orbit canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}#orbitOverlay{pointer-events:none}
  #orbit button,#orbit select{min-height:44px;min-width:44px;border:1px solid #447585;background:#0b1c2bea;color:#e0f6f7;border-radius:5px;font:inherit;font-size:12px;padding:6px}#orbit button:disabled{opacity:.45}#orbit button:active,#orbit button.held{background:#266e7d}#orbit .orbit-top{position:absolute;top:calc(10px + env(safe-area-inset-top));left:12px;right:12px;display:flex;align-items:center;justify-content:space-between;gap:8px}#orbitTitle{font-size:16px;letter-spacing:1px}#orbitTitle small{display:block;font-size:10px;letter-spacing:2px;color:#72e5d6;margin-bottom:4px}.orbit-status{position:absolute;top:calc(74px + env(safe-area-inset-top));left:12px;right:12px;display:flex;gap:8px;font-size:11px}.orbit-meter{flex:1;background:#091623ba;padding:6px;border-top:1px solid #315362}.orbit-meter progress{display:block;width:100%;height:5px;margin-top:5px;accent-color:#72e5d6}#orbitHint{position:absolute;top:calc(130px + env(safe-area-inset-top));left:16px;right:16px;text-align:center;color:#b6d5e0;font-size:11px;line-height:1.5;pointer-events:none}#orbitMessage{position:absolute;left:12px;right:12px;bottom:calc(176px + env(safe-area-inset-bottom));font-size:12px;text-align:center;color:#ffdd9d;pointer-events:none;text-shadow:0 2px 3px #000}
  .orbit-bottom{position:absolute;bottom:calc(8px + env(safe-area-inset-bottom));left:10px;right:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}#orbit .orbit-throttle{grid-column:1/4;display:flex;align-items:center;gap:8px;background:#071420c9;padding:5px 10px;font-size:12px}#orbitThrottle{height:44px;min-width:0;flex:1;accent-color:#71edda}#orbit .boost-key{border-color:#65d8d0}#orbit .fire-key{border-color:#c57b52}#orbitVelocity{min-width:64px;font-size:11px}#orbitPanel{position:absolute;inset:calc(68px + env(safe-area-inset-top)) 10px calc(10px + env(safe-area-inset-bottom));padding:18px;background:#07131cf5;border:1px solid #477c89;overflow:auto;border-radius:8px}#orbitPanel[hidden]{display:none}#orbitPanel h2{font-size:20px;margin:0 0 12px}#orbitPanel h3{font-size:14px;color:#8ee9d7;margin:20px 0 8px}#orbitPanel p{font-size:12px;line-height:1.6;color:#abc4ce}.orbit-route,.orbit-upgrade{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid #233c4d;padding:10px 0;font-size:13px}.orbit-route small,.orbit-upgrade small{display:block;color:#8ba8b6;font-size:11px;margin-top:5px}.orbit-route button,.orbit-upgrade button{flex-shrink:0}.orbit-inventory{font-size:12px;line-height:1.8;color:#ffdb9a}.orbit-close{float:right}.orbit-danger{color:#ff8b8b!important}#orbitFailure{position:absolute;inset:25% 20px auto;background:#182735;padding:24px;z-index:5;font-size:14px}
  @media(min-width:700px){.orbit-bottom{left:calc(50% - 240px);right:calc(50% - 240px)}#orbitPanel{left:calc(50% - 300px);right:calc(50% - 300px)}.orbit-status{right:auto;width:420px}#orbitHint{top:90px;left:50%;text-align:right}}
  @media(max-height:500px){.orbit-bottom{left:auto;width:290px;gap:3px}.orbit-status{width:300px;right:auto}.orbit-bottom .orbit-throttle{padding:0 5px}#orbitHint{top:125px;right:310px}#orbitMessage{bottom:20px;right:310px;text-align:left}#orbitPanel{top:62px}.orbit-bottom button{min-height:44px!important}}
  #orbitPanel{background:#07131c}#orbit .orbit-close{position:sticky;top:0;z-index:2}#orbit .orbit-top>button{flex-shrink:0;width:76px}#orbitTitle small{font-size:9px;letter-spacing:1px}
  `;document.head.append(css);
  const entry=document.createElement('section');entry.className='orbit-entry';entry.innerHTML='<div class="kicker">ORBITAL FRONTIER / EDEN RECLAMATION</div><h2>星々を巡り、故郷を取り戻せ。</h2><p>3D自由航行・ブースト・ワープ。資源を回収して自機を改造し、危険宙域から母星再生の鍵を持ち帰れ。</p><button id="launchOrbit">宇宙へ出航 ↗</button>';$('shipScreen').prepend(entry);
  const screen=document.createElement('section');screen.id='orbit';screen.hidden=true;screen.setAttribute('aria-label','宇宙航行');screen.innerHTML=`
    <canvas id="orbitCanvas" aria-label="3D宇宙空間。ドラッグで機首を操作"></canvas><canvas id="orbitOverlay" aria-hidden="true"></canvas>
    <div class="orbit-top"><div id="orbitTitle"></div><button id="orbitMenu">星図 / 改造</button><button id="orbitExit">保存・母艦</button></div>
    <div class="orbit-status"><div class="orbit-meter"><span id="orbitHull"></span><progress id="hullBar" max="100"></progress></div><div class="orbit-meter"><span id="orbitShield"></span><progress id="shieldBar"></progress></div><div class="orbit-meter"><span id="orbitEnergy"></span><progress id="energyBar" max="100"></progress></div></div>
    <div id="orbitHint">画面をドラッグして旋回 / スロットルで前進<br>照準を鉱石に合わせてレーザーで採掘</div><div id="orbitMessage" role="status" aria-live="polite"></div>
    <div class="orbit-bottom"><label class="orbit-throttle">推力<input id="orbitThrottle" type="range" min="0" max="100" value="0" aria-label="推力"><span id="orbitVelocity">0 m/s</span></label><button id="orbitBoost" class="boost-key">ブースト</button><button id="orbitFire" class="fire-key">レーザー</button><button id="orbitScan">スキャン</button><button id="orbitTarget">目標切替</button><button id="orbitLand">着陸 / 帰港</button><button id="orbitBrake">停止</button></div>
    <div id="orbitPanel" hidden></div><div id="orbitFailure" hidden></div>`;document.body.append(screen);
  const capacity=()=>60+state.levels.cargo*40,totalCargo=()=>Object.values(state.cargo).reduce((a,b)=>a+b,0),maxShield=()=>80+state.levels.shield*60;
  function commit(){campaign.writeSpace(structuredClone(state));dirty=false;}
  function message(text){$('orbitMessage').textContent=text;}
  function basis(){const y=state.yaw,p=state.pitch;return {f:[Math.sin(y)*Math.cos(p),Math.sin(p),Math.cos(y)*Math.cos(p)],r:[Math.cos(y),0,-Math.sin(y)],u:[-Math.sin(y)*Math.sin(p),Math.cos(p),-Math.cos(y)*Math.sin(p)]};}
  function random(seed){let x=seed;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
  function buildSystem(){
    const sys=systems[state.system],rng=random(931+state.system*781),r=state.restoration;
    objects=[{id:'planet',kind:'planet',name:sys.name,pos:[0,0,950],radius:175,color:state.system===0?[.18-r*.025,.26+r*.09,.29+r*.055]:sys.color}, {id:'moon',kind:'planet',name:'衛星 K-'+(state.system+1),pos:[-980,430,1850],radius:95,color:[.38,.4,.43]}, {id:'port',kind:'station',name:state.system===0?'EDEN 再生ドック':'軌道着陸ゲート',pos:[140,0,610],radius:28,color:[.15,.6,.65]}];
    for(let i=0;i<48;i++){
      const type=i%5===0?(state.system>=3?'core':state.system>=2?'bio':'crystal'):i%3===0?'crystal':'ore';
      const id=`${state.system}:${state.sortie}:${i}`;
      if(state.collected[id])continue;
      objects.push({id,kind:'ore',name:names[type]+'鉱塊',resource:type,pos:i===0?[0,0,170]:[(rng()-.5)*1100,(rng()-.5)*650,130+rng()*1700],radius:7+rng()*9,hp:24+state.system*10,color:type==='ore'?[.36,.3,.23]:type==='bio'?[.23,.7,.43]:type==='core'?[.72,.22,.5]:[.2,.65,.85]});
    }
    for(let i=0;i<6;i++){
      const id=`${state.system}:${state.sortie}:cache${i}`;if(state.collected[id])continue;
      objects.push({id,kind:'cache',name:i%2?'漂流コンテナ':'調査ビーコン',resource:state.system>=2?(state.system===3?'core':'bio'):'crystal',pos:[(rng()-.5)*650,(rng()-.5)*300,250+rng()*1100],radius:7,color:[.3,.95,.7]});
    }
    for(let i=0;i<sys.risk*2;i++)objects.push({id:'drone'+i,kind:'enemy',name:sys.risk===3?'重装迎撃機':'巡回ドローン',pos:[(i%2?1:-1)*(160+i*45),40+i*30,800+i*200],radius:10,hp:45+sys.risk*30,cooldown:2+i*.4,color:[.85,.2,.18]});
    target=0;beams=[];
  }
  function collect(o,amount){const n=Math.min(amount,capacity()-totalCargo());if(n<=0){message('貨物室が満杯。母星のドックへ帰港して資源を保管。');return false;}state.cargo[o.resource]+=n;state.collected[o.id]=true;objects=objects.filter(a=>a!==o);message(`${names[o.resource]} +${n} / 貨物 ${totalCargo()}/${capacity()}`);dirty=true;return true;}
  function stopInputs(){keys.clear();steer=[0,0];stick=null;boost=false;firing=false;document.querySelectorAll('#orbit .held').forEach(b=>b.classList.remove('held'));}
  function open(){if(campaign.hasMission())return;screen.hidden=false;active=true;document.body.style.overflow='hidden';try{renderer=renderer||createRenderer($('orbitCanvas'));}catch(e){active=false;$('orbitFailure').hidden=false;$('orbitFailure').textContent='3D描画を開始できません。WebGL対応ブラウザで再試行してください。保存・母艦で既存の施設探索へ戻れます。';return;}buildSystem();last=0;throttle=0;speed=0;$('orbitThrottle').value=0;message('スロットルで前進。ブーストは長押し。星図から別宙域へワープできます。');frame=requestAnimationFrame(loop);}
  function close(){active=false;cancelAnimationFrame(frame);stopInputs();warp=null;panelOpen=false;$('orbitPanel').hidden=true;screen.hidden=true;document.body.style.overflow='';commit();}
  $('launchOrbit').onclick=open;$('orbitExit').onclick=close;
  function upgradeCost(key){const l=state.levels[key];return {ore:12+l*18,crystal:4+l*7,...(l===2?{bio:8}:{} )};}
  const costText=cost=>Object.entries(cost).map(([k,v])=>`${names[k]} ${v}`).join(' / '),afford=cost=>Object.entries(cost).every(([k,v])=>state.bank[k]>=v);
  const dockDistance=()=>length(sub(state.pos,objects.find(o=>o.id==='port').pos));
  const atHome=()=>state.system===0&&dockDistance()<120;
  function pay(cost){for(const [k,v]of Object.entries(cost))state.bank[k]-=v;}
  function panel(){
    panelOpen=true;stopInputs();speed=0;$('orbitPanel').hidden=false;
    const project=projects[state.restoration];
    $('orbitPanel').innerHTML=`<button id="orbitPanelClose" class="orbit-close">閉じる</button><h2>航海コンソール</h2><p>操船停止中。宙域間はワープ、宙域内は自由飛行。母星ドックで貨物を保管し改造します。</p><h3>星図 / ワープ</h3>${systems.map((sys,i)=>`<div class="orbit-route"><div>${sys.name}<small>${sys.subtitle}</small><small>危険度 ${sys.risk} / 推進器 LV.${sys.gate} 必要</small></div><button data-warp="${i}" ${i===state.system||state.levels.engine<sys.gate||state.energy<50?'disabled':''}>${i===state.system?'現在地':'ワープ'}</button></div>`).join('')}<p>ワープ消費：エネルギー50。航行中は自動回復。母星には常に帰還可能。</p><h3>貨物 ${totalCargo()} / ${capacity()}</h3><div class="orbit-inventory">搭載：${costText(state.cargo)}<br>母星保管：${costText(state.bank)}</div><h3>自機改造 / ${atHome()?'ドック接続':'母星ドックで施工'}</h3>${Object.entries(modules).map(([key,m])=>`<div class="orbit-upgrade"><div>${m.name} LV.${state.levels[key]}<small>${m.hint}</small><small>${state.levels[key]===3?'最大改造':costText(upgradeCost(key))}</small></div><button data-refit="${key}" ${!atHome()||state.levels[key]>=3||!afford(upgradeCost(key))?'disabled':''}>改造</button></div>`).join('')}<p>機体塗装 <select id="orbitPaint" aria-label="機体塗装"><option value="0">POLAR / 白銀</option><option value="1">CINDER / 朱赤</option><option value="2">GHOST / 青緑</option></select></p><h3>母星再生 ${state.restoration}/3</h3><p>${project?project.name+'：'+costText(project.cost):'再生完了。海と森が戻り、EDENは再び生命の星になった。'}</p><button id="restorePlanet" ${!project||!atHome()||!afford(project.cost)?'disabled':''}>${project?'再生計画を実行':'EDEN RESTORED'}</button><p>操作：ドラッグ / 矢印・A D で旋回。W S で推力、Shiftでブースト、Spaceで射撃、Fでスキャン、Eで着陸、Escで星図。宇宙で撃墜されると搭載資源の半分を失い母星へ救難帰還。保管資源・改造は残ります。</p>`;
    $('orbitPanelClose').onclick=()=>{panelOpen=false;$('orbitPanel').hidden=true;last=0;};
    document.querySelectorAll('[data-warp]').forEach(b=>b.onclick=()=>startWarp(Number(b.dataset.warp)));
    document.querySelectorAll('[data-refit]').forEach(b=>b.onclick=()=>{const k=b.dataset.refit,c=upgradeCost(k);if(!atHome()||state.levels[k]>=3||!afford(c))return;pay(c);state.levels[k]++;state.shield=maxShield();commit();panel();message(modules[k].name+'を改造。機体性能が向上しました。');});
    $('orbitPaint').value=state.paint;$('orbitPaint').onchange=e=>{state.paint=Number(e.target.value);commit();};
    $('restorePlanet').onclick=()=>{const p=projects[state.restoration];if(!p||!atHome()||!afford(p.cost))return;pay(p.cost);state.restoration++;commit();buildSystem();panel();message(p.text);};
  }
  $('orbitMenu').onclick=()=>{if(panelOpen){panelOpen=false;$('orbitPanel').hidden=true;last=0;}else panel();};
  function startWarp(i){if(warp||i===state.system||state.levels.engine<systems[i].gate||state.energy<50)return;state.energy-=50;warp={to:i,time:0};panelOpen=false;$('orbitPanel').hidden=true;stopInputs();speed=0;message('ワープ航路確立 → '+systems[i].name);commit();}
  function scan(){if(panelOpen||warp||scanTimer>0)return;scanTimer=2;const candidates=objects.filter(o=>o.kind==='cache'&&length(sub(o.pos,state.pos))<130);if(candidates.length){collect(candidates[0],8+state.system*4);commit();}else{const nearest=objects.filter(o=>['cache','ore'].includes(o.kind)).sort((a,b)=>length(sub(a.pos,state.pos))-length(sub(b.pos,state.pos)))[0];if(nearest){target=objects.indexOf(nearest);message('探知：'+nearest.name+' / '+Math.round(length(sub(nearest.pos,state.pos)))+'m。ビーコンは130m以内で再スキャン。鉱塊はレーザー。');}else message('この航路の資源は回収済み。母星へ帰港すると新たな探索航路が生成されます。');}}
  function land(){if(panelOpen||warp)return;const port=objects.find(o=>o.id==='port'),planet=objects[0];if(length(sub(port.pos,state.pos))>120&&length(sub(planet.pos,state.pos))>planet.radius+100){target=2;message('軌道ゲートの120m以内、または惑星表面の100m以内まで接近してください。');return;}stopInputs();speed=0;throttle=0;$('orbitThrottle').value=0;if(state.system===0){for(const k of Object.keys(names)){state.bank[k]+=state.cargo[k];state.cargo[k]=0;}state.hull=100;state.shield=maxShield();state.energy=100;state.pos=add(port.pos,[0,0,-70]);state.sortie++;state.collected={};commit();buildSystem();message('帰港完了。資源を保管、船体を修復。新たな資源航路を受信。');panel();}else{const contract=systems[state.system].contract;commit();close();campaign.land(contract);}}
  $('orbitLand').onclick=land;$('orbitScan').onclick=scan;$('orbitTarget').onclick=()=>{target=(target+1)%3;message(objects[target].name+'を追跡。画面端の方位マーカーに向けて旋回。');};
  $('orbitThrottle').oninput=e=>{throttle=Number(e.target.value)/100;};$('orbitBrake').onclick=()=>{throttle=0;speed=0;$('orbitThrottle').value=0;stopInputs();};
  function hold(id,set){const b=$(id);b.onpointerdown=e=>{if(panelOpen||warp)return;e.preventDefault();b.setPointerCapture(e.pointerId);set(true);b.classList.add('held');};const release=()=>{set(false);b.classList.remove('held');};b.onpointerup=release;b.onpointercancel=release;b.onlostpointercapture=release;}
  hold('orbitBoost',v=>boost=v);hold('orbitFire',v=>firing=v);
  $('orbitCanvas').onpointerdown=e=>{if(panelOpen||warp)return;stick={id:e.pointerId,x:e.clientX,y:e.clientY};$('orbitCanvas').setPointerCapture(e.pointerId);};
  $('orbitCanvas').onpointermove=e=>{if(stick&&stick.id===e.pointerId)steer=[clamp((e.clientX-stick.x)/65,-1,1),clamp((stick.y-e.clientY)/65,-1,1)];};
  $('orbitCanvas').onpointerup=$('orbitCanvas').onpointercancel=$('orbitCanvas').onlostpointercapture=()=>{stick=null;steer=[0,0];};
  window.addEventListener('keydown',e=>{if(!active||e.target.matches('input,select'))return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' ','shift','w','s','a','d','f','e','escape'].includes(k))e.preventDefault();if(e.repeat)return;if(k==='escape'){if(panelOpen){panelOpen=false;$('orbitPanel').hidden=true;}else panel();return;}if(panelOpen)return;keys.add(k);if(k==='f')scan();if(k==='e')land();});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',stopInputs);document.addEventListener('visibilitychange',()=>{if(!active)return;stopInputs();last=0;if(document.hidden){cancelAnimationFrame(frame);commit();}else frame=requestAnimationFrame(loop);});window.addEventListener('pagehide',()=>{if(active)commit();});
  $('orbitCanvas').addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(frame);stopInputs();commit();message('3D描画が中断されました。保存・母艦へ戻り、ページを再読込してください。');});
  function shoot(){if(shotTimer>0||totalCargo()>=capacity()&&objects.every(o=>o.kind!=='enemy'))return;shotTimer=.23;const {f,r}=basis();let best=null,bestD=650;for(const o of objects){if(!['ore','enemy'].includes(o.kind))continue;const d=sub(o.pos,state.pos),along=dot(d,f);if(along<0||along>650)continue;const side=length(sub(d,mul(f,along)));if(side<o.radius+along*.045&&along<bestD){best=o;bestD=along;}}
    const end=best?best.pos:add(state.pos,mul(f,650));beams.push({from:add(state.pos,add(mul(r,4),mul(f,6))),to:[...end],life:.14,color:'#8bfff1'});
    if(best){best.hp-=16+state.levels.laser*14;if(best.hp<=0){if(best.kind==='enemy'){state.kills++;const resource=state.system===3?'core':state.system===2?'bio':'ore';collect({...best,resource},8+state.system*3);objects=objects.filter(o=>o!==best);message('迎撃機を撃破。回収資源を貨物室へ。');}else collect(best,8+state.system*3);commit();}}
  }
  function update(dt){
    clock+=dt;shotTimer=Math.max(0,shotTimer-dt);scanTimer=Math.max(0,scanTimer-dt);beams=beams.filter(b=>(b.life-=dt)>0);
    if(warp){warp.time+=dt;if(warp.time>=2.4){state.system=warp.to;state.pos=[0,0,0];state.yaw=0;state.pitch=0;warp=null;buildSystem();commit();message(systems[state.system].name+'に到達。周囲をスキャンして資源を探してください。');}return;}
    state.yaw+=(steer[0]+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0))*dt*1.2;
    state.pitch=clamp(state.pitch+(steer[1]+(keys.has('arrowup')?1:0)-(keys.has('arrowdown')?1:0))*dt,-1.48,1.48);
    if(keys.has('w')||keys.has('s')){throttle=clamp(throttle+dt*((keys.has('w')?1:0)-(keys.has('s')?1:0)),0,1);$('orbitThrottle').value=throttle*100;}
    const boosting=(boost||keys.has('shift'))&&state.energy>2,desired=boosting?180+state.levels.engine*65:throttle*(35+state.levels.engine*13);
    speed+=(desired-speed)*Math.min(1,dt*2.5);state.energy=clamp(state.energy+(boosting?-23:11)*dt,0,100);const {f}=basis();state.pos=add(state.pos,mul(f,speed*dt));
    for(const o of objects.filter(o=>o.kind==='planet')){const delta=sub(state.pos,o.pos),d=length(delta);if(d<o.radius+22){state.pos=add(o.pos,mul(unit(delta),o.radius+22));speed=0;throttle=0;$('orbitThrottle').value=0;message('大気圏境界。着陸ボタンで地上施設へ。');}}
    if(length(state.pos)>6500){state.pos=mul(unit(state.pos),6500);speed=0;message('航行境界。星図から別宙域にワープできます。');}
    let threatened=false;
    for(const o of objects.filter(o=>o.kind==='enemy')){const delta=sub(state.pos,o.pos),d=length(delta);if(d<650){threatened=true;if(d>150)o.pos=add(o.pos,mul(unit(delta),(22+state.system*7)*dt));else o.pos=add(o.pos,[Math.cos(clock+o.radius)*12*dt,Math.sin(clock)*8*dt,0]);o.cooldown-=dt;if(o.cooldown<=0&&d<420){o.cooldown=2.4;beams.push({from:[...o.pos],to:[...state.pos],life:.3,color:'#ff675d'});const damage=boosting?0:6+state.system*5,absorbed=Math.min(state.shield,damage);state.shield-=absorbed;state.hull-=damage-absorbed;if(damage)message('敵レーザー被弾！ブーストで射線を離脱、旋回して迎撃。');}}}
    if(!threatened)state.shield=Math.min(maxShield(),state.shield+dt*(5+state.levels.shield*3));
    if(firing||keys.has(' '))shoot();
    if(state.hull<=0){for(const k of Object.keys(names))state.cargo[k]=Math.floor(state.cargo[k]/2);state.system=0;state.pos=[140,0,540];state.yaw=0;state.pitch=0;state.hull=100;state.shield=maxShield();state.energy=100;speed=0;throttle=0;$('orbitThrottle').value=0;stopInputs();buildSystem();commit();message('救難帰還。搭載資源の半分を喪失。保管資源と改造は維持。');}
    saveTimer+=dt;if(saveTimer>=3){saveTimer=0;commit();}
  }
  function loop(time){if(!active||document.hidden)return;const dt=last?Math.min((time-last)/1000,.05):0;last=time;if(!panelOpen){update(dt);animateRig(dt);}draw();frame=requestAnimationFrame(loop);}
  function draw(){const {f,r,u}=basis(),camera=add(sub(state.pos,mul(f,58)),mul(u,13));renderer.render(objects,state,camera,{f,r,u},clock,warp,speed);drawHUD(camera,{f,r,u});if($('orbitTitle').dataset.system!==String(state.system)){$('orbitTitle').dataset.system=state.system;$('orbitTitle').innerHTML='<small>RIFT // ORBITAL FRONTIER</small>'+systems[state.system].name;}$('orbitHull').textContent='船体 '+Math.ceil(state.hull);$('hullBar').value=state.hull;$('orbitShield').textContent='盾 '+Math.ceil(state.shield);$('shieldBar').max=maxShield();$('shieldBar').value=state.shield;$('orbitEnergy').textContent='EN '+Math.floor(state.energy);$('energyBar').value=state.energy;$('orbitVelocity').textContent=Math.round(speed)+' m/s';}
  function drawHUD(camera,b){const c=$('orbitOverlay'),w=screen.clientWidth,h=screen.clientHeight;if(c.width!==w||c.height!==h){c.width=w;c.height=h;}const g=c.getContext('2d');g.clearRect(0,0,w,h);const project=p=>{const d=sub(p,camera),z=dot(d,b.f);return [w/2+dot(d,b.r)*h*.85/Math.max(1,z),h/2-dot(d,b.u)*h*.85/Math.max(1,z),z];};
    g.strokeStyle='#70f3da99';g.lineWidth=1;g.beginPath();g.arc(w/2,h/2,13,0,Math.PI*2);g.moveTo(w/2-22,h/2);g.lineTo(w/2-9,h/2);g.moveTo(w/2+9,h/2);g.lineTo(w/2+22,h/2);g.stroke();
    for(const beam of beams){const a=project(beam.from),z=project(beam.to);if(a[2]>0&&z[2]>0){g.strokeStyle=beam.color;g.lineWidth=2;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(z[0],z[1]);g.stroke();}}
    const o=objects[target]||objects[0];if(o){const a=project(o.pos),distance=Math.round(length(sub(o.pos,state.pos))),behind=a[2]<0,x=behind?(dot(sub(o.pos,state.pos),b.r)>0?w-24:24):clamp(a[0],24,w-24),y=behind?h*.4:clamp(a[1],170,h-205);g.strokeStyle='#78eddb';g.lineWidth=1;g.strokeRect(x-9,y-9,18,18);g.fillStyle='#a4fff0';g.font='11px monospace';g.textAlign=x>w*.65?'right':x<w*.35?'left':'center';g.fillText((behind?'旋回 → ':'')+o.name,clamp(x,12,w-12),y-18);g.fillText(distance+' m',x,y+26);}
    // Local radar is a horizontal projection of nearby 3D positions.
    const rx=52,ry=h-228;g.fillStyle='#04111b99';g.beginPath();g.arc(rx,ry,36,0,7);g.fill();g.strokeStyle='#396774';g.stroke();g.fillStyle='#9fffea';g.fillRect(rx-2,ry-2,4,4);for(const o of objects){if(o.kind==='planet')continue;const d=sub(o.pos,state.pos);if(length(d)>650)continue;g.fillStyle=o.kind==='enemy'?'#ff6b64':o.kind==='ore'?'#dfb77c':'#6de7e0';g.fillRect(rx+dot(d,b.r)/650*32-1,ry-dot(d,b.f)/650*32-1,3,3);}g.fillStyle='#8fb2c1';g.font='9px monospace';g.textAlign='left';g.fillText('RADAR 650m',15,ry+49);
    if(warp){g.fillStyle=`rgba(90,170,220,${Math.sin(warp.time/2.4*Math.PI)*.28})`;g.fillRect(0,0,w,h);g.strokeStyle='#a3efffcc';for(let i=0;i<35;i++){const angle=i*2.399,rad=(warp.time*330+i*37)%(h*.8);g.beginPath();g.moveTo(w/2+Math.cos(angle)*rad,h/2+Math.sin(angle)*rad);g.lineTo(w/2+Math.cos(angle)*(rad+90),h/2+Math.sin(angle)*(rad+90));g.stroke();}}
  }
  // Three.js owns the scene, perspective camera, materials and all GPU resources.
  function createRenderer(canvas){
    const renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.autoClear=false;
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(2*Math.atan(1/1.7)*180/Math.PI,1,1,15000);
    scene.add(new THREE.HemisphereLight(0xb9d9ff,0x17202c,2.1));
    const sun=new THREE.DirectionalLight(0xffe5c5,3.4);sun.position.set(-60,70,80);scene.add(sun);
    const rimLight=new THREE.DirectionalLight(0x37a7ff,2.8);rimLight.position.set(25,5,-40);scene.add(rimLight);
    const shipGroup=new THREE.Group();shipGroup.name='articulated-player';scene.add(shipGroup);
    const pools={world:[],ship:[]};let group='world',used={world:0,ship:0},width=0,height=0;
    const skyScene=new THREE.Scene(),skyCamera=new THREE.Camera();
    const skyMat=new THREE.ShaderMaterial({depthWrite:false,depthTest:false,uniforms:{tint:{value:new THREE.Color()},look:{value:new THREE.Vector2()}},
      vertexShader:'varying vec2 uvSky;void main(){uvSky=position.xy;gl_Position=vec4(position.xy,1.,1.);}',
      fragmentShader:'precision mediump float;varying vec2 uvSky;uniform vec3 tint;uniform vec2 look;void main(){vec2 p=uvSky+look;float mist=pow(max(0.,1.-abs(p.y*.8+p.x*.4+sin(p.x*2.)*.17)),4.);float wisps=.5+.5*sin(p.x*8.+sin(p.y*7.)*2.);gl_FragColor=vec4(tint*.5+vec3(.025,.035,.075)*mist*(.3+wisps*.7),1.);}'});
    skyScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),skyMat));
    const terrainFragment="precision mediump float;uniform vec3 color,fog;uniform float surface,emission,life,opacity;varying vec3 eye;varying vec3 n;varying vec3 local;varying float depth;void main(){float light=.2+.8*max(0.,dot(normalize(n),normalize(vec3(-.6,.7,.8))));float bands=sin(local.x*18.+sin(local.y*21.)*2.+local.z*13.);float grain=sin(local.x*55.)*sin(local.y*47.)*sin(local.z*61.);vec3 base=color*(1.+surface*(bands*.16+grain*.08));float ocean=step(.25,bands)*surface;if(life>0.){float continent=sin(local.x*7.+sin(local.z*4.))*cos(local.y*8.+local.z*3.)+grain*.12;vec3 land=mix(vec3(.32,.3,.18),vec3(.12,.42,.2),max(0.,life-1.)*.5);vec3 living=mix(vec3(.035,.22,.42),land,smoothstep(-.05,.12,continent));base=mix(base,living,life/3.);base=mix(base,vec3(.8,.86,.89),smoothstep(.85,.98,abs(local.y))*life/3.);}vec3 shaded=mix(base,base*.58+vec3(.01,.035,.06),ocean*.25)*light;if(surface<0.){vec3 halfway=normalize(normalize(vec3(-.6,.7,.8))+normalize(eye));shaded=base*light+vec3(.35,.48,.65)*pow(max(0.,dot(normalize(n),halfway)),36.);shaded+=vec3(.07,.12,.2)*pow(1.-max(0.,dot(normalize(n),normalize(eye))),3.);}shaded+=color*emission;gl_FragColor=vec4(mix(shaded,fog,clamp(depth/12000.,0.,.8)),opacity);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}";
    const terrainVertex='varying vec3 n;varying vec3 local;varying vec3 eye;varying float depth;void main(){vec4 world=modelMatrix*vec4(position,1.);vec4 view=modelViewMatrix*vec4(position,1.);n=mat3(modelMatrix)*normal;local=position;eye=cameraPosition-world.xyz;depth=-view.z;gl_Position=projectionMatrix*view;}';
    function mesh(triangles){const positions=[];for(const t of triangles)for(const p of t)positions.push(...p);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();return geometry;}
    function sphere(rows,cols){const tris=[],p=(a,b)=>[Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)];for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*Math.PI/rows,b=i*2*Math.PI/cols,c=(j+1)*Math.PI/rows,d=(i+1)*2*Math.PI/cols;tris.push([p(a,b),p(a,d),p(c,b)],[p(a,d),p(c,d),p(c,b)]);}return mesh(tris);}
    const planet=sphere(32,48),rock=sphere(5,7),orb=sphere(8,12);
    function lathe(profile,segments=20){const tris=[];for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){const point=(k,a)=>[profile[k][1]*Math.cos(a),profile[k][1]*Math.sin(a),profile[k][0]],a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;tris.push([point(j,a),point(j,b),point(j+1,a)],[point(j,b),point(j+1,b),point(j+1,a)]);}return mesh(tris);}
    function plate(outline,height){const tris=[];for(let i=1;i<outline.length-1;i++)for(const y of [-height,height]){const t=[outline[0],outline[i],outline[i+1]].map(p=>[p[0],y,p[1]]);tris.push(y>0?t.reverse():t);}for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];tris.push([[a[0],-height,a[1]],[b[0],height,b[1]],[a[0],height,a[1]]],[[a[0],-height,a[1]],[b[0],-height,b[1]],[b[0],height,b[1]]]);}return mesh(tris);}
    const hull=lathe([[-5,.4],[-4,1.4],[-1,1.65],[3,1.2],[7.5,.05]],12);
    const wing=plate([[.7,2],[2.8,1],[7,-3.7],[6.8,-5.2],[2,-3.2],[.7,-4]],.22);
    const fin=plate([[0,-1],[0,1.5],[1.7,-.6],[1.5,-2]],.1);
    const housing=lathe([[-2,1],[-1.7,1.2],[1.5,1.2],[2.3,.75]],16);
    const nozzle=lathe([[.7,.65],[.4,.85],[-.7,1.08],[-1,1.08],[-1,.82],[.3,.5]],24);
    const collar=lathe([[-.22,.96],[.22,.96],[.22,.72],[-.22,.72],[-.22,.96]],24);
    const flame=lathe([[0,.72],[-.22,.9],[-.65,.55],[-1,0]],16);
    function rotateAxes(a,yaw=0,pitch=0,roll=0){const c=Math.cos,s=Math.sin;const r=add(mul(a.r,c(yaw)),mul(a.f,-s(yaw))),f=add(mul(a.r,s(yaw)),mul(a.f,c(yaw))),u=add(mul(a.u,c(pitch)),mul(f,-s(pitch))),forward=add(mul(a.u,s(pitch)),mul(f,c(pitch)));return {r:add(mul(r,c(roll)),mul(u,s(roll))),u:add(mul(r,-s(roll)),mul(u,c(roll))),f:forward};}
    const ship=mesh([[[0,.6,3],[-1,-.4,-2],[1,-.4,-2]],[[0,.6,3],[1,-.4,-2],[0,.9,-1]],[[0,.6,3],[0,.9,-1],[-1,-.4,-2]],[[-1,-.4,-2],[0,.9,-1],[1,-.4,-2]],[[-.5,0,1],[-4,-.2,-2],[-.6,.4,-1]],[[.5,0,1],[.6,.4,-1],[4,-.2,-2]],[[-4,-.2,-2],[-.5,0,1],[-.8,-.3,-2]],[[4,-.2,-2],[.8,-.3,-2],[.5,0,1]]]);
    const cube=mesh([[[ -1,-1,-1],[1,1,-1],[1,-1,-1]],[[-1,-1,-1],[-1,1,-1],[1,1,-1]],[[-1,-1,1],[1,-1,1],[1,1,1]],[[-1,-1,1],[1,1,1],[-1,1,1]],[[-1,-1,-1],[-1,-1,1],[-1,1,1]],[[-1,-1,-1],[-1,1,1],[-1,1,-1]],[[1,-1,-1],[1,1,1],[1,-1,1]],[[1,-1,-1],[1,1,-1],[1,1,1]],[[-1,1,-1],[-1,1,1],[1,1,1]],[[-1,1,-1],[1,1,1],[1,1,-1]],[[-1,-1,-1],[1,-1,1],[-1,-1,1]],[[-1,-1,-1],[1,-1,-1],[1,-1,1]]]);
    const rng=random(19),starTriangles=[];for(let i=0;i<650;i++){const p=mul(unit([rng()-.5,rng()-.5,rng()-.5]),5000),s=2+rng()*5;starTriangles.push([add(p,[-s,0,0]),add(p,[s,0,0]),add(p,[0,s,0])],[add(p,[0,-s,0]),add(p,[0,s,0]),add(p,[0,0,s])]);}const stars=mesh(starTriangles);
    const ringTriangles=[];const ringPoint=(a,b)=>[(1.55+Math.cos(b)*.012)*Math.cos(a),Math.sin(a)*.18+Math.sin(b)*.012,(1.55+Math.cos(b)*.012)*Math.sin(a)];for(let i=0;i<96;i++)for(let j=0;j<6;j++){const a=i*Math.PI/48,b=j*Math.PI/3,c=(i+1)*Math.PI/48,d=(j+1)*Math.PI/3;ringTriangles.push([ringPoint(a,b),ringPoint(c,b),ringPoint(a,d)],[ringPoint(a,d),ringPoint(c,b),ringPoint(c,d)]);}const ring=mesh(ringTriangles);

    function renderMesh(geometry,center,scale,color,surface=0,emission=0,axes=null,life=0,opacity=1){
      const index=used[group]++,pool=pools[group];let m=pool[index];
      if(!m){m=new THREE.Mesh();m.matrixAutoUpdate=false;m.name=group+'-part-'+index;pool.push(m);(group==='ship'?shipGroup:scene).add(m);}
      const kind=surface>=1?'terrain':opacity<1?'glow':'solid';
      if(m.userData.kind!==kind){if(m.material)m.material.dispose();m.userData.kind=kind;
        m.material=kind==='terrain'?new THREE.ShaderMaterial({vertexShader:terrainVertex,fragmentShader:terrainFragment,side:THREE.DoubleSide,uniforms:{color:{value:new THREE.Color()},fog:{value:new THREE.Color()},surface:{value:1},emission:{value:0},life:{value:0},opacity:{value:1}}}):kind==='glow'?new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false}):new THREE.MeshStandardMaterial({side:THREE.DoubleSide});
      }
      m.visible=true;m.geometry=geometry;const material=m.material;
      if(kind==='terrain'){material.uniforms.color.value.setRGB(...color);material.uniforms.fog.value.setRGB(...systems[state.system].fog);material.uniforms.life.value=life;material.uniforms.emission.value=emission;}
      else{material.color.setRGB(...color);material.opacity=opacity;if(kind==='solid'){material.metalness=surface<0?.65:.12;material.roughness=surface<0?.32:.7;material.emissive.setRGB(...color);material.emissiveIntensity=emission;}}
      const r=axes?.r||[1,0,0],u=axes?.u||[0,1,0],f=axes?.f||[0,0,1];
      // Mirror the simulation's positive-forward Z into Three.js's right-handed world.
      m.matrix.set(r[0]*scale[0],u[0]*scale[1],f[0]*scale[2],center[0],r[1]*scale[0],u[1]*scale[1],f[1]*scale[2],center[1],-r[2]*scale[0],-u[2]*scale[1],-f[2]*scale[2],-center[2],0,0,0,1);m.matrixWorldNeedsUpdate=true;
    }
    return {info:()=>({engine:'Three.js',revision:THREE.REVISION,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,shipMeshes:pools.ship.length}),render(objects,state,cam,b,time,warp,speed){
      const w=screen.clientWidth,h=screen.clientHeight;if(width!==w||height!==h){width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
      camera.position.set(cam[0],cam[1],-cam[2]);camera.up.set(b.u[0],b.u[1],-b.u[2]);camera.lookAt(cam[0]+b.f[0],cam[1]+b.f[1],-cam[2]-b.f[2]);
      const fog=systems[state.system].fog;renderer.setClearColor(new THREE.Color(...fog));skyMat.uniforms.tint.value.setRGB(...fog);skyMat.uniforms.look.value.set(state.yaw*.14,state.pitch*.2);
      used.world=0;used.ship=0;group='world';
      renderMesh(stars,cam,[1,1,1],[.6,.72,.9],0,1.4);
      for(const o of objects){if(o.kind==='planet'){renderMesh(planet,o.pos,[o.radius,o.radius,o.radius],o.color,1,0,null,state.system===0&&o.id==='planet'?state.restoration:0);if(o.id==='planet')renderMesh(ring,o.pos,[o.radius,o.radius,o.radius],[.4,.5,.61],0,.25);}
        else if(o.kind==='station'){renderMesh(cube,o.pos,[24,6,12],[.2,.28,.34]);for(const x of [-1,1]){renderMesh(cube,add(o.pos,[x*38,0,0]),[18,1,24],[.07,.19,.3]);renderMesh(cube,add(o.pos,[x*14,10,0]),[2,10,2],[.2,.85,.8],0,.8);}}
        else if(o.kind==='enemy')renderMesh(ship,o.pos,[3,3,3],o.color,0,.05);
        else if(o.kind==='cache'){renderMesh(rock,o.pos,[o.radius*.6,o.radius,o.radius*.6],[.18,.3,.34],0,.1);renderMesh(orb,o.pos,[o.radius*.3,o.radius*1.2,o.radius*.3],o.color,0,.6);}
        else renderMesh(rock,o.pos,[o.radius,o.radius*.8,o.radius],o.color,1,0);
      }

      group='ship';drawPlayer(state,b,time);
      for(const kind of ['world','ship'])for(let i=used[kind];i<pools[kind].length;i++)pools[kind][i].visible=false;
      renderer.clear();renderer.render(skyScene,skyCamera);renderer.clearDepth();renderer.render(scene,camera);
    }};
    function drawPlayer(state,b,time){
      const body=rotateAxes(b,rig.yaw*.08,-rig.pitch*.12,rig.bank),paint=[[.62,.72,.8],[.65,.2,.12],[.1,.46,.39]][state.paint]||[.62,.72,.8];
      const steel=[.24,.3,.38],dark=[.065,.095,.14],light=[.66,.75,.82],cyan=[.12,.65,1];
      const at=(p,a=body,origin=state.pos)=>add(origin,add(mul(a.r,p[0]),add(mul(a.u,p[1]),mul(a.f,p[2]))));
      const part=(m,p,size,color,axes=body,emission=0)=>renderMesh(m,at(p),size,color,-1,emission,axes);
      part(hull,[0,0,0],[1,.7,1],paint);part(hull,[0,.8,-.2],[.62,.38,.83],light);
      part(orb,[0,1.22,2.1],[.8,.46,1.95],[.035,.24,.38],body,.2);
      part(cube,[0,1.15,.1],[.27,.12,1.25],dark);
      part(cube,[0,1.04,-2.3],[.48,.22,1.2],dark);
      for(let i=0;i<4;i++)part(cube,[0,1.29,-3.1+i*.5],[.44,.04,.1],steel);
      for(const side of [-1,1]){
        part(wing,[0,0,0],[side,1,1],paint);
        part(wing,[side*.1,.26,-.2],[side*.88,.15,.86],steel);
        part(fin,[side*1.7,.6,-2.2],[side,1,1],paint,rotateAxes(body,0,0,side*Math.PI*.42));
        part(cube,[side*2.1,.25,-1.4],[.25,.42,2.5],dark);
        part(cube,[side*2.1,.7,-1.6],[.14,.05,1.6],[.95,.52,.16]);
        part(cube,[side*6.4,.32,-4.2],[.35,.12,.13],side<0?[.9,.12,.08]:[.14,.8,.55],body,.6);
        part(housing,[side*3.8,.05,-2.5],[1,.9,1],steel);
        part(cube,[side*3.8,1.15,-1.7],[.62,.12,1.1],paint);
        for(let i=0;i<3;i++)part(cube,[side*3.8,1.28,-2.6+i*.5],[.52,.03,.09],dark);
        // The joint, nozzle and exhaust share articulated local axes. Steering is visual only.
        const pivot=at([side*3.8,.05,-4.4]),gimbal=rotateAxes(body,-rig.yaw*.38,rig.pitch*.32+side*rig.yaw*.07);
        renderMesh(orb,pivot,[.85,.85,.85],dark,-1,0,body);
        renderMesh(collar,pivot,[1,1,1],light,-1,0,body);
        renderMesh(nozzle,at([0,0,-.6],gimbal,pivot),[1,1,1],steel,-1,0,gimbal);
        const outlet=at([0,0,-1.63],gimbal,pivot),power=.12+rig.thrust*.88;
        for(let i=0;i<8;i++){const angle=i*Math.PI/4,rad=.93+rig.thrust*.12,petal=rotateAxes(gimbal,Math.cos(angle)*rig.thrust*.12,Math.sin(angle)*rig.thrust*.12);renderMesh(cube,at([Math.cos(angle)*rad,Math.sin(angle)*rad,-.85],gimbal,pivot),[.13,.13,.65],light,-1,0,petal);}
        renderMesh(orb,outlet,[.68,.68,.12],cyan,0,1.2,gimbal);
        // Transparent additive plumes keep the world visible behind exhaust and honor depth.

        const pulse=reducedMotion.matches?1:1+Math.sin(time*37+side)*.045;
        renderMesh(flame,outlet,[1.1,1.1,(2+power*8)*pulse],[.025,.18,.7],0,.7,gimbal,0,.28);
        renderMesh(flame,outlet,[.62,.62,(1.2+power*5)*pulse],[.15,.7,1],0,1.2,gimbal,0,.5);
        renderMesh(flame,outlet,[.3,.3,.6+power*2.6],[.7,.93,1],0,1.3,gimbal,0,.8);
        if(rig.thrust>.55)for(let i=1;i<=3;i++)renderMesh(orb,at([0,0,-i*2],gimbal,outlet),[.2,.2,.5],cyan,0,1,gimbal,0,(1-i*.2)*rig.thrust*.6);

        const pod=[side*(2.2+state.levels.cargo*.25),-.9,-2.8];if(state.levels.cargo)part(housing,pod,[.4+state.levels.cargo*.12,.5,.7],dark);
        part(cube,[side*5.5,.1,-1.8],[.22,.25,1+state.levels.laser*.4],dark);
        part(collar,[side*5.5,.1,-.65+state.levels.laser*.4],[.3,.3,.5],steel);
        // Forward braking jets and lateral reaction-control jets respond independently.
        const reaction=Math.max(rig.brake,Math.abs(rig.yaw)*.55,Math.abs(rig.pitch)*.5);
        part(orb,[side*1.3,-.1,3.9],[.23,.23,.3],dark);
        if(reaction>.06){const jetAxes=rotateAxes(body,side*Math.PI/2,rig.pitch*.3);renderMesh(flame,at([side*1.6,-.1,3.9]),[.18,.18,reaction*2.5],cyan,0,1,jetAxes);}
      }
    }
  }
  window.RiftOrbitRecovery=(contract,complete,loot)=>{const resource=contract===2?'core':contract===1?'bio':'ore',amount=Math.min((complete?12:0)+Math.floor(loot/20),capacity()-totalCargo());state.cargo[resource]+=amount;commit();};
  // Read-only diagnostics; tests drive the same DOM controls as players.
  window.__ORBIT_TEST__={state:()=>structuredClone(state),flight:()=>({active,speed,throttle,panelOpen,warp:warp?{...warp}:null}),objects:()=>structuredClone(objects),rig:()=>({...rig}),renderer:()=>renderer?.info()};
})();
