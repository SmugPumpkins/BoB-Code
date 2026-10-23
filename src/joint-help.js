import {armLimits,jointNames} from './arm-limits.js';
import {rotationAxis} from './joint-scene.js';
import {renderJointScene3d,resetSceneView} from './joint-scene-3d.js';
import {headLimits} from './head-limits.js';

const directions={
 r_arm:[['Forward','Reverse'],['Outwards','Inwards'],['Outwards','Inwards'],['Close','Open'],['Outwards','Inwards'],['Forwards','Reverse'],['Outwards','Inwards']],
 l_arm:[['Forward','Confirm sign: notes list negative for both directions'],['Inwards','Outwards'],['Inwards','Outwards'],['Close','Open'],['Inwards','Outwards'],['Reverse','Forwards'],['Inwards','Outwards']],
};
const idle={r_arm:[[-45,0],[-40,-10],[0,30],[-70,-5],[-15,15],[-15,15],[-360,360]],l_arm:[[-45,0],[10,40],[-30,0],[-70,-5],[-15,15],[-15,15],[-360,360]]};
let showHelp=()=>{};
const questionImage='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7.5" fill="white" fill-opacity=".2" stroke="white"/><path d="M7 6.5a2 2 0 0 1 4 0c0 1.5-2 1.5-2 3" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/><circle cx="9" cy="12.5" r=".8" fill="white"/></svg>');
export function installJointHelp(Blockly) {
 class HelpField extends Blockly.FieldImage {
  constructor(label,onClick) { super(questionImage,18,18,'?',onClick); this.label=label; this.activate=onClick; }
  getText() { return ''; }
  isClickableInFlyout() { return true; }
  initView() {
   super.initView();
   const root=this.getSvgRoot();
   root.setAttribute('role','button');root.setAttribute('tabindex','0');root.setAttribute('aria-label',this.label);
   root.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' ') { event.preventDefault();event.stopPropagation();this.activate(); }
   });
  }
 }
 const attach=(type,fields,part)=>{
  const originalInit=Blockly.Blocks[type].init;
  Blockly.Blocks[type].init=function() {
   originalInit.call(this);
   for(const [index,name] of fields.entries()) {
    const input=this.getInput(name)||this.inputList.find(input=>input.fieldRow.some(field=>field.name===name));
    if(!input)continue;
    const field=new HelpField(`Explain ${part==='arm'?jointNames[index]:'head '+['roll','pitch','yaw'][index]}`,()=>showHelp({part,index,name,side:this.getFieldValue('ARM')||'r_arm'}));
    input.appendField(field,`HELP_${name}`);
   }
  };
 };
 attach('arm_goto',['J0','J1','J2','J3','J4','J5','J6'],'arm');
 attach('arm_position',['J0','J1','J2','J3','J4','J5','J6'],'arm');
 for(const type of ['head_goto','head_rotate','head_position'])attach(type,['R','P','Y'],'head');
}

export function setupJointHelp() {
 const dialog=document.createElement('dialog');
 dialog.id='joint-help';
 dialog.setAttribute('aria-labelledby','joint-help-title');
 dialog.innerHTML=`<button id="close-joint-help" class="dialog-close" aria-label="Close joint help">×</button><div class="eyebrow">GET TO KNOW BoB</div><h2 id="joint-help-title"></h2><label class="joint-side-label">Arm <select id="joint-side"><option value="r_arm">Right arm</option><option value="l_arm">Left arm</option></select></label><div class="joint-directions"><p><b>Negative (−)</b><span id="negative-direction"></span></p><p><b>Positive (+)</b><span id="positive-direction"></span></p></div><p id="joint-bounds"></p><p id="joint-idle"></p><div class="joint-scene"><svg viewBox="0 0 360 300" role="img" aria-label="Isometric upper-body model, Z up"></svg></div><button id="joint-reset-view">Reset view</button><div class="joint-animation-controls"><button id="joint-play">Pause animation</button><label>Angle <input id="joint-angle" type="range" min="-60" max="60" value="0" step="1"></label></div><p class="joint-note">One shared upper-body model. Parent joint: yellow; child joint: green. Roll rotates about X, pitch about Y, and yaw about Z (right-hand rule), with Z up. Arm links align along Z at zero. Geometry is illustrative; direction notes describe BoB. Target bounds do not check collisions.</p>`;
 document.body.append(dialog);
 let info,frame=0,playing=false,phase=0,lastTime=0;
 const $=selector=>dialog.querySelector(selector);
 function draw(value) {
  const name=info.part==='arm'?jointNames[info.index]:['roll','pitch','yaw'][info.index];
  renderJointScene3d($('.joint-scene svg'),rotationAxis(name),value,{...info,side:$('#joint-side').value});
 }
 function animate(time) {
  if(!playing||!dialog.open)return;
  if(lastTime)phase+=(time-lastTime)/1400;
  lastTime=time;
  const slider=$('#joint-angle');
  const low=Math.max(-60,Number(slider.min)),high=Math.min(60,Number(slider.max));
  const value=low+(Math.sin(phase)+1)/2*(high-low);
  slider.value=String(Math.round(value));draw(value);
  frame=requestAnimationFrame(animate);
 }
 function play(value) {
  cancelAnimationFrame(frame);playing=value;lastTime=0;
  $('#joint-play').textContent=value?'Pause animation':'Play animation';
  if(value)frame=requestAnimationFrame(animate);
 }
 function update() {
  const side=$('#joint-side').value;
  const isArm=info.part==='arm';
  $('.joint-side-label').hidden=!isArm;
  $('#joint-help-title').textContent=isArm?jointNames[info.index]:`Head ${['roll','pitch','yaw'][info.index]}`;
  const labels=isArm?directions[side][info.index]:['Negative rotation about the '+['forward (x)','left (y)','up (z)'][info.index]+' axis.','Positive rotation about the '+['forward (x)','left (y)','up (z)'][info.index]+' axis (right-hand rule).'];
  $('#negative-direction').textContent=labels[0];$('#positive-direction').textContent=labels[1];
  const bounds=isArm?armLimits[side][info.index]:headLimits[info.index];
  $('#joint-bounds').textContent=`Your target bounds: ${bounds[0]}° to ${bounds[1]}°. Movement values outside this interval are clamped with a warning.`;
  $('#joint-idle').textContent=isArm?`Your idle range: ${idle[side][info.index][0]}° to ${idle[side][info.index][1]}°. This is guidance, not a clamp.`:'';
  $('#joint-angle').min=String(bounds[0]);$('#joint-angle').max=String(bounds[1]);
  phase=0;$('#joint-angle').value='0';draw(0);
 }
 showHelp=data=>{
  info=data;$('#joint-side').value=data.side;update();
  if(!dialog.open)dialog.showModal();
  draw(Number($('#joint-angle').value));
  play(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 };
 $('#joint-reset-view').onclick=()=>resetSceneView($('.joint-scene svg'));
 $('#joint-side').onchange=update;
 $('#joint-play').onclick=()=>play(!playing);
 $('#joint-angle').oninput=event=>{play(false);draw(Number(event.target.value));};
 $('#close-joint-help').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>play(false));
 new ResizeObserver(()=>{if(dialog.open)draw(Number($('#joint-angle').value));}).observe($('.joint-scene'));
}
