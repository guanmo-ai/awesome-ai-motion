import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeText,hasLocalCommitIdentity,isPrivateFile,textPrivacyIssues} from '../scripts/privacy.mjs';

test('本地作者与提交者只接受项目公开署名和 GitHub noreply 邮箱',()=>{
  for(const identity of ['Developer <dev@workstation.local> 0 +0000','观默 <dev@example.com>','Developer <123+creator@users.noreply.github.com>','Developer <>','Developer','观默 <noreply@github.com>'])assert.equal(hasLocalCommitIdentity(identity),true);
  for(const identity of ['观默 <123+creator@users.noreply.github.com> 0 +0000','@guanmo_ai <creator@users.noreply.github.com>','guanmo-ai <creator@users.noreply.github.com>','观默 / @guanmo_ai <creator@users.noreply.github.com>'])assert.equal(hasLocalCommitIdentity(identity),false);
  assert.equal(hasLocalCommitIdentity('Contributor <123+creator@users.noreply.github.com>',{ci:true}),false);
  assert.equal(hasLocalCommitIdentity('web-flow <noreply@github.com>',{ci:true}),false);
  assert.equal(hasLocalCommitIdentity('Contributor <private@example.com>',{ci:true}),true);
});

test('强制加入 Git 的私有路径、配置、日志和系统文件也不得发布',()=>{
  for(const file of ['.research/secret.txt','.superpowers/run.md','docs/superpowers/run.md','.env','.env.production','config/.netrc','.npmrc','config/credentials.json','keys/id_ed25519','certs/private.pem','.aws/credentials','notes/debug.log','Thumbs.db','.DS_Store'])assert.equal(isPrivateFile(file),true,file);
  for(const file of ['data/cases.json','docs/DEPLOYMENT.md','scripts/privacy.mjs','assets/brand/wordmark.svg'])assert.equal(isPrivateFile(file),false,file);
});

test('扫描无后缀文本与各系统家目录，保留正常文档提及',()=>{
  const home=['/Us'+'ers/','/ho'+'me/','C:\\Us'+'ers\\','file:'+'//'].map(prefix=>prefix+'alice/private');
  for(const value of home)assert.ok(textPrivacyIssues(value).includes('本机路径'));
  assert.deepEqual(textPrivacyIssues('研究资料保留在 `.research/`；公开仓库不包含它。'),[]);
  assert.deepEqual(textPrivacyIssues('[公开网页](https://example.com/.research/example)'),[]);
  assert.ok(textPrivacyIssues(']('+'.research/notes.txt)').includes('私有文件引用'));
  assert.ok(textPrivacyIssues('ghp_'+'A'.repeat(36)).includes('疑似访问令牌'));
  assert.ok(textPrivacyIssues('Cook'+'ie: '+'session='+'a'.repeat(24)).includes('认证 Cookie'));
  assert.ok(textPrivacyIssues('-----BEGIN '+'PRIVATE KEY-----').includes('私钥内容'));
  assert.equal(decodeText(Buffer.from([0xff,0xd8,0,0x41])),null);
  assert.equal(decodeText(Buffer.from('plain extensionless text')),'plain extensionless text');
});
