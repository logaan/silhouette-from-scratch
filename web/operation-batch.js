export function operationBatch(job,start,limit=1,byteLimit=4096){
 const first=job.steps[start],operation=/^(Cut|Crease) /.exec(first.label)?.[1],indices=[start];let bytes=new TextEncoder().encode(first.commands.join('\x03')+'\x03').length;
 const count=Math.max(1,Math.min(256,Math.floor(Number(limit)||1))),maximum=Math.max(64,Math.min(65536,Number(byteLimit)||4096));
 if(operation)for(let i=start+1;i<job.steps.length&&indices.length<count;i++){
  const step=job.steps[i],size=new TextEncoder().encode(step.commands.join('\x03')+'\x03').length;
  if(!step.label.startsWith(operation+' ')||bytes+size>maximum)break;
  indices.push(i);bytes+=size;
 }
 return {indices,bytes,operation:operation?.toLowerCase()||'setup'};
}
