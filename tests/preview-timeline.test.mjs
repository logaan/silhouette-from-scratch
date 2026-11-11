import test from 'node:test';
import assert from 'node:assert/strict';
import {PreviewTimeline} from '../web/preview-timeline.js';
const segments=[{from:[0,0],to:[3,0],stepIndex:1},{from:[3,0],to:[3,4],stepIndex:1},{from:[3,4],to:[6,4],stepIndex:2},{from:[6,4],to:[6,0],stepIndex:2}];
test('preview steps whole operations in either direction and clamps at either end',()=>{
 const t=new PreviewTimeline(segments);t.step(-1);assert.equal(t.position,0);t.step(1);assert.equal(t.position,7);t.step(1);assert.equal(t.position,14);t.step(1);assert.equal(t.position,14);t.step(-1);assert.equal(t.position,7);t.seek(9);t.step(-1);assert.equal(t.position,7);t.step(-1);assert.equal(t.position,0);
});
test('seeking and rewinding interpolate the same geometry without mutating it',()=>{
 const before=structuredClone(segments),t=new PreviewTimeline(segments);assert.deepEqual(t.seek(5).point,[3,2]);assert.deepEqual(t.advance(7).point,[6,2]);assert.deepEqual(t.advance(-7).point,[3,2]);assert.deepEqual(t.seek(0).point,[0,0]);assert.deepEqual(segments,before);
});
test('empty and zero-length previews remain finite',()=>{
 const empty=new PreviewTimeline([]);assert.equal(empty.step(1).index,-1);
 const zero=new PreviewTimeline([{from:[0,0],to:[0,0],stepIndex:1}]);assert.deepEqual(zero.advance(100).point,[0,0]);assert.equal(zero.position,0);
});
