import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {Blockly,generatePython} from '../src/blocks.js';

const n=value=>({block:{type:'math_number',fields:{NUM:value}}});
const v=(part,name)=>({name,type:part==='head'?'HeadPose':'ArmPose'});
function workspace(blocks) {
 const w=new Blockly.Workspace();
 Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks}},w);
 return w;
}
function execute(code,expected) {
 const harness=`import sys,types\nsys.path.insert(0, "public")\ncalls=[]\nclass Part:\n    on=False\n    def is_on(self): return self.on\n    def turn_on(self): self.on=True; calls.append('on')\n    def goto(self,target,duration,wait):\n        assert wait is True\n        calls.append([target,duration])\nclass Robot:\n    def __init__(self,host):\n        self.head=Part()\n        self.l_arm=Part()\n        self.r_arm=Part()\n    def is_connected(self): return True\n    def disconnect(self): pass\nmodule=types.ModuleType('reachy2_sdk')\nmodule.ReachySDK=Robot\nsys.modules['reachy2_sdk']=module\nexec(sys.stdin.read())\nassert calls == ${JSON.stringify(expected).replaceAll('true','True')}, calls\n`;
 const result=spawnSync('python',['-c',harness],{input:code,encoding:'utf8',timeout:5000});
 assert.equal(result.status,0,result.stderr);
}
test('calculated head position can be saved without moving then passed to movement',()=>{
 const value={type:'head_position',inputs:{R:n(1),P:n(2),Y:{block:{type:'math_arithmetic',fields:{OP:'ADD'},inputs:{A:n(10),B:n(5)}}}}};
 const setter={type:'typed_set_head_position',fields:{VAR:v('head','look_right')},inputs:{VALUE:{block:value}}};
 const w=workspace([setter]);
 const dataOnly=generatePython(w,'test');
 assert.ok(!dataOnly.includes('.turn_on()'));
 assert.ok(!dataOnly.includes('.goto('));
 execute(dataOnly,[]);
 w.dispose();
 setter.next={block:{type:'head_move_position',inputs:{POSITION:{block:{type:'typed_get_head_position',fields:{VAR:v('head','look_right')}}},DURATION:n(3)}}};
 const full=workspace([setter]);
 execute(generatePython(full,'test'),['on',[[1,2,15],3]]);
 const state=Blockly.serialization.workspaces.save(full);
 const source=generatePython(full,'test');
 Blockly.serialization.workspaces.load(state,full);
 assert.equal(generatePython(full,'test'),source);
 full.dispose();
});
test('both arms accept reusable seven-angle positions in SDK joint order',()=>{
 for(const arm of ['l_arm','r_arm']) {
  const angles=[1,2,3,-90,5,6,7];
  const w=workspace([{type:'typed_set_arm_position',fields:{VAR:v('arm',arm+'_position')},inputs:{VALUE:{block:{type:'arm_position',inputs:Object.fromEntries(angles.map((value,i)=>['J'+i,n(value)]))}}},next:{block:{type:'arm_move_position',fields:{ARM:arm},inputs:{POSITION:{block:{type:'typed_get_arm_position',fields:{VAR:v('arm',arm+'_position')}}},DURATION:n(2)}}}}]);
  const code=generatePython(w,'test');
  assert.ok(code.includes(`bob.move_arm(reachy.${arm},`));
  execute(code,['on',[angles,2]]);
  w.dispose();
 }
});
test('position values work as lists but reject the wrong movement type',()=>{
 const w=new Blockly.Workspace();
 const head=w.newBlock('head_position');
 const arm=w.newBlock('arm_position');
 const move=w.newBlock('head_move_position');
 const loop=w.newBlock('reachy_for_each');
 const setter=w.newBlock('typed_set_arm_position');
 assert.equal(w.connectionChecker.canConnect(move.getInput('POSITION').connection,head.outputConnection,false),true);
 assert.equal(w.connectionChecker.canConnect(move.getInput('POSITION').connection,arm.outputConnection,false),false);
 assert.equal(w.connectionChecker.canConnect(loop.getInput('LIST').connection,head.outputConnection,false),true);
 assert.equal(w.connectionChecker.canConnect(setter.getInput('VALUE').connection,arm.outputConnection,false),true);
 assert.equal(w.connectionChecker.canConnect(setter.getInput('VALUE').connection,head.outputConnection,false),false);
 w.dispose();
});
test('an unconnected position movement is valid Python and does not power motors',()=>{
 for(const type of ['head_move_position','arm_move_position']) {
  const w=workspace([{type}]);
  const code=generatePython(w,'test');
  execute(code,[]);
  assert.ok(!code.includes('.turn_on()'));
  w.dispose();
 }
});
