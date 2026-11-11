import {RISK_KEY,acknowledgementState,acknowledge} from './acknowledgement.js';
import {panView,zoomView} from './viewport.js';
import {parseDXF,positioned,bounds} from './geometry.js';
import {compileJob,MATS} from './job.js';
import {CameoBluetooth} from './bluetooth.js';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
let view=null,viewMat=null;
let config,drawing=null,job=null,reviewed=null,rawText='',busy=false;
const device=new CameoBluetooth(state=>{$('connection').textContent=state;$('connect').textContent=device.connected?'Disconnect':'Connect Cameo ↗';updateRun();});
function toast(message){$('toast').textContent=message;$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,10000);}
function node(tag,attrs,parent){const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);parent.appendChild(el);return el;}
function options(){const size=config.sizes.find(s=>s.id===$('sheet').value);return {mat:$('mat').value,sheetWidth:$('landscape').checked?size.height_mm:size.width_mm,sheetHeight:$('landscape').checked?size.width_mm:size.height_mm,x:Number($('x').value),y:Number($('y').value),rotation:Number($('rotation').value),order:$('order').value};}
function preset(){const p=structuredClone(config.materials.find(p=>p.id===$('material').value));for(const op of ['cut','crease'])for(const key of ['force','speed','passes',...(op==='cut'?['depth']:[])])p[op][key]=Number($(`${op}-${key}`).value);return p;}
function loadPreset(){const p=config.materials.find(p=>p.id===$('material').value);for(const op of ['cut','crease'])for(const key of ['force','speed','passes',...(op==='cut'?['depth']:[])])$(`${op}-${key}`).value=p[op][key];$('preset-note').textContent=p.notes||'';render();}
function render(){
 if(!config)return;reviewed=null;job=null;
 const o=options(),mat=MATS[o.mat],art=$('mat-art'),draw=$('drawing-art');art.replaceChildren();draw.replaceChildren();
 if(viewMat!==o.mat){viewMat=o.mat;view={x:-18,y:-18,width:mat.width+36,height:mat.height+36};}
 applyView();$('mat-label').textContent=mat.name;
 node('rect',{x:-10,y:-10,width:mat.width+20,height:mat.height+20,rx:5,fill:'#e0e8da'},art);
 node('rect',{width:mat.width,height:mat.height,fill:'#f1f5ed',stroke:'#b0c4a6','stroke-width':.5},art);
 node('rect',{width:o.sheetWidth,height:o.sheetHeight,fill:'#fff',stroke:'#b4bdac','stroke-width':.5},art);
 node('rect',{width:mat.width,height:mat.height,fill:'url(#fine-grid)'},art);node('rect',{width:mat.width,height:mat.height,fill:'url(#grid)'},art);
 node('rect',{x:3,y:3,width:Math.max(0,o.sheetWidth-6),height:Math.max(0,o.sheetHeight-6),fill:'none',stroke:'#aebbaa','stroke-width':.35,'stroke-dasharray':'2 2'},art);
 for(let i=0;i<=mat.width/25.4;i++){const t=node('text',{x:i*25.4,y:-4,'text-anchor':'middle','font-size':3.5,fill:'#81917a'},art);t.textContent=i;}
 for(let i=1;i<=mat.height/25.4;i++){const t=node('text',{x:-5,y:i*25.4,'text-anchor':'middle','font-size':3.5,fill:'#81917a'},art);t.textContent=i;}
 $('empty').hidden=!!drawing;$('counts').textContent=drawing?`${drawing.counts.cut} cut · ${drawing.counts.crease} crease · ${drawing.counts.ignored} ignored`:'Pure #FF0000 and #0000FF only.';
 let valid=false;
 try{
  if(!drawing)throw Error('Import a drawing to prepare a job.');
  const paths=positioned(drawing,o),b=bounds(paths);
  node('rect',{x:b.minX-1,y:b.minY-1,width:b.width+2,height:b.height+2,fill:'transparent',stroke:'#6a997f','stroke-width':.3,'stroke-dasharray':'2 2'},draw);
  for(const p of paths){if(p.operation==='ignored'&&!$('show-ignored').checked)continue;node('polyline',{points:p.points.map(pt=>pt.join(',')).join(' '),fill:'none',stroke:p.operation==='cut'?'#ed3c34':p.operation==='crease'?'#294ff0':'#b3b7af','stroke-width':1.2,'vector-effect':'non-scaling-stroke','stroke-linejoin':'round'},draw);}
  $('dimensions').textContent=`Drawing: ${b.width.toFixed(1)} × ${b.height.toFixed(1)} mm. Drag to position.`;
  job=compileJob(drawing,o,preset());valid=true;
  $('validation').textContent=`Fits your material. ${job.operations.map(op=>`${op.pathCount} ${op.operation} paths × ${op.passes} pass${op.passes>1?'es':''}`).join(' · ')}.`;
 }catch(err){$('validation').textContent=err.message;}
 $('validation').classList.toggle('invalid',!!drawing&&!valid);$('review').disabled=!valid||busy;$('download').disabled=!valid||busy;updateRun();
}
async function importText(text,name){try{const parsed=parseDXF(text,$('units').value==='auto'?null:$('units').value);rawText=text;drawing=parsed;$('filename').textContent=name;render();}catch(err){drawing=null;rawText=text;$('filename').textContent=name;render();toast(err.message);}}
async function importFile(file){if(busy)return;if(!file)return;if(file.size>10_000_000)return toast('File exceeds 10 MB');await importText(await file.text(),file.name);}
function download(name,data,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function review(){if(!job)return;reviewed=structuredClone(job);const content=$('review-content');content.replaceChildren();
 const p=document.createElement('p');p.textContent=`${job.material} · ${MATS[job.mat].name} mat · ${job.sheet.width} × ${job.sheet.height} mm material`;content.appendChild(p);
 const table=document.createElement('table'),tr=document.createElement('tr');for(const h of ['Operation','Tool','Force','Speed','Depth','Passes']){const th=document.createElement('th');th.textContent=h;tr.appendChild(th);}table.appendChild(tr);
 for(const op of job.operations){const row=document.createElement('tr');for(const value of [op.operation,op.tool,op.force,op.speed,op.depth??'—',op.passes]){const td=document.createElement('td');td.textContent=value;row.appendChild(td);}table.appendChild(row);}content.appendChild(table);
 const note=document.createElement('p');note.textContent=`${job.ignored} ignored entities excluded. ${job.bytes.toLocaleString()} bytes prepared. Placement: ${job.options.x}, ${job.options.y} mm.`;content.appendChild(note);
 $('ready-check').checked=false;updateRun();$('review-dialog').showModal();}
let riskRecord=null,riskStorageAvailable=true;
function readRisk(){
 try{const raw=localStorage.getItem(RISK_KEY);riskRecord=raw?JSON.parse(raw):null;}catch{riskStorageAvailable=false;}
 return riskRecord;
}
function saveRisk(record){riskRecord=record;try{localStorage.setItem(RISK_KEY,JSON.stringify(record));}catch{riskStorageAvailable=false;}}
function refreshRisk(){
 const state=acknowledgementState(readRisk());
 $('risk-form').hidden=!state.needsPhrase;$('risk-checkbox-label').hidden=state.needsPhrase;$('risk-check').checked=state.accepted;
 $('risk-help').textContent=riskStorageAvailable?'Confirm once each day. Retype the phrase every three months. Saved in this browser only.':'Browser storage is unavailable. This acknowledgement lasts only for this open page.';
 return state;
}
$('risk-form').addEventListener('submit',e=>{e.preventDefault();try{saveRisk(acknowledge(readRisk(),{phrase:$('risk-phrase').value}));$('risk-phrase').value='';$('risk-error').textContent='';updateRun();}catch(err){$('risk-error').textContent=err.message;}});
$('risk-check').addEventListener('change',()=>{try{saveRisk(acknowledge(readRisk(),{checked:$('risk-check').checked}));$('risk-error').textContent='';}catch(err){$('risk-error').textContent=err.message;}updateRun();});
window.addEventListener('storage',e=>{if(e.key===RISK_KEY||e.key===null)updateRun();});
window.addEventListener('focus',()=>updateRun());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateRun();});
setInterval(()=>{if($('review-dialog').open)updateRun();},30000);
function updateRun(){const risk=refreshRisk();$('run').disabled=!risk.accepted||!reviewed||!device.connected||!$('ready-check').checked||busy;$('run-note').textContent=device.connected?'Run sends this reviewed job to the Cameo.':'Connect the Cameo using Chrome to run. Offline review is available now.';}
function setBusy(value){busy=value;for(const el of document.querySelectorAll('.workspace input,.workspace select,.workspace button,#connect'))el.disabled=value;$('stop').disabled=!value;if(!value){render();$('connect').disabled=false;}updateRun();}
async function run(){if(!reviewed||busy||!device.connected||!$('ready-check').checked)return;if(!refreshRisk().accepted){updateRun();return;}const snapshot=reviewed;$('review-dialog').close();setBusy(true);
 try{await device.run(snapshot,(p,label)=>{$('progress').value=p;$('progress-label').textContent=label;});}
 catch(err){$('progress-label').textContent=err.message;toast(err.message);}finally{setBusy(false);}}
$('file').addEventListener('change',e=>importFile(e.target.files[0]));
$('drop').addEventListener('dragover',e=>e.preventDefault());$('drop').addEventListener('drop',e=>{e.preventDefault();importFile(e.dataTransfer.files[0]);});
$('example').onclick=async()=>{try{const response=await fetch('./example.dxf');if(!response.ok)throw Error('Example unavailable');await importText(await response.text(),'Colour protocol test · 70 mm');}catch(err){toast(err.message);}};
$('units').onchange=()=>{if(rawText)importText(rawText,$('filename').textContent);};
for(const id of ['mat','sheet','landscape','x','y','rotation','order','show-ignored','cut-force','cut-speed','cut-depth','cut-passes','crease-force','crease-speed','crease-passes'])$(id).addEventListener('input',render);
$('material').onchange=loadPreset;$('reset').onclick=loadPreset;
$('center').onclick=()=>{if(!drawing)return;const o=options(),b=bounds(positioned(drawing,{...o,x:0,y:0}));$('x').value=((o.sheetWidth-b.width)/2).toFixed(2);$('y').value=((o.sheetHeight-b.height)/2).toFixed(2);render();};
$('review').onclick=review;$('ready-check').onchange=updateRun;$('run').onclick=run;
$('download').onclick=()=>{if(job)download('silhouette-job-report.json',JSON.stringify(job,null,2));};
$('save-log').onclick=()=>download('silhouette-activity.json',JSON.stringify({identity:device.identity||null,events:device.log},null,2));
$('connect').onclick=async()=>{if(device.connected){device.disconnect();return;}try{$('connect').disabled=true;$('connection').textContent='Choosing device…';await device.connect();}catch(err){toast(err.message);$('connection').textContent='Not connected';}finally{$('connect').disabled=false;updateRun();}};
$('stop').onclick=()=>{device.stop();$('progress-label').textContent='Sending stopped. Press the machine’s pause button to halt buffered movement.';};
let drag=null;
function coord(e){const p=new DOMPoint(e.clientX,e.clientY);return p.matrixTransform($('canvas').getScreenCTM().inverse());}
function applyView(){if(view)$('canvas').setAttribute('viewBox',`${view.x} ${view.y} ${view.width} ${view.height}`);}
$('reset-view').onclick=()=>{viewMat=null;render();};
$('canvas').addEventListener('wheel',e=>{
 if(!view)return;e.preventDefault();
 const multiplier=e.deltaMode===1?16:e.deltaMode===2?$('canvas').clientHeight:1;
 if(e.ctrlKey){const mat=MATS[$('mat').value];view=zoomView(view,{width:mat.width+36,height:mat.height+36},e.deltaY*multiplier,coord(e));}
 else{const matrix=$('canvas').getScreenCTM();view=panView(view,e.deltaX*multiplier,e.deltaY*multiplier,view.width*matrix.a,view.height*matrix.d);}
 applyView();
},{passive:false});
$('drawing-art').addEventListener('pointerdown',e=>{if(busy||!drawing)return;e.preventDefault();const p=coord(e);drag={px:p.x,py:p.y,x:Number($('x').value),y:Number($('y').value)};$('canvas').setPointerCapture(e.pointerId);});
$('canvas').addEventListener('pointermove',e=>{if(!drag)return;const p=coord(e);$('x').value=Math.max(0,Math.round((drag.x+p.x-drag.px)*2)/2);$('y').value=Math.max(0,Math.round((drag.y+p.y-drag.py)*2)/2);render();});
$('canvas').addEventListener('pointerup',()=>drag=null);$('canvas').addEventListener('pointercancel',()=>drag=null);
$('canvas').addEventListener('keydown',e=>{if(busy||!drawing)return;const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(delta){e.preventDefault();$('x').value=Math.max(0,Number($('x').value)+delta[0]*(e.shiftKey?10:1));$('y').value=Math.max(0,Number($('y').value)+delta[1]*(e.shiftKey?10:1));render();}});
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
try{const res=await fetch('./config.json');if(!res.ok)throw Error('Material configuration unavailable. Run npm run build.');config=await res.json();for(const [id,items]of [['material',config.materials],['sheet',config.sizes]])for(const item of items){const op=document.createElement('option');op.value=item.id;op.textContent=item.name;$(id).appendChild(op);}$('sheet').value='a4';$('material').value='quill-100gsm-tracing-paper';loadPreset();if(!navigator.bluetooth)$('connection').textContent='Chrome required for Bluetooth';}catch(err){toast(err.message);}
