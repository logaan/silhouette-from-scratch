export class TransmissionPause{
 constructor(){this.requested=false;this.pending=null;}
 pause(){this.requested=true;}
 resume(){this.requested=false;this.pending?.resolve();this.pending=null;}
 cancel(){this.requested=false;this.pending?.reject(Error('Connection closed while sending was paused. Start a new job.'));this.pending=null;}
 async wait(onPaused){
  if(!this.requested)return false;
  const promise=new Promise((resolve,reject)=>{this.pending={resolve,reject};});
  onPaused();await promise;return true;
 }
}
