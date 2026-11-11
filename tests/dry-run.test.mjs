import test from 'node:test';
import assert from 'node:assert/strict';
import {DryRunCameo} from '../web/dry-run.js';
test('dry run connects and accepts the full job without hardware',async()=>{
 const states=[],progress=[],device=new DryRunCameo(s=>states.push(s));
 await device.connect();assert(device.connected);
 const job={steps:[{label:'Cut',commands:['M10,10','D20,20']},{label:'Home',commands:['M0,0']}]};
 await device.run(job,(p,label)=>progress.push([p,label]));
 assert.equal(device.log.filter(e=>e.direction==='simulation').length,2);assert.equal(device.busy,false);assert.equal(progress.at(-1)[0],1);assert.match(progress.at(-1)[1],/Dry run complete/);assert.deepEqual(device.log.find(e=>e.direction==='simulation').commands,job.steps[0].commands);
 device.disconnect();assert(!device.connected);
});
test('dry run stops without accepting later commands',async()=>{
 const device=new DryRunCameo();await device.connect();
 await assert.rejects(device.run({steps:Array.from({length:30},()=>({label:'Path',commands:['M1,1']}))},()=>device.stop()),/stopped/);
 assert.equal(device.log.filter(e=>e.direction==='simulation').length,1);assert.equal(device.busy,false);
});
