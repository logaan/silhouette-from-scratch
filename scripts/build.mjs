import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {parse} from 'yaml';
import fs from 'node:fs/promises';
import {MATS} from '../web/job.js';
import {validateSettings} from '../web/geometry.js';
async function load(dir){const result=[];for(const f of (await fs.readdir(dir)).sort())if(/\.ya?ml$/.test(f))result.push(parse(await fs.readFile(`${dir}/${f}`,'utf8')));const ids=new Set();for(const p of result){if(!p.id||!p.name||ids.has(p.id))throw Error(`Invalid or duplicate preset in ${dir}`);ids.add(p.id);}return result;}
const materials=await load('materials');materials.forEach(validateSettings);
const sizes=await load('material-sizes');for(const s of sizes)if(![s.width_mm,s.height_mm].every(n=>typeof n==='number'&&n>0&&n<2000))throw Error('Invalid material size');
for(const p of materials)if(!MATS[p.mat]||!sizes.some(s=>s.id===p.size))throw Error('Invalid material defaults');
await fs.mkdir('dist',{recursive:true});
await build({entryPoints:['web/browser.js'],bundle:true,format:'esm',outfile:'dist/app.js',minify:true,legalComments:'external',target:'chrome110'});
let commit=process.env.GITHUB_SHA;
if(!commit){try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{commit='unknown';}}
if(!/^[a-f0-9]{40}$/i.test(commit))commit='unknown';
await fs.copyFile('web/style.css','dist/style.css');
await fs.copyFile('web/poll-worker.js','dist/poll-worker.js');
const runId=process.env.GITHUB_RUN_ID;
const buildUrl=runId&&/^\d+$/.test(runId)?`https://github.com/logaan/silhouette-from-scratch/actions/runs/${runId}`:`https://github.com/logaan/silhouette-from-scratch/commit/${commit}`;
const html=await fs.readFile('web/index.html','utf8');
await fs.writeFile('dist/index.html',html.replaceAll('__BUILD_COMMIT__',commit).replaceAll('__BUILD_COMMIT_SHORT__',commit.slice(0,7)).replaceAll('__BUILD_URL__',buildUrl));
await fs.writeFile('dist/build-info.json',JSON.stringify({commit,buildUrl},null,2)+'\n');
await fs.writeFile('dist/config.json',JSON.stringify({materials,sizes},null,2));
await fs.copyFile('test-files/colour-protocol-test-70mm.dxf','dist/example.dxf');
await fs.copyFile('test-files/foldover-8-compartment-box.dxf','dist/box.dxf');
await fs.writeFile('dist/.nojekyll','');
await fs.copyFile('LICENSE','dist/LICENSE');
await fs.copyFile('node_modules/dxf-parser/LICENSE','dist/DXF-PARSER-LICENSE.txt');
console.log('Built static app in dist/');
