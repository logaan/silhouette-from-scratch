const key=p=>p.map(n=>Math.round(n*20)).join(',');
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const aligned=(a,b,c,d)=>{const u=[b[0]-a[0],b[1]-a[1]],v=[d[0]-c[0],d[1]-c[1]],length=Math.hypot(...u);return length>0&&Math.abs(u[0]*v[1]-u[1]*v[0])<1e-7&&Math.abs(u[0]*(c[1]-b[1])-u[1]*(c[0]-b[0]))/length<.001;};
export function optimisePaths(paths){
 const remaining=paths.map(p=>({...p,points:p.points.map(pt=>[...pt])})),chains=[];
 while(remaining.length){
  const chain=remaining.shift();let changed=true;
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
 for(const p of chains){if(key(p.points[0])!==key(p.points.at(-1)))continue;const ring=p.points.slice(0,-1);let first=0;for(let i=1;i<ring.length;i++)if(distance([0,0],ring[i])<distance([0,0],ring[first]))first=i;p.points=[...ring.slice(first),...ring.slice(0,first),ring[first]];}
 const priority=new Map(chains.map(p=>[p,4]));
 for(const p of chains){const a=p.points[0],b=p.points.at(-1);if(key(a)===key(b)||!p.points.every(pt=>aligned(a,b,a,pt)))continue;for(const q of chains){if(q===p)continue;if(q.points.every(pt=>aligned(a,b,a,pt))){priority.set(p,Math.abs(b[1]-a[1])<.001?2:3);break;}}}
 const result=[];let cursor=[0,0],previous=null;
 while(chains.length){let best=null;
  for(let i=0;i<chains.length;i++)for(const reverse of [false,true]){
   const pts=chains[i].points,a=reverse?pts.at(-1):pts[0],b=reverse?pts.at(-2):pts[1];
   const rank=!result.length?0:previous&&aligned(previous,cursor,a,b)?(Math.abs(b[1]-a[1])<.001?0:1):priority.get(chains[i]),travel=distance(cursor,a);
   if(!best||rank<best.rank||rank===best.rank&&travel<best.travel)best={i,reverse,rank,travel};
  }
  const p=chains.splice(best.i,1)[0];if(best.reverse)p.points.reverse();result.push(p);previous=p.points.at(-2);cursor=p.points.at(-1);
 }
 return result;
}
export function previewSegments(job){
 let cursor=[0,0];const segments=[];
 for(const [stepIndex,step] of job.steps.entries())for(const command of step.commands){const match=/^([MD])(-?\d+),(-?\d+)$/.exec(command);if(!match)continue;const end=[Number(match[3])/20,Number(match[2])/20];segments.push({stepIndex,from:cursor,to:end,travel:match[1]==='M',operation:step.label.startsWith('Crease')?'crease':'cut',label:step.label});cursor=end;}
 return segments;
}
