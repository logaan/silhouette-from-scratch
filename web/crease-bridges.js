const key=p=>p.map(n=>Math.round(n*20)).join(',');
const edgeKey=(a,b)=>[key(a),key(b)].sort().join('|');
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const quantise=p=>p.map(n=>Math.round(n*20)/20);
const onSegment=(p,a,b)=>Math.abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))<1e-7&&p[0]>=Math.min(a[0],b[0])-1e-7&&p[0]<=Math.max(a[0],b[0])+1e-7&&p[1]>=Math.min(a[1],b[1])-1e-7&&p[1]<=Math.max(a[1],b[1])+1e-7;
export function joinCreasesThroughCuts(creases,cuts,{maxBridge=20,maxDetour=5}={}){
 const chains=creases.map(p=>({...p,points:p.points.map(quantise)})),red=cuts.flatMap(p=>p.points.slice(1).map((b,i)=>[quantise(p.points[i]),quantise(b)])),blue=chains.flatMap(p=>p.points.slice(1).map((b,i)=>[p.points[i],b]));
 const endpoints=chains.flatMap((p,i)=>key(p.points[0])===key(p.points.at(-1))?[]:[{id:i*2,chain:i,point:p.points[0]},{id:i*2+1,chain:i,point:p.points.at(-1)}]);
 const nodes=new Map([...red.flat(),...chains.flatMap(p=>p.points)].map(p=>[key(p),p]));
 if(red.length*(nodes.size+blue.length)>4_000_000||endpoints.length>2000)return {paths:creases,bridges:[],limited:true};
 const graph=new Map([...nodes.keys()].map(k=>[k,[]]));
 for(const [a,b] of red){
  const points=[...nodes.values()].filter(p=>onSegment(p,a,b)).sort((p,q)=>distance(a,p)-distance(a,q));
  for(let i=1;i<points.length;i++){
   const from=points[i-1],to=points[i],length=distance(from,to);if(!length)continue;
   if(blue.some(([c,d])=>onSegment(from,c,d)&&onSegment(to,c,d)))continue;
   const x=key(from),y=key(to);graph.get(x).push({to:y,length});graph.get(y).push({to:x,length});
  }
 }
 const candidates=[];
 for(const source of endpoints){
  const start=key(source.point),dist=new Map([[start,0]]),previous=new Map(),open=new Set([start]);
  while(open.size){
   let current;for(const k of open)if(current===undefined||dist.get(k)<dist.get(current))current=k;open.delete(current);
   for(const edge of graph.get(current)||[]){const next=dist.get(current)+edge.length;if(next<=maxBridge&&next<(dist.get(edge.to)??Infinity)){dist.set(edge.to,next);previous.set(edge.to,current);open.add(edge.to);}}
  }
  for(const target of endpoints){
   if(target.id<=source.id||target.chain===source.chain)continue;
   const end=key(target.point),length=dist.get(end);if(length===undefined||length===0||length>distance(source.point,target.point)+maxDetour)continue;
   const route=[end];let current=end;while(current!==start){current=previous.get(current);route.push(current);}
   candidates.push({source:source.id,target:target.id,length,points:route.reverse().map(k=>nodes.get(k))});
  }
 }
 candidates.sort((a,b)=>a.length-b.length||a.source-b.source||a.target-b.target);
 const remaining=new Set(chains),owners=new Map(endpoints.map(e=>[e.id,chains[e.chain]])),ends=new Map(chains.map((p,i)=>[p,[i*2,i*2+1]])),used=new Set(),bridges=[];
 for(const candidate of candidates){
  const a=owners.get(candidate.source),b=owners.get(candidate.target);if(!a||!b||a===b)continue;
  const bridgeEdges=candidate.points.slice(1).map((p,i)=>edgeKey(candidate.points[i],p));if(bridgeEdges.some(k=>used.has(k)))continue;
  const ae=ends.get(a),be=ends.get(b),left=ae[1]===candidate.source?a.points:[...a.points].reverse(),right=be[0]===candidate.target?b.points:[...b.points].reverse();
  const joined={...a,points:[...left,...candidate.points.slice(1),...right.slice(1)]},outer=[ae.find(id=>id!==candidate.source),be.find(id=>id!==candidate.target)];
  remaining.delete(a);remaining.delete(b);remaining.add(joined);ends.set(joined,outer);owners.delete(candidate.source);owners.delete(candidate.target);outer.forEach(id=>owners.set(id,joined));
  bridgeEdges.forEach(k=>used.add(k));bridges.push({points:candidate.points,length:candidate.length});
 }
 return {paths:[...remaining],bridges,limited:false};
}
export const bridgeEdgeKey=edgeKey;
