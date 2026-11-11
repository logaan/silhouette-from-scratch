import {joinCreasesThroughCuts,bridgeEdgeKey} from './crease-bridges.js';
import {optimisePaths} from './order.js';
import {bounds,positioned,validateSettings} from './geometry.js';
export const MATS={'12x12':{name:'12 × 12 in',width:304.8,height:304.8,code:1},'12x24':{name:'12 × 24 in',width:304.8,height:609.6,code:2}};
const su=n=>Math.round(n*20);
export const OPTIMISATIONS=['join','reorder','collinear','reversePasses','creaseBridges','continuousCreases','batching'];
export function optimisationSettings(options){
 return options.optimisations?Object.fromEntries(OPTIMISATIONS.map(key=>[key,options.optimisations[key]===true])):{join:!!options.optimise,reorder:!!options.optimise,collinear:!!options.optimise,reversePasses:!!options.optimise,creaseBridges:!!options.optimise&&!!options.creaseBridges,continuousCreases:false,batching:false};
}
export const operationCount=job=>job.operations.reduce((n,o)=>n+(o.operationCount??o.pathCount*o.passes),0);
export function compileJob(drawing,options,preset){
 validateSettings(preset);const flags=optimisationSettings(options);
 const mat=MATS[options.mat];if(!mat)throw Error('Choose a mat size');
 const {sheetWidth, sheetHeight}=options;
 if(![sheetWidth,sheetHeight].every(n=>Number.isFinite(n)&&n>0))throw Error('Invalid material size');
 if(sheetWidth>mat.width+0.001||sheetHeight>mat.height+0.001)throw Error('The material does not fit this mat. Rotate the sheet or choose the larger mat.');
 const paths=positioned(drawing,options),active=paths.filter(p=>p.operation==='cut'||p.operation==='crease');
 if(!active.length)throw Error('No red or blue paths to run');
 const b=bounds(active),margin=3;
 if(b.minX<margin||b.minY<margin||b.maxX>sheetWidth-margin||b.maxY>sheetHeight-margin)throw Error('Keep cut and crease paths at least 3 mm inside the material edges.');
 if(!['crease-first','cut-first'].includes(options.order))throw Error('Invalid operation order');
 const groups=options.order==='cut-first'?['cut','crease']:['crease','cut'];
 const preparation={enabled:options.prepareTracking===true,feedMm:options.prepareTracking===true?279.8:0};
 const initial=[`TG${mat.code}`,'FN0','TB50,0','FM0','TR0,1'];
 const area=['FY1','\\0,0',`Z${su(mat.height)},${su(mat.width)}`],operations=[];
 const steps=preparation.enabled?[
  {label:`Prepare material tracking · ${preparation.feedMm} mm feed and return`,commands:[...initial,'FY0',`FU${su(preparation.feedMm)}`],wait:true},
  {label:'Set working area',commands:area,wait:true}
 ]:[{label:'Set mat',commands:[...initial,...area],wait:true}];

 const orderedPaths=[],bridges=[];let bridgeLimited=false,cursor=[0,0];
 for(const op of groups){
  const continuous=op==='crease'&&flags.continuousCreases,reverse=flags.reversePasses||continuous,ordering={...flags,passes:preset[op].passes,reversePasses:reverse,start:cursor};
  let group=optimisePaths(active.filter(p=>p.operation===op),ordering);
  if(op==='crease'&&flags.creaseBridges&&options.order==='crease-first'){
   const joined=joinCreasesThroughCuts(group,active.filter(p=>p.operation==='cut'));
   group=optimisePaths(joined.paths,{...ordering,join:false});bridges.push(...joined.bridges);bridgeLimited=joined.limited;
  }
  if(!group.length)continue;
  orderedPaths.push(...group);
  const bridgeEdges=new Set(bridges.flatMap(p=>p.points.slice(1).map((b,i)=>bridgeEdgeKey(p.points[i],b))));
  const s=preset[op],t=s.tool,offset=op==='cut'?18:0,corner=op==='cut'?1:0;
  steps.push({label:`Set ${op} tool`,commands:[`J${t}`,`FX${s.force},${t}`,'TJ1',`!${s.speed},${t}`,'APS0',`FC${offset},1,${t}`,`FE0,${t}`,`FF${corner},${corner},${t}`,'FY1',...(op==='cut'?[`TF${s.depth},1`]:[])],wait:true});
  operations.push({operation:op,tool:t,...s,pathCount:group.length,operationCount:group.length*(continuous?1:s.passes),continuousPasses:continuous});
  for(let i=0;i<group.length;i++){
   let combined=null;
   for(let pass=0;pass<s.passes;pass++){
    const pathPoints=reverse&&pass%2===1?[...group[i].points].reverse():group[i].points;
    const points=pathPoints.map(([x,y])=>[su(x),su(y)]).filter((p,i,a)=>!i||p[0]!==a[i-1][0]||p[1]!==a[i-1][1]);
    if(points.length<2)throw Error('A path is smaller than the cutter resolution (0.05 mm)');
    const step=continuous&&combined?combined:{label:`${op==='cut'?'Cut':'Crease'} ${i+1}/${group.length} · ${continuous&&s.passes>1?s.passes+' continuous passes':'pass '+(pass+1)+'/'+s.passes}`,commands:[],bridgeCommands:[],commandPasses:[],wait:true};
    for(let n=continuous&&pass>0?1:0;n<points.length;n++){
     const [x,y]=points[n],index=step.commands.length;
     if(op==='crease'&&n&&bridgeEdges.has(bridgeEdgeKey(points[n-1].map(v=>v/20),points[n].map(v=>v/20))))step.bridgeCommands.push(index);
     step.commands.push(`${n?'D':'M'}${y},${x}`);step.commandPasses.push(pass+1);cursor=[x/20,y/20];
    }
    if(!continuous||!combined)steps.push(step);
    if(continuous)combined=step;
   }
  }
 }
 steps.push({label:'Return to origin',commands:['L0','\\0,0','M0,0','TR0,0','J1','FN0','TB50,0'],wait:true});
 const bytes=steps.reduce((sum,s)=>sum+s.commands.join('\x03').length+s.commands.length,0);
 if(bytes>5_000_000)throw Error('Job exceeds 5 MB of commands');
 return {version:1,kind:'generated-dxf-job',mat:options.mat,sheet:{width:sheetWidth,height:sheetHeight},material:preset.name,options:structuredClone(options),preparation,operations,bridges,bridgeLimited,paths:orderedPaths,ignored:drawing.counts.ignored,steps,bytes,bounds:b};
}
