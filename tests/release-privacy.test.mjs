import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {checkRelease} from '../scripts/check-release.mjs';

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
