import {createServer} from 'node:http';
import {readFile, stat, realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {createCuration} from './curation.mjs';

const root=path.resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
// Explicit public files only: research evidence and Git metadata stay private.
export function publicPath(url, base=root) {
  let pathname;
  try {pathname=decodeURIComponent(new URL(url,'http://localhost').pathname);} catch {return null;}
  if(pathname==='/')pathname='/index.html';
  if(!/^\/(?:index\.html|assets\/(?:gallery\.(?:css|mjs)|gallery-model\.mjs|covers\/\d+\.jpg|brand\/[\w.-]+\.svg|fonts\/(?:DMSans-latin\.woff2|Newsreader-latin\.woff2|OFL-DMSans\.txt|OFL-Newsreader\.txt))|data\/cases\.json|prompts\/\d+\.txt)$/.test(pathname))return null;
  return path.join(base,pathname);
}
export function createGalleryServer(base=root) {
 const curator=createCuration(base),token=randomBytes(32).toString('hex');
 return createServer(async(req,res)=>{
  if(req.url.startsWith('/api/')) {
    const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
    const host=`127.0.0.1:${req.socket.localPort}`,origin=`http://${host}`;
    if(req.headers.host!==host || (req.headers.origin && req.headers.origin!==origin) || (req.headers['sec-fetch-site'] && !['same-origin','none'].includes(req.headers['sec-fetch-site'])))return json(403,{error:'仅限本机画廊操作。'});
    try {
      if(req.url==='/api/curation' && req.method==='GET')return json(200,{token,...curator.snapshot()});
      if(req.url!=='/api/curation' || req.method!=='POST')return json(404,{error:'未找到接口。'});
      if(req.headers['x-curation-token']!==token || req.headers['content-type']!=='application/json')return json(403,{error:'请刷新页面后重试。'});
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)return json(413,{error:'请求过大。'});}
      let body;try{body=JSON.parse(raw);}catch{return json(400,{error:'请求格式无效。'});}
      if(!body||typeof body!=='object'||Array.isArray(body)||!['delete','restore','review'].includes(body.action)||typeof body.id!=='string'||typeof body.revision!=='string')return json(400,{error:'请求格式无效。'});
      return json(200,{token,...curator.mutate(body.action,body.id,body.revision,body.review)});
    }catch(error){return json(error.status||500,{error:error.status?error.message:'保存失败，已尝试回退，请检查本地文件后重试。'});}
  }
  const file=publicPath(req.url,base);
  if(!file||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end('未找到页面');return;}
  try {
    if(await realpath(file)!==file)throw new Error('symlink');
    if(!(await stat(file)).isFile())throw new Error('not a file');
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':body.length,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:body);
  } catch {res.writeHead(404);res.end('未找到页面');}
});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const server=createGalleryServer();
  const port=Number(process.env.PORT||4178);
  server.on('error',error=>{
    console.error(error.code==='EADDRINUSE'?`端口 ${port} 已占用，请用 PORT=4179 node scripts/serve.mjs 指定其他端口。`:`无法启动预览：${error.message}`);
    process.exitCode=1;
  });
  server.listen(port,'127.0.0.1',()=>console.log(`作品画廊：http://127.0.0.1:${port}`));
}
