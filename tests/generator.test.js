import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { Blockly, groups, generatePython } from '../src/blocks.js';

test('every Reachy block serializes and generates valid Python',()=>{
 const workspace=new Blockly.Workspace();
 for(const [, ,types] of groups) for(const type of types){
  if(!type.includes('_')||type.startsWith('controls_')||type.startsWith('logic_')||type.startsWith('math_')||type==='text_print')continue;
  const block=workspace.newBlock(type);
  const source=generatePython(workspace,'192.168.1.10');
  const check=spawnSync('python',['-c','import ast,sys; ast.parse(sys.stdin.read())'],{input:source,encoding:'utf8'});
  assert.equal(check.status,0,`${type}: ${check.stderr}`);
  const state=Blockly.serialization.workspaces.save(workspace);
  Blockly.serialization.workspaces.load(state,workspace);
  assert.equal(generatePython(workspace,'192.168.1.10'),source);
  workspace.clear();
 }
 workspace.dispose();
});
test('motion uses SDK joint order and blocking commands',()=>{
 const w=new Blockly.Workspace(); const b=w.newBlock('arm_goto');
 [1,2,3,4,5,6,7].forEach((v,i)=>b.setFieldValue(v,'J'+i));
 b.setFieldValue('l_arm','ARM');
 assert.match(generatePython(w,'reachy.local'),/bob.move_arm\(reachy\.l_arm, "l_arm", \[1, 2, 3, 0, 5, 6, 7\], 2\)/);
 w.dispose();
});
test('host text is safely quoted and cleanup always disconnects',()=>{
 const w=new Blockly.Workspace();
 const code=generatePython(w,'robot\"\\\nprint(123)');
 const check=spawnSync('python',['-c','import ast,sys; ast.parse(sys.stdin.read())'],{input:code,encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
 assert.match(code,/finally:\n    reachy.disconnect\(\)/);
 w.dispose();
});
test('connected blocks execute in order, repeat correctly, and disconnect on failure',()=>{
 const w=new Blockly.Workspace();
 Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks:[{type:'robot_power',fields:{PART:'head',MODE:'turn_on'},next:{block:{type:'controls_repeat_ext',inputs:{TIMES:{block:{type:'math_number',fields:{NUM:2}}},DO:{block:{type:'head_goto',fields:{Y:15,D:1}}}},next:{block:{type:'robot_rest'}}}}}]}},w);
 const source=generatePython(w,'test-host');
 const harness=`import sys, types\nsys.path.insert(0, "public")\ncalls = []\nclass Part:\n    on = False\n    def is_on(self): return self.on\n    def turn_on(self):\n        self.on = True\n        calls.append('on')\n    def goto(self, target, duration, wait):\n        assert target == [0, 0, 15] and duration == 1 and wait is True\n        calls.append('goto')\nclass Robot:\n    def __init__(self, host):\n        assert host == 'test-host'\n        self.head = Part()\n    def is_connected(self): return True\n    def turn_off_smoothly(self): raise RuntimeError('test failure')\n    def disconnect(self): calls.append('disconnect')\nmodule = types.ModuleType('reachy2_sdk')\nmodule.ReachySDK = Robot\nsys.modules['reachy2_sdk'] = module\ntry:\n    exec(sys.stdin.read())\nexcept RuntimeError:\n    pass\nassert calls == ['on', 'goto', 'goto', 'disconnect'], calls\n`;
 const result=spawnSync('python',['-c',harness],{input:source,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 w.dispose();
});
test('all head and arm motion blocks enable only their own part; readouts do not',()=>{
 const w=new Blockly.Workspace();
 for (const type of ['head_goto','head_rotate','arm_goto','arm_translate','arm_rotate']) {
  const b=w.newBlock(type);
  if(type.startsWith('arm_')) b.setFieldValue('l_arm','ARM');
  const source=generatePython(w,'test-host');
  const part=type.startsWith('head_')?'head':'l_arm';
  assert.ok(source.includes('import bob_code as bob'),type);
  assert.ok(source.includes(`bob.${type==='head_goto'?'move_head':type==='head_rotate'?'relative_head':type==='arm_goto'?'move_arm':'relative_arm'}(reachy.${part},`),type);
  assert.ok(!source.includes('reachy.turn_on()'),type);
  assert.ok(!source.includes('reachy.r_arm.turn_on()'),type);
  w.clear();
 }
 w.newBlock('arm_positions');
 assert.ok(!generatePython(w,'test-host').includes('.turn_on()'));
 w.dispose();
});
test('auto power respects skipped branches and re-enables motors after turn-off in loops',()=>{
 const w=new Blockly.Workspace();
 Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks:[{
  type:'controls_if',inputs:{IF0:{block:{type:'logic_boolean',fields:{BOOL:'FALSE'}}},DO0:{block:{type:'arm_goto',fields:{ARM:'l_arm'}}}},
  next:{block:{type:'controls_repeat_ext',inputs:{TIMES:{block:{type:'math_number',fields:{NUM:2}}},DO:{block:{type:'head_goto',next:{block:{type:'robot_power',fields:{PART:'head',MODE:'turn_off'}}}}}}}},
 }]}},w);
 const source=generatePython(w,'test-host');
 const harness=`import sys, types\nsys.path.insert(0, "public")\ncalls=[]\nclass Part:\n    def __init__(self, name): self.name, self.on = name, False\n    def is_on(self): return self.on\n    def turn_on(self):\n        self.on=True\n        calls.append(self.name + ':on')\n    def turn_off(self):\n        self.on=False\n        calls.append(self.name + ':off')\n    def goto(self, *args, **kwargs):\n        assert self.on\n        calls.append(self.name + ':goto')\nclass Robot:\n    def __init__(self, host):\n        self.head=Part('head')\n        self.l_arm=Part('left')\n    def is_connected(self): return True\n    def disconnect(self): calls.append('disconnect')\nmodule=types.ModuleType('reachy2_sdk')\nmodule.ReachySDK=Robot\nsys.modules['reachy2_sdk']=module\nexec(sys.stdin.read())\nassert calls == ['head:on','head:goto','head:off','head:on','head:goto','head:off','disconnect'], calls\n`;
 const result=spawnSync('python',['-c',harness],{input:source,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 w.dispose();
});
