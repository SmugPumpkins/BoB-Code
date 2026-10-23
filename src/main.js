import {Blockly, toolbox, generatePython, angleBlockTypes} from './blocks.js';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import './style.css';
import { shell } from './ui.js';
import { setupAppearance } from './appearance.js';
import { palette } from './palette.js';
import { typedVariablesFlyout } from './control-blocks.js';
import {setupJointHelp} from './joint-help.js';
import {setupPoseEditor} from './pose-editor.js';
import {pythonArchive} from './python-export.js';
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
hljs.registerLanguage('python', python);
const $=s=>document.querySelector(s);
$('#app').innerHTML = shell;
setupJointHelp();
const theme=Blockly.Theme.defineTheme('pollen',{base:Blockly.Themes.Classic,blockStyles:{logic_blocks:{colourPrimary:palette.logic},math_blocks:{colourPrimary:palette.values},text_blocks:{colourPrimary:palette.values},loop_blocks:{colourPrimary:palette.iteration},list_blocks:{colourPrimary:palette.lists},variable_blocks:{colourPrimary:palette.variables},procedure_blocks:{colourPrimary:palette.functions}},componentStyles:{workspaceBackgroundColour:'#fafbfd',toolboxBackgroundColour:'#fff',toolboxForegroundColour:'#253556',flyoutBackgroundColour:'#f0f4f8',flyoutForegroundColour:'#253556',flyoutOpacity:1,scrollbarColour:'#c4cedd',insertionMarkerColour:'#2E4686'},fontStyle:{family:'Poppins, sans-serif',size:11}});
const workspace=Blockly.inject('blockly',{toolbox,theme,collapse:true,renderer:'zelos',grid:{spacing:24,length:2,colour:'#dce3ec',snap:true},zoom:{controls:true,wheel:true,startScale:0.85,maxScale:1.5,minScale:0.4},trashcan:true,move:{scrollbars:true,drag:true,wheel:false}});
workspace.registerToolboxCategoryCallback('REACHY_VARIABLES', typedVariablesFlyout);
$('#create-pose').onclick=setupPoseEditor(workspace,Blockly);
setupAppearance(workspace, theme);
document.fonts.ready.then(() => {
 workspace.getAllBlocks(false).forEach(block => { block.markDirty(); block.render(); });
 Blockly.svgResize(workspace);
});
new ResizeObserver(()=>Blockly.svgResize(workspace)).observe($('#blockly'));
let code='', timer, loading=false;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('#toast').classList.remove('show'),3000);}
function project(){return {format:'reachy-blocks',version:1,name:$('#project-name').value,host:$('#host').value,workspace:Blockly.serialization.workspaces.save(workspace)};}
function update(){try{code=generatePython(workspace,$('#host').value);$('#code').innerHTML=hljs.highlight(code,{language:'python'}).value;$('#block-count').textContent=`${workspace.getAllBlocks(false).length} blocks`;if(!loading){try{localStorage.setItem('reachy-blocks-project',JSON.stringify(project()));$('#save-status').textContent='Saved on this device';}catch{$('#save-status').textContent='Use Save project to keep changes';}}}catch(e){toast('Could not generate Python: '+e.message);}}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function load(data){if(data.format!=='reachy-blocks'||data.version!==1||!data.workspace||typeof data.workspace!=='object')throw Error('Choose a BoB Blocks project file (version 1).');const previous=project();loading=true;try{Blockly.serialization.workspaces.load(data.workspace,workspace);$('#project-name').value=typeof data.name==='string'?data.name:'Untitled project';$('#host').value=typeof data.host==='string'?data.host:'192.168.1.10';}catch(e){Blockly.serialization.workspaces.load(previous.workspace,workspace);throw e;}finally{loading=false;}update();workspace.scrollCenter();}
const chain=items=>items.reduceRight((next,[type,fields])=>({block:{type,fields,...(next?{next}: {})}}),null).block;
function example(kind){const items=kind==='grip'?[['robot_power',{PART:'r_arm',MODE:'turn_on'}],['gripper_action',{ACTION:'open',ARM:'r_arm'}],['wait_seconds',{SECONDS:2}],['gripper_action',{ACTION:'close',ARM:'r_arm'}],['wait_seconds',{SECONDS:2}]]:[['robot_power',{PART:'head',MODE:'turn_on'}],['head_goto',{R:0,P:0,Y:20,D:2}],['wait_seconds',{SECONDS:1}],['head_goto',{R:0,P:0,Y:-20,D:2}],['head_goto',{R:0,P:0,Y:0,D:2}]];load({format:'reachy-blocks',version:1,name:kind==='grip'?'Open & close':kind==='blank'?'Untitled project':'Hello, BoB',host:$('#host').value,workspace:{blocks:{languageVersion:0,blocks:kind==='blank'?[]:[{...chain(items),x:40,y:40}]}}});}
workspace.addChangeListener(e=>{if(!e.isUiEvent)update();});
$('#host').addEventListener('input',update);$('#project-name').addEventListener('input',update);
$('#undo').onclick=()=>workspace.undo(false);$('#redo').onclick=()=>workspace.undo(true);$('#fit').onclick=()=>workspace.zoomToFit();
const collapseButton = $('#collapse-angles');
collapseButton.textContent = 'Collapse angles';
collapseButton.title = 'Collapse or expand all angle blocks. Click a block’s arrow to toggle it individually.';
const angleBlocks = () => workspace.getAllBlocks(false).filter(block => angleBlockTypes.has(block.type));
function updateCollapseButton() {
 const blocks = angleBlocks();
 const collapsed = blocks.length > 0 && blocks.every(block => block.isCollapsed());
 collapseButton.textContent = collapsed ? 'Expand angles' : 'Collapse angles';
 collapseButton.disabled = blocks.length === 0;
}
collapseButton.onclick = () => {
 const blocks = angleBlocks();
 const collapse = blocks.some(block => !block.isCollapsed());
 Blockly.Events.setGroup(true);
 try { blocks.forEach(block => block.setCollapsed(collapse)); }
 finally { Blockly.Events.setGroup(false); }
 updateCollapseButton();
};
workspace.addChangeListener(updateCollapseButton);
updateCollapseButton();
$('#save').onclick=()=>download(JSON.stringify(project(),null,2),($('#project-name').value||'project').replace(/[^a-z0-9_-]/gi,'_')+'.json','application/json');
$('#export').onclick=async()=>{
 const button=$('#export');button.disabled=true;
 try {
  const program=generatePython(workspace,$('#host').value);
  const response=await fetch(import.meta.env.BASE_URL+'bob_code.py');
  if(!response.ok)throw Error('Library unavailable');
  const library=await response.text();
  if(!library.includes('def move_head(')||!library.includes('def set_pose('))throw Error('Invalid library response');
  download(pythonArchive(program,library),'bob_program.zip','application/zip');
  toast('Python exported: extract the ZIP, then run code.py.');
 } catch {toast('Could not export Python. Please try again; both code and the library are required.');}
 finally {button.disabled=false;}
};
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(code);toast('Python copied to clipboard');}catch{toast('Clipboard unavailable. Use Export Python instead.');}};
$('#open').onclick=()=>$('#file').click();$('#file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2e6)throw Error('Project file must be smaller than 2 MB.');const data=JSON.parse(await file.text());if(confirm('Replace the current workspace with this project?')){load(data);toast('Project opened');}}catch(err){toast(err.message);}finally{e.target.value='';}};
$('#clear').onclick=()=>{if(confirm('Clear all blocks? You can undo this action.'))workspace.clear();};
document.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{if(workspace.getAllBlocks(false).length&&!confirm('Replace your current workspace with this starter? Save your project first to keep it.'))return;example(b.dataset.example);});
$('#help').onclick=()=>$('#guide').showModal();$('#close-guide').onclick=()=>$('#guide').close();
try{const saved=localStorage.getItem('reachy-blocks-project');if(saved)load(JSON.parse(saved));else example('hello');}catch{example('hello');toast('Saved project could not be restored. Open a project backup if available.');}
update();

$('#export-menu').onclick = () => $('#export').click();
const menus = [...document.querySelectorAll('.menu')];
menus.forEach(menu => menu.addEventListener('toggle', () => {
 if (menu.open) menus.filter(other => other !== menu).forEach(other => { other.open = false; });
}));
document.addEventListener('click', event => {
 menus.forEach(menu => {
  if (!menu.contains(event.target) || event.target.closest('.menu-popover button')) menu.open = false;
 });
});
document.addEventListener('keydown', event => {
 if (event.key === 'Escape') menus.forEach(menu => {
  if (menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
 });
});
let previewVisible = true;
try { previewVisible = localStorage.getItem('reachy-blocks-preview-visible') !== 'false'; } catch {}
function setPreviewVisible(visible) {
 previewVisible = visible;
 document.documentElement.dataset.preview = visible ? 'open' : 'closed';
 $('#python-preview').hidden = !visible;
 $('#toggle-preview').textContent = visible ? 'Hide Python' : 'Show Python';
 $('#toggle-preview').setAttribute('aria-expanded',String(visible));
 $('#toggle-preview-menu').textContent = visible ? 'Hide Python preview' : 'Show Python preview';
 if (!visible) showPanel('blocks');
 try { localStorage.setItem('reachy-blocks-preview-visible',String(visible)); } catch {}
 requestAnimationFrame(() => Blockly.svgResize(workspace));
}
function showPanel(panel) {
 if (panel === 'python' && !previewVisible) setPreviewVisible(true);
 document.documentElement.dataset.panel = panel;
 $('#show-blocks').setAttribute('aria-pressed',String(panel === 'blocks'));
 $('#show-python').setAttribute('aria-pressed',String(panel === 'python'));
 if (panel === 'blocks') Blockly.svgResize(workspace);
}
$('#show-blocks').onclick = () => showPanel('blocks');
$('#show-python').onclick = () => showPanel('python');
showPanel('blocks');

$('#toggle-preview').onclick = () => setPreviewVisible(!previewVisible);
$('#toggle-preview-menu').onclick = () => setPreviewVisible(!previewVisible);
$('#close-preview').onclick = () => {
 setPreviewVisible(false);
 if (window.matchMedia('(max-width: 760px)').matches) $('#show-blocks').focus();
 else $('#toggle-preview').focus();
};
setPreviewVisible(previewVisible);
