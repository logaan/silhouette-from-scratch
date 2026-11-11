export function exportDXF(job){
 if(!job?.paths?.length||!Number.isFinite(job.sheet?.height))throw Error('Prepare a valid job before exporting.');
 const lines=[],tag=(code,value)=>lines.push(String(code),String(value)),point=n=>Number((Math.round(n*20)/20).toFixed(6));
 tag(0,'SECTION');tag(2,'HEADER');tag(9,'$ACADVER');tag(1,'AC1024');tag(9,'$INSUNITS');tag(70,4);tag(9,'$MEASUREMENT');tag(70,1);
 tag(9,'$EXTMIN');tag(10,0);tag(20,0);tag(30,0);tag(9,'$EXTMAX');tag(10,job.sheet.width);tag(20,job.sheet.height);tag(30,0);tag(0,'ENDSEC');
 tag(0,'SECTION');tag(2,'TABLES');tag(0,'TABLE');tag(2,'LAYER');tag(5,'10');tag(330,0);tag(100,'AcDbSymbolTable');tag(70,3);
 for(const [name,aci,rgb,handle] of [['0',7,0,'11'],['RED_CUT',1,0xff0000,'12'],['BLUE_CREASE',5,0x0000ff,'13']]){
  tag(0,'LAYER');tag(5,handle);tag(330,'10');tag(100,'AcDbSymbolTableRecord');tag(100,'AcDbLayerTableRecord');tag(2,name);tag(70,0);tag(62,aci);tag(420,rgb);tag(6,'CONTINUOUS');
 }
 tag(0,'ENDTAB');tag(0,'ENDSEC');tag(0,'SECTION');tag(2,'ENTITIES');
 let handle=256;
 for(const path of job.paths){
  if(!['cut','crease'].includes(path.operation))continue;
  const vertices=path.points.map(([x,y])=>{if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Cannot export invalid coordinates.');return [point(x),point(job.sheet.height-point(y))];}).filter((p,i,a)=>!i||p[0]!==a[i-1][0]||p[1]!==a[i-1][1]);
  if(vertices.length<2)throw Error('A path is smaller than the cutter resolution.');
  const first=vertices[0],last=vertices.at(-1),closed=vertices.length>2&&first[0]===last[0]&&first[1]===last[1];if(closed)vertices.pop();
  const cut=path.operation==='cut';
  tag(0,'LWPOLYLINE');tag(5,(handle++).toString(16).toUpperCase());tag(100,'AcDbEntity');tag(8,cut?'RED_CUT':'BLUE_CREASE');tag(62,cut?1:5);tag(420,cut?0xff0000:0x0000ff);tag(100,'AcDbPolyline');tag(90,vertices.length);tag(70,closed?1:0);
  for(const [x,y] of vertices){tag(10,x);tag(20,y);}
 }
 tag(0,'ENDSEC');tag(0,'EOF');return lines.join('\r\n')+'\r\n';
}
