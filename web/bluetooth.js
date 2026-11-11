import {operationBatch} from './operation-batch.js';
import {PollClock} from './poll-clock.js';
import {TransmissionPause} from './transmission-pause.js';
import {jobActivity} from './job-activity.js';
export const UUID={service:'e2088282-4fde-42f9-bb22-6ec3c7ed8f91',write:'6d92661d-f429-4d67-929b-28e7a9780912',read:'8dcf199a-30e7-4bd4-beb6-beb57dca866c',control:'61490654-b5b4-458c-a867-9e15bc1471e0'};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export class CameoBluetooth{
 constructor(onState=()=>{}){this.transmission=new TransmissionPause();this.onState=onState;this.busy=false;this.connected=false;this.log=[];this.stopped=false;this.pending=null;this.rx=[];}
 record(direction,data){this.log.push({time:new Date().toISOString(),direction,hex:Array.from(data,b=>b.toString(16).padStart(2,'0')).join('')});if(this.log.length>100000)this.log.shift();}
 async reconnect(){
  if(!navigator.bluetooth?.getDevices)return false;
  const devices=await navigator.bluetooth.getDevices();let saved;try{saved=localStorage.getItem('cameo-device-id');}catch{}
  const matching=devices.filter(d=>/^CAMEO 5 ALPHA/i.test(d.name||''));
  const device=devices.find(d=>d.id===saved)||(matching.length===1?matching[0]:null);
  if(!device)return false;await this.connect(device);return true;
 }
 async connect(knownDevice=null){
  if(this.busy)throw Error('A job is running');
  if(!navigator.bluetooth)throw Error('Use Chrome on macOS with HTTPS or localhost for Bluetooth.');
  this.disconnect();this.stopped=false;
  this.device=knownDevice||await navigator.bluetooth.requestDevice({filters:[{services:[UUID.service]},{namePrefix:'CAMEO'}],optionalServices:[UUID.service]});
  this.device.addEventListener('gattserverdisconnected',()=>{this.connected=false;this.stopped=true;this.transmission.cancel();this.pending?.reject(Error('Cameo disconnected. Job was not resumed.'));this.onState('Disconnected');});
  try{
   const target=this.device;let expired=false,timer;
   const connection=target.gatt.connect().then(server=>{if(expired){target.gatt.disconnect();throw Error('Connection timed out');}return server;});
   let server;try{server=await Promise.race([connection,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('Cameo connection timed out. Check that it is on and nearby.'));},10000);})]);}finally{clearTimeout(timer);}
   const service=await server.getPrimaryService(UUID.service);
   this.write=await service.getCharacteristic(UUID.write);this.read=await service.getCharacteristic(UUID.read);this.control=await service.getCharacteristic(UUID.control);
   this.read.addEventListener('characteristicvaluechanged',e=>this.receive(new Uint8Array(e.target.value.buffer,e.target.value.byteOffset,e.target.value.byteLength)));
   this.control.addEventListener('characteristicvaluechanged',e=>this.record('control',new Uint8Array(e.target.value.buffer,e.target.value.byteOffset,e.target.value.byteLength)));
   await this.control.startNotifications();await this.read.startNotifications();
   for(const c of [this.control,this.read,this.write])await c.writeValueWithResponse(new Uint8Array([27,4]));
   await delay(1000);this.rx=[];this.connected=true;
   const identity=await this.query(new TextEncoder().encode('FG\x03'));
   if(!/^CAMEO 5 ALPHA\b/i.test(identity))throw Error(`Expected CAMEO 5 ALPHA; device returned: ${identity}`);
   this.identity=identity;try{localStorage.setItem('cameo-device-id',this.device.id);}catch{}this.onState(identity);return identity;
  }catch(err){this.disconnect();throw err;}
 }
 receive(data){this.record('read',data);for(const b of data){if(b===3){const text=new TextDecoder().decode(new Uint8Array(this.rx)).trim();this.rx=[];this.pending?.resolve(text);}else this.rx.push(b);}}
 async send(data){
  for(let i=0;i<data.length;i+=20){
   if(this.stopped)throw Error('Sending stopped. Use the machine’s pause button to stop buffered movement.');
   if(!this.device?.gatt.connected)throw Error('Bluetooth disconnected');
   const chunk=data.slice(i,i+20);
   let timer;
   try { await Promise.race([this.write.writeValueWithResponse(chunk),new Promise((_,reject)=>{timer=setTimeout(()=>{this.disconnect();reject(Error('Bluetooth write timed out; connection closed.'));},10000);})]); } finally {clearTimeout(timer);}
   this.record('write',chunk);
  }
 }
 async query(data,timeout=6000){
  if(this.pending)throw Error('Another query is pending');this.rx=[];
  let timer;
  const response=new Promise((resolve,reject)=>{this.pending={resolve,reject};timer=setTimeout(()=>reject(Error('No response from Cameo')),timeout);});
  response.catch(()=>{});
  try{await this.send(data);return await response;}finally{clearTimeout(timer);this.pending=null;response.catch(()=>{});}
 }
 async ready(timeout=120000){
  const start=Date.now();let readyCount=0;
  while(Date.now()-start<timeout){
   if(this.stopped)throw Error('Sending stopped');
   const status=await this.query(new Uint8Array([27,5]));
   if(status==='2')throw Error('Load the mat in the Cameo before running this job');
   if(!['0','1'].includes(status))throw Error(`Unexpected cutter status: ${status}`);
   readyCount=status==='0'?readyCount+1:0;if(readyCount>=2)return;
   await (this.pollClock?.wait(350)??delay(350));
  }throw Error('Cameo did not become ready in time. Check the machine; the job will not resume automatically.');
 }
 async run(job,onProgress=()=>{}){
  if(this.busy)throw Error('A job is already running');if(!this.connected)throw Error('Connect the Cameo first');
  this.busy=true;this.stopped=false;this.transmission.resume();
  const event=jobActivity(job,this.log,this.simulated?'dry-run':'hardware');let active=-1,outstanding=[],completed=-1,batchId=0;this.pollClock=this.simulated?null:new PollClock(mode=>event('polling-timer',{mode}));
  try{await this.ready(10000);event('initial-ready');
   for(let i=0;i<job.steps.length;){
    const resumed=await this.transmission.wait(()=>{event('sending-paused',{stepIndex:i});onProgress(i/job.steps.length,'Sending paused.',{phase:'paused',stepIndex:completed,outstanding:[]});});
    if(resumed){event('sending-resumed',{stepIndex:i});await this.ready();}
    if(this.stopped||!this.connected)throw Error('Connection closed. Start a new job.');
    const batch=operationBatch(job,i,this.batchLimit,this.batchBytes),batchStart=performance.now(),sentAt=new Map();batchId++;outstanding=[];
    event('batch-start',{batchId,indices:batch.indices,bytes:batch.bytes,operation:batch.operation,limit:this.batchLimit||1,byteLimit:this.batchBytes||4096});
    for(const index of batch.indices){
     if(this.transmission.requested&&outstanding.length)break;
     active=index;const step=job.steps[index],started=performance.now();outstanding.push(index);sentAt.set(index,started);
     event('step-start',{stepIndex:index,batchId,label:step.label,commandCount:step.commands.length});onProgress((completed+1)/job.steps.length,step.label,{phase:'sending',stepIndex:index,outstanding:[...outstanding]});
     await this.send(new TextEncoder().encode(step.commands.join('\x03')+'\x03'));
     event('step-sent',{stepIndex:index,batchId,send_ms:performance.now()-started,outstanding:[...outstanding]});
    }
    const waiting=performance.now(),readyTimeoutMs=Math.min(1_200_000,120_000*outstanding.length);event('batch-sent',{batchId,indices:[...outstanding],send_ms:waiting-batchStart,readyTimeoutMs});
    onProgress((completed+1)/job.steps.length,outstanding.length>1?`Waiting for ${outstanding.length} queued operations`:job.steps[active].label,{phase:'waiting',stepIndex:active,outstanding:[...outstanding]});
    if(outstanding.some(index=>job.steps[index].wait))await this.ready(readyTimeoutMs);
    const finished=performance.now();event('batch-complete',{batchId,indices:[...outstanding],wait_ms:finished-waiting,duration_ms:finished-batchStart,completion:'ready-after-batch'});
    const confirmed=[...outstanding];outstanding=[];
    for(const index of confirmed){completed=index;event('step-complete',{stepIndex:index,batchId,wait_ms:finished-waiting,duration_ms:finished-sentAt.get(index),completion:confirmed.length>1?'batch-ready':'ready'});onProgress((index+1)/job.steps.length,job.steps[index].label,{phase:'completed',stepIndex:index,outstanding:[]});}
    i=active+1;
   }
   event('job-complete');onProgress(1,this.simulated?'Dry run complete — no commands sent to hardware':'Complete — device reports ready',{phase:'complete'});
  }catch(error){event('job-failed',{stepIndex:active,message:error.message,outstanding});onProgress((completed+1)/job.steps.length,error.message,{phase:'failed',stepIndex:active,outstanding});throw error;}finally{this.pollClock?.close();this.pollClock=null;this.busy=false;this.transmission.resume();}
 }
 pause(){if(this.busy)this.transmission.pause();}
 resume(){this.transmission.resume();}
 stop(){this.transmission.cancel();this.stopped=true;this.pending?.reject(Error('Sending stopped'));}
 disconnect(){this.stop();this.device?.gatt?.disconnect();this.connected=false;}
}
