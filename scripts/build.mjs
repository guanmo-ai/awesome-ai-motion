import fs from 'node:fs';
import {publicCatalogIssues} from './catalog-privacy.mjs';
import {coverPath,safeUrl,introCases,isFeatured,FEATURED,reviewRank,reviewLabels,validReview,stateUrl,resourceLinks,resourceLabel,formatDuration} from '../assets/gallery-model.mjs';
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

// README ranking is separate from gallery sorting and does not change editorial review.
const README_EXCLUDED_IDS=new Set(['2102786378282987591']); // Clearwater: replaced at the curator's request.
export const README_RECENCY_DAYS=14;
export function spotlightCases(items,limit=6) {
  const stamp=item=>Date.parse(item.source?.publishedAt)||0;
  const count=item=>Number.isFinite(item.metrics?.bookmarks)&&item.metrics.bookmarks>=0?item.metrics.bookmarks:null;
  const candidates=items.filter(item=>!README_EXCLUDED_IDS.has(item.id) && !item.review?.later && item.review?.featured!==false && coverPath(item.cover?.path) && safeUrl(item.source?.url));
  const latest=Math.max(0,...candidates.map(stamp));
  const score=item=>Math.log2(1+count(item))-(latest-stamp(item))/(86_400_000*README_RECENCY_DAYS);
  return candidates.sort((a,b)=>
    Number(count(a)===null)-Number(count(b)===null) || score(b)-score(a) ||
    count(b)-count(a) || stamp(b)-stamp(a) || a.id.localeCompare(b.id)
  ).slice(0,limit);
}
export function catalogStats(items) {
  return {works:items.length,prompts:items.filter(c=>c.prompt?.status==='original').length,code:items.filter(c=>resourceLinks(c).some(r=>r.kind==='code')).length};
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
const CATEGORY_NOTES={
  product:['把产品、功能与品牌讲清楚','Product stories, interfaces and brand launches'],
  education:['把抽象概念变成看得懂的画面','Visual explanations of complex ideas'],
  motion:['观察节奏、字排、形变与转场','Timing, typography, morphs and transitions'],
  characters:['探索角色表演、像素与风格','Character performance, pixel art and style'],
  interactive:['走进可响应的空间与物理世界','Responsive spaces and physical simulations'],
  stories:['从分镜、镜头到完整叙事','Storyboards, cinematography and complete films'],
  music:['让音乐、画面与情绪同步','Music, visuals and emotion in sync'],
};
const README_MOSAIC_COUNT=160;
const README_MOSAIC_COLUMNS=16;
function renderMosaic(items,en) {
  const rows=[];
  for(let i=0;i<items.length;i+=README_MOSAIC_COLUMNS) {
    const group=items.slice(i,i+README_MOSAIC_COLUMNS);
    rows.push(group.map(c=>`<a href="${watchUrl(c,en)}"><img src="${readmeCoverPath(c)}" width="${99.8/README_MOSAIC_COLUMNS}%" align="top" alt="${html(title(c,en))} · @${html(c.author.handle)}"></a>`).join(''));
  }
  return `<p align="center">\n${rows.join('<br>\n')}\n</p>`;
}
function renderSpotlights(rows,en) {
  // GitHub strips <wbr>; zero-width spaces let long labels wrap on narrow screens.
  const label=value=>html(value).replace(/([A-Za-z0-9_]{6})(?=[A-Za-z0-9_])/g,'$1&#8203;');
  let out='<table>\n';
  for(let i=0;i<rows.length;i+=3) {
    const group=rows.slice(i,i+3);
    out+='<tr>\n';
    for(const item of group) {
      out+=`<td width="33%" align="center" valign="middle"><a href="${watchUrl(item,en)}"><img src="${readmeCoverPath(item)}" width="260" alt="${html(title(item,en))}"></a></td>\n`;
    }
    out+='</tr>\n<tr>\n';
    for(const item of group) {
      const links=[`<a href="${watchUrl(item,en)}">${cWatchLabel(item,en)}</a>`,`<a href="${html(item.source.url)}">${choose(en,'原帖','Original')}</a>`];
      const published=Number.isFinite(Date.parse(item.source.publishedAt))?new Date(item.source.publishedAt).toISOString().slice(0,10):'—';
      out+=`<td width="33%" valign="top"><strong>${label(title(item,en))}</strong><br><sub><a href="${html(item.author.url)}">@${label(item.author.handle)}</a></sub><br><sub>${choose(en,'收藏','Bookmarks')} ${number(item.metrics.bookmarks)} · ${published}</sub><br><br>${links.join(' · ')}</td>\n`;
    }
    out+='</tr>\n';
  }
  return out+'</table>';
}
function cWatchLabel(item,en) {
  return item.webPlayback?choose(en,'观看 ↗','Watch ↗'):choose(en,'在 X 观看 ↗','Watch on X ↗');
}
function renderReadme(cases,en) {
  const stats=catalogStats(cases),mosaic=spotlightCases(cases,README_MOSAIC_COUNT),spotlights=mosaic.slice(0,6);
  const selected=cases.filter(c=>isFeatured(c) && !c.review?.later).sort((a,b)=>reviewRank(b)-reviewRank(a) || (FEATURED.includes(a.id)?FEATURED.indexOf(a.id):FEATURED.length)-(FEATURED.includes(b.id)?FEATURED.indexOf(b.id):FEATURED.length) || compareCases(a,b)).slice(0,6);
  const gallery=SITE+(en?'?lang=en':'');
  let out=`# Awesome AI Motion\n\n`+
    (mosaic.length?`<a id="mosaic"></a>\n\n${renderMosaic(mosaic,en)}\n\n`:'')+
    `${choose(en,'发现惊艳动效，探索更多创作可能。','Extraordinary motion. New creative possibilities.')} · [${en?'简体中文':'English'}](README${en?'':'.en'}.md)\n\n`+
    `**[${choose(en,'进入作品画廊 ↗','Explore the gallery ↗')}](${gallery})** &nbsp; · &nbsp; [${choose(en,'推荐作品','Submit a work')}](${REPO}/issues/new?template=submit.yml)\n\n`+
    `<sub>${stats.works} ${choose(en,'个作品','works')} &nbsp; · &nbsp; ${choose(en,'点击拼图中的任意作品观看','Click any work in the mosaic to watch')}</sub>\n\n`;
  if(spotlights.length)out+=`<a id="spotlights"></a>\n\n## ${choose(en,'最近值得一看','Worth watching now')}\n\n`+
    `${choose(en,'综合收藏数与发布时间排序，让高收藏的新作品优先。收藏数为原帖快照。','Ranked by bookmarks and publication date, giving popular recent work more weight. Bookmark counts are source-post snapshots.')}\n\n`+
    renderSpotlights(spotlights,en)+'\n\n';
  out+=`<a id="browse"></a>\n\n## ${choose(en,'为下一次创作找参考','Find a direction for your next project')}\n\n`+
    `| ${choose(en,'方向','Explore')} | ${choose(en,'可以发现什么','What you will find')} | ${choose(en,'作品','Works')} |\n| :-- | :-- | --: |\n`+
    CATEGORIES.filter(([zh])=>cases.some(c=>c.category===zh)).map(([zh,english,slug])=>{
      const count=cases.filter(c=>c.category===zh).length;
      return `| <a id="category-${slug}"></a>[${en?english:displayZh(zh)}](browse/${slug}${en?'.en':''}.md) | ${CATEGORY_NOTES[slug][en?1:0]} | ${count} |`;
    }).join('\n')+'\n\n'+
    `[${choose(en,'在画廊中搜索、筛选和播放全部作品 →','Search, filter and watch all works in the gallery →')}](${gallery})\n\n`;
  out+=
    `<a id="more"></a>\n\n## ${choose(en,'继续发现','Keep exploring')}\n\n`+
    `<details>\n<summary>${choose(en,'收藏最多的作品','Most-bookmarked works')}</summary>\n\n## ${choose(en,'收藏最多','Most bookmarked')}\n\n`+
    renderCards(introCases(cases),en)+`\n\n<sub>${choose(en,'收藏数字为原帖快照，并非实时榜单。','Bookmark counts are source-post snapshots, not a live ranking.')}</sub>\n\n</details>\n\n`+
    `<a id="featured"></a>\n\n<details>\n<summary>${choose(en,'策展人标记的作品','Curator selections')}</summary>\n\n`+
    renderCards(selected,en)+`\n\n</details>\n\n`+
    `<a id="about"></a>\n\n<details>\n<summary>${choose(en,'关于收录与来源','About the collection and its sources')}</summary>\n\n`+
    `${choose(en,'汇集由 AI 编写代码绘制、渲染或驱动的动效与交互作品，包括 Blender、Three.js、Canvas 等工具制作的动画，整理作者公开的源码、提示词和制作资料。具体范围见[收录标准](docs/DISCOVERY.md#收录范围)；精选与完整视听评价分别记录。','A collection of motion and interactive work drawn, rendered or driven by AI-written code, including animation made with Blender, Three.js and Canvas, with creators’ public code, prompts and process notes. See the [collection scope](docs/DISCOVERY.md#收录范围); selections and full audiovisual reviews are recorded independently.')}\n\n`+
    `${choose(en,'点击封面打开画廊播放；没有画廊视频时会前往作者 X 原帖。公开提示词不保证相同结果，作品尚未逐条独立复现。','Click a cover to play in the gallery; works without gallery video open on the creator’s X post. Public prompts do not guarantee identical results, and works have not been independently reproduced.')}\n\n`+
    `[${choose(en,'来源与排序','Sources and ordering')}](docs/SOURCES.md) · [${choose(en,'核验范围与统计','Verification scope and coverage')}](docs/COVERAGE.md) · [${choose(en,'收录说明','Collection criteria')}](docs/QUALITY.md)${cases.some(isDiscovery)?` · [${choose(en,'资料待完善的作品','Records with details pending')}](browse/discoveries${en?'.en':''}.md)`:''}\n\n</details>\n\n`+
    `<a id="local-gallery"></a>\n\n<details>\n<summary>${choose(en,'在本机运行画廊','Run the gallery locally')}</summary>\n\n`+
    `${choose(en,'克隆仓库，在目录中运行（Node.js 22+，无需安装依赖）：','Clone the repository and run from its directory (Node.js 22+, no dependencies to install):')}\n\n`+
    '```sh\nnode scripts/serve.mjs\n```\n\n'+
    `${choose(en,'打开 http://127.0.0.1:4178 。','Open http://127.0.0.1:4178 .')}\n\n`+
    `[${choose(en,'维护指南','Maintainer guide')}](docs/MAINTAINING.md) · [${choose(en,'静态发布','Static hosting')}](docs/DEPLOYMENT.md)\n\n</details>\n\n`+
    `---\n\n${choose(en,'由 [观默 / @guanmo_ai](https://x.com/guanmo_ai) 发起与维护。感谢公开作品与创作过程的每一位作者。','Created and maintained by [Guanmo / @guanmo_ai](https://x.com/guanmo_ai). Thank you to every creator sharing their work and process.')}\n\n`+
    `[${choose(en,'参与贡献','Contribute')}](CONTRIBUTING.md) · [${choose(en,'纠错或移除','Correction or removal')}](${REPO}/issues/new?template=correction.yml) · [${choose(en,'第三方内容说明','Third-party content')}](THIRD_PARTY.md) · [MIT](LICENSE)\n\n`+
    `<sub>${choose(en,'MIT 仅适用于本仓库原创脚本；第三方作品、素材与提示词的权利归原作者所有。','MIT applies to this repository’s original scripts. Third-party works, assets and prompts remain the property of their creators.')}</sub>\n`;
  return out;
}
function renderCoverage(cases) {
  const count=test=>cases.filter(test).length;
  const original=count(c=>c.prompt.status==='original');
  const sourceOnly=count(c=>c.prompt.status==='original'&&c.prompt.display==='source_link');
  const reviewed=count(c=>c.verification.fullReview===true);
  return `# 覆盖范围与核验状态\n\n以下数字由生成器从当前仓库的 \`data/cases.json\` 统计；作品跨帖子出现或仅有制作说明的回复不重复计数。\`discovery\` 表示来源已核对、编目资料待完善，\`catalogued\` 表示资料已整理。\n\n`+
    `| 项目 | 数量 | 含义 |\n| --- | ---: | --- |\n`+
    `| 公开案例 | ${cases.length} | 均有原作者 X（Twitter）帖子链接。 |\n`+
    `| 原帖媒体入口 | ${count(c=>Boolean(c.webPlayback))} | 已记录与原帖对应的外部视频；地址是否持续可用需重新检查。 |\n`+
    `| 已编目 | ${count(c=>!isDiscovery(c))} | 来源资料已整理；精选另行标记。 |\n`+
    `| 发现池 | ${count(isDiscovery)} | 来源已核对，编目资料待完善。 |\n`+
    `| 公开提示词 | ${original} | 作者公开了指令；其中 ${sourceOnly} 条仅链接原文，其余按核得原文展示。不保证完整对话已公开。 |\n`+
    `| 任务描述 | ${count(c=>c.prompt.status==='brief')} | 记录作者对制作任务的转述，不作为逐字指令。 |\n`+
    `| 未取得提示词 | ${count(c=>c.prompt.status==='unknown')} | 没有可核对的原始指令。 |\n\n`+
    `上述三种提示词状态合计 ${cases.length} 条。完整视听评价是可选记录，不影响收录；当前数据有 ${reviewed} 个作品标为已完成这项评价。精选属于编辑选择，不代表获得转载许可。收藏等互动数字是带采集时间的快照，不代表实时表现。具体来源与收录规则见[来源与排序](SOURCES.md)、[发现与核验](DISCOVERY.md)和[收录说明](QUALITY.md)。\n`;
}
const readmeCoverPath=item=>`assets/readme-covers/${item.id}.svg`;
function renderReadmeCover(item,bytes) {
  // Self-contained SVG frames keep GitHub images at 16:9 without stretching the source.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><title>${html(item.title)} · @${html(item.author.handle)}</title><image width="320" height="180" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${bytes.toString('base64')}"/></svg>\n`;
}
export function buildOutputs(catalog,readCover=file=>fs.readFileSync(path.join(ROOT,file))) {
  const cases=sortedCases(catalog.cases);const outputs=new Map();
  for(const item of spotlightCases(cases,README_MOSAIC_COUNT))outputs.set(readmeCoverPath(item),renderReadmeCover(item,readCover(item.cover.path)));
  outputs.set('README.md',renderReadme(cases,false));outputs.set('README.en.md',renderReadme(cases,true));
  outputs.set('docs/COVERAGE.md',renderCoverage(cases));
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
        `- ${choose(en,'模型归因','Model attribution')}: ${md(c.model.name)} · [${choose(en,'作者说明','Creator’s statement')}](${c.model.evidenceUrl})\n`+
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
  const errors=publicCatalogIssues(catalog);const seen=new Set(),seenMedia=new Set();
  if(!catalog||typeof catalog!=='object'||Array.isArray(catalog))return errors;
  if(catalog.repository!==REPOSITORY)errors.push('目标仓库配置不一致');
  if(!Array.isArray(catalog.cases))return ['案例数据必须是数组'];
  for(const c of catalog.cases) {
    if(!c||typeof c!=='object'||Array.isArray(c)){errors.push('案例记录必须是对象');continue;}
    const fail=message=>errors.push(`${c.id}: ${message}`);
    if(['author','source','model','media','cover','prompt','metrics','verification'].some(key=>!c[key]||typeof c[key]!=='object'||Array.isArray(c[key]))){fail('案例必要字段必须是对象');continue;}
    const text=value=>typeof value==='string'&&value.trim().length>0;
    if(['title','titleEn','summary','summaryEn'].some(key=>!text(c[key]))||!text(c.author.name)||!text(c.author.handle))fail('编目标题、说明与作者必须为非空文本');
    if([c.author.handle,c.source.url,c.source.publishedAt,c.prompt.sourceUrl,c.model.name,c.model.evidenceUrl,c.model.evidenceQuote,c.prompt.text,c.cover.sourceUrl].some(value=>typeof value!=='string')){fail('来源、模型与提示词字段类型无效');continue;}
    if(Number.isNaN(Date.parse(c.source.publishedAt)))fail('原帖发布时间无效');
    if(c.media.durationSeconds!==null&&(!Number.isFinite(c.media.durationSeconds)||c.media.durationSeconds<=0))fail('媒体时长必须为正数或 null');
    if(!Number.isSafeInteger(c.media.videoCount)||c.media.videoCount<1)fail('视频数量必须为正整数');
    for(const key of ['videoAttachmentConfirmed','authorClaimConfirmed','promptMatchedSource','independentlyReproduced'])if(c.verification[key]!==undefined&&typeof c.verification[key]!=='boolean')fail('来源核验状态必须为布尔值');
    if(c.stage!==undefined&&!['catalogued','discovery'].includes(c.stage))fail('编目阶段无效');
    if(isDiscovery(c)&&c.verification?.authorClaimConfirmed!==true)fail('发现池需核对原作者声明');
    if(c.verification?.fullReview!==undefined&&typeof c.verification.fullReview!=='boolean')fail('可选视听评价状态无效');
    if(c.review!==undefined&&!validReview(c.review))fail('策展评价无效');
    if(seen.has(c.id))fail('重复作品 ID');seen.add(c.id);
    if(typeof c.id!=='string'||!/^\d+$/.test(c.id))fail('作品 ID 无效');
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
    if(!c.model?.name?.trim()||!c.model?.evidenceUrl||!c.model?.evidenceQuote?.trim())fail('模型依据缺失');
    const sourceOnly=c.prompt?.display==='source_link';
    if(c.prompt?.display!==undefined&&!sourceOnly)fail('提示词展示方式无效');
    if(!['original','brief','unknown'].includes(c.prompt?.status)||(c.prompt.status!=='unknown'&&!sourceOnly&&!c.prompt?.text?.trim())||(c.prompt.status==='unknown'&&c.prompt.text))fail('提示词状态或内容缺失');
    if(sourceOnly&&(c.prompt.status==='unknown'||c.prompt.text||c.prompt.translationZh))fail('仅原帖入口不能包含提示词全文或译文');
    for(const key of ['bookmarks','likes','views']) {
      const value=c.metrics?.[key];if(value!==null&&(!Number.isSafeInteger(value)||value<0))fail(`${key} 不是非负整数或 null`);
    }
    for(const date of [c.metrics?.checkedAt,c.prompt?.checkedAt,c.verification?.sourceReadAt])if(!text(date)||Number.isNaN(Date.parse(date)))fail('核对时间缺失');
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
    if(c.verification?.videoAttachmentConfirmed!==true)fail('视频附件未经核对');
    if(c.playback!==undefined)fail('播放来源必须使用作者原帖媒体，不接受参考仓库附件');
    if(c.webPlayback) {
      const v=c.webPlayback;
      let url;
      try {url=new URL(v.url);} catch {}
      if(v.kind!=='external_source_video'||!url||url.protocol!=='https:'||url.host!=='video.twimg.com'||url.username||url.password||url.hash||!url.pathname.endsWith('.mp4')||[...url.searchParams.keys()].some(key=>key!=='tag'))fail('画廊原媒体地址无效');
      if(v.sourcePostUrl!==c.source.url)fail('画廊媒体与原帖记录不一致');
      if(v.contentType!=='video/mp4'||!v.checkedAt||Number.isNaN(Date.parse(v.checkedAt))||v.verificationLevel!=='source_media_matched')fail('画廊媒体核对记录缺失');
      if(v.reuploadPermission!=='not_verified')fail('画廊媒体只支持外部引用');
      const mediaId=url?.pathname.match(/^\/(?:amplify_video|ext_tw_video)\/(\d+)\//)?.[1];
      if(mediaId){if(seenMedia.has(mediaId))fail('重复作品媒体');seenMedia.add(mediaId);}
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
  const outputs=buildOutputs(catalog);
  for(const [file,content] of outputs) {
    const target=path.join(ROOT,file);
    if(check) {if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==content){console.error(`待更新：${file}`);stale++;}}
    else {fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);}
  }
  const readmeCovers=path.join(ROOT,'assets/readme-covers');
  if(fs.existsSync(readmeCovers))for(const name of fs.readdirSync(readmeCovers).filter(name=>/^\d+\.svg$/.test(name))) {
    const file=`assets/readme-covers/${name}`;
    if(outputs.has(file))continue;
    if(check){console.error(`不应保留旧缩略图：${file}`);stale++;}
    else fs.unlinkSync(path.join(ROOT,file));
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
