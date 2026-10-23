export const armLimits = {
 r_arm:[[-360,360],[-165,20],[-360,360],[-125,0],[-15,15],[-15,15],[-360,360]],
 l_arm:[[-360,360],[-20,165],[-360,360],[-125,0],[-15,15],[-15,15],[-360,360]],
};
export const jointNames=['shoulder pitch','shoulder roll','elbow yaw','elbow pitch','wrist roll','wrist pitch','wrist yaw'];
export function clampArmTarget(values,side) {
 const warnings=[];
 const target=values.map((value,index)=>{
  const [low,high]=armLimits[side][index];
  const corrected=Math.min(high,Math.max(low,value));
  if(corrected!==value) warnings.push(`${side==='r_arm'?'Right':'Left'} arm ${jointNames[index]}: ${value}° is outside ${low}° to ${high}°; using ${corrected}°.`);
  return corrected;
 });
 return {target,warnings};
}
export function addArmLimitHelpers(generator) {
 generator.definitions_.bob_library='import bob_code as bob';
}
export function installArmLimits(Blockly,generator) {
 generator.addReservedWords('bob');
 generator.forBlock.arm_goto=(block,g)=>{
  addArmLimitHelpers(g);
  const side=block.getFieldValue('ARM');
  const {target,warnings}=clampArmTarget(Array.from({length:7},(_,i)=>Number(block.getFieldValue('J'+i))),side);
  const notices=warnings.map(message=>`bob.warn(${JSON.stringify('BoB: '+message)})\n`).join('');
  return `${notices}bob.move_arm(reachy.${side}, ${JSON.stringify(side)}, [${target.join(', ')}], ${block.getFieldValue('D')})\n`;
 };
 generator.forBlock.arm_move_position=(block,g)=>{
  const target=g.valueToCode(block,'POSITION',0);
  if(!target) return 'pass  # Connect an arm position to this movement block.\n';
  addArmLimitHelpers(g);
  const side=block.getFieldValue('ARM');
  return `bob.move_arm(reachy.${side}, ${JSON.stringify(side)}, ${target}, ${g.valueToCode(block,'DURATION',0)||'2'})\n`;
 };
 for(const [type,parameter,fields] of [['arm_translate','translation',['X','Y','Z']],['arm_rotate','rotation',['R','P','Y']]]) {
  generator.forBlock[type]=(block,g)=>{
   addArmLimitHelpers(g);
   const side=block.getFieldValue('ARM');
   return `bob.relative_arm(reachy.${side}, ${JSON.stringify(side)}, ${block.getFieldValue('D')}, ${parameter}=[${fields.map(name=>block.getFieldValue(name)).join(', ')}])\n`;
  };
 }
 generator.forBlock.robot_posture=(block,g)=>{
  addArmLimitHelpers(g);
  return `bob.goto_posture(reachy, ${JSON.stringify(block.getFieldValue('POSE'))}, ${block.getFieldValue('D')})\n`;
 };
 const originalInit=Blockly.Blocks.arm_goto.init;
 Blockly.Blocks.arm_goto.init=function() {
  originalInit.call(this);
  this.setOnChange(()=>{
   if(this.isInFlyout||!this.workspace.rendered)return;
   const {warnings}=clampArmTarget(Array.from({length:7},(_,i)=>Number(this.getFieldValue('J'+i))),this.getFieldValue('ARM'));
   this.setWarningText(warnings.length?warnings.join('\n'):null,'bob-limits');
  });
 };
 for(const type of ['arm_goto','arm_move_position','arm_translate','arm_rotate','robot_posture']) {
  const init=Blockly.Blocks[type].init;
  Blockly.Blocks[type].init=function() {
   init.call(this);
   this.setTooltip(`${this.tooltip} BoB's supplied arm joint target bounds are applied during movement; out-of-range values are clamped with a nonfatal warning. These bounds do not check collisions.`);
  };
 }
}
