import test from 'node:test';
import assert from 'node:assert/strict';
import {publicPath,createGalleryServer} from '../scripts/serve.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('预览仅公开画廊资产，不暴露研究文件、仓库配置或编码绕过',()=>{
  for(const url of ['/.git/config','/.research/posts/123.json','/data/../.git/config','/%2e%2e/.git/config','/%','/assets/%2e%2e/.research/file','//evil.example/.git/config','/assets/fonts/private.woff2','/assets/fonts/README.md'])assert.equal(publicPath(url),null,url);
  for(const url of ['/','/assets/gallery.mjs','/assets/gallery-model.mjs','/assets/covers/123.jpg','/data/cases.json','/prompts/123.txt','/assets/fonts/DMSans-latin.woff2','/assets/fonts/Newsreader-latin.woff2','/assets/fonts/OFL-DMSans.txt','/assets/fonts/OFL-Newsreader.txt'])assert.ok(publicPath(url),url);
});

test('本地字体以正确类型返回，字体白名单不暴露任意文件',async t=>{
  const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'gallery-fonts-')));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'assets/fonts'),{recursive:true});
  const body=Buffer.from('wOF2test');
  await fs.writeFile(path.join(root,'assets/fonts/DMSans-latin.woff2'),body);
  await fs.writeFile(path.join(root,'assets/fonts/private.woff2'),'private');
  const server=createGalleryServer(root);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const response=await fetch(`${base}/assets/fonts/DMSans-latin.woff2`);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('content-type'),'font/woff2');
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),body);
  assert.equal((await fetch(`${base}/assets/fonts/private.woff2`)).status,404);
});

test('公开资产路径不能通过符号链接读取本地研究文件',async t=>{
  const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'gallery-private-')));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'.research'));
  await fs.writeFile(path.join(root,'.research/private.txt'),'private evidence');
  await fs.symlink(path.join(root,'.research/private.txt'),path.join(root,'index.html'));
  const server=createGalleryServer(root);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(response.status,404);
  assert.doesNotMatch(await response.text(),/private evidence/);
});
