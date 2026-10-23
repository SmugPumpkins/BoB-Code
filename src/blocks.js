import * as Blockly from 'blockly';
import { pythonGenerator, Order } from 'blockly/python';
import 'blockly/blocks';
import * as En from 'blockly/msg/en';
import { CollapseIcon } from './collapse-icon.js';
import { registerControlBlocks, selectionToolbox, iterationToolbox, listsToolbox } from './control-blocks.js';
import {palette} from './palette.js';
import {registerPositionBlocks,actuatorPositionContents} from './positions.js';
import {installArmLimits} from './arm-limits.js';
import {installJointHelp} from './joint-help.js';
import {installHeadLimits} from './head-limits.js';
import {registerPoseBlock} from './pose-editor.js';
Blockly.setLocale(En);
pythonGenerator.addReservedWords('reachy,time,bob,ReachySDK,ConnectionError');
registerControlBlocks();
export const colors = {...palette,arms:palette.actuators,head:palette.actuators,hands:palette.actuators,flow:palette.values};
const num = (name, value=0, min=-360, max=360) => ({type:'field_number',name,value,min,max});
const drop = (name, options) => ({type:'field_dropdown',name,options});
const arms = () => drop('ARM', [['right arm','r_arm'],['left arm','l_arm']]);
const duration = () => num('D',2,0.1,120);
const defs = [];
function block(type, message0, args0, group, tooltip, output=false) {
  defs.push({type,message0,args0,colour:colors[group],tooltip, ...(output?{output:null}:{previousStatement:null,nextStatement:null})});
}
block('robot_power','turn %1 motors %2',[drop('PART',[['all',''],['head','head'],['right arm','r_arm'],['left arm','l_arm'],['mobile base','mobile_base']]),drop('MODE',[['on','turn_on'],['off','turn_off']])],'setup','Enable motors before moving. Support the robot before turning motors off.');
block('robot_rest','turn off smoothly',[],'setup','Gradually release arm torque with turn_off_smoothly(). Support the robot.');
block('robot_posture','go to %1 posture in %2 s',[drop('POSE',[['default','default'],['elbows bent','elbow_90']]),duration()],'setup','Move to a named SDK posture and wait until complete.');
block('robot_cancel','cancel all movements',[],'setup','Cancel queued and active goto commands. This is not a hardware emergency stop.');
block('robot_connected','robot is connected',[],'setup','Read is_connected().',true);
block('head_goto','move head · roll %1 ° pitch %2 ° yaw %3 ° in %4 s',[num('R'),num('P'),num('Y'),duration()],'head','Head goto([roll, pitch, yaw]) in degrees. Waits until complete.');
block('head_look','look at x %1 y %2 z %3 m in %4 s',[num('X',0.5,-5,5),num('Y',0,-5,5),num('Z',0,-5,5),duration()],'head','Look at a point in the robot coordinate frame, in meters.');
block('head_rotate','rotate head · roll %1 ° pitch %2 ° yaw %3 ° in %4 s',[num('R'),num('P'),num('Y'),duration()],'head','Relative head rotation in degrees.');
block('arm_goto','move %1 · shoulder pitch %2 ° roll %3 ° %4 elbow yaw %5 ° pitch %6 ° %7 wrist roll %8 ° pitch %9 ° yaw %10 ° %11 in %12 s',[arms(),num('J0'),num('J1'),{type:'input_dummy'},num('J2'),num('J3',-90),{type:'input_dummy'},num('J4'),num('J5'),num('J6'),{type:'input_dummy'},duration()],'arms','Seven joint angles in SDK order. Check joint limits and clearance on your robot.');
block('arm_translate','translate %1 · x %2 y %3 z %4 m in %5 s',[arms(),num('X',0,-1,1),num('Y',0,-1,1),num('Z',0.05,-1,1),duration()],'arms','Translate the end effector relative to its current position in the robot frame.');
block('arm_rotate','rotate %1 · roll %2 ° pitch %3 ° yaw %4 ° in %5 s',[arms(),num('R'),num('P'),num('Y'),duration()],'arms','Rotate the end effector relative to its current orientation.');
block('arm_positions','%1 joint positions',[arms()],'arms','Read get_current_positions() in degrees.',true);
defs[defs.length-1].output=['ArmPose','Array'];
block('gripper_action','%1 gripper on %2',[drop('ACTION',[['open','open'],['close','close']]),arms()],'hands','Open or close a gripper. This command does not wait for completion.');
block('gripper_opening','set %1 gripper opening to %2 %',[arms(),num('OPEN',50,0,100)],'hands','Set opening percentage: 0 is closed and 100 is fully open.');
block('gripper_goto','move %1 gripper to %2 ° in %3 s',[arms(),num('ANGLE',30,-180,180),duration()],'hands','Move the gripper joint to an angle and wait until complete.');
block('base_goto','drive to x %1 y %2 m heading %3 °',[num('X',0,-10,10),num('Y',0,-10,10),num('THETA',0)],'base','Mobile base absolute target in odometry coordinates. Requires a mobile base.');
block('base_translate','drive by x %1 y %2 m',[num('X',0.1,-5,5),num('Y',0,-5,5)],'base','Translate relative to current mobile base position.');
block('base_rotate','turn base by %1 °',[num('THETA',30)],'base','Rotate mobile base relative to current heading.');
block('wait_seconds','wait %1 seconds',[num('SECONDS',1,0,3600)],'flow','Pause the Python program.');
// Keep the field names stable so existing saved projects retain their values.
export const angleBlockTypes = new Set();
function verticalFields(type, title, headerFields, rows) {
 angleBlockTypes.add(type);
 const definition = defs.find(def => def.type === type);
 const fields = new Map(definition.args0.filter(arg => arg.name).map(arg => [arg.name, arg]));
 const args = headerFields.map(name => fields.get(name));
 let message = title;
 args.push({type:'input_dummy'});
 message += ` %${args.length}`;
 rows.forEach(([label, name, unit], index) => {
  args.push(fields.get(name));
  message += ` ${label} %${args.length} ${unit}`;
  if (index < rows.length - 1) {
   args.push({type:'input_dummy'});
   message += ` %${args.length}`;
  }
 });
 Object.assign(definition, {message0:message, args0:args, inputsInline:false});
}
const rotationRows = [['roll','R','°'],['pitch','P','°'],['yaw','Y','°'],['duration','D','s']];
verticalFields('head_goto','move head',[],rotationRows);
verticalFields('head_rotate','rotate head',[],rotationRows);
verticalFields('arm_rotate','rotate %1',['ARM'],rotationRows);
verticalFields('arm_goto','move %1',['ARM'],[
 ['shoulder pitch','J0','°'],['shoulder roll','J1','°'],
 ['elbow yaw','J2','°'],['elbow pitch','J3','°'],
 ['wrist roll','J4','°'],['wrist pitch','J5','°'],['wrist yaw','J6','°'],
 ['duration','D','s'],
]);
verticalFields('gripper_goto','move %1 gripper',['ARM'],[['angle','ANGLE','°'],['duration','D','s']]);
verticalFields('base_goto','drive to',[],[['x','X','m'],['y','Y','m'],['heading','THETA','°']]);
verticalFields('base_rotate','turn base',[],[['angle','THETA','°']]);
// Retain requested arm values so the warning can explain each correction.
// Movement generators, rather than the field editor, enforce BoB's bounds.
for(const field of defs.find(def=>def.type==='arm_goto').args0) {
 if(/^J\d$/.test(field.name||'')) { delete field.min;delete field.max; }
}
Blockly.defineBlocksWithJsonArray(defs);
registerPositionBlocks();
angleBlockTypes.add('head_position');
angleBlockTypes.add('arm_position');
for (const type of angleBlockTypes) {
 const originalInit = Blockly.Blocks[type].init;
 Blockly.Blocks[type].init = function() {
  originalInit.call(this);
  if (this.workspace.rendered) this.addIcon(new CollapseIcon(this));
 };
}
const f=(b,n)=>b.getFieldValue(n);
const xyz=b=>`x=${f(b,'X')}, y=${f(b,'Y')}, z=${f(b,'Z')}`;
const angles=b=>`roll=${f(b,'R')}, pitch=${f(b,'P')}, yaw=${f(b,'Y')}`;
const motion=b=>`duration=${f(b,'D')}, wait=True`;
const arm=b=>`reachy.${f(b,'ARM')}`;
Object.assign(pythonGenerator.forBlock, {
 robot_power:b=>`reachy${f(b,'PART')?'.'+f(b,'PART'):''}.${f(b,'MODE')}()\n`,
 robot_rest:()=> 'reachy.turn_off_smoothly()\n',
 robot_posture:b=>`reachy.goto_posture(${JSON.stringify(f(b,'POSE'))}, ${motion(b)})\n`,
 robot_cancel:()=> 'reachy.cancel_all_goto()\n',
 robot_connected:()=>['reachy.is_connected()',Order.FUNCTION_CALL],
 head_goto:b=>`reachy.head.goto([${f(b,'R')}, ${f(b,'P')}, ${f(b,'Y')}], ${motion(b)})\n`,
 head_look:b=>`reachy.head.look_at(${xyz(b)}, ${motion(b)})\n`,
 head_rotate:b=>`reachy.head.rotate_by(${angles(b)}, ${motion(b)})\n`,
 arm_goto:b=>`${arm(b)}.goto([${Array.from({length:7},(_,i)=>f(b,'J'+i)).join(', ')}], ${motion(b)})\n`,
 arm_translate:b=>`${arm(b)}.translate_by(${xyz(b)}, ${motion(b)})\n`,
 arm_rotate:b=>`${arm(b)}.rotate_by(${angles(b)}, ${motion(b)})\n`,
 arm_positions:b=>[`${arm(b)}.get_current_positions()`,Order.FUNCTION_CALL],
 gripper_action:b=>`${arm(b)}.gripper.${f(b,'ACTION')}()\n`,
 gripper_opening:b=>`${arm(b)}.gripper.set_opening(${f(b,'OPEN')})\n`,
 gripper_goto:b=>`${arm(b)}.gripper.goto(${f(b,'ANGLE')}, ${motion(b)})\n`,
 base_goto:b=>`reachy.mobile_base.goto(x=${f(b,'X')}, y=${f(b,'Y')}, theta=${f(b,'THETA')}, wait=True)\n`,
 base_translate:b=>`reachy.mobile_base.translate_by(x=${f(b,'X')}, y=${f(b,'Y')}, wait=True)\n`,
 base_rotate:b=>`reachy.mobile_base.rotate_by(theta=${f(b,'THETA')}, wait=True)\n`,
 wait_seconds:b=>`time.sleep(${f(b,'SECONDS')})\n`,
});
installArmLimits(Blockly,pythonGenerator);
installHeadLimits(Blockly,pythonGenerator);
registerPoseBlock(Blockly,pythonGenerator);
installJointHelp(Blockly);
export const groups = [
 ['Setup','setup',['robot_power','robot_posture','robot_rest','robot_cancel','robot_connected']],
 ['Actuators','actuators',['head_position','arm_position','head_move_position','arm_move_position','set_pose','head_goto','head_look','head_rotate','head_positions','arm_goto','arm_translate','arm_rotate','arm_positions','gripper_action','gripper_opening','gripper_goto']],
 ['Mobile base','base',['base_goto','base_translate','base_rotate']],
 ['Logic','logic',['logic_compare','logic_operation','logic_negate','logic_boolean']],
 ['Values','values',['math_number','math_arithmetic','text','text_join','text_print','wait_seconds']],
];
export const toolbox = {kind:'categoryToolbox',contents:groups.map(([name,key,types])=>({kind:'category',name,colour:colors[key],contents:key==='actuators'?[...actuatorPositionContents,...types.slice(4).map(type=>({kind:'block',type}))]:types.map(type=>({kind:'block',type}))})).concat([selectionToolbox,iterationToolbox,listsToolbox,{kind:'category',name:'Variables',colour:palette.variables,custom:'REACHY_VARIABLES'},{kind:'category',name:'Functions',colour:palette.functions,custom:'PROCEDURE'}])};
export function generatePython(workspace, host) {
 const body=pythonGenerator.workspaceToCode(workspace);
 // Generator imports and variable declarations must remain at module scope.
 const lines=body.split('\n');
 const imports=lines.filter(l=>/^(from |import )/.test(l));
 const commands=lines.filter(l=>!/^(from |import )/.test(l)).join('\n').trim();
 return `# Created with BoB Blocks\n# Review movements and clear the robot's surroundings before running.\nfrom reachy2_sdk import ReachySDK\nimport time\n${imports.join('\n')}${imports.length?'\n':''}\nreachy = ReachySDK(host=${JSON.stringify(host)})\nif not reachy.is_connected():\n    raise ConnectionError("Could not connect to Reachy. Check the host and network.")\n\ntry:\n${commands?commands.split('\n').map(l=>'    '+l).join('\n'):'    pass'}\nfinally:\n    reachy.disconnect()\n`;
}
export { Blockly };
