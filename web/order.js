const key=p=>p.map(n=>Math.round(n*20)).join(',');
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const aligned=(a,b,c,d)=>{const u=[b[0]-a[0],b[1]-a[1]],v=[d[0]-c[0],d[1]-c[1]],length=Math.hypot(...u);return length>0&&Math.abs(u[0]*v[1]-u[1]*v[0])<1e-7&&Math.abs(u[0]*(c[1]-b[1])-u[1]*(c[0]-b[0]))/length<.001;};
export function optimisePaths(paths,{passes=1,join=true,reorder=true,collinear=true,reversePasses=true}={}){
 const remaining=paths.map(p=>({...p,points:p.points.map(pt=>[...pt])})),chains=[];
 while(remaining.length){
  const chain=remaining.shift();let changed=join;
  while(changed){changed=false;for(let i=0;i<remaining.length;i++){
   const p=remaining[i];if(p.operation!==chain.operation)continue;
   const a=chain.points[0],b=chain.points.at(-1),c=p.points[0],d=p.points.at(-1);
   if(key(b)===key(c))chain.points.push(...p.points.slice(1));
   else if(key(b)===key(d))chain.points.push(...[...p.points].reverse().slice(1));
   else if(key(a)===key(d))chain.points.unshift(...p.points.slice(0,-1));
   else if(key(a)===key(c))chain.points.unshift(...[...p.points].reverse().slice(0,-1));
   else continue;
   remaining.splice(i,1);changed=true;break;
  }}chains.push(chain);
 }
 if(!reorder)return chains;
 const result=[];let cursor=[0,0],previous=null;
 while(chains.length){let best=null;
  for(let i=0;i<chains.length;i++){
   const pts=chains[i].points,closed=key(pts[0])===key(pts.at(-1));
   const entries=closed?pts.slice(0,-1).map((_,index)=>index):[0,pts.length-1];
   for(const entry of entries){
    const reverse=!closed&&entry!==0,a=pts[entry],b=closed?pts[(entry+1)%(pts.length-1)]:reverse?pts.at(-2):pts[1];
    const travel=distance(cursor,a),inLine=collinear&&previous&&aligned(previous,cursor,a,b),bonus=result.length&&inLine?(Math.abs(b[1]-a[1])<.001?2:1):0;
    const score=Math.max(0,travel-bonus);
    if(!best||score<best.score-1e-9||Math.abs(score-best.score)<1e-9&&travel<best.travel)best={i,entry,reverse,closed,score,travel};
   }
  }
  const p=chains.splice(best.i,1)[0];
  if(best.closed){const ring=p.points.slice(0,-1);p.points=[...ring.slice(best.entry),...ring.slice(0,best.entry),ring[best.entry]];}
  else if(best.reverse)p.points.reverse();
  result.push(p);
  if(!best.closed&&reversePasses&&passes%2===0){cursor=p.points[0];previous=p.points[1];}else{cursor=p.points.at(-1);previous=p.points.at(-2);}
 }

 return result;
}
export function previewSegments(job){
 let cursor=[0,0];const segments=[];
 for(const [stepIndex,step] of job.steps.entries())for(const [commandIndex,command] of step.commands.entries()){const match=/^([MD])(-?\d+),(-?\d+)$/.exec(command);if(!match)continue;const end=[Number(match[3])/20,Number(match[2])/20];segments.push({stepIndex,bridge:step.bridgeCommands?.includes(commandIndex)||false,from:cursor,to:end,travel:match[1]==='M',operation:step.label.startsWith('Crease')?'crease':'cut',label:step.label});cursor=end;}
 return segments;
}
