import test from 'node:test';
import assert from 'node:assert/strict';
import {publicPath} from '../scripts/serve.mjs';

test('预览仅公开画廊资产，不暴露研究文件、仓库配置或编码绕过',()=>{
  for(const url of ['/.git/config','/.research/posts/123.json','/data/../.git/config','/%2e%2e/.git/config','/%','/assets/%2e%2e/.research/file','//evil.example/.git/config'])assert.equal(publicPath(url),null,url);
  for(const url of ['/','/assets/gallery.mjs','/assets/gallery-model.mjs','/assets/covers/123.jpg','/data/cases.json','/prompts/123.txt'])assert.ok(publicPath(url),url);
});
