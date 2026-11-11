export class PollClock{
 constructor(onMode=()=>{},createWorker=()=>new Worker(new URL('./poll-worker.js',import.meta.url),{type:'module'})){
  this.pending=new Map();this.nextId=0;this.worker=null;this.closed=false;this.onMode=onMode;
  try{this.worker=createWorker();this.worker.onmessage=({data:id})=>{const wait=this.pending.get(id);if(wait){this.pending.delete(id);wait.resolve();}};this.worker.onerror=()=>this.fallback();this.worker.onmessageerror=()=>this.fallback();}catch{}
  this.onMode(this.worker?'worker':'window');
 }
 fallback(){
  if(!this.worker)return;this.worker?.terminate();this.worker=null;this.onMode('window');
  for(const wait of this.pending.values())wait.timer=setTimeout(()=>{this.pending.delete(wait.id);wait.resolve();},Math.max(0,wait.until-performance.now()));
 }
 wait(ms){
  if(this.closed)return Promise.reject(Error('Polling clock closed'));
  return new Promise((resolve,reject)=>{
   const id=++this.nextId,wait={id,resolve,reject,until:performance.now()+ms};this.pending.set(id,wait);
   if(this.worker){try{this.worker.postMessage({id,ms});}catch{this.fallback();}}
   else wait.timer=setTimeout(()=>{this.pending.delete(id);resolve();},ms);
  });
 }
 close(){this.closed=true;this.worker?.terminate();this.worker=null;for(const wait of this.pending.values()){clearTimeout(wait.timer);wait.reject(Error('Polling clock closed'));}this.pending.clear();}
}
