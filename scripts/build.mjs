import {build} from 'esbuild';
import {parse} from 'yaml';
import fs from 'node:fs/promises';
import {validateSettings} from '../web/geometry.js';
async function load(dir){const result=[];for(const f of (await fs.readdir(dir)).sort())if(/\.ya?ml$/.test(f))result.push(parse(await fs.readFile(`${dir}/${f}`,'utf8')));const ids=new Set();for(const p of result){if(!p.id||!p.name||ids.has(p.id))throw Error(`Invalid or duplicate preset in ${dir}`);ids.add(p.id);}return result;}
const materials=await load('materials');materials.forEach(validateSettings);
const sizes=await load('material-sizes');for(const s of sizes)if(![s.width_mm,s.height_mm].every(n=>typeof n==='number'&&n>0&&n<2000))throw Error('Invalid material size');
await fs.mkdir('dist',{recursive:true});
await build({entryPoints:['web/app.js'],bundle:true,format:'esm',outfile:'dist/app.js',minify:true,legalComments:'external',target:'chrome110'});
for(const f of ['index.html','style.css'])await fs.copyFile(`web/${f}`,`dist/${f}`);
await fs.writeFile('dist/config.json',JSON.stringify({materials,sizes},null,2));
await fs.copyFile('test-files/colour-protocol-test-70mm.dxf','dist/example.dxf');
await fs.writeFile('dist/.nojekyll','');
await fs.copyFile('node_modules/dxf-parser/LICENSE','dist/DXF-PARSER-LICENSE.txt');
console.log('Built static app in dist/');
