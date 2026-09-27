import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(import.meta.dirname,'..');
const CORE=['index.html','assets/gallery.css','assets/gallery.mjs','assets/gallery-model.mjs','data/cases.json'];
const MARKER='.gallery-package';

export async function packageSite(root=ROOT) {
  root=await fs.realpath(root);
  const research=path.join(root,'.research');
  await fs.mkdir(research,{recursive:true});
  if((await fs.lstat(research)).isSymbolicLink())throw new Error('打包目录不能使用符号链接');
  const catalog=JSON.parse(await fs.readFile(path.join(root,'data/cases.json'),'utf8'));
  const covers=catalog.cases.map(item=>item.cover?.path);
  if(covers.some(file=>!/^assets\/covers\/\d+\.jpg$/.test(file||'')))throw new Error('封面路径不在公开白名单中');
  const files=[...new Set([...CORE,...covers])];
  // Validate every source before replacing a previously generated package.
  for(const file of files) {
    const source=path.join(root,file),resolved=await fs.realpath(source);
    if(resolved!==source || !(await fs.lstat(source)).isFile())throw new Error(`不能打包符号链接或非普通文件：${file}`);
  }
  const destination=path.join(research,'site-dist');
  try {
    if((await fs.lstat(destination)).isSymbolicLink())throw new Error('输出目录不能使用符号链接');
    if(!(await fs.readFile(path.join(destination,MARKER),'utf8')).startsWith('awesome-ai-motion'))throw new Error('输出目录不是本站生成包');
    await fs.rm(destination,{recursive:true});
  } catch(error) {if(error.code!=='ENOENT')throw error; if(await fs.stat(destination).catch(()=>null))throw new Error('输出目录已有其他内容，请保留后另行处理');}
  await fs.mkdir(destination,{recursive:true});
  await fs.writeFile(path.join(destination,MARKER),'awesome-ai-motion\n');
  let bytes=0;
  for(const file of files) {
    const target=path.join(destination,file);await fs.mkdir(path.dirname(target),{recursive:true});
    await fs.copyFile(path.join(root,file),target);bytes+=(await fs.stat(target)).size;
  }
  await fs.writeFile(path.join(destination,'.nojekyll'),'');
  return {files:files.length,bytes,directory:destination};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {const result=await packageSite();console.log(`静态画廊已打包：${result.files} 个文件，${(result.bytes/1024/1024).toFixed(2)} MB → .research/site-dist`);}
  catch(error) {console.error(error.message);process.exitCode=1;}
}
