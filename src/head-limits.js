export const headLimits=[[-45,45],[-45,45],[-45,45]];
export function clampHeadTarget(values) {
 const warnings=[];
 const target=values.map((value,i)=>{
  const corrected=Math.min(45,Math.max(-45,value));
  if(corrected!==value)warnings.push(`Head ${['roll','pitch','yaw'][i]}: ${value}° is outside -45° to 45°; using ${corrected}°.`);
  return corrected;
 });
 return {target,warnings};
}
export function addHeadLimitHelpers(generator) {
 generator.definitions_.bob_library='import bob_code as bob';
}
export function installHeadLimits(Blockly,generator) {
 generator.addReservedWords('bob');
 generator.forBlock.head_goto=(block,g)=>{
  addHeadLimitHelpers(g);
  const {target,warnings}=clampHeadTarget(['R','P','Y'].map(name=>Number(block.getFieldValue(name))));
  return warnings.map(message=>`bob.warn(${JSON.stringify('BoB: '+message)})\n`).join('')+`bob.move_head(reachy.head, [${target.join(', ')}], ${block.getFieldValue('D')})\n`;
 };
 generator.forBlock.head_move_position=(block,g)=>{
  const target=g.valueToCode(block,'POSITION',0);
  if(!target)return 'pass  # Connect a head position to this movement block.\n';
  addHeadLimitHelpers(g);
  return `bob.move_head(reachy.head, ${target}, ${g.valueToCode(block,'DURATION',0)||'2'})\n`;
 };
 generator.forBlock.head_rotate=(block,g)=>{
  addHeadLimitHelpers(g);
  return `bob.relative_head(reachy.head, [${['R','P','Y'].map(name=>block.getFieldValue(name)).join(', ')}], ${block.getFieldValue('D')})\n`;
 };
 // The SDK solves look_at angles remotely, so no pre-move bounded joint target is available.
 generator.forBlock.head_look=(block,g)=>{
  addHeadLimitHelpers(g);
  return 'bob.look_at_unavailable()\n';
 };
 for(const type of ['head_goto','head_move_position','head_rotate','head_look']) {
  const init=Blockly.Blocks[type].init;
  Blockly.Blocks[type].init=function() {
   init.call(this);
   this.setTooltip(type==='head_look'?'Cartesian look_at is skipped while custom head limits are enforced. Use move head to position for bounded angles.':`${this.tooltip} Head target angles are clamped to -45°…45° at movement time with a warning.`);
   if(type==='head_goto')this.setOnChange(()=>{
    if(this.isInFlyout||!this.workspace.rendered)return;
    const {warnings}=clampHeadTarget(['R','P','Y'].map(name=>Number(this.getFieldValue(name))));
    this.setWarningText(warnings.length?warnings.join('\n'):null,'bob-head-limits');
   });
  };
 }
}
