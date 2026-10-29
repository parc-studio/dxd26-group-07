/* 05-ui.js — Interface: dot progress bar, pages, landing (tap to record your sound), catalog, automatic mixtape recording, mute, cart cards and the "get it." page. */
function setName(){}function setStrip(){}
/* ====================== dot progress bar ====================== */
const led=$('#led');
let landT0=0,landing=false;const LANDMAX=10;
function drawLED(dt){const [W,H]=fitCanvas(led),x=led.getContext('2d'),d=W/led.clientWidth,now=performance.now();x.clearRect(0,0,W,H);
  x.fillStyle='#f3f3f3';x.beginPath();x.roundRect?x.roundRect(0,0,W,H,7*d):x.rect(0,0,W,H);x.fill();
  const p=8.65*d,r=2.5*d,rp=9*d,rows=4,cols=Math.floor((W-8.6*d*2)/p)+1,ox=(W-(cols-1)*p)/2,oy=(H-(rows-1)*rp)/2; // dots centred: same margin left/right and top/bottom
  let frac;if(mixPlaying)frac=clamp((discState.r||0)/Math.max(1,discLen),0,1)*mixFrac();else if(landing)frac=clamp((now-landT0)/(LANDMAX*1000),0,1);else if(page==='end')frac=discFrac();else frac=mixFrac();
  const edge=frac*cols,blink=(mixRec||landing)&&((now/220|0)%2);
  for(let c=0;c<cols;c++){let a=c<Math.floor(edge)?1:.4;if((mixRec||landing)&&c===Math.floor(edge))a=blink?1:.4;x.globalAlpha=a;x.fillStyle='#000';
    for(let rw=0;rw<rows;rw++){x.beginPath();x.arc(ox+c*p,oy+rw*rp,r,0,7);x.fill()}}
  x.globalAlpha=1}
function discFrac(){return typeof discLen!=='undefined'&&discLen?((discState.r||0)/discLen):0}
/* small text messages (the dot bar is only 4 rows now) */
let toastT=0;function ledMsg(t,ms=1800){const el=$('#toast');el.textContent=t.toLowerCase();el.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),ms)}

/* ====================== pages ====================== */
let page='land';
const MACH=p=>p==='obp'?'ob':p==='epp'?'ep':null;let lastMachine='ob';
function show(p){if(MACH(page)&&p!==page){if(mixRec)stopRec();if(mixPlaying)mixPause()}page=p;['pp','obp','epp','fin','end','get','thx'].forEach(id=>$('#'+id).classList.toggle('show',id===p));
  if(MACH(p))lastMachine=MACH(p);
  app.classList.toggle('inpage',p!=='cat'&&p!=='land');app.classList.toggle('incat',p==='cat');app.classList.toggle('incart',p==='end'||p==='get'||p==='thx');
  app.classList.remove('zoomed');
  if(p!=='obp'&&volG)setG(volG,0,.15);
  if(p!=='epp'&&epVol){setG(epVol,0,.15);loopStop();clkStop();if(punchPad!==null)punch(punchPad,false)}
  if(p!=='end'&&discNode)discNode.port.postMessage({t:'speed',v:0,snap:true});
  if(p==='end'||p==='get')$('#'+p+' .scroll').scrollTop=0;
}
$('#ppBack').addEventListener('click',()=>show('cat'));
$('#obBack').addEventListener('click',()=>show('cat'));
$('#epBack').addEventListener('click',()=>show('cat'));
$('#endBack').addEventListener('click',()=>lastMachine==='ep'?openEP():openOB());
$('#buy').addEventListener('click',()=>{if(!activeMach().length){ledMsg('nothing left on your tape',1600);return}openGet()});
$('#getBack').addEventListener('click',()=>{show('end');discNode.port.postMessage({t:'speed',v:discPlaying?1:0})});
$('#checkout').addEventListener('click',()=>{if(!activeMach().some(m=>cartQty[m]>0)){ledMsg('your cart is empty',1600);return}show('thx')});

/* ====================== landing: tap to record your sound, tap to stop ====================== */
let stream=null,mr=null,chunks=[],an=null,anSrc=null,recTimer=null,started=false,micFails=0;
function micOK(){return !!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.MediaRecorder)}
async function micStart(){setSession('play-and-record');stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  chunks=[];mr=new MediaRecorder(stream);mr.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};mr.start();
  an=ctx.createAnalyser();an.fftSize=1024;anSrc=ctx.createMediaStreamSource(stream);anSrc.connect(an)}
function micStop(){return new Promise(res=>{if(!mr||mr.state==='inactive')return res(null);
  mr.onstop=async()=>{try{anSrc&&anSrc.disconnect()}catch(e){}stream&&stream.getTracks().forEach(t=>t.stop());stream=null;an=null;setSession('playback');silentEl&&silentEl.play().catch(()=>{});
    try{const b=new Blob(chunks,{type:mr.mimeType||'audio/mp4'});res(normalize(await decode(await b.arrayBuffer())))}catch(e){res(null)}};mr.stop()})}
function primeMic(){if(!micOK())return;navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{s.getTracks().forEach(t=>t.stop());setSession('playback')}).catch(()=>{})}
primeMic();
// every real tap retries the gyroscope permission until the phone says yes (iOS only accepts it on a tap)
['click','touchend'].forEach(ev=>addEventListener(ev,()=>askTilt(),{capture:true,passive:true}));
$('#land').addEventListener('pointerdown',()=>unlock(),{capture:true});
const big=$('#bigrec');let starting=false;
async function landTap(e){e.preventDefault();
  if(landing){finishLanding();return}
  if(starting)return;starting=true;big.classList.add('press');
  try{await unlock()}catch(err){}
  if(!micOK()){starting=false;big.classList.remove('press');ledMsg('no microphone on this link — playing a demo sound',2600);setTimeout(async()=>go(normalize(await song())),1400);return}
  try{await micStart()}catch(err){starting=false;big.classList.remove('press');micFails++;
    if(micFails<2){ledMsg('allow the microphone, then tap again',2800);return}
    ledMsg('microphone blocked — playing a demo sound',2600);setTimeout(async()=>go(normalize(await song())),1400);return}
  starting=false;big.classList.remove('press');
  landing=true;big.classList.add('rec');landT0=performance.now();if(navigator.vibrate)navigator.vibrate(12);recTimer=setTimeout(finishLanding,LANDMAX*1000);
}
async function finishLanding(){if(!landing)return;clearTimeout(recTimer);big.classList.remove('press','rec');const held=(performance.now()-landT0)/1000;landing=false;
  const b=await micStop();if(b&&held>.4&&b.duration>.3)go(b);else ledMsg('tap to record, tap again to stop',1800)}
big.addEventListener('click',landTap);big.addEventListener('contextmenu',e=>e.preventDefault());
function go(b){userBuf=b;started=true;startLine();$('#land').classList.add('gone');show('cat');setTimeout(preload3D,400)}
// build both 3D scenes (and compile their shaders) while you browse, so opening a product is instant
let preloaded=false;addEventListener('load',()=>setTimeout(preload3D,1200));async function preload3D(){if(preloaded)return;preloaded=true;try{await init3D();warm(scene,camera);await initEP();if(!EPKEYS)epKeys();warm(epScene,epCam)}catch(e){console.warn(e)}}
function warm(sc,cam){try{renderer.setSize(8,8,false);cam.aspect=1;cam.updateProjectionMatrix();renderer.compile(sc,cam)}catch(e){}}
$('#upload').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{btBuf=normalize(await decode(await f.arrayBuffer()));startBt();if(page==='obp'){ob.src=1;ob.btPlay=true;route();msg('PAIRED')}}catch(err){msg('FILE?')}e.target.value=''});

/* ====================== catalog: vertical list, front photos ====================== */
const cards=$('#cards');
CAT.forEach((p,i)=>{const c=document.createElement('div');c.className='card';
  c.innerHTML=`<div class="im"><img alt="${p.name}" decoding="async"></div><div class="row"><div class="sm">${p.name}<br>${p.price}</div></div>`;
  c.querySelector('img').src=IMG[p.img]||'';cards.appendChild(c);
  let d0=null;c.addEventListener('pointerdown',e=>d0={x:e.clientX,y:e.clientY,t:performance.now()});
  c.addEventListener('pointerup',e=>{if(d0&&Math.hypot(e.clientX-d0.x,e.clientY-d0.y)<10&&performance.now()-d0.t<600)openItem(i);d0=null})});
function catTick(){}function layoutCat(){}
function openItem(i){const p=CAT[i];
  if(p.live==='ep'){openEP();return}
  if(p.live){openOB();return}
  $('#ppimg').src=IMG[p.img];$('#ppname').innerHTML=p.name+'<br>'+p.price;show('pp')}

/* ====================== mixtape: records by itself while you play · ▶ listen · ⤓ save ====================== */
const MAXS=60;let mixSegs=[],mixLen=0,mixRec=false,recCb=null,usedModes=[],afterStop=null,mixMach=[],recMach=null;
const MINFO={ob:{name:'OB – 4',sub:'magic radio',price:549,img:'ob'},ep:{name:'EP – 133',sub:'K.O. II sampler',price:299,img:'p6'}};
function recPort(m){return m==='ep'?epTape.port:tapeNode.port}
const isFull=()=>ctx&&mixLen>=MAXS*ctx.sampleRate-100;
function mixFrac(){if(!ctx)return 0;const st=recMach==='ep'?epState:tapeState,live=mixRec?Math.max(0,st.recN||0):0;return clamp((mixLen+live)/(MAXS*ctx.sampleRate),0,1)}
function setRecUI(){document.querySelectorAll('.key.pb').forEach(k=>k.classList.toggle('empty',mixLen<ctx.sampleRate*.3&&!mixRec))}
function fadeEdges(d){const n=Math.min(441,d.length>>2);for(let i=0;i<n;i++){const g=i/n;d[i]*=g;d[d.length-1-i]*=g}return d}
function startRec(){const m=MACH(page);if(mixRec||!m||isFull())return;
  if(m==='ob'&&!ob.on){ob.vol=Math.max(ob.vol,-40);knobVis=ob.vol;power(true)}
  if(m==='ep')epAudio();
  mixRec=true;recMach=m;
  recCb=d=>{if(d.length>ctx.sampleRate*.25){mixSegs.push(fadeEdges(d));mixLen+=d.length;mixMach.push(m)}mixRec=false;setRecUI();if(isFull())ledMsg('your mixtape is full — save it',2200);const f=afterStop;afterStop=null;f&&f()};
  recPort(m).postMessage({t:'recStart',max:Math.floor(MAXS*ctx.sampleRate-mixLen)});
}
function stopRec(then){clearTimeout(idleT);if(!mixRec){then&&then();return}afterStop=then||null;recPort(recMach).postMessage({t:'recStop'})}
// you play → it records. it stops a few seconds after you stop touching the machine
let idleT=0;
function activity(tail){if(!MACH(page)||isFull())return;if(mixPlaying)mixPause();if(!mixRec)startRec();clearTimeout(idleT);idleT=setTimeout(()=>stopRec(),(tail||3)*1000)}
setInterval(()=>{if(mixRec&&page==='obp'){const l=clipLabel().replace(/ · your (sound|phone)/,'');if(usedModes[usedModes.length-1]!==l)usedModes.push(l)}},500);
// ▶ listen to what you made so far (the machine goes quiet while it plays)
let mixPlaying=false,mixLastR=0,mixT0=0;
function mixBuffer(){const all=new Float32Array(mixLen);let o=0;mixSegs.forEach(s=>{all.set(s,o);o+=s.length});return all}
function setPlayUI(){document.querySelectorAll('.key.pb').forEach(k=>k.classList.toggle('on',mixPlaying))}
function mixPlay(){stopRec(()=>{if(mixLen<ctx.sampleRate*.3){ledMsg('play the machine first — it records by itself',2000);return}
  const all=mixBuffer();discLen=all.length;discNode.port.postMessage({t:'buf',data:all});discNode.port.postMessage({t:'seek',r:0});discNode.port.postMessage({t:'k',v:.02});discNode.port.postMessage({t:'speed',v:1});
  discState={r:0};mixPlaying=true;mixLastR=0;mixT0=performance.now();setPlayUI();duck(true)})}
function mixPause(){if(!mixPlaying)return;mixPlaying=false;discNode.port.postMessage({t:'speed',v:0,snap:true});setPlayUI();duck(false)}
function duck(on){if(page==='obp'&&volG){if(on)setG(volG,0,.12);else applyVol()}if(page==='epp'&&epVol)setG(epVol,on||muted?0:ep.vol,.12)}
setInterval(()=>{if(!mixPlaying||performance.now()-mixT0<400)return;const r=discState.r||0;if(r<mixLastR-discLen/2||(r>=discLen-2048)){mixPause()}else mixLastR=r},80);
// mute while testing (recording still captures everything)
let muted=false;
function setMute(m){muted=m;document.querySelectorAll('.key.mute').forEach(k=>k.classList.toggle('muted',muted));if(page==='obp'&&volG)applyVol();if(page==='epp'&&epVol)setG(epVol,muted?0:ep.vol,.08)}
document.querySelectorAll('.key.mute').forEach(k=>k.addEventListener('click',()=>setMute(!muted)));
function save(){mixPause();stopRec(()=>{if(mixLen<ctx.sampleRate*.5){ledMsg('play the machine first — it records by itself',2000);return}finalize()})}
$('#bSave').addEventListener('click',save);$('#eSave').addEventListener('click',save);
function finalize(){show('fin');setTimeout(()=>{if(page==='fin')openCart()},2600)}
/* cart: the machines your mixtape was made with */
const XICON='<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1.5 1.5l11 11M12.5 1.5l-11 11" stroke="#1D1B20" stroke-width="1.6" stroke-linecap="round"/></svg>';
let cartQty={};
const activeMach=()=>[...new Set(mixMach)];
function renderTested(){const used=activeMach(),box=$('#tcards');box.innerHTML='';
  if(!used.length){box.innerHTML='<div class="tc empty">nothing left on your tape.</div>';return}
  used.forEach(m=>{const I=MINFO[m],d=document.createElement('div');d.className='tc';d.dataset.m=m;
    d.innerHTML=`<div class="im"><img alt="" src="${IMG[I.img]||''}"></div><button class="x" aria-label="remove">${XICON}</button><div class="nm">${I.name.replace(' – ','–')}</div>`;
    d.querySelector('.im').addEventListener('click',()=>jumpTo(m));
    d.querySelector('.x').addEventListener('click',e=>{e.stopPropagation();d.classList.add('gone');setTimeout(()=>removeMachine(m),300)});box.appendChild(d)})}
function openGet(){discNode.port.postMessage({t:'speed',v:0});show('get');const used=activeMach();used.forEach(m=>{if(!cartQty[m])cartQty[m]=1});renderGet()}
function renderGet(){const rows=$('#grows');rows.innerHTML='';let tot=0;
  activeMach().forEach(m=>{const I=MINFO[m],q=cartQty[m]||0;tot+=I.price*q;const r=document.createElement('div');r.className='gr';
    r.innerHTML=`<div class="im"><img alt="" src="${IMG[I.img]||''}"></div><div class="tx">${I.name.replace(' – ','–')}<br>${I.price} CHF${q>1?' × '+q:''}</div><div class="q"><button class="mi" aria-label="less">-</button><button class="pl" aria-label="more">+</button></div>`;
    r.querySelector('.mi').onclick=()=>{cartQty[m]=Math.max(0,q-1);renderGet()};r.querySelector('.pl').onclick=()=>{cartQty[m]=q+1;renderGet()};rows.appendChild(r)});
  $('#gtotal').textContent=tot+' CHF'}
