/* 04-ob4-logic.js — OB-4 behaviour, modelled on the real magic radio: sources (line / bt / radio / disk), tape modes, disk functions, radio stations, buttons & knobs. */
/* ====================== tape messages ====================== */
let pendingA=null,clipCb=null,savedCb=null;
function onTape(e){const m=e.data;
  if(m.t==='pos'){Object.assign(tapeState,m)}
  else if(m.t==='live'){ob.tape='live'}
  else if(m.t==='mark'){if(m.which==='a')pendingA=m.w;else loopFromMarks(pendingA,m.w)}
  else if(m.t==='clip'&&clipCb){clipCb(m.data);clipCb=null}
  else if(m.t==='rec'&&recCb){const f=recCb;recCb=null;f(m.data)}
  else if(m.t==='saved'&&savedCb){savedCb(m.data);savedCb=null}
}
const T=(m,tr)=>tapeNode&&tapeNode.port.postMessage(m,tr||[]);

/* ====================== state ====================== */
let userBuf=null,btBuf=null,stations=[],lineSrc=null,btSrc=null;
const STA=[{f:94.6,name:'ECAL'},{f:99.9,name:'DXD 99'}]; // two real-sounding english stations (assets/audio)
const SRC=['line','bt','radio','disk'], FN=['ambient','karma','metronome','noise','loop'];
const ob={on:false,vol:-135,src:0,fn:0,inputHeld:false,playHeld:false,tape:'live',transport:1,freq:94.6,bpm:120,metro:0,p808:0,d808:.5,noise:1,strength:.6,waveT:6,quickAmb:false,ambSrc:0,mix:.75,tone:.5,mantra:0,saved:[],savedIdx:-1,beat:true,loop:null,p1:false,linePlay:true,btPlay:true,battery:87};
navigator.getBattery&&navigator.getBattery().then(b=>ob.battery=Math.round(b.level*100)).catch(()=>{});
let msgText='',msgUntil=0;function msg(t,ms=1400){msgText=t;msgUntil=performance.now()+ms}

/* ====================== disk engines ====================== */
let ambFilt,ambVerb,karmaG,metG,noiseG,noiseWave,savedG,karmaSrc=null,noiseSrc=null,savedSrc=null,noiseBufs=[],staticG,stG=[],radioOut;
function buildDisk(){
  // ambient
  ambFilt=ctx.createBiquadFilter();ambFilt.type='lowpass';ambFilt.frequency.value=2200;ambFilt.Q.value=.7;
  ambVerb=ctx.createConvolver();ambVerb.buffer=makeIR(6,2.2);const aw=G(1),ad=G(.25);
  ambFilt.connect(ambVerb).connect(aw).connect(ambG);ambFilt.connect(ad).connect(ambG);
  // disk functions
  karmaG=G(0);metG=G(0);noiseG=G(0);savedG=G(0);noiseWave=G(1);
  karmaG.connect(diskG);metG.connect(diskG);noiseWave.connect(noiseG).connect(diskG);savedG.connect(diskG);
  // noise buffers: white, pink, brown
  const n=ctx.sampleRate*4;['white','pink','brown'].forEach((k,i)=>{const b=ctx.createBuffer(1,n,ctx.sampleRate),d=b.getChannelData(0);let b0=0,b1=0,b2=0,last=0;
    for(let j=0;j<n;j++){const w=Math.random()*2-1;if(i===0)d[j]=w*.5;else if(i===1){b0=.997*b0+w*.029591;b1=.985*b1+w*.032534;b2=.95*b2+w*.048056;d[j]=(b0+b1+b2+w*.1848)*.5}else{last=(last+.02*w)/1.02;d[j]=last*3.2}}noiseBufs.push(b)});
  // radio
  radioOut=ctx.createGain();const hp=ctx.createBiquadFilter(),lp=ctx.createBiquadFilter(),sh=ctx.createWaveShaper();hp.type='highpass';hp.frequency.value=180;lp.type='lowpass';lp.frequency.value=7500;
  const curve=new Float32Array(256);for(let i=0;i<256;i++){const x=i/128-1;curve[i]=Math.tanh(x*1.1)/Math.tanh(1.1)}sh.curve=curve;radioOut.connect(hp).connect(lp).connect(sh).connect(radioG);
  const st=ctx.createBufferSource();st.buffer=noiseBufs[0];st.loop=true;const sbp=ctx.createBiquadFilter();sbp.type='bandpass';sbp.frequency.value=2400;sbp.Q.value=.4;staticG=G(0);st.connect(sbp).connect(staticG).connect(radioG);st.start();
  setInterval(ambientTick,140);setInterval(metroTick,25);
}
let stP=null;function ensureStations(){return stP||(stP=buildStations())}
async function buildStations(){ // ECAL Radio 94.6 (news) · DXD 99.9 (electronic), looped like a live broadcast
  for(let i=0;i<RADIO.length;i++){let b;try{b=await ctx.decodeAudioData(await (await fetch(RADIO[i])).arrayBuffer())}catch(e){b=await song({bpm:120,root:220,notes:[0,7,12,7],wave:'sine'})}
    stations.push(b);const g=G(0);g.connect(radioOut);stG.push(g);stSrc.push(null)}
  updateRadio()}
let stSrc=[],stOn=null,radioWas=false;
function restartStation(i){if(!stations[i])return;try{stSrc[i]&&stSrc[i].stop()}catch(e){}const s=ctx.createBufferSource();s.buffer=stations[i];s.loop=true;s.connect(stG[i]);s.start();stSrc[i]=s}
function updateRadio(){if(!stG.length)return;const n=nearStation();if(n!==stOn){stOn=n;if(n!==null)restartStation(n)}let mx=0;STA.forEach((s,i)=>{const d=Math.abs(ob.freq-s.f),v=clamp(1-d/.35,0,1);mx=Math.max(mx,v);stG[i].gain.setTargetAtTime(Math.pow(v,1.5),ctx.currentTime,.03)});staticG.gain.setTargetAtTime(clamp(1-mx*1.15,0,1)*.35+.02,ctx.currentTime,.03)}
function nearStation(){let best=null;STA.forEach((s,i)=>{if(Math.abs(ob.freq-s.f)<.15)best=i});return best}
function ambBuffer(){const s=ob.src===3?ob.ambSrc:ob.src;if(s===1&&btBuf)return btBuf;if(s===2){const n=nearStation();if(n!==null&&stations[n])return stations[n];return noiseBufs[1]}return userBuf}
function ambientTick(){if(!ctx||!ob.on||!ambientActive())return;const b=ambBuffer();if(!b)return;
  const now=ctx.currentTime,s=ctx.createBufferSource(),g=G(0),dur=1.4+Math.random()*1.8,rates=[.5,.5,.75,1,.25];
  s.buffer=b;s.playbackRate.value=rates[Math.floor(Math.random()*rates.length)]*(0.75+ob.tone*.5);
  g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(.22,now+dur/2);g.gain.linearRampToValueAtTime(0,now+dur);
  s.connect(g).connect(ambFilt);s.start(now,Math.random()*Math.max(.01,b.duration-dur),dur);
  ambFilt.frequency.setTargetAtTime(400+ob.tone*5200,now,.2);
}
function ambientActive(){return (ob.src===3&&ob.fn===0)||ob.quickAmb}
// metronome
let mNext=0,mBeat=0;const MSETS=['CLICK','WOOD','808','BELL'];
function metroTick(){if(!ctx||!ob.on||!(ob.src===3&&ob.fn===2))return;const now=ctx.currentTime;if(mNext<now)mNext=now+.05;
  while(mNext<now+.12){metroHit(mNext,mBeat%4===0);mNext+=60/ob.bpm;mBeat++}}
function metroHit(t,acc){const set=MSETS[ob.metro];const g=G(0);g.connect(metG);
  if(set==='808'){const o=ctx.createOscillator();o.frequency.setValueAtTime(90*2**(ob.p808/12)*(acc?1.2:1),t);o.frequency.exponentialRampToValueAtTime(40,t+.15+ob.d808*.4);g.gain.setValueAtTime(.9,t);g.gain.exponentialRampToValueAtTime(.001,t+.2+ob.d808*.9);o.connect(g);o.start(t);o.stop(t+1.2)}
  else if(set==='BELL'){[1,2.76,5.4].forEach((m,k)=>{const o=ctx.createOscillator();o.frequency.value=(acc?880:660)*m;const gg=G(0);gg.gain.setValueAtTime(.25/(k+1),t);gg.gain.exponentialRampToValueAtTime(.001,t+.6);o.connect(gg).connect(g);o.start(t);o.stop(t+.7)});g.gain.value=1}
  else{const s=ctx.createBufferSource();s.buffer=noiseBufs[0];const f=ctx.createBiquadFilter();f.type=set==='WOOD'?'bandpass':'highpass';f.frequency.value=set==='WOOD'?(acc?2200:1700):(acc?5000:3500);f.Q.value=set==='WOOD'?8:1;g.gain.setValueAtTime(set==='WOOD'?2.2:.9,t);g.gain.exponentialRampToValueAtTime(.001,t+(set==='WOOD'?.08:.03));s.connect(f).connect(g);s.start(t,Math.random(),.1)}
}
async function setKarma(){const b=await mantra(ob.mantra);if(karmaSrc)try{karmaSrc.stop()}catch(e){}karmaSrc=ctx.createBufferSource();karmaSrc.buffer=b;karmaSrc.loop=true;karmaSrc.connect(karmaG);karmaSrc.start()}
function setNoise(){if(noiseSrc)try{noiseSrc.stop()}catch(e){}noiseSrc=ctx.createBufferSource();noiseSrc.buffer=noiseBufs[ob.noise];noiseSrc.loop=true;noiseSrc.connect(noiseWave);noiseSrc.start()}
function setSaved(){if(savedSrc)try{savedSrc.stop()}catch(e){}savedSrc=null;if(ob.savedIdx<0||!ob.saved[ob.savedIdx])return;savedSrc=ctx.createBufferSource();savedSrc.buffer=ob.saved[ob.savedIdx];savedSrc.loop=true;savedSrc.connect(savedG);savedSrc.start()}

/* ====================== sources / routing ====================== */
function startLine(){if(lineSrc)try{lineSrc.stop()}catch(e){}if(!userBuf)return;lineSrc=ctx.createBufferSource();lineSrc.buffer=userBuf;lineSrc.loop=true;lineSrc.connect(lineG);lineSrc.start()}
function startBt(){if(btSrc)try{btSrc.stop()}catch(e){}if(!btBuf)return;btSrc=ctx.createBufferSource();btSrc.buffer=btBuf;btSrc.loop=true;btSrc.connect(btG);btSrc.start()}
function route(){if(!ctx)return;const on=ob.on,s=ob.src,amb=ambientActive();
  setG(lineG,on&&s===0&&ob.linePlay?1:0);setG(btG,on&&s===1&&btBuf&&ob.btPlay?1:0);setG(radioG,on&&s===2?1:0);setG(diskG,on&&s===3?1:0);
  setG(karmaG,s===3&&ob.fn===1?1:0);setG(metG,s===3&&ob.fn===2?1:0);setG(noiseG,s===3&&ob.fn===3?.6:0);setG(savedG,s===3&&ob.fn===4?1:0);
  setG(dryG,amb&&s!==3?1-ob.mix:1);setG(ambG,amb?(s===3?1:ob.mix):0,.3);
  if(s===2&&on&&!radioWas){stOn=null}radioWas=s===2&&on;
  if(s===2)ensureStations().then(updateRadio);
  if(s===3&&ob.fn===1&&!karmaSrc)setKarma();if(s===3&&ob.fn===3&&!noiseSrc)setNoise();
  p1F.gain.setTargetAtTime(ob.p1?-14:0,ctx.currentTime,.05);
  applyVol();
}
function applyVol(){if(!ctx)return;const u=(ob.vol+135)/270;setG(volG,ob.on&&!(typeof muted!=='undefined'&&muted)?u*u*1.1:0,.03)}

/* ====================== status text ====================== */
function fmtT(s){s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function sp(v){return (v>=0?'+':'')+v.toFixed(1)+'x'}
function status(){
  const now=performance.now();if(now<msgUntil)return msgText;
  if(!ob.on)return '';
  if(view.tUp>.6)return 'BAT '+ob.battery+'%';
  if(ob.loop)return 'LOOP '+(ob.loop.len/ctx.sampleRate).toFixed(1)+'S';
  if(ob.tape==='scrub'){const b=(tapeState.w-tapeState.r)/ctx.sampleRate;return (tapeState.sp<-.05?'<':tapeState.sp>.05?'>':'*')+'-'+fmtT(b)}
  if(ob.tape==='transport')return sp(ob.transport);
  if(ob.quickAmb&&ob.src!==3)return 'AMBIENT';
  if(ob.src===0)return ob.linePlay?'LINE':'PAUSE';
  if(ob.src===1)return !btBuf?((now/500|0)%2?'PAIR':''):ob.btPlay?'BT':'PAUSE';
  if(ob.src===2){const n=nearStation();return n!==null&&(now/1600|0)%2?STA[n].name:ob.freq.toFixed(1)}
  const f=FN[ob.fn];
  if(f==='ambient')return 'AMBIENT';if(f==='karma')return 'KARMA '+String(ob.mantra+1).padStart(2,'0');
  if(f==='metronome')return ob.bpm+' BPM';if(f==='noise')return ['WHITE','PINK','BROWN'][ob.noise];
  return ob.saved.length?'LOOP '+(ob.savedIdx+1):'NO LOOPS';
}
function clipLabel(){
  if(ob.loop)return 'loop '+(ob.loop.len/ctx.sampleRate).toFixed(1)+' s';
  if(ob.tape==='scrub')return 'tape scrub';if(ob.tape==='transport')return 'tape '+sp(ob.transport);
  const s=SRC[ob.src];if(s==='radio'){const n=nearStation();return 'radio '+ob.freq.toFixed(1)+(n!==null?' '+STA[n].name:'')}
  if(s==='disk')return 'disk · '+FN[ob.fn]+(FN[ob.fn]==='metronome'?' '+ob.bpm:'');
  return (ob.quickAmb?'ambient · ':'')+(s==='line'?'line · your sound':'bt · your phone');
}

/* ====================== OB-4 control logic ====================== */
let playDown=0,comboDown=0,comboUsed=false,knobUsed=false,playHoldTimer=null,inputHoldTimer=null,saveTimer=null,comboRecording=false,inputDown=0,inputUsed=false;
function power(on){
  if(on===ob.on)return;ob.on=on;
  if(on){if(ob.inputHeld){ob.p1=true;inputUsed=true;msg('P1',1600)}else msg('HELLO',900);if(navigator.vibrate)navigator.vibrate(15)}
  else{ob.tape='live';ob.loop=null;T({t:'mode',mode:'live'})}
  route();
}
function goLive(){ob.tape='live';ob.loop=null;T({t:'mode',mode:'live'});T({t:'speed',v:1,snap:true})}
function inputPress(){if(!ob.on){ob.inputHeld=true;return}ob.inputHeld=true;inputDown=performance.now();inputUsed=false;
  if(ob.playHeld)comboStart();
  clearTimeout(inputHoldTimer);inputHoldTimer=setTimeout(()=>{if(ob.inputHeld&&!ob.playHeld&&!inputUsed&&ambientActive()&&ob.src===3){ob.ambSrc=(ob.ambSrc+1)%3;inputUsed=true;msg(['LINE','BT','RADIO'][ob.ambSrc]);}},700);
}
function inputRelease(){const held=performance.now()-inputDown;ob.inputHeld=false;clearTimeout(inputHoldTimer);
  if(comboDown){comboEnd();return}
  if(!ob.on)return;
  if(ob.tape==='transport'&&knobUsed){knobUsed=false;motorTo(volAngle());return} // speed locked
  if(ob.tape==='transport'&&!inputUsed&&held<450){ob.transport=1;T({t:'speed',v:1});msg('+1.0x');motorTo(volAngle());return}
  if(!inputUsed&&held<450){ob.src=(ob.src+1)%4;ob.quickAmb=false;msg(['LINE','BT','RADIO','DISK'][ob.src],900);route();setStrip()}
  knobUsed=false;motorTo(volAngle());
}
function playPress(){ob.playHeld=true;if(!ob.on)return;playDown=performance.now();comboUsed=false;knobUsed=false;
  if(ob.inputHeld){comboStart();return}
  clearTimeout(playHoldTimer);playHoldTimer=setTimeout(()=>{if(ob.playHeld&&!comboDown&&!knobUsed&&!dialUsedWithPlay){playHoldAction();playDown=-1}},650);
}
let dialUsedWithPlay=false;
function playRelease(){ob.playHeld=false;clearTimeout(playHoldTimer);
  if(comboDown){comboEnd();return}
  if(!ob.on||playDown<0){dialUsedWithPlay=false;return}
  if(knobUsed||dialUsedWithPlay){knobUsed=false;dialUsedWithPlay=false;motorTo(volAngle());return}
  playTap();
}
function playHoldAction(){
  if(ob.src===3){ob.fn=(ob.fn+1)%5;msg(FN[ob.fn].toUpperCase().slice(0,9),1000);route()}
  else{ob.quickAmb=!ob.quickAmb;msg(ob.quickAmb?'AMBIENT':'AMB OFF');route()}
}
function playTap(){
  if(ob.loop){goLive();msg('LIVE');return}
  if(ob.tape!=='live'){goLive();msg('REALTIME');return}
  if(ob.src===0){ob.linePlay=!ob.linePlay;route()}
  else if(ob.src===1){if(!btBuf){$('#upload').click();return}ob.btPlay=!ob.btPlay;route()}
  else if(ob.src===2)seek(1);
  else{const f=FN[ob.fn];
    if(f==='karma'){ob.mantra=(ob.mantra+1)%30;setKarma()}
    if(f==='metronome'){ob.metro=(ob.metro+1)%MSETS.length;msg(MSETS[ob.metro])}
    if(f==='noise'){ob.noise=(ob.noise+1)%3;setNoise()}
    if(f==='loop'){if(ob.saved.length){ob.savedIdx=(ob.savedIdx+1)%ob.saved.length;setSaved()}}
  }
}
function comboStart(){comboDown=performance.now();comboUsed=false;clearTimeout(playHoldTimer);inputUsed=true;
  if(ambientActive()&&ob.src!==3){ob.quickAmb=false;route();msg('AMB OFF');comboUsed=true;return}
  if(ob.loop){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(comboDown&&!knobUsed){saveLoop();comboUsed=true}},1300);return}
  if(ob.src===2)return; // decided on release (seek back) unless held long
  comboRecording=true;T({t:'markA'});msg('REC LOOP',60000);
}
function comboEnd(){const held=performance.now()-comboDown;comboDown=0;clearTimeout(saveTimer);
  if(comboUsed||knobUsed){knobUsed=false;motorTo(volAngle());return}
  if(ob.loop){if(held<450){ob.beat=!ob.beat;msg(ob.beat?'AUTO':'RAW')}return}
  if(ob.src===2&&!comboRecording){if(held<450)seek(-1);return}
  if(comboRecording){comboRecording=false;msgUntil=0;if(held<250){msg('TOO SHORT');return}T({t:'markB'})}
}
function loopFromMarks(a,b){let len=b-a;const sr=ctx.sampleRate;
  if(ob.beat){const beat=sr*60/ob.bpm;len=Math.max(beat,Math.round(len/beat)*beat)}
  ob.loop={a:b-len,base:len,len,factor:1,speed:1};ob.tape='loop';T({t:'loop',a:ob.loop.a,b:ob.loop.a+len});T({t:'speed',v:1,snap:true});msg('LOOP');
}
function saveLoop(){savedCb=d=>{ob.saved.push(toBuf(d));ob.savedIdx=ob.saved.length-1;msg('SAVE',1400)};T({t:'save'})}
function applyLoop(){const L=ob.loop;T({t:'loop',a:L.a,b:L.a+L.len,r:tapeState.r>=L.a&&tapeState.r<L.a+L.len?tapeState.r:L.a})}
let seekTimer=null;
function seek(dir){clearInterval(seekTimer);ensureStations();msg('',0);let steps=0;
  seekTimer=setInterval(()=>{ob.freq=+(ob.freq+dir*.1).toFixed(1);if(ob.freq>108)ob.freq=87.5;if(ob.freq<87.5)ob.freq=108;updateRadio();steps++;
    if((nearStation()!==null&&Math.abs(ob.freq-STA[nearStation()].f)<.05&&steps>2)||steps>220)clearInterval(seekTimer)},35)}

/* knob & dial */
function volAngle(){return ob.vol}
let knobVis=-135,knobTarget=null; // visual angle; motor animates to target
function motorTo(a){knobTarget=a}
let knobAcc=0;
function volumeTurn(d){ // d = degrees (clockwise +)
  if(!ob.on){ob.vol=clamp(ob.vol+d,-135,135);knobVis=ob.vol;if(ob.vol>-120)power(true);applyVol();return}
  knobTarget=null;
  if(ob.loop&&(ob.inputHeld||ob.playHeld)){knobUsed=true;if(ob.inputHeld)inputUsed=true;comboUsed=comboDown?true:comboUsed;knobVis+=d;knobAcc+=d;
    if(ob.inputHeld&&ob.playHeld){ob.loop.speed=clamp(ob.loop.speed+d/180,.25,2);T({t:'speed',v:ob.loop.speed});msg(sp(ob.loop.speed),900);return}
    const step=ob.inputHeld?40:30;
    while(Math.abs(knobAcc)>=step){const s=Math.sign(knobAcc);knobAcc-=s*step;
      if(ob.inputHeld){ob.loop.factor=clamp(ob.loop.factor*(s>0?2:.5),1/16,4);ob.loop.len=ob.loop.base*ob.loop.factor;applyLoop();msg('LEN '+(ob.loop.factor>=1?'X'+ob.loop.factor:'1/'+(1/ob.loop.factor)),900)}
      else{const beat=ctx.sampleRate*60/ob.bpm;ob.loop.a+=s*beat/2;applyLoop();msg('SLIDE '+(s>0?'+':'-'),700)}}
    return}
  if(ob.inputHeld){ // tape transport
    knobUsed=true;inputUsed=true;knobVis=clamp(knobVis+d,-135,135);
    const a=knobVis;ob.transport=+(a<0?1+(a/135)*5:1+(a/135)*3).toFixed(1);
    if(ob.tape!=='transport'){T({t:'mode',mode:'tape',from:ob.tape==='live'?'live':'x'});ob.tape='transport'}
    T({t:'k',v:.004});T({t:'auto',v:true});T({t:'speed',v:ob.transport});return}
  ob.vol=clamp(ob.vol+d,-135,135);knobVis=ob.vol;if(ob.vol<=-130)power(false);applyVol();
}
function speedToAngle(s){return s<1?(s-1)/5*135:(s-1)/3*135}
let dialAng=0,dialTouch=false,dialLastT=0,dialVel=0,dialSpeedSent=0;
function dialTurn(d,dt){
  if(!ob.on)return;
  if(ob.src<=1&&!ob.quickAmb&&!ob.loop){ // scrub
    if(ob.tape!=='scrub'){T({t:'mode',mode:'tape',from:ob.tape==='live'?'live':'x',speed:0,snap:true});T({t:'auto',v:false});T({t:'k',v:.02});ob.tape='scrub'}
    dialVel=d/Math.max(.008,dt);
  }
  else if(ob.src===2){const fine=ob.playHeld;if(fine)dialUsedWithPlay=true;dialAcc+=d;const st=fine?6:4;
    while(Math.abs(dialAcc)>=st){const s=Math.sign(dialAcc);dialAcc-=s*st;ob.freq=+(ob.freq+s*(fine?.05:.1)).toFixed(2);if(ob.freq>108)ob.freq=87.5;if(ob.freq<87.5)ob.freq=108}updateRadio()}
  else if(ob.src===3||ob.quickAmb){const f=ob.quickAmb&&ob.src!==3?'ambient':FN[ob.fn];
    if(f==='ambient'){if(ob.inputHeld){inputUsed=true;ob.mix=clamp(ob.mix+d/300,0,1);msg('MIX '+Math.round(ob.mix*100),700)}else{ob.tone=clamp(ob.tone+d/300,0,1);msg('TONE '+Math.round(ob.tone*100),700)}route()}
    else if(f==='metronome'){if(ob.inputHeld&&MSETS[ob.metro]==='808'){inputUsed=true;dialAcc+=d;while(Math.abs(dialAcc)>=10){const s=Math.sign(dialAcc);dialAcc-=s*10;ob.p808=clamp(ob.p808+s,-12,12)}msg('PITCH '+ob.p808,700)}
      else{dialAcc+=d;while(Math.abs(dialAcc)>=5){const s=Math.sign(dialAcc);dialAcc-=s*5;ob.bpm=clamp(ob.bpm+s,40,240)}}}
    else if(f==='noise'){if(ob.inputHeld){inputUsed=true;ob.waveT=clamp(ob.waveT+d/30,2,20);msg('WAVE '+ob.waveT.toFixed(0)+'S',700)}else{ob.strength=clamp(ob.strength+d/300,0,1);msg('WAVES '+Math.round(ob.strength*100),700)}}
  }
}
let dialAcc=0;
function dialRelease(){dialVel=0}
