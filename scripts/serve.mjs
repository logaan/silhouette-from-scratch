import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve('dist'),port=Number(process.env.PORT||4173);
http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))throw Error('Invalid path');const body=await fs.readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.dxf':'application/dxf'})[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(body);}catch{res.writeHead(404);res.end('Not found');}}).on('error',(error)=>{
  if(error.code==='EADDRINUSE'){
    console.error(`Port ${port} is already in use. Another copy of the server may be running.`);
    console.error(`Check with: PORT=${port} bash scripts/check-server.sh`);
    console.error('Stop the existing server, or use another port: PORT=4174 bash scripts/serve.sh');
  }else{
    console.error(`Unable to start server: ${error.message}`);
  }
  process.exitCode=1;
}).listen(port,'127.0.0.1',()=>console.log(`Silhouette Studio Lab: http://127.0.0.1:${port}`));
