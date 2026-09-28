import test from 'node:test';
import assert from 'node:assert/strict';
import {hasLocalCommitIdentity,isPrivateFile} from '../scripts/privacy.mjs';

test('发布检查拒绝自动生成的本机邮箱，接受 GitHub 隐私邮箱',()=>{
  for(const identity of ['Developer <dev@workstation.local> 0 +0000','Developer <dev@localhost>','Developer <dev@studio.lan>','Developer <>','Developer'])assert.equal(hasLocalCommitIdentity(identity),true);
  for(const identity of ['Creator <123+creator@users.noreply.github.com> 0 +0000','Creator <creator@users.noreply.github.com>','Creator <public@example.com>'])assert.equal(hasLocalCommitIdentity(identity),false);
});
test('即使强制加入 Git，私有配置和密钥也不得发布',()=>{
  for(const file of ['.env','.env.production','config/.netrc','.npmrc','config/credentials.json','keys/id_ed25519','certs/private.pem'])assert.equal(isPrivateFile(file),true);
  for(const file of ['data/cases.json','docs/DEPLOYMENT.md','scripts/privacy.mjs'])assert.equal(isPrivateFile(file),false);
});
