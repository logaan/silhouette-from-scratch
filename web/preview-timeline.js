export class PreviewTimeline{
 constructor(segments){
  this.segments=segments;this.starts=[];this.lengths=[];this.stops=[0];this.total=0;this.position=0;
  for(let i=0;i<segments.length;i++){
   const s=segments[i],length=Math.hypot(s.to[0]-s.from[0],s.to[1]-s.from[1]);
   this.starts.push(this.total);this.lengths.push(length);this.total+=length;
   if(segments[i+1]?.stepIndex!==s.stepIndex&&this.total>this.stops.at(-1))this.stops.push(this.total);
  }
 }
 seek(position){this.position=Math.max(0,Math.min(this.total,position));return this.state();}
 step(direction){return this.seek(direction>0?this.stops.find(n=>n>this.position+1e-7)??this.total:this.stops.findLast(n=>n<this.position-1e-7)??0);}
 advance(distance){return this.seek(this.position+distance);}
 state(){
  if(!this.segments.length)return {index:-1,fraction:0,point:[0,0]};
  let low=0,high=this.starts.length;
  while(low<high){const mid=(low+high)>>1;if(this.starts[mid]<=this.position)low=mid+1;else high=mid;}
  const index=Math.max(0,low-1),s=this.segments[index],length=this.lengths[index],fraction=length?Math.min(1,(this.position-this.starts[index])/length):1;
  return {index,fraction,point:s.from.map((n,i)=>n+(s.to[i]-n)*fraction)};
 }
}
