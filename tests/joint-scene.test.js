import test from 'node:test';
import assert from 'node:assert/strict';
import {rotatePoint,projectPoint,rotationAxis,renderJointScene,upperBodyModel} from '../src/joint-scene.js';
const close=(actual,expected)=>actual.forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<1e-9,`${actual} != ${expected}`));
test('roll, pitch and yaw rotate about distinct right-handed axes with Z up',()=>{
 assert.equal(rotationAxis('shoulder roll'),'x');assert.equal(rotationAxis('elbow pitch'),'y');assert.equal(rotationAxis('wrist yaw'),'z');
 close(rotatePoint([0,0,1],'x',90),[0,-1,0]);
 close(rotatePoint([0,0,1],'y',90),[1,0,0]);
 close(rotatePoint([0,0,1],'z',90),[0,0,1]);
 close(rotatePoint([1,0,1],'z',90),[0,1,1]);
 close(rotatePoint([0,0,1],'x',-90),[0,1,0]);
});
test('the front-top-right isometric camera projects Z upward with equal axis scales',()=>{
 const origin=projectPoint([0,0,0]),x=projectPoint([1,0,0]),y=projectPoint([0,1,0]),z=projectPoint([0,0,1]);
 assert.ok(z[1]<origin[1]);assert.ok(x[0]>origin[0]);assert.ok(y[0]>origin[0]);assert.ok(x[1]>origin[1]);assert.ok(y[1]<origin[1]);
 const length=p=>Math.hypot(p[0]-origin[0],p[1]-origin[1]);
 assert.ok(Math.abs(length(x)-length(y))<1e-9);assert.ok(Math.abs(length(y)-length(z))<1e-9);
});
test('rendered rotations differ and retain labeled axes and highlighted joints',()=>{
 const render=axis=>{const svg={innerHTML:'',setAttribute(){}};renderJointScene(svg,axis,45);return svg.innerHTML;};
 const x=render('x'),y=render('y'),z=render('z');
 assert.notEqual(x,y);assert.notEqual(y,z);assert.notEqual(x,z);
 assert.match(z,/Z rotation · 45°/);assert.match(z,/head/);assert.match(z,/Z up/);
});

test('every animation uses the same model and highlights only its selected parent-child chain',()=>{
 const head=upperBodyModel({part:'head',index:0},'x',30);
 const shoulder=upperBodyModel({part:'arm',index:0,side:'r_arm'},'y',30);
 const elbow=upperBodyModel({part:'arm',index:3,side:'r_arm'},'y',30);
 const wrist=upperBodyModel({part:'arm',index:6,side:'l_arm'},'z',30);
 assert.deepEqual(head.nodes.map(n=>n.id),shoulder.nodes.map(n=>n.id));
 assert.deepEqual(elbow.nodes.map(n=>n.id),wrist.nodes.map(n=>n.id));
 assert.equal(head.parent,'neck');assert.equal(head.child,'head');
 assert.equal(shoulder.parent,'shoulder_r_arm');assert.equal(shoulder.child,'elbow_r_arm');
 assert.equal(elbow.parent,'elbow_r_arm');assert.equal(elbow.child,'wrist_r_arm');
 assert.equal(wrist.parent,'wrist_l_arm');assert.equal(wrist.child,'hand_l_arm');
 for(const model of [head,shoulder,elbow,wrist]) {
  assert.deepEqual(model.nodes.find(n=>n.id===model.parent).color,[254,194,96]);
  assert.deepEqual(model.nodes.find(n=>n.id===model.child).color,[59,223,152]);
  close(model.nodes.find(n=>n.id==='torso').worldCenter,[0,0,.65]);
 }
 const stationary=elbow.nodes.find(n=>n.id==='upper_r_arm');
 close(stationary.worldCenter,stationary.center);
 const changed=elbow.nodes.find(n=>n.id==='wrist_r_arm');
 assert.notDeepEqual(changed.worldCenter,changed.center);
});
