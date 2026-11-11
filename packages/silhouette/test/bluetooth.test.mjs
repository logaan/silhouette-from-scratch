import test from 'node:test';import assert from 'node:assert/strict';import {CameoBluetooth} from '@cut-and-crease/silhouette';
test('larger acknowledged writes preserve bytes and wait for each acknowledgement',async()=>{const c=new CameoBluetooth();c.device={gatt:{connected:true}};const writes=[];let pending=false;c.write={writeValueWithResponse:async b=>{assert.equal(pending,false);pending=true;await new Promise(resolve=>setImmediate(resolve));writes.push([...b]);pending=false;}};const data=Uint8Array.from({length:203},(_,i)=>i%256);await c.send(data);assert.deepEqual(writes.map(w=>w.length),[94,94,15]);assert.deepEqual(writes.flat(),[...data]);});
test('uncertain failed writes are never retried',async()=>{const c=new CameoBluetooth();c.device={gatt:{connected:true}};let attempts=0;c.write={writeValueWithResponse:async()=>{attempts++;throw Error('GATT error');}};await assert.rejects(c.send(new Uint8Array(203)),/GATT/);assert.equal(attempts,1);});
test('stop prevents further writes',async()=>{const c=new CameoBluetooth();c.device={gatt:{connected:true}};let attempts=0;c.write={writeValueWithResponse:async()=>{attempts++;c.stop();}};await assert.rejects(c.send(new Uint8Array(203)),/stopped/);assert.equal(attempts,1);});
test('only read notifications resolve responses, including split notifications',async()=>{const c=new CameoBluetooth();c.send=async()=>{c.receive(new Uint8Array([67,65]));c.receive(new Uint8Array([77,69,79,3]));};assert.equal(await c.query(new Uint8Array([1])),'CAMEO');});
test('unloaded mat refuses job before commands',async()=>{const c=new CameoBluetooth();c.connected=true;c.query=async()=> '2';let writes=0;c.send=async()=>writes++;await assert.rejects(c.run({steps:[{commands:['M0,0']}]}),/Load the mat/);assert.equal(writes,0);assert.equal(c.busy,false);});
test('job executes in order with readiness barriers and final progress',async()=>{const c=new CameoBluetooth();c.connected=true;const events=[];c.ready=async()=>events.push('ready');c.send=async bytes=>events.push(new TextDecoder().decode(bytes));await c.run({steps:[{label:'Crease',commands:['J2','M10,20'],wait:true},{label:'Cut',commands:['J1','M30,40'],wait:true}]},(progress,label,detail)=>{if(detail.phase==='complete')events.push('complete');});assert.deepEqual(events,['ready','J2\x03M10,20\x03','ready','J1\x03M30,40\x03','ready','complete']);assert.equal(c.busy,false);});
test('failed send skips subsequent tool operation and releases busy state',async()=>{const c=new CameoBluetooth();c.connected=true;c.ready=async()=>{};const commands=[];c.send=async b=>{commands.push([...b]);throw Error('write failed');};await assert.rejects(c.run({steps:[{label:'First',commands:['J2'],wait:true},{label:'Second',commands:['J1'],wait:true}]}),/write failed/);assert.equal(commands.length,1);assert.equal(c.busy,false);});
test('query timeout clears pending state',async()=>{const c=new CameoBluetooth();c.send=async()=>{};await assert.rejects(c.query(new Uint8Array([27,5]),5),/No response/);assert.equal(c.pending,null);});
test('reconnect uses previously authorised Cameo without showing a chooser',async()=>{
 const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),originalStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const remembered={id:'saved',name:'CAMEO 5 ALPHA'};let connected;
 try{
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{bluetooth:{getDevices:async()=>[remembered],requestDevice:()=>{throw Error('Unexpected chooser');}}}});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>remembered.id}});
  const device=new CameoBluetooth();device.connect=async target=>{connected=target;};
  assert.equal(await device.reconnect(),true);assert.equal(connected,remembered);
  navigator.bluetooth.getDevices=undefined;assert.equal(await device.reconnect(),false);
 }finally{if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;if(originalStorage)Object.defineProperty(globalThis,'localStorage',originalStorage);else delete globalThis.localStorage;}
});
test('operation completion is only reported after readiness and records timing',async()=>{
 const c=new CameoBluetooth();c.connected=true;let release,readyCalls=0;
 c.ready=async()=>{if(readyCalls++===1)await new Promise(resolve=>release=resolve);};c.send=async()=>{};
 const phases=[];const run=c.run({build:{commit:'test'},steps:[{label:'Cut 1/1 · pass 1/1',commands:['M0,0','D1,1'],wait:true}]},(p,label,detail)=>phases.push(detail.phase));
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(phases,['sending','waiting']);assert(!c.log.some(e=>e.type==='step-complete'));
 release();await run;assert.deepEqual(phases,['sending','waiting','completed','complete']);assert.equal(c.log[0].build.commit,'test');assert(c.log.find(e=>e.type==='step-complete').duration_ms>=0);assert.equal(c.log.at(-1).type,'job-complete');
});
test('failed operations remain unconfirmed and are recorded with their index',async()=>{
 const c=new CameoBluetooth();c.connected=true;c.ready=async()=>{};c.send=async()=>{throw Error('lost connection');};const phases=[];
 await assert.rejects(c.run({steps:[{label:'Cut',commands:['M0,0'],wait:true}]},(p,label,d)=>phases.push(d.phase)),/lost connection/);
 assert.deepEqual(phases,['sending','failed']);assert.equal(c.log.at(-1).type,'job-failed');assert.equal(c.log.at(-1).stepIndex,0);assert(!c.log.some(e=>e.type==='step-complete'));
});
test('pause finishes the current step and resumes remaining steps once after checking readiness',async()=>{
 const c=new CameoBluetooth();c.connected=true;const writes=[];let checks=0;
 c.ready=async()=>{checks++;};c.send=async bytes=>writes.push(new TextDecoder().decode(bytes));
 let paused;const reached=new Promise(resolve=>paused=resolve);
 const running=c.run({steps:[{label:'Cut 1',commands:['M0,0','D1,1'],wait:true},{label:'Cut 2',commands:['M2,2','D3,3'],wait:true}]},(p,label,d)=>{
  if(d.phase==='sending'&&d.stepIndex===0)c.pause();
  if(d.phase==='paused')paused();
 });
 await reached;assert.equal(writes.length,1);assert.equal(checks,2);assert(c.busy);
 c.resume();await running;assert.equal(writes.length,2);assert.equal(checks,4);
 assert.deepEqual(c.log.filter(e=>['sending-paused','sending-resumed'].includes(e.type)).map(e=>e.type),['sending-paused','sending-resumed']);
});
test('disconnect during a pause fails the job and cannot send remaining steps',async()=>{
 const c=new CameoBluetooth();c.connected=true;c.ready=async()=>{};let writes=0;c.send=async()=>writes++;
 let paused;const reached=new Promise(resolve=>paused=resolve);
 const running=c.run({steps:[{label:'Cut 1',commands:['D1,1'],wait:true},{label:'Cut 2',commands:['D2,2'],wait:true}]},(p,label,d)=>{
  if(d.phase==='sending')c.pause();if(d.phase==='paused')paused();
 });
 const rejected=assert.rejects(running,/Connection closed/);await reached;c.disconnect();await rejected;c.resume();assert.equal(writes,1);assert.equal(c.busy,false);
});
