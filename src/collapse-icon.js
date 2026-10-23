import * as Blockly from 'blockly';

// A Blockly icon stays visible when its block's inputs are collapsed.
export class CollapseIcon extends Blockly.icons.Icon {
 static TYPE = new Blockly.icons.IconType('reachy-collapse');
 getType() { return CollapseIcon.TYPE; }
 getWeight() { return -10; }
 getSize() { return new Blockly.utils.Size(20, 20); }
 isShownWhenCollapsed() { return true; }
 isClickableInFlyout() { return false; }
 initView(listener) {
  if (this.svgRoot) return;
  super.initView(listener);
  this.svgRoot.classList.add('reachy-collapse-icon');
  this.svgRoot.setAttribute('role', 'button');
  this.svgRoot.setAttribute('tabindex', '0');
  Blockly.utils.dom.createSvgElement('rect', {width:20,height:20,rx:5,fill:'#ffffff', 'fill-opacity':'.2'}, this.svgRoot);
  this.chevron = Blockly.utils.dom.createSvgElement('path', {d:'M6 8 L10 12 L14 8',fill:'none',stroke:'#fff','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round'}, this.svgRoot);
  this.svgRoot.addEventListener('keydown', event => {
   if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault(); event.stopPropagation(); this.onClick();
   }
  });
  this.updateCollapsed();
 }
 updateCollapsed() {
  super.updateCollapsed();
  if (this.svgRoot) this.svgRoot.style.display = 'block';
  const collapsed = this.sourceBlock.isCollapsed();
  this.chevron?.setAttribute('transform', collapsed ? 'rotate(-90 10 10)' : '');
  this.svgRoot?.setAttribute('aria-expanded', String(!collapsed));
  this.svgRoot?.setAttribute('aria-label', collapsed ? 'Expand angle values' : 'Collapse angle values');
  this.setTooltip(collapsed ? 'Expand angle values' : 'Collapse angle values');
 }
 onClick() {
  if (this.sourceBlock.isInFlyout) return;
  this.sourceBlock.setCollapsed(!this.sourceBlock.isCollapsed());
 }
}
