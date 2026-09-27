import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCases, renderPrompt, buildOutputs, validateCatalog } from '../scripts/build.mjs';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/cases.json'), 'utf8'));

test('原文优先；收藏的零和缺失不同；点赞只作为同收藏数的次序', () => {
  const row=(id,status,bookmarks,likes)=>({id,prompt:{status},metrics:{bookmarks,likes}});
  const input=[row('1','original',null,900),row('2','original',0,0),row('3','brief',99999,99999),row('4','original',5,10),row('5','original',5,20)];
  assert.deepEqual(input.sort(compareCases).map(x=>x.id),['5','4','2','1','3']);
});

test('长提示词和嵌套代码围栏保持原样，不被渲染成页面指令', () => {
  const text='x'.repeat(600)+'\n```html\n<script>alert(1)</script>\n```';
  const output=renderPrompt({status:'original',text,language:'en',sourceUrl:'https://x.com/a/status/1'},'');
  assert.ok(output.includes('<details>'));
  assert.ok(output.includes('````text\n'+text+'\n````'));
});

test('首批数据有对应原帖、提示词、模型证据与可用轻量封面', () => {
  assert.deepEqual(validateCatalog(catalog,root),[]);
  assert.ok(catalog.cases.filter(c=>c.prompt.status==='original').length>=25);
  assert.ok(catalog.cases.length>=30);
  assert.ok(catalog.cases.reduce((n,c)=>n+fs.statSync(path.join(root,c.cover.path)).size,0)<5_000_000);
});

test('缺少模型证据、错误作者来源、缺失封面和重复 ID 都不能通过', () => {
  const copy=structuredClone(catalog);
  copy.cases[0].model.evidenceQuote='unknown';
  copy.cases[0].prompt.sourceUrl='https://x.com/wrong_author/status/123';
  copy.cases[0].cover.path='assets/covers/missing.jpg';
  copy.cases.push(copy.cases[0]);
  const errors=validateCatalog(copy,root).join('\n');
  for(const kind of ['模型依据','提示词作者','封面','重复']) assert.ok(errors.includes(kind),kind);
});

test('生成文件的相对链接可解析；每条案例含作者、原帖和提示词来源', () => {
  const outputs=buildOutputs(catalog);
  for(const c of catalog.cases) {
    const content=outputs.get(`cases/${c.id}.md`);
    assert.ok(content.includes(c.author.url));
    assert.ok(content.includes(c.source.url));
    assert.ok(content.includes(c.prompt.sourceUrl));
    assert.ok(content.includes(`width="${Math.min(640,c.cover.width)}"`));
    if(c.prompt.display!=='source_link')assert.equal(outputs.get(`prompts/${c.id}.txt`),c.prompt.text+'\n');
  }
  for(const [file,content] of outputs) {
    if(!file.endsWith('.md'))continue;
    for(const m of content.matchAll(/\]\(([^)]+)\)/g)) {
      const link=m[1];if(/^(https?:|#)/.test(link))continue;
      const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),link.split('#')[0]));
      assert.ok(outputs.has(target)||fs.existsSync(path.join(root,target)),`${file}: ${link}`);
    }
  }
});

test('首页按用途分组，精选封面定位案例，英文入口与播放来源均可追溯', () => {
  const outputs=buildOutputs(catalog);const readme=outputs.get('README.md');
  assert.ok(readme.includes('# Awesome Opus Gallery'));
  assert.ok(readme.includes('README.en.md'));
  assert.ok(readme.includes('## 精选速览'));
  assert.ok(readme.includes('### 产品宣传'));
  assert.ok(outputs.get('README.en.md').includes('Public prompts'));
  for(const c of catalog.cases.filter(c=>c.playback)) {
    assert.ok(readme.includes('\n\n'+c.playback.url+'\n\n'));
    const detail=outputs.get(`cases/${c.id}.md`);
    assert.ok(detail.includes(c.playback.providerPage));
  }
});

test('播放附件必须对应同一原帖并保留提供方，不能把未知许可当成自行上传依据', () => {
  const copy=structuredClone(catalog);const c=copy.cases[0];
  c.playback={kind:'external_github_attachment',url:'https://evil.example/video.mp4',sourcePostUrl:'https://x.com/wrong/status/1'};
  assert.ok(validateCatalog(copy,root).some(x=>x.includes('播放')));
  c.playback={kind:'self_hosted',url:'https://github.com/user-attachments/assets/a',reuploadPermission:'not_verified'};
  assert.ok(validateCatalog(copy,root).some(x=>x.includes('播放')));
});
