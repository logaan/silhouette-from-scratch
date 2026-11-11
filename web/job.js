import {optimisePaths} from './order.js';
import {bounds,positioned,validateSettings} from './geometry.js';
export const MATS={'12x12':{name:'12 × 12 in',width:304.8,height:304.8,code:1},'12x24':{name:'12 × 24 in',width:304.8,height:609.6,code:2}};
const su=n=>Math.round(n*20);
export function compileJob(drawing,options,preset){
 validateSettings(preset);
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
 const steps=[{label:'Set mat',commands:[`TG${mat.code}`,'FN0','TB50,0','FM0','TR0,1','\\0,0',`Z${su(mat.height)},${su(mat.width)}`],wait:true}],operations=[];
 let cursor=[0,0];const orderedPaths=[];
 for(const op of groups){
  let group=active.filter(p=>p.operation===op);if(options.optimise)group=optimisePaths(group,cursor);if(!group.length)continue;
  orderedPaths.push(...group);cursor=group.at(-1).points.at(-1);
  const s=preset[op],t=s.tool,offset=op==='cut'?18:0,corner=op==='cut'?1:0;
  steps.push({label:`Set ${op} tool`,commands:[`J${t}`,`FX${s.force},${t}`,'TJ1',`!${s.speed},${t}`,'APS0',`FC${offset},1,${t}`,`FE0,${t}`,`FF${corner},${corner},${t}`,'FY1',...(op==='cut'?[`TF${s.depth},1`]:[])],wait:true});
  operations.push({operation:op,tool:t,...s,pathCount:group.length});
  for(let i=0;i<group.length;i++)for(let pass=0;pass<s.passes;pass++){
   const points=group[i].points.map(([x,y])=>[su(x),su(y)]).filter((p,i,a)=>!i||p[0]!==a[i-1][0]||p[1]!==a[i-1][1]);
   if(points.length<2)throw Error('A path is smaller than the cutter resolution (0.05 mm)');
   const commands=points.map(([x,y],i)=>`${i?'D':'M'}${y},${x}`);
   steps.push({label:`${op==='cut'?'Cut':'Crease'} ${i+1}/${group.length} · pass ${pass+1}/${s.passes}`,commands,wait:true});
  }
 }
 steps.push({label:'Return to origin',commands:['L0','\\0,0','M0,0','TR0,0','J1','FN0','TB50,0'],wait:true});
 const bytes=steps.reduce((sum,s)=>sum+s.commands.join('\x03').length+s.commands.length,0);
 if(bytes>5_000_000)throw Error('Job exceeds 5 MB of commands');
 return {version:1,kind:'generated-dxf-job',mat:options.mat,sheet:{width:sheetWidth,height:sheetHeight},material:preset.name,options:structuredClone(options),operations,paths:orderedPaths,ignored:drawing.counts.ignored,steps,bytes,bounds:b};
}
