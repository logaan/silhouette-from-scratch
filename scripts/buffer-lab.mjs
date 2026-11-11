import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export async function bufferLab(port){
 const token=randomUUID(),file=path.resolve('captures',`buffer-lab-${new Date().toISOString().replaceAll(':','-')}.jsonl`),configFile=path.join(os.tmpdir(),`cameo-buffer-lab-${port}.json`);
 await fs.mkdir('captures',{recursive:true});await fs.writeFile(file,'',{mode:0o600});await fs.writeFile(configFile,JSON.stringify({token,port,file}),{mode:0o600});
 const control={limit:1,byteLimit:4096,pauseSerial:0},sessions=new Map(),recent=[],statuses=[];let summary=null,lastSeen=null,writeChain=Promise.resolve();
 const append=entry=>{writeChain=writeChain.then(()=>fs.appendFile(file,JSON.stringify(entry)+'\n'));return writeChain;};
 const readBody=async req=>{let body='';for await(const chunk of req){body+=chunk;if(body.length>2_000_000)throw Error('Payload too large');}return JSON.parse(body||'{}');};
 const handle=async(req,res)=>{
  if(!req.url.startsWith('/__buffer-lab/'))return false;
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  const origin=req.headers.origin,allowed=[`http://127.0.0.1:${port}`,`http://localhost:${port}`];
  if(!allowed.includes('http://'+req.headers.host)||origin&&!allowed.includes(origin)||req.headers.authorization!==`Bearer ${token}`){res.writeHead(403);res.end('{}');return true;}
  try{
   if(req.method==='POST'&&req.url==='/__buffer-lab/control'){
    const update=await readBody(req);
    if(update.limit!==undefined&&(!Number.isInteger(update.limit)||update.limit<1||update.limit>256))throw Error('Limit must be 1–256');
    if(update.byteLimit!==undefined&&(!Number.isInteger(update.byteLimit)||update.byteLimit<64||update.byteLimit>65536))throw Error('Byte limit must be 64–65536');
    if(update.limit!==undefined)control.limit=update.limit;if(update.byteLimit!==undefined)control.byteLimit=update.byteLimit;if(update.pause===true)control.pauseSerial++;
    await append({time:new Date().toISOString(),type:'lab-control',...control});res.end(JSON.stringify(control));
   }else if(req.method==='POST'&&req.url==='/__buffer-lab/sync'){
    const data=await readBody(req);if(typeof data.session!=='string'||!Array.isArray(data.events)||data.events.length>1000)throw Error('Invalid telemetry');
    let seen=sessions.get(data.session)??-1;
    for(const item of data.events){if(!Number.isInteger(item.sequence)||item.sequence<=seen)continue;seen=item.sequence;await append({session:data.session,sequence:item.sequence,...item.event});if(item.event.direction==='event'){recent.push(item.event);if(recent.length>50)recent.shift();}if(item.event.direction==='read'){statuses.push(item.event);if(statuses.length>12)statuses.shift();}}
    sessions.set(data.session,seen);summary=data.summary;lastSeen=new Date().toISOString();res.end(JSON.stringify({...control,ack:seen}));
   }else if(req.method==='GET'&&req.url==='/__buffer-lab/state')res.end(JSON.stringify({control,lastSeen,summary,recent,statuses,file}));
   else{res.writeHead(404);res.end('{}');}
  }catch(error){res.writeHead(400);res.end(JSON.stringify({error:error.message}));}
  return true;
 };
 return {token,handle};
}
