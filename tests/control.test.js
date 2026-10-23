import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {Blockly, generatePython} from '../src/blocks.js';
import {variableTypes, selectionToolbox, typedVariablesFlyout} from '../src/control-blocks.js';

const num = value => ({type:'math_number',fields:{NUM:value}});
const text = value => ({type:'text',fields:{TEXT:value}});
const input = block => ({block});
function load(blocks) {
 const w=new Blockly.Workspace();
 Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks}},w);
 return w;
}
function run(source) {
 const harness=`import sys,types\nsys.path.insert(0, "public")\nclass Robot:\n    def __init__(self,host): pass\n    def is_connected(self): return True\n    def disconnect(self): pass\nmodule=types.ModuleType('reachy2_sdk')\nmodule.ReachySDK=Robot\nsys.modules['reachy2_sdk']=module\nexec(sys.stdin.read())\n`;
 const result=spawnSync('python',['-c',harness],{input:source,encoding:'utf8',timeout:5000});
 assert.equal(result.status,0,result.stderr);
 return result.stdout.replace(/\r\n/g,'\n').trim();
}
test('selection presets arrive with if, if/else and if/elif branches',()=>{
 const presets=selectionToolbox.contents.filter(item=>item.type==='controls_if');
 assert.equal(presets.length,3);
 for(const [index,preset] of presets.entries()) {
  const {kind,...state}=preset;
  const w=load([state]);
  const b=w.getTopBlocks()[0];
  assert.equal(Boolean(b.getInput('ELSE')),index===1);
  assert.equal(Boolean(b.getInput('IF1')),index===2);
  run(generatePython(w,'test'));
  w.dispose();
 }
});
test('typed variables constrain inputs, annotate Python and survive serialization',()=>{
 const w=new Blockly.Workspace();
 for(const type of variableTypes) {
  const setter=w.newBlock(`typed_set_${type.key}`);
  const getter=w.newBlock(`typed_get_${type.key}`);
  assert.deepEqual(setter.getInput('VALUE').connection.getCheck(),[type.check]);
  assert.deepEqual(getter.outputConnection.getCheck(),type.output||[type.check]);
 }
 const source=generatePython(w,'test');
 for(const type of variableTypes) assert.ok(source.includes(`: ${type.hint}`));
 run(source);
 const state=Blockly.serialization.workspaces.save(w);
 Blockly.serialization.workspaces.load(state,w);
 assert.equal(generatePython(w,'test'),source);
 assert.ok(typedVariablesFlyout(w).some(item=>item.fields?.VAR?.type==='Number'));
 const setter=w.getAllBlocks().find(b=>b.type==='typed_set_number');
 const string=w.newBlock('text');
 assert.equal(w.connectionChecker.canConnect(setter.getInput('VALUE').connection,string.outputConnection,false),false);
 w.dispose();
});
test('range exposes i and uses exclusive stop with positive and negative steps',()=>{
 for(const [start,stop,step,expected] of [[0,3,1,'0\n1\n2'],[3,0,-1,'3\n2\n1']]) {
  const w=load([{type:'reachy_for_range',fields:{VAR:{name:'i',type:'Number'}},inputs:{
   START:input(num(start)),STOP:input(num(stop)),STEP:input(num(step)),
   DO:input({type:'text_print',inputs:{TEXT:input({type:'typed_get_number',fields:{VAR:{name:'i',type:'Number'}}})}}),
  }}]);
  assert.equal(run(generatePython(w,'test')),expected);
  w.dispose();
 }
});
test('typed list is reusable by a for-item loop and item can be read in the body',()=>{
 const w=load([{type:'typed_set_list',fields:{VAR:{name:'items',type:'Array'}},inputs:{VALUE:input({type:'lists_create_with',extraState:{itemCount:2},inputs:{ADD0:input(text('hello')),ADD1:input(text('Reachy'))}})},next:{block:{type:'reachy_for_each',fields:{VAR:{name:'item',type:''}},inputs:{
  LIST:input({type:'typed_get_list',fields:{VAR:{name:'items',type:'Array'}}}),
  DO:input({type:'text_print',inputs:{TEXT:input({type:'variables_get',fields:{VAR:{name:'item',type:''}}})}}),
 }}}}]);
 assert.equal(run(generatePython(w,'test')),'hello\nReachy');
 w.dispose();
});
test('while rechecks a typed boolean changed in its body',()=>{
 const variable={name:'ready',type:'Boolean'};
 const w=load([{type:'typed_set_boolean',fields:{VAR:variable},inputs:{VALUE:input({type:'logic_boolean',fields:{BOOL:'TRUE'}})},next:{block:{type:'reachy_while',inputs:{BOOL:input({type:'typed_get_boolean',fields:{VAR:variable}}),DO:input({type:'typed_set_boolean',fields:{VAR:variable},inputs:{VALUE:input({type:'logic_boolean',fields:{BOOL:'FALSE'}})}})}}}}]);
 const source=generatePython(w,'test');
 assert.match(source,/while ready:/);
 run(source);
 w.dispose();
});
test('typed assignment in a function produces valid global annotations',()=>{
 const w=load([{type:'procedures_defnoreturn',fields:{NAME:'set_number'},inputs:{STACK:input({type:'typed_set_number',inputs:{VALUE:input(num(12))}})}}]);
 run(generatePython(w,'test'));
 w.dispose();
});
