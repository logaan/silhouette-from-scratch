import test from 'node:test';
import assert from 'node:assert/strict';
import {operationBatch} from '../web/operation-batch.js';
import {CameoBluetooth} from '../web/bluetooth.js';
const step=(label,n)=>({label,commands:[`M${n},0`,`D${n},10`],wait:true});
test('batches stay within operation, byte and setup boundaries',()=>{
 const job={steps:[step('Set crease tool',0),...Array.from({length:10},(_,i)=>step(`Crease ${i}`,i)),step('Set cut tool',0),step('Cut 1',10)]};
 assert.deepEqual(operationBatch(job,0,8).indices,[0]);assert.equal(operationBatch(job,1,3).indices.length,3);assert.equal(operationBatch(job,1,256).indices.length,10);assert(operationBatch(job,1,256,64).bytes<=64);assert.equal(operationBatch(job,1,0).indices.length,1);
});
test('queued operations are only confirmed as a batch after ready; limits change at boundaries',async()=>{
 const c=new CameoBluetooth();c.connected=true;c.batchLimit=2;let release,calls=0;const sent=[],phases=[];
 c.ready=async()=>{if(++calls===2)await new Promise(resolve=>release=resolve);};c.send=async bytes=>sent.push(new TextDecoder().decode(bytes));
 const job={steps:Array.from({length:5},(_,i)=>step(`Crease ${i}`,i))};
 const running=c.run(job,(p,label,d)=>phases.push(d));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(sent.length,2);assert(!phases.some(d=>d.phase==='completed'));assert.deepEqual(phases.at(-1).outstanding,[0,1]);c.batchLimit=4;release();await running;
 assert.equal(sent.length,5);assert.deepEqual(c.log.filter(e=>e.type==='batch-complete').map(e=>e.indices.length),[2,3]);assert.equal(calls,3);assert.equal(c.log.filter(e=>e.type==='step-complete').length,5);
});
test('pause during batch transmission sends no extra operation and resumes without replay',async()=>{
 const c=new CameoBluetooth();c.connected=true;c.batchLimit=4;c.ready=async()=>{};let writes=0,reached;
 const paused=new Promise(resolve=>reached=resolve);c.send=async()=>{if(++writes===1)c.pause();};
 const running=c.run({steps:Array.from({length:4},(_,i)=>step(`Cut ${i}`,i))},(p,l,d)=>{if(d.phase==='paused')reached();});
 await paused;assert.equal(writes,1);c.resume();await running;assert.equal(writes,4);assert.deepEqual(c.log.filter(e=>e.type==='batch-complete').map(e=>e.indices.length),[1,3]);
});
test('failed batch keeps sent work unconfirmed and never sends the next batch',async()=>{
 const c=new CameoBluetooth();c.connected=true;c.batchLimit=2;let checks=0,writes=0,failed;
 c.ready=async()=>{if(++checks===2)throw Error('unexpected status');};c.send=async()=>writes++;
 await assert.rejects(c.run({steps:Array.from({length:4},(_,i)=>step(`Cut ${i}`,i))},(p,l,d)=>{if(d.phase==='failed')failed=d;}),/unexpected/);
 assert.equal(writes,2);assert.deepEqual(failed.outstanding,[0,1]);assert(!c.log.some(e=>e.type==='step-complete'));
});
test('tool-phase mode spans the old count and byte caps but never crosses a tool change',()=>{
 const job={steps:[step('Set crease tool',0),...Array.from({length:300},(_,i)=>step(`Crease ${i}`,i)),step('Set cut tool',0),step('Cut 1',0),step('Return to origin',0)]};
 const batch=operationBatch(job,1,'tool',64);assert.equal(batch.indices.length,300);assert(batch.bytes>4096);assert.deepEqual(operationBatch(job,0,'tool').indices,[0]);assert.deepEqual(operationBatch(job,301,'tool').indices,[301]);assert.deepEqual(operationBatch(job,302,'tool').indices,[302]);
});
test('tool-phase runner confirms creases before sending cut setup and never retransmits on resume',async()=>{
 const c=new CameoBluetooth();c.connected=true;c.batchLimit='tool';const writes=[];let readyCalls=0,release,reached;
 const waiting=new Promise(resolve=>reached=resolve);
 c.ready=async()=>{if(++readyCalls===2){reached();await new Promise(resolve=>release=resolve);}};
 c.send=async bytes=>writes.push(new TextDecoder().decode(bytes));
 const job={steps:[...Array.from({length:6},(_,i)=>step(`Crease ${i}`,i)),step('Set cut tool',10),step('Cut 1',11)]};
 let paused;const pausedAt=new Promise(resolve=>paused=resolve);
 const running=c.run(job,(p,label,d)=>{if(d.phase==='paused')paused();});await waiting;assert.equal(writes.length,6);assert(!c.log.some(e=>e.type==='step-complete'));c.pause();release();await pausedAt;assert.equal(writes.length,6);c.resume();await running;assert.equal(writes.length,8);assert.deepEqual(c.log.filter(e=>e.type==='batch-complete').map(e=>e.indices.length),[6,1,1]);assert.equal(c.log.find(e=>e.type==='batch-start').mode,'tool-phase');
});
