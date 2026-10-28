/* 00-boot.js — loads three.js (CDN, import map) and then the app scripts in order. */
import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
// three.js comes in as ES modules; the app files are plain scripts that share one global scope, loaded in order
Object.assign(window,{THREE,FBXLoader,RoomEnvironment,GLTFLoader,RectAreaLightUniformsLib,RoundedBoxGeometry});
const FILES=["01-config.js", "02-dot-font.js", "03-audio-core.js", "04-ob4-logic.js", "05-ui.js", "06-ob4-3d.js", "07-cart-disc.js", "08-ep133.js", "09-main-loop.js"];
for(const f of FILES)await new Promise((res,rej)=>{const s=document.createElement('script');s.src='js/'+f;s.onload=res;s.onerror=()=>rej(new Error('could not load '+f));document.body.appendChild(s)});
