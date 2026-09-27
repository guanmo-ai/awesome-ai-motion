import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(import.meta.dirname,'..');
export const REPOSITORY='guanmo-ai/awesome-ai-motion';
const REPO=`https://github.com/${REPOSITORY}`;
const CATEGORIES=[
  ['产品宣传','Product & marketing','product'],['知识讲解','Education & explainers','education'],
  ['短动效','Motion design','motion'],['像素与角色','Pixel art & characters','characters'],
  ['3D 与交互','3D & interactive','interactive'],['叙事短片','Narrative films','stories'],
  ['音乐与歌词','Music & lyrics','music'],
];
const CATEGORY_ORDER=CATEGORIES.map(c=>c[0]);
const FEATURED=['2103918792845963545','2103315922098470926','2102583898865873225','2102515055116063144','2103099194693271874','2103116235009347650'];
const md=value=>String(value).replace(/[\\`*_{}\[\]<>|]/g,'\\$&');
const html=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const number=value=>value==null?'—':value.toLocaleString('en-US');
const utc=value=>new Date(value).toISOString().slice(0,16).replace('T',' ')+' UTC';
const choose=(en,zh,english)=>en?english:zh;
const title=(c,en)=>en?c.titleEn:c.title;
const category=(c,en)=>CATEGORIES.find(x=>x[0]===c.category)[en?1:0];
const duration=c=>Number.isFinite(c.media.durationSeconds)?`${Math.round(c.media.durationSeconds)}s`:'';

export function compareCases(a,b) {
  const tier=c=>c.prompt.status==='original'?0:1;
  if(tier(a)!==tier(b))return tier(a)-tier(b);
  for(const key of ['bookmarks','likes']) {
    const av=a.metrics[key],bv=b.metrics[key];
    if(av==null&&bv!=null)return 1;if(av!=null&&bv==null)return -1;
    if(av!=null&&bv!=null&&av!==bv)return bv-av;
  }
  return a.id.localeCompare(b.id);
}
function sortedCases(cases) {
  return [...cases].sort((a,b)=>
    (a.prompt.status==='original'?0:1)-(b.prompt.status==='original'?0:1)||
    CATEGORY_ORDER.indexOf(a.category)-CATEGORY_ORDER.indexOf(b.category)||compareCases(a,b));
}
function fence(text) {
  const marker='`'.repeat(Math.max(2,...[...text.matchAll(/`+/g)].map(m=>m[0].length))+1);
  return `${marker}text\n${text}\n${marker}`;
}
export function renderPrompt(prompt,plainPath,en=false) {
  if(prompt.display==='source_link')return `${choose(en,'作者已公开指令；本站仅提供原帖入口，不再分发全文或译文。','The creator has shared instructions; this catalog links to the source without redistributing the full text or translation.')} [${choose(en,'查看作者原文','Read the creator’s original')}](${prompt.sourceUrl})\n`;
  const original=prompt.status==='original';
  const label=original?choose(en,'作者公开提示词','Creator’s public prompt'):choose(en,'作者任务描述 · 非完整提示词','Author brief · not the complete prompt');
  let out=`**${label}** · [${choose(en,'出处','Source')}](${prompt.sourceUrl})`;
  if(plainPath)out+=` · [${choose(en,'纯文本','Plain text')}](${plainPath})`;
  out+='\n\n';
  if(prompt.text.length>500)out+=`<details>\n<summary>${choose(en,'展开原文','Read original')} · ${number(prompt.text.length)} ${choose(en,'字符','characters')}</summary>\n\n${fence(prompt.text)}\n\n</details>\n`;
  else out+=fence(prompt.text)+'\n';
  if(!en&&prompt.translationZh)out+=`\n<details>\n<summary>中文译文</summary>\n\n${fence(prompt.translationZh)}\n\n</details>\n`;
  return out;
}
function cover(c,prefix='',width=640) {
  return `[<img src="${prefix}${c.cover.path}" width="${Math.min(width,c.cover.width)}" alt="${html(c.titleEn)}">](${c.source.url})`;
}
function renderCase(c,{en=false,prefix='',detail=false}={}) {
  let out=`<a id="case-${c.id}"></a>\n\n${detail?'#':'###'} ${md(title(c,en))}\n\n`;
  out+=`**[${md(c.author.name)} · @${md(c.author.handle)}](${c.author.url})** · ${category(c,en)} · ${duration(c)}\n\n`;
  out+=cover(c,prefix)+'\n\n';
  if(c.playback)out+=`<details${detail?' open':''}>\n<summary>▶ ${choose(en,'播放视频','Play video')} · ${duration(c)}</summary>\n\n${c.playback.url}\n\n[${choose(en,'作者原帖','Original post')}](${c.source.url}) · [${choose(en,'播放来源','Playback provider')}](${c.playback.providerPage})\n\n</details>\n\n`;
  else out+=`[▶ ${choose(en,'到作者原帖观看','Watch the original video')}](${c.source.url})\n\n`;
  out+=`${md(en?c.summaryEn:c.summary)}\n\n`;
  const note=en?c.prompt.noteEn:c.prompt.noteZh;
  if(note)out+=`> ${choose(en,'使用前','Before you try')}: ${md(note)}\n\n`;
  out+=renderPrompt(c.prompt,`${prefix}prompts/${c.id}.txt`,en);
  out+=`\n<sub>${choose(en,'收藏','Bookmarks')} ${number(c.metrics.bookmarks)} · ${choose(en,'点赞','Likes')} ${number(c.metrics.likes)} · ${choose(en,'浏览','Views')} ${number(c.metrics.views)}</sub>\n\n`;
  if(!detail)out+=`[${choose(en,'案例详情与来源','Case details & sources')}](${prefix}cases/${c.id}${en?'.en':''}.md)`;
  if(c.codeUrl)out+=`${detail?'':' · '}[${choose(en,'作者源码','Creator’s source code')}](${c.codeUrl})`;
  return out+'\n';
}
function renderFeatured(cases,en) {
  let out='<table>\n';
  const selected=FEATURED.map(id=>cases.find(c=>c.id===id)).filter(Boolean);
  for(let i=0;i<selected.length;i+=2) {
    out+='<tr>\n';
    for(const c of selected.slice(i,i+2))out+=`<td width="50%" valign="top"><a href="#case-${c.id}"><img src="${c.cover.path}" width="400" alt="${html(title(c,en))}"><br><strong>${html(title(c,en))}</strong></a><br><sub>${html(category(c,en))} · ${duration(c)} · <a href="${c.author.url}">@${html(c.author.handle)}</a></sub></td>\n`;
    out+='</tr>\n';
  }
  return out+'</table>';
}
function renderReadme(cases,en) {
  const originals=cases.filter(c=>c.prompt.status==='original');
  const briefs=cases.filter(c=>c.prompt.status==='brief');
  const playable=cases.filter(c=>c.playback).length;
  const stamps=cases.map(c=>c.metrics.checkedAt).sort();
  let out=`<p align="center"><img src="assets/brand/wordmark.svg" width="100%" alt="Awesome AI Motion — Watch. Learn. Create."></p>\n\n`+
    `# Awesome AI Motion\n\n`+
    `**${choose(en,'看见好作品，找到好提示词。','Great motion. Original prompts. Clear sources.')}**\n\n`+
    `${choose(en,'精选 AI 辅助创作的视频与动画，当前聚焦 **Claude Opus 5.5**。从产品宣传、知识讲解到像素动画，每个案例都保留作者、原帖和公开指令。','A curated collection of AI-assisted videos and animations, currently focused on **Claude Opus 5.5**. Explore product films, explainers and pixel animation with creator credits, original posts and public prompts.')}\n\n`+
    `[简体中文](README.md) · [English](README.en.md) · [${choose(en,'贡献作品','Submit a case')}](${REPO}/issues/new?template=submit.yml)\n\n`+
    `**${cases.length} ${choose(en,'个案例','examples')} · ${originals.length} ${choose(en,'份公开提示词','public prompts')} · ${playable} ${choose(en,'个页内播放','inline videos')}**\n\n`+
    `${choose(en,'直接浏览，无需安装，也不消耗模型 Token。找到喜欢的效果，展开视频，再复制作者提示词；需要参考图、音频或额外服务的地方会单独说明。','Browse without installing anything or spending model tokens. Find a result, expand the video, then copy the creator’s prompt. Cases note when reference images, audio or extra services are needed.')}\n\n`+
    `[${choose(en,'精选作品','Start here')}](#featured) · [${choose(en,'全部分类','All categories')}](#browse) · [${choose(en,'常见问题','FAQ')}](#faq) · [${choose(en,'投稿与纠错','Contribute')}](${REPO}/issues)\n\n`+
    `<a id="featured"></a>\n\n## ${choose(en,'从这六个作品开始','Start with these six')}\n\n`+
    `${choose(en,'六种不同的表达方式，由编辑选取。点击封面跳到对应案例。','Six editorial picks across different uses and styles. Click a preview to jump to its case.')}\n\n${renderFeatured(cases,en)}\n\n`+
    `<a id="browse"></a>\n\n## ${choose(en,'按用途浏览','Browse by use case')}\n\n`;
  for(const [zh,english,slug] of CATEGORIES) {
    const count=originals.filter(c=>c.category===zh).length;
    if(count)out+=`- **[${en?english:zh}](#${slug})** · ${count} ${choose(en,'个案例','examples')}\n`;
  }
  out+=`- [${choose(en,'仅公开任务描述','Author briefs only')}](#briefs) · ${briefs.length}\n\n`+
    `${choose(en,'每类按收藏数排序，点赞数用于同分排序。数字为公开快照，浏览量不参与排名。','Within each category, bookmarks sort first and likes break ties. Numbers are public snapshots; views do not determine the order.')} [${choose(en,'数据说明','Data notes')}](docs/SOURCES.md)\n\n`;
  for(const [zh,english,slug] of CATEGORIES) {
    const group=originals.filter(c=>c.category===zh);if(!group.length)continue;
    out+=`<a id="${slug}"></a>\n\n## ${en?english:zh}\n\n`;
    for(const c of group)out+=renderCase(c,{en})+'\n---\n\n';
  }
  out+=`<a id="briefs"></a>\n\n## ${choose(en,'作者任务描述','Author briefs')}\n\n`+
    `${choose(en,`这 ${briefs.length} 个案例有作品可看，但作者只公开了任务转述，不能当作完整提示词。`,'These cases have a viewable result, but only a task description is public. They are not complete prompts.')}\n\n`;
  for(const c of briefs)out+=renderCase(c,{en})+'\n---\n\n';
  out+=`<a id="faq"></a>\n\n## ${choose(en,'常见问题','FAQ')}\n\n`+
    `**${choose(en,'一句话提示词也收录吗？','Do one-line prompts count?')}** ${choose(en,'收录。按作者真实公开内容保留，不为显得专业而扩写。','Yes. We preserve what the creator shared, without padding short prompts.')}\n\n`+
    `**${choose(en,'复制后能得到一模一样的作品吗？','Will I get exactly the same result?')}** ${choose(en,'不能保证。提示词不一定包含完整对话、参考素材和修改过程；我们没有逐条独立复现。','There is no guarantee. Public prompts may omit reference assets, revisions or conversation context. We have not independently reproduced every case.')}\n\n`+
    `**${choose(en,'所有作品都是纯代码生成吗？','Is everything generated entirely in code?')}** ${choose(en,'不是。这里也收录混合制作和交互演示，具体条件写在案例的“使用前”说明中。','No. The collection includes mixed workflows and recordings of interactive scenes. Read each case’s “Before you try” note.')}\n\n`+
    `**${choose(en,'视频打不开怎么办？','What if a video will not play?')}** ${choose(en,'打开作者原帖，或提交失效反馈。页内播放器引用第三方公开附件，可能随提供方状态变化。','Use the original post or report a broken link. Inline videos reference third-party public attachments and may become unavailable.')}\n\n`+
    `## ${choose(en,'一起完善这个片单','Contribute')}\n\n`+
    `[${choose(en,'提交作品','Submit a case')}](${REPO}/issues/new?template=submit.yml) · [${choose(en,'纠错或移除','Correction or removal')}](${REPO}/issues/new?template=correction.yml) · [${choose(en,'投稿规范','Contribution guide')}](CONTRIBUTING.md) · [${choose(en,'维护指南','Maintainer guide')}](docs/MAINTAINING.md)\n\n`+
    `${choose(en,'感谢公开作品与制作过程的创作者。参考','Thanks to the creators who share their work and process. Discovery and presentation references include')} [opus-video-prompts](https://github.com/joeseesun/opus-video-prompts)${choose(en,'、',', ')}[Awesome Claude Video](https://github.com/opusvideo/awesome-claude-video)${choose(en,'、',', ')}[PicoTrex](https://github.com/PicoTrex/Awesome-Nano-Banana-images) ${choose(en,'与','and')} [YouMind](https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts)${choose(en,'；','; ')}${choose(en,'案例逐条保留来源，介绍与译文独立整理。','each case credits its sources. Descriptions and translations are independently prepared.')}\n\n`+
    `${choose(en,'原创维护脚本采用','Original maintenance scripts use')} [MIT](LICENSE)${choose(en,'；第三方媒体与提示词另见','; third-party media and prompts are governed separately. See')} [${choose(en,'来源与复用说明','attribution and reuse') }](THIRD_PARTY.md)${choose(en,'。','.')}\n\n`+
    `<sub>${choose(en,'互动快照','Metrics snapshot')}: ${utc(stamps[0])} — ${utc(stamps.at(-1))} · ${choose(en,'策展','Curated by')} [观默 / @guanmo_ai](https://x.com/guanmo_ai)</sub>\n`;
  return out;
}
export function buildOutputs(catalog) {
  const cases=sortedCases(catalog.cases);const outputs=new Map();
  outputs.set('README.md',renderReadme(cases,false));outputs.set('README.en.md',renderReadme(cases,true));
  for(const c of cases) {
    for(const en of [false,true]) {
      let doc=`[← ${choose(en,'返回图库','Back to gallery')}](../README${en?'.en':''}.md#case-${c.id}) · [${en?'简体中文':'English'}](${c.id}${en?'':'.en'}.md)\n\n`+renderCase(c,{en,prefix:'../',detail:true});
      doc+=`\n## ${choose(en,'来源记录','Source record')}\n\n`+
        `- ${choose(en,'作品原帖','Original post')}: [@${md(c.author.handle)}](${c.source.url}) · ${md(c.source.publishedAt)}\n`+
        `- ${choose(en,'模型归因','Model attribution')}: ${c.model.name} · [${choose(en,'作者说明','Creator’s statement')}](${c.model.evidenceUrl})\n`+
        `- ${choose(en,'提示词出处','Prompt source')}: [${choose(en,'原文','Original')}](${c.prompt.sourceUrl}) · ${utc(c.prompt.checkedAt)}\n`+
        `- ${choose(en,'封面来源','Cover source')}: [${choose(en,'原媒体','Original media')}](${c.cover.sourceUrl})${c.cover.timeSeconds!=null?` · ${c.cover.timeSeconds}s`:''}\n`+
        `- ${choose(en,'互动数据','Metrics')}: [X](${c.metrics.sourceUrl}) · ${utc(c.metrics.checkedAt)} · ${choose(en,'第三方匿名读取，非 X 官方 API','Anonymous third-party snapshot, not the official X API')}\n`+
        `- ${choose(en,'发现入口','Discovered via')}: ${c.discoveredVia?.startsWith('https://')?`[${choose(en,'资料页','Reference')}](${c.discoveredVia})`:md(c.discoveredVia||'Public search')}\n`;
      if(c.playback)doc+=`- ${choose(en,'播放提供方','Playback provider')}: [${choose(en,'固定版本记录','Pinned source record')}](${c.playback.providerPage}) · ${utc(c.playback.checkedAt)}\n`;
      doc+=`\n${choose(en,'模型依据来自作者自述，未独立重跑提示词，也未对音画作统一质量评级。第三方附件为外部引用，未由本站重新上传，转载许可未确认。','Model attribution is based on creator statements. Prompts have not been independently rerun; sound and visuals have not received a uniform quality rating. Third-party attachments are external references, not our uploads; redistribution permission has not been verified.')}\n`;
      if(c.media.videoCount>1)doc+=`\n${choose(en,`原帖包含 ${c.media.videoCount} 个视频，本封面对应第一条。`,`The post contains ${c.media.videoCount} videos; this cover shows the first.`)}\n`;
      outputs.set(`cases/${c.id}${en?'.en':''}.md`,doc);
    }
    if(c.prompt.display!=='source_link')outputs.set(`prompts/${c.id}.txt`,c.prompt.text+'\n');
  }
  return outputs;
}
export function validateCatalog(catalog,root=ROOT) {
  const errors=[];const seen=new Set();
  if(catalog.repository!==REPOSITORY)errors.push('目标仓库配置不一致');
  if(!Array.isArray(catalog.cases)||!catalog.cases.length)return ['案例数据为空'];
  for(const c of catalog.cases) {
    const fail=message=>errors.push(`${c.id}: ${message}`);
    if(seen.has(c.id))fail('重复作品 ID');seen.add(c.id);
    if(!/^\d+$/.test(c.id))fail('作品 ID 无效');
    if(!CATEGORY_ORDER.includes(c.category))fail('用途分类无效');
    if(!c.title||!c.titleEn||!c.summary||!c.summaryEn)fail('缺少编目标题或说明');
    const work=c.source?.url?.match(/^https:\/\/x\.com\/([\w]+)\/status\/(\d+)$/);
    if(!work||work[2]!==c.id||work[1].toLowerCase()!==c.author?.handle?.toLowerCase())fail('作品来源与作者不一致');
    const prompt=c.prompt?.sourceUrl?.match(/^https:\/\/x\.com\/([\w]+)\/status\/(\d+)$/);
    if(!prompt||prompt[1].toLowerCase()!==c.author?.handle?.toLowerCase())fail('提示词作者不一致');
    if(!c.model?.evidenceUrl||!/opus\s*5\.5/i.test(c.model.evidenceQuote||''))fail('模型依据缺失');
    if(!['original','brief'].includes(c.prompt?.status)||(c.prompt?.display!=='source_link'&&!c.prompt?.text?.trim()))fail('提示词状态或内容缺失');
    for(const key of ['bookmarks','likes','views']) {
      const value=c.metrics?.[key];if(value!==null&&(!Number.isSafeInteger(value)||value<0))fail(`${key} 不是非负整数或 null`);
    }
    for(const date of [c.metrics?.checkedAt,c.prompt?.checkedAt,c.verification?.sourceReadAt])if(!date||Number.isNaN(Date.parse(date)))fail('核对时间缺失');
    if(!c.metrics?.sourceUrl?.startsWith('https://x.com/'))fail('互动快照来源缺失');
    const cover=c.cover?.path;
    if(!/^assets\/covers\/\d+\.jpg$/.test(cover||'')||!fs.existsSync(path.join(root,cover)))fail('封面缺失');
    else if(fs.statSync(path.join(root,cover)).size>250_000)fail('封面超过 250 KB');
    if(!c.cover?.sourceUrl?.startsWith('https://'))fail('封面来源缺失');
    if(!c.verification?.videoAttachmentConfirmed)fail('视频附件未经核对');
    if(c.playback) {
      const v=c.playback;
      if(v.kind!=='external_github_attachment'||!/^https:\/\/github\.com\/user-attachments\/assets\/[a-f0-9-]{36}$/.test(v.url||''))fail('播放地址或类型无效');
      if(v.sourcePostUrl!==c.source.url||!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/blob\/[a-f0-9]{40}\/README\.md$/.test(v.providerPage||''))fail('播放来源缺失或作品不一致');
      if(!v.contentType?.startsWith('video/')||!v.checkedAt||Number.isNaN(Date.parse(v.checkedAt)))fail('播放媒体核对记录缺失');
      if(v.reuploadPermission!=='not_verified')fail('播放许可状态不支持，请另行审核');
    }
    if(!Number.isSafeInteger(c.cover?.width)||c.cover.width<=0)fail('封面尺寸无效');
    if(c.author?.url!==`https://x.com/${c.author?.handle}`)fail('作者主页不一致');
    const model=c.model?.evidenceUrl?.match(/^https:\/\/x\.com\/([\w]+)\/status\/\d+$/);
    if(!model||model[1].toLowerCase()!==c.author?.handle?.toLowerCase())fail('模型证据作者不一致');

  }
  return errors;
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'data/cases.json'),'utf8'));
  const errors=validateCatalog(catalog);
  if(errors.length){console.error(errors.join('\n'));process.exit(1);}
  const check=process.argv.includes('--check');let stale=0;
  for(const [file,content] of buildOutputs(catalog)) {
    const target=path.join(ROOT,file);
    if(check) {if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==content){console.error(`待更新：${file}`);stale++;}}
    else {fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);}
  }
  if(stale)process.exit(1);
  console.log(`${check?'校验通过':'已生成'}：${catalog.cases.length} 个案例，README、案例页与纯文本提示词。`);
}
