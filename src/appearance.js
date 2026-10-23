import { Blockly } from './blocks.js';

export function setupAppearance(workspace, lightTheme) {
 const $ = selector => document.querySelector(selector);
 const system = window.matchMedia('(prefers-color-scheme: dark)');
 const darkTheme = Blockly.Theme.defineTheme('pollen-dark', {
  base:lightTheme,
  componentStyles:{workspaceBackgroundColour:'#171d2b',toolboxBackgroundColour:'#202839',toolboxForegroundColour:'#dbe4f2',flyoutBackgroundColour:'#283347',flyoutForegroundColour:'#dbe4f2',flyoutOpacity:1,scrollbarColour:'#63718a',insertionMarkerColour:'#3CB1CF',cursorColour:'#FEC260'},
 });
 let saved = {};
 try { saved = JSON.parse(localStorage.getItem('reachy-blocks-appearance') || '{}') || {}; } catch {}
 const themes = ['auto','github','github-dark','dracula','monokai'];
 // Appearance overrides last only until reload; every load follows the OS.
 let manualDark = null;
 $('#code-theme').value = themes.includes(saved.codeTheme) ? saved.codeTheme : 'auto';
 function apply() {
  const dark = manualDark ?? system.matches;
  $('#appearance-toggle').setAttribute('aria-checked', String(dark));
  document.documentElement.dataset.appearance = dark ? 'dark' : 'light';
  const codeTheme = $('#code-theme').value;
  document.documentElement.dataset.codeTheme = codeTheme === 'auto' ? (dark ? 'github-dark' : 'github') : codeTheme;
  $('#theme-label').textContent = codeTheme === 'auto' ? 'PYTHON' : $('#code-theme').selectedOptions[0].textContent;
  workspace.setTheme(dark ? darkTheme : lightTheme);
 }
 function save() {
  apply();
  try { localStorage.setItem('reachy-blocks-appearance', JSON.stringify({codeTheme:$('#code-theme').value})); } catch {}
 }
 $('#appearance-toggle').addEventListener('click', () => {
  manualDark = !(manualDark ?? system.matches);
  apply();
 });
 $('#code-theme').addEventListener('change',save);
 system.addEventListener('change',apply);
 apply();
}
