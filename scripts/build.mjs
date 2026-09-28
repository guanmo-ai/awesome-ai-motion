import fs from 'node:fs';
import {recommendedCases,introCases,isFeatured,FEATURED,reviewRank,reviewLabels,validReview,stateUrl} from '../assets/gallery-model.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(import.meta.dirname,'..');
export const REPOSITORY='guanmo-ai/awesome-ai-motion';
const REPO=`https://github.com/${REPOSITORY}`;
const SITE='https://guanmo-ai.github.io/awesome-ai-motion/';
const CATEGORIES=[
  ['产品宣传','Product & marketing','product'],['知识讲解','Education & explainers','education'],
  ['短动效','Motion design','motion'],['像素与角色','Pixel art & characters','characters'],
  ['3D 与交互','3D & interactive','interactive'],['叙事短片','Narrative films','stories'],
  ['音乐与歌词','Music & lyrics','music'],
];
const CATEGORY_ORDER=CATEGORIES.map(c=>c[0]);
const md=value=>String(value).replace(/[\\`*_{}\[\]<>|]/g,'\\$&');
const html=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const number=value=>value==null?'—':value.toLocaleString('en-US');
const utc=value=>new Date(value).toISOString().slice(0,16).replace('T',' ')+' UTC';
const choose=(en,zh,english)=>en?english:zh;
const title=(c,en)=>en?c.titleEn:c.title;
const isDiscovery=c=>c.stage==='discovery';
const displayZh=zh=>({'像素与角色':'角色动画','3D 与交互':'交互演示'}[zh]||zh);
const category=(c,en)=>en?CATEGORIES.find(x=>x[0]===c.category)[1]:displayZh(c.category);
const duration=c=>Number.isFinite(c.media.durationSeconds)?`${Math.round(c.media.durationSeconds)}s`:'';

export function compareCases(a,b) {
  const preference=reviewRank(b)-reviewRank(a);if(preference)return preference;
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
  if(prompt.status==='unknown')return `${choose(en,'未取得作者公开提示词。','No public prompt has been verified.')} [${choose(en,'查看作者原帖','View the original post')}](${prompt.sourceUrl})\n`;
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
function cover(c,prefix='',width=640,url=c.source.url) {
  return `[<img src="${prefix}${c.cover.path}" width="${Math.min(width,c.cover.width)}" alt="${html(c.titleEn)}">](${url})`;
}
function watchUrl(c,en) {
  return c.webPlayback ? stateUrl({category:'all',sort:'bookmarks',lang:en?'en':'zh',caseId:c.id},SITE).href : c.source.url;
}
function relatedLinks(c,en) {
  const links=[];
  if(c.demoUrl)links.push(`[${choose(en,'交互体验','Interactive demo')}](${c.demoUrl})`);
  if(c.codeUrl)links.push(`[${choose(en,'作者源码','Creator’s source code')}](${c.codeUrl})`);
  return links;
}
function renderCase(c,{en=false,prefix='',detail=false}={}) {
  let out=`<a id="case-${c.id}"></a>\n\n${detail?'#':'###'} ${md(title(c,en))}\n\n`;
  out+=`**[${md(c.author.name)} · @${md(c.author.handle)}](${c.author.url})** · ${category(c,en)} · ${duration(c)}\n\n`;
  if(isDiscovery(c))out+=`> ${choose(en,'发现池 · 已核对作者原帖与媒体来源，尚未完整审看。','Discovery pool · Creator post and media source verified; full viewing review pending.')}\n\n`;
  if(reviewLabels(c,en?'en':'zh').length)out+=`**${choose(en,'策展评价','Curator’s review')}：${reviewLabels(c,en?'en':'zh').join(' · ')}**\n\n`;
  const watch=watchUrl(c,en);
  out+=`**[▶ ${c.webPlayback?choose(en,'打开画廊播放','Open gallery to play'):choose(en,'在 X 原帖观看','Watch on X')}](${watch})**${c.webPlayback?` · [${choose(en,'作者原帖','Original post')}](${c.source.url})`:''}\n\n`+
    `${choose(en,c.webPlayback?'点击封面打开画廊播放。':'点击封面前往 X 原帖观看。',c.webPlayback?'Click the cover to open the gallery and play.':'Click the cover to watch on X.')}\n\n`+
    `${cover(c,prefix,640,watch)}\n\n${relatedLinks(c,en).join(' · ')}\n\n`;
  out+=`${md(en?c.summaryEn:c.summary)}\n\n`;
  if(c.guide) {
    out+=`## ${choose(en,'可以借鉴什么','What to learn')}\n\n${md(en?c.guide.takeawayEn:c.guide.takeawayZh)}\n\n`;
    out+=`**${choose(en,'开始尝试','Try it yourself')}** · ${choose(en,'根据作者公开资料整理的编辑建议，并非作者完整操作记录。','Editorial suggestions based on public source material, not a complete record of the creator’s process.')}\n\n`;
    out+=(en?c.guide.stepsEn:c.guide.stepsZh).map((step,i)=>`${i+1}. ${md(step)}`).join('\n')+'\n\n';
    if(c.guide.tools.length)out+=`${choose(en,'原文提到的工具','Tools mentioned in the source')}：${c.guide.tools.map(md).join(' · ')}\n\n`;
    out+=c.guide.evidenceUrls.map((url,i)=>`[${choose(en,'资料出处','Source')} ${i+1}](${url})`).join(' · ')+'\n\n';
  }
  const note=en?c.prompt.noteEn:c.prompt.noteZh;
  if(note)out+=`> ${choose(en,'使用前','Before you try')}: ${md(note)}\n\n`;
  out+=renderPrompt(c.prompt,`${prefix}prompts/${c.id}.txt`,en);
  out+=`\n<sub>${choose(en,'收藏','Bookmarks')} ${number(c.metrics.bookmarks)} · ${choose(en,'点赞','Likes')} ${number(c.metrics.likes)} · ${choose(en,'浏览','Views')} ${number(c.metrics.views)}</sub>\n\n`;
  if(!detail)out+=`[${choose(en,'案例详情与来源','Case details & sources')}](${prefix}cases/${c.id}${en?'.en':''}.md)`;
  return out+'\n';
}
function renderCards(cases,en,prefix='',columns=2) {
  if(!cases.length)return choose(en,'此处暂无推荐，仍可进入分类浏览全部作品。','No recommendations here yet. Browse the category to see all works.');
  let out='<table>\n';
  for(let i=0;i<cases.length;i+=columns) {
    out+='<tr>\n';
    for(const c of cases.slice(i,i+columns)) {
      const detail=`${prefix}cases/${c.id}${en?'.en':''}.md`;
      const watch=watchUrl(c,en);
      out+=`<td width="${Math.floor(100/columns)}%" valign="top"><a href="${watch}"><img src="${prefix}${c.cover.path}" width="400" alt="${html(title(c,en))}"><br><strong>${html(title(c,en))}</strong><br><small>${c.webPlayback?choose(en,'点击封面播放','Click cover to play'):choose(en,'点击封面前往 X 原帖','Click cover to open X')}</small></a><br><sub>${html(category(c,en))} · ${duration(c)} · ${choose(en,'收藏','Bookmarks')} ${number(c.metrics.bookmarks)}${isDiscovery(c)?' · '+choose(en,'待审看','Review pending'):''} · <a href="${c.author.url}">@${html(c.author.handle)}</a></sub><br><a href="${watch}">${c.webPlayback?choose(en,'▶ 打开画廊播放','▶ Open gallery to play'):choose(en,'▶ 在 X 原帖观看','▶ Watch on X')}</a> · <a href="${detail}">${choose(en,'案例详情与来源','Case details & sources')}</a> · <a href="${c.source.url}">${choose(en,'作者原帖','Original post')}</a></td>\n`;
    }
    out+='</tr>\n';
  }
  return out+'</table>';
}
function renderBrowse(cases,definition,en) {
  const [zh,english]=definition;
  return `[← ${choose(en,'全部分类','All categories')}](../README${en?'.en':''}.md#browse)\n\n`+
    `# ${en?english:displayZh(zh)}\n\n${cases.length} ${choose(en,'个作品。点击封面播放；没有画廊视频时会前往 X 原帖。','works. Click a cover to play; works without gallery video open on X.')}\n\n`+
    renderCards([...cases].sort(compareCases),en,'../')+'\n';
}
function renderReadme(cases,en) {
  const originals=cases.filter(c=>c.prompt.status==='original');
  const discoveries=cases.filter(isDiscovery);
  const catalogued=cases.length-discoveries.length;
  const playable=cases.filter(c=>c.webPlayback).length;
  const selected=cases.filter(c=>isFeatured(c) && !c.review?.later).sort((a,b)=>reviewRank(b)-reviewRank(a) || (FEATURED.includes(a.id)?FEATURED.indexOf(a.id):FEATURED.length)-(FEATURED.includes(b.id)?FEATURED.indexOf(b.id):FEATURED.length) || compareCases(a,b)).slice(0,6);
  let out=`# Awesome AI Motion\n\n`+
    `**${choose(en,'发现喜欢的 AI 视频与动画。','Find AI videos and animations you love.')}**\n\n`+
    `${choose(en,'打开在线画廊，按类别看视频、认识作者、查看公开提示词。包含 Claude 代码动效与作者公开的 AI 制作案例。','Open the gallery to watch by category, meet the creators and explore public prompts. Discover Claude code animation and creator-documented AI workflows.')}\n\n`+
    `**[▶ ${choose(en,'打开在线画廊','Open the gallery')}](${SITE}${en?'?lang=en':''})**\n\n`+
    `${choose(en,'由 [观默 / @guanmo_ai](https://x.com/guanmo_ai) 发起与维护。在 X 关注我的 AI 视频、动效与创作实践。','Created and maintained by [Guanmo / @guanmo_ai](https://x.com/guanmo_ai). Follow my AI video, motion and creative experiments on X.')}\n\n`+
    `[简体中文](README.md) · [English](README.en.md) · [${choose(en,'本地画廊','Local gallery')}](#local-gallery) · [${choose(en,'提交作品','Submit a case')}](${REPO}/issues/new?template=submit.yml)\n\n`+
    `${cases.length} ${choose(en,'个视频参考','video references')} · ${originals.length} ${choose(en,'份作者公开提示词','creator prompts')} · ${choose(en,'中英双语','Chinese & English')}\n\n`+
    `<a id="browse"></a>\n\n`+
    CATEGORIES.filter(([zh])=>cases.some(c=>c.category===zh)).map(([zh,english,slug])=>`[${en?english:displayZh(zh)}](#category-${slug})`).join(' · ')+`\n\n`+
    `## ${choose(en,'收藏最多','Most bookmarked')}\n\n`+
    renderCards(introCases(cases),en,'',3)+`\n\n`+
    `<a id="featured"></a>\n\n<details>\n<summary>${choose(en,'策展人标记的作品','Curator selections')}</summary>\n\n`+
    renderCards(selected,en,'',3)+`\n\n</details>\n\n`;
  for(const [zh,english,slug] of CATEGORIES) {
    const group=cases.filter(c=>c.category===zh);if(!group.length)continue;
    out+=`<a id="category-${slug}"></a>\n\n## ${en?english:displayZh(zh)}\n\n`+
      renderCards(recommendedCases(cases,zh,3,'bookmarks'),en,'',3)+`\n\n[${choose(en,`查看全部 ${group.length} 支 →`,`Explore all ${group.length} works →`)}](browse/${slug}${en?'.en':''}.md)\n\n`;
  }
  out+=`${choose(en,'首页及分类预览按收藏快照从多到少排列，非实时榜单；收藏数不代表完整质量审核。','Homepage and category previews rank by bookmark snapshots, not live counts or a completed quality review.')}\n\n`+
    `${catalogued} ${choose(en,'条来源资料已编目','catalogued records')} · ${discoveries.length ? `[${discoveries.length} ${choose(en,'条发现池待审看','discovery records awaiting review')}](browse/discoveries${en?'.en':''}.md)` : choose(en,'0 条发现池待审看','0 discovery records awaiting review')} · ${playable} ${choose(en,'个原帖媒体入口','original video sources')}\n\n`+
    `[${choose(en,'核验范围与统计','Verification scope and coverage')}](docs/COVERAGE.md) · [${choose(en,'项目验收标准','Project acceptance criteria')}](docs/QUALITY.md)\n\n`+
    `${choose(en,'点击封面打开画廊播放；没有画廊视频时会前往作者 X 原帖。案例详情保留来源与提示词。','Click a cover to play in the gallery; works without gallery video open on the creator’s X post. Case pages retain sources and prompts.')}\n\n`+
    `<details>\n<summary>${choose(en,'关于作品、提示词与来源','About the works, prompts and sources')}</summary>\n\n`+
    `${choose(en,'作者原帖、完整公开指令、译文与所需素材均保留在作品详情。仅有任务转述的作品会单独标注，仍列在对应分类。公开提示词不保证相同结果，作品尚未逐条独立复现。','Work pages retain original posts, public prompts, translations and required assets. Author briefs are labeled and remain in their relevant categories. Public prompts do not guarantee identical results; works have not been independently reproduced.')}\n\n`+
    `${choose(en,'画廊播放器引用原帖媒体，失效时提供作者原帖入口。参考仓库仅用于发现作品，来源链接不代表转载许可。','The gallery player references original media and provides a creator-post fallback. Reference repositories are for discovery only. A source link does not grant redistribution permission.')}\n\n`+
    `[${choose(en,'来源与排序','Sources and ordering')}](docs/SOURCES.md) · [${choose(en,'第三方内容说明','Third-party content')}](THIRD_PARTY.md)\n\n</details>\n\n`+
    `<a id="local-gallery"></a>\n\n## ${choose(en,'在本机打开可筛选画廊','Run the filterable gallery locally')}\n\n`+
    `${choose(en,'下载仓库后，在目录中运行以下命令，再打开 http://127.0.0.1:4178 。支持搜索、筛选和页内播放器，无需模型 API 或依赖安装。','Download the repository, run the command below from its directory, then open http://127.0.0.1:4178 . Search, filter and watch inline without model APIs or dependency installation.')}\n\n`+
    '```sh\nnode scripts/serve.mjs\n```\n\n'+
    `[${choose(en,'投稿指南','Contributing')}](CONTRIBUTING.md) · [${choose(en,'纠错或移除','Correction or removal')}](${REPO}/issues/new?template=correction.yml) · [${choose(en,'维护指南','Maintainer guide')}](docs/MAINTAINING.md) · [${choose(en,'静态发布','Static hosting')}](docs/DEPLOYMENT.md)\n\n`+
    `${choose(en,'感谢创作者公开作品与制作过程。发现与展示参考','Thanks to the creators sharing their work and process. Discovery and presentation references include')} [opus-video-prompts](https://github.com/joeseesun/opus-video-prompts)、[Awesome Claude Video](https://github.com/opusvideo/awesome-claude-video)、[YouMind](https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts)。\n\n`+
    `<sub>${choose(en,'策展','Curated by')} [观默 / @guanmo_ai](https://x.com/guanmo_ai) · [MIT](LICENSE) ${choose(en,'仅适用于原创脚本','for original scripts only')}</sub>\n`;
  return out;
}
export function buildOutputs(catalog) {
  const cases=sortedCases(catalog.cases);const outputs=new Map();
  outputs.set('README.md',renderReadme(cases,false));outputs.set('README.en.md',renderReadme(cases,true));
  for(const definition of CATEGORIES) for(const en of [false,true]) {
    const group=cases.filter(c=>c.category===definition[0]);
    if(group.length)outputs.set(`browse/${definition[2]}${en?'.en':''}.md`,renderBrowse(group,definition,en));
  }
  for(const en of [false,true]) {
    const discoveries=cases.filter(isDiscovery);
    if(discoveries.length)outputs.set(`browse/discoveries${en?'.en':''}.md`,`[← ${choose(en,'全部分类','All categories')}](../README${en?'.en':''}.md#browse)\n\n# ${choose(en,'发现池','Discovery pool')}\n\n${discoveries.length} ${choose(en,'条来源已核对、尚待完整审看的作品。此列表不等于精选或已获采用。','source-verified works awaiting full viewing review. This is not an editorial recommendation or acceptance list.')}\n\n`+renderCards(discoveries,en,'../')+'\n');
  }
  for(const c of cases) {
    for(const en of [false,true]) {
      let doc=`[← ${choose(en,'返回图库','Back to gallery')}](../browse/${CATEGORIES.find(x=>x[0]===c.category)[2]}${en?'.en':''}.md) · [${en?'简体中文':'English'}](${c.id}${en?'':'.en'}.md)\n\n`+renderCase(c,{en,prefix:'../',detail:true});
      doc+=`\n## ${choose(en,'来源记录','Source record')}\n\n`+
        `- ${choose(en,'作品原帖','Original post')}: [@${md(c.author.handle)}](${c.source.url}) · ${md(c.source.publishedAt)}\n`+
        `- ${choose(en,'模型归因','Model attribution')}: ${c.model.name} · [${choose(en,'作者说明','Creator’s statement')}](${c.model.evidenceUrl})\n`+
        `- ${c.prompt.status==='unknown'?choose(en,'提示词查阅记录','Prompt lookup'):choose(en,'提示词出处','Prompt source')}: [${choose(en,'作者原帖','Creator post')}](${c.prompt.sourceUrl}) · ${utc(c.prompt.checkedAt)}\n`+
        `- ${choose(en,'封面来源','Cover source')}: [${choose(en,'原帖封面来源','Original cover source')}](${c.cover.sourceUrl.includes('video.twimg.com')?c.source.url:c.cover.sourceUrl})${c.cover.timeSeconds!=null?` · ${c.cover.timeSeconds}s`:''}\n`+
        `- ${choose(en,'互动数据','Metrics')}: [X](${c.metrics.sourceUrl}) · ${utc(c.metrics.checkedAt)} · ${choose(en,'第三方匿名读取，非 X 官方 API','Anonymous third-party snapshot, not the official X API')}\n`+
        `- ${choose(en,'发现入口','Discovered via')}: ${c.discoveredVia?.startsWith('https://')?`[${choose(en,'资料页','Reference')}](${c.discoveredVia})`:md(c.discoveredVia||'Public search')}\n`;
      if(c.webPlayback)doc+=`- ${choose(en,'画廊原视频','Gallery video source')}: [${choose(en,'原帖媒体记录','Original post media record')}](${c.source.url}) · ${utc(c.webPlayback.checkedAt)} · ${choose(en,'已核对原帖媒体对应与媒体响应；外部引用，不重新上传','Post/media correspondence and media response checked; external reference, no re-upload')}\n`;
      doc+=`\n${choose(en,'模型依据来自作者自述，未独立重跑提示词，也未对音画作统一质量评级。视频引用作者原帖媒体，未由本站重新上传，转载许可未确认。','Model attribution is based on creator statements. Prompts have not been independently rerun; sound and visuals have not received a uniform quality rating. Videos reference original post media, not our uploads; redistribution permission has not been verified.')}\n`;
      if(c.media.videoCount>1)doc+=`\n${choose(en,`原帖包含 ${c.media.videoCount} 个视频，本封面对应第一条。`,`The post contains ${c.media.videoCount} videos; this cover shows the first.`)}\n`;
      outputs.set(`cases/${c.id}${en?'.en':''}.md`,doc);
    }
    if(c.prompt.status!=='unknown')if(c.prompt.display!=='source_link')outputs.set(`prompts/${c.id}.txt`,c.prompt.text+'\n');
  }
  return outputs;
}
export function validateCatalog(catalog,root=ROOT) {
  const errors=[];const seen=new Set();
  if(catalog.repository!==REPOSITORY)errors.push('目标仓库配置不一致');
  if(!Array.isArray(catalog.cases))return ['案例数据必须是数组'];
  for(const c of catalog.cases) {
    const fail=message=>errors.push(`${c.id}: ${message}`);
    if(c.stage!==undefined&&!['catalogued','discovery'].includes(c.stage))fail('编目阶段无效');
    if(isDiscovery(c)&&(!c.verification?.authorClaimConfirmed||c.verification?.fullReview!==false||!c.webPlayback))fail('发现池需核对原作者声明和媒体，并标明待审看');
    if(c.review!==undefined&&!validReview(c.review))fail('策展评价无效');
    if(seen.has(c.id))fail('重复作品 ID');seen.add(c.id);
    if(!/^\d+$/.test(c.id))fail('作品 ID 无效');
    if(!CATEGORY_ORDER.includes(c.category))fail('用途分类无效');
    if(!c.title||!c.titleEn||!c.summary||!c.summaryEn)fail('缺少编目标题或说明');
    if(c.guide!==undefined) {
      const guide=c.guide;
      const shortText=value=>typeof value==='string'&&value.trim().length>0&&value.length<=800;
      const steps=value=>Array.isArray(value)&&value.length===3&&value.every(shortText);
      const evidence=value=>{try{const url=new URL(value);return typeof value==='string'&&url.protocol==='https:'&&!url.username&&!url.password&&url.href===value&&!/[()\[\]<>\s]/.test(value);}catch{return false;}};
      if(!guide||typeof guide!=='object'||Array.isArray(guide)||!shortText(guide.takeawayZh)||!shortText(guide.takeawayEn)||!steps(guide.stepsZh)||!steps(guide.stepsEn)||!Array.isArray(guide.tools)||guide.tools.length>12||!guide.tools.every(shortText)||!Array.isArray(guide.evidenceUrls)||guide.evidenceUrls.length<1||guide.evidenceUrls.length>8||!guide.evidenceUrls.every(evidence))fail('制作导览需要双语启发、三步编辑建议、工具列表和安全来源链接');
    }
    const work=c.source?.url?.match(/^https:\/\/x\.com\/([\w]+)\/status\/(\d+)$/);
    if(!work||work[2]!==c.id||work[1].toLowerCase()!==c.author?.handle?.toLowerCase())fail('作品来源与作者不一致');
    const prompt=c.prompt?.sourceUrl?.match(/^https:\/\/x\.com\/([\w]+)\/status\/(\d+)$/);
    if(!prompt||prompt[1].toLowerCase()!==c.author?.handle?.toLowerCase())fail('提示词作者不一致');
    if(!c.model?.name?.trim()||!c.model?.evidenceUrl||!c.model?.evidenceQuote?.trim()||(!isDiscovery(c)&&!/opus\s*5\.5/i.test(c.model.evidenceQuote||'')))fail('模型依据缺失');
    if(!['original','brief','unknown'].includes(c.prompt?.status)||(c.prompt.status!=='unknown'&&(c.prompt?.display!=='source_link'&&!c.prompt?.text?.trim()))||(c.prompt.status==='unknown'&&c.prompt.text))fail('提示词状态或内容缺失');
    for(const key of ['bookmarks','likes','views']) {
      const value=c.metrics?.[key];if(value!==null&&(!Number.isSafeInteger(value)||value<0))fail(`${key} 不是非负整数或 null`);
    }
    for(const date of [c.metrics?.checkedAt,c.prompt?.checkedAt,c.verification?.sourceReadAt])if(!date||Number.isNaN(Date.parse(date)))fail('核对时间缺失');
    if(!c.metrics?.sourceUrl?.startsWith('https://x.com/'))fail('互动快照来源缺失');
    const cover=c.cover?.path;
    if(!/^assets\/covers\/\d+\.jpg$/.test(cover||'')||!fs.existsSync(path.join(root,cover)))fail('封面缺失');
    else if(fs.statSync(path.join(root,cover)).size>250_000)fail('封面超过 250 KB');
    if(!c.cover?.sourceUrl?.startsWith('https://'))fail('封面来源缺失');
    if(c.demoUrl!==undefined) {
      let demo;
      try {demo=new URL(c.demoUrl);} catch {}
      if(typeof c.demoUrl!=='string'||!demo||demo.protocol!=='https:'||demo.username||demo.password||demo.href!==c.demoUrl||/[()\[\]<>\s]/.test(c.demoUrl))fail('交互体验地址无效');
    }
    if(!c.verification?.videoAttachmentConfirmed)fail('视频附件未经核对');
    if(c.playback!==undefined)fail('播放来源必须使用作者原帖媒体，不接受参考仓库附件');
    if(c.webPlayback) {
      const v=c.webPlayback;
      let url;
      try {url=new URL(v.url);} catch {}
      if(v.kind!=='external_source_video'||!url||url.protocol!=='https:'||url.hostname!=='video.twimg.com'||url.username||url.password||!url.pathname.endsWith('.mp4')||[...url.searchParams.keys()].some(key=>key!=='tag'))fail('画廊原媒体地址无效');
      if(v.sourcePostUrl!==c.source.url)fail('画廊媒体与原帖记录不一致');
      if(v.contentType!=='video/mp4'||!v.checkedAt||Number.isNaN(Date.parse(v.checkedAt))||!v.verificationLevel)fail('画廊媒体核对记录缺失');
      if(v.reuploadPermission!=='not_verified')fail('画廊媒体只支持外部引用');
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
