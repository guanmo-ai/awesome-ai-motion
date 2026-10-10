import {resourceLinks,resourceLabel,CATEGORIES,stageOf,PAGE_SIZE,pageCases,categoryOf,safeUrl,coverPath,playbackUrl,tagsOf,readState,stateUrl,selectCases,detailNeighbors,categoryCounts,formatDuration,relatedCases} from './gallery-model.mjs?v=20261010-smooth';
const $ = id => document.getElementById(id);
let state = readLocation(), cases = [], activeId = null, activeMissing = false, returnFocus = null, savedOverflow = '', savedScroll = 0;
let visibleCount=PAGE_SIZE;
let searchTimer=null;
let playbackTimer=null,playbackAbort=null;
const PLAYBACK_TIMEOUT_MS=12000;
const filterKeys=['category','query','sort','prompt','resource'];
const listKeys=['page',...filterKeys,'lang'];
const SORT_ORDER=['bookmarks','featured','latest'];
const SORT_LABELS={bookmarks:['收藏最多','Most saved'],featured:['推荐浏览','Recommended'],latest:['最新发布','Newest posts']};
const MOTION_EASE='cubic-bezier(.22,1,.36,1)';
let sortOpen=false,sortMotion=null;
const t = (zh,en) => state.lang === 'en' ? en : zh;
const title = c => state.lang === 'en' ? c.titleEn || c.title : c.title;
const el = (tag, className, text) => { const node=document.createElement(tag); if(className) node.className=className; if(text != null) node.textContent=text; return node; };
const ICONS={
  all:'M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h6v6h-6z',
  prompt:'M7 3h7l4 4v14H6V3h1m7 0v5h4M9 12h6M9 16h6',
  code:'m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16',
  demo:'M14 3h7v7m0-7L10 14M10 4H4v16h16v-6',
  product:'m12 3 9 5v9l-9 5-9-5V8l9-5m0 9v10M3 8l9 5 9-5',
  education:'m2 8 10-5 10 5-10 5L2 8m4 3v6c3 3 9 3 12 0v-6M22 8v8',
  motion:'M2 12c3-11 6 11 10 0s7 11 10 0',
  characters:'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18M8 9h.01M16 9h.01M8 14c2 3 6 3 8 0',
  interactive:'m12 2 9 5v10l-9 5-9-5V7l9-5m0 0v10M3 7l9 5 9-5m-9 5v10',
  stories:'M3 5h18v14H3zM7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4',
  music:'M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3c1 0 2 .4 3 1M20 16a3 3 0 1 1-3-3c1 0 2 .4 3 1M9 9l11-2',
  pause:'M8 4v16M16 4v16',play:'m7 4 13 8-13 8V4',
};
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.5','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',class:'nav-icon'}))svg.setAttribute(key,value);const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',ICONS[name]||ICONS.all);svg.append(path);return svg;}
const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
function animate(node,frames,options){return !reducedMotion?.matches&&node.animate?node.animate(frames,{easing:MOTION_EASE,...options}):null;}
let previewsEnabled=!reducedMotion?.matches&&!navigator.connection?.saveData;
const previews=new Map();
const cardNodes=new Map(),cardMotion=new WeakMap();
const previewObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
  for(const entry of entries){const preview=previews.get(entry.target);if(preview){preview.visible=entry.isIntersecting&&entry.intersectionRatio>=0.01;updatePreview(preview);}}
},{threshold:[0,0.01]}):null;
function previewAllowed(preview){return preview.visible&&previewsEnabled&&!document.hidden&&!$('viewer').open&&!preview.failed;}
function stopPreview(preview,{release=false}={}){
  preview.video.pause();preview.video.hidden=true;preview.thumb.classList.toggle('preview-playing',false);
  if(release&&preview.video.getAttribute('src')){preview.video.removeAttribute('src');preview.video.load();}
}
function updatePreview(preview){
  if(!previewAllowed(preview)){stopPreview(preview,{release:!preview.visible||!previewsEnabled||preview.failed});return;}
  if(preview.pending||!preview.video.paused)return;
  if(!preview.video.getAttribute('src'))preview.video.src=preview.url;
  preview.pending=true;
  let retry=true;
  preview.video.play().catch(error=>{retry=error.name==='AbortError';preview.video.hidden=true;preview.thumb.classList.toggle('preview-playing',false);}).finally(()=>{
    preview.pending=false;
    // A quick scroll or pause/resume may interrupt an in-flight play request.
    if(retry&&previews.get(preview.thumb)===preview&&previewAllowed(preview)&&preview.video.paused)updatePreview(preview);
  });
}
function syncPreviews(){for(const preview of previews.values())updatePreview(preview);}
function releaseCard(node){const thumb=node.querySelector('.thumbnail'),preview=previews.get(thumb);if(preview){previewObserver?.unobserve(thumb);stopPreview(preview,{release:true});previews.delete(thumb);}cardMotion.get(node)?.cancel();node.remove();}
function addPreview(thumb,url){
  if(!previewObserver)return;
  const video=el('video','card-preview');video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload='none';video.hidden=true;video.tabIndex=-1;video.setAttribute('aria-hidden','true');
  const preview={thumb,video,url,visible:false,failed:false,pending:false};
  video.addEventListener('playing',()=>{if(previews.get(thumb)!==preview||!previewAllowed(preview)){stopPreview(preview);return;}video.hidden=false;thumb.classList.toggle('preview-playing',true);});
  video.addEventListener('error',()=>{preview.failed=true;stopPreview(preview,{release:true});});
  thumb.append(video);previews.set(thumb,preview);previewObserver.observe(thumb);
}
function renderPreviewControl(){
  const button=$('toggle-previews');button.hidden=!previewObserver;
  const label=previewsEnabled?t('暂停预览','Pause previews'):t('播放预览','Play previews');button.replaceChildren(icon(previewsEnabled?'pause':'play'),el('span','',label));button.title=label;button.setAttribute('aria-label',label);
  button.setAttribute('aria-pressed',String(previewsEnabled));
}
const togglePreviews=()=>{previewsEnabled=!previewsEnabled;renderPreviewControl();syncPreviews();};
$('toggle-previews').addEventListener('click',togglePreviews);
reducedMotion?.addEventListener('change',event=>{previewsEnabled=!event.matches&&!navigator.connection?.saveData;renderPreviewControl();syncPreviews();});
document.addEventListener('visibilitychange',syncPreviews);
window.addEventListener('pagehide',()=>{for(const preview of previews.values())stopPreview(preview,{release:true});});
window.addEventListener('pageshow',syncPreviews);
function link(label,url,className='') { const node=el('a',className,label); const valid=safeUrl(url); if(valid) {node.href=valid;node.target='_blank';node.rel='noopener noreferrer';} return node; }
function date(value) { const parsed=new Date(value); return Number.isNaN(parsed.valueOf()) ? '—' : new Intl.DateTimeFormat(state.lang === 'en' ? 'en-US' : 'zh-CN',{dateStyle:'medium',timeZone:'UTC'}).format(parsed); }
function image(c, lazy=true) { const img=el('img'); img.alt=title(c); img.decoding='async'; if(lazy) img.loading='lazy'; const path=coverPath(c.cover?.path); if(path) img.src=path; img.addEventListener('error',()=>{img.replaceWith(el('span','cover-fallback',t('封面暂时无法显示','Preview unavailable')));},{once:true}); return img; }
async function copy(text,button,label) { try { await navigator.clipboard.writeText(text); button.textContent=t('已复制','Copied'); } catch { button.textContent=t('复制失败，请选中文字复制','Copy failed; select and copy the text'); } setTimeout(()=>{if(button.isConnected) button.textContent=label;},2500); }
// Retire manual filter links while keeping the README's source and prompt collections.
function readLocation() {
  const next=readState(location.href);
  next.playable=false;next.duration='all';
  if(next.prompt!=='original')next.prompt='all';
  const url=stateUrl(next,location.href);
  if(url.href!==location.href)history.replaceState(history.state,'',url);
  return next;
}
function navigate(patch,{replace=false,detail=false,autoplay=detail}={}) { if(searchTimer){clearTimeout(searchTimer);searchTimer=null;patch={page:'all',query:$('search').value,...patch};}const next={...state,...patch},filterChanged=filterKeys.some(key=>state[key]!==next[key]),listChanged=listKeys.some(key=>state[key]!==next[key]),languageChanged=state.lang!==next.lang;state=next;if(filterChanged)visibleCount=PAGE_SIZE;history[replace?'replaceState':'pushState']({galleryDetail:replace ? Boolean(history.state?.galleryDetail) && Boolean(state.caseId) : detail},'',stateUrl(state,location.href));if(listChanged)render();syncViewer({autoplay,refresh:languageChanged}); }
function openCollection(patch) { navigate(patch);window.scrollTo(0,0); }
function closeSort({focus=false,motion=true}={}) {
  if(!sortOpen)return;
  sortOpen=false;$('sort').setAttribute('aria-expanded','false');$('sort-menu').inert=true;
  sortMotion?.cancel();
  sortMotion=motion?animate($('sort-menu'),[{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(-3px) scale(.98)'}],{duration:110}):null;
  if(sortMotion)sortMotion.onfinish=()=>{if(!sortOpen){$('sort-menu').hidden=true;sortMotion=null;}};
  else $('sort-menu').hidden=true;
  if(focus)$('sort').focus({preventScroll:true});
}
function openSort(value=state.sort) {
  const wasHidden=$('sort-menu').hidden;sortMotion?.cancel();sortMotion=null;
  sortOpen=true;$('sort-menu').hidden=false;$('sort-menu').inert=false;$('sort').setAttribute('aria-expanded','true');
  if(wasHidden)sortMotion=animate($('sort-menu'),[{opacity:0,transform:'translateY(-5px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:180});
  $(`sort-${value}`).focus({preventScroll:true});
}
$('sort').addEventListener('click',()=>sortOpen?closeSort():openSort());
$('sort').addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();openSort(event.key==='ArrowDown'?SORT_ORDER[0]:SORT_ORDER.at(-1));}});
for(const value of SORT_ORDER)$(`sort-${value}`).addEventListener('click',()=>{navigate({page:'all',sort:value,caseId:null});closeSort({focus:true});});
$('sort-menu').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeSort({focus:true});return;}
  if(event.key==='Tab'){closeSort({focus:true,motion:false});return;}
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  event.preventDefault();
  const current=SORT_ORDER.findIndex(value=>$(`sort-${value}`)===document.activeElement);
  const next=event.key==='Home'?0:event.key==='End'?SORT_ORDER.length-1:(current+(event.key==='ArrowDown'?1:-1)+SORT_ORDER.length)%SORT_ORDER.length;
  $(`sort-${SORT_ORDER[next]}`).focus({preventScroll:true});
});
document.addEventListener('click',event=>{if(sortOpen&&!$('sort').contains(event.target)&&!$('sort-menu').contains(event.target))closeSort();});
document.addEventListener('focusin',event=>{if(sortOpen&&!$('sort').contains(event.target)&&!$('sort-menu').contains(event.target))closeSort();});
function renderLanguage() {
  document.documentElement.lang=state.lang==='en'?'en':'zh-CN'; document.title=t('Awesome AI Motion · 作品画廊','Awesome AI Motion · Gallery');
  const strings={'language-label':['English','中文'], 'browse-label':['按用途','BY USE'], 'follow-label':['关注观默','Follow Guanmo'],'search-label':['搜索作品、作者或效果','Search works, creators or effects'],'sort-label':['排序','Sort works'],'empty-title':['暂时没有匹配的作品','No matching works yet'],'empty-text':['试试其他关键词，或查看全部作品。','Try another keyword or browse all works.'],reset:['查看全部作品','Browse all works'],'footer-note':['作品归原作者所有。播放引用外部公开来源；公开提示词不一定包含完整制作过程。','Works belong to their creators. Players use external public sources; shared prompts may not include the full process.'],'source-guide':['来源说明','Source notes']};
  for(const [id,words] of Object.entries(strings)) $(id).textContent=t(...words);
  $('collection-title').textContent=t('AI 视频与动效参考','AI video & motion inspiration');
  $('materials-label').textContent=t('资料','Materials');
  for(const [kind,words] of Object.entries({prompt:['有提示词','With prompts'],code:['有源码','With source'],demo:['可体验','Try online']}))$(`filter-${kind}`).textContent=t(...words);
  $('follow-creator').setAttribute('aria-label',t('在 X 关注观默 @guanmo_ai','Follow Guanmo on X @guanmo_ai'));
  $('follow-creator').title=t('在 X 关注观默 @guanmo_ai','Follow Guanmo on X @guanmo_ai');
  $('github').setAttribute('aria-label',t('GitHub 仓库','GitHub repository'));
  $('github').title=t('查看 GitHub 仓库','View GitHub repository');
  $('language').setAttribute('aria-label',t('Switch to English','切换为中文'));$('language').title=t('Switch to English','切换为中文');
  $('search').placeholder=t('搜索作品、作者、风格','Search works, creators, styles');
  $('sort-current').textContent=t(...SORT_LABELS[state.sort]);
  for(const value of SORT_ORDER){$(`sort-${value}`).textContent=t(...SORT_LABELS[value]);$(`sort-${value}`).setAttribute('aria-checked',String(state.sort===value));}
  $('close').setAttribute('aria-label',t('关闭作品详情','Close work details'));
}
const TASK_LABELS={all:['全部','All'],product:['产品宣传','Product film'],education:['知识讲解','Explainer'],motion:['短动效','Motion design'],characters:['角色动画','Character'],interactive:['3D 交互','3D interaction'],stories:['叙事短片','Story'],music:['音乐视频','Music video']};
function render() {
  renderPreviewControl();renderLanguage();
  $('search').value=state.query;
  $('filter-prompt').setAttribute('aria-pressed',String(state.prompt==='original'));
  for(const kind of ['code','demo'])$(`filter-${kind}`).setAttribute('aria-pressed',String(state.resource===kind||state.resource==='both'));
  const legacy=$('filter-legacy');legacy.hidden=!['any','tool'].includes(state.resource);
  legacy.textContent=(state.resource==='tool'?t('有创作工具','With tools'):t('有源码或体验','Source or demo'))+' ×';
  legacy.setAttribute('aria-label',t('取消资料筛选','Remove material filter'));legacy.setAttribute('aria-pressed','true');
  const currentCategory=CATEGORIES.find(c=>c.id===state.category);
  const collections={any:['源码与网页','Source & web pages'],code:['作品源码','Source code'],demo:['在线体验','Online demos'],both:['作品源码 · 在线体验','Source code · Online demos'],tool:['创作工具','Creative tools']};
  const collectionName=[collections[state.resource],state.prompt==='original'?['提示词原文','Public prompts']:null].filter(Boolean).map(words=>t(...words)).join(' · ');
  $('collection-context').textContent=state.category!=='all'?currentCategory[state.lang]+(collectionName?` · ${collectionName}`:''):collectionName||t('全部作品','All works');
  const focusedCategory=document.activeElement?.dataset.category,counts=categoryCounts(cases,state);
  $('categories').replaceChildren(...CATEGORIES.map(category=>{
    const button=el('button','category');button.type='button';button.dataset.category=category.id;button.setAttribute('aria-pressed',String(state.category===category.id));
    button.append(icon(category.id),el('span','',t(...TASK_LABELS[category.id])),el('span','category-count',counts[category.id]));
    button.addEventListener('click',()=>openCollection({category:state.category===category.id?'all':category.id,caseId:null}));return button;
  }));
  if(focusedCategory)$('categories').querySelector(`[data-category="${focusedCategory}"]`)?.focus({preventScroll:true});
  const selected=selectCases(cases,state);
  $('result-count').textContent=t(`${selected.length} 个作品`,`${selected.length} work${selected.length===1?'':'s'}`);
  const sortNote=state.sort==='bookmarks'?t('按原帖收藏快照排序，非实时更新。','Based on bookmark snapshots, not live counts.'):'';
  $('sort-note').hidden=!sortNote;$('sort-note').textContent=sortNote;$('sort').title=sortNote;
  renderCards(selected);
  renderPagination(selected);$('empty').hidden=selected.length!==0;
}
function renderCards(selected) {
  const grid=$('works'),visible=pageCases(selected,visibleCount).visible,wanted=new Set(visible.map(c=>c.id));
  const positions=new Map();
  for(const [id,entry] of cardNodes){if(wanted.has(id)&&entry.lang===state.lang&&entry.node.getBoundingClientRect)positions.set(id,entry.node.getBoundingClientRect());cardMotion.get(entry.node)?.cancel();}
  for(const [id,entry] of cardNodes){
    if(!wanted.has(id)||entry.lang!==state.lang){releaseCard(entry.node);cardNodes.delete(id);}
  }
  const nodes=visible.map((c,index)=>cardNodes.get(c.id)?.node||card(c,index<4));
  nodes.forEach((node,index)=>{
    if(grid.children[index]!==node){const anchor=grid.children[index]||null;if(node.parentElement===grid&&grid.moveBefore)grid.moveBefore(node,anchor);else grid.insertBefore(node,anchor);}
  });
  const viewportHeight=window.innerHeight||0;
  nodes.forEach((node,index)=>{
    const previous=positions.get(node.dataset.caseId),next=node.getBoundingClientRect?.();
    if(!next||next.bottom<0||next.top>viewportHeight)return;
    cardMotion.get(node)?.cancel();
    const dx=previous?previous.left-next.left:0,dy=previous?previous.top-next.top:8;
    const motion=previous?(Math.abs(dx)+Math.abs(dy)>1?animate(node,[{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:320}):null):animate(node,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,delay:(index%4)*22});
    if(motion)cardMotion.set(node,motion);
  });
  syncPreviews();
}
function renderPagination(selected) {
  const {visible,remaining}=pageCases(selected,visibleCount);
  $('pagination').hidden=selected.length===0;
  $('shown-count').textContent=t(`已显示 ${visible.length} / ${selected.length}`,`Showing ${visible.length} of ${selected.length}`);
  $('load-more').hidden=remaining===0;
  $('load-more').textContent=t(`加载更多 ${Math.min(PAGE_SIZE,remaining)} 条`, `Load ${Math.min(PAGE_SIZE,remaining)} more`);
}
function card(c,eager=false) {
  const article=el('article','card'),button=el('button','card-open');article.dataset.caseId=c.id;button.type='button';button.dataset.caseId=c.id;button.setAttribute('aria-label',t(`打开作品：${title(c)}`,`Open work: ${title(c)}`));
  const thumb=el('div','thumbnail'),url=playbackUrl(c),playable=Boolean(url);thumb.append(image(c,!eager));
  if(playable)addPreview(thumb,url);
  const play=el('span','card-play');play.setAttribute('aria-hidden','true');play.append(el('span','',playable?'▶':'↗'));thumb.append(play);
  if(!playable)thumb.append(el('span','watch-mode',t('在 X 观看 ↗','Watch on X ↗')));
  const duration=el('span','duration',formatDuration(c.media?.durationSeconds));duration.title=t(`原始时长：${c.media?.durationSeconds ?? '—'} 秒`,`Source duration: ${c.media?.durationSeconds ?? '—'} seconds`);thumb.append(duration);
  const heading=el('h2','card-title',title(c));heading.title=title(c);button.append(thumb,heading);button.addEventListener('click',()=>{returnFocus=button;navigate({caseId:c.id},{detail:true});});
  const footer=el('div','card-footer'),meta=el('div','card-meta',`@${c.author.handle}`);meta.title=`@${c.author.handle} · ${CATEGORIES.find(cat=>cat.id===categoryOf(c))[state.lang]}`;footer.append(meta);article.append(button,footer);
  const materials=el('div','card-materials');
  if(c.prompt?.status==='original'){
    if(c.prompt.display==='source_link'){
      if(safeUrl(c.prompt.sourceUrl)){const source=link('',c.prompt.sourceUrl,'material-link');source.title=t('查看作者原帖中的指令','Read instructions in the creator’s post');source.setAttribute('aria-label',source.title);source.append(icon('prompt'),el('span','',t('作者指令','Instructions')));materials.append(source);}
    }else{
      const read=el('button','prompt-link');read.append(icon('prompt'),el('span','',t('查看提示词','Read prompt')));read.title=t('阅读作者提示词','Read the creator’s prompt');read.setAttribute('aria-label',t(`读提示词：${title(c)}`,`Read prompt: ${title(c)}`));read.type='button';read.dataset.caseId=c.id;
      read.addEventListener('click',()=>{returnFocus=read;navigate({caseId:c.id},{detail:true,autoplay:false});const prompt=$('viewer-content').querySelector('.original-prompt');if(prompt){prompt.open=true;prompt.scrollIntoView({block:'start'});prompt.querySelector('summary')?.focus({preventScroll:true});}});
      materials.append(read);
    }
  }
  const resources=resourceLinks(c);
  for(const kind of ['code','demo']){const resource=resources.find(r=>r.kind===kind);if(resource){const anchor=link('',resource.url,'material-link');anchor.title=kind==='code'?t('查看作品源码','View source code'):t('打开作品网页','Open the web page');anchor.setAttribute('aria-label',anchor.title);anchor.append(icon(kind),el('span','',kind==='code'?t('查看源码','View source'):t('在线体验','Try online')));materials.append(anchor);}}
  if(materials.children.length)footer.append(materials);
  cardNodes.set(c.id,{node:article,lang:state.lang});
  return article;
}
function details(label,text,{copyable=false,source=null,open=false,className=''}={}) {
  const section=el('details',className);section.open=open;section.append(el('summary','',label));section.append(el(copyable?'pre':'p','',text));
  if(copyable || source) { const actions=el('div','prompt-actions');if(copyable){const label=t('复制文本','Copy text'),button=el('button','copy-button',label);button.type='button';button.addEventListener('click',()=>copy(text,button,label));actions.append(button);}if(source)actions.append(link(t('查看出处 ↗','View source ↗'),source));section.append(actions); }
  return section;
}
function clearPlaybackTimer() { if(playbackTimer!==null){clearTimeout(playbackTimer);playbackTimer=null;} }
function updateViewerNavigation() {
  const {total,index,previous,next}=detailNeighbors(cases,state);
  $('viewer-navigation').hidden=false;
  $('viewer-prev').textContent=t('← 上一条','← Previous');
  $('viewer-next').textContent=t('下一条 →','Next →');
  $('viewer-prev').disabled=!previous;$('viewer-next').disabled=!next;
  $('viewer-prev').setAttribute('aria-label',t('上一条作品','Previous work'));
  $('viewer-next').setAttribute('aria-label',t('下一条作品','Next work'));
  $('viewer-position').textContent=index<0?t('不在当前筛选结果中','Outside current results'):t(`${index+1} / ${total}`,`${index+1} / ${total}`);
}
function showViewer(c,{autoplay=false}={}) {
  const content=$('viewer-content');content.replaceChildren();$('viewer-kicker').textContent=`${CATEGORIES.find(cat=>cat.id===categoryOf(c))[state.lang]} · ${formatDuration(c.media?.durationSeconds)}`;
  const layout=el('div','detail-layout'),stage=el('div','detail-stage'),materials=el('div','detail-materials');
  layout.append(stage,materials);content.append(layout);
  updateViewerNavigation();
  $('close').setAttribute('aria-label',t('关闭作品详情','Close work details'));
  const player=el('div','player-area'), url=playbackUrl(c);
  if(url) {
    const video=el('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.setAttribute('aria-label',title(c));const poster=coverPath(c.cover?.path);if(poster)video.poster=poster;
    const assist=el('div','playback-assist'),error=el('p','playback-error'),retry=el('button','playback-retry',t('重新加载视频','Retry video'));
    error.hidden=retry.hidden=true;error.setAttribute('role','status');retry.type='button';
    const controller=new AbortController();playbackAbort=controller;
    const fail=(zh,en)=>{clearPlaybackTimer();if(controller.signal.aborted)return;error.textContent=t(zh,en);error.hidden=retry.hidden=false;};
    const recover=()=>{clearPlaybackTimer();error.hidden=retry.hidden=true;};
    const arm=()=>{
      clearPlaybackTimer();if(controller.signal.aborted)return;
      playbackTimer=setTimeout(()=>{
        if(!video.error&&(video.readyState>=3||(video.paused&&video.readyState>=1))){recover();return;}
        fail('视频加载超时，可重试或到作者原帖观看。','Video loading timed out. Retry or watch the original post.');
      },PLAYBACK_TIMEOUT_MS);
    };
    video.addEventListener('error',()=>fail('视频暂时无法载入，可重试或到作者原帖观看。','The video could not load. Retry or watch the original post.'),{signal:controller.signal});
    video.addEventListener('loadstart',arm,{signal:controller.signal});
    video.addEventListener('play',()=>{if(video.readyState<3)arm();},{signal:controller.signal});
    for(const event of ['waiting','stalled'])video.addEventListener(event,()=>{if(!video.paused&&video.readyState<3)arm();},{signal:controller.signal});
    video.addEventListener('loadedmetadata',()=>{if(video.paused)recover();},{signal:controller.signal});
    for(const event of ['canplay','playing'])video.addEventListener(event,recover,{signal:controller.signal});
    for(const event of ['pause','ended'])video.addEventListener(event,clearPlaybackTimer,{signal:controller.signal});
    retry.addEventListener('click',()=>{error.hidden=retry.hidden=true;video.pause();video.src=url;video.load();arm();video.play().catch(()=>{});},{signal:controller.signal});
    assist.append(error,retry,link(t('到作者原帖观看 ↗','Watch the original post ↗'),c.source.url,'playback-source'));
    video.src=url;player.append(video,assist);arm();
  } else {player.append(image(c,false));const message=el('div','external-message');message.append(el('p','',t('这支作品目前在作者原帖观看。','This work is currently available on the creator’s original post.')),link(t('到作者原帖观看 ↗','Watch original post ↗'),c.source.url,'primary-link'));player.append(message);}
  const heading=el('h2','detail-heading',title(c));heading.id='viewer-title';const credits=el('div','detail-credits');credits.append(link(`${c.author.name} · @${c.author.handle}`,c.author.url),el('span','',`· ${date(c.source.publishedAt)} UTC`));
  const links=el('div','detail-links');for(const r of resourceLinks(c))links.append(link(resourceLabel(r.kind,state.lang)+' ↗',r.url,r.kind==='demo'?'primary-link':''));links.append(link(t('作者原帖 ↗','Original post ↗'),c.source.url));
  const shareLabel=t('复制作品链接','Copy work link'),share=el('button','share-button',shareLabel);share.type='button';share.addEventListener('click',()=>copy(location.href,share,shareLabel));links.append(share);
  if(c.prompt.status==='original'&&c.prompt.display!=='source_link') {const label=t('复制提示词','Copy prompt'),button=el('button','share-button',label);button.type='button';button.addEventListener('click',()=>copy(c.prompt.text,button,label));links.append(button);}
  stage.append(player,heading,credits,el('p','detail-summary',state.lang==='en'?c.summaryEn||c.summary:c.summary));
  materials.append(links);
  const resources=resourceLinks(c);
  if(resources.length){const section=el('details','resource-details');section.open=state.resource!=='all';section.append(el('summary','',t('源码与网页','Source & web pages')));for(const r of resources){const row=el('div','resource-item');row.append(el('span','card-tag',resourceLabel(r.kind,state.lang)),link(t(r.label,r.labelEn),r.url));if(r.note)row.append(el('p','',t(r.note,r.noteEn)));const facts=[];if(r.license)facts.push(r.license==='not_specified'?t('未标明许可','No license specified'):t('代码许可：','Code license: ')+r.license);if(r.checkedAt)facts.push(t('链接核对：','Link checked: ')+date(r.checkedAt)+' UTC');if(facts.length)row.append(el('p','',facts.join(' · ')));if(r.licenseUrl&&safeUrl(r.licenseUrl))row.append(link(t('查看许可证原文 ↗','Read the license ↗'),r.licenseUrl));if(r.evidenceUrl)row.append(link(t('链接出处 ↗','Link source ↗'),r.evidenceUrl));section.append(row);}materials.append(section);}
  const guide=c.guide;
  if(guide && typeof guide==='object') {
    const takeaway=state.lang==='en'?guide.takeawayEn:guide.takeawayZh;
    const steps=state.lang==='en'?guide.stepsEn:guide.stepsZh;
    if(takeaway || (Array.isArray(steps)&&steps.length)) {
      const section=el('details','work-guide'),label=el('summary','',t('可以学什么','What to learn'));
      section.append(label);
      if(takeaway)section.append(el('p','',takeaway));
      if(Array.isArray(steps)&&steps.length){section.append(el('h4','',t('开始尝试','Try it yourself')),el('p','guide-note',t('以下是根据作者公开资料整理的尝试建议。','Suggested starting steps based on the creator’s public material.')));const list=el('ol');for(const step of steps)list.append(el('li','',step));section.append(list);}
      if(Array.isArray(guide.tools)&&guide.tools.length)section.append(el('p','guide-tools',t('原文提到的工具：','Tools mentioned in the source: ')+guide.tools.join(' · ')));
      if(Array.isArray(guide.evidenceUrls)&&guide.evidenceUrls.length){const evidence=el('details','guide-evidence');evidence.append(el('summary','',t('查看导览依据','Guide sources')));guide.evidenceUrls.forEach((evidenceUrl,index)=>{if(safeUrl(evidenceUrl))evidence.append(link(t(`资料 ${index+1} ↗`,`Source ${index+1} ↗`),evidenceUrl));});section.append(evidence);}
      materials.append(section);
    }
  }
  const stageNote=stageOf(c)==='discovery'
    ? t(`发现池 · 来源已核对，编目资料待完善。来源核对：${date(c.verification?.sourceReadAt)} UTC。`,`Discovery pool · Source verified; catalog details being completed. Source checked: ${date(c.verification?.sourceReadAt)} UTC.`)
    : t(`已编目 · 来源资料已整理。来源核对：${date(c.verification?.sourceReadAt)} UTC。`,`Catalogued · Source details recorded. Source checked: ${date(c.verification?.sourceReadAt)} UTC.`);
  if(url)materials.append(el('p','detail-note',t('播放器引用作者原帖的外部视频媒体；若加载失败，请打开作者原帖。','The player uses external video media from the original post. If it fails to load, open the creator’s post.')));
  if(c.prompt.display==='source_link'){
    const original=c.prompt.status==='original';
    materials.append(details(original?t('作者公开指令 · 原帖入口','Creator instructions · source link'):t('作者任务描述 · 非完整提示词','Author brief · not a complete prompt'),original?t('作者已公开指令；本站仅链接原文，不再分发全文或译文。','The creator has shared instructions. This catalog links to the source without redistributing the full text or translation.'):t('完整指令尚未取得，请查看作者原帖中的任务描述。','The complete instructions have not been verified; see the task brief in the creator’s post.'),{source:c.prompt.sourceUrl,open:state.prompt==='original'}));
  }else if(c.prompt.status==='unknown'){
    const unknown=el('div','prompt-unknown');unknown.append(el('strong','',t('作者提示词未公开／暂未核得','Creator prompt unpublished / not verified')),el('p','',t('目前没有可展示的作者原文或完整指令。','No creator prompt or complete instruction is available to show.')),link(t('查看作者原帖 ↗','View the creator’s post ↗'),c.prompt.sourceUrl));materials.append(unknown);
  }else materials.append(details(c.prompt.status==='original'?t('作者公开提示词','Creator’s public prompt'):t('作者任务描述 · 非完整提示词','Author brief · not a complete prompt'),c.prompt.text,{copyable:c.prompt.status==='original',source:c.prompt.sourceUrl,open:state.prompt==='original',className:c.prompt.status==='original'?'original-prompt':''}));
  if(c.prompt.status!=='unknown'&&c.prompt.translationZh) materials.append(details(t('中文译文','Chinese translation'),c.prompt.translationZh,{copyable:c.prompt.status==='original'}));
  const note=state.lang==='en'?c.prompt.noteEn:c.prompt.noteZh;if(c.prompt.status!=='unknown'&&note) materials.append(details(t('使用前说明','Before you try'),note));
  const provenance=el('details');provenance.append(el('summary','',t('来源与详细核验','Sources & verification')),el('p','stage-note',stageNote));
  const metrics=el('div','metrics');for(const [key,zh,en] of [['bookmarks','收藏','Bookmarks'],['likes','点赞','Likes'],['views','浏览','Views']]) {const item=el('p','',`${t(zh,en)} `);item.append(el('strong','',c.metrics[key]==null?'—':c.metrics[key].toLocaleString(state.lang==='en'?'en-US':'zh-CN')));metrics.append(item);}provenance.append(metrics,el('p','detail-note',t(`互动快照：${date(c.metrics.checkedAt)} UTC。未知数据保留为 —，不等于 0。`,`Metrics captured: ${date(c.metrics.checkedAt)} UTC. — indicates unknown, not zero.`)),link(t('X 原帖 ↗','Original X post ↗'),c.source.url),el('p','detail-note',t(`模型：${c.model.name}，依据作者公开说明，未逐条独立复现。`, `Model: ${c.model.name}, attributed by the creator. Works have not been independently reproduced.`)),link(t('模型依据 ↗','Model attribution ↗'),c.model.evidenceUrl),el('p','detail-note',t('原作者保留作品权利。外部公开链接不代表本项目取得转载许可。','Creators retain rights to their work. Public links do not establish redistribution permission.')));
  materials.append(provenance);
  const related=relatedCases(cases,c);
  if(related.length){const section=el('section','related-works'),heading=el('h3','',t('继续看同类作品','More like this')),grid=el('div','related-grid');for(const item of related){const button=el('button','related-card');button.type='button';button.append(image(item),el('span','',title(item)));button.addEventListener('click',()=>{navigate({caseId:item.id},{replace:true,detail:true});$('close').focus({preventScroll:true});});grid.append(button);}section.append(heading,grid);content.append(section);}
  activeId=c.id;activeMissing=false;
  if(!$('viewer').open){savedOverflow=document.body.style.overflow;savedScroll=window.scrollY;document.body.style.overflow='hidden';$('viewer').showModal();} $('viewer').scrollTop=0;
  syncPreviews();
  if(autoplay) content.querySelector('video')?.play().catch(()=>{});
}
function showMissingViewer() {
  const content=$('viewer-content'),continueLink=el('a','primary-link',t('继续浏览','Continue browsing'));
  $('viewer-navigation').hidden=true;
  const heading=el('h2','detail-heading',t('作品不存在或已移除','Work not found or removed'));
  heading.id='viewer-title';continueLink.href=stateUrl({...state,caseId:null},location.href);
  continueLink.addEventListener('click',event=>{if(event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;event.preventDefault();navigate({caseId:null},{replace:true});});
  $('viewer-kicker').textContent=t('作品不可用','Work unavailable');
  $('close').setAttribute('aria-label',t('关闭提示','Close notice'));
  content.replaceChildren(heading,el('p','detail-summary',t('这个作品链接已失效。你可以继续浏览画廊中的其他作品。','This work link is no longer available. You can keep exploring the gallery.')),continueLink);
  document.title=t('作品不存在或已移除 · Awesome AI Motion','Work not found or removed · Awesome AI Motion');
  activeId=state.caseId;activeMissing=true;
  if(!$('viewer').open){savedOverflow=document.body.style.overflow;savedScroll=window.scrollY;document.body.style.overflow='hidden';$('viewer').showModal();} $('viewer').scrollTop=0;
  syncPreviews();
}
function unload() {clearPlaybackTimer();playbackAbort?.abort();playbackAbort=null;const video=$('viewer').querySelector('video');if(video){video.pause();video.removeAttribute('src');video.load();}}
function hideViewer(){
  const closingId=activeId;
  unload();activeId=null;activeMissing=false;
  if($('viewer').open)$('viewer').close();
  $('viewer-content').replaceChildren();document.title=t('Awesome AI Motion · 作品画廊','Awesome AI Motion · Gallery');
  document.body.style.overflow=savedOverflow;window.scrollTo(0,savedScroll);
  const target=returnFocus?.isConnected?returnFocus:$('works').querySelector(`.card-open[data-case-id="${returnFocus?.dataset.caseId || closingId || ''}"]`)||$('works');
  target.focus({preventScroll:true});returnFocus=null;
  syncPreviews();
}
function syncViewer({refresh=false,...options}={}){const c=cases.find(c=>c.id===state.caseId);if(c){if(activeId!==c.id || activeMissing || !$('viewer').open || refresh){unload();document.title=t('Awesome AI Motion · 作品画廊','Awesome AI Motion · Gallery');showViewer(c,options);}}else if(state.caseId){if(activeId!==state.caseId || !activeMissing || !$('viewer').open || refresh){unload();showMissingViewer();}}else if(activeId) hideViewer();}
function closeViewer(){if(history.state?.galleryDetail && state.caseId) history.back();else navigate({caseId:null},{replace:true});}
function stepViewer(direction) {
  const target=detailNeighbors(cases,state)[direction];if(!target)return;
  navigate({caseId:target.id},{replace:true,detail:true});
  if(!$('viewer').contains(document.activeElement) || document.activeElement?.disabled)$('close').focus({preventScroll:true});
}
$('close').addEventListener('click',closeViewer);$('viewer').addEventListener('cancel',event=>{event.preventDefault();closeViewer();});
$('viewer-prev').addEventListener('click',()=>stepViewer('previous'));
$('viewer-next').addEventListener('click',()=>stepViewer('next'));
document.addEventListener('keydown',event=>{
  if(event.key==='/'&&!event.defaultPrevented&&!event.isComposing&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!$('viewer').open&&!(event.target instanceof Element&&event.target.closest('input,textarea,select,video,[contenteditable]'))){event.preventDefault();$('search').focus();return;}
  if(!['ArrowLeft','ArrowRight'].includes(event.key) || !$('viewer').open || event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || document.fullscreenElement || document.pictureInPictureElement)return;
  const target=event.target;
  if(target instanceof Element && (target.isContentEditable || target.closest('input,textarea,select,video,[contenteditable]')))return;
  event.preventDefault();event.stopPropagation();
  if(!event.repeat)stepViewer(event.key==='ArrowLeft'?'previous':'next');
},true);
let backdropDown=false;$('viewer').addEventListener('pointerdown',event=>{const r=$('viewer').getBoundingClientRect();backdropDown=event.target===$('viewer')&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);});$('viewer').addEventListener('click',event=>{if(backdropDown && event.target===$('viewer'))closeViewer();backdropDown=false;});
$('filter-prompt').addEventListener('click',()=>openCollection({prompt:state.prompt==='original'?'all':'original',caseId:null}));
for(const kind of ['code','demo'])$(`filter-${kind}`).addEventListener('click',()=>{
  const active=new Set(state.resource==='both'?['code','demo']:['code','demo'].includes(state.resource)?[state.resource]:[]);
  if(active.has(kind))active.delete(kind);else active.add(kind);
  openCollection({resource:active.size===2?'both':active.values().next().value||'all',caseId:null});
});
$('filter-legacy').addEventListener('click',()=>openCollection({resource:'all',caseId:null}));
function applySearch(){clearTimeout(searchTimer);searchTimer=null;navigate({page:'all',query:$('search').value,caseId:null},{replace:state.page==='all'});}
function scheduleSearch(){clearTimeout(searchTimer);searchTimer=setTimeout(applySearch,140);}
$('search').addEventListener('input',event=>{if(!event.isComposing)scheduleSearch();});
$('search').addEventListener('compositionstart',()=>{clearTimeout(searchTimer);searchTimer=null;});
$('search').addEventListener('compositionend',scheduleSearch);
$('search').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing)applySearch();});
function resetCollection(){navigate({page:'all',category:'all',query:'',playable:false,duration:'all',prompt:'all',resource:'all',caseId:null});$('search').focus({preventScroll:true});}
$('reset').addEventListener('click',resetCollection);
$('load-more').addEventListener('click',()=>{
  const selected=selectCases(cases,state),previous=visibleCount;visibleCount+=PAGE_SIZE;
  const added=selected.slice(previous,visibleCount).map(c=>card(c));
  $('works').append(...added);renderPagination(selected);
  added[0]?.querySelector('.card-open')?.focus({preventScroll:true});
});
$('language').addEventListener('click',()=>navigate({lang:state.lang==='zh'?'en':'zh'},{replace:true}));
function onLocation(){closeSort({motion:false});clearTimeout(searchTimer);searchTimer=null;const next=readLocation(),filterChanged=filterKeys.some(key=>state[key]!==next[key]),listChanged=listKeys.some(key=>state[key]!==next[key]),languageChanged=state.lang!==next.lang;state=next;if(filterChanged)visibleCount=PAGE_SIZE;if(listChanged)render();syncViewer({refresh:languageChanged});}window.addEventListener('popstate',onLocation);window.addEventListener('hashchange',onLocation);
try { const response=await fetch('./data/cases.json');if(!response.ok)throw new Error('Catalog unavailable');const catalog=await response.json();if(!Array.isArray(catalog.cases))throw new Error('Invalid catalog');cases=catalog.cases;$('loading').hidden=true;render();syncViewer(); }catch { renderLanguage();$('loading').textContent=t('作品列表暂时无法载入。请刷新重试，或从上方 GitHub 入口浏览。若在本地打开，请使用 HTTP 静态服务器预览。','The catalog could not load. Refresh or browse via GitHub above. For a local preview, use an HTTP static server.'); }
