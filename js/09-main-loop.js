/* 09-main-loop.js — Main animation loop + a small debug handle (window.__dbg) used for testing. */
/* ====================== main loop ====================== */
let lastT=performance.now();
function frame(t){const dt=Math.min(.05,(t-lastT)/1000||.016);lastT=t;
  if(ctx){
    if(page==='cat')catTick(dt);
    if(page==='obp'&&ob.tape==='scrub'){if(dialTouch&&performance.now()-dialLastT>60)dialVel*=.7;const target=dialTouch?dialVel/180:0;if(Math.abs(target-dialSpeedSent)>.01){T({t:'speed',v:target});dialSpeedSent=target}if(!dialTouch)dialVel*=.85}
    if(ob.src===3&&ob.fn===3&&noiseWave){const ph=(ctx.currentTime%ob.waveT)/ob.waveT,g=1-ob.strength*.85*(.5-.5*Math.cos(ph*Math.PI*2));noiseWave.gain.setTargetAtTime(g,ctx.currentTime,.05)}
    if(knobTarget!==null){knobVis+=(knobTarget-knobVis)*(1-Math.exp(-dt*7));if(Math.abs(knobTarget-knobVis)<.3){knobVis=knobTarget;knobTarget=null}}
    if(threeReady&&page==='obp')render3D(dt);
    if(epReady&&page==='epp')renderEP(dt);
    if(page==='end')renderCart(dt)}
  if(page==='cat'&&!ctx)layoutCat(dt);
  drawLED(dt);requestAnimationFrame(frame)}
requestAnimationFrame(frame);

window.__dbg={get mixMach(){return mixMach},get disc(){return discState},jumpTo,get LOOP(){return LOOP},get mixRec(){return mixRec},ep,evw,epGoView,openEP,padPress,ctlScreen,get epCtl(){return epCtl},epsnap(i){epGoView(i);eU=1;evw.zoom=i>1?i:evw.zoom},capture(){render3D(0);return renderer.domElement.toDataURL('image/png')},snap(i){goView(i);camU=1;view.zoom=i>1?i:view.zoom},ob,view,status,screenOf,openOB,openCart,goView,startRec,stopRec,volumeTurn,dialTurn,inputPress,inputRelease,playPress,playRelease,get mixLen(){return mixLen},get page(){return page},tapeState,get useWorklet(){return useWorklet},get ctxState(){return ctx&&ctx.state}};
