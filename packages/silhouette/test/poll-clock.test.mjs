import test from 'node:test';
import assert from 'node:assert/strict';
import {PollClock} from '../src/poll-clock.js';
test('worker owns polling waits and resolves matching requests only',async()=>{
 const sent=[],modes=[],worker={postMessage:m=>sent.push(m),terminate(){this.closed=true;}};
 const clock=new PollClock(mode=>modes.push(mode),()=>worker);let done=false;
 const pending=clock.wait(350).then(()=>done=true);assert.deepEqual(sent,[{id:1,ms:350}]);worker.onmessage({data:2});await Promise.resolve();assert.equal(done,false);worker.onmessage({data:1});await pending;assert.equal(done,true);clock.close();assert(worker.closed);assert.deepEqual(modes,['worker']);
});
test('worker failure falls back without losing an outstanding wait',async()=>{
 const modes=[],worker={postMessage(){},terminate(){}};const clock=new PollClock(mode=>modes.push(mode),()=>worker);
 const wait=clock.wait(1);worker.onerror();await wait;await clock.wait(1);assert.deepEqual(modes,['worker','window']);clock.close();
});
test('unavailable worker falls back and closing rejects outstanding waits',async()=>{
 const clock=new PollClock(()=>{},()=>{throw Error('unsupported');});await clock.wait(1);const wait=assert.rejects(clock.wait(5000),/closed/);clock.close();await wait;await assert.rejects(clock.wait(1),/closed/);
});
