import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {packageSite} from '../scripts/package-site.mjs';

async function fixture(t) {
  const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'gallery-package-')));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  for(const file of ['index.html','assets/gallery.css','assets/gallery.mjs','assets/gallery-model.mjs','assets/covers/1.jpg','.research/deleted-works/private.json','.git/config','scripts/serve.mjs']) {
    await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),'fixture');
  }
  await fs.mkdir(path.join(root,'data'));
  await fs.writeFile(path.join(root,'data/cases.json'),JSON.stringify({cases:[{id:'1',cover:{path:'assets/covers/1.jpg'}}]}));
  return root;
}

test('静态包只包含页面必需文件，不包含研究、API、Git 或删除记录',async t=>{
  const root=await fixture(t),result=await packageSite(root);
  assert.equal(result.files,6);
  for(const file of ['index.html','assets/gallery.mjs','assets/covers/1.jpg','data/cases.json','.nojekyll'])assert.ok(await fs.stat(path.join(result.directory,file)));
  for(const file of ['.git','.research','scripts'])assert.equal(await fs.stat(path.join(result.directory,file)).catch(()=>null),null);
  await fs.writeFile(path.join(result.directory,'assets/covers/removed.jpg'),'stale');
  await packageSite(root);
  assert.equal(await fs.stat(path.join(result.directory,'assets/covers/removed.jpg')).catch(()=>null),null);
  assert.equal(await fs.readFile(path.join(root,'.research/deleted-works/private.json'),'utf8'),'fixture');
});

test('打包拒绝穿越路径和符号链接，不覆盖已有用户目录',async t=>{
  const root=await fixture(t);
  await fs.writeFile(path.join(root,'data/cases.json'),JSON.stringify({cases:[{cover:{path:'../private.jpg'}}]}));
  await assert.rejects(()=>packageSite(root),/白名单/);
  await fs.writeFile(path.join(root,'data/cases.json'),JSON.stringify({cases:[{cover:{path:'assets/covers/1.jpg'}}]}));
  await fs.unlink(path.join(root,'assets/covers/1.jpg'));
  await fs.symlink(path.join(root,'.git/config'),path.join(root,'assets/covers/1.jpg'));
  await assert.rejects(()=>packageSite(root),/符号链接/);
  await fs.unlink(path.join(root,'assets/covers/1.jpg'));await fs.writeFile(path.join(root,'assets/covers/1.jpg'),'image');
  await fs.mkdir(path.join(root,'.research/site-dist'));await fs.writeFile(path.join(root,'.research/site-dist/keep.txt'),'keep');
  await assert.rejects(()=>packageSite(root),/已有其他内容/);
  assert.equal(await fs.readFile(path.join(root,'.research/site-dist/keep.txt'),'utf8'),'keep');
});
