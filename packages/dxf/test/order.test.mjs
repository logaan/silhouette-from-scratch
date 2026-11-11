import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseDXF} from '@cut-and-crease/dxf';
import {optimisePaths,previewSegments} from '@cut-and-crease/dxf';
import {compileJob} from '@cut-and-crease/dxf';
const path=(points,operation='cut')=>({points,operation});
const edges=paths=>paths.flatMap(p=>p.points.slice(1).map((b,i)=>[p.points[i],b].map(pt=>pt.map(n=>Math.round(n*20)).join(',')).sort().join('|'))).sort();
test('joins reversed touching paths without bridging gaps or mixing tools',()=>{
 const p=[path([[0,0],[1,0]]),path([[2,0],[1,0]]),path([[3,0],[4,0]]),path([[2,0],[3,0]],'crease')];
 const before=structuredClone(p),result=optimisePaths(p);
 assert.equal(result.length,3);assert.deepEqual(edges(result),edges(p));assert.deepEqual(p,before);
});
test('nearby geometry is not skipped for a distant collinear continuation',()=>{
 const p=[path([[0,0],[10,0]]),path([[10,1],[10,2]]),path([[20,0],[30,0]])];
 assert.deepEqual(optimisePaths(p)[1].points,[[10,1],[10,2]]);
});
test('box optimisation preserves every machine segment and reduces separate paths',()=>{
 const drawing=parseDXF(fs.readFileSync(new URL('../../../test-files/foldover-8-compartment-box.dxf',import.meta.url),'utf8'));
 for(const operation of ['cut','crease']){const p=drawing.paths.filter(p=>p.operation===operation),out=optimisePaths(p);assert.deepEqual(edges(out),edges(p));assert(out.length<p.length);}
 const preset={name:'Test',cut:{tool:1,force:15,speed:30,depth:4,passes:1},crease:{tool:2,force:33,speed:30,passes:2}};
 const options={mat:'12x12',sheetWidth:300,sheetHeight:300,x:0,y:0,rotation:0,order:'crease-first'};
 const original=compileJob(drawing,options,preset),optimised=compileJob(drawing,{...options,optimise:true},preset);
 const drawn=job=>previewSegments(job).filter(s=>!s.travel).map(s=>path([s.from,s.to]));
 assert.deepEqual(edges(drawn(original)),edges(drawn(optimised)));
 assert(optimised.steps.length<original.steps.length);
 assert.deepEqual(optimised.operations.map(o=>o.operation),['crease','cut']);
 assert.deepEqual(previewSegments(optimised).at(-1).to,[0,0]);
});
test('nearby horizontal continuation receives a bounded preference',()=>{
 const p=[path([[0,0],[10,0]]),path([[10,2],[10,3]]),path([[13,0],[16,0]])];
 assert.deepEqual(optimisePaths(p)[1].points,[[13,0],[16,0]]);
});
test('first path starts nearest the top-left even when distant collinear groups exist',()=>{
 const p=[path([[20,20],[30,20]]),path([[40,20],[50,20]]),path([[8,9],[2,3]])];
 assert.deepEqual(optimisePaths(p)[0].points,[[2,3],[8,9]]);
});
test('closed paths start at their nearest vertex without changing their edges',()=>{
 const p=[path([[20,20],[5,20],[5,5],[20,5],[20,20]])];
 const result=optimisePaths(p);assert.deepEqual(result[0].points[0],[5,5]);assert.deepEqual(edges(result),edges(p));
});
test('closed paths choose the nearest entry from the current endpoint',()=>{
 const p=[path([[1,1],[19,19]]),path([[5,5],[20,5],[20,20],[5,20],[5,5]])];
 const result=optimisePaths(p);assert.deepEqual(result[1].points[0],[20,20]);assert.deepEqual(edges(result),edges(p));
});
test('open paths can reverse to start at their nearer endpoint',()=>{
 const p=[path([[1,1],[30,30]]),path([[60,60],[31,30]])];
 assert.deepEqual(optimisePaths(p)[1].points,[[31,30],[60,60]]);
});
test('route accounts for the final endpoint after reversed repeat passes',()=>{
 const p=[path([[1,1],[20,1]]),path([[2,2],[3,2]]),path([[21,2],[22,2]])];
 assert.deepEqual(optimisePaths(p,{passes:2})[1].points[0],[2,2]);
 assert.deepEqual(optimisePaths(p,{passes:1})[1].points[0],[21,2]);
});
test('optimised repeated passes reverse direction and preserve original ordering when disabled',()=>{
 const drawing={paths:[path([[0,0],[10,0]],'crease')],counts:{cut:0,crease:1,ignored:0}};
 const preset={name:'Test',cut:{tool:1,force:15,speed:30,depth:4,passes:1},crease:{tool:2,force:33,speed:30,passes:2}};
 const options={mat:'12x12',sheetWidth:300,sheetHeight:300,x:10,y:10,rotation:0,order:'crease-first'};
 const job=compileJob(drawing,{...options,optimise:true},preset),passes=job.steps.filter(s=>s.label.startsWith('Crease '));
 assert.equal(passes[0].commands.at(-1).slice(1),passes[1].commands[0].slice(1));
 const original=compileJob(drawing,{...options,optimise:false},preset).steps.filter(s=>s.label.startsWith('Crease '));assert.deepEqual(original[0].commands,original[1].commands);
});
test('tool changes order from the final transmitted endpoint for either order and repeat direction',()=>{
 const preset={name:'Test',cut:{tool:1,force:15,speed:30,depth:4,passes:1},crease:{tool:2,force:33,speed:30,passes:1}};
 for(const order of ['crease-first','cut-first'])for(const passes of [1,2,3])for(const continuousCreases of [false,true])for(const reversePasses of [false,true]){
  const first=order==='crease-first'?'crease':'cut',second=first==='cut'?'crease':'cut';
  const drawing={paths:[path([[0,0],[80,80]],first),path([[1,0],[2,0]],second),path([[82,80],[81,80]],second)],counts:{ignored:0}};
  const options={mat:'12x12',sheetWidth:300,sheetHeight:300,x:10,y:10,rotation:0,order,optimisations:{reorder:true,reversePasses,continuousCreases}};
  const settings={...preset,[first]:{...preset[first],passes}},job=compileJob(drawing,options,settings),segments=previewSegments(job);
  const firstSegments=segments.filter(s=>s.operation===first&&!s.travel),end=firstSegments.at(-1).to;
  const next=segments.find(s=>s.operation===second&&s.travel);
  assert.deepEqual(next.from,end);
  const returns=(reversePasses||(first==='crease'&&continuousCreases))&&passes%2===0;
  assert.deepEqual(next.to,returns?[11,10]:[91,90]);
  assert.deepEqual(job.paths[0].points[0],[10,10]);
  const original=compileJob(drawing,{...options,optimisations:{...options.optimisations,reorder:false}},settings);
  assert.deepEqual(original.paths.filter(p=>p.operation===second)[0].points[0],[11,10]);
 }
});
test('closed paths use the nearest vertex from an explicit starting position',()=>{
 const paths=[path([[0,0],[10,0],[10,10],[0,10],[0,0]])];
 assert.deepEqual(optimisePaths(paths,{start:[11,11]})[0].points[0],[10,10]);
});
