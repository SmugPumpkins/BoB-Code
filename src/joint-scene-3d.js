import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {upperBodyModel,fullPoseModel,renderJointScene as renderFallback} from './joint-scene.js';

const scenes=new WeakMap();
function createScene(svg) {
 const container=svg.parentElement;
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
 renderer.setClearColor(0x000000,0);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.15;
 renderer.domElement.setAttribute('role','img');
 renderer.domElement.className='joint-webgl';
 container.prepend(renderer.domElement);
 svg.classList.add('joint-scene-overlay');svg.setAttribute('aria-hidden','true');
 const scene=new THREE.Scene();
 const camera=new THREE.OrthographicCamera(-3,3,1.95,-1.95,.01,50);
 camera.up.set(0,0,1);camera.position.set(5,-5,5.65);camera.lookAt(0,0,.65);
 const controls=new OrbitControls(camera,renderer.domElement);
 controls.target.set(0,0,.65);controls.enablePan=false;controls.minZoom=.6;controls.maxZoom=2.5;
 controls.update();controls.saveState();
 renderer.domElement.tabIndex=0;
 renderer.domElement.style.touchAction='none';
 const state={container,renderer,scene,camera,controls,width:0,height:0};
 controls.addEventListener('change',()=>state.redraw?.());
 scene.add(new THREE.AmbientLight(0xffffff,1.1));
 const fill=new THREE.HemisphereLight(0xe6f2ff,0x657089,1.6);fill.up.set(0,0,1);scene.add(fill);
 const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(3,-4,6);scene.add(key);
 const meshes=new Map();
 for(const node of upperBodyModel().nodes) {
  const size=[...node.size];
  const radius=Math.min(...size)*(node.id.startsWith('eye')?.3:.26);
  const geometry=new RoundedBoxGeometry(...size,5,radius);
  const material=new THREE.MeshStandardMaterial({roughness:.58,metalness:.02});
  const mesh=new THREE.Mesh(geometry,material);
  scene.add(mesh);meshes.set(node.id,mesh);
 }
 const axes=['x','y','z'].map((name,i)=>{
  const vector=new THREE.Vector3(i===0?1:0,i===1?1:0,i===2?1:0);
  const arrow=new THREE.ArrowHelper(vector,new THREE.Vector3(),.8,[0xff6072,0x3bdf98,0xfec260][i],.1,.045);
  scene.add(arrow);return {name,vector,arrow};
 });
 return Object.assign(state,{meshes,axes});
}
export function resetSceneView(svg) {scenes.get(svg)?.controls?.reset();}
export function renderJointScene3d(svg,axis,degrees,selection,pose=null) {
 let state=scenes.get(svg);
 if(state===false) {renderFallback(svg,axis,degrees,selection);return false;}
 if(!state) {
  try {state=createScene(svg);scenes.set(svg,state);}
  catch {scenes.set(svg,false);renderFallback(svg,axis,degrees,selection);return false;}
 }
 const {renderer,scene,camera,meshes,container,axes}=state;
 const width=container.clientWidth||500,height=container.clientHeight||280;
 if(width!==state.width||height!==state.height) {
  camera.left=-1.95*width/height;camera.right=1.95*width/height;camera.updateProjectionMatrix();
  renderer.setSize(width,height,false);state.width=width;state.height=height;
 }
 state.redraw=()=>renderJointScene3d(svg,axis,degrees,selection,pose);
 const model=pose?fullPoseModel(pose):upperBodyModel(selection,axis,degrees);
 svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
 const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0),degrees*Math.PI/180);
 for(const node of model.nodes) {
  const mesh=meshes.get(node.id);
  mesh.position.set(...node.worldCenter);
  if(node.rotation) {
   const m=node.rotation;
   mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(m[0][0],m[0][1],m[0][2],0,m[1][0],m[1][1],m[1][2],0,m[2][0],m[2][1],m[2][2],0,0,0,0,1));
  } else mesh.quaternion.copy(node.moving?rotation:new THREE.Quaternion());
  mesh.material.color.setStyle(`rgb(${node.color.join(',')})`);
 }
 let labels='';
 for(const {name,vector,arrow} of axes) {
  arrow.position.set(...model.pivot);arrow.visible=!pose;
  if(pose)continue;
  arrow.line.material.opacity=name===axis?.95:.45;arrow.line.material.transparent=true;
  const endpoint=new THREE.Vector3(...model.pivot).addScaledVector(vector,.92).project(camera);
  const x=(endpoint.x+1)/2*width,y=(1-endpoint.y)/2*height;
  labels+=`<text x="${x}" y="${y}" fill="${name==='x'?'#ff6072':name==='y'?'#3bdf98':'#fec260'}" font-size="11" font-weight="600">${name.toUpperCase()}</text>`;
 }
 labels+=`<text x="${width/2}" y="${height-23}" text-anchor="middle" fill="currentColor" font-size="12">${pose?'Whole-body pose':axis.toUpperCase()+' rotation · '+Math.round(degrees)+'°'}</text><text x="${width/2}" y="${height-7}" text-anchor="middle" fill="currentColor" opacity=".6" font-size="9">Drag to orbit · scroll to zoom | Z up</text>`;
 svg.innerHTML=labels;
 const label=pose?'Whole-body pose preview. Drag to rotate the view.':`Shared rounded upper-body figure: ${model.parent} yellow, ${model.child} green. ${axis.toUpperCase()} rotation ${Math.round(degrees)} degrees. Z up. Drag to rotate the view.`;
 renderer.domElement.setAttribute('aria-label',label);
 renderer.render(scene,camera);
 return true;
}
