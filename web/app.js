import {PreviewTimeline} from './preview-timeline.js';
import {bufferNotice} from './buffer-status.js';
import {DryRunCameo,isDryRun} from './dry-run.js';
import {previewSegments} from './order.js';
import {RISK_KEY,acknowledgementState,acknowledge} from './acknowledgement.js';
import {panView,zoomView} from './viewport.js';
import {parseDXF,positioned,bounds} from './geometry.js';
import {compileJob,MATS,OPTIMISATIONS,optimisationSettings,operationCount} from './job.js';
import {CameoBluetooth} from './bluetooth.js';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
let view=null,viewMat=null;
let config,drawing=null,job=null,reviewed=null,rawText='',busy=false,hasRun=false,liveRun=null;
let dryRun=isDryRun(),connecting=false;
const connectionChanged=state=>{$('connection').textContent=state;$('connect').textContent=dryRun?'Connect real Cameo ↗':device.connected?'Disconnect':'Connect Cameo ↗';updateRun();};
let device=new (dryRun?DryRunCameo:CameoBluetooth)(connectionChanged);

function toast(message){$('toast').textContent=message;$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,10000);}
function node(tag,attrs,parent){const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);parent.appendChild(el);return el;}
function options(){const size=config.sizes.find(s=>s.id===$('sheet').value);return {mat:$('mat').value,sheetWidth:$('landscape').checked?size.height_mm:size.width_mm,sheetHeight:$('landscape').checked?size.width_mm:size.height_mm,x:Number($('x').value),y:Number($('y').value),rotation:Number($('rotation').value),order:$('order').value,prepareTracking:$('prepare-tracking').checked,optimisations:{join:$('join-paths').checked,reorder:$('optimise').checked,collinear:$('collinear').checked,reversePasses:$('reverse-passes').checked,creaseBridges:$('crease-bridges').checked,continuousCreases:$('continuous-creases').checked,batching:$('batch-operations').checked}};}
function preset(){const p=structuredClone(config.materials.find(p=>p.id===$('material').value));for(const op of ['cut','crease'])for(const key of ['force','speed','passes',...(op==='cut'?['depth']:[])])p[op][key]=Number($(`${op}-${key}`).value);return p;}
function loadPreset(){const p=config.materials.find(p=>p.id===$('material').value);$('mat').value=p.mat;$('sheet').value=p.size;$('landscape').checked=false;for(const op of ['cut','crease'])for(const key of ['force','speed','passes',...(op==='cut'?['depth']:[])])$(`${op}-${key}`).value=p[op][key];render();}
function render(){
 if(!config)return;reviewed=null;job=null;$('crease-bridges').disabled=busy||$('order').value!=='crease-first';$('bridge-note').textContent=$('order').value!=='crease-first'?'Available when creasing before cutting.':'Follows short red sections to join blue creases without lifting. Added creasing is shown in teal.';
 const o=screen==='run'&&liveRun?liveRun.job.options:options(),mat=MATS[o.mat],art=$('mat-art'),draw=$('drawing-art');art.replaceChildren();draw.replaceChildren();
 if(viewMat!==o.mat){viewMat=o.mat;view={x:-18,y:-18,width:mat.width+36,height:mat.height+36};$('canvas').style.aspectRatio=`${mat.width+36} / ${mat.height+36}`;}
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
 $('validation').classList.toggle('invalid',!!drawing&&!valid);$('review').disabled=!valid||busy;$('download').disabled=!valid||busy;updateRun();if(screen==='preview'&&job)review();if(screen==='run')paintRun();
}
async function importText(text,name){try{const parsed=parseDXF(text,$('units').value==='auto'?null:$('units').value);rawText=text;drawing=parsed;$('filename').textContent=name;centreDrawing();}catch(err){drawing=null;rawText=text;$('filename').textContent=name;render();toast(err.message);}}
async function importFile(file){if(screen!=='design'||busy)return;if(!file)return;if(file.size>10_000_000)return toast('File exceeds 10 MB');await importText(await file.text(),file.name);}
function download(name,data,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function review(){if(!job)return;reviewed=structuredClone(job);const content=$('review-content');content.replaceChildren();
 const p=document.createElement('p');p.textContent=`${job.material} · ${MATS[job.mat].name} mat · ${job.sheet.width} × ${job.sheet.height} mm material`;content.appendChild(p);
 const table=document.createElement('table'),tr=document.createElement('tr');for(const h of ['Operation','Tool','Force','Speed','Depth','Passes']){const th=document.createElement('th');th.textContent=h;tr.appendChild(th);}table.appendChild(tr);
 for(const op of job.operations){const row=document.createElement('tr');for(const value of [op.operation,op.tool,op.force,op.speed,op.depth??'—',op.passes]){const td=document.createElement('td');td.textContent=value;row.appendChild(td);}table.appendChild(row);}content.appendChild(table);
 if(job.preparation.enabled){const preparation=document.createElement('p');preparation.textContent=`Before the first operation: feed the mat ${job.preparation.feedMm} mm and return to prepare tracking.`;content.appendChild(preparation);}
 const note=document.createElement('p');note.textContent=`${job.ignored} ignored entities excluded. Placement: ${job.options.x}, ${job.options.y} mm.`;content.appendChild(note);
 $('ready-check').checked=false;updateRun();preparePreview();if(screen!=='preview')navigate('preview');}
let riskRecord=null;
function readRisk(){
 try{const raw=localStorage.getItem(RISK_KEY);riskRecord=raw?JSON.parse(raw):null;}catch{}
 return riskRecord;
}
function saveRisk(record){riskRecord=record;try{localStorage.setItem(RISK_KEY,JSON.stringify(record));}catch{}}
function refreshRisk(){
 const state=acknowledgementState(readRisk());
 $('risk-form').hidden=!state.needsPhrase;$('risk-checkbox-label').hidden=state.needsPhrase;$('risk-check').checked=state.accepted;
 return state;
}
$('risk-form').addEventListener('submit',e=>{e.preventDefault();try{saveRisk(acknowledge(readRisk(),{phrase:$('risk-phrase').value}));$('risk-phrase').value='';$('risk-error').textContent='';updateRun();}catch(err){$('risk-error').textContent=err.message;}});
$('risk-check').addEventListener('change',()=>{try{saveRisk(acknowledge(readRisk(),{checked:$('risk-check').checked}));$('risk-error').textContent='';}catch(err){$('risk-error').textContent=err.message;}updateRun();});
window.addEventListener('storage',e=>{if(e.key===RISK_KEY||e.key===null)updateRun();});
window.addEventListener('focus',()=>updateRun());
document.addEventListener('visibilitychange',()=>{if(busy)device.log.push({time:new Date().toISOString(),direction:'event',type:'visibility-change',visibility:document.visibilityState});if(!document.hidden)updateRun();});
setInterval(()=>{if(screen==='preview')updateRun();},30000);
function updateRun(){const risk=refreshRisk();$('connect-next').disabled=!device.connected;$('wizard-next').disabled=busy||(screen==='connect'&&!device.connected)||(screen==='design'&&!job);$('run').disabled=!risk.accepted||!reviewed||!device.connected||!$('ready-check').checked||busy;$('run-note').textContent=device.connected?(dryRun?'Dry run only. No commands will be sent to hardware.':'Run sends this reviewed job to the Cameo.'):'Connect the Cameo using Chrome to continue.';}
function setBusy(value){busy=value;if(!value){$('resume').hidden=true;$('resume-confirm').hidden=true;$('stop').hidden=false;}for(const el of document.querySelectorAll('main input,main select,main button,#connect'))el.disabled=value;$('stop').disabled=!value;$('reset-view').disabled=false;if(!value){render();$('connect').disabled=false;showScreen('run');}updateRun();}
async function run(){if(!reviewed||busy||!device.connected||!$('ready-check').checked)return;if(!refreshRisk().accepted){updateRun();return;}const snapshot=reviewed;snapshot.build={commit:document.querySelector('.build-footer a').title,url:document.querySelector('.build-footer a').href};liveRun={job:snapshot,segments:previewSegments(snapshot),completed:-1,active:-1,phase:'starting'};$('progress').value=0;$('run-title').textContent=dryRun?'Simulating your job.':'Your job is in motion.';$('run-description').textContent=dryRun?'The simulated Cameo accepts every command without moving hardware.':'Keep the machine attended while it works.';hasRun=true;navigate('run');setBusy(true);
 try{device.batchLimit=optimisationSettings(snapshot.options).batching?4:1;device.batchBytes=2048;await device.run(snapshot,(p,label,detail={})=>{$('progress').value=p;$('progress-label').textContent=label;liveRun.phase=detail.phase;liveRun.outstanding=detail.outstanding||[];liveRun.active=detail.stepIndex??-1;if(detail.phase==='completed')liveRun.completed=detail.stepIndex;paintRun();});$('run-title').textContent=dryRun?'Dry run complete.':'Your job is complete.';$('run-description').textContent=dryRun?'The full job was accepted by the simulated Cameo. No hardware commands were sent.':'The Cameo reports ready. Your activity log is available below.';}
 catch(err){$('run-title').textContent='Job stopped.';$('progress-label').textContent=err.message;toast(err.message);}finally{setBusy(false);}}
$('file').addEventListener('change',e=>importFile(e.target.files[0]));
$('drop').addEventListener('dragover',e=>e.preventDefault());$('drop').addEventListener('drop',e=>{e.preventDefault();importFile(e.dataTransfer.files[0]);});
$('example').onclick=async()=>{try{const response=await fetch('./example.dxf');if(!response.ok)throw Error('Example unavailable');await importText(await response.text(),'Colour protocol test · 70 mm');}catch(err){toast(err.message);}};
$('units').onchange=()=>{if(rawText)importText(rawText,$('filename').textContent);};
for(const id of ['mat','sheet','landscape','prepare-tracking','x','y','rotation','order','show-ignored','cut-force','cut-speed','cut-depth','cut-passes','crease-force','crease-speed','crease-passes'])$(id).addEventListener('input',render);
$('material').onchange=loadPreset;$('reset').onclick=loadPreset;
function centreDrawing(){if(!drawing)return;const o=options(),b=bounds(positioned(drawing,{...o,x:0,y:0}));$('x').value=((o.sheetWidth-b.width)/2).toFixed(2);$('y').value=((o.sheetHeight-b.height)/2).toFixed(2);render();}
$('center').onclick=centreDrawing;
$('review').onclick=review;$('ready-check').onchange=updateRun;$('run').onclick=run;
$('download').onclick=()=>{if(job)download('silhouette-job-report.json',JSON.stringify(job,null,2));};
$('save-log').onclick=()=>download('silhouette-activity.json',JSON.stringify({version:2,build:{commit:document.querySelector('.build-footer a').title,url:document.querySelector('.build-footer a').href},mode:dryRun?'dry-run':'hardware',identity:device.identity||null,events:device.log},null,2));
$('choose-dry-run').onclick=async()=>{if(busy||connecting)return;device.disconnect();dryRun=true;device=new DryRunCameo(connectionChanged);$('dry-run-banner').hidden=false;await device.connect();navigate('material');};
$('connect').onclick=async()=>{if(busy||connecting)return;if(dryRun){device.disconnect();dryRun=false;device=new CameoBluetooth(connectionChanged);$('dry-run-banner').hidden=true;}if(device.connected){device.disconnect();return;}try{connecting=true;$('choose-dry-run').disabled=true;$('connect').disabled=true;$('connection').textContent='Choosing device…';await device.connect();navigate('material');}catch(err){toast(err.message);$('connection').textContent='Not connected';}finally{connecting=false;$('choose-dry-run').disabled=false;$('connect').disabled=false;updateRun();}};
$('stop').onclick=()=>{device.pause();$('stop').hidden=true;$('resume').hidden=false;$('resume').disabled=false;$('progress-label').textContent='Pause requested — already-sent operations will finish before sending pauses.';};
$('resume').onclick=()=>{$('resume-confirm').hidden=false;$('confirm-resume').disabled=false;$('cancel-resume').disabled=false;};
$('cancel-resume').onclick=()=>{$('resume-confirm').hidden=true;};
$('confirm-resume').onclick=()=>{$('resume-confirm').hidden=true;$('resume').hidden=true;$('stop').hidden=false;device.resume();$('progress-label').textContent='Resuming sending…';};
let drag=null;
function coord(e){const p=new DOMPoint(e.clientX,e.clientY);return p.matrixTransform($('canvas').getScreenCTM().inverse());}
function applyView(){if(view)$('canvas').setAttribute('viewBox',`${view.x} ${view.y} ${view.width} ${view.height}`);}
$('reset-view').onclick=()=>{const mat=MATS[viewMat];view={x:-18,y:-18,width:mat.width+36,height:mat.height+36};applyView();};
$('canvas').addEventListener('wheel',e=>{
 if(!view)return;e.preventDefault();
 const multiplier=e.deltaMode===1?16:e.deltaMode===2?$('canvas').clientHeight:1;
 if(e.ctrlKey){const mat=MATS[$('mat').value];view=zoomView(view,{width:mat.width+36,height:mat.height+36},e.deltaY*multiplier,coord(e));}
 else{const matrix=$('canvas').getScreenCTM();view=panView(view,e.deltaX*multiplier,e.deltaY*multiplier,view.width*matrix.a,view.height*matrix.d);}
 applyView();
},{passive:false});
$('drawing-art').addEventListener('pointerdown',e=>{if(screen!=='design'||busy||!drawing)return;e.preventDefault();const p=coord(e);drag={px:p.x,py:p.y,x:Number($('x').value),y:Number($('y').value)};$('canvas').setPointerCapture(e.pointerId);});
$('canvas').addEventListener('pointermove',e=>{if(!drag)return;const p=coord(e);$('x').value=Math.max(0,Math.round((drag.x+p.x-drag.px)*2)/2);$('y').value=Math.max(0,Math.round((drag.y+p.y-drag.py)*2)/2);render();});
$('canvas').addEventListener('pointerup',()=>drag=null);$('canvas').addEventListener('pointercancel',()=>drag=null);
$('canvas').addEventListener('keydown',e=>{if(screen!=='design'||busy||!drawing)return;const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(delta){e.preventDefault();$('x').value=Math.max(0,Number($('x').value)+delta[0]*(e.shiftKey?10:1));$('y').value=Math.max(0,Number($('y').value)+delta[1]*(e.shiftKey?10:1));render();}});

const screens=['connect','material','design','preview','run'];
let screen='connect',animation=null,segments=[],timeline=null,previewLines=[],previewRate=0,lastFrame=0;
const canvasPanel=document.querySelector('.canvas-panel');
function showScreen(next){
 if(!screens.includes(next))next='connect';
 if(!device.connected&&next!=='connect'&&!busy)next='connect';
 if(next==='preview'&&!job)next='design';
 if(next==='run'&&!busy&&!hasRun)next='design';
 stopPreview();screen=next;window.scrollTo(0,0);document.body.classList.toggle('previewing',screen==='preview');document.body.classList.toggle('running-view',screen==='run');document.body.dataset.screen=screen;
 for(const id of screens)$('screen-'+id).hidden=id!==screen;
 if(screen==='material')$('material-canvas').append(canvasPanel);else if(screen==='preview')$('preview-canvas').append(canvasPanel);else if(screen==='run')$('run-canvas').append(canvasPanel);else $('design-canvas').append(canvasPanel);
 $('wizard-nav').replaceChildren(...screens.map((id,i)=>{const item=document.createElement('button');item.type='button';item.disabled=busy||i>=screens.indexOf(screen);item.onclick=()=>{if(!busy&&i<screens.indexOf(screen))navigate(id);};item.className='wizard-step'+(id===screen?' current':i<screens.indexOf(screen)?' completed':'');if(id===screen)item.setAttribute('aria-current','step');const number=document.createElement('span');number.className='step-number';number.textContent=String(i+1).padStart(2,'0');item.append(number,document.createTextNode(id[0].toUpperCase()+id.slice(1)));return item;}));
 $('wizard-back').disabled=screen==='connect'||busy;
 $('wizard-next').hidden=screen==='preview'||screen==='run';
 $('connect-next').hidden=screen!=='connect';
 $('wizard-next').hidden=screen!=='material';$('wizard-next').textContent='Arrange design →';
 $('preview-art').replaceChildren();
 if(screen==='preview'){review();preparePreview();}if((screen==='run'||screen==='material'||screen==='design')&&config)render();
 updateRun();
}
function navigate(next){showScreen(next);history.pushState({screen},'',`#${screen}`);}
window.addEventListener('popstate',()=>{showScreen(busy?'run':location.hash.slice(1));history.replaceState({screen},'',`#${screen}`);});
$('wizard-back').onclick=()=>{if(!busy)history.back();};
$('connect-next').onclick=()=>{if(device.connected)navigate('material');};
$('wizard-next').onclick=()=>{if(busy)return;if(screen==='design')review();else navigate(screens[screens.indexOf(screen)+1]);};
$('box-example').onclick=async()=>{try{const response=await fetch('./box.dxf');if(!response.ok)throw Error('Example unavailable');await importText(await response.text(),'Eight-compartment box');}catch(err){toast(err.message);}};
function paintBridges(current){
 const art=$('bridge-art');art.replaceChildren();
 for(const p of current?.bridges||[])node('polyline',{points:p.points.map(pt=>pt.join(',')).join(' '),fill:'none',stroke:'#00877f','stroke-width':2,'stroke-dasharray':'3 2','vector-effect':'non-scaling-stroke'},art);
}
function paintRun(){
 const art=$('run-art');art.replaceChildren();if(!liveRun)return;paintBridges(liveRun.job);
 $('buffer-status').textContent=bufferNotice(liveRun,dryRun);
 const base=$('drawing-art');base.replaceChildren();
 for(const p of liveRun.job.paths)node('polyline',{points:p.points.map(pt=>pt.join(',')).join(' '),fill:'none',stroke:p.operation==='cut'?'#ed3c34':'#294ff0','stroke-width':1.2,'vector-effect':'non-scaling-stroke'},base);
 for(const s of liveRun.segments){
  const done=s.stepIndex<=liveRun.completed,active=(liveRun.outstanding?.includes(s.stepIndex)||s.stepIndex===liveRun.active)&&!done;
  if(!done&&!active)continue;
  const uncertain=active&&liveRun.phase==='failed';
  node('line',{x1:s.from[0],y1:s.from[1],x2:s.to[0],y2:s.to[1],stroke:uncertain?'#b47c22':s.bridge?'#00877f':s.travel?'#82907d':s.operation==='cut'?'#d64036':'#304cdd','stroke-width':s.travel?.6:1.5,'stroke-dasharray':s.travel?'2 2':active?'3 1':'none',class:active&&!uncertain?'live-path':'','vector-effect':'non-scaling-stroke'},art);
 }
 const total=operationCount(liveRun.job),completed=liveRun.job.steps.slice(0,liveRun.completed+1).filter(s=>/^(Cut|Crease) /.test(s.label)).length;
 $('live-note').textContent=`${completed} of ${total} operations confirmed complete. `+(liveRun.phase==='failed'?'The amber path was not confirmed complete.':liveRun.phase==='complete'?'All operations completed.':liveRun.outstanding?.length>1?'Highlighted paths are the outstanding batch; the exact active operation is unknown.':'The animated path is active; exact tool position is not reported.');
}
function updateTransport(){
 const playing=animation!==null,play=$('play-preview');
 play.setAttribute('aria-label',playing?'Pause preview':'Play preview');play.title=playing?'Pause preview':'Play preview';
 play.querySelector('.play-icon').toggleAttribute('hidden',playing);play.querySelector('.pause-icon').toggleAttribute('hidden',!playing);
 $('rewind-preview').setAttribute('aria-pressed',String(playing&&previewRate<0));$('forward-preview').setAttribute('aria-pressed',String(playing&&previewRate>200));
}
function stopPreview(){if(animation!==null)cancelAnimationFrame(animation);animation=null;lastFrame=0;previewRate=0;updateTransport();}
function preparePreview(){
 stopPreview();segments=job?previewSegments(job):[];timeline=new PreviewTimeline(segments);$('preview-art').replaceChildren();
 previewLines=segments.map(s=>node('line',{x1:s.from[0],y1:s.from[1],x2:s.to[0],y2:s.to[1],stroke:s.bridge?'#00877f':s.travel?'#747b76':s.operation==='cut'?'#a90000':'#001aa9','stroke-width':s.travel?.5:1.5,'stroke-dasharray':s.travel?'2 2':'none',display:'none'},$('preview-art')));
 node('circle',{id:'preview-marker',r:2,fill:'#1d352a',stroke:'#fff','stroke-width':.5},$('preview-art'));
 const travel=segments.filter(s=>s.travel).reduce((n,s)=>n+Math.hypot(s.to[0]-s.from[0],s.to[1]-s.from[1]),0);const total=job?operationCount(job):0,enabled=job&&Object.values(optimisationSettings(job.options)).some(Boolean),before=enabled?operationCount(compileJob(drawing,{...options(),optimisations:Object.fromEntries(OPTIMISATIONS.map(k=>[k,false]))},preset())):total;
 $('preview-count').textContent=enabled?`${total} operations · ${before} before optimisation`:`${total} operations`;
 $('bridge-stats').textContent=job?.bridges.length?`${job.bridges.length} cut-line connections · ${job.bridges.reduce((n,b)=>n+b.length,0).toFixed(1)} mm extra creasing per pass (teal).`:job?.bridgeLimited?'Cut-line joining skipped: this drawing exceeds the analysis limit.':job&&optimisationSettings(job.options).creaseBridges&&job.options.order==='crease-first'?'No short cut-line connections found.':'';

 $('preview-stats').textContent=`Each uninterrupted tool-down path counts as one operation, including joined repeat crease passes. ${travel.toFixed(0)} mm travel. Step buttons move one operation; rewind and fast forward play at 4×. Animation is illustrative, not an estimated run time.`;
 paintBridges(job);paintPreview();
}
function paintPreview(){
 if(!timeline)return;const state=timeline.state();
 for(let i=0;i<previewLines.length;i++){
  const line=previewLines[i],s=segments[i],visible=i<=state.index&&timeline.position>0;
  if(line.getAttribute('display')!==(visible?'inline':'none'))line.setAttribute('display',visible?'inline':'none');
  const end=i===state.index?state.point:s.to;
  if(line.getAttribute('x2')!==String(end[0]))line.setAttribute('x2',end[0]);
  if(line.getAttribute('y2')!==String(end[1]))line.setAttribute('y2',end[1]);
 }
 const marker=$('preview-marker');if(marker){marker.setAttribute('cx',state.point[0]);marker.setAttribute('cy',state.point[1]);}
 const s=segments[state.index],steps=[...new Set(segments.filter(s=>/^(Cut|Crease) /.test(s.label)).map(s=>s.stepIndex))],operation=steps.indexOf(s?.stepIndex)+1;
 const mode=previewRate<0?'Rewinding · ':previewRate>200?'Fast forward · ':'';
 $('preview-status').textContent=timeline.position===0?'Ready to preview':timeline.position===timeline.total?'Preview complete':`${mode}${operation?'Operation '+operation+' of '+steps.length+' · ':''}${s?.travel?'Travel · ':''}${s?.label||''}`;
 $('back-preview').disabled=timeline.position<=0;$('rewind-preview').disabled=timeline.position<=0;
 $('next-preview').disabled=timeline.position>=timeline.total;$('forward-preview').disabled=timeline.position>=timeline.total;
}
function frame(time){
 if(lastFrame)timeline.advance(Math.min(time-lastFrame,100)/1000*previewRate);lastFrame=time;paintPreview();
 if(previewRate>0&&timeline.position>=timeline.total||previewRate<0&&timeline.position<=0){stopPreview();paintPreview();}else animation=requestAnimationFrame(frame);
}
function playPreview(rate){
 stopPreview();if(!timeline?.total)return;
 if(rate>0&&timeline.position>=timeline.total)timeline.seek(0);
 previewRate=rate;animation=requestAnimationFrame(frame);updateTransport();paintPreview();
}
$('play-preview').onclick=()=>{if(animation!==null){stopPreview();paintPreview();}else playPreview(200);};
$('restart-preview').onclick=()=>{stopPreview();timeline?.seek(0);paintPreview();};
$('back-preview').onclick=()=>{stopPreview();timeline?.step(-1);paintPreview();};
$('next-preview').onclick=()=>{stopPreview();timeline?.step(1);paintPreview();};
$('rewind-preview').onclick=()=>playPreview(-800);
$('forward-preview').onclick=()=>playPreview(800);
for(const id of ['optimise','join-paths','collinear','reverse-passes','crease-bridges','continuous-creases','batch-operations'])$(id).onchange=render;
history.replaceState({screen:'connect'},'','#connect');showScreen('connect');
try{const res=await fetch('./config.json');if(!res.ok)throw Error('Material configuration unavailable. Run npm run build.');config=await res.json();for(const [id,items]of [['material',config.materials],['sheet',config.sizes]])for(const item of items){const op=document.createElement('option');op.value=item.id;op.textContent=item.name;$(id).appendChild(op);}$('sheet').value='a3';$('material').value='makr-180gsm-paper-cardstock';loadPreset();if(dryRun){$('dry-run-banner').hidden=false;await device.connect();navigate('material');}else if(!navigator.bluetooth)$('connection').textContent='Chrome required for Bluetooth';else{try{connecting=true;$('choose-dry-run').disabled=true;$('connect').disabled=true;$('connection').textContent='Checking saved connection…';if(await device.reconnect())navigate('material');else $('connection').textContent='Not connected';}catch{$('connection').textContent='Could not reconnect. Turn on your Cameo and connect below.';}finally{connecting=false;$('choose-dry-run').disabled=false;$('connect').disabled=false;}}}catch(err){toast(err.message);}
