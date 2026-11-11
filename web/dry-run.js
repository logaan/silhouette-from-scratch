import {TransmissionPause} from './transmission-pause.js';
import {jobActivity} from './job-activity.js';
export const isDryRun=()=>['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&document.querySelector('meta[name="dry-run"]')?.content==='true';
export class DryRunCameo{
 constructor(onState=()=>{}){this.transmission=new TransmissionPause();this.onState=onState;this.connected=false;this.busy=false;this.log=[];this.identity='Simulated Cameo';this.stopped=false;}
 async connect(){this.connected=true;this.stopped=false;this.onState('Simulated Cameo connected');return this.identity;}
 disconnect(){this.stop();this.connected=false;this.onState('Simulated Cameo disconnected');}
 pause(){if(this.busy)this.transmission.pause();}
 resume(){this.transmission.resume();}
 stop(){this.transmission.cancel();this.stopped=true;}
 async run(job,onProgress=()=>{}){
  if(!this.connected)throw Error('Connect the simulated Cameo first');if(this.busy)throw Error('A job is already running');
  this.busy=true;this.stopped=false;this.transmission.resume();
  const event=jobActivity(job,this.log,'dry-run');let active=-1;
  try{for(let i=0;i<job.steps.length;i++){
   const resumed=await this.transmission.wait(()=>{event('sending-paused',{stepIndex:i});onProgress(i/job.steps.length,'Sending paused.',{phase:'paused',stepIndex:i-1});});
    if(resumed){event('sending-resumed',{stepIndex:i});}
    if(this.stopped||!this.connected)throw Error('Connection closed. Start a new job.');
    active=i;if(this.stopped||!this.connected)throw Error('Simulation stopped');const step=job.steps[i];
   event('step-start',{stepIndex:i,label:step.label,commandCount:step.commands.length});onProgress(i/job.steps.length,step.label,{phase:'sending',stepIndex:i});
   this.log.push({time:new Date().toISOString(),direction:'simulation',commands:[...step.commands]});event('step-sent',{stepIndex:i,send_ms:0});onProgress(i/job.steps.length,step.label,{phase:'waiting',stepIndex:i});
   if(i%20===0)await new Promise(resolve=>setTimeout(resolve,0));if(this.stopped||!this.connected)throw Error('Simulation stopped');
   event('step-complete',{stepIndex:i,wait_ms:0,duration_ms:0});onProgress((i+1)/job.steps.length,step.label,{phase:'completed',stepIndex:i});
  }event('job-complete');onProgress(1,'Dry run complete — no commands sent to hardware',{phase:'complete'});
  }catch(error){event('job-failed',{stepIndex:active,message:error.message});onProgress(Math.max(0,active)/job.steps.length,error.message,{phase:'failed',stepIndex:active});throw error;}finally{this.busy=false;this.transmission.resume();}
 }
}
