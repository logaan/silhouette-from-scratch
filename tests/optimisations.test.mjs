import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compileJob,OPTIMISATIONS,operationCount} from '../web/job.js';
import {parseDXF} from '../web/geometry.js';
import {previewSegments,optimisePaths} from '../web/order.js';
const preset={name:'Test',cut:{tool:1,force:15,speed:30,depth:4,passes:2},crease:{tool:2,force:33,speed:30,passes:3}};
const options={mat:'12x12',sheetWidth:300,sheetHeight:300,x:10,y:10,rotation:0,order:'crease-first'};
const flags=enabled=>Object.fromEntries(OPTIMISATIONS.map(k=>[k,enabled.includes(k)]));
const drawn=j=>previewSegments(j).filter(s=>!s.travel&&!s.bridge).map(s=>s.operation+':'+[s.from,s.to].map(p=>p.map(n=>Math.round(n*20)).join(',')).sort().join('|')).sort();
test('continuous crease passes use one move and preserve odd/even passes without altering cuts',()=>{
 for(const passes of [1,2,3,4])for(const points of [[[0,0],[10,0]],[[0,0],[10,0],[10,10],[0,0]]]){
  const drawing={paths:['cut','crease'].map(operation=>({operation,points})),counts:{ignored:0}},p={...preset,crease:{...preset.crease,passes}};
  const baseline=compileJob(drawing,{...options,optimisations:flags([])},p),joined=compileJob(drawing,{...options,optimisations:flags(['continuousCreases'])},p);
  assert.deepEqual(drawn(joined),drawn(baseline));const crease=joined.steps.filter(s=>s.label.startsWith('Crease '));assert.equal(crease.length,1);assert.equal(crease[0].commands.filter(c=>c.startsWith('M')).length,1);assert.equal(crease[0].commands.filter(c=>c.startsWith('D')).length,(points.length-1)*passes);
  assert.deepEqual(joined.steps.filter(s=>s.label.startsWith('Cut ')),baseline.steps.filter(s=>s.label.startsWith('Cut ')));assert.equal(operationCount(joined),3);
 }
});
test('touching-path joining and nearby ordering can be selected independently',()=>{
 const paths=[{operation:'cut',points:[[20,0],[10,0]]},{operation:'cut',points:[[0,0],[10,0]]},{operation:'cut',points:[[30,0],[40,0]]}];
 assert.deepEqual(optimisePaths(paths,{join:false,reorder:false}),paths);
 assert.equal(optimisePaths(paths,{join:true,reorder:false}).length,2);
 assert.equal(optimisePaths(paths,{join:false,reorder:true}).length,3);
 assert.deepEqual(optimisePaths(paths,{join:false,reorder:true})[0].points[0],[0,0]);
});
test('all option combinations preserve required box geometry and passes',()=>{
 const drawing=parseDXF(fs.readFileSync('test-files/foldover-8-compartment-box.dxf','utf8')),p={...preset,cut:{...preset.cut,passes:1},crease:{...preset.crease,passes:2}},o={...options,x:0,y:0};
 const original=compileJob(drawing,{...o,optimisations:flags([])},p),expected=drawn(original);assert.equal(operationCount(original),498);
 for(let bits=0;bits<2**OPTIMISATIONS.length;bits++){
  const optimisations=Object.fromEntries(OPTIMISATIONS.map((k,i)=>[k,!!(bits&(1<<i))])),job=compileJob(drawing,{...o,optimisations},p);
  assert.deepEqual(drawn(job),expected,JSON.stringify(optimisations));assert.equal(operationCount(job),job.steps.filter(s=>/^(Cut|Crease) /.test(s.label)).length);
  if(!optimisations.creaseBridges)assert.equal(job.bridges.length,0);
 }
 const all=compileJob(drawing,{...o,optimisations:flags(OPTIMISATIONS)},p);assert.equal(operationCount(all),50);assert.deepEqual(all.operations.map(o=>o.operationCount),[26,24]);
});
