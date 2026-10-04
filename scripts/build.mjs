import fs from 'node:fs';
import {publicCatalogIssues} from './catalog-privacy.mjs';
import {coverPath,safeUrl,selectCases,recommendedCases,introCases,isFeatured,FEATURED,reviewRank,reviewLabels,validReview,stateUrl,resourceLinks,resourceLabel,formatDuration} from '../assets/gallery-model.mjs';
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

// README introductions describe existing works without changing their review status.
export const README_SPOTLIGHTS = [
  {id:'2103918792845963545',zh:'角色、界面与排版，共同讲清一个产品。',en:'Character, interface and typography tell one product story.'},
  {id:'2103315922098470926',zh:'15 秒，把几何、镜头与转场连成一段。',en:'Geometry, camera and transitions in one 15-second sequence.'},
  {id:'2102786378282987591',zh:'波浪、折射与涟漪，在浏览器里实时响应。',en:'Waves, refraction and ripples respond in the browser.'},
  {id:'2103099194693271874',zh:'同一个角色，穿过十二种视觉风格。',en:'One character travels through twelve visual styles.'},
  {id:'2105304203770118434',zh:'用代码画出蜡笔质感，讲述一场温柔的告别。',en:'Code-drawn crayon textures tell a gentle story of farewell.'},
  {id:'2102583898865873225',zh:'把五千年历史，化成一笔展开的线稿。',en:'Five thousand years of history unfold in line art.'},
];
export function spotlightCases(items) {
  return README_SPOTLIGHTS.map(note=>({item:items.find(c=>c.id===note.id),note}))
    .filter(({item})=>item && !item.review?.later && item.review?.featured!==false && coverPath(item.cover?.path) && safeUrl(item.source?.url));
}
export function catalogStats(items) {
  return {works:items.length,prompts:items.filter(c=>c.prompt?.status==='original').length,code:items.filter(c=>resourceLinks(c).some(r=>r.kind==='code')).length};
}
export function sourceCases(items,limit=3) {
  return selectCases(items,{category:'all',query:'',sort:'bookmarks',resource:'code'}).filter(c=>!c.review?.later).slice(0,limit);
}

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
  if(prompt.display==='source_link'){
    const original=prompt.status==='original';
    const note=original?choose(en,'作者已公开指令；本站仅提供原帖入口，不再分发全文或译文。','The creator has shared instructions; this catalog links to the source without redistributing the full text or translation.'):choose(en,'作者任务描述 · 非完整提示词。完整指令尚未取得，请查看作者原帖。','Author brief · not the complete prompt. The complete instructions have not been verified; see the creator’s post.');
    return `${note} [${original?choose(en,'查看作者原文','Read the creator’s original'):choose(en,'查看作者原帖','View the original post')}](${prompt.sourceUrl})\n`;
  }
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
  return resourceLinks(c).map(r=>`[${md(en?r.labelEn:r.label)}](${r.url})`);
}
function renderResources(c,en) {
  const resources=resourceLinks(c);
  if(!resources.length)return '';
  let out=`## ${choose(en,'源码与网页','Source & web pages')}\n\n`;
  for(const r of resources) {
    const license=r.license==='not_specified'?choose(en,'未标明许可','No license specified'):r.license;
    out+=`- **${resourceLabel(r.kind,en?'en':'zh')}**：[${md(en?r.labelEn:r.label)}](${r.url})${license?` · ${r.licenseUrl?`[${md(license)}](${r.licenseUrl})`:md(license)}`:''}\n`;
    if(r.note)out+=`  ${md(en?r.noteEn:r.note)}\n`;
    if(r.evidenceUrl)out+=`  [${choose(en,'链接出处','Link source')}](${r.evidenceUrl}) · ${choose(en,'链接核对','Link checked')} ${utc(r.checkedAt)}\n`;
  }
  return out+'\n';
}
function renderCase(c,{en=false,prefix='',detail=false}={}) {
  let out=`<a id="case-${c.id}"></a>\n\n${detail?'#':'###'} ${md(title(c,en))}\n\n`;
  out+=`**[${md(c.author.name)} · @${md(c.author.handle)}](${c.author.url})** · ${category(c,en)} · ${duration(c)}\n\n`;
  if(isDiscovery(c))out+=`> ${choose(en,'发现池 · 来源已核对，编目资料待完善。','Discovery pool · Source verified; catalog details being completed.')}\n\n`;
  if(reviewLabels(c,en?'en':'zh').length)out+=`**${choose(en,'策展评价','Curator’s review')}：${reviewLabels(c,en?'en':'zh').join(' · ')}**\n\n`;
  const watch=watchUrl(c,en);
  out+=`**[▶ ${c.webPlayback?choose(en,'打开画廊播放','Open gallery to play'):choose(en,'在 X 原帖观看','Watch on X')}](${watch})**${c.webPlayback?` · [${choose(en,'作者原帖','Original post')}](${c.source.url})`:''}\n\n`+
    `${choose(en,c.webPlayback?'点击封面打开画廊播放。':'点击封面前往 X 原帖观看。',c.webPlayback?'Click the cover to open the gallery and play.':'Click the cover to watch on X.')}\n\n`+
    `${cover(c,prefix,640,watch)}\n\n${relatedLinks(c,en).join(' · ')}\n\n`;
  out+=`${md(en?c.summaryEn:c.summary)}\n\n`;
  out+=renderResources(c,en);
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
function renderCards(cases,en,prefix='',notes=null,showResources=false) {
  if(!cases.length)return choose(en,'此处暂无推荐，仍可进入分类浏览全部作品。','No recommendations here yet. Browse the category to see all works.');
  let out='<table>\n';
  for(let i=0;i<cases.length;i+=2) {
    const pair=cases.slice(i,i+2);
    out+='<tbody>\n<tr>\n';
    for(const c of pair) {
      const width=Math.min(400,c.cover.width,Math.round(225*c.cover.width/c.cover.height));
      out+=`<td width="50%" height="225" align="center" valign="middle"><a href="${watchUrl(c,en)}"><img src="${prefix}${c.cover.path}" width="${width}" alt="${html(title(c,en))}"></a></td>\n`;
    }
    if(pair.length===1)out+='<td width="50%"></td>\n';
    out+='</tr>\n<tr>\n';
    for(const c of pair) {
      const note=notes?.get(c.id);
      const resources=showResources?resourceLinks(c).filter(r=>['code','demo'].includes(r.kind)):[];
      const actions=resources.map(r=>`<a href="${html(r.url)}">${choose(en,r.kind==='code'?'查看源码 ↗':'作品网页 ↗',r.kind==='code'?'Source code ↗':'Work page ↗')}</a>`);
      if(showResources&&c.prompt.status==='original')actions.push(`<a href="${prefix}cases/${c.id}${en?'.en':''}.md">${choose(en,'查看提示词 ↗','View prompt ↗')}</a>`);
      out+=`<td width="50%" valign="top"><strong>${html(title(c,en))}</strong><br>`+
        (note?`<sub>${html(note[en?'en':'zh'])}</sub><br>`:'')+
        `<sub><a href="${c.author.url}">@${html(c.author.handle)}</a> · ${html(category(c,en))}</sub><br>`+
        `<sub>${formatDuration(c.media.durationSeconds)} · ${choose(en,'收藏','Bookmarks')} ${number(c.metrics.bookmarks)}${isDiscovery(c)?' · '+choose(en,'资料待完善','Details pending'):''}</sub><br>`+
        `<a href="${watchUrl(c,en)}">${c.webPlayback?choose(en,'▶ 播放','▶ Play'):choose(en,'▶ 在 X 观看','▶ Watch on X')}</a> · <a href="${c.source.url}">${choose(en,'原帖','Original post')}</a>${actions.length?'<br>'+actions.join(' · '):''}</td>\n`;
    }
    if(pair.length===1)out+='<td width="50%"></td>\n';
    out+='</tr>\n</tbody>\n';
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
  const stats=catalogStats(cases),spotlights=spotlightCases(cases);
  const discoveries=cases.filter(isDiscovery);
  const catalogued=cases.length-discoveries.length;
  const playable=cases.filter(c=>c.webPlayback).length;
  const selected=cases.filter(c=>isFeatured(c) && !c.review?.later).sort((a,b)=>reviewRank(b)-reviewRank(a) || (FEATURED.includes(a.id)?FEATURED.indexOf(a.id):FEATURED.length)-(FEATURED.includes(b.id)?FEATURED.indexOf(b.id):FEATURED.length) || compareCases(a,b)).slice(0,6);
  let out=`# Awesome AI Motion\n\n`+
    `${choose(en,'发现惊艳动效，探索背后的代码与创意。','Extraordinary motion. Ideas you can build on.')} · [${en?'简体中文':'English'}](README${en?'':'.en'}.md)\n\n`+
    `## [▶ ${choose(en,'进入作品画廊 →','Enter the gallery →')}](${SITE}${en?'?lang=en':''})\n\n`+
    `**${stats.works} ${choose(en,'个作品','works')} · ${stats.prompts} ${choose(en,'份公开提示词','public prompts')} · ${stats.code} ${choose(en,'个案例附源码','works with source code')}**\n\n`;
  if(spotlights.length)out+=`<a id="spotlights"></a>\n\n`+
    renderCards(spotlights.map(({item})=>item),en,'',new Map(spotlights.map(({item,note})=>[item.id,note])),true)+`\n\n`;
  out+=`**[${choose(en,`浏览全部 ${stats.works} 个作品 →`,`Browse all ${stats.works} works →`)}](${SITE}${en?'?lang=en':''})** · **[${choose(en,'探索源码 ↗','Explore source ↗')}](${SITE}?resource=code${en?'&lang=en':''})** · **[${choose(en,'查看提示词 ↗','Find prompts ↗')}](${SITE}?prompt=original${en?'&lang=en':''})**\n\n`+
    `${choose(en,'动效设计与创意视频的灵感和创作资源库。汇集出色的产品宣传片、3D 交互、动画短片与动态视觉作品，整理作者公开的源码、提示词和制作资料，为你的下一次创作提供起点。','An inspiration and resource collection for motion design and creative video. Explore product films, 3D interactions, animated shorts and visual experiments, with creators’ public source code, prompts and making-of material.')}\n\n`+
    `${choose(en,'由 [观默 / @guanmo_ai](https://x.com/guanmo_ai) 发起与维护 · [推荐作品]','Created and maintained by [Guanmo / @guanmo_ai](https://x.com/guanmo_ai) · [Submit a work]')}(${REPO}/issues/new?template=submit.yml)\n\n`+
    `<a id="browse"></a>\n\n`+
    CATEGORIES.filter(([zh])=>cases.some(c=>c.category===zh)).map(([zh,english,slug])=>`[${en?english:displayZh(zh)}](#category-${slug})`).join(' · ')+`\n\n`;
  const sources=sourceCases(cases,2);
  if(sources.length)out+=`<a id="source-code"></a>\n\n## ${choose(en,'喜欢这个效果？看看源码。','Love the result? Explore the source.')}\n\n`+
    `${choose(en,'这些作品附有作者公开源码，可继续查看实现、工程结构与制作方式。','These works include public source links from their creators. Explore the implementation, project structure and approach.')}\n\n`+
    renderCards(sources,en,'',null,true)+`\n\n[${choose(en,`探索全部 ${stats.code} 个源码案例 →`,`Explore all ${stats.code} works with source →`)}](${SITE}?resource=code${en?'&lang=en':''}) · [${choose(en,'源码、网页与工具索引','Source, web pages & tools index')}](browse/resources${en?'.en':''}.md)\n\n`;
  out+=`<details>\n<summary>${choose(en,'继续发现：收藏最多的作品','Keep exploring: most-bookmarked works')}</summary>\n\n## ${choose(en,'收藏最多','Most bookmarked')}\n\n`+
    renderCards(introCases(cases),en)+`\n\n</details>\n\n`+
    `<a id="featured"></a>\n\n<details>\n<summary>${choose(en,'策展人标记的作品','Curator selections')}</summary>\n\n`+
    renderCards(selected,en)+`\n\n</details>\n\n`;
  for(const [zh,english,slug] of CATEGORIES) {
    const group=cases.filter(c=>c.category===zh);if(!group.length)continue;
    out+=`<a id="category-${slug}"></a>\n\n## ${en?english:displayZh(zh)}\n\n`+
      renderCards(recommendedCases(cases,zh,2,'bookmarks'),en)+`\n\n[${choose(en,`查看全部 ${group.length} 支 →`,`Explore all ${group.length} works →`)}](browse/${slug}${en?'.en':''}.md)\n\n`;
  }
  out+=`${choose(en,'首页及分类预览中的收藏榜按快照排列，并非实时榜单；README 导览单独编排，不改变作品的精选或评价状态。','Homepage and category previews retain bookmark-snapshot sections, not live counts. README introductions are arranged separately and do not change review or featured status.')}\n\n`+
    `${catalogued} ${choose(en,'条资料已编目','catalogued records')} · ${discoveries.length ? `[${discoveries.length} ${choose(en,'条发现池资料待完善','discovery records with details pending')}](browse/discoveries${en?'.en':''}.md)` : choose(en,'0 条发现池资料待完善','0 discovery records with details pending')} · ${playable} ${choose(en,'个原帖媒体入口','original video sources')}\n\n`+
    `[${choose(en,'核验范围与统计','Verification scope and coverage')}](docs/COVERAGE.md) · [${choose(en,'收录说明','Collection criteria')}](docs/QUALITY.md)\n\n`+
    `${choose(en,'点击封面打开画廊播放；没有画廊视频时会前往作者 X 原帖。案例详情保留来源与提示词。','Click a cover to play in the gallery; works without gallery video open on the creator’s X post. Case pages retain sources and prompts.')}\n\n`+
    `<details>\n<summary>${choose(en,'关于作品、提示词与来源','About the works, prompts and sources')}</summary>\n\n`+
    `${choose(en,'作品详情保留作者原帖及已核得的指令资料；译文、素材条件和任务转述按实际资料标注。部分长篇指令仅提供作者原文入口。公开提示词不保证相同结果，作品尚未逐条独立复现。','Work pages link to the creators and verified instruction sources. Translations, asset requirements and author briefs are labeled where available; some long instructions are source links only. Public prompts do not guarantee identical results, and works have not been independently reproduced.')}\n\n`+
    `${choose(en,'画廊播放器引用原帖媒体，失效时提供作者原帖入口。参考仓库仅用于发现作品，来源链接不代表转载许可。','The gallery player references original media and provides a creator-post fallback. Reference repositories are for discovery only. A source link does not grant redistribution permission.')}\n\n`+
    `[${choose(en,'来源与排序','Sources and ordering')}](docs/SOURCES.md) · [${choose(en,'第三方内容说明','Third-party content')}](THIRD_PARTY.md)\n\n</details>\n\n`+
    `<a id="local-gallery"></a>\n\n## ${choose(en,'在本机打开可筛选画廊','Run the filterable gallery locally')}\n\n`+
    `${choose(en,'下载仓库后，在目录中运行以下命令，再打开 http://127.0.0.1:4178 。支持搜索、筛选和页内播放器，无需模型 API 或依赖安装。','Download the repository, run the command below from its directory, then open http://127.0.0.1:4178 . Search, filter and watch inline without model APIs or dependency installation.')}\n\n`+
    '```sh\nnode scripts/serve.mjs\n```\n\n'+
    `[${choose(en,'投稿指南','Contributing')}](CONTRIBUTING.md) · [${choose(en,'纠错或移除','Correction or removal')}](${REPO}/issues/new?template=correction.yml) · [${choose(en,'维护指南','Maintainer guide')}](docs/MAINTAINING.md) · [${choose(en,'静态发布','Static hosting')}](docs/DEPLOYMENT.md)\n\n`+
    `${choose(en,'感谢创作者公开作品与制作过程。','Thanks to the creators sharing their work and process.')}\n\n`+
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
    const linked=cases.filter(c=>resourceLinks(c).length);
    outputs.set(`browse/resources${en?'.en':''}.md`,(`[← ${choose(en,'返回目录','Back to catalog')}](../README${en?'.en':''}.md)\n\n# ${choose(en,'源码、网页与工具','Source, web pages & tools')}\n\n${choose(en,'本页只提供作者的源码、HTML、演示和工具链接，不收纳第三方源码。公开可读不等于获准复用；使用范围以原项目许可为准。','This index links to creators’ source, HTML, demos and tools without hosting third-party code. Public access does not grant reuse rights; consult the original license.')}\n\n${linked.length} ${choose(en,'个作品附有资源入口','works with resource links')} · [${choose(en,'筛选源码或公开网页','Filter source or web pages')}](${SITE}?page=all&resource=any${en?'&lang=en':''}) · [${choose(en,'相关工具','Related tools')}](${SITE}?page=all&resource=tool${en?'&lang=en':''})\n\n${choose(en,'公开作品网页也计入实现参考；只有网页入口时，不代表已提供完整工程或开源许可。','Public work pages also count as implementation references; a web link alone does not establish access to the complete project or an open-source license.')}\n\n`+linked.map(c=>`## [${md(title(c,en))}](../cases/${c.id}${en?'.en':''}.md) · @${md(c.author.handle)}\n\n${renderResources(c,en).replace(/^## [^\n]+\n\n/,'')}`).join('')).trimEnd()+'\n');
    const discoveries=cases.filter(isDiscovery);
    if(discoveries.length)outputs.set(`browse/discoveries${en?'.en':''}.md`,`[← ${choose(en,'全部分类','All categories')}](../README${en?'.en':''}.md#browse)\n\n# ${choose(en,'发现池','Discovery pool')}\n\n${discoveries.length} ${choose(en,'条来源已核对、编目资料待完善的作品。精选另行标记。','source-verified works with catalog details being completed. Featured works are marked separately.')}\n\n`+renderCards(discoveries,en,'../')+'\n');
  }
  for(const c of cases) {
    for(const en of [false,true]) {
      let doc=`[← ${choose(en,'返回图库','Back to gallery')}](../browse/${CATEGORIES.find(x=>x[0]===c.category)[2]}${en?'.en':''}.md) · [${en?'简体中文':'English'}](${c.id}${en?'':'.en'}.md)\n\n`+renderCase(c,{en,prefix:'../',detail:true});
      doc+=`\n## ${choose(en,'来源记录','Source record')}\n\n`+
        `- ${choose(en,'作品原帖','Original post')}: [@${md(c.author.handle)}](${c.source.url}) · ${md(c.source.publishedAt)}\n`+
        `- ${choose(en,'模型归因','Model attribution')}: ${c.model.name} · [${choose(en,'作者说明','Creator’s statement')}](${c.model.evidenceUrl})\n`+
        `- ${c.prompt.status==='unknown'?choose(en,'提示词查阅记录','Prompt lookup'):choose(en,'提示词出处','Prompt source')}: [${choose(en,'作者原帖','Creator post')}](${c.prompt.sourceUrl}) · ${utc(c.prompt.checkedAt)}\n`+
        `- ${choose(en,'封面来源','Cover source')}: [${choose(en,'原帖封面来源','Original cover source')}](${c.cover.sourceUrl.includes('video.twimg.com')?c.source.url:c.cover.sourceUrl})${c.cover.timeSeconds!=null?` · ${c.cover.timeSeconds}s`:''}\n`+
        `- ${choose(en,'互动快照','Metrics snapshot')}: [${choose(en,'X 原帖','Original X post')}](${c.source.url}) · ${utc(c.metrics.checkedAt)}\n`;
      if(c.webPlayback)doc+=`- ${choose(en,'画廊原视频','Gallery video source')}: [${choose(en,'原帖媒体记录','Original post media record')}](${c.source.url}) · ${utc(c.webPlayback.checkedAt)} · ${choose(en,'已核对原帖媒体对应与媒体响应；外部引用，不重新上传','Post/media correspondence and media response checked; external reference, no re-upload')}\n`;
      doc+=`\n${choose(en,'模型依据来自作者自述，未独立重跑提示词，也未对音画作统一质量评级。视频引用作者原帖媒体，未由本站重新上传，转载许可未确认。','Model attribution is based on creator statements. Prompts have not been independently rerun; sound and visuals have not received a uniform quality rating. Videos reference original post media, not our uploads; redistribution permission has not been verified.')}\n`;
      if(c.media.videoCount>1)doc+=`\n${choose(en,`原帖包含 ${c.media.videoCount} 个视频，本封面对应第一条。`,`The post contains ${c.media.videoCount} videos; this cover shows the first.`)}\n`;
      outputs.set(`cases/${c.id}${en?'.en':''}.md`,doc);
    }
    if(c.prompt.status!=='unknown'&&c.prompt.display!=='source_link')outputs.set(`prompts/${c.id}.txt`,c.prompt.text+'\n');
  }
  return outputs;
}
export function validateCatalog(catalog,root=ROOT) {
  const errors=publicCatalogIssues(catalog);const seen=new Set();
  if(catalog.repository!==REPOSITORY)errors.push('目标仓库配置不一致');
  if(!Array.isArray(catalog.cases))return ['案例数据必须是数组'];
  for(const c of catalog.cases) {
    const fail=message=>errors.push(`${c.id}: ${message}`);
    if(c.stage!==undefined&&!['catalogued','discovery'].includes(c.stage))fail('编目阶段无效');
    if(isDiscovery(c)&&!c.verification?.authorClaimConfirmed)fail('发现池需核对原作者声明');
    if(c.verification?.fullReview!==undefined&&typeof c.verification.fullReview!=='boolean')fail('可选视听评价状态无效');
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
    const sourceOnly=c.prompt?.display==='source_link';
    if(c.prompt?.display!==undefined&&!sourceOnly)fail('提示词展示方式无效');
    if(!['original','brief','unknown'].includes(c.prompt?.status)||(c.prompt.status!=='unknown'&&!sourceOnly&&!c.prompt?.text?.trim())||(c.prompt.status==='unknown'&&c.prompt.text))fail('提示词状态或内容缺失');
    if(sourceOnly&&(c.prompt.status==='unknown'||c.prompt.text||c.prompt.translationZh))fail('仅原帖入口不能包含提示词全文或译文');
    for(const key of ['bookmarks','likes','views']) {
      const value=c.metrics?.[key];if(value!==null&&(!Number.isSafeInteger(value)||value<0))fail(`${key} 不是非负整数或 null`);
    }
    for(const date of [c.metrics?.checkedAt,c.prompt?.checkedAt,c.verification?.sourceReadAt])if(!date||Number.isNaN(Date.parse(date)))fail('核对时间缺失');
    if(c.metrics?.sourceUrl!==c.source?.url)fail('互动快照来源必须为对应作者原帖');
    const cover=c.cover?.path;
    if(!/^assets\/covers\/\d+\.jpg$/.test(cover||'')||!fs.existsSync(path.join(root,cover)))fail('封面缺失');
    else if(fs.statSync(path.join(root,cover)).size>250_000)fail('封面超过 250 KB');
    if(!c.cover?.sourceUrl?.startsWith('https://'))fail('封面来源缺失');
    const resourceUrl=value=>{try{const u=new URL(value);return typeof value==='string'&&u.protocol==='https:'&&!u.username&&!u.password&&u.href===value&&!/[()\[\]<>\s]/.test(value);}catch{return false;}};
    if(c.resources!==undefined) {
      if(!Array.isArray(c.resources)||c.resources.length<1||c.resources.length>12)fail('源码资源列表无效');
      else {
        const seen=new Set();
        const resourceText=value=>typeof value==='string'&&value.trim().length>0&&value.length<=1000&&!/[\r\n]/.test(value);
        for(const r of c.resources) {
          if(r?.licenseUrl!==undefined&&(!resourceUrl(r.licenseUrl)||!resourceText(r.license)||r.license==='not_specified'))fail('源码资源许可证链接需要有效许可与 HTTPS 地址');
          if(!r||!['code','demo','tool'].includes(r.kind)||!resourceUrl(r.url)||!resourceUrl(r.evidenceUrl)||!resourceText(r.label)||!resourceText(r.labelEn)||typeof r.checkedAt!=='string'||Number.isNaN(Date.parse(r.checkedAt))||((r.note!==undefined||r.noteEn!==undefined)&&(!resourceText(r.note)||!resourceText(r.noteEn)))||(r.license!==undefined&&!resourceText(r.license))||(['code','tool'].includes(r.kind)&&!resourceText(r.license))||seen.has(r.url))fail('源码资源需要有效类型、双语名称、来源、核对时间和许可状态，且链接不得重复');
          if(r)seen.add(r.url);
        }
      }
    }
    if(c.codeUrl!=null&&!resourceUrl(c.codeUrl))fail('作者源码地址无效');
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
      if(v.contentType!=='video/mp4'||!v.checkedAt||Number.isNaN(Date.parse(v.checkedAt))||v.verificationLevel!=='source_media_matched')fail('画廊媒体核对记录缺失');
      if(v.reuploadPermission!=='not_verified')fail('画廊媒体只支持外部引用');
    }
    if(!['width','height'].every(key=>Number.isSafeInteger(c.cover?.[key])&&c.cover[key]>0))fail('封面尺寸无效');
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
  for(const c of catalog.cases.filter(item=>item.prompt.display==='source_link')) {
    const file=`prompts/${c.id}.txt`,target=path.join(ROOT,file);
    if(!fs.existsSync(target))continue;
    if(check){console.error(`不应保留全文文件：${file}`);stale++;}
    else fs.unlinkSync(target);
  }
  if(stale)process.exit(1);
  console.log(`${check?'校验通过':'已生成'}：${catalog.cases.length} 个案例，README、案例页与纯文本提示词。`);
}
