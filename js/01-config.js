/* 01-config.js — Config & data: asset paths, the catalog list, tiny helpers ($, clamp, lerp, smooth). */
const EP='assets/models/ep-133.glb';
const RADIO=['assets/audio/ecal-radio-94-6.mp3','assets/audio/dxd-99-9.mp3'];
const IMG={p1:'assets/img/ko-sidekick.webp',p2:'assets/img/op-xy.webp',p3:'assets/img/ep-35.webp',p4:'assets/img/tx-6.webp',p5:'assets/img/op-1-field.webp',p6:'assets/img/ep-133.webp',p9:'assets/img/tp-7.webp',ob:'assets/img/ob-4.webp'};
addEventListener('error',e=>{try{ledMsg('ERR '+String(e.message||e).slice(0,40),9000)}catch(_){}});addEventListener('unhandledrejection',e=>{try{ledMsg('ERR '+String(e.reason&&e.reason.message||e.reason).slice(0,40),9000)}catch(_){}});
const FBX='assets/models/ob-4.fbx', TEX='assets/textures/ob-4-color.jpg', ROUGH='assets/textures/ob-4-roughness.jpg';
const CAT=[
 {img:'p3',name:'EP – 35',price:'399CHFS'},
 {img:'ob',name:'OB – 4',price:'549CHFS',live:true},
 {img:'p6',name:'EP – 133',price:'299CHFS',live:'ep'},
 {img:'p2',name:'OP – XY',price:'2299CHFS'},
 {img:'p1',name:'K.O. SIDEKICK',price:'249CHFS'},
 {img:'p4',name:'TX – 6',price:'1199CHFS'},
 {img:'p5',name:'OP – 1 FIELD',price:'1999CHFS'},
 {img:'p9',name:'TP – 7',price:'1499CHFS'}
];
const $=s=>document.querySelector(s), app=$('#app');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t, smooth=t=>t*t*(3-2*t);
