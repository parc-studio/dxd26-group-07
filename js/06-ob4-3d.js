/* 06-ob4-3d.js — OB-4 in 3D (three.js): materials and studio light, the 4 points of view, phone-tilt snapping, finger picking, pinch to zoom out. */
/* ====================== 3D OB-4 ====================== */
let floorShadow=null,renderer,scene,camera,model,parts={},dispTex,dispCanvas,leds=[],threeReady=false,threeP=null,anyMesh=[];
const view={t:0,target:0,zoom:1,front:true,sensorAt:0,sensorFront:null,gamma:0,beta:null,yaw:0,tUp:0};
function getRenderer(){if(renderer)return renderer;
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(2,devicePixelRatio));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.localClippingEnabled=true;
  RectAreaLightUniformsLib.init();return renderer}
function init3D(){return threeP||(threeP=(async()=>{getRenderer();
  scene=new THREE.Scene();const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(new RoomEnvironment(),.02).texture;
  camera=new THREE.PerspectiveCamera(30,1,1,4000);
  // studio light like the product shots: big soft box above, soft fill, rim
  const box=new THREE.RectAreaLight(0xffffff,1.3,260,120);box.position.set(-40,180,190);box.lookAt(0,40,8);scene.add(box);
  const key=new THREE.DirectionalLight(0xffffff,.9);key.position.set(-15,320,35);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-140,right:140,top:140,bottom:-140,near:10,far:600});key.shadow.radius=10;key.shadow.bias=-.0004;scene.add(key);
  const fbox=new THREE.RectAreaLight(0xffffff,4.5,240,160);fbox.position.set(-90,150,-220);fbox.lookAt(0,10,0);scene.add(fbox);
  const fbox2=new THREE.RectAreaLight(0xffffff,1.1,160,200);fbox2.position.set(160,40,-160);fbox2.lookAt(0,0,0);scene.add(fbox2);
  const rim=new THREE.DirectionalLight(0xffffff,.45);rim.position.set(140,80,180);scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff,0xc8c8c4,.35));
  const tl=new THREE.TextureLoader(),[tex,rough]=await Promise.all([tl.loadAsync(TEX),tl.loadAsync(ROUGH)]);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const obj=await new FBXLoader().loadAsync(FBX);
  const bodyMat=new THREE.MeshPhysicalMaterial({map:tex,roughnessMap:rough,roughness:.74,metalness:.04,envMapIntensity:.75,clearcoat:.1,clearcoatRoughness:.5,clippingPlanes:[clipPlane],clipShadows:true,side:THREE.DoubleSide});
  obj.traverse(o=>{if(o.isMesh){o.material=bodyMat;o.castShadow=true;o.receiveShadow=true;anyMesh.push(o)}});
  model=new THREE.Group();model.add(obj);scene.add(model);
  const sp=new THREE.Mesh(new THREE.PlaneGeometry(800,800),new THREE.ShadowMaterial({opacity:.1}));floorShadow=sp;sp.rotation.x=-Math.PI/2;sp.position.y=-77;sp.receiveShadow=true;scene.add(sp);
  buildParts();threeReady=true;
})())}
const CTRL={input:43.05,play:29.75,volume:-30.7,tape:-44.0},CZ=2.1,TOPY=43.15,KR=4.85;
// knob/button with a rounded edge so it catches the light like the real one
function capGeo(r,h,f){const pts=[new THREE.Vector2(0,0),new THREE.Vector2(r,0),new THREE.Vector2(r,h-f)];for(let i=1;i<=8;i++){const a=i/8*Math.PI/2;pts.push(new THREE.Vector2(r-f+Math.cos(a)*f,h-f+Math.sin(a)*f))}pts.push(new THREE.Vector2(0,h));return new THREE.LatheGeometry(pts,72)}
function buildParts(){
  const knobMat=new THREE.MeshPhysicalMaterial({color:0x1b1b1c,roughness:.45,metalness:.12,envMapIntensity:1.0,clearcoat:.3,clearcoatRoughness:.45});
  ['input','play'].forEach(k=>{const m=new THREE.Mesh(capGeo(KR,1.7,.55),knobMat);m.position.set(CTRL[k],TOPY,CZ);m.castShadow=true;m.receiveShadow=true;model.add(m);parts[k]=m});
  const vol=new THREE.Group();vol.position.set(CTRL.volume,TOPY,CZ);const vb=new THREE.Mesh(capGeo(KR,1.7,.45),knobMat);vb.castShadow=true;vol.add(vb);
  const fin=new THREE.Mesh(new RoundedBoxGeometry(1.9,2.6,9.2,3,.45),knobMat);fin.position.set(0,2.9,0);fin.castShadow=true;vol.add(fin);model.add(vol);parts.volume=vol;
  const tp=new THREE.Group();tp.position.set(CTRL.tape,TOPY,CZ);const tb=new THREE.Mesh(capGeo(KR,1.7,.45),knobMat);tb.castShadow=true;tp.add(tb);
  const wm=new THREE.MeshBasicMaterial({color:0xededed});[-2.9,2.9].forEach(z=>{const q=new THREE.Mesh(new THREE.BoxGeometry(.9,.12,.9),wm);q.position.set(0,1.76,z);tp.add(q)});model.add(tp);parts.tape=tp;
  dispCanvas=document.createElement('canvas');dispCanvas.width=640;dispCanvas.height=140;dispTex=new THREE.CanvasTexture(dispCanvas);dispTex.colorSpace=THREE.SRGBColorSpace;
  const dp=new THREE.Mesh(new THREE.PlaneGeometry(18.8,4.1),new THREE.MeshBasicMaterial({map:dispTex,toneMapped:false}));dp.position.set(27.1,43.74,15.9);dp.rotation.set(-Math.PI/2,0,Math.PI);model.add(dp);
  [46.6,40.1,33.6,27.0].forEach(x=>{const m=new THREE.Mesh(new THREE.CircleGeometry(.55,20),new THREE.MeshBasicMaterial({color:0x262626,toneMapped:false}));m.position.set(x,43.75,10.39);m.rotation.x=-Math.PI/2;model.add(m);leds.push(m)});
}
let lastDisp='';
function drawDisplay(txt){const x=dispCanvas.getContext('2d'),W=dispCanvas.width,H=dispCanvas.height;const key=txt+'|'+ob.on;if(key===lastDisp)return;lastDisp=key;
  x.fillStyle='#414140';x.fillRect(0,0,W,H);const c=document.createElement('canvas');c.width=W;c.height=H;dotsDisp(c.getContext('2d'),W,H,ob.on?txt:'');
  x.shadowColor='rgba(215,228,255,.95)';x.shadowBlur=12;x.drawImage(c,0,0);x.shadowBlur=0;x.drawImage(c,0,0);dispTex.needsUpdate=true}
function dotsDisp(ctx2,W,H,text){const chars=9,cols=chars*6-1,pad=10,pitch=Math.min((W-pad*2)/cols,(H-pad*2)/7),r=pitch*.36,ox=pad+(W-pad*2-cols*pitch)/2,oy=(H-7*pitch)/2,s=(text||'').slice(0,chars);
  for(let ci=0;ci<chars;ci++){const g=glyph(s[ci]||' ');for(let y=0;y<7;y++)for(let xx=0;xx<5;xx++){const on=g&&g[y][xx]==='#';ctx2.fillStyle=on?'#f2f6ff':'rgba(255,255,255,.03)';ctx2.beginPath();ctx2.arc(ox+(ci*6+xx)*pitch+pitch/2,oy+y*pitch+pitch/2,r,0,7);ctx2.fill()}}}

/* points of view: 0 front · 1 top (panel along the phone) · 2 display + input/play · 3 volume + tape */
function key(tgt,dir,up,w,h,fov){return {tgt,dir:dir.normalize(),up:up.normalize(),w,h,fov}}
const KEYS=[
  key(new THREE.Vector3(0,-2,8),new THREE.Vector3(0,.17,-1),new THREE.Vector3(0,1,0),128,166,30),
  key(new THREE.Vector3(0,42,7),new THREE.Vector3(0,1,-.2),new THREE.Vector3(-1,0,0),62,132,18),
  key(new THREE.Vector3(32,43.7,10),new THREE.Vector3(.04,1,-.24),new THREE.Vector3(-1,0,0),44,54,20),
  key(new THREE.Vector3(-37,43.7,3.5),new THREE.Vector3(.06,1,-.3),new THREE.Vector3(-1,0,0),38,46,22)];
const clipPlane=new THREE.Plane(new THREE.Vector3(0,-1,0),200);
const _t=new THREE.Vector3(),_d=new THREE.Vector3(),_u=new THREE.Vector3(),_q=new THREE.Quaternion();
const lerpKey=(A,B,u)=>({tgt:A.tgt.clone().lerp(B.tgt,u),dir:A.dir.clone().lerp(B.dir,u).normalize(),up:A.up.clone().lerp(B.up,u).normalize(),w:Math.exp(lerp(Math.log(A.w),Math.log(B.w),u)),h:Math.exp(lerp(Math.log(A.h),Math.log(B.h),u)),fov:lerp(A.fov,B.fov,u)});
let camFrom=KEYS[0],camTo=KEYS[0],camU=1;
function goView(i){i=clamp(i,0,3);if(i===view.target&&camU>=1)return;const cur=lerpKey(camFrom,camTo,smooth(camU));camFrom=cur;camTo=KEYS[i];camU=0;view.target=i;app.classList.toggle('zoomed',i>=2);if(navigator.vibrate)navigator.vibrate(6)}
function applyCamera(K,yawDeg){
  const vf=K.fov*Math.PI/180,hf=2*Math.atan(Math.tan(vf/2)*camera.aspect),dist=Math.max(K.w/2/Math.tan(hf/2),K.h/2/Math.tan(vf/2))*1.06;
  camera.fov=K.fov;camera.updateProjectionMatrix();_t.copy(K.tgt);_d.copy(K.dir);_u.copy(K.up);
  const yaw=yawDeg*Math.PI/180;if(Math.abs(yaw)>1e-4){_q.setFromAxisAngle(_u,yaw);_d.applyQuaternion(_q)}
  camera.position.copy(_t).addScaledVector(_d,dist);camera.up.copy(_u);camera.lookAt(_t);camera.updateMatrixWorld();
}
/* phone tilt = the only thing that moves the camera: upright → front, top of the phone tilted down → top */
function onTilt(e){if(e.beta==null)return;view.sensorAt=performance.now();view.beta=e.beta;view.gamma=view.gamma+((e.gamma||0)-view.gamma)*.2;
  const H=6,front=view.sensorFront===null?e.beta>62:(view.sensorFront?e.beta>62-H:e.beta>62+H);
  if(front!==view.sensorFront){view.sensorFront=front;if(page==='obp')goView(front?0:view.zoom);if(page==='epp'&&epReady)epGoView(front?0:evw.zoom)}}
addEventListener('deviceorientation',onTilt);
document.querySelectorAll('.zoomout').forEach(b=>b.addEventListener('click',()=>{if(page==='epp'){evw.zoom=1;epGoView(1)}else{view.zoom=1;goView(1)}}));
let tiltAsked=false,tiltBusy=false; // true once granted (or not needed)
function askTilt(){if(tiltAsked||tiltBusy)return;if(!(window.DeviceOrientationEvent&&typeof DeviceOrientationEvent.requestPermission==='function')){tiltAsked=true;return}
  try{tiltBusy=true;DeviceOrientationEvent.requestPermission().then(r=>{tiltBusy=false;if(r==='granted')tiltAsked=true}).catch(()=>{tiltBusy=false})}catch(e){tiltBusy=false}}
const sensorLive=()=>performance.now()-view.sensorAt<1500;
/* fingers = clicks on the machine. Tap a section to zoom in, double-tap around it to zoom out */
const stage=$('#stage'),ray=new THREE.Raycaster(),ptrs=new Map();
function project(x,y,z){const p=new THREE.Vector3(x,y,z);model.localToWorld(p);p.project(camera);const r=stage.getBoundingClientRect();return [r.left+(p.x*.5+.5)*r.width,r.top+(-p.y*.5+.5)*r.height]}
function screenOf(name){return project(CTRL[name],TOPY+1,CZ)}
function pickControl(e){ // nearest control under the finger, generous radius (works from any view)
  if(camU<.6)return null;let best=null,bd=1e9;
  for(const k of Object.keys(CTRL)){const [x,y]=screenOf(k),[x2,y2]=project(CTRL[k]+KR,TOPY+1,CZ),rad=Math.max(34,Math.hypot(x2-x,y2-y)*1.45),d=Math.hypot(e.clientX-x,e.clientY-y);
    const r=stage.getBoundingClientRect();if(x<r.left||x>r.right||y<r.top||y>r.bottom)continue;if(d<rad&&d<bd){bd=d;best=k}}
  return best}
function sectionAt(e){const r=stage.getBoundingClientRect(),m=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(m,camera);const h=ray.intersectObjects(anyMesh,false)[0];if(!h)return null;const p=model.worldToLocal(h.point.clone());return p.x>-5?2:3}
// pinch (two fingers closing) = zoom back out
const pinch=new Map();let pinchD0=0;
function pinchAdd(e){pinch.set(e.pointerId,[e.clientX,e.clientY]);if(pinch.size===2){const [a,b]=[...pinch.values()];pinchD0=Math.hypot(a[0]-b[0],a[1]-b[1])}}
function pinchMove(e){if(!pinch.has(e.pointerId))return;pinch.set(e.pointerId,[e.clientX,e.clientY]);if(pinch.size!==2||!pinchD0)return;const [a,b]=[...pinch.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);
  if(d<pinchD0*.72){pinchD0=0;if(page==='obp'&&view.target>=2){view.zoom=1;goView(1)}}}
function pinchEnd(e){pinch.delete(e.pointerId);if(pinch.size<2)pinchD0=0}
stage.addEventListener('pointerdown',e=>{if(!threeReady)return;ctx&&ctx.resume();stage.setPointerCapture(e.pointerId);const c=pinch.size?null:pickControl(e),st={ctrl:c,x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,t:performance.now()};
  if(c==='input')inputPress();else if(c==='play')playPress();
  else if(c==='volume'||c==='tape'){const [cx,cy]=screenOf(c);st.cx=cx;st.cy=cy;st.a=Math.atan2(e.clientY-cy,e.clientX-cx);if(c==='tape'){dialTouch=true;dialLastT=performance.now()}}
  if(c){activity(4);const z=(c==='input'||c==='play')?2:3;if(view.target!==z){view.zoom=z;goView(z)}if(navigator.vibrate)navigator.vibrate(5)}
  pinchAdd(e);
  ptrs.set(e.pointerId,st);e.preventDefault()});
stage.addEventListener('pointermove',e=>{pinchMove(e);const st=ptrs.get(e.pointerId);if(!st)return;
  if(st.ctrl==='volume'||st.ctrl==='tape'){const [cx,cy]=screenOf(st.ctrl),a=Math.atan2(e.clientY-cy,e.clientX-cx),a0=Math.atan2(st.y-cy,st.x-cx);st.x=e.clientX;st.y=e.clientY;let d=(a-a0)*180/Math.PI;if(d>180)d-=360;if(d<-180)d+=360;
    if(st.ctrl==='volume')volumeTurn(d);else{const now=performance.now();dialAng+=d;dialTurn(d,(now-dialLastT)/1000);dialLastT=now}}});
function ptrUp(e){pinchEnd(e);const st=ptrs.get(e.pointerId);if(!st)return;ptrs.delete(e.pointerId);
  if(st.ctrl==='input')inputRelease();else if(st.ctrl==='play')playRelease();else if(st.ctrl==='tape'){dialTouch=false;dialRelease()}
  if(st.ctrl)return;
  const moved=Math.hypot(e.clientX-st.x0,e.clientY-st.y0),now=performance.now();
  if(moved<10&&now-st.t<450){ // a tap
    const sec=sectionAt(e);
    if(view.target===0){if(!sensorLive())goView(view.zoom)}           // no gyroscope (laptop): tap brings the top view
    else if(view.target===1){if(sec){view.zoom=sec;goView(sec)}}      // tap a section → zoom in
  }else if(!sensorLive()&&Math.abs(e.clientY-st.y0)>50){ // laptop fallback only
    goView(e.clientY<st.y0?(view.target===0?view.zoom:view.target):0)}
}
stage.addEventListener('pointerup',ptrUp);stage.addEventListener('pointercancel',ptrUp);
addEventListener('keydown',e=>{if(page!=='obp'||e.repeat)return;if(e.key==='Shift')inputPress();if(e.key==='Alt'){e.preventDefault();playPress()}
  if(e.key==='ArrowDown')goView(view.target===0?1:view.target);if(e.key==='ArrowUp'){if(view.target>1){view.zoom=1;goView(1)}else goView(0)}});
addEventListener('keyup',e=>{if(page!=='obp')return;if(e.key==='Shift')inputRelease();if(e.key==='Alt'){e.preventDefault();playRelease()}});
addEventListener('wheel',e=>{if(page!=='obp'||sensorLive())return;const now=performance.now();if(now-(goView.w||0)<450||Math.abs(e.deltaY)<12)return;goView.w=now;if(e.deltaY>0)goView(view.target===0?1:view.target);else{if(view.target>1){view.zoom=1;goView(1)}else goView(0)}},{passive:true});
async function openOB(){askTilt();await unlock();show('obp');app.classList.remove('zoomed');view.zoom=1;view.yaw=0;
  const start=sensorLive()&&view.sensorFront===false?1:0;camFrom=camTo=KEYS[start];camU=1;view.target=start;view.t=start;
  if(!ob.on){ob.vol=-35;knobVis=-135;power(true);motorTo(ob.vol)} // it turns on by itself: the knob motors up, your sound plays
  route();
  try{await init3D()}catch(err){ledMsg('3D ERROR');return}
  if(renderer.domElement.parentNode!==stage)stage.appendChild(renderer.domElement);
}
function sizeRenderer(el,cam){const r=el.getBoundingClientRect(),pr=renderer.getPixelRatio();if(renderer.domElement.width!==Math.round(r.width*pr)||renderer.domElement.height!==Math.round(r.height*pr)){renderer.setSize(r.width,r.height,false)}cam.aspect=r.width/Math.max(1,r.height);cam.updateProjectionMatrix()}
function render3D(dt){
  camU=Math.min(1,camU+dt/.75);const K=lerpKey(camFrom,camTo,smooth(camU));
  view.t=lerp(camFrom===camTo?view.target:0,view.target,1); // for status()
  const topness=clamp(1-(K.dir.z*-1-.2)/.83,0,1); // 0 front → 1 top
  view.tUp=topness<.3?1:0;
  const gy=sensorLive()?clamp(view.gamma*.4,-14,14):0;
  sizeRenderer(stage,camera);applyCamera(K,gy);
  clipPlane.constant=lerp(80,44.9,smooth(clamp((topness-.25)/.6,0,1)));if(floorShadow)floorShadow.material.opacity=.1*(1-smooth(clamp(topness/.6,0,1)));
  parts.volume.rotation.y=-knobVis*Math.PI/180;
  if(!dialTouch&&ob.on){const running=(ob.tape==='live'&&((ob.src===0&&ob.linePlay)||(ob.src===1&&btBuf&&ob.btPlay)||ob.src>=2))||ob.tape!=='live';dialAng+=(running?tapeState.sp:0)*60*dt}
  parts.tape.rotation.y=-dialAng*Math.PI/180;
  parts.input.position.y=TOPY-(ob.inputHeld?.55:0);parts.play.position.y=TOPY-(ob.playHeld?.55:0);
  leds.forEach((m,i)=>{const act=ob.on&&ob.src===i;const col=i===1&&act?(btBuf?0x3d7bff:((performance.now()/400|0)%2?0x3d7bff:0x262626)):act?0xffffff:0x262626;m.material.color.setHex(col);m.scale.setScalar(act?1.25:1)});
  drawDisplay(status());renderer.render(scene,camera);
}
