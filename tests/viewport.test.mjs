import test from 'node:test';import assert from 'node:assert/strict';
import {panView,zoomView} from '../web/viewport.js';
const base={x:-18,y:-18,width:340.8,height:340.8};
test('trackpad pan converts screen pixels into mat coordinates',()=>{const v=panView(base,40,-20,681.6,681.6);assert.equal(v.x,2);assert.equal(v.y,-28);assert.equal(v.width,base.width);});
test('pinch zoom preserves the point under the cursor',()=>{const anchor={x:50,y:100},v=zoomView(base,base,-20,anchor);assert(v.width<base.width);assert(Math.abs((anchor.x-v.x)/v.width-(anchor.x-base.x)/base.width)<1e-12);assert(Math.abs((anchor.y-v.y)/v.height-(anchor.y-base.y)/base.height)<1e-12);});
test('zoom stays bounded without altering drawing dimensions',()=>{let v={...base};for(let i=0;i<100;i++)v=zoomView(v,base,-100,{x:0,y:0});assert.equal(v.width,base.width/8);for(let i=0;i<100;i++)v=zoomView(v,base,100,{x:0,y:0});assert.equal(v.width,base.width*4);});
