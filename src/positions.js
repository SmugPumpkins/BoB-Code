import * as Blockly from 'blockly';
import {pythonGenerator, Order} from 'blockly/python';
import {palette} from './palette.js';

export const headJoints=[['roll','R',0],['pitch','P',0],['yaw','Y',0]];
export const armJoints=[['shoulder pitch','J0',0],['shoulder roll','J1',0],['elbow yaw','J2',0],['elbow pitch','J3',-90],['wrist roll','J4',0],['wrist pitch','J5',0],['wrist yaw','J6',0]];
const numeric = value => ({shadow:{type:'math_number',fields:{NUM:value}}});
export const positionInputs = joints => Object.fromEntries(joints.map(([,name,value])=>[name,numeric(value)]));
export const headPositionShadow = {type:'head_position',inputs:positionInputs(headJoints)};
export const armPositionShadow = {type:'arm_position',inputs:positionInputs(armJoints)};

export function registerPositionBlocks() {
 for(const [part,type,joints] of [['head','HeadPose',headJoints],['arm','ArmPose',armJoints]]) {
  const args=[{type:'input_dummy'}];
  let message=`${part} position (degrees) %1`;
  for(const [label,name] of joints) {
   args.push({type:'input_value',name,check:'Number',align:'RIGHT'});
   message+=` ${label} %${args.length}`;
  }
  Blockly.defineBlocksWithJsonArray([{
   type:`${part}_position`,message0:message,args0:args,output:[type,'Array'],inputsInline:false,colour:palette.actuators,
   tooltip:`Build a ${joints.length}-angle ${part} position list without moving the robot. Plug numbers, variables, or arithmetic into each angle. Store it in a ${part} position variable or pass it to move ${part} to position.`,
  }]);
  pythonGenerator.forBlock[`${part}_position`]=(block,generator)=>[
   `[${joints.map(([,name,value])=>generator.valueToCode(block,name,Order.NONE)||String(value)).join(', ')}]`,Order.ATOMIC,
  ];
 }
 Blockly.defineBlocksWithJsonArray([
  {type:'head_move_position',message0:'move head to position %1 duration (s) %2',args0:[{type:'input_value',name:'POSITION',check:'HeadPose'},{type:'input_value',name:'DURATION',check:'Number'}],previousStatement:null,nextStatement:null,inputsInline:false,colour:palette.actuators,tooltip:'Move to a saved or calculated head position [roll, pitch, yaw] in degrees. Duration must be positive. Enables the head if needed and waits until complete.'},
  {type:'arm_move_position',message0:'move %1 to position %2 duration (s) %3',args0:[{type:'field_dropdown',name:'ARM',options:[['right arm','r_arm'],['left arm','l_arm']]},{type:'input_value',name:'POSITION',check:'ArmPose'},{type:'input_value',name:'DURATION',check:'Number'}],previousStatement:null,nextStatement:null,inputsInline:false,colour:palette.actuators,tooltip:'Move to a saved or calculated seven-joint arm position in degrees. Duration must be positive. Enables this arm if needed and waits until complete.'},
  {type:'head_positions',message0:'current head position',output:['HeadPose','Array'],colour:palette.actuators,tooltip:'Read head angles [roll, pitch, yaw] in degrees without moving or enabling motors.'},
 ]);
 pythonGenerator.forBlock.head_positions=()=>['reachy.head.get_current_positions()',Order.FUNCTION_CALL];
 for(const part of ['head','arm']) {
  pythonGenerator.forBlock[`${part}_move_position`]=(block,generator)=>{
   const target=generator.valueToCode(block,'POSITION',Order.NONE);
   if(!target) return `pass  # Connect a ${part} position to this movement block.\n`;
   const destination=part==='head'?'reachy.head':`reachy.${block.getFieldValue('ARM')}`;
   const duration=generator.valueToCode(block,'DURATION',Order.NONE)||'2';
   return `${destination}.goto(${target}, duration=${duration}, wait=True)\n`;
  };
 }
}

const poseVariable=(type,name,check,get=false)=>({kind:'block',type:`typed_${get?'get':'set'}_${type}_position`,fields:{VAR:{name,type:check}}});
export const actuatorPositionContents = [
 {kind:'label',text:'Position Values'},
 {kind:'block',type:'head_position',inputs:positionInputs(headJoints)},
 {kind:'block',type:'arm_position',inputs:positionInputs(armJoints)},
 {kind:'label',text:'Position Variables'},
 ...[['head','head_position','HeadPose'],['arm','right_arm_position','ArmPose'],['arm','left_arm_position','ArmPose']].flatMap(([type,name,check])=>[poseVariable(type,name,check),poseVariable(type,name,check,true)]),
 {kind:'label',text:'Movement'},
 {kind:'block',type:'head_move_position',inputs:{DURATION:numeric(2)}},
 {kind:'block',type:'arm_move_position',inputs:{DURATION:numeric(2)}},
];
