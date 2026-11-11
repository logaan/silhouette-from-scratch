import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import DxfParser from 'dxf-parser';
import {parseDXF} from '@cut-and-crease/dxf';
import {compileJob,OPTIMISATIONS} from '@cut-and-crease/dxf';
import {exportDXF} from '@cut-and-crease/dxf';
const drawing=parseDXF(fs.readFileSync(new URL('../../../test-files/foldover-8-compartment-box.dxf',import.meta.url),'utf8'));
const preset={name:'Test',cut:{tool:1,force:15,speed:30,depth:4,passes:1},crease:{tool:2,force:33,speed:30,passes:2}};
const options={mat:'12x12',sheetWidth:300,sheetHeight:300,x:0,y:0,rotation:0,order:'crease-first'};
const rounded=p=>p.map(n=>Math.round(n*20)/20);
function assertPaths(job){
 const text=exportDXF(job),dxf=new DxfParser().parseSync(text);assert.equal(dxf.header.$INSUNITS,4);assert.equal(dxf.entities.length,job.paths.length);
 for(let i=0;i<job.paths.length;i++){
  const p=job.paths[i],e=dxf.entities[i],actual=e.vertices.map(v=>rounded([v.x,job.sheet.height-v.y]));if(e.shape)actual.push(actual[0]);
  const expected=p.points.map(rounded).filter((p,i,a)=>!i||p[0]!==a[i-1][0]||p[1]!==a[i-1][1]);assert.deepEqual(actual,expected);assert.equal(e.color,p.operation==='cut'?0xff0000:0x0000ff);assert.equal(e.type,'LWPOLYLINE');
 }
 assert.equal(parseDXF(text).counts.ignored,0);return dxf;
}
test('box export preserves selected joins, bridges, entity order and direction once per path',()=>{
 for(const enabled of [false,true])for(const order of ['crease-first','cut-first']){
  const job=compileJob(drawing,{...options,order,optimisations:Object.fromEntries(OPTIMISATIONS.map(k=>[k,enabled]))},preset),before=structuredClone(job),out=assertPaths(job);
  assert.deepEqual(job,before);assert.equal(out.entities.length,job.operations.reduce((n,o)=>n+o.pathCount,0));
  if(enabled&&order==='crease-first'){assert.equal(out.entities.length,50);assert.equal(out.entities.filter(e=>e.color===0x0000ff).length,26);}
  if(!enabled)assert.equal(out.entities.length,433);
 }
});
test('DXF export preserves physical size, rotation and placement with a bottom-left CAD origin',()=>{
 const job=compileJob(drawing,{...options,mat:'12x24',sheetHeight:420,x:8,y:20,rotation:90,optimisations:{join:true,reorder:true}},preset);assertPaths(job);
});
test('passes and transport settings are not baked into duplicated DXF paths',()=>{
 const job=compileJob(drawing,{...options,optimisations:Object.fromEntries(OPTIMISATIONS.map(k=>[k,true]))},preset),changed=compileJob(drawing,{...options,prepareTracking:true,optimisations:{...job.options.optimisations,continuousCreases:false,batching:false}},preset);
 assert.equal(exportDXF(job),exportDXF(changed));
});
