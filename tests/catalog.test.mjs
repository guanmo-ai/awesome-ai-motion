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

test('全部记录有对应原帖、提示词状态、模型证据与轻量封面', () => {
  assert.deepEqual(validateCatalog(catalog,root),[]);
  const coverBytes=catalog.cases.reduce((n,c)=>n+fs.statSync(path.join(root,c.cover.path)).size,0);
  assert.ok(coverBytes<=catalog.cases.length*50_000,'封面平均不超过 50 KB，适配分批加载的大目录');
});

test('缺少模型证据、错误作者来源、缺失封面和重复 ID 都不能通过', () => {
  if(!catalog.cases.length)return;
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
    if(c.prompt.status==='unknown'||c.prompt.display==='source_link')assert.equal(outputs.has(`prompts/${c.id}.txt`),false);
    else if(c.prompt.display!=='source_link')assert.equal(outputs.get(`prompts/${c.id}.txt`),c.prompt.text+'\n');
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

test('首页先分类再精选，长提示词只出现在详情，brief 也保留在用途分类', () => {
  const outputs=buildOutputs(catalog);const readme=outputs.get('README.md');
  assert.ok(readme.includes('# Awesome AI Motion'));
  assert.ok(readme.includes('README.en.md'));
  assert.ok(readme.indexOf('id="browse"')<readme.indexOf('id="featured"'));
  assert.ok(Buffer.byteLength(readme)<32000,'首页在视觉分类预览下仍保持轻量');
  assert.ok(!readme.includes('make a modern slick and punchy video'));
  for(const c of catalog.cases) {
    const browse=[...outputs].filter(([file])=>/^browse\/.*(?<!\.en)\.md$/.test(file)&&file!=='browse/discoveries.md');
    assert.equal(browse.filter(([,body])=>body.includes(`cases/${c.id}.md`)).length,1,`${c.id} 必须归属唯一用途分类`);
    const detail=outputs.get(`cases/${c.id}.md`);
    assert.ok(!detail.includes("github.com/user-attachments/"));
  }
});

test('不接受参考仓库附件，公开数据与生成页只使用原帖媒体', () => {
  const copy=structuredClone(catalog),c=copy.cases[0];
  c.playback={kind:'external_github_attachment',url:'https://github.com/user-attachments/assets/0005d4cf-acdd-42aa-af16-dbebe167126d',sourcePostUrl:c.source.url};
  assert.ok(validateCatalog(copy,root).some(x=>x.includes('不接受参考仓库附件')));
  assert.ok(catalog.cases.every(c=>c.playback===undefined));
  for(const [file,content] of buildOutputs(copy)) {
    assert.ok(!content.includes(c.playback.url),`${file}: 不能呈现仓库附件视频`);
  }
});


test('双语分类包含全部作品，详情和提示词完整，投稿仍指向指定仓库', () => {
  const outputs=buildOutputs(catalog);
  for(const en of [false,true]) {
    const browse=[...outputs].filter(([file])=>file.startsWith('browse/')&&(file.endsWith('.en.md')===en));
    for(const c of catalog.cases) {
      assert.ok(browse.some(([,text])=>text.includes(`cases/${c.id}${en?'.en':''}.md`)));
      assert.ok(outputs.has(`cases/${c.id}${en?'.en':''}.md`));
    }
    const text=outputs.get(`README${en?'.en':''}.md`);
    for(const url of text.matchAll(/https:\/\/github\.com\/([^/]+\/[^/]+)\/issues/g))assert.equal(url[1],catalog.repository);
  }
});

test('首页所有自定义跳转锚点存在且唯一', () => {
  for(const file of ['README.md','README.en.md']) {
    const text=buildOutputs(catalog).get(file);
    const ids=[...text.matchAll(/<a id="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(ids.length,new Set(ids).size);
    for(const m of text.matchAll(/(?:\]\(|href=")#([a-z0-9-]+)/g))assert.ok(ids.includes(m[1]),m[1]);
  }
});

test('双语作品页观看与封面进入作者原帖，不再导航到会被拦截的裸 MP4', () => {
  const outputs=buildOutputs(catalog);
  for(const c of catalog.cases) for(const en of [false,true]) {
    const detail=outputs.get(`cases/${c.id}${en?'.en':''}.md`);
    assert.ok(detail.includes(`**[▶ ${en?'Watch on X':'在 X 原帖观看'}](${c.source.url})**`));
    assert.ok(detail.includes(`>](${c.source.url})`),`${c.id}: 封面应打开作者原帖`);
    assert.doesNotMatch(detail,/\]\(https:\/\/video\.twimg\.com\//);
  }
});

test('分类与精选卡片的主入口都到作品详情，作者原帖是独立次要链接', () => {
  const outputs=buildOutputs(catalog);
  for(const en of [false,true]) for(const [file,body] of outputs) {
    if(!file.startsWith('browse/')&&file!==`README${en?'.en':''}.md`)continue;
    if(file.startsWith('browse/')&&file.endsWith('.en.md')!==en)continue;
    if(file.startsWith('README')&&file.endsWith('.en.md')!==en)continue;
    const cards=[...body.matchAll(/<td\b[^>]*>(.*?)<\/td>/gs)].map(m=>m[1]);
    for(const card of cards) {
      const id=card.match(/cases\/(\d+)(?:\.en)?\.md/)?.[1];
      assert.ok(id,`${file}: 卡片详情链接缺失`);
      const c=catalog.cases.find(item=>item.id===id);
      const detail=`${file.startsWith('browse/')?'../':''}cases/${id}${en?'.en':''}.md`;
      assert.ok(card.startsWith(`<a href="${detail}">`),`${file}: 封面必须进入详情`);
      assert.ok(card.includes(`<a href="${detail}">${en?'▶ View video & details':'▶ 查看视频与详情'}</a>`));
      assert.ok(card.includes(`<a href="${c.source.url}">${en?'Original post':'作者原帖'}</a>`));
      if(c.webPlayback)assert.ok(!card.includes(c.webPlayback.url),`${file}: 卡片不应绕过详情`);
    }
  }
});

test('可选交互体验链接与原帖、源码并列，且不接受无效地址', () => {
  const copy=structuredClone(catalog);
  const c=copy.cases[0];
  c.demoUrl='https://aureliengmz.github.io/clearwater/';
  c.codeUrl='https://github.com/example/clearwater';
  assert.deepEqual(validateCatalog(copy,root),[]);
  const outputs=buildOutputs(copy);
  for(const en of [false,true]) {
    const detail=outputs.get(`cases/${c.id}${en?'.en':''}.md`);
    assert.ok(detail.includes(`[${en?'Interactive demo':'交互体验'}](${c.demoUrl})`));
    assert.ok(detail.indexOf(c.source.url)<detail.indexOf(c.demoUrl));
    assert.ok(detail.indexOf(c.demoUrl)<detail.indexOf(c.codeUrl));
  }
  for(const url of ['javascript:alert(1)','https://user:pass@example.com/demo','https://example.com/demo)([bad](https://evil.example)','']) {
    c.demoUrl=url;
    assert.ok(validateCatalog(copy,root).some(e=>e.includes('交互体验地址')),url);
  }
});

test('画廊外部视频只接受原帖对应的稳定原媒体，拒绝签名地址和错误来源',()=>{
  const copy=structuredClone(catalog),c=copy.cases[0];
  const valid={kind:'external_source_video',url:c.cover.sourceUrl,sourcePostUrl:c.source.url,contentType:'video/mp4',checkedAt:'2026-09-27T12:00:00Z',verificationLevel:'原帖媒体对应及 Range GET 检查',reuploadPermission:'not_verified'};
  c.webPlayback=valid;
  assert.deepEqual(validateCatalog(copy,root),[]);
  for(const patch of [{url:'https://video.twimg.com.evil.example/a.mp4'},{url:c.cover.sourceUrl+'&jwt=temporary'},{sourcePostUrl:'https://x.com/other/status/123'},{reuploadPermission:'granted'},{verificationLevel:''}]) {
    c.webPlayback={...valid,...patch};
    assert.ok(validateCatalog(copy,root).some(e=>e.includes('画廊')));
  }
});


test('手动精选决定 README 选入，取消默认精选后不会重新自动选入',()=>{
  const copy=structuredClone(catalog);
  for(const c of copy.cases)c.review={highlights:[],later:false,featured:false};
  const chosen=copy.cases[0];chosen.review.featured=true;
  for(const en of [false,true]) {
    const readme=buildOutputs(copy).get(`README${en?'.en':''}.md`);
    const featuredSection=readme.split('<a id="featured"></a>')[1].split('<a id="category-')[0];
    const cards=[...featuredSection.matchAll(/<td\b[^>]*>(.*?)<\/td>/gs)];
    assert.equal(cards.length,1);
    assert.ok(cards[0][1].includes(`cases/${chosen.id}${en?'.en':''}.md`));
  }
});


test('发现池需要作者声明与原媒体，未知提示词不能伪装原始指令',()=>{
  const copy=structuredClone(catalog),c=copy.cases[0];
  c.stage='discovery';c.verification.authorClaimConfirmed=true;c.verification.fullReview=false;
  c.model.name='Claude';c.model.evidenceQuote='I used Claude to make this animation';
  c.prompt.status='unknown';c.prompt.text='';
  assert.deepEqual(validateCatalog(copy,root),[]);
  const outputs=buildOutputs(copy);
  assert.ok(outputs.get(`cases/${c.id}.md`).includes('尚未完整审看'));
  assert.ok(outputs.get(`cases/${c.id}.md`).includes('未取得作者公开提示词'));
  assert.equal(outputs.has(`prompts/${c.id}.txt`),false);
  assert.ok(outputs.get('browse/discoveries.md').includes(c.id));
  c.verification.authorClaimConfirmed=false;
  assert.ok(validateCatalog(copy,root).some(e=>e.includes('发现池')));
  c.verification.authorClaimConfirmed=true;c.prompt.text='invented';
  assert.ok(validateCatalog(copy,root).some(e=>e.includes('提示词')));
});


test('首页每个非空类别都有最多三张对应封面与完整分类入口',()=>{
  for(const en of [false,true]) {
    const readme=buildOutputs(catalog).get(`README${en?'.en':''}.md`);
    const sections=[...readme.matchAll(/<a id="category-([^"]+)"><\/a>(.*?)(?=<a id="category-|分类推荐优先|Category recommendations)/gs)];
    assert.equal(sections.length,new Set(catalog.cases.map(c=>c.category)).size);
    for(const [,slug,body] of sections) {
      const ids=[...body.matchAll(/<td[^>]*><a href="cases\/(\d+)/g)].map(m=>m[1]);
      assert.ok(ids.length>0&&ids.length<=3);
      assert.equal(new Set(ids).size,ids.length);
      assert.equal(new Set(ids.map(id=>catalog.cases.find(c=>c.id===id).category)).size,1);
      assert.ok(body.includes(`browse/${slug}${en?'.en':''}.md`));
    }
  }
});


test('发现池总览可达，整类排后保留完整分类入口但不生成空卡片表',()=>{
  const copy=structuredClone(catalog),category=copy.cases[0].category;
  for(const c of copy.cases)if(c.category===category)c.review={highlights:[],later:true,featured:false};
  for(const en of [false,true]) {
    const readme=buildOutputs(copy).get(`README${en?'.en':''}.md`);
    assert.ok(readme.includes(`](browse/discoveries${en?'.en':''}.md)`));
    assert.doesNotMatch(readme,/<table>\s*<\/table>/);
    assert.ok(readme.includes(en?'No recommendations here yet':'此处暂无推荐'));
    for(const c of copy.cases.filter(c=>c.category===category))assert.ok(!readme.includes(`cases/${c.id}`));
  }
});
