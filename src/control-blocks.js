import * as Blockly from 'blockly';
import { pythonGenerator, Order } from 'blockly/python';
import {palette} from './palette.js';
import {headPositionShadow,armPositionShadow} from './positions.js';

export const variableTypes = [
 {key:'number',check:'Number',hint:'int | float',name:'number',fallback:'0',shadow:{type:'math_number',fields:{NUM:0}}},
 {key:'string',check:'String',hint:'str',name:'message',fallback:"''",shadow:{type:'text',fields:{TEXT:'Hello'}}},
 {key:'boolean',check:'Boolean',hint:'bool',name:'ready',fallback:'False',shadow:{type:'logic_boolean',fields:{BOOL:'TRUE'}}},
 {key:'list',check:'Array',hint:'list',name:'items',fallback:'[]',shadow:{type:'lists_create_with',extraState:{itemCount:0}}},
 {key:'head_position',label:'head position',check:'HeadPose',output:['HeadPose','Array'],hint:'list[float]',name:'head_position',fallback:'[0, 0, 0]',shadow:headPositionShadow},
 {key:'arm_position',label:'arm position',check:'ArmPose',output:['ArmPose','Array'],hint:'list[float]',name:'arm_position',fallback:'[0, 0, 0, -90, 0, 0, 0]',shadow:armPositionShadow},
];
const variableField = (name,type) => ({type:'field_variable',name:'VAR',variable:name,variableTypes:[type],defaultType:type});
export function registerControlBlocks() {
 pythonGenerator.addReservedWords('range,list,str,bool,int,float');
 const ifInit=Blockly.Blocks.controls_if.init;
 Blockly.Blocks.controls_if.init=function() { ifInit.call(this); this.setColour(palette.selection); };
 for(const type of variableTypes) {
  const label=type.label||type.key;
  Blockly.defineBlocksWithJsonArray([
   {type:`typed_set_${type.key}`,message0:`set %1 : ${label} to %2`,args0:[variableField(type.name,type.check),{type:'input_value',name:'VALUE',check:type.check}],previousStatement:null,nextStatement:null,colour:palette.variables,tooltip:`Assign a ${label} variable without moving the robot. Emits the Python type hint ${type.hint}. Type hints do not perform runtime validation.`},
   {type:`typed_get_${type.key}`,message0:`%1 : ${label}`,args0:[variableField(type.name,type.check)],output:type.output||type.check,colour:palette.variables,tooltip:`Use this ${label} variable in a compatible input. Assign a value before reading it.`},
  ]);
  const declare = (block,generator) => {
   const id=block.getFieldValue('VAR');
   const name=generator.getVariableName(id);
   // Declare hints at module scope so assignments inside functions remain valid
   // alongside Blockly's generated global declarations.
   generator.definitions_[`reachy_type_${id}`]=`${name}: ${type.hint}`;
   return name;
  };
  pythonGenerator.forBlock[`typed_set_${type.key}`]=(block,generator)=>`${declare(block,generator)} = ${generator.valueToCode(block,'VALUE',Order.NONE)||type.fallback}\n`;
  pythonGenerator.forBlock[`typed_get_${type.key}`]=(block,generator)=>[declare(block,generator),Order.ATOMIC];
 }
 Blockly.defineBlocksWithJsonArray([{
  type:'reachy_for_range',message0:'for %1 in range %2 start %3 stop (exclusive) %4 step %5',
  args0:[variableField('i','Number'),{type:'input_dummy'},{type:'input_value',name:'START',check:'Number'},{type:'input_value',name:'STOP',check:'Number'},{type:'input_value',name:'STEP',check:'Number'}],
  message1:'do %1',args1:[{type:'input_statement',name:'DO'}],previousStatement:null,nextStatement:null,inputsInline:false,colour:palette.iteration,
  tooltip:'Python range(start, stop, step): start is included and stop is excluded. Use integers and a nonzero step; a negative step counts down. Use the number getter in Variables to read i in the loop.',
 },{
  type:'reachy_while',message0:'while %1',args0:[{type:'input_value',name:'BOOL',check:'Boolean'}],
  message1:'do %1',args1:[{type:'input_statement',name:'DO'}],previousStatement:null,nextStatement:null,colour:palette.iteration,
  tooltip:'Repeat while the condition is true. Update the condition inside the loop so it can finish.',
 },{
  type:'reachy_for_each',message0:'for %1 in list %2',args0:[variableField('item',''),{type:'input_value',name:'LIST',check:'Array'}],
  message1:'do %1',args1:[{type:'input_statement',name:'DO'}],previousStatement:null,nextStatement:null,colour:palette.iteration,
  tooltip:'Run the body once for every item in the list. Read item from Variables → Your variables & loop items. Item can hold any element type.',
 }]);
 pythonGenerator.forBlock.reachy_for_range=(block,generator)=>{
  const name=generator.getVariableName(block.getFieldValue('VAR'));
  const start=generator.valueToCode(block,'START',Order.NONE)||'0';
  const stop=generator.valueToCode(block,'STOP',Order.NONE)||'0';
  const step=generator.valueToCode(block,'STEP',Order.NONE)||'1';
  const body=generator.statementToCode(block,'DO')||generator.PASS;
  return `for ${name} in range(${start}, ${stop}, ${step}):\n${body}`;
 };
 pythonGenerator.forBlock.reachy_while=(block,generator)=>`while ${generator.valueToCode(block,'BOOL',Order.NONE)||'False'}:\n${generator.statementToCode(block,'DO')||generator.PASS}`;
 pythonGenerator.forBlock.reachy_for_each=(block,generator)=>`for ${generator.getVariableName(block.getFieldValue('VAR'))} in ${generator.valueToCode(block,'LIST',Order.NONE)||'[]'}:\n${generator.statementToCode(block,'DO')||generator.PASS}`;
}

export function typedVariablesFlyout(workspace) {
 const contents=[];
 for(const type of variableTypes) {
  const label=type.label||type.key;
  contents.push({kind:'label',text:`${label[0].toUpperCase()+label.slice(1)} variables`});
  contents.push({kind:'block',type:`typed_set_${type.key}`,...(!type.key.endsWith('_position')?{inputs:{VALUE:{shadow:type.shadow}}}:{})});
  contents.push({kind:'block',type:`typed_get_${type.key}`});
 }
 const variables=workspace.getVariableMap().getAllVariables();
 if(variables.length) contents.push({kind:'label',text:'Your variables & loop items'});
 for(const variable of variables) {
  const type=variableTypes.find(type=>type.check===variable.getType());
  contents.push({kind:'block',type:type?`typed_get_${type.key}`:'variables_get',fields:{VAR:{id:variable.getId(),name:variable.getName(),type:variable.getType()}}});
 }
 contents.push({kind:'label',text:'Use the variable dropdown to create or rename.'});
 return contents;
}

const number = value => ({shadow:{type:'math_number',fields:{NUM:value}}});
const bool = value => ({shadow:{type:'logic_boolean',fields:{BOOL:value?'TRUE':'FALSE'}}});
export const selectionToolbox = {kind:'category',name:'Selection',colour:palette.selection,contents:[
 {kind:'block',type:'controls_if',inputs:{IF0:bool(true)}},
 {kind:'block',type:'controls_if',extraState:{hasElse:true},inputs:{IF0:bool(true)}},
 {kind:'block',type:'controls_if',extraState:{elseIfCount:1},inputs:{IF0:bool(true),IF1:bool(false)}},
]};
export const iterationToolbox = {kind:'category',name:'Iteration',colour:palette.iteration,contents:[
 {kind:'block',type:'controls_repeat_ext',inputs:{TIMES:number(3)}},
 {kind:'block',type:'reachy_for_range',inputs:{START:number(0),STOP:number(10),STEP:number(1)}},
 {kind:'block',type:'reachy_while',inputs:{BOOL:bool(false)}},
 {kind:'block',type:'reachy_for_each',inputs:{LIST:{block:{type:'lists_create_with',extraState:{itemCount:0}}}}},
]};
export const listsToolbox = {kind:'category',name:'Lists',colour:palette.lists,contents:[
 {kind:'block',type:'lists_create_with',extraState:{itemCount:0}},
 {kind:'block',type:'lists_create_with',extraState:{itemCount:3}},
 ...['lists_repeat','lists_length','lists_isEmpty','lists_getIndex','lists_setIndex','lists_indexOf'].map(type=>({kind:'block',type})),
]};
