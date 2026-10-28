/* 03-audio-core.js — Audio engine: TapeCore ring buffer (AudioWorklet with ScriptProcessor fallback), iOS audio unlock, master bus, sound helpers. */
/* ====================== audio core (works on http too) ====================== */
class TapeCore{
 constructor(sr,seconds,mode){this.sr=sr;this.N=Math.max(256,Math.floor(sr*(seconds||60)));this.ring=new Float32Array(this.N);this.w=0;this.r=0;this.mode=mode||'live';this.sp=1;this.tg=1;this.k=.002;this.a=0;this.b=0;this.buf=null;this.cl=0;this.clip=null;this.ci=0;this.acc=0;this.auto=false;this.post=()=>{}}
 msg(m){
  if(m.t==='mode'){this.mode=m.mode;if(m.mode==='tape'&&m.from==='live')this.r=this.w-1;if(m.speed!==undefined){this.tg=m.speed;if(m.snap)this.sp=m.speed}}
  if(m.t==='speed'){this.tg=m.v;if(m.snap)this.sp=m.v}
  if(m.t==='k')this.k=m.v;
  if(m.t==='auto')this.auto=m.v;
  if(m.t==='loop'){this.a=m.a;this.b=m.b;this.r=m.r!==undefined?m.r:m.a;this.mode='loop'}
  if(m.t==='markA')this.post({t:'mark',which:'a',w:this.w});
  if(m.t==='markB')this.post({t:'mark',which:'b',w:this.w});
  if(m.t==='save'){const n=Math.max(1,Math.floor(this.b-this.a)),o=new Float32Array(n),N=this.N;for(let i=0;i<n;i++)o[i]=this.ring[((Math.floor(this.a)+i)%N+N)%N];this.post({t:'saved',data:o},[o.buffer])}
  if(m.t==='buf'){this.buf=m.data;this.r=0;this.mode='buf'}
  if(m.t==='seek')this.r=m.r;
  if(m.t==='clip'){this.cl=m.n;this.clip=new Float32Array(m.n);this.ci=0}
  if(m.t==='recStart'){this.rec=[];this.recBlk=new Float32Array(8192);this.recI=0;this.recN=0;this.recMax=Math.max(1,m.max|0)}
  if(m.t==='recStop')this.finishRec();
 }
 finishRec(){if(!this.rec)return;const n=this.recN,o=new Float32Array(n);let off=0;for(const b of this.rec){o.set(b,off);off+=b.length}o.set(this.recBlk.subarray(0,this.recI),off);this.rec=null;this.post({t:'rec',data:o},[o.buffer])}
 rd(p){const N=this.N,i=Math.floor(p),f=p-i,a=this.ring[(i%N+N)%N],b=this.ring[((i+1)%N+N)%N];return a+(b-a)*f}
 process(inp,oL,oR,L){
  for(let k=0;k<L;k++){const x=inp?inp[k]:0;this.ring[this.w%this.N]=x;this.w++;this.sp+=(this.tg-this.sp)*this.k;let y=0;
   if(this.mode==='live'){y=x;this.r=this.w-1}
   else if(this.mode==='tape'){this.r+=this.sp;const mn=this.w-this.N+4;if(this.r>this.w-1){this.r=this.w-1;if(this.auto){this.mode='live';this.post({t:'live'})}}if(this.r<mn)this.r=mn;y=this.rd(this.r)}
   else if(this.mode==='loop'){const n=this.b-this.a;if(n>8){this.r+=this.sp;while(this.r>=this.b)this.r-=n;while(this.r<this.a)this.r+=n;y=this.rd(this.r)}}
   else if(this.mode==='buf'&&this.buf){const b=this.buf,n=b.length;this.r+=this.sp;this.r=(this.r%n+n)%n;const i=Math.floor(this.r),f=this.r-i;y=b[i]+(b[(i+1)%n]-b[i])*f}
   oL[k]=y;if(oR)oR[k]=y;
   if(this.rec){this.recBlk[this.recI++]=y;this.recN++;if(this.recI===this.recBlk.length){this.rec.push(this.recBlk);this.recBlk=new Float32Array(8192);this.recI=0}if(this.recN>=this.recMax)this.finishRec()}
   if(this.cl>0){this.clip[this.ci++]=y;if(--this.cl===0){const c=this.clip;this.clip=null;this.post({t:'clip',data:c},[c.buffer])}}}
  this.acc+=L;if(this.acc>=1024){this.acc=0;this.post({t:'pos',r:this.r,w:this.w,sp:this.sp,mode:this.mode,a:this.a,b:this.b,recN:this.rec?this.recN:-1})}
 }
}
const WORKLET=TapeCore.toString()+`
class P extends AudioWorkletProcessor{constructor(o){super();const op=o.processorOptions||{};this.c=new TapeCore(sampleRate,op.seconds,op.mode);this.c.post=(m,t)=>this.port.postMessage(m,t||[]);this.port.onmessage=e=>this.c.msg(e.data)}
process(I,O){const i=I[0]&&I[0][0];this.c.process(i,O[0][0],O[0][1],O[0][0].length);return true}}
registerProcessor('tape',P);`;
let ctx,master,masterAn,shopG,tapeNode,discNode,volG,p1F,srcBus,dryG,ambG,diskG,lineG,btG,radioG,mixG,useWorklet=false,booting=null;
function makeTape(opts,onmsg){
  if(useWorklet){const n=new AudioWorkletNode(ctx,'tape',{processorOptions:opts,numberOfInputs:1,outputChannelCount:[2]});n.port.onmessage=onmsg;return {node:n,input:n,port:n.port}}
  const sp=ctx.createScriptProcessor(1024,1,2),core=new TapeCore(ctx.sampleRate,opts.seconds,opts.mode);core.post=m=>onmsg({data:m});
  sp.onaudioprocess=e=>core.process(e.inputBuffer.getChannelData(0),e.outputBuffer.getChannelData(0),e.outputBuffer.getChannelData(1),e.inputBuffer.length);
  return {node:sp,input:sp,port:{postMessage:m=>core.msg(m)}};
}
// silent <audio> keeps iOS playing even with the ring/silent switch on
const SILENT='data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
let silentEl=null;
function setSession(type){try{if(navigator.audioSession)navigator.audioSession.type=type}catch(e){}}
function unlock(){ // must run inside a user gesture
  if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;ctx=new AC({latencyHint:'interactive'})}
  setSession('playback');
  // newer iPhones: audioSession 'playback' already ignores the silent switch, so no <audio> element
  // (an <audio> element makes iOS show the 'now playing' bubble in the Dynamic Island)
  if(!navigator.audioSession){if(!silentEl){silentEl=document.createElement('audio');silentEl.src=SILENT;silentEl.loop=true;silentEl.setAttribute('playsinline','');silentEl.volume=.01}
  silentEl.play().catch(()=>{})}
  if(ctx.state!=='running')ctx.resume().catch(()=>{});
  // tiny buffer kick (old iOS)
  try{const b=ctx.createBuffer(1,1,22050),s=ctx.createBufferSource();s.buffer=b;s.connect(ctx.destination);s.start(0)}catch(e){}
  if(!booting)booting=boot();
  return booting;
}
['pointerdown','touchend','click','keydown'].forEach(ev=>addEventListener(ev,()=>{if(ctx&&ctx.state!=='running')ctx.resume().catch(()=>{})},{passive:true}));
async function boot(){
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-10;comp.connect(ctx.destination);
  master=G(.95);master.connect(comp);masterAn=ctx.createAnalyser();masterAn.fftSize=512;master.connect(masterAn);
  shopG=G(0);shopG.connect(master);mixG=G(.95);mixG.connect(master);
  useWorklet=false;
  if(ctx.audioWorklet&&window.isSecureContext){try{await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET],{type:'application/javascript'})));useWorklet=true}catch(e){useWorklet=false}}
  tapeNode=makeTape({seconds:60},onTape);discNode=makeTape({seconds:1,mode:'buf'},e=>{if(e.data.t==='pos')discState=e.data});
  srcBus=G(1);dryG=G(1);ambG=G(0);diskG=G(0);lineG=G(0);btG=G(0);radioG=G(0);
  lineG.connect(dryG);btG.connect(dryG);radioG.connect(dryG);dryG.connect(srcBus);ambG.connect(srcBus);diskG.connect(srcBus);
  srcBus.connect(tapeNode.input);
  p1F=ctx.createBiquadFilter();p1F.type='lowshelf';p1F.frequency.value=220;p1F.gain.value=0;
  volG=G(0);tapeNode.node.connect(p1F).connect(volG).connect(master);
  const dG=G(.95);discNode.node.connect(dG).connect(master);
  // keep script processors pulled even without input
  const z=ctx.createConstantSource?ctx.createConstantSource():null;if(z){const zg=G(0);z.connect(zg);zg.connect(discNode.input);z.start()}
  discNode.port.postMessage({t:'speed',v:0,snap:true});
  buildDisk();
}
let discState={r:0};const tapeState={r:0,w:0,sp:1,mode:"live",a:0,b:0};
function G(v){const g=ctx.createGain();if(v!==undefined)g.gain.value=v;return g}
function setG(g,v,t=.04){if(!g)return;g.gain.cancelScheduledValues(ctx.currentTime);g.gain.setTargetAtTime(v,ctx.currentTime,t)}
function normalize(buf){let pk=0;for(let c=0;c<buf.numberOfChannels;c++){const d=buf.getChannelData(c);for(let i=0;i<d.length;i++)pk=Math.max(pk,Math.abs(d[i]))}if(pk>.001){const k=.9/pk;for(let c=0;c<buf.numberOfChannels;c++){const d=buf.getChannelData(c);for(let i=0;i<d.length;i++)d[i]*=k}}return buf}
function decode(ab){return new Promise((ok,no)=>{try{const p=ctx.decodeAudioData(ab,ok,no);if(p&&p.then)p.then(ok,no)}catch(e){no(e)}})}
function makeIR(sec,decay=3){const sr=ctx.sampleRate,n=Math.floor(sr*sec),b=ctx.createBuffer(2,n,sr);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,decay)}return b}
function toBuf(f32){const b=ctx.createBuffer(1,f32.length,ctx.sampleRate);b.getChannelData(0).set(f32);return b}
function OAC(ch,len,sr){const C=window.OfflineAudioContext||window.webkitOfflineAudioContext;return new C(ch,len,sr)}
function render(oc){return new Promise((ok,no)=>{oc.oncomplete=e=>ok(e.renderedBuffer);const p=oc.startRendering();if(p&&p.then)p.then(ok,no)})}
async function song({bpm=120,root=220,notes=[0,7,12,10,7,3,5,7,0,7,12,15,14,10,7,5],bass=[0,0,-5,-2],wave='triangle',bars=1,hats=true,len}={}){
  const sr=44100,beat=60/bpm,dur=len||beat*8*bars,oc=OAC(1,Math.ceil(sr*dur),sr),out=oc.createGain();out.gain.value=.8;out.connect(oc.destination);
  const steps=Math.round(dur/beat);
  for(let i=0;i<steps;i++){const t=i*beat,o=oc.createOscillator(),g=oc.createGain();o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(42,t+.25);g.gain.setValueAtTime(.85,t);g.gain.exponentialRampToValueAtTime(.001,t+.35);o.connect(g).connect(out);o.start(t);o.stop(t+.4)}
  if(hats){const nb=oc.createBuffer(1,sr*.05,sr),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
    for(let i=0;i<steps*2;i++){const t=i*beat/2+beat/4,s=oc.createBufferSource(),hp=oc.createBiquadFilter(),g=oc.createGain();s.buffer=nb;hp.type='highpass';hp.frequency.value=7000;g.gain.setValueAtTime(.22,t);g.gain.exponentialRampToValueAtTime(.001,t+.05);s.connect(hp).connect(g).connect(out);s.start(t)}}
  for(let i=0;i<steps*2;i++){const n=notes[i%notes.length];if(n===null)continue;const t=i*beat/2,o=oc.createOscillator(),g=oc.createGain();o.type=wave;o.frequency.value=root*2**(n/12);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.2,t+.005);g.gain.exponentialRampToValueAtTime(.001,t+beat*.45);o.connect(g).connect(out);o.start(t);o.stop(t+beat*.5)}
  for(let i=0;i<steps/2;i++){const n=bass[i%bass.length],t=i*beat*2,o=oc.createOscillator(),lp=oc.createBiquadFilter(),g=oc.createGain();o.type='sawtooth';o.frequency.value=root/4*2**(n/12);lp.frequency.value=420;g.gain.setValueAtTime(.16,t);g.gain.setTargetAtTime(0,t+beat*1.6,.08);o.connect(lp).connect(g).connect(out);o.start(t);o.stop(t+beat*2)}
  return render(oc);
}
async function mantra(i){
  const sr=44100,dur=8,oc=OAC(1,sr*dur,sr),out=oc.createGain();out.gain.value=.7;out.connect(oc.destination);
  const roots=[146.8,130.8,164.8,110,174.6,123.5,155.6,138.6],root=roots[i%8],sc=[[0,3,5,7,10],[0,2,4,7,9],[0,2,5,7,9],[0,3,7,10,12]][i%4];
  [0,7,12].forEach((n,k)=>{const o=oc.createOscillator(),g=oc.createGain(),l=oc.createOscillator(),lg=oc.createGain();o.frequency.value=root*2**(n/12)/2;g.gain.value=[.18,.1,.06][k];l.frequency.value=.25+k*.07;lg.gain.value=.05;l.connect(lg).connect(g.gain);o.connect(g).connect(out);o.start();l.start()});
  for(let s=0;s<8;s++){const t=s,n=sc[(s*3+i)%sc.length],o=oc.createOscillator(),g=oc.createGain();o.frequency.value=root*2**(n/12);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.18,t+.03);g.gain.exponentialRampToValueAtTime(.001,t+.95);o.connect(g).connect(out);o.start(t);o.stop(t+1)}
  return render(oc);
}
