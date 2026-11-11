export function jobActivity(job,log,mode='hardware'){
 const jobId=crypto.randomUUID(),started=performance.now();
 const event=(type,data={})=>{log.push({time:new Date().toISOString(),direction:'event',type,jobId,elapsed_ms:Math.round((performance.now()-started)*1000)/1000,...data});if(log.length>100000)log.shift();};
 event('job-start',{mode,build:job.build||null,material:job.material,mat:job.mat,sheet:job.sheet,options:job.options,preparation:job.preparation,operations:job.operations,stepCount:job.steps.length,visibility:typeof document==='undefined'?null:document.visibilityState});
 return event;
}
