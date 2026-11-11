import DxfParser from 'dxf-parser';
export const RED = 0xff0000, BLUE = 0x0000ff;
const finite = n => typeof n === 'number' && Number.isFinite(n);
export function bounds(paths) {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const p of paths) for(const [x,y] of p.points){if(!finite(x)||!finite(y))throw Error('Invalid coordinate');minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  return minX===Infinity?null:{minX,minY,maxX,maxY,width:maxX-minX,height:maxY-minY};
}
function sampleArc(center,rx,ry,start,sweep,rotation=0){
  const radius=Math.max(rx,ry), step=radius>0.025?2*Math.acos(1-0.025/radius):Math.PI/4;
  const n=Math.max(2,Math.ceil(Math.abs(sweep)/Math.min(step,Math.PI/12)));
  if(n>20000)throw Error('Curve is too large or complex');
  return Array.from({length:n+1},(_,i)=>{const a=start+sweep*i/n,x=rx*Math.cos(a),y=ry*Math.sin(a);return [center.x+x*Math.cos(rotation)-y*Math.sin(rotation),center.y+x*Math.sin(rotation)+y*Math.cos(rotation)];});
}
function polyPoints(e){
  const v=e.vertices, result=[];if(!v?.length)return [];
  for(let i=0;i<v.length;i++){
    const a=v[i],b=v[(i+1)%v.length]; result.push([a.x,a.y]);
    if(i===v.length-1&&!e.shape)break;
    if(a.bulge){const bulge=a.bulge, dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d===0)continue;
      const c={x:(a.x+b.x)/2-dy*(1-bulge*bulge)/(4*bulge),y:(a.y+b.y)/2+dx*(1-bulge*bulge)/(4*bulge)};
      result.push(...sampleArc(c,d*(1+bulge*bulge)/(4*Math.abs(bulge)),d*(1+bulge*bulge)/(4*Math.abs(bulge)),Math.atan2(a.y-c.y,a.x-c.x),4*Math.atan(bulge)).slice(1,-1));}
  }
  if(e.shape)result.push(result[0]);return result;
}
function entityPoints(e){
  const normal=e.extrusionDirection;
  if(normal && (normal.x||normal.y||normal.z!==1))throw Error('Non-XY extrusion is not supported; flatten the DXF first');
  if(e.vertices?.some(v=>v.z&&Math.abs(v.z)>1e-6)||e.center?.z)throw Error('3D geometry is not supported');
  switch(e.type){
    case 'LINE':return e.vertices.map(v=>[v.x,v.y]);
    case 'LWPOLYLINE':case 'POLYLINE': return polyPoints(e);
    case 'CIRCLE':return sampleArc(e.center,e.radius,e.radius,0,Math.PI*2);
    case 'ARC':{let sweep=e.endAngle-e.startAngle;if(sweep<=0)sweep+=2*Math.PI;return sampleArc(e.center,e.radius,e.radius,e.startAngle,sweep);}
    case 'ELLIPSE':{const a=e.majorAxisEndPoint;let sweep=e.endAngle-e.startAngle;if(sweep<=0)sweep+=2*Math.PI;return sampleArc(e.center,Math.hypot(a.x,a.y),Math.hypot(a.x,a.y)*e.axisRatio,e.startAngle,sweep,Math.atan2(a.y,a.x));}
    default:throw Error(`${e.type} is unsupported. Convert it to lines or polylines before importing.`);
  }
}
// Preserve true-colour precedence, including layer true colours omitted by dxf-parser.
function rawMetadata(text){
 const lines=text.split(/\r?\n/), records=[];let rec=null;
 for(let i=0;i+1<lines.length;i+=2){const code=Number(lines[i].trim()),value=lines[i+1].trim();if(code===0){rec={type:value,tags:{}};records.push(rec);}else if(rec)rec.tags[code]=value;}
 return records;
}
export function parseDXF(text,unitOverride=null){
 if(text.length>10_000_000)throw Error('DXF exceeds 10 MB');
 const d=new DxfParser().parseSync(text), records=rawMetadata(text);
 const rawByHandle=new Map(records.filter(r=>r.tags[5]).map(r=>[r.tags[5],r]));
 const layerRGB=new Map(records.filter(r=>r.type==='LAYER'&&r.tags[420]!==undefined).map(r=>[r.tags[2],Number(r.tags[420])]));
 const declared=d.header?.$INSUNITS||0, factors={1:25.4,2:304.8,4:1,5:10,6:1000};
 const factor=unitOverride==='inch'?25.4:unitOverride==='mm'?1:factors[declared];
 if(!factor)throw Error('DXF has no supported units. Select millimetres or inches under DXF units and import again.');
 const paths=[], warnings=[], counts={cut:0,crease:0,ignored:0};let vertices=0;
 function visit(e,transform=p=>p,parentRGB=null,parentLayer='0',depth=0){
  if(depth>10)throw Error('DXF block nesting is too deep');
  const raw=rawByHandle.get(e.handle)?.tags||{};
  const layerName=(e.layer==='0'&&parentLayer!=='0')?parentLayer:(e.layer||'0');
  const layer=d.tables?.layer?.layers?.[layerName];
  if(layer?.visible===false||layer?.frozen||e.visible===false){counts.ignored++;return;}
  let rgb=raw[420]!==undefined?Number(raw[420]):e.colorIndex===0?parentRGB:
    (e.colorIndex===undefined||e.colorIndex===256)?(layerRGB.get(layerName)??layer?.color??0xffffff):e.color;
  if(e.type==='INSERT'){
   const block=d.blocks?.[e.name];if(!block)throw Error(`Missing block ${e.name}`);
   if((e.rowCount||1)>1||(e.columnCount||1)>1)throw Error('Array inserts must be exploded before import');
   const a=(e.rotation||0)*Math.PI/180,base=block.position||{x:0,y:0};
   const t=p=>{const x=(p[0]-base.x)*(e.xScale??1),y=(p[1]-base.y)*(e.yScale??1);return transform([x*Math.cos(a)-y*Math.sin(a)+e.position.x,x*Math.sin(a)+y*Math.cos(a)+e.position.y]);};
   for(const child of block.entities||[])visit(child,t,rgb,layerName,depth+1);return;
  }
  const operation=rgb===RED?'cut':rgb===BLUE?'crease':'ignored';
  let pts;
  try{pts=entityPoints(e).map(transform).map(([x,y])=>[x*factor,y*factor]);}
  catch(err){if(operation!=='ignored')throw err;counts.ignored++;return;}
  if(pts.length<2){if(operation!=='ignored')throw Error('Empty drawing entity');counts.ignored++;return;}
  vertices+=pts.length;if(vertices>200000)throw Error('Drawing exceeds 200,000 vertices');
  counts[operation]++;paths.push({operation,points:pts,entity:e.type,handle:e.handle});
 }
 for(const e of d.entities||[])visit(e);
 // Reject unsupported top-level entities that the parser silently omitted.
 let inEntities=false;const parsed=new Set((d.entities||[]).map(e=>e.handle));
 for(const r of records){if(r.type==='SECTION')inEntities=r.tags[2]==='ENTITIES';if(r.type==='ENDSEC')inEntities=false;
  if(inEntities&&r.tags[5]&&!parsed.has(r.tags[5])&&!['VERTEX','SEQEND'].includes(r.type)){
   const layer=d.tables?.layer?.layers?.[r.tags[8]],rgb=r.tags[420]!==undefined?Number(r.tags[420]):r.tags[62]==='1'?RED:r.tags[62]==='5'?BLUE:!r.tags[62]||r.tags[62]==='256'?(layerRGB.get(r.tags[8])??layer?.color):null;
   if(rgb===RED||rgb===BLUE)throw Error(`Unsupported ${r.type} on a cut/crease colour. Convert it to polylines.`);
  }
 }
 if(!counts.cut&&!counts.crease)throw Error('No pure red or pure blue geometry found');
 const b=bounds(paths); // Keep ignored reference geometry for placement, never for output.
 for(const p of paths)p.points=p.points.map(([x,y])=>[x-b.minX,b.maxY-y]);
 return {paths,counts,width:b.width,height:b.height,units:declared,factor,warnings};
}
export function positioned(drawing,{x=0,y=0,rotation=0,scale=1}){
 if(![x,y,rotation,scale].every(finite)||scale<=0||scale>10)throw Error('Invalid placement');
 const a=rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 const paths=drawing.paths.map(p=>({...p,points:p.points.map(([px,py])=>[(px*c-py*s)*scale,(px*s+py*c)*scale])}));
 const b=bounds(paths);return paths.map(p=>({...p,points:p.points.map(([px,py])=>[px-b.minX+x,py-b.minY+y])}));
}
export function validateSettings(preset){
 for(const op of ['cut','crease']){const s=preset[op];if(!s)throw Error(`Missing ${op} settings`);
  for(const [key,lo,hi] of [['force',1,33],['speed',1,30],['passes',1,10]])if(!Number.isInteger(s[key])||s[key]<lo||s[key]>hi)throw Error(`${op} ${key} must be ${lo}–${hi}`);
  if(s.tool!==(op==='cut'?1:2))throw Error('Cut requires tool 1; crease requires tool 2');
 }
 if(!Number.isInteger(preset.cut.depth)||preset.cut.depth<0||preset.cut.depth>10)throw Error('Blade depth must be 0–10');return preset;
}
