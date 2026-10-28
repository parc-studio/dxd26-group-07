/* 08-ep133.js — EP-133 K.O. II: chops your sound over 12 pads, groove, loop, punch-in FX, fader, its own 7-segment screen, 3D scan aligned and split into buttons. */
/* ====================== EP–133 K.O. II ====================== */
// your sound chopped over the 12 pads · A B C D groups · KEYS · FX + pad = punch-in fx · FADER + pad = fader param · PLAY loops what you played
let epScene=null,epCam=null,epModel=null,epReady=false,epP=null,epMeshes=[],epComps=[],epCtl={};
const ep={group:0,keys:false,fxHeld:false,faderHeld:false,shiftHeld:false,param:'PITCH',fader:.5,vol:.8,bpm:90,groove:true,hinted:false,slices:[],srcBuf:null,voices:{},hits:[],playing:false,playT0:0,loopLen:0,keyRoot:null,fx:null};
const evw={target:0,zoom:1};
let epBus,epFxIn,epFxOut,epTape,epVol,epLP,epHP,epPan,epState={recN:-1};
function epAudio(){if(epBus)return;
  epBus=G(1);epLP=ctx.createBiquadFilter();epLP.type='lowpass';epLP.frequency.value=20000;epHP=ctx.createBiquadFilter();epHP.type='highpass';epHP.frequency.value=10;
  epPan=ctx.createStereoPanner?ctx.createStereoPanner():G(1);epFxIn=G(1);epFxOut=G(1);
  epBus.connect(epLP).connect(epHP).connect(epPan).connect(epFxIn);epFxIn.connect(epFxOut);
  epTape=makeTape({seconds:1},e=>{const m=e.data;if(m.t==='pos')epState=m;else if(m.t==='rec'&&recCb){const f=recCb;recCb=null;f(m.data)}});
  epTape.port.postMessage({t:'mode',mode:'live'});
  epFxOut.connect(epTape.input);epVol=G(0);epTape.node.connect(epVol).connect(master);
  const z=ctx.createConstantSource?ctx.createConstantSource():null;if(z){const zg=G(0);z.connect(zg);zg.connect(epTape.input);z.start()}
}
/* chop: cut your sound on its attacks, 12 slices like SAMPLE → CHOP */
function chop(buf,n){const d=buf.getChannelData(0),sr=buf.sampleRate,hop=Math.floor(sr*.01),E=[];
  for(let i=0;i+hop<d.length;i+=hop){let s=0;for(let k=0;k<hop;k++)s+=d[i+k]*d[i+k];E.push(Math.sqrt(s/hop))}
  const flux=E.map((e,i)=>Math.max(0,e-(i?Math.max(E[i-1],(E[i-2]||0)):0)));
  const minGap=Math.max(6,Math.floor(E.length/(n*3)));let cand=flux.map((f,i)=>[f,i]).filter(c=>c[0]>0).sort((a,b)=>b[0]-a[0]),on=[0];
  for(const [f,i] of cand){if(on.length>=n)break;if(on.every(o=>Math.abs(o-i)>=minGap))on.push(i)}
  while(on.length<n){on.sort((a,b)=>a-b);let gi=0,g=0;for(let k=0;k<on.length;k++){const nx=k+1<on.length?on[k+1]:E.length,gg=nx-on[k];if(gg>g){g=gg;gi=k}}on.push(on[gi]+Math.floor(g/2))}
  on.sort((a,b)=>a-b);
  return on.map((o,k)=>{const a=o*hop,b=Math.min(d.length,(k+1<on.length?on[k+1]*hop:d.length),a+sr*2.5),len=Math.max(64,b-a),out=ctx.createBuffer(1,len,sr),od=out.getChannelData(0),fi=Math.min(64,len/4),fo=Math.min(sr*.02,len/3);
    for(let i=0;i<len;i++){let g=1;if(i<fi)g=i/fi;if(i>len-fo)g=(len-i)/fo;od[i]=(d[a+i]||0)*g}return out})}
function reversed(b){const o=ctx.createBuffer(1,b.length,b.sampleRate),s=b.getChannelData(0),d=o.getChannelData(0);for(let i=0;i<s.length;i++)d[i]=s[s.length-1-i];return o}
function epPrepare(){if(ep.srcBuf===userBuf)return;ep.srcBuf=userBuf;ep.slices=chop(userBuf,12);ep.rev=ep.slices.map(reversed)}
const PARAMS=['LEVEL','PITCH','TIME','LPF','HPF','→FX','ATK','REL','PAN','TUNE','VEL','MOD'];
function faderVal(p){return p===ep.param?ep.fader:({LEVEL:.8,PITCH:.5,TIME:1,LPF:1,HPF:0,'→FX':0,ATK:0,REL:.4,PAN:.5,TUNE:.5,VEL:1,MOD:0})[p]}
function epApplyFader(){const t=ctx.currentTime;
  epLP.frequency.setTargetAtTime(80*Math.pow(250,faderVal('LPF')),t,.03);epHP.frequency.setTargetAtTime(10*Math.pow(400,faderVal('HPF')),t,.03);
  if(epPan.pan)epPan.pan.setTargetAtTime(faderVal('PAN')*2-1,t,.03);epBus.gain.setTargetAtTime(faderVal('LEVEL')*1.2,t,.03)}
function playSlice(i,when,g){g=g===undefined?ep.group:g;const t=when||ctx.currentTime;
  const slot=ep.keys?(ep.keyRoot||0):i,semi=ep.keys?[9,10,11,5,6,7,0,2,4,-1,-3,12][i]:0;
  const b=g===1?ep.rev[slot]:ep.slices[slot];if(!b)return;
  const s=ctx.createBufferSource(),env=G(0);s.buffer=b;
  const pitch=(faderVal('PITCH')-.5)*24+(faderVal('TUNE')-.5)*2+semi+(g===2?12:g===3?-12:0);s.playbackRate.value=Math.pow(2,pitch/12);
  const atk=.002+faderVal('ATK')*.4,rel=.02+faderVal('REL')*1.2,lvl=.85*(.4+.6*faderVal('VEL')),len=b.duration/s.playbackRate.value*Math.max(.15,faderVal('TIME'));
  env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(lvl,t+atk);env.gain.setValueAtTime(lvl,t+Math.max(atk,len-.01));env.gain.linearRampToValueAtTime(0,t+len+rel);
  s.connect(env).connect(epBus);s.start(t);s.stop(t+len+rel+.05);
  const key=i+'_'+g,old=ep.voices[key];if(old&&!ep.keys&&old.t<=t){try{old.env.gain.cancelScheduledValues(t);old.env.gain.setValueAtTime(old.env.gain.value,t);old.env.gain.linearRampToValueAtTime(0,t+.01);old.s.stop(t+.03)}catch(e){}}
  ep.voices[key]={s,env,t};const a=performance.now()/1000+(t-ctx.currentTime);padLit[i]={a,b:a+Math.min(.35,len+rel)}}
const padLit=[];
function padPress(i){if(!ctx)return;epAudio();epPrepare();if(ctx.state!=='running')ctx.resume();
  if(ep.fxHeld){punch(i,true);return}
  if(ep.faderHeld){ep.param=PARAMS[i];ep.fader=faderVal(ep.param);scr(PSHORT[ep.param],1400);return}
  if(ep.keys&&ep.keyRoot===null)ep.keyRoot=i;
  const at=quant(ctx.currentTime);playSlice(i,at);loopAdd(i,at);ep.hinted=true;scr('  '+String([7,8,9,4,5,6,1,2,3,0,0,0][i]).padStart(2,' '),500);if(navigator.vibrate)navigator.vibrate(8)}
const PSHORT={LEVEL:'LEuL',PITCH:'PtCH',TIME:'tInE',LPF:'LPF ',HPF:'HPF ','→FX':'SEnd',ATK:'AtC ',REL:'rEL ',PAN:'PAn ',TUNE:'tUnE',VEL:'uEL ',MOD:'nOd '};
function padRelease(i){if(ep.fxHeld||punchPad===i)punch(i,false)}
/* punch-in fx: hold FX, hold a pad */
let punchPad=null,punchNodes=[];
const FXN=['repeat 1/4','repeat 1/8','repeat 1/16','low-pass','high-pass','band-pass','echo','reverb','lo-fi','gate','tape stop','compress'];
function punch(i,on){const t=ctx.currentTime;
  punchNodes.forEach(n=>{try{n.disconnect()}catch(e){}});punchNodes=[];try{epFxIn.disconnect()}catch(e){}epFxIn.connect(epFxOut);punchPad=null;
  if(!on)return;punchPad=i;scr('F '+String(i+1).padStart(2,' '),1100);
  const beat=60/ep.bpm,wet=G(1);try{epFxIn.disconnect()}catch(e){}
  const chain=(...ns)=>{let a=epFxIn;ns.forEach(n=>{a.connect(n);a=n});a.connect(epFxOut);punchNodes.push(...ns)};
  if(i<3){const d=ctx.createDelay(2),fb=G(.97);d.delayTime.value=beat/[1,2,4][i];epFxIn.connect(d);d.connect(fb).connect(d);d.connect(epFxOut);punchNodes.push(d,fb);
    const dry=G(1);epFxIn.connect(dry).connect(epFxOut);dry.gain.setValueAtTime(1,t);dry.gain.setValueAtTime(0,t+d.delayTime.value);punchNodes.push(dry)}
  else if(i<6){const f=ctx.createBiquadFilter();f.type=['lowpass','highpass','bandpass'][i-3];f.frequency.value=[500,2200,1100][i-3];f.Q.value=[6,6,4][i-3];chain(f)}
  else if(i===6){const d=ctx.createDelay(2),fb=G(.55);d.delayTime.value=beat*.75;epFxIn.connect(d);d.connect(fb).connect(d);d.connect(epFxOut);epFxIn.connect(epFxOut);punchNodes.push(d,fb)}
  else if(i===7){const c=ctx.createConvolver();c.buffer=makeIR(2.4);const w=G(.8);epFxIn.connect(c).connect(w).connect(epFxOut);epFxIn.connect(epFxOut);punchNodes.push(c,w)}
  else if(i===8){const ws=ctx.createWaveShaper(),cv=new Float32Array(256);for(let k=0;k<256;k++){const x=k/127.5-1;cv[k]=Math.round(x*6)/6}ws.curve=cv;const f=ctx.createBiquadFilter();f.frequency.value=3000;chain(ws,f)}
  else if(i===9){const g=G(0),o=ctx.createOscillator(),og=G(.5),dc=ctx.createConstantSource?ctx.createConstantSource():null;o.type='square';o.frequency.value=ep.bpm/60*4;o.connect(og).connect(g.gain);if(dc){dc.offset.value=.5;dc.connect(g.gain);dc.start();punchNodes.push(dc)}o.start();chain(g);punchNodes.push(o,og)}
  else if(i===10){Object.values(ep.voices).forEach(v=>{try{v.s.playbackRate.setTargetAtTime(.05,t,.25)}catch(e){}});epFxIn.connect(epFxOut)}
  else{const c=ctx.createDynamicsCompressor();c.threshold.value=-35;c.ratio.value=12;const mk=G(2.2);chain(c,mk)}}
/* one clock for the groove and the loop */
const CLK={t0:0,next:0,timer:null,on:false};
const stepDur=()=>60/ep.bpm/4;
function clkStart(){if(CLK.on)return;CLK.on=true;CLK.t0=ctx.currentTime+.08;CLK.next=0;clearInterval(CLK.timer);CLK.timer=setInterval(clkTick,25)}
function clkStop(){CLK.on=false;clearInterval(CLK.timer)}
function quant(now){if(!CLK.on||!ep.groove)return now;const sd=stepDur(),n=(now-CLK.t0)/sd,f=n-Math.floor(n);return f<.25?now:CLK.t0+Math.ceil(n)*sd}
function clkTick(){if(!CLK.on||!ctx)return;const now=ctx.currentTime,sd=stepDur(),ahead=now+.12;
  while(CLK.t0+CLK.next*sd<ahead){const n=CLK.next,at=Math.max(now,CLK.t0+n*sd);
    if(ep.groove)grooveStep(n%16,at);
    if(LOOP.on){const st=n%LOOP.steps;let hit=false;LOOP.ev.forEach(ev=>{if(ev.step===st&&ev.n!==n){playSlice(ev.i,at,ev.g);hit=true}});if(hit&&page==='epp')activity(2.5)}
    CLK.next++}}
/* groove: soft and minimal, in the key of your sound, so whatever you tap sounds like music */
let grooveG=null,grooveRoot=55,noiseB=null;
function grooveInit(){if(grooveG)return;grooveG=G(.42);grooveG.connect(epTape.input);
  noiseB=ctx.createBuffer(1,ctx.sampleRate*.2,ctx.sampleRate);const d=noiseB.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  grooveRoot=rootOf(userBuf)}
function rootOf(b){try{const d=b.getChannelData(0),sr=b.sampleRate,N=4096;let best=0,bi=0;for(let i=0;i+N<d.length;i+=N){let s=0;for(let k=0;k<N;k+=4)s+=d[i+k]*d[i+k];if(s>best){best=s;bi=i}}
  let bl=0,bv=0;for(let lag=Math.floor(sr/400);lag<Math.floor(sr/60);lag++){let c=0;for(let k=0;k<N-lag;k+=2)c+=d[bi+k]*d[bi+k+lag];if(c>bv){bv=c;bl=lag}}
  let f=bl?sr/bl:110;while(f>82)f/=2;while(f<41)f*=2;return 55*Math.pow(2,Math.round(12*Math.log2(f/55))/12)}catch(e){return 55}}
function kick(t,v){const o=ctx.createOscillator(),g=G(0);o.frequency.setValueAtTime(110,t);o.frequency.exponentialRampToValueAtTime(42,t+.12);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+.32);o.connect(g).connect(grooveG);o.start(t);o.stop(t+.35)}
function hat(t,v){const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=G(0);s.buffer=noiseB;f.type='highpass';f.frequency.value=7000;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+.04);s.connect(f).connect(g).connect(grooveG);s.start(t);s.stop(t+.06)}
function rim(t,v){const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=G(0);s.buffer=noiseB;f.type='bandpass';f.frequency.value=1800;f.Q.value=2;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+.09);s.connect(f).connect(g).connect(grooveG);s.start(t);s.stop(t+.1)}
function bass(t,semi,len){const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=G(0);o.type='triangle';o.frequency.value=grooveRoot*Math.pow(2,semi/12);f.type='lowpass';f.frequency.value=380;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.32,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+len);o.connect(f).connect(g).connect(grooveG);o.start(t);o.stop(t+len+.05)}
function grooveStep(s,t){const sd=stepDur();
  if(s===0||s===7||s===10)kick(t,s===0?.75:.5);
  if(s===4||s===12)rim(t,.22);
  if(s%2===0)hat(t+(s%4===2?sd*.12:0),s%4===0?.05:.035);
  if(s===0)bass(t,0,sd*5);if(s===7)bass(t,0,sd*2.5);if(s===10)bass(t,s<16?7:5,sd*5)}
function grooveOn(on){ep.groove=on;scr(on?'Gr.On':'Gr.OF',1300)}
/* loop: PLAY turns it on (▶ on the screen) · what you tap is added and repeats · PLAY stops · ERASE clears */
const LOOP={steps:32,ev:[],on:false};
function loopStop(){LOOP.on=false}
function loopAdd(i,at){if(!LOOP.on||!CLK.on)return;const sd=stepDur(),n=Math.round((at-CLK.t0)/sd),st=((n%LOOP.steps)+LOOP.steps)%LOOP.steps;
  if(LOOP.ev.some(ev=>ev.step===st&&ev.i===i&&ev.g===ep.group))return;if(LOOP.ev.length>=48)LOOP.ev.shift();
  LOOP.ev.push({step:st,i,g:ep.group,n:n>=CLK.next?n:-1})}
function epPlay(){if(LOOP.on){LOOP.on=false;scr('StOP',900)}else{clkStart();LOOP.on=true;scr('LOOP',1300)}}
function epErase(){LOOP.ev=[];scr('CLr ',900)}
/* the machine's own screen: 7-segment digits + ● ▶ icons, drawn like the real one */
const SEG={'0':'abcdef','1':'bc','2':'abdeg','3':'abcdg','4':'bcfg','5':'acdfg','6':'acdefg','7':'abc','8':'abcdefg','9':'abcdfg','A':'abcefg','b':'cdefg','C':'adef','c':'deg','d':'bcdeg','E':'adefg','F':'aefg','G':'acdef','H':'bcefg','h':'cefg','I':'bc','J':'bcde','L':'def','n':'ceg','N':'abcef','O':'abcdef','o':'cdeg','P':'abefg','r':'eg','S':'acdfg','t':'defg','U':'bcdef','u':'cde','y':'bcdfg','-':'g',' ':''};
let scrText='',scrUntil=0,scrCanvas=null,scrTex=null,scrKey='';
function scr(t,ms){scrText=t;scrUntil=performance.now()+(ms||1000)}
function scrDefault(){if(!ep.hinted)return ((performance.now()/700|0)%2)?'tAP ':'PAdS';return (ep.bpm>=100?String(ep.bpm):String(ep.bpm).padStart(3,' '))+'.0'}
function drawScreen(){if(!scrTex)return;const now=performance.now(),txt=now<scrUntil?scrText:scrDefault(),rec=mixRec,pl=LOOP.on,key=txt+rec+pl+((now/500|0)%2&&pl);if(key===scrKey)return;scrKey=key;
  const c=scrCanvas.getContext('2d'),W=scrCanvas.width,H=scrCanvas.height;c.fillStyle='#050505';c.fillRect(0,0,W,H);
  // parse into 4 digits with decimal points
  const cells=[];for(const ch of txt){if(ch==='.'&&cells.length){cells[cells.length-1].dp=true;continue}cells.push({ch,dp:false})}while(cells.length<4)cells.unshift({ch:' ',dp:false});
  const dw=W*.2,dh=H*.56,x0=W*.1,y0=H*.06,th=dw*.16;
  cells.slice(0,4).forEach((cl,k)=>{const x=x0+k*(dw*1.12),on=SEG[cl.ch]||'';
    const S={a:[x+th,y0,dw-2*th,th],d:[x+th,y0+dh-th,dw-2*th,th],g:[x+th,y0+dh/2-th/2,dw-2*th,th],f:[x,y0+th*.6,th,dh/2-th*.7],b:[x+dw-th,y0+th*.6,th,dh/2-th*.7],e:[x,y0+dh/2+th*.1,th,dh/2-th*.7],c:[x+dw-th,y0+dh/2+th*.1,th,dh/2-th*.7]};
    for(const sg in S){c.fillStyle=on.includes(sg)?'#f4f6f8':'#151515';const [a,b,w,h]=S[sg];c.fillRect(a+(sg==='a'||sg==='g'||sg==='d'?0:0),b,w,h)}
    c.fillStyle=cl.dp?'#f4f6f8':'#151515';c.fillRect(x+dw+dw*.02,y0+dh-th,th,th)});
  // ● record · ▶ play
  const iy=H*.82,ir=H*.08;c.fillStyle=rec?'#ff2d2d':'#1a1a1a';c.beginPath();c.arc(W*.16,iy,ir,0,7);c.fill();
  c.fillStyle=pl&&((now/500|0)%2===0||true)?'#f4f6f8':'#1a1a1a';c.beginPath();c.moveTo(W*.26,iy-ir);c.lineTo(W*.26,iy+ir);c.lineTo(W*.26+ir*1.6,iy);c.fill();
  scrTex.needsUpdate=true}
/* ---------- 3D ---------- */
const RAW={pads:[[-18.1,94.8],[5.7,93.8],[29.3,92.8],[-19.6,71.3],[4.2,70.3],[27.9,69.4],[-21.1,47.6],[2.8,46.7],[26.4,45.7],[-22.5,24.1],[1.3,23.2],[24.9,22.2]],
  groups:[[-41.9,95.8],[-43.4,72.3],[-44.8,48.6],[-46.2,25.1]],
  btn:{sample:[53.2,92],timing:[77,91],fx:[51.7,68.5],erase:[75.6,67.5],minus:[50.3,44.5],plus:[74.2,43.5],record:[48.6,21.2],play:[72.5,20.3],keys:[-65.1,100.5],fader:[-66,84.8],shift:[-70,22],sound:[-40.3,119.2],main:[-16.6,118.3],tempo:[7.3,117.3]},
  knobs:{volume:[-64.5,121.2],x:[54.4,116.4],y:[78,115.4]},slider:[-68.9,54.6]};
function rawZ(x,y){return -19.75+(x+18.1)*.1213-(y-94.8)*.1726} // the face plane of the scan
let epU,epV,epN,epMat,rawParts;
function initEP(){return epP||(epP=(async()=>{getRenderer();
  epScene=new THREE.Scene();epScene.environment=scene0Env();
  epCam=new THREE.PerspectiveCamera(30,1,1,5000);
  const key=new THREE.DirectionalLight(0xffffff,1.1);key.position.set(-80,420,160);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-170,right:170,top:170,bottom:-170,near:10,far:900});key.shadow.radius=8;key.shadow.bias=-.0003;epScene.add(key);
  const box=new THREE.RectAreaLight(0xffffff,2.6,300,200);box.position.set(-60,320,260);box.lookAt(0,0,0);epScene.add(box);
  const box2=new THREE.RectAreaLight(0xffffff,1.2,220,260);box2.position.set(260,160,-60);box2.lookAt(0,0,0);epScene.add(box2);
  epScene.add(new THREE.HemisphereLight(0xffffff,0xd6d6d2,.45));
  const g=await new GLTFLoader().loadAsync(EP);const raw=g.scene;raw.updateMatrixWorld(true);
  // align the scan: face up, pads in rows
  const P7=new THREE.Vector3(-18.1,94.8,rawZ(-18.1,94.8)),P9=new THREE.Vector3(29.3,92.8,rawZ(29.3,92.8)),PD=new THREE.Vector3(-22.5,24.1,rawZ(-22.5,24.1));
  epU=P9.clone().sub(P7).normalize();epV=P7.clone().sub(PD);epV.addScaledVector(epU,-epV.dot(epU)).normalize();epN=new THREE.Vector3().crossVectors(epU,epV).normalize();
  const B=new THREE.Matrix4().makeBasis(epU,epV,epN).transpose(),R=new THREE.Matrix4().makeBasis(new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,-1),new THREE.Vector3(0,1,0));
  epMat=R.multiply(B);
  const inner=new THREE.Group();inner.add(raw);rawParts=new THREE.Group();inner.add(rawParts);
  // split the button meshes into single buttons so each one can move
  raw.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;const m=o.material;if(m){m.envMapIntensity=.9;if(m.map)m.map.anisotropy=8}epMeshes.push(o)});
  const splitNames=['ButtonsG2','Knobs','SlideStick','TopRowButtons'];
  [...epMeshes].forEach(o=>{if(!splitNames.includes(o.parent&&o.parent.name))return;splitMesh(o)});
  epModel=new THREE.Group();epModel.add(inner);inner.matrixAutoUpdate=false;inner.matrix.copy(epMat);epScene.add(epModel);epModel.updateMatrixWorld(true);
  const bb=new THREE.Box3().setFromObject(epModel);epModel.position.set(-(bb.min.x+bb.max.x)/2,-bb.min.y,-(bb.min.z+bb.max.z)/2);epModel.updateMatrixWorld(true);
  const sp=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200),new THREE.ShadowMaterial({opacity:.12}));sp.rotation.x=-Math.PI/2;sp.position.y=0;sp.receiveShadow=true;epScene.add(sp);
  buildCtl();buildScreen();epReady=true})())}
function scene0Env(){if(!scene0Env.e){const pm=new THREE.PMREMGenerator(renderer);scene0Env.e=pm.fromScene(new RoomEnvironment(),.02).texture}return scene0Env.e}
function splitMesh(o){const g=o.geometry,p=g.attributes.position,idx=g.index?g.index.array:null;if(!idx)return;
  const key=i=>Math.round(p.getX(i)*200)+','+Math.round(p.getY(i)*200)+','+Math.round(p.getZ(i)*200),map=new Map(),rep=new Int32Array(p.count);for(let i=0;i<p.count;i++){const k=key(i);if(!map.has(k))map.set(k,i);rep[i]=map.get(k)}
  const par=new Int32Array(p.count).map((_,i)=>i),f=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x]}return x};
  for(let t=0;t<idx.length;t+=3){const a=f(rep[idx[t]]),b=f(rep[idx[t+1]]),c=f(rep[idx[t+2]]);par[b]=a;par[f(c)]=a}
  const groups=new Map();for(let t=0;t<idx.length;t+=3){const r=f(rep[idx[t]]);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(idx[t],idx[t+1],idx[t+2])}
  const parent=o.parent;o.updateMatrixWorld(true);
  groups.forEach(tris=>{const used=new Map(),attrs={};const names=Object.keys(g.attributes);names.forEach(n=>attrs[n]=[]);const ni=[];
    tris.forEach(v=>{if(!used.has(v)){used.set(v,used.size);names.forEach(n=>{const a=g.attributes[n];for(let c=0;c<a.itemSize;c++)attrs[n].push(a.array[v*a.itemSize+c])})}ni.push(used.get(v))});
    const ng=new THREE.BufferGeometry();names.forEach(n=>ng.setAttribute(n,new THREE.BufferAttribute(new Float32Array(attrs[n]),g.attributes[n].itemSize)));ng.setIndex(ni);ng.applyMatrix4(o.matrixWorld);ng.computeBoundingBox();
    const piv=new THREE.Object3D(),c=new THREE.Vector3();ng.boundingBox.getCenter(c);piv.position.copy(c);ng.translate(-c.x,-c.y,-c.z);
    const m=new THREE.Mesh(ng,o.material);m.castShadow=true;m.receiveShadow=true;piv.add(m);piv.userData.c=c.clone();piv.userData.size=ng.boundingBox.getSize(new THREE.Vector3());
    rawParts.add(piv);epComps.push(piv);epMeshes.push(m)});
  parent.remove(o);epMeshes.splice(epMeshes.indexOf(o),1)}
function surfaceAt(x,y){const o=new THREE.Vector3(x,y,rawZ(x,y)).addScaledVector(epN,40),wo=o.clone().applyMatrix4(rawParts.matrixWorld),wd=epN.clone().negate().transformDirection(rawParts.matrixWorld);
  const rc=new THREE.Raycaster(wo,wd,0,200),h=rc.intersectObjects(epMeshes,false)[0];if(!h)return new THREE.Vector3(x,y,rawZ(x,y)+.2);return h.point.clone().applyMatrix4(rawParts.matrixWorld.clone().invert())}
function onFace(obj,x,y,lift){const p=surfaceAt(x,y).addScaledVector(epN,lift||.15);obj.position.copy(p);obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(epU,epV,epN));rawParts.add(obj)}
let padLeds=[],playLed=null;
function buildScreen(){epModel.updateMatrixWorld(true);
  scrCanvas=document.createElement('canvas');scrCanvas.width=512;scrCanvas.height=396;scrTex=new THREE.CanvasTexture(scrCanvas);scrTex.colorSpace=THREE.SRGBColorSpace;scrTex.anisotropy=8;
  const pl=new THREE.Mesh(new THREE.PlaneGeometry(31,24),new THREE.MeshBasicMaterial({map:scrTex,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));pl.renderOrder=10;pl.castShadow=false;pl.receiveShadow=false;onFace(pl,2.15,162.5,.6);
  // the little leds above each pad light while it sounds
}
function compsNear(x,y,r){return epComps.filter(c=>Math.hypot(c.userData.c.x-x,c.userData.c.y-y)<r)}
function buildCtl(){const mk=(name,xy,kind,r)=>{const parts=compsNear(xy[0],xy[1],r||6.5);epCtl[name]={xy,kind,parts,base:parts.map(p=>p.position.clone())}};
  RAW.pads.forEach((xy,i)=>mk('pad'+i,xy,'pad'));RAW.groups.forEach((xy,i)=>mk('grp'+i,xy,'btn'));
  Object.entries(RAW.btn).forEach(([k,xy])=>mk(k,xy,'btn',k.length<6&&k!=='play'&&k!=='fx'?6.5:7));
  mk('slider',RAW.slider,'slider',6);epCtl.slider.y0=RAW.slider[1]}
function ctlRaw(name){const c=epCtl[name];return new THREE.Vector3(c.xy[0],c.xy[1],rawZ(c.xy[0],c.xy[1])+3)}
function epProject(v){const p=v.clone().applyMatrix4(epMat);epModel.localToWorld(p);p.project(epCam);const r=$('#stage3').getBoundingClientRect();return [r.left+(p.x*.5+.5)*r.width,r.top+(-p.y*.5+.5)*r.height]}
function ctlScreen(name){if(name==='slider'){const c=epCtl.slider,y=RAW.slider[1]+(ep.fader-.5)*44;return epProject(new THREE.Vector3(c.xy[0],y,rawZ(c.xy[0],y)+3))}return epProject(ctlRaw(name))}
// pressed: sinks (seen from the front) + darker and a touch smaller (seen from the top), like a real key going down
function setPressed(name,on){const c=epCtl[name];if(!c)return;
  if(!c.mats){c.mats=[];c.parts.forEach(p=>p.traverse(o=>{if(o.isMesh){o.material=o.material.clone();c.mats.push(o.material)}}));c.cols=c.mats.map(m=>m.color.clone())}
  c.parts.forEach((p,k)=>{p.position.copy(c.base[k]).addScaledVector(epN,on?-1.1:0);p.scale.setScalar(on?.95:1)});
  c.mats.forEach((m,k)=>m.color.copy(c.cols[k]).multiplyScalar(on?.74:1));c.down=on}

/* views: 0 front · 1 top · 2 pads + right column · 3 left column + fader + volume */
function epKey(tgt,dir,up,w,h,fov){return {tgt,dir:dir.normalize(),up:up.normalize(),w,h,fov}}
let EPKEYS=null;
function epKeys(){const wp=(x,y)=>{const v=new THREE.Vector3(x,y,rawZ(x,y)).applyMatrix4(epMat);return epModel.localToWorld(v)};
  const bb=new THREE.Box3().setFromObject(epModel),c=bb.getCenter(new THREE.Vector3());c.y=bb.max.y;const pads=wp(30,60),left=wp(-52,72);
  EPKEYS=[epKey(new THREE.Vector3(c.x,c.y*.4,c.z+10),new THREE.Vector3(0,.8,1),new THREE.Vector3(0,1,0),196,270,30),
    epKey(c.clone(),new THREE.Vector3(0,1,.06),new THREE.Vector3(0,0,-1),196,270,18),
    epKey(pads.clone(),new THREE.Vector3(0,1,.08),new THREE.Vector3(0,0,-1),136,100,20),
    epKey(left.clone(),new THREE.Vector3(0,1,.08),new THREE.Vector3(0,0,-1),84,128,20)]}
let eFrom,eTo,eU=1;
function epGoView(i){i=clamp(i,0,1);if(i===evw.target&&eU>=1)return;eFrom=lerpKey(eFrom,eTo,smooth(eU));eTo=EPKEYS[i];eU=0;evw.target=i;if(navigator.vibrate)navigator.vibrate(6)}
function epApplyCam(K,yawDeg){const vf=K.fov*Math.PI/180,hf=2*Math.atan(Math.tan(vf/2)*epCam.aspect),dist=Math.max(K.w/2/Math.tan(hf/2),K.h/2/Math.tan(vf/2))*1.06;
  epCam.fov=K.fov;epCam.updateProjectionMatrix();const d=K.dir.clone(),u=K.up.clone();if(Math.abs(yawDeg)>.01)d.applyAxisAngle(u,yawDeg*Math.PI/180);
  epCam.position.copy(K.tgt).addScaledVector(d,dist);epCam.up.copy(u);epCam.lookAt(K.tgt);epCam.updateMatrixWorld()}
async function openEP(){askTilt();await unlock();epAudio();epPrepare();grooveInit();show('epp');clkStart();app.classList.remove('zoomed');evw.zoom=1;
  setG(epVol,muted?0:ep.vol,.05);
  try{await initEP()}catch(err){ledMsg('3D error');console.error(err);return}
  if(!EPKEYS)epKeys();const st=sensorLive()&&view.sensorFront===false?1:0;eFrom=eTo=EPKEYS[st];app.classList.remove('zoomed');eU=1;evw.target=st;
  const s3=$('#stage3');if(renderer.domElement.parentNode!==s3)s3.appendChild(renderer.domElement)}
let epKnobAng={volume:0,x:0,y:0};
function renderEP(dt){eU=Math.min(1,eU+dt/.75);const K=lerpKey(eFrom,eTo,smooth(eU));
  const gy=sensorLive()?clamp(view.gamma*.4,-14,14):0;sizeRenderer($('#stage3'),epCam);epApplyCam(K,gy);
  // knobs + fader follow their values
  [['volume',ep.vol*270-135],['x',(ep.bpm-120)*2],['y',epKnobAng.y]].forEach(([k,a])=>{const c=epCtl['knob_'+k];if(!c)return;c.parts.forEach(p=>p.quaternion.setFromAxisAngle(epN,-a*Math.PI/180))});
  const sl=epCtl.slider;if(sl)sl.parts.forEach((p,k)=>p.position.copy(sl.base[k]).addScaledVector(epV,(ep.fader-.5)*44));
  drawScreen();renderer.render(epScene,epCam)}
/* fingers */
const s3=$('#stage3'),eptrs=new Map();let eLastTap=0,eLastXY=[0,0];
function epPick(e){if(eU<.6)return null;let best=null,bd=1e9;const r=s3.getBoundingClientRect();
  for(const k of Object.keys(epCtl)){const [x,y]=ctlScreen(k);if(x<r.left||x>r.right||y<r.top||y>r.bottom)continue;const d=Math.hypot(e.clientX-x,e.clientY-y);
    const [x2]=epProject(ctlRaw(k).add(epU.clone().multiplyScalar(8))),rad=Math.max(26,Math.abs(x2-x)*1.05);if(d<rad&&d<bd){bd=d;best=k}}
  return best}
function epSection(e){const [x]=epProject(new THREE.Vector3(-33,60,rawZ(-33,60)));return e.clientX>x?2:3}
s3.addEventListener('pointerdown',e=>{if(!epReady)return;ctx&&ctx.resume();try{s3.setPointerCapture(e.pointerId)}catch(_){}
  const c=epPick(e),st={ctrl:c,x0:e.clientX,y0:e.clientY,t:performance.now()};
  if(c){setPressed(c,true);activity(3);const kind=epCtl[c].kind;
    if(kind==='pad')padPress(+c.slice(3));
    else if(c.startsWith('grp')){ep.group=+c.slice(3);ep.keys=false;scr('GrP.'+'AbCd'[ep.group],1100)}
    else if(c==='fx')ep.fxHeld=true;else if(c==='fader')ep.faderHeld=true;else if(c==='shift')ep.shiftHeld=true;
    else if(c==='keys'){ep.keys=!ep.keys;ep.keyRoot=null;scr(ep.keys?'HEyS':' OFF',1100)}
    else if(c==='minus'||c==='plus'){ep.bpm=clamp(ep.bpm+(c==='plus'?5:-5),60,160);scr(String(ep.bpm).padStart(3,' ')+'.0',900)}
    else if(c==='play')epPlay();else if(c==='erase')epErase();
    else if(c==='record')recToggle();
    else if(kind==='knob'){const [cx,cy]=ctlScreen(c);st.cx=cx;st.cy=cy;st.a=Math.atan2(e.clientY-cy,e.clientX-cx)}
    else if(c==='slider'){st.f0=ep.fader;const [,y1]=epProject(new THREE.Vector3(RAW.slider[0],RAW.slider[1]+22,rawZ(RAW.slider[0],RAW.slider[1]+22))),[,y0]=epProject(new THREE.Vector3(RAW.slider[0],RAW.slider[1]-22,rawZ(RAW.slider[0],RAW.slider[1]-22)));st.span=y0-y1}
    else if(c==='tempo')grooveOn(!ep.groove);
    if(ep.keys&&kind==='pad'&&ep.keyRoot===null)ep.keyRoot=+c.slice(3)}
  eptrs.set(e.pointerId,st);e.preventDefault()});
s3.addEventListener('pointermove',e=>{const st=eptrs.get(e.pointerId);if(!st||!st.ctrl)return;const kind=epCtl[st.ctrl].kind;
  if(kind==='knob'){const a=Math.atan2(e.clientY-st.cy,e.clientX-st.cx);let d=(a-st.a)*180/Math.PI;if(d>180)d-=360;if(d<-180)d+=360;st.a=a;
    if(st.ctrl==='knob_volume'){ep.vol=clamp(ep.vol+d/270,0,1);setG(epVol,ep.vol,.03)}else if(st.ctrl==='knob_x'){ep.bpm=clamp(Math.round(ep.bpm+d/3),60,200);ledMsg(ep.bpm+' bpm',600)}else epKnobAng.y+=d}
  else if(st.ctrl==='slider'){ep.fader=clamp(st.f0+(st.y0-e.clientY)/Math.max(40,st.span),0,1);epApplyFader()}});
function epUp(e){const st=eptrs.get(e.pointerId);if(!st)return;eptrs.delete(e.pointerId);const c=st.ctrl;
  if(c){setPressed(c,false);const kind=epCtl[c].kind;if(kind==='pad')padRelease(+c.slice(3));
    if(c==='fx'){ep.fxHeld=false;if(punchPad!==null)punch(punchPad,false)}if(c==='fader')ep.faderHeld=false;if(c==='shift')ep.shiftHeld=false;return}
  const moved=Math.hypot(e.clientX-st.x0,e.clientY-st.y0),now=performance.now();
  if(moved<10&&now-st.t<450){if(!sensorLive())epGoView(evw.target===0?1:0)}
  else if(!sensorLive()&&Math.abs(e.clientY-st.y0)>50)epGoView(e.clientY<st.y0?1:0)}
s3.addEventListener('pointerup',epUp);s3.addEventListener('pointercancel',epUp);
addEventListener('wheel',e=>{if(page!=='epp'||sensorLive())return;const now=performance.now();if(now-(epGoView.w||0)<450||Math.abs(e.deltaY)<12)return;epGoView.w=now;epGoView(e.deltaY>0?1:0)},{passive:true});
