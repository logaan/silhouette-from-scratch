import test from 'node:test';
import assert from 'node:assert/strict';
import {compileJob} from '../web/job.js';
import {operationBatch} from '../web/operation-batch.js';
const drawing={paths:[{operation:'cut',points:[[0,0],[10,0]]}],counts:{ignored:0}},preset={name:'Test',cut:{tool:1,force:15,speed:30,depth:4,passes:1},crease:{tool:2,force:33,speed:30,passes:2}};
test('tracking matches the captured feed sequence and stays separate from tool motion',()=>{
 for(const mat of ['12x12','12x24']){
  const job=compileJob(drawing,{mat,sheetWidth:300,sheetHeight:300,x:10,y:10,rotation:0,order:'crease-first',prepareTracking:true},preset);
  assert.deepEqual(job.steps[0].commands.slice(1),['FN0','TB50,0','FM0','TR0,1','FY0','FU5596']);assert(job.steps[0].wait);assert(job.steps[1].wait);assert.equal(job.steps[1].commands[0],'FY1');assert.equal(job.preparation.feedMm,279.8);
  assert.deepEqual(operationBatch(job,0,256).indices,[0]);assert.deepEqual(operationBatch(job,1,256).indices,[1]);assert(!job.steps[0].commands.some(c=>/^[MD]/.test(c)));
 }
});
test('disabling tracking omits feed motion and explicitly disables enhancement',()=>{
 const job=compileJob(drawing,{mat:'12x12',sheetWidth:300,sheetHeight:300,x:10,y:10,rotation:0,order:'crease-first',prepareTracking:false},preset);
 assert(!job.steps.some(s=>s.commands.some(c=>c.startsWith('FU')||c==='FY0')));assert(job.steps[0].commands.includes('FY1'));assert.equal(job.preparation.feedMm,0);
});
