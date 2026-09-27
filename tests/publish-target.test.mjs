import test from 'node:test';
import assert from 'node:assert/strict';
import {isPublishTarget} from '../scripts/check-target.mjs';

test('只向正式仓库发布，兼容 GitHub HTTPS 和 SSH 地址',()=>{
  for(const url of [
    'https://github.com/guanmo-ai/awesome-ai-motion.git',
    'git@github.com:guanmo-ai/awesome-ai-motion.git',
    'ssh://git@github.com/guanmo-ai/awesome-ai-motion',
  ])assert.equal(isPublishTarget(url),true,url);
  for(const url of [
    'https://github.com/other-account/awesome-ai-motion.git',
    'git@github.com:guanmo-ai/another-repository.git',
    'https://github.com.example.com/guanmo-ai/awesome-ai-motion.git',
    'https://github.com/guanmo-ai/awesome-ai-motion-extra.git',
    '',
  ])assert.equal(isPublishTarget(url),false,url);
});
