import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseDXF} from '../web/geometry.js';
import {optimisePaths,previewSegments} from '../web/order.js';
import {compileJob} from '../web/job.js';
const path=(points,operation='cut')=>({points,operation});
const edges=paths=>paths.flatMap(p=>p.points.slice(1).map((b,i)=>[p.points[i],b].map(pt=>pt.map(n=>Math.round(n*20)).join(',')).sort().join('|'))).sort();
test('joins reversed touching paths without bridging gaps or mixing tools',()=>{
 const p=[path([[0,0],[1,0]]),path([[2,0],[1,0]]),path([[3,0],[4,0]]),path([[2,0],[3,0]],'crease')];
 const before=structuredClone(p),result=optimisePaths(p);
 assert.equal(result.length,3);assert.deepEqual(edges(result),edges(p));assert.deepEqual(p,before);
});
test('collinear horizontal continuation takes priority over nearby disconnected geometry',()=>{
 const p=[path([[0,0],[10,0]]),path([[10,1],[10,2]]),path([[20,0],[30,0]])];
 assert.deepEqual(optimisePaths(p)[1].points,[[20,0],[30,0]]);
});
test('box optimisation preserves every machine segment and reduces separate paths',()=>{
 const drawing=parseDXF(fs.readFileSync('test-files/foldover-8-compartment-box.dxf','utf8'));
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
test('horizontal collinear groups are scheduled before vertical collinear groups',()=>{
 const p=[path([[0,0],[1,1]]),path([[2,3],[2,4]]),path([[2,6],[2,7]]),path([[10,10],[11,10]]),path([[13,10],[14,10]])];
 const result=optimisePaths(p);assert.equal(result[1].points[0][1],10);assert.equal(result[2].points[0][1],10);
});
test('first path starts nearest the top-left even when distant collinear groups exist',()=>{
 const p=[path([[20,20],[30,20]]),path([[40,20],[50,20]]),path([[8,9],[2,3]])];
 assert.deepEqual(optimisePaths(p)[0].points,[[2,3],[8,9]]);
});
test('closed paths start at their nearest vertex without changing their edges',()=>{
 const p=[path([[20,20],[5,20],[5,5],[20,5],[20,20]])];
 const result=optimisePaths(p);assert.deepEqual(result[0].points[0],[5,5]);assert.deepEqual(edges(result),edges(p));
});
