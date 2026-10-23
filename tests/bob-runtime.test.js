import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {Blockly,generatePython} from '../src/blocks.js';
import {defaultPose,fullPoseModel} from '../src/joint-scene.js';

test('Python runtime rejects collisions along paths and unavailable checks before motor power',()=>{
 const result=spawnSync('python',['tests/test_bob_code.py'],{encoding:'utf8',timeout:10000});
 assert.equal(result.status,0,result.stderr);
});
test('whole-body pose survives saving and generates a compact library call',()=>{
 const w=new Blockly.Workspace(),b=w.newBlock('set_pose');
 const pose=defaultPose();pose.head[2]=30;pose.r_arm[0]=-20;
 b.setFieldValue(JSON.stringify(pose),'POSE');
 const code=generatePython(w,'test');
 assert.match(code,/import bob_code as bob/);assert.match(code,/bob.set_pose\(reachy, head=\[0,0,30\]/);
 assert.ok(!code.includes('def _bob'));
 const saved=Blockly.serialization.workspaces.save(w);Blockly.serialization.workspaces.load(saved,w);
 assert.equal(generatePython(w,'test'),code);w.dispose();
});
test('full pose composes parent rotations and keeps the opposite arm fixed',()=>{
 const pose=defaultPose(),before=fullPoseModel(pose);
 pose.r_arm[0]=45;const after=fullPoseModel(pose);
 const node=(model,id)=>model.nodes.find(n=>n.id===id).worldCenter;
 assert.deepEqual(node(after,'hand_l_arm'),node(before,'hand_l_arm'));
 assert.notDeepEqual(node(after,'hand_r_arm'),node(before,'hand_r_arm'));
 const arm=after.nodes.find(n=>n.id==='wrist_r_arm');
 assert.ok(arm.rotation.flat().every(Number.isFinite));
});
