import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {publicCatalogIssues} from '../scripts/catalog-privacy.mjs';
import {buildOutputs,validateCatalog} from '../scripts/build.mjs';

const catalog=JSON.parse(fs.readFileSync(new URL('../data/cases.json',import.meta.url),'utf8'));
test('公开目录拒绝研究字段、原始响应和嵌套私有对象',()=>{
  assert.deepEqual(publicCatalogIssues(catalog),[]);
  for(const add of [c=>c.internalNotes='private',c=>c.metrics.rawResponse={},c=>c.webPlayback.evidence={},c=>c.prompt.text={privateNote:'private'},c=>c.review={highlights:[{privateNote:'private'}]}]) {
    const copy=structuredClone(catalog);add(copy.cases[0]);
    assert.ok(publicCatalogIssues(copy).length>0);
  }
});
test('原帖入口模式不在公开数据、生成页或纯文本文件夹保留全文',()=>{
  const copy=structuredClone(catalog),c=copy.cases[0];
  c.prompt.display='source_link';c.prompt.text='';delete c.prompt.translationZh;
  assert.deepEqual(validateCatalog(copy),[]);
  const outputs=buildOutputs(copy);
  assert.equal(outputs.has(`prompts/${c.id}.txt`),false);
  for(const language of ['', '.en'])assert.ok(outputs.get(`cases/${c.id}${language}.md`).includes(c.prompt.sourceUrl));
  c.prompt.text='must not leak';
  assert.ok(validateCatalog(copy).some(error=>error.includes('全文')));
});

test('解析后的字段值不能用 JSON 转义掩盖本机路径或认证信息',()=>{
  const copy=structuredClone(catalog);
  copy.cases[0].summary=['C:','Users','private-owner','notes'].join('\\');
  assert.ok(publicCatalogIssues(JSON.parse(JSON.stringify(copy))).some(error=>error.includes('本机路径')));
  copy.cases[0].summary=['Cook','ie',': theme=dark; auth_token='].join('')+'a'.repeat(30);
  assert.ok(publicCatalogIssues(copy).some(error=>error.includes('认证 Cookie')));
});
