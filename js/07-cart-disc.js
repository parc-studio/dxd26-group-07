/* 07-cart-disc.js — "hear it." page: the spinning disc that plays your mixtape, scrub, jump to a machine, cut a machine out of the tape. */
/* ====================== cart: flat disc plays your mixtape ====================== */
let discLen=0,discDrag=null,discAng=0,discPlaying=true,mixLen0=0,seekAnim=null;
const discEl=$('#disc');
function loadDisc(keepFrac){const all=mixLen>0?mixBuffer():new Float32Array(ctx.sampleRate);discLen=all.length;
  discNode.port.postMessage({t:'buf',data:all});discNode.port.postMessage({t:'seek',r:keepFrac?Math.floor(keepFrac*discLen):0});discNode.port.postMessage({t:'k',v:.004});
  discNode.port.postMessage({t:'speed',v:discPlaying&&mixLen>0?1:0,snap:true});
  // the grey disc is as big as what's left on the tape
  const f=mixLen0?Math.max(.42,Math.sqrt(mixLen/mixLen0)):1;discEl.style.width=discEl.style.height=(f*100).toFixed(1)+'%'}
async function openCart(){show('end');mixLen0=Math.max(mixLen0,mixLen);discPlaying=true;discEl.classList.remove('paused');lastUsed='';renderTested();loadDisc(0)}
const TURN=1.8; // seconds of sound per turn, like a record
let lastUsed='';
function segAt(r){let acc=0;for(let k=0;k<mixSegs.length;k++){if(r<acc+mixSegs[k].length)return k;acc+=mixSegs[k].length}return mixSegs.length-1}
function segStart(k){let acc=0;for(let i=0;i<k;i++)acc+=mixSegs[i].length;return acc}
function renderCart(){const r=discState.r||0;discAng=(r/ctx.sampleRate)/TURN*360;discEl.style.transform=`rotate(${discAng.toFixed(2)}deg)`;
  if(!mixSegs.length)return;const m=mixMach[segAt(r)]||lastMachine;
  document.querySelectorAll('.tc').forEach(c=>c.classList.toggle('on',c.dataset.m===m));
  const label=MINFO[m].name.replace(' – ','–')+' used';if(label!==lastUsed){lastUsed=label;const el=$('#devused');el.style.opacity=0;setTimeout(()=>{el.textContent=label;el.style.opacity=1},180)}}
// tap a machine → the disc rolls (you hear it scrub) back to where that machine starts on the tape
function jumpTo(m){const k=mixMach.indexOf(m);if(k<0)return;const target=segStart(k),from=discState.r||0;clearInterval(seekAnim);
  const dist=target-from;if(Math.abs(dist)<ctx.sampleRate*.05){discPlaying=true;discEl.classList.remove('paused');discNode.port.postMessage({t:'speed',v:1});return}
  const dir=Math.sign(dist),sp=dir*Math.min(10,Math.max(3,Math.abs(dist)/ctx.sampleRate/.7));
  discNode.port.postMessage({t:'k',v:.03});discNode.port.postMessage({t:'speed',v:sp});const t0=performance.now();
  seekAnim=setInterval(()=>{const r=discState.r||0;if((dir>0?r>=target:r<=target)||performance.now()-t0>1400){clearInterval(seekAnim);
    discNode.port.postMessage({t:'seek',r:target});discNode.port.postMessage({t:'k',v:.004});discNode.port.postMessage({t:'speed',v:1});discPlaying=true;discEl.classList.remove('paused')}},16)}
// remove a machine → its parts are cut out of the tape and the disc gets smaller
function removeMachine(m){const r=discState.r||0,keep=[],keepM=[];let newR=0,acc=0;
  mixSegs.forEach((s,k)=>{if(mixMach[k]!==m){if(acc+s.length<=r)newR+=s.length;else if(acc<r)newR+=r-acc;keep.push(s);keepM.push(mixMach[k])}acc+=s.length});
  mixSegs=keep;mixMach=keepM;mixLen=keep.reduce((a,s)=>a+s.length,0);delete cartQty[m];
  renderTested();if(!mixLen){discPlaying=false;discEl.classList.add('paused');$('#devused').textContent='';}
  loadDisc(mixLen?newR/mixLen:0)}
discEl.addEventListener('pointerdown',e=>{discEl.setPointerCapture(e.pointerId);clearInterval(seekAnim);const r=discEl.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;discDrag={cx,cy,a:Math.atan2(e.clientY-cy,e.clientX-cx),t:performance.now(),x0:e.clientX,y0:e.clientY,t0:performance.now(),moved:0}});
discEl.addEventListener('pointermove',e=>{if(!discDrag)return;const a=Math.atan2(e.clientY-discDrag.cy,e.clientX-discDrag.cx);let d=a-discDrag.a;if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;const now=performance.now(),dt=Math.max(.008,(now-discDrag.t)/1000);discDrag.a=a;discDrag.t=now;discDrag.moved+=Math.abs(d);
  if(discDrag.moved<.08)return;const speed=(d/(Math.PI*2))*TURN/dt;discNode.port.postMessage({t:'k',v:.05});discNode.port.postMessage({t:'speed',v:clamp(speed,-8,8)})});
const discUp=()=>{if(!discDrag)return;const tap=discDrag.moved<.08&&performance.now()-discDrag.t0<400;discDrag=null;if(tap&&mixLen){discPlaying=!discPlaying;discEl.classList.toggle('paused',!discPlaying)}discNode.port.postMessage({t:'k',v:.004});discNode.port.postMessage({t:'speed',v:discPlaying&&mixLen?1:0})};
discEl.addEventListener('pointerup',discUp);discEl.addEventListener('pointercancel',discUp);
