import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const CATEGORY_ORDER = ['产品宣传','知识讲解','短动效','像素与角色','3D 与交互','叙事短片','音乐与歌词'];
const md = value => String(value).replace(/[\\`*_{}\[\]<>|]/g, '\\$&');
const html = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const number = value => value === null || value === undefined ? '—' : value.toLocaleString('en-US');
const utc = value => new Date(value).toISOString().slice(0,16).replace('T',' ')+' UTC';

export function compareCases(a,b) {
  const tier = c => c.prompt.status === 'original' ? 0 : 1;
  if(tier(a)!==tier(b)) return tier(a)-tier(b);
  for(const key of ['bookmarks','likes']) {
    const av=a.metrics[key], bv=b.metrics[key];
    if(av==null && bv!=null)return 1;
    if(av!=null && bv==null)return -1;
    if(av!=null && bv!=null && av!==bv)return bv-av;
  }
  return a.id.localeCompare(b.id);
}

function fence(text) {
  const longest=Math.max(2,...[...text.matchAll(/`+/g)].map(m=>m[0].length));
  const marker='`'.repeat(longest+1);
  return `${marker}text\n${text}\n${marker}`;
}

export function renderPrompt(prompt, plainPath) {
  if(prompt.display==='source_link')return `作者已公开指令；本站仅提供原帖入口，不再分发全文或译文。 [查看作者原文](${prompt.sourceUrl})\n`;
  const original=prompt.status==='original';
  const title=original?'作者公开提示词':'作者任务描述（非完整提示词）';
  let out=`**${title}** · [出处](${prompt.sourceUrl})`;
  if(plainPath)out+=` · [纯文本](${plainPath})`;
  out+='\n\n';
  if(prompt.text.length>500)out+=`<details>\n<summary>展开原文（${prompt.text.length.toLocaleString('en-US')} 字符）</summary>\n\n${fence(prompt.text)}\n\n</details>\n`;
  else out+=fence(prompt.text)+'\n';
  if(prompt.translationZh)out+=`\n<details>\n<summary>中文译文（本站整理）</summary>\n\n${fence(prompt.translationZh)}\n\n</details>\n`;
  if(prompt.noteZh)out+=`\n${md(prompt.noteZh)}\n`;
  return out;
}

function renderCase(c,index,prefix='',level=3) {
  const time=c.media.durationSeconds;
  const duration=Number.isFinite(time)?` · ${Math.round(time)} 秒`:'';
  return `<a id="case-${c.id}"></a>\n\n${'#'.repeat(level)} ${index}. ${md(c.title)}\n\n`+
    (c.playback?`<details>\n<summary>封面预览 · 点击封面访问作者原帖</summary>\n\n`:'')+
    `[<img src="${prefix}${c.cover.path}" width="${Math.min(640,c.cover.width)}" alt="${html(c.title)}；点击观看作者原帖">](${c.source.url})\n\n`+
    (c.playback?'\n</details>\n\n':'')+
    `**[${md(c.author.name)} · @${md(c.author.handle)}](${c.author.url})** · [观看原帖](${c.source.url}) · ${c.category}${duration}\n\n`+
    `${md(c.summary)}\n\n`+
    (c.playback?`${c.playback.url}\n\n[外部播放来源](${c.playback.providerPage}) · 播放不可用时请打开原帖。\n\n`:'')+
    `收藏 **${number(c.metrics.bookmarks)}** · 点赞 **${number(c.metrics.likes)}** · 浏览 **${number(c.metrics.views)}**\n\n`+
    renderPrompt(c.prompt,`${prefix}prompts/${c.id}.txt`)+
    `\n[来源与数据快照](${prefix}cases/${c.id}.md)${c.codeUrl?` · [相关源码](${c.codeUrl})`:''}\n`;
}


function renderFeatured(cases) {
  const ids=['2102787937482252537','2103315922098470926','2102583898865873225','2102515055116063144','2102853258582880547','2103116235009347650'];
  const selected=ids.map(id=>cases.find(c=>c.id===id)).filter(Boolean);
  let out='<table>\n';
  for(let i=0;i<selected.length;i+=3) {
    out+='<tr>\n';
    for(const c of selected.slice(i,i+3))out+=`<td width="33%" align="center"><a href="#case-${c.id}"><img src="${c.cover.path}" width="280" alt="${html(c.title)}"><br>${html(c.title)}</a><br><sub>${c.category}</sub></td>\n`;
    out+='</tr>\n';
  }
  return out+'</table>';
}

function renderEnglish(cases,playable) {
  const labels=['Product & marketing','Education & explainers','Motion design','Pixel art & characters','3D & interactive','Narrative films','Music & lyrics'];
  let out=`# Awesome Opus Gallery\n\n[简体中文](README.md) · English\n\n**Watch the work. Find the prompt. Credit the creator.** A curated collection of videos and animations made with Claude Opus, currently focused on **Opus 5.5**.\n\n**${cases.length} examples · ${cases.filter(c=>c.prompt.status==='original').length} public prompts · ${playable} external playback links**\n\nBrowse without installing anything or using model tokens. The Chinese catalog includes previews, inline GitHub videos where available, original prompts, translations and source notes. Long prompts expand in place.\n\n## Browse by use case\n\n`;
  CATEGORY_ORDER.forEach((category,i)=>{
    out+=`### ${labels[i]}\n\n`;
    for(const c of cases.filter(c=>c.category===category))out+=`- [${md(c.titleEn||c.title)} · ${c.media.durationSeconds==null?'demo':Math.round(c.media.durationSeconds)+'s'}](cases/${c.id}.md) — ${c.prompt.status==='original'?'Public prompts':'Author brief, not a full prompt'} · [original post](${c.source.url}) · [prompt source](${c.prompt.sourceUrl})\n`;
    out+='\n';
  });
  out+=`## What the labels mean\n\n- **Public prompts**: text the creator shared as a prompt or template, not necessarily their entire conversation or assets.\n- **Author brief**: a description of the task; never presented as the complete prompt.\n- **External playback**: a public GitHub attachment hosted by a third party, with its provider and original post recorded. We have not re-uploaded these videos or verified permission to redistribute them.\n- **Metrics**: public post snapshots, not live X API statistics. Within each category, bookmarks sort first and likes break ties. Unknown values are shown as —. Popularity is not a quality score.\n\n## Contribute\n\n[Submit a case](https://github.com/guanmo-ai/awesome-ai-motion/issues/new?template=submit.yml) · [Report an error or request removal](https://github.com/guanmo-ai/awesome-ai-motion/issues/new?template=correction.yml) · [Contribution guide](CONTRIBUTING.md)\n\nOriginal maintenance scripts use [MIT](LICENSE). Third-party media and prompts are excluded; see [attribution and reuse](THIRD_PARTY.md). Model attribution is based on creator statements; prompts have not been independently reproduced.\n\nCurated by **观默 / [@guanmo_ai](https://x.com/guanmo_ai)**. Inspired by [opus-video-prompts](https://github.com/joeseesun/opus-video-prompts), with discovery and media references credited in each case.\n`;
  return out;
}

export function buildOutputs(catalog) {
  const cases=[...catalog.cases].sort((a,b)=>{
    const tier=(a.prompt.status==='original'?0:1)-(b.prompt.status==='original'?0:1);
    return tier || CATEGORY_ORDER.indexOf(a.category)-CATEGORY_ORDER.indexOf(b.category) || compareCases(a,b);
  });
  const original=cases.filter(c=>c.prompt.status==='original');
  const brief=cases.filter(c=>c.prompt.status==='brief');
  const first=cases.map(c=>c.metrics.checkedAt).sort()[0];
  const last=cases.map(c=>c.metrics.checkedAt).sort().at(-1);
  const outputs=new Map();
  const playable=cases.filter(c=>c.playback).length;
  let readme=`# Awesome Opus Gallery · 帧选\n\n`+
    `[简体中文](README.md) · [English](README.en.md) · [投稿](https://github.com/guanmo-ai/awesome-ai-motion/issues/new?template=submit.yml)\n\n`+
    `**先看作品，再找提示词。** 精选 Claude Opus 5.5 参与制作的视频与动画，保留作者、原帖和公开指令。\n\n`+
    `**${cases.length} 个案例 · ${original.length} 份公开提示词 · ${brief.length} 条作者任务描述 · ${playable} 个外部播放入口**\n\n`+
    `从精选封面进入案例；已接入的作品可在 GitHub 内播放，也可打开作者原帖。短提示词直接复制，长提示词点击展开。无需下载、安装或运行项目，浏览不消耗模型 Token。\n\n`+
    `[按用途找作品](#用途索引) · [公开提示词](#公开提示词) · [任务描述补充](#任务描述补充) · [投稿与纠错](CONTRIBUTING.md)\n\n`+
    `## 精选速览\n\n${renderFeatured(cases)}\n\n`+
    `## 用途索引\n\n| 我想做什么 | 可以先看这些 |\n| --- | --- |\n`;
  for(const category of CATEGORY_ORDER) {
    const found=original.filter(c=>c.category===category);
    if(found.length)readme+=`| ${category} | ${found.map(c=>`[${md(c.title)}](#case-${c.id})`).join(' · ')} |\n`;
  }
  readme+=`\n## 公开提示词\n\n`+
    `按用途分组，**每类按收藏数降序**，同收藏数按点赞数排列。精选速览由编辑选取，以覆盖不同用途。浏览量仅供参考；缺失数据显示「—」并排在已知值之后。热度不等于作品质量，也不是全网排行榜。\n\n`+
    `互动数据为匿名公开读取快照：${utc(first)} 至 ${utc(last)}；[来源与更新方法](docs/SOURCES.md)。\n\n`;
  for(const category of CATEGORY_ORDER) {
    const group=original.filter(c=>c.category===category);if(!group.length)continue;
    readme+=`### ${category}\n\n`;
    group.forEach(c=>{readme+=renderCase(c,cases.indexOf(c)+1,'',4)+'\n---\n\n';});
  }
  readme+=`## 任务描述补充\n\n以下作品有观看地址，但作者只公开了任务转述或片段，不能当作完整原始提示词。\n\n`;
  brief.forEach((c,i)=>{readme+=renderCase(c,i+original.length+1)+'\n---\n\n';});
  readme+=`## 来源与致谢\n\n`+
    `感谢每位公开作品和制作过程的作者。本项目独立编写选片介绍、分类与译文，逐条回查公开来源。参考了 [opus-video-prompts](https://github.com/joeseesun/opus-video-prompts) 的分享思路，以及 [Awesome Claude Video](https://github.com/opusvideo/awesome-claude-video) 和 [YouMind](https://youmind.com/zh-CN/opus-5-5-prompts) 的发现线索；各案例保留具体发现来源。\n\n`+
    `模型归因来自作者自述，未独立复现。公开提示词不代表完整对话或额外素材已提供。播放器引用第三方已公开的 GitHub 附件，逐条标明提供方；本站未重新上传视频，也未把外部公开链接视为转载授权。仓库只保存小封面、文字与媒体地址。原帖访问可能受 X 登录要求影响。\n\n`+
    `原创脚本采用 [MIT](LICENSE)；第三方封面、视频和提示词不包含在此许可内，见 [来源与复用说明](THIRD_PARTY.md)。\n\n`+
    `策展：**观默 / [@guanmo_ai](https://x.com/guanmo_ai)**\n\n`+
    `<details>\n<summary>维护者：更新索引与校验</summary>\n\n普通读者无需运行。维护者需要 Node.js 22+，无第三方依赖。\n\n\`\`\`sh\nnode scripts/build.mjs\nnode --test tests/*.test.mjs\nnode scripts/build.mjs --check\nnode scripts/check-release.mjs\n\`\`\`\n\n内容源为 [data/cases.json](data/cases.json)，修改后重新生成。\n\n</details>\n`;
  outputs.set('README.md',readme);
  outputs.set('README.en.md',renderEnglish(cases,playable));
  for(const [index,c] of cases.entries()) {
    let doc=`[← 返回案例库](../README.md#case-${c.id})\n\n`+renderCase(c,index+1,'../');
    doc+=`\n## 来源记录\n\n`+
      `- 作者原帖：[${md(c.author.handle)}](${c.source.url})；原帖时间：${md(c.source.publishedAt)}。\n`+
      `- 模型：${c.model.name}，${c.model.basis}。[作者说明](${c.model.evidenceUrl})\n`+
      `- 提示词：${c.prompt.status==='original'?'作者公开原文':'作者任务描述'}；[原始出处](${c.prompt.sourceUrl})；核对时间：${utc(c.prompt.checkedAt)}。\n`+
      `- 封面：${c.cover.kind==='video_frame'?`视频截图${c.cover.timeSeconds!=null?`（${c.cover.timeSeconds} 秒）`:''}`:'原帖视频缩略图'}；[媒体来源](${c.cover.sourceUrl})。封面归原作者所有。\n`+
      `- 互动指标：[匿名读取来源](${c.metrics.sourceUrl})；${utc(c.metrics.checkedAt)}；公开数据快照。\n`+
      `- 发现入口：${c.discoveredVia?.startsWith('https://')?`[资料页](${c.discoveredVia})`:md(c.discoveredVia||'公开搜索')}。\n`+
      `- 原帖视频附件已核对；没有独立重跑提示词，也未对声音和完整视频作统一质量评级。\n`;
    if(c.playback)doc+=`- 播放方式：引用第三方公开附件，未由本站重新上传；[提供方记录](${c.playback.providerPage})；核对时间：${utc(c.playback.checkedAt)}。转载许可尚未确认。\n`;
    if(c.media.videoCount>1)doc+=`- 原帖包含 ${c.media.videoCount} 个视频，本封面对应该帖第一条视频。\n`;
    outputs.set(`cases/${c.id}.md`,doc);
    if(c.prompt.display!=='source_link')outputs.set(`prompts/${c.id}.txt`,c.prompt.text+'\n');
  }
  return outputs;
}

export function validateCatalog(catalog,root=ROOT) {
  const errors=[];const seen=new Set();
  if(!Array.isArray(catalog.cases)||!catalog.cases.length)return ['案例数据为空'];
  for(const c of catalog.cases) {
    const fail=message=>errors.push(`${c.id}: ${message}`);
    if(seen.has(c.id))fail('重复作品 ID');seen.add(c.id);
    if(!/^\d+$/.test(c.id))fail('作品 ID 无效');
    if(!CATEGORY_ORDER.includes(c.category))fail('用途分类无效');
    if(!c.title||!c.summary)fail('缺少编目标题或说明');
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
