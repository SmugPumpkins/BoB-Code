export const rotationAxis = name => name.includes('roll')?'x':name.includes('pitch')?'y':'z';
export function rotatePoint([x,y,z],axis,degrees) {
 const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 if(axis==='x')return [x,c*y-s*z,s*y+c*z];
 if(axis==='y')return [c*x+s*z,y,-s*x+c*z];
 return [c*x-s*y,s*x+c*y,z];
}
// Orthographic camera at front (+X), right (-Y), and above (+Z).
export function projectPoint([x,y,z]) {
 return [180+72*(x+y)/Math.sqrt(2),190+72*((x-y)/Math.sqrt(6)-z*Math.sqrt(2/3))];
}
const depth=([x,y,z])=>(x-y+z)/Math.sqrt(3);
const shade=(rgb,factor)=>`rgb(${rgb.map(v=>Math.round(Math.min(255,v*factor))).join(',')})`;
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const subtract=(a,b)=>a.map((v,i)=>v-b[i]);

// One shared model: only the selected pivot, moving subtree, and highlights vary.
export function upperBodyModel(selection={part:'head',index:0,side:'r_arm'},axis='x',degrees=0) {
 const nodes=[];
 const box=(id,center,size,color=[135,156,181])=>nodes.push({id,center,size,color});
 box('torso',[0,0,.65],[.42,1.1,1.25]);
 box('neck',[0,0,1.43],[.23,.23,.24]);
 box('head',[0,0,1.85],[.5,.62,.58],[163,181,203]);
 // Slightly proud of the head face: avoid coplanar depth flicker while retaining occlusion.
 box('eye_right',[.28,-.16,1.91],[.03,.13,.11],[46,70,134]);
 box('eye_left',[.28,.16,1.91],[.03,.13,.11],[46,70,134]);
 for(const [side,y] of [['r_arm',-.79],['l_arm',.79]]) {
  box('shoulder_'+side,[0,y,1.14],[.29,.29,.29]);
  box('upper_'+side,[0,y,.7],[.22,.22,.68]);
  box('elbow_'+side,[0,y,.25],[.27,.27,.27]);
  box('forearm_'+side,[0,y,-.17],[.2,.2,.65]);
  box('wrist_'+side,[0,y,-.59],[.23,.23,.23]);
  box('hand_'+side,[.035,y,-.87],[.32,.19,.32]);
 }
 let parent='neck',child='head',moving=['head','eye_right','eye_left'];
 if(selection.part==='arm') {
  const side=selection.side||'r_arm',joint=selection.index<2?'shoulder':selection.index<4?'elbow':'wrist';
  parent=joint+'_'+side;
  child=(joint==='shoulder'?'elbow':joint==='elbow'?'wrist':'hand')+'_'+side;
  const chains={shoulder:['upper','elbow','forearm','wrist','hand'],elbow:['forearm','wrist','hand'],wrist:['hand']};
  moving=chains[joint].map(name=>name+'_'+side);
 }
 const pivot=nodes.find(node=>node.id===parent).center;
 for(const node of nodes) {
  node.moving=moving.includes(node.id);
  if(node.id===parent)node.color=[254,194,96];
  else if(node.id===child)node.color=[59,223,152];
  else if(node.moving&&!node.id.startsWith('eye'))node.color=[102,175,160];
  node.transform=point=>node.moving?add(rotatePoint(subtract(point,pivot),axis,degrees),pivot):point;
  node.worldCenter=node.transform(node.center);
 }
 return {nodes,pivot,parent,child};
}

const identity=()=>[[1,0,0],[0,1,0],[0,0,1]];
const mv=(m,p)=>m.map(row=>row.reduce((sum,v,i)=>sum+v*p[i],0));
const mm=(a,b)=>a.map(row=>b[0].map((_,j)=>row.reduce((sum,v,k)=>sum+v*b[k][j],0)));
const rotation=(axis,value)=>[0,1,2].map(i=>[0,1,2].map(j=>rotatePoint([0,1,2].map(k=>k===j?1:0),axis,value)[i]));
const chain=(axes,values)=>axes.reduce((m,axis,i)=>mm(m,rotation(axis,values[i])),identity());
export const defaultPose=()=>({head:[0,0,0],r_arm:[0,0,0,-90,0,0,0],l_arm:[0,0,0,-90,0,0,0]});
// Schematic serial joints, kept independent of collision geometry and hardware calibration.
export function fullPoseModel(pose) {
 const model=upperBodyModel();
 const nodes=new Map(model.nodes.map(node=>[node.id,node]));
 const place=(names,pivot,position,orientation)=>names.forEach(name=>{
  const node=nodes.get(name);
  node.worldCenter=add(position,mv(orientation,subtract(node.center,pivot)));
  node.rotation=orientation;node.color=node.id.startsWith('eye')?[46,70,134]:[135,156,181];
 });
 place(['torso','neck'],[0,0,0],[0,0,0],identity());
 const neck=nodes.get('neck').center;
 place(['head','eye_right','eye_left'],neck,neck,chain(['x','y','z'],pose.head));
 nodes.get('head').color=[59,223,152];
 for(const side of ['r_arm','l_arm']) {
  const values=pose[side],shoulder=nodes.get('shoulder_'+side).center;
  const sr=chain(['y','x'],values.slice(0,2));
  place(['shoulder_'+side,'upper_'+side,'elbow_'+side],shoulder,shoulder,sr);
  const elbow=nodes.get('elbow_'+side);
  const er=mm(sr,chain(['z','y'],values.slice(2,4)));
  place(['forearm_'+side,'wrist_'+side],elbow.center,elbow.worldCenter,er);
  const wrist=nodes.get('wrist_'+side);
  place(['hand_'+side],wrist.center,wrist.worldCenter,mm(er,chain(['x','y','z'],values.slice(4))));
  nodes.get('hand_'+side).color=[59,223,152];
 }
 return {...model,parent:'torso',child:'head and hands'};
}
function roundedPath(vertices) {
 const p=vertices.map(projectPoint),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
 const pairs=p.map((current,i)=>({before:mix(current,p[(i+p.length-1)%p.length],.1),point:current,after:mix(current,p[(i+1)%p.length],.1)}));
 let path=`M${pairs[0].after.join(' ')}`;
 for(let step=1;step<=pairs.length;step++) {
  const corner=pairs[step%pairs.length];
  path+=` L${corner.before.join(' ')} Q${corner.point.join(' ')} ${corner.after.join(' ')}`;
 }
 return path+' Z';
}
export function renderJointScene(svg,axis,degrees,selection={part:'head',index:0,side:'r_arm'}) {
 const {nodes,pivot,parent,child}=upperBodyModel(selection,axis,degrees);
 const faces=[];
 for(const node of nodes) {
  const vertices=[];
  for(const z of [-1,1])for(const y of [-1,1])for(const x of [-1,1])vertices.push(node.transform(node.center.map((v,i)=>v+[x,y,z][i]*node.size[i]/2)));
  const indices=[[0,2,6,4],[1,5,7,3],[0,4,5,1],[2,3,7,6],[0,1,3,2],[4,6,7,5]];
  const normals=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
  indices.forEach((ids,i)=>{
   const normal=node.moving?rotatePoint(normals[i],axis,degrees):normals[i];
   if(normal[0]-normal[1]+normal[2]<=0)return;
   const factor=.76+.24*(normal[0]-normal[1]+normal[2])/Math.sqrt(3);
   const face={vertices:ids.map(index=>vertices[index]),fill:shade(node.color,factor),id:node.id};
   face.distance=face.vertices.reduce((sum,p)=>sum+depth(p),0)/4;
   faces.push(face);
  });
 }
 const axes=[['x',[.95,0,0],'#ff6072'],['y',[0,.95,0],'#3bdf98'],['z',[0,0,.95],'#fec260']];
 let markup='<g class="scene-axes">';
 for(const [name,offset,color] of axes) {
  const [x,y]=projectPoint(add(pivot,offset)),[ox,oy]=projectPoint(pivot);
  markup+=`<path d="M${ox} ${oy}L${x} ${y}" fill="none" stroke="${color}" stroke-width="${name===axis?2.5:1.2}" stroke-dasharray="${name===axis?'5 3':'2 4'}" opacity="${name===axis?1:.55}"/><text x="${x+5}" y="${y-4}" fill="${color}" font-size="11" font-weight="600">${name.toUpperCase()}</text>`;
 }
 markup+='</g>';
 faces.sort((a,b)=>a.distance-b.distance);
 markup+=faces.map(face=>`<path data-part="${face.id}" d="${roundedPath(face.vertices)}" fill="${face.fill}" stroke="${face.fill}" stroke-width="1.2" stroke-linejoin="round"/>`).join('');
 markup+=`<text x="180" y="277" text-anchor="middle" fill="currentColor" font-size="12">${axis.toUpperCase()} rotation · ${Math.round(degrees)}°</text><text x="180" y="294" text-anchor="middle" fill="currentColor" opacity=".6" font-size="9">Front · top · right view | Z up</text>`;
 svg.innerHTML=markup;
 svg.setAttribute('aria-label',`Shared upper-body model, ${parent} yellow, ${child} green. ${axis.toUpperCase()} rotation ${Math.round(degrees)} degrees, Z up`);
}
