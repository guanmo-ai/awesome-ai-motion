import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCases, renderPrompt, buildOutputs, validateCatalog } from '../scripts/build.mjs';
import {readState} from '../assets/gallery-model.mjs';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/cases.json'), 'utf8'));

test('创作导览双语展示并保留作者原文，拒绝不完整建议和危险来源链接',()=>{
  const copy=structuredClone(catalog),c=copy.cases.find(item=>item.guide);
  const original=c.prompt.text;
  c.guide.takeawayZh='<script>alert(1)</script> 观察节奏';
  assert.deepEqual(validateCatalog(copy,root),[]);
  const outputs=buildOutputs(copy);
  assert.ok(outputs.get(`cases/${c.id}.en.md`).includes('What to learn'));
  assert.ok(outputs.get(`cases/${c.id}.md`).includes('可以借鉴什么'));
  assert.ok(!outputs.get(`cases/${c.id}.md`).includes('<script>alert(1)</script>'));
  assert.equal(outputs.get(`prompts/${c.id}.txt`),original+'\n');
  const valid=structuredClone(c.guide);
  for(const invalid of [{takeawayEn:''},{stepsZh:['只有一步']},{evidenceUrls:['javascript:alert(1)']},{evidenceUrls:['https://example.com/)(bad)']}]){
    c.guide={...valid,...invalid};
    assert.ok(validateCatalog(copy,root).some(error=>error.includes('制作导览')));
  }
});

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
  const copy=structuredClone(catalog);
  const item=copy.cases.find(c=>c.stage!=='discovery');
  assert.ok(item,'需要已编目样本验证其模型依据要求');
  item.model.evidenceQuote='unknown';
  item.prompt.sourceUrl='https://x.com/wrong_author/status/123';
  item.cover.path='assets/covers/missing.jpg';
  copy.cases.push(item);
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
    else assert.equal(outputs.get(`prompts/${c.id}.txt`),c.prompt.text+'\n');
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
    const browse=[...outputs].filter(([file])=>/^browse\/.*(?<!\.en)\.md$/.test(file)&&!['browse/discoveries.md','browse/resources.md'].includes(file));
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

test('所有双语作品页的主观看入口和封面进入实际可用的观看页，原帖仍可访问', () => {
  const outputs=buildOutputs(catalog);
  for(const c of catalog.cases) for(const en of [false,true]) {
    const detail=outputs.get(`cases/${c.id}${en?'.en':''}.md`);
    const watch=c.webPlayback?`https://guanmo-ai.github.io/awesome-ai-motion/${en?'?lang=en':''}#case-${c.id}`:c.source.url;
    const label=c.webPlayback?(en?'Open gallery to play':'打开画廊播放'):(en?'Watch on X':'在 X 原帖观看');
    assert.ok(detail.includes(`**[▶ ${label}](${watch})**`),`${c.id}: 主观看入口`);
    assert.ok(detail.includes(`>](${watch})`),`${c.id}: 封面观看入口`);
    assert.ok(detail.includes(c.webPlayback?(en?'Click the cover to open the gallery and play.':'点击封面打开画廊播放。'):(en?'Click the cover to watch on X.':'点击封面前往 X 原帖观看。')));
    assert.ok(detail.includes(c.source.url),`${c.id}: 保留作者原帖`);
    if(c.webPlayback) {
      assert.ok(detail.includes(`** · [${en?'Original post':'作者原帖'}](${c.source.url})`));
      assert.deepEqual({caseId:readState(watch).caseId,lang:readState(watch).lang},{caseId:c.id,lang:en?'en':'zh'});
    } else assert.ok(!detail.includes(`#case-${c.id}`),`${c.id}: 无视频不应使用画廊路由`);
    assert.doesNotMatch(detail,/\]\(https:\/\/video\.twimg\.com\//);
  }
});

test('README 与分类页双语卡片直接播放，并保留 GitHub 详情及作者原帖', () => {
  const outputs=buildOutputs(catalog);
  for(const en of [false,true]) for(const [file,body] of outputs) {
    if(/^browse\/resources(?:\.en)?\.md$/.test(file))continue;
    if(!file.startsWith('browse/')&&file!==`README${en?'.en':''}.md`)continue;
    if(file.startsWith('browse/')&&file.endsWith('.en.md')!==en)continue;
    if(file.startsWith('README')&&file.endsWith('.en.md')!==en)continue;
    if(file.startsWith('README'))assert.ok(body.includes(en?'Click a cover to play in the gallery':'点击封面打开画廊播放'));
    const cards=[...body.matchAll(/<td\b[^>]*>(.*?)<\/td>/gs)].map(m=>m[1]);
    assert.ok(cards.length,`${file}: 应包含可观看卡片`);
    for(const card of cards) {
      const id=card.match(/cases\/(\d+)(?:\.en)?\.md/)?.[1];
      assert.ok(id,`${file}: 卡片详情链接缺失`);
      const c=catalog.cases.find(item=>item.id===id);
      const detail=`${file.startsWith('browse/')?'../':''}cases/${id}${en?'.en':''}.md`;
      const watch=c.webPlayback?`https://guanmo-ai.github.io/awesome-ai-motion/${en?'?lang=en':''}#case-${id}`:c.source.url;
      const label=c.webPlayback?(en?'▶ Open gallery to play':'▶ 打开画廊播放'):(en?'▶ Watch on X':'▶ 在 X 原帖观看');
      assert.ok(card.startsWith(`<a href="${watch}">`),`${file}: 封面必须进入实际观看入口`);
      assert.ok(card.includes(`<a href="${watch}">${label}</a>`));
      assert.ok(card.includes(`<a href="${detail}">${en?'Case details & sources':'案例详情与来源'}</a>`));
      assert.ok(card.includes(`<a href="${c.source.url}">${en?'Original post':'作者原帖'}</a>`));
      if(c.webPlayback) {
        assert.deepEqual({caseId:readState(watch).caseId,lang:readState(watch).lang},{caseId:id,lang:en?'en':'zh'});
        assert.ok(!card.includes(c.webPlayback.url),`${file}: 卡片不应导航到裸 MP4`);
      } else assert.ok(!card.includes(`#case-${id}`),`${file}: 无视频不应使用画廊路由`);
    }
  }
});

test('没有画廊视频时双语详情、README 和分类页回退作者原帖', () => {
  const copy=structuredClone(catalog);
  const firstReadme=buildOutputs(copy).get('README.md');
  const id=firstReadme.match(/cases\/(\d+)\.md/)?.[1];
  assert.ok(id,'README 应有可测试卡片');
  const c=copy.cases.find(item=>item.id===id);
  delete c.webPlayback;
  const outputs=buildOutputs(copy);
  for(const en of [false,true]) {
    const detail=`cases/${id}${en?'.en':''}.md`;
    const caseBody=outputs.get(detail);
    assert.ok(caseBody.includes(`**[▶ ${en?'Watch on X':'在 X 原帖观看'}](${c.source.url})**`));
    assert.ok(caseBody.includes(`>](${c.source.url})`));
    assert.ok(caseBody.includes(en?'Click the cover to watch on X.':'点击封面前往 X 原帖观看。'));
    assert.ok(!caseBody.includes(en?'Open gallery to play':'打开画廊播放'));
    let browseCards=0;
    for(const file of [`README${en?'.en':''}.md`,...([...outputs.keys()].filter(name=>name.startsWith('browse/')&&(name.endsWith('.en.md')===en)))]) {
      const card=[...outputs.get(file).matchAll(/<td\b[^>]*>(.*?)<\/td>/gs)].map(m=>m[1]).find(text=>text.includes(`${detail}`));
      if(file.startsWith('README'))assert.ok(card,`${file}: 选中的案例应显示在首页`);
      if(!card)continue;
      if(file.startsWith('browse/'))browseCards++;
      assert.ok(card.startsWith(`<a href="${c.source.url}">`),`${file}: 无画廊视频的封面应去原帖`);
      assert.ok(card.includes(`<a href="${c.source.url}">${en?'▶ Watch on X':'▶ 在 X 原帖观看'}</a>`));
      assert.ok(card.includes(`<a href="${file.startsWith('browse/')?'../':''}${detail}">${en?'Case details & sources':'案例详情与来源'}</a>`));
      assert.ok(!card.includes(`#case-${id}`),`${file}: 不应承诺画廊播放器`);
    }
    assert.ok(browseCards>=1,`双语分类应包含 ${id}`);
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
  const valid={kind:'external_source_video',url:c.webPlayback.url,sourcePostUrl:c.source.url,contentType:'video/mp4',checkedAt:'2026-09-27T12:00:00Z',verificationLevel:'source_media_matched',reuploadPermission:'not_verified'};
  c.webPlayback=valid;
  assert.deepEqual(validateCatalog(copy,root),[]);
  for(const patch of [{url:'https://video.twimg.com.evil.example/a.mp4'},{url:valid.url+(valid.url.includes('?')?'&':'?')+'jwt=temporary'},{sourcePostUrl:'https://x.com/other/status/123'},{reuploadPermission:'granted'},{verificationLevel:''}]) {
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


test('发现池按来源核对和编目进度标记，不把完整视听评价当作收录门槛',()=>{
  const copy=structuredClone(catalog),c=copy.cases[0];
  c.stage='discovery';c.verification.authorClaimConfirmed=true;c.verification.fullReview=false;
  c.model.name='Claude';c.model.evidenceQuote='I used Claude to make this animation';
  c.prompt.status='unknown';c.prompt.text='';
  delete c.webPlayback;
  assert.deepEqual(validateCatalog(copy,root),[]);
  const outputs=buildOutputs(copy);
  assert.ok(outputs.get(`cases/${c.id}.md`).includes('编目资料待完善'));
  assert.ok(outputs.get('browse/discoveries.md').includes('编目资料待完善'));
  assert.ok(!outputs.get('README.md').includes('待审看'));
  assert.ok(outputs.get(`cases/${c.id}.md`).includes('未取得作者公开提示词'));
  assert.equal(outputs.has(`prompts/${c.id}.txt`),false);
  assert.ok(outputs.get('browse/discoveries.md').includes(c.id));
  delete c.verification.fullReview;
  assert.deepEqual(validateCatalog(copy,root),[]);
  c.verification.fullReview='pending';
  assert.ok(validateCatalog(copy,root).some(e=>e.includes('视听评价状态')));
  c.verification.fullReview=false;
  c.verification.authorClaimConfirmed=false;
  assert.ok(validateCatalog(copy,root).some(e=>e.includes('发现池')));
  c.verification.authorClaimConfirmed=true;c.prompt.text='invented';
  assert.ok(validateCatalog(copy,root).some(e=>e.includes('提示词')));
});


test('首页每个非空类别都有最多三张对应封面与完整分类入口',()=>{
  for(const en of [false,true]) {
    const readme=buildOutputs(catalog).get(`README${en?'.en':''}.md`);
    const sections=[...readme.matchAll(/<a id="category-([^"]+)"><\/a>(.*?)(?=<a id="category-|首页及分类预览|Homepage and category previews)/gs)];
    assert.equal(sections.length,new Set(catalog.cases.map(c=>c.category)).size);
    for(const [,slug,body] of sections) {
      const ids=[...body.matchAll(/<td[^>]*>.*?<a href="cases\/(\d+)(?:\.en)?\.md">(?:案例详情与来源|Case details & sources)<\/a>/gs)].map(m=>m[1]);
      assert.ok(ids.length>0&&ids.length<=3);
      assert.equal(new Set(ids).size,ids.length);
      assert.equal(new Set(ids.map(id=>catalog.cases.find(c=>c.id===id).category)).size,1);
      assert.ok(body.includes(`browse/${slug}${en?'.en':''}.md`));
    }
  }
});


test('首页和分类预览按收藏展示，人工排后不改变收藏榜，发现池仍可达',()=>{
  const copy=structuredClone(catalog),category=copy.cases[0].category;
  for(const c of copy.cases)if(c.category===category)c.review={highlights:[],later:true,featured:false};
  const ranked=[...copy.cases].sort((a,b)=>(b.metrics.bookmarks??-1)-(a.metrics.bookmarks??-1)||Date.parse(b.source.publishedAt)-Date.parse(a.source.publishedAt)||a.id.localeCompare(b.id));
  const ids=body=>[...body.matchAll(/<a href="cases\/(\d+)(?:\.en)?\.md">(?:案例详情与来源|Case details & sources)<\/a>/g)].map(m=>m[1]);
  for(const en of [false,true]) {
    const readme=buildOutputs(copy).get(`README${en?'.en':''}.md`);
    const intro=readme.split(`## ${en?'Most bookmarked':'收藏最多'}`)[1].split('<a id="featured">')[0];
    assert.deepEqual(ids(intro),ranked.slice(0,6).map(c=>c.id));
    assert.ok(intro.includes(`${en?'Bookmarks':'收藏'} ${ranked[0].metrics.bookmarks.toLocaleString('en-US')}`));
    assert.ok(readme.includes(`](browse/discoveries${en?'.en':''}.md)`));
    for(const [,body] of readme.matchAll(/<a id="category-[^"]+"><\/a>(.*?)(?=<a id="category-|首页及分类预览|Homepage and category previews)/gs)) {
      const actual=ids(body),source=copy.cases.find(c=>c.id===actual[0]).category;
      assert.deepEqual(actual,ranked.filter(c=>c.category===source).slice(0,3).map(c=>c.id));
    }
    assert.doesNotMatch(readme,/<table>\s*<\/table>/);
  }
});
