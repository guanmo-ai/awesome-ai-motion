import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {checkRelease} from '../scripts/check-release.mjs';

test('高清画廊预览有独立大小上限，普通图片仍受默认上限约束',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'motion-release-image-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  execFileSync('git',['init','-q'],{cwd:root});
  fs.mkdirSync(path.join(root,'assets'));
  const preview=path.join(root,'assets/gallery-preview.png');
  fs.writeFileSync(preview,Buffer.alloc(4_000_000));
  assert.deepEqual(checkRelease(root,{checkIdentity:false}).errors,[]);

  fs.appendFileSync(preview,Buffer.alloc(1));
  fs.writeFileSync(path.join(root,'assets/other.png'),Buffer.alloc(500_001));
  const {errors}=checkRelease(root,{checkIdentity:false});
  assert.ok(errors.some(error=>error.includes('文件过大')&&error.includes('gallery-preview.png')));
  assert.ok(errors.some(error=>error.includes('文件过大')&&error.includes('other.png')));
});

test('持续补充的案例 JSON 有独立上限，超限仍被拒绝',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'motion-release-catalog-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  execFileSync('git',['init','-q'],{cwd:root});
  fs.mkdirSync(path.join(root,'data'));
  const catalog=path.join(root,'data/cases.json');
  const json=JSON.stringify({schemaVersion:2,name:'Awesome AI Motion',repository:'https://github.com/guanmo-ai/awesome-ai-motion',cases:[]});
  fs.writeFileSync(catalog,json+' '.repeat(3_000_000-Buffer.byteLength(json)));
  assert.deepEqual(checkRelease(root,{checkIdentity:false}).errors,[]);
  fs.appendFileSync(catalog,' ');
  assert.ok(checkRelease(root,{checkIdentity:false}).errors.some(error=>error.includes('文件过大')&&error.includes('cases.json')));
});

test('中英文发现列表有独立预算，超限和其他 Markdown 仍被拒绝',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'motion-release-discoveries-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  execFileSync('git',['init','-q'],{cwd:root});
  fs.mkdirSync(path.join(root,'browse'));
  for(const file of ['discoveries.md','discoveries.en.md'])fs.writeFileSync(path.join(root,'browse',file),' '.repeat(750_000));
  assert.deepEqual(checkRelease(root,{checkIdentity:false}).errors,[]);
  for(const file of ['discoveries.md','discoveries.en.md'])fs.appendFileSync(path.join(root,'browse',file),' ');
  fs.writeFileSync(path.join(root,'browse/motion.md'),' '.repeat(500_001));
  const {errors}=checkRelease(root,{checkIdentity:false});
  for(const file of ['discoveries.md','discoveries.en.md','motion.md'])assert.ok(errors.some(error=>error.includes('文件过大')&&error.includes(file)));
});

test('索引和工作树分别扫描，强制暂存的私有文件与符号链接被拒绝且不回显秘密',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'motion-release-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const git=(...args)=>execFileSync('git',args,{cwd:root});
  git('init','-q');

  const secret='ghp_'+'A'.repeat(36);
  fs.writeFileSync(path.join(root,'notes.custom'),secret);
  git('add','notes.custom');
  fs.writeFileSync(path.join(root,'notes.custom'),'clean');
  let result=checkRelease(root,{checkIdentity:false});
  assert.ok(result.errors.some(error=>error.includes('疑似访问令牌')&&error.includes('暂存')));
  assert.ok(!result.errors.join('\n').includes(secret));

  fs.mkdirSync(path.join(root,'.research'));
  fs.writeFileSync(path.join(root,'.research','private.txt'),'private');
  git('add','-f','.research/private.txt');
  result=checkRelease(root,{checkIdentity:false});
  assert.ok(result.errors.some(error=>error.includes('私有文件')&&error.includes('.research/private.txt')));

  fs.symlinkSync('.research/private.txt',path.join(root,'public-link'));
  git('add','public-link');
  result=checkRelease(root,{checkIdentity:false});
  assert.ok(result.errors.some(error=>error.includes('符号链接')&&error.includes('public-link')));
});
