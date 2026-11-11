import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {joinCreasesThroughCuts} from '../web/crease-bridges.js';
import {parseDXF} from '../web/geometry.js';
import {compileJob} from '../web/job.js';
import {previewSegments} from '../web/order.js';
const path=(points,operation='crease')=>({points,operation});
const edge=(a,b)=>[a,b].map(p=>p.map(n=>Math.round(n*20)).join(',')).sort().join('|');
test('joins crease ends through a red corner, reversing paths as necessary',()=>{
 const blue=[path([[0,10],[0,0]]),path([[10,0],[10,10]])],red=[path([[0,10],[5,10],[10,10]],'cut')],before=structuredClone(blue);
 const result=joinCreasesThroughCuts(blue,red);assert.equal(result.paths.length,1);assert.equal(result.bridges.length,1);assert.equal(result.bridges[0].length,10);assert.deepEqual(blue,before);
});
test('splits a red segment at crease endpoints without traversing its unused ends',()=>{
 const result=joinCreasesThroughCuts([path([[2,0],[2,5]]),path([[8,5],[8,0]])],[path([[0,5],[10,5]],'cut')]);
 assert.equal(result.bridges.length,1);assert.deepEqual(result.bridges[0].points,[[2,5],[8,5]]);
});
test('never invents gap crossings, long detours, or extra passes over blue geometry',()=>{
 const blue=[path([[0,0],[0,5]]),path([[10,5],[10,0]])];
 assert.equal(joinCreasesThroughCuts(blue,[]).bridges.length,0);
 assert.equal(joinCreasesThroughCuts(blue,[path([[0,5],[4,5]],'cut'),path([[6,5],[10,5]],'cut')]).bridges.length,0);
 assert.equal(joinCreasesThroughCuts(blue,[path([[0,5],[0,50],[10,50],[10,5]],'cut')]).bridges.length,0);
 const overlap=[...blue,path([[3,5],[7,5]])];assert.equal(joinCreasesThroughCuts(overlap,[path([[0,5],[10,5]],'cut')]).bridges.length,2);
 assert(joinCreasesThroughCuts(overlap,[path([[0,5],[10,5]],'cut')]).bridges.every(b=>b.points.every(p=>p[0]<=3||p[0]>=7)));
});
test('box bridges preserve all required passes and cut geometry and use only red edges',()=>{
 const d=parseDXF(fs.readFileSync('test-files/foldover-8-compartment-box.dxf','utf8')),p={name:'Test',cut:{tool:1,force:15,speed:30,depth:4,passes:1},crease:{tool:2,force:33,speed:30,passes:2}},o={mat:'12x12',sheetWidth:300,sheetHeight:300,x:0,y:0,rotation:0,order:'crease-first',optimise:true};
 const original=compileJob(d,o,p),joined=compileJob(d,{...o,creaseBridges:true},p),before=previewSegments(original),after=previewSegments(joined);
 const drawn=s=>s.filter(p=>!p.travel&&!p.bridge).map(p=>p.operation+':'+edge(p.from,p.to)).sort();
 assert.deepEqual(drawn(after),drawn(before));assert.equal(joined.operations.find(o=>o.operation==='cut').pathCount,24);assert.equal(joined.operations.find(o=>o.operation==='crease').pathCount,26);assert.equal(joined.bridges.length,36);
 const red=before.filter(s=>!s.travel&&s.operation==='cut'),on=(p,a,b)=>Math.abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))<1e-7&&p.every((n,i)=>n>=Math.min(a[i],b[i])-1e-7&&n<=Math.max(a[i],b[i])+1e-7);
 for(const s of after.filter(s=>s.bridge)){assert.equal(s.operation,'crease');assert(red.some(r=>on(s.from,r.from,r.to)&&on(s.to,r.from,r.to)));}
 for(const opts of [{...o,creaseBridges:false},{...o,creaseBridges:true,optimise:false},{...o,creaseBridges:true,order:'cut-first'}])assert.equal(compileJob(d,opts,p).bridges.length,0);
});
