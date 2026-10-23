import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {Blockly,generatePython} from '../src/blocks.js';
import {armLimits,clampArmTarget} from '../src/arm-limits.js';
const value=n=>({block:{type:'math_number',fields:{NUM:n}}});
function codeFor(blocks) {
 const w=new Blockly.Workspace();
 Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks}},w);
 const code=generatePython(w,'test');w.dispose();return code;
}
function run(code,expected,extra='') {
 const harness=`import sys,types\nsys.path.insert(0, "public")\ncalls=[]\nclass Part:\n    on=False\n    def is_on(self): return self.on\n    def turn_on(self): self.on=True\n    def goto(self,target,duration,wait):\n        assert wait is True\n        calls.append(target)\n    def get_translation_by(self,*args): return 'translation'\n    def get_rotation_by(self,*args): return 'rotation'\n    def inverse_kinematics(self,pose): return [0,100,0,-200,30,-30,0]\n    def get_default_posture_joints(self,posture): return [0,100,0,-200,30,-30,0]\nclass Robot:\n    def __init__(self,host): self.r_arm=Part(); self.l_arm=Part(); self.head=None\n    def is_connected(self): return True\n    def disconnect(self): pass\nmodule=types.ModuleType('reachy2_sdk')\nmodule.ReachySDK=Robot\nsys.modules['reachy2_sdk']=module\nexec(sys.stdin.read())\nassert calls == ${JSON.stringify(expected)}, calls\n${extra}\n`;
 const result=spawnSync('python',['-c',harness],{input:code,encoding:'utf8',timeout:5000});
 assert.equal(result.status,0,result.stderr);return result;
}
test('user intervals are normalized and every joint clamps to its own bounds',()=>{
 assert.deepEqual(armLimits.r_arm[1],[-165,20]);
 assert.deepEqual(armLimits.l_arm[1],[-20,165]);
 for(const side of ['r_arm','l_arm']) {
  const lows=armLimits[side].map(([low])=>low),highs=armLimits[side].map(([,high])=>high);
  assert.deepEqual(clampArmTarget(lows,side).target,lows);
  assert.deepEqual(clampArmTarget(highs,side).target,highs);
  assert.deepEqual(clampArmTarget(lows.map(n=>n-1),side).target,lows);
  assert.deepEqual(clampArmTarget(highs.map(n=>n+1),side).target,highs);
 }
});
test('direct targets export corrected literals, warn, and continue to the next movement',()=>{
 const code=codeFor([{type:'arm_goto',fields:{ARM:'r_arm',J0:500,J1:100,J3:50,J4:60,J5:-60},next:{block:{type:'arm_goto',fields:{ARM:'l_arm'}}}}]);
 assert.match(code,/bob.move_arm\(reachy.r_arm, "r_arm", \[360, 20, 0, 0, 15, -15, 0\]/);
 const result=run(code,[[360,20,0,0,15,-15,0],[0,0,0,-90,0,0,0]]);
 assert.match(result.stderr,/using 15/);
});
test('calculated position is clamped at movement time without changing its variable',()=>{
 const input=[500,100,-500,20,-25,30,400];
 const code=codeFor([{type:'typed_set_arm_position',fields:{VAR:{name:'saved',type:'ArmPose'}},inputs:{VALUE:{block:{type:'arm_position',inputs:Object.fromEntries(input.map((n,i)=>['J'+i,value(n)]))}}},next:{block:{type:'arm_move_position',fields:{ARM:'r_arm'},inputs:{POSITION:{block:{type:'typed_get_arm_position',fields:{VAR:{name:'saved',type:'ArmPose'}}}},DURATION:value(2)}}}}]);
 const result=run(code,[[360,20,-360,0,-15,15,360]],`assert saved == ${JSON.stringify(input)}, saved`);
 assert.match(result.stderr,/outside/);
});
test('relative moves and named postures also bound solved joint targets',()=>{
 for(const type of ['arm_translate','arm_rotate']) {
  const code=codeFor([{type,fields:{ARM:'r_arm'}}]);
  run(code,[[0,20,0,-125,15,-15,0]]);
 }
 run(codeFor([{type:'robot_posture'}]),[[0,20,0,-125,15,-15,0],[0,100,0,-125,15,-15,0]]);
});
test('invalid pose is reported and skipped without halting subsequent movement',()=>{
 const code=codeFor([{type:'arm_move_position',inputs:{POSITION:{block:{type:'arm_positions'}}},next:{block:{type:'arm_goto'}}}]);
 const patched=code.replace('reachy.r_arm.get_current_positions()','[float("nan")]');
 const result=run(patched,[[0,0,0,-90,0,0,0]]);
 assert.match(result.stderr,/invalid r_arm position; movement skipped/);
});
