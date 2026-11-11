// GATT identifiers and handshake cross-checked against captured traffic and
// https://github.com/fablabnbg/inkscape-silhouette/blob/main/silhouette/BLETransport.py
export const UUID={service:'e2088282-4fde-42f9-bb22-6ec3c7ed8f91',write:'6d92661d-f429-4d67-929b-28e7a9780912',read:'8dcf199a-30e7-4bd4-beb6-beb57dca866c',control:'61490654-b5b4-458c-a867-9e15bc1471e0'};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export class CameoBluetooth{
 constructor(onState=()=>{}){this.onState=onState;this.busy=false;this.connected=false;this.log=[];this.stopped=false;this.pending=null;this.rx=[];}
 record(direction,data){this.log.push({time:new Date().toISOString(),direction,hex:Array.from(data,b=>b.toString(16).padStart(2,'0')).join('')});if(this.log.length>100000)this.log.shift();}
 async connect(){
  if(this.busy)throw Error('A job is running');
  if(!navigator.bluetooth)throw Error('Use Chrome on macOS with HTTPS or localhost for Bluetooth.');
  this.disconnect();this.stopped=false;
  this.device=await navigator.bluetooth.requestDevice({filters:[{services:[UUID.service]},{namePrefix:'CAMEO'}],optionalServices:[UUID.service]});
  this.device.addEventListener('gattserverdisconnected',()=>{this.connected=false;this.stopped=true;this.pending?.reject(Error('Cameo disconnected. Job was not resumed.'));this.onState('Disconnected');});
  try{
   const server=await this.device.gatt.connect(),service=await server.getPrimaryService(UUID.service);
   this.write=await service.getCharacteristic(UUID.write);this.read=await service.getCharacteristic(UUID.read);this.control=await service.getCharacteristic(UUID.control);
   this.read.addEventListener('characteristicvaluechanged',e=>this.receive(new Uint8Array(e.target.value.buffer,e.target.value.byteOffset,e.target.value.byteLength)));
   this.control.addEventListener('characteristicvaluechanged',e=>this.record('control',new Uint8Array(e.target.value.buffer,e.target.value.byteOffset,e.target.value.byteLength)));
   await this.control.startNotifications();await this.read.startNotifications();
   for(const c of [this.control,this.read,this.write])await c.writeValueWithResponse(new Uint8Array([27,4]));
   await delay(1000);this.rx=[];this.connected=true;
   const identity=await this.query(new TextEncoder().encode('FG\x03'));
   if(!/^CAMEO 5 ALPHA\b/i.test(identity))throw Error(`Expected CAMEO 5 ALPHA; device returned: ${identity}`);
   this.identity=identity;this.onState(identity);return identity;
  }catch(err){this.disconnect();throw err;}
 }
 receive(data){this.record('read',data);for(const b of data){if(b===3){const text=new TextDecoder().decode(new Uint8Array(this.rx)).trim();this.rx=[];this.pending?.resolve(text);}else this.rx.push(b);}}
 async send(data){
  for(let i=0;i<data.length;i+=20){
   if(this.stopped)throw Error('Sending stopped. Use the machine’s pause button to stop buffered movement.');
   if(!this.device?.gatt.connected)throw Error('Bluetooth disconnected');
   const chunk=data.slice(i,i+20);
   // An uncertain write is never retried: duplicating a movement is worse than failing.
   let timer;
   try { await Promise.race([this.write.writeValueWithResponse(chunk),new Promise((_,reject)=>{timer=setTimeout(()=>{this.disconnect();reject(Error('Bluetooth write timed out; connection closed.'));},10000);})]); } finally {clearTimeout(timer);}
   this.record('write',chunk);
  }
 }
 async query(data,timeout=6000){
  if(this.pending)throw Error('Another query is pending');this.rx=[];
  let timer;
  const response=new Promise((resolve,reject)=>{this.pending={resolve,reject};timer=setTimeout(()=>reject(Error('No response from Cameo')),timeout);});
  response.catch(()=>{}); // A disconnect may reject while the acknowledged write is pending.
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
   await delay(350);
  }throw Error('Cameo did not become ready in time. Check the machine; the job will not resume automatically.');
 }
 async run(job,onProgress=()=>{}){
  if(this.busy)throw Error('A job is already running');if(!this.connected)throw Error('Connect the Cameo first');
  this.busy=true;this.stopped=false;
  try{await this.ready(10000);
   for(let i=0;i<job.steps.length;i++){const step=job.steps[i];onProgress(i/job.steps.length,step.label);await this.send(new TextEncoder().encode(step.commands.join('\x03')+'\x03'));if(step.wait)await this.ready();}
   onProgress(1,'Complete — device reports ready');
  }finally{this.busy=false;}
 }
 stop(){this.stopped=true;this.pending?.reject(Error('Sending stopped'));}
 disconnect(){this.stop();this.device?.gatt?.disconnect();this.connected=false;}
}
