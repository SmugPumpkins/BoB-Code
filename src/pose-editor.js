import {defaultPose} from './joint-scene.js';
import {renderJointScene3d,resetSceneView} from './joint-scene-3d.js';
import {armLimits,jointNames} from './arm-limits.js';
import {palette} from './palette.js';

let openEditor=()=>{};
export function validPose(pose) {
 return pose&&['head','r_arm','l_arm'].every(part=>Array.isArray(pose[part])&&pose[part].length===(part==='head'?3:7)&&pose[part].every((v,i)=>typeof v==='number'&&Number.isFinite(v)&&v>=(part==='head'?-45:armLimits[part][i][0])&&v<=(part==='head'?45:armLimits[part][i][1])));
}
export function registerPoseBlock(Blockly,generator) {
 class EditPoseField extends Blockly.FieldImage {
  constructor(callback) {
   super('data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="108" height="26"><rect x="1" y="1" width="106" height="24" rx="6" fill="white" fill-opacity=".22" stroke="white"/><path d="m13 17 2-6 5 5-7 1m3-7 3-3 5 5-3 3" fill="none" stroke="white" stroke-width="1.4"/><text x="33" y="17" font-family="sans-serif" font-size="12" fill="white">Edit pose</text></svg>'),108,26,'Edit pose',callback);
   this.activate=callback;
  }
  initView() {
   super.initView();const root=this.getSvgRoot();root.setAttribute('role','button');root.setAttribute('tabindex','0');root.setAttribute('aria-label','Edit whole-body pose');
   root.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();this.activate();}});
  }
 }
 Blockly.Blocks.set_pose={init(){
  this.appendDummyInput().appendField('set pose').appendField(new EditPoseField(()=>openEditor(this))).appendField(new Blockly.FieldLabelSerializable(JSON.stringify(defaultPose())),'POSE');
  this.getField('POSE').setVisible(false);
  this.appendDummyInput().appendField('duration per part').appendField(new Blockly.FieldNumber(2,.1,120),'D').appendField('s');
  this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(palette.actuators);
  this.setTooltip('Design head and both arms visually. Exported Python moves head, right arm, then left arm, waiting for each. The preview is schematic and does not check collisions.');
 }};
 generator.forBlock.set_pose=(block,g)=>{
  let pose;try{pose=JSON.parse(block.getFieldValue('POSE'));}catch{}
  if(!validPose(pose))throw Error('Invalid whole-body pose. Open Edit pose and save valid values.');
  g.definitions_.bob_library='import bob_code as bob';
  return `bob.set_pose(reachy, head=${JSON.stringify(pose.head)}, right_arm=${JSON.stringify(pose.r_arm)}, left_arm=${JSON.stringify(pose.l_arm)}, duration=${block.getFieldValue('D')})\n`;
 };
}

export function setupPoseEditor(workspace,Blockly) {
 const dialog=document.createElement('dialog');dialog.id='pose-editor';dialog.setAttribute('aria-labelledby','pose-title');
 dialog.innerHTML=`<button class="dialog-close" aria-label="Cancel pose editing">×</button><div class="eyebrow">MAKE A LITTLE MOVEMENT</div><h2 id="pose-title">Build a pose</h2><p class="pose-intro">Shape the head and both arms. Save it as one block.</p><div class="pose-layout"><div class="pose-visual"><div class="joint-scene"><svg viewBox="0 0 360 300" role="img" aria-label="Whole-body pose"></svg></div><button class="reset-camera">Reset view</button><p class="joint-note">Drag to orbit · scroll to zoom.<br>Schematic preview, not a robot simulator or collision check.</p></div><div class="pose-sliders"></div></div><p class="pose-status" role="status"></p><p class="joint-note">When run, this block moves the head, right arm, then left arm. Duration applies to each part. Collision rejection requires a calibrated model in bob_code.</p><div class="pose-actions"><button class="reset-pose">Reset pose</button><button class="cancel-pose">Cancel</button><button class="primary save-pose">Save pose block</button></div>`;
 document.body.append(dialog);
 let target,draft,activePart='head';
 const $=s=>dialog.querySelector(s),svg=$('.joint-scene svg');
 function draw(){if(!draft)return;const supported=renderJointScene3d(svg,'x',0,{part:'head',index:0},draft);$('.pose-status').textContent=supported?'':'Interactive 3D is unavailable in this browser. Values can still be edited and saved; the fallback image does not show this pose.';}
 function rows(){
  $('.pose-sliders').replaceChildren();
  const tabs=document.createElement('div');tabs.className='pose-part-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Pose body part');$('.pose-sliders').append(tabs);
  for(const [part,title] of [['head','Head'],['r_arm','Right arm'],['l_arm','Left arm']]) {
   const group=document.createElement('fieldset');const legend=document.createElement('legend');legend.textContent=title;group.append(legend);
   group.hidden=part!==activePart;
   const tab=document.createElement('button');tab.textContent=title;tab.setAttribute('aria-pressed',String(part===activePart));tab.onclick=()=>{activePart=part;rows();};tabs.append(tab);
   const names=part==='head'?['roll','pitch','yaw']:jointNames;
   names.forEach((name,index)=>{
    const bounds=part==='head'?[-45,45]:armLimits[part][index];
    const label=document.createElement('label');label.className='pose-slider';
    const caption=document.createElement('span');caption.textContent=name;
    const slider=document.createElement('input');slider.type='range';slider.min=bounds[0];slider.max=bounds[1];slider.step='any';slider.value=draft[part][index];slider.setAttribute('aria-label',`${title} ${name}`);
    const number=document.createElement('input');number.type='number';number.min=bounds[0];number.max=bounds[1];number.step='any';number.value=draft[part][index];number.setAttribute('aria-label',`${title} ${name} degrees`);
    const unit=document.createElement('span');unit.textContent='°';
    const update=value=>{const valid=value!==''&&Number.isFinite(Number(value))&&Number(value)>=bounds[0]&&Number(value)<=bounds[1];number.setCustomValidity(valid?'':`Use ${bounds[0]} to ${bounds[1]} degrees`);if(valid){draft[part][index]=Number(value);slider.value=value;number.value=value;draw();}};
    slider.oninput=()=>update(slider.value);number.oninput=()=>update(number.value);
    label.append(caption,slider,number,unit);group.append(label);
   });
   $('.pose-sliders').append(group);
  }
 }
 openEditor=block=>{
  target=block;let saved;
  try{saved=JSON.parse(block?.getFieldValue('POSE'));}catch{}
  draft=validPose(saved)?structuredClone(saved):defaultPose();rows();dialog.showModal();draw();
 };
 $('.reset-camera').onclick=()=>resetSceneView(svg);
 $('.reset-pose').onclick=()=>{draft=defaultPose();rows();draw();};
 $('.dialog-close').onclick=$('.cancel-pose').onclick=()=>dialog.close();
 $('.save-pose').onclick=()=>{
  const invalid=[...dialog.querySelectorAll('input')].find(input=>!input.checkValidity());
  if(invalid){invalid.reportValidity();return;}
  Blockly.Events.setGroup(true);
  try {
   if(!target||target.isDisposed()) {target=workspace.newBlock('set_pose');target.initSvg();target.render();target.moveBy(50,50);}
   target.setFieldValue(JSON.stringify(draft),'POSE');
  } finally {Blockly.Events.setGroup(false);}
  dialog.close();
 };
 new ResizeObserver(()=>{if(dialog.open)draw();}).observe($('.joint-scene'));
 return ()=>openEditor(null);
}
