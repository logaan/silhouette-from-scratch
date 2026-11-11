export const isDryRun=()=>['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&document.querySelector('meta[name="dry-run"]')?.content==='true';
export class DryRunCameo{
 constructor(onState=()=>{}){this.onState=onState;this.connected=false;this.busy=false;this.log=[];this.identity='Simulated Cameo';this.stopped=false;}
 async connect(){this.connected=true;this.stopped=false;this.onState('Simulated Cameo connected');return this.identity;}
 disconnect(){this.stop();this.connected=false;this.onState('Simulated Cameo disconnected');}
 stop(){this.stopped=true;}
 async run(job,onProgress=()=>{}){
  if(!this.connected)throw Error('Connect the simulated Cameo first');if(this.busy)throw Error('A job is already running');
  this.busy=true;this.stopped=false;
  try{for(let i=0;i<job.steps.length;i++){if(this.stopped||!this.connected)throw Error('Simulation stopped');const step=job.steps[i];this.log.push({time:new Date().toISOString(),direction:'simulation',commands:[...step.commands]});onProgress((i+1)/job.steps.length,step.label);if(i%20===0)await new Promise(resolve=>setTimeout(resolve,0));}onProgress(1,'Dry run complete — no commands sent to hardware');}finally{this.busy=false;}
 }
}
