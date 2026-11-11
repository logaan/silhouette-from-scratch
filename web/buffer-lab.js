export function createBufferLab(getDevice,getSummary){
 const token=['localhost','127.0.0.1'].includes(location.hostname)&&document.querySelector('meta[name="buffer-lab"]')?.content;
 if(!token)return null;
 const banner=document.getElementById('buffer-lab-banner');banner.hidden=false;
 let current=null,cursor=0,pending=null,session=crypto.randomUUID(),pauseSerial=0;
 const sync=()=>{
  if(pending)return pending;
  pending=(async()=>{
   const device=getDevice();if(current!==device){current=device;cursor=0;session=crypto.randomUUID();}
   const response=await fetch('/__buffer-lab/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(5000),body:JSON.stringify({session,events:device.log.slice(cursor,cursor+1000).map((event,i)=>({sequence:cursor+i,event})),summary:getSummary()})});
   if(!response.ok)throw Error('Local buffer controller unavailable. Sending stopped.');
   const control=await response.json();cursor=Math.max(cursor,control.ack+1);
   if(device.batchLimit!==control.limit||device.batchBytes!==control.byteLimit)device.log.push({time:new Date().toISOString(),direction:'event',type:'buffer-limit-change',limit:control.limit,byteLimit:control.byteLimit});
   device.batchLimit=control.limit;device.batchBytes=control.byteLimit;
   if(control.pauseSerial>pauseSerial){pauseSerial=control.pauseSerial;document.getElementById('stop').click();}
   banner.textContent=`Local buffer experiment · up to ${control.limit} operations, ${control.byteLimit}-byte batch target (one path is never split). Changes apply to the next batch. Live logging connected.`;
  })().catch(error=>{banner.textContent='Local buffer controller disconnected. No further batches will be sent until it returns.';throw error;}).finally(()=>pending=null);
  return pending;
 };
 setInterval(()=>sync().catch(()=>{if(getDevice().busy&&!getDevice().transmission.requested)document.getElementById('stop').click();}),1000);
 return {sync};
}
