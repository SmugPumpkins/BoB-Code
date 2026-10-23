import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {Blockly,generatePython} from '../src/blocks.js';
import {clampHeadTarget,headLimits} from '../src/head-limits.js';
const n=value=>({block:{type:'math_number',fields:{NUM:value}}});
function source(blocks) {
 const w=new Blockly.Workspace();Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks}},w);
 const code=generatePython(w,'test');w.dispose();return code;
}
function run(code,expected,extra='') {
 const harness=`import types,sys\nsys.path.insert(0, "public")\ncalls=[]\nclass Head:\n    on=False\n    def is_on(self): return self.on\n    def turn_on(self): self.on=True\n    def get_current_positions(self): return [0,-10,0]\n    def goto(self,target,duration,wait):\n        assert wait is True\n        calls.append(target)\nclass Robot:\n    def __init__(self,host): self.head=Head()\n    def is_connected(self): return True\n    def disconnect(self): pass\nmodule=types.ModuleType('reachy2_sdk')\nmodule.ReachySDK=Robot\nsys.modules['reachy2_sdk']=module\nexec(sys.stdin.read())\nexpected=${JSON.stringify(expected)}\nassert len(calls)==len(expected),calls\nfor actual,goal in zip(calls,expected):\n    assert all(abs(a-b)<1e-8 for a,b in zip(actual,goal)), calls\n${extra}\n`;
 const result=spawnSync('python',['-c',harness],{input:code,encoding:'utf8',timeout:5000});
 assert.equal(result.status,0,result.stderr);return result;
}
test('every head axis has inclusive -45 to 45 bounds',()=>{
 assert.deepEqual(headLimits,[[-45,45],[-45,45],[-45,45]]);
 assert.deepEqual(clampHeadTarget([-90,60,45]).target,[-45,45,45]);
 assert.equal(clampHeadTarget([-45,0,45]).warnings.length,0);
});
test('direct head targets clamp literals, warn, then continue',()=>{
 const code=source([{type:'head_goto',fields:{R:-60,P:80,Y:90},next:{block:{type:'head_goto'}}}]);
 assert.match(code,/bob.move_head\(reachy.head, \[-45, 45, 45\]/);
 const result=run(code,[[-45,45,45],[0,0,0]]);assert.match(result.stderr,/using 45/);
});
test('saved head positions clamp on use without overwriting the variable',()=>{
 const variable={name:'pose',type:'HeadPose'};
 const code=source([{type:'typed_set_head_position',fields:{VAR:variable},inputs:{VALUE:{block:{type:'head_position',inputs:{R:n(-100),P:n(0),Y:n(70)}}}},next:{block:{type:'head_move_position',inputs:{POSITION:{block:{type:'typed_get_head_position',fields:{VAR:variable}}},DURATION:n(2)}}}}]);
 run(code,[[-45,0,45]],'assert pose == [-100,0,70],pose');
});
test('relative head yaw composes rotations and clamps the final target',()=>{
 const result=run(source([{type:'head_rotate',fields:{Y:80}}]),[[0,-10,45]]);
 assert.match(result.stderr,/bounds -45 to 45/);
});
test('Cartesian look-at cannot bypass the bounds and does not stop following blocks',()=>{
 const code=source([{type:'head_look',next:{block:{type:'head_goto'}}}]);
 const result=run(code,[[0,0,0]]);assert.match(result.stderr,/look_at skipped/);
});
