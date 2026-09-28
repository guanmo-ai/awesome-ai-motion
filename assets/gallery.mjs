import {REVIEW_OPTIONS,reviewLabels,CATEGORIES,isFeatured,stageOf,curationCounts,PAGE_SIZE,pageCases,categoryOf,safeUrl,coverPath,playbackUrl,tagsOf,readState,stateUrl,selectCases,detailNeighbors,categoryCounts,formatDuration,recommendedCases,introCases,relatedCases} from './gallery-model.mjs?v=20260928-navigation';
const $ = id => document.getElementById(id);
let state = readState(location.href), cases = [], activeId = null, activeMissing = false, returnFocus = null, savedOverflow = '', savedScroll = 0;
let curator=null,managing=false,mutationPending=false;
let visibleCount=PAGE_SIZE;
let playbackTimer=null,playbackAbort=null;
const PLAYBACK_TIMEOUT_MS=12000;
const filterKeys=['category','query','sort','playable','view','duration','prompt'];
const listKeys=['page',...filterKeys,'lang'];
const t = (zh,en) => state.lang === 'en' ? en : zh;
const title = c => state.lang === 'en' ? c.titleEn || c.title : c.title;
const el = (tag, className, text) => { const node=document.createElement(tag); if(className) node.className=className; if(text != null) node.textContent=text; return node; };
function link(label,url,className='') { const node=el('a',className,label); const valid=safeUrl(url); if(valid) {node.href=valid;node.target='_blank';node.rel='noopener noreferrer';} return node; }
function date(value) { const parsed=new Date(value); return Number.isNaN(parsed.valueOf()) ? '—' : new Intl.DateTimeFormat(state.lang === 'en' ? 'en-US' : 'zh-CN',{dateStyle:'medium',timeZone:'UTC'}).format(parsed); }
function image(c, lazy=true) { const img=el('img'); img.alt=title(c); img.decoding='async'; if(lazy) img.loading='lazy'; const path=coverPath(c.cover?.path); if(path) img.src=path; img.addEventListener('error',()=>{img.replaceWith(el('span','cover-fallback',t('封面暂时无法显示','Preview unavailable')));},{once:true}); return img; }
async function copy(text,button,label) { try { await navigator.clipboard.writeText(text); button.textContent=t('已复制','Copied'); } catch { button.textContent=t('复制失败，请选中文字复制','Copy failed; select and copy the text'); } setTimeout(()=>{if(button.isConnected) button.textContent=label;},2500); }
function navigate(patch,{replace=false,detail=false}={}) { const next={...state,...patch},filterChanged=filterKeys.some(key=>state[key]!==next[key]),listChanged=listKeys.some(key=>state[key]!==next[key]),languageChanged=state.lang!==next.lang;state=next;if(filterChanged)visibleCount=PAGE_SIZE;history[replace?'replaceState':'pushState']({galleryDetail:replace ? Boolean(history.state?.galleryDetail) && Boolean(state.caseId) : detail},'',stateUrl(state,location.href));if(listChanged)render();syncViewer({autoplay:detail,refresh:languageChanged}); }
function onHome() { return state.page==='home'; }
function openCollection(patch) { navigate(patch);window.scrollTo(0,0); }
function renderLanguage() {
  document.documentElement.lang=state.lang==='en'?'en':'zh-CN'; document.title=t('Awesome AI Motion · 作品画廊','Awesome AI Motion · Gallery');
  $('follow-creator').textContent=t('关注观默 ↗','Follow on X ↗');
  $('follow-creator').setAttribute('aria-label',t('在 X 关注观默 @guanmo_ai（新标签页）','Follow Guanmo @guanmo_ai on X (new tab)'));
  $('creator-role').textContent=t('发起与维护','Created & maintained by');
  $('creator-name').textContent=t('观默','Guanmo');
  const strings={language:['English','中文'], 'browse-label':['按类别浏览','BROWSE BY CATEGORY'], 'curation-note':['看见好作品，找到下一次创作的灵感。','Good work. Fresh inspiration for your next creation.'],submit:['推荐作品 ↗','Submit a work ↗'],'intro-label':['作品与创作线索','WATCH. EXPLORE. CREATE.'],'intro-text':['看作品，认识作者，找到下一次创作的灵感。','Watch the work, meet its maker, find your next idea.'],'search-label':['搜索作品、作者或风格','Search works, creators or styles'],'sort-label':['排序','Sort works'],'view-label':['馆藏状态','Collection status'],'duration-label':['时长','Duration'],'prompt-label':['提示词','Prompt'],'playable-label':['仅页内播放','Inline player only'],'empty-title':['暂时没有匹配的作品','No matching works yet'],'empty-text':['试试另一个关键词，或清除筛选重新发现。','Try another keyword or clear the filters to keep exploring.'],reset:['清除筛选','Clear filters'],'footer-note':['作品归原作者所有。播放引用外部公开来源；公开提示词不一定包含完整制作过程。','Works belong to their creators. Players use external public sources; shared prompts may not include the full process.'],'source-guide':['来源说明','Source notes']};
  for(const [id,words] of Object.entries(strings)) $(id).textContent=t(...words);
  $('page-home').textContent=t('首页','Home');$('page-all').textContent=t('全部作品','All works');
  $('search').placeholder=t('搜索作品、作者或风格…','Search works, creators or styles…');
  const sortLabels={bookmarks:['收藏最多','Most bookmarked'],featured:['推荐浏览','Recommended browsing'],latest:['最新发布','Newest posts']};
  [...$('sort').options].forEach(option=>{option.textContent=t(...sortLabels[option.value]);});
  [...$('duration').options].forEach((option,i)=>{option.textContent=t(...[['全部时长','Any length'],['30 秒以内','Up to 30s'],['31–120 秒','31–120s'],['超过 120 秒','Over 120s']][i]);});
  [...$('prompt').options].forEach((option,i)=>{option.textContent=t(...[['全部状态','Any prompt'],['作者原文','Original prompt'],['任务描述','Creator brief'],['未公开／未核得','Unpublished / unverified']][i]);});
  $('close').setAttribute('aria-label',t('关闭作品详情','Close work details'));
}
function render() {
  renderLanguage(); renderCuration(); $('search').value=state.query; $('sort').value=state.sort; $('playable').checked=state.playable;$('view').value=state.view;$('duration').value=state.duration;$('prompt').value=state.prompt;
  for(const page of ['home','all']) {const button=$(`page-${page}`);if(state.page===page)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
  const currentCategory=CATEGORIES.find(c=>c.id===state.category);
  $('collection-title').textContent=onHome()?t('值得一看的 AI 动效。','AI motion worth watching.'):state.category==='all'?t('全部作品','All works'):currentCategory[state.lang];
  const activeFilters=Number(state.view!=='all')+Number(state.duration!=='all')+Number(state.prompt!=='all')+Number(state.playable);
  $('filter-summary').textContent=activeFilters?t(`筛选作品 · ${activeFilters} 项已启用`,`Filters · ${activeFilters} active`):t('筛选作品','Filter works');
  if(activeFilters)$('advanced-filters').open=true;
  const coverage=curationCounts(cases);
  $('coverage-count').textContent=t(`${coverage.all} 个作品，按类别继续探索。`,`${coverage.all} works to explore by category.`);
  [...$('view').options].forEach((option,i)=>{const id=['all','featured','catalogued','discovery'][i];option.textContent=t(...[[`全部 · ${coverage.all}`,`All · ${coverage.all}`],[`精选 · ${coverage.featured}`,`Featured · ${coverage.featured}`],[`已编目 · ${coverage.catalogued}`,`Catalogued · ${coverage.catalogued}`],[`发现池 · ${coverage.discovery}`,`Discovery · ${coverage.discovery}`]][i]);option.value=id;});
  const focusedCategory=document.activeElement?.dataset.category;
  const counts=categoryCounts(cases,state);
  $('categories').replaceChildren(...CATEGORIES.slice(1).map(category=>{ const button=el('button','category');button.type='button';button.dataset.category=category.id;button.setAttribute('aria-pressed',String(state.page==='all'&&state.category===category.id));button.append(el('span','',category[state.lang]),el('span','category-count',counts[category.id]));button.addEventListener('click',()=>openCollection({page:'all',category:category.id,caseId:null}));return button; }));
  if(focusedCategory) $('categories').querySelector(`[data-category="${focusedCategory}"]`)?.focus({preventScroll:true});
  const selected=selectCases(cases,state), category=CATEGORIES.find(c=>c.id===state.category),home=onHome();
  const visibleCategories=CATEGORIES.slice(1).filter(item=>counts[item.id]>0);
  $('result-count').textContent=home?'':t(`${category.zh} · ${selected.length} 个作品`,`${category.en} · ${selected.length} works`);
  document.querySelector('.results-bar').classList.toggle('home-results',home);
  $('sort-note').hidden=state.sort!=='bookmarks'; $('sort-note').textContent=t('按原帖收藏快照排序，非实时更新。','Based on bookmark snapshots, not live counts.');
  $('works').className=home?'home-sections':'grid';
  if(home) {
    const intro=el('section','home-section intro-section'),introHeading=el('div','home-heading'),introTitle=el('h2','home-title',t('收藏最多','Most bookmarked'));
    introTitle.id='group-intro';intro.setAttribute('aria-labelledby',introTitle.id);introHeading.append(introTitle);intro.append(introHeading);
    const introGrid=el('div','grid home-grid intro-grid');introGrid.append(...introCases(cases).map(c=>card(c,true,true)));intro.append(introGrid);
    $('works').replaceChildren(intro,...visibleCategories.map(category=>{
      const group=el('section','home-section'),heading=el('div','home-heading'),title=el('h2','home-title',category[state.lang]),count=counts[category.id];
      title.id=`group-${category.id}`;group.setAttribute('aria-labelledby',title.id);
      const more=el('button','home-more',t('查看全部 ↗','See all ↗'));more.type='button';more.setAttribute('aria-label',t(`查看全部${category.zh}作品，共 ${count} 条`,`See all ${category.en} works, ${count} total`));more.addEventListener('click',()=>{navigate({page:'all',category:category.id,caseId:null});$('works').focus({preventScroll:true});$('works').scrollIntoView({block:'start'});});
      heading.append(title,more);group.append(heading);
      const recommendations=recommendedCases(cases,category.source,3,'bookmarks');
      if(recommendations.length){const grid=el('div','grid home-grid');grid.append(...recommendations.map(c=>card(c,true)));group.append(grid);}
      else group.append(el('p','home-no-recommendations',t('此处暂无推荐，可查看全部作品。','No recommendations here yet. See all works.')));
      return group;
    }));
    $('pagination').hidden=true;
  } else { $('works').replaceChildren(...(state.category==='all'?selected:pageCases(selected,visibleCount).visible).map(c=>card(c)));renderPagination(selected); }
  $('empty').hidden=selected.length!==0;
}
function renderPagination(selected) {
  const {visible,remaining}=pageCases(selected,state.category==='all'?selected.length:visibleCount);
  $('pagination').hidden=selected.length===0;
  $('shown-count').textContent=t(`已显示 ${visible.length} / ${selected.length}`,`Showing ${visible.length} of ${selected.length}`);
  $('load-more').hidden=remaining===0;
  $('load-more').textContent=t(`加载更多 ${Math.min(PAGE_SIZE,remaining)} 条`, `Load ${Math.min(PAGE_SIZE,remaining)} more`);
}
function card(c,home=false,eager=false) {
  const article=el('article','card'), button=el('button','card-open');article.dataset.caseId=c.id;button.type='button';button.dataset.caseId=c.id;button.setAttribute('aria-label',t(`打开作品：${title(c)}`,`Open work: ${title(c)}`));
  const thumb=el('div','thumbnail'), playable=Boolean(playbackUrl(c));thumb.append(image(c,!eager));
  const play=el('span','card-play');play.setAttribute('aria-hidden','true');play.append(el('span','',playable?'▶':'↗'));thumb.append(play);
  thumb.append(el('span','watch-mode',playable?t('页内播放','Inline player'):t('原帖观看 ↗','Watch original ↗')));
  const duration=el('span','duration',formatDuration(c.media?.durationSeconds));duration.title=t(`原始时长：${c.media?.durationSeconds ?? '—'} 秒`,`Source duration: ${c.media?.durationSeconds ?? '—'} seconds`);thumb.append(duration);
  button.append(thumb,el(home?'h3':'h2','card-title',title(c)));button.addEventListener('click',()=>{returnFocus=button;navigate({caseId:c.id},{detail:true});});
  const meta=el('div','card-meta');meta.append(el('span','',`@${c.author.handle}`));if(!home)meta.append(el('span','dot','·'),el('span','',CATEGORIES.find(cat=>cat.id===categoryOf(c))[state.lang]));for(const tag of tagsOf(c,state.lang)) meta.append(el('span','card-tag',tag));if(state.sort==='bookmarks'){const count=Number.isFinite(c.metrics?.bookmarks)?new Intl.NumberFormat(state.lang==='en'?'en-US':'zh-CN').format(c.metrics.bookmarks):'—';meta.append(el('span','card-bookmarks',t(`收藏 ${count}`,`${count} bookmarks`)));}article.append(button,meta);if(curator&&managing){const actions=el('div','card-actions');actions.append(featuredControl(c,true),deleteControl(c,true));article.append(actions);}return article;
}
function details(label,text,{copyable=false,source=null}={}) {
  const section=el('details');section.append(el('summary','',label));section.append(el(copyable?'pre':'p','',text));
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
    const arm=()=>{clearPlaybackTimer();if(controller.signal.aborted)return;playbackTimer=setTimeout(()=>fail('视频加载超时，可重试或到作者原帖观看。','Video loading timed out. Retry or watch the original post.'),PLAYBACK_TIMEOUT_MS);};
    video.addEventListener('error',()=>fail('视频暂时无法载入，可重试或到作者原帖观看。','The video could not load. Retry or watch the original post.'),{signal:controller.signal});
    video.addEventListener('loadstart',arm,{signal:controller.signal});
    video.addEventListener('play',()=>{if(video.readyState<3)arm();},{signal:controller.signal});
    for(const event of ['waiting','stalled'])video.addEventListener(event,()=>{if(!video.paused)arm();},{signal:controller.signal});
    video.addEventListener('loadedmetadata',()=>{if(video.paused)recover();},{signal:controller.signal});
    for(const event of ['canplay','playing'])video.addEventListener(event,recover,{signal:controller.signal});
    for(const event of ['pause','ended'])video.addEventListener(event,clearPlaybackTimer,{signal:controller.signal});
    retry.addEventListener('click',()=>{error.hidden=retry.hidden=true;video.pause();video.src=url;video.load();arm();video.play().catch(()=>{});},{signal:controller.signal});
    assist.append(error,retry,link(t('到作者原帖观看 ↗','Watch the original post ↗'),c.source.url,'playback-source'));
    video.src=url;player.append(video,assist);arm();
  } else {player.append(image(c,false));const message=el('div','external-message');message.append(el('p','',t('这支作品目前在作者原帖观看。','This work is currently available on the creator’s original post.')),link(t('到作者原帖观看 ↗','Watch original post ↗'),c.source.url,'primary-link'));player.append(message);}
  const heading=el('h2','detail-heading',title(c));heading.id='viewer-title';const credits=el('div','detail-credits');credits.append(link(`${c.author.name} · @${c.author.handle}`,c.author.url),el('span','',`· ${date(c.source.publishedAt)} UTC`));
  const links=el('div','detail-links');if(safeUrl(c.demoUrl))links.append(link(t('交互体验 ↗','Try the interactive demo ↗'),c.demoUrl,'primary-link'));if(c.codeUrl)links.append(link(t('作者源码 ↗','Creator’s code ↗'),c.codeUrl));links.append(link(t('作者原帖 ↗','Original post ↗'),c.source.url));
  const shareLabel=t('复制作品链接','Copy work link'),share=el('button','share-button',shareLabel);share.type='button';share.addEventListener('click',()=>copy(location.href,share,shareLabel));links.append(share);
  if(c.prompt.status!=='unknown'&&c.prompt.display!=='source_link') {const label=c.prompt.status==='original'?t('复制提示词','Copy prompt'):t('复制任务描述','Copy brief'),button=el('button','share-button',label);button.type='button';button.addEventListener('click',()=>copy(c.prompt.text,button,label));links.append(button);}
  content.append(player,heading,credits,el('p','detail-summary',state.lang==='en'?c.summaryEn||c.summary:c.summary),links);
  const guide=c.guide;
  if(guide && typeof guide==='object') {
    const takeaway=state.lang==='en'?guide.takeawayEn:guide.takeawayZh;
    const steps=state.lang==='en'?guide.stepsEn:guide.stepsZh;
    if(takeaway || (Array.isArray(steps)&&steps.length)) {
      const section=el('section','work-guide'),label=el('h3','',t('可以学什么','What to learn'));
      section.append(label);
      if(takeaway)section.append(el('p','',takeaway));
      if(Array.isArray(steps)&&steps.length){section.append(el('h4','',t('开始尝试','Try it yourself')),el('p','guide-note',t('以下是根据作者公开资料整理的尝试建议。','Suggested starting steps based on the creator’s public material.')));const list=el('ol');for(const step of steps)list.append(el('li','',step));section.append(list);}
      if(Array.isArray(guide.tools)&&guide.tools.length)section.append(el('p','guide-tools',t('原文提到的工具：','Tools mentioned in the source: ')+guide.tools.join(' · ')));
      if(Array.isArray(guide.evidenceUrls)&&guide.evidenceUrls.length){const evidence=el('details','guide-evidence');evidence.append(el('summary','',t('查看导览依据','Guide sources')));guide.evidenceUrls.forEach((evidenceUrl,index)=>{if(safeUrl(evidenceUrl))evidence.append(link(t(`资料 ${index+1} ↗`,`Source ${index+1} ↗`),evidenceUrl));});section.append(evidence);}
      content.append(section);
    }
  }
  const stageNote=stageOf(c)==='discovery'
    ? t(`发现池 · 来源已核对，编目资料待完善。来源核对：${date(c.verification?.sourceReadAt)} UTC。`,`Discovery pool · Source verified; catalog details being completed. Source checked: ${date(c.verification?.sourceReadAt)} UTC.`)
    : t(`已编目 · 来源资料已整理。来源核对：${date(c.verification?.sourceReadAt)} UTC。`,`Catalogued · Source details recorded. Source checked: ${date(c.verification?.sourceReadAt)} UTC.`);
  if(curator&&managing){const management=el('details','management-panel');management.append(el('summary','',t('管理作品','Manage work')),featuredControl(c),reviewControl(c),deleteControl(c));content.append(management);}
  if(url)content.append(el('p','detail-note',t('播放器引用作者原帖的外部视频媒体；若加载失败，请打开作者原帖。','The player uses external video media from the original post. If it fails to load, open the creator’s post.')));
  if(c.prompt.display==='source_link'){
    content.append(details(t('作者公开指令 · 原帖入口','Creator instructions · source link'),t('作者已公开指令；本站仅链接原文，不再分发全文或译文。','The creator has shared instructions. This catalog links to the source without redistributing the full text or translation.'),{source:c.prompt.sourceUrl}));
  }else if(c.prompt.status==='unknown'){
    const unknown=el('div','prompt-unknown');unknown.append(el('strong','',t('作者提示词未公开／暂未核得','Creator prompt unpublished / not verified')),el('p','',t('目前没有可展示的作者原文或完整指令。','No creator prompt or complete instruction is available to show.')),link(t('查看作者原帖 ↗','View the creator’s post ↗'),c.prompt.sourceUrl));content.append(unknown);
  }else content.append(details(c.prompt.status==='original'?t('作者公开提示词','Creator’s public prompt'):t('作者任务描述 · 非完整提示词','Author brief · not a complete prompt'),c.prompt.text,{copyable:true,source:c.prompt.sourceUrl}));
  if(c.prompt.status!=='unknown'&&c.prompt.translationZh) content.append(details(t('中文译文','Chinese translation'),c.prompt.translationZh,{copyable:true}));
  const note=state.lang==='en'?c.prompt.noteEn:c.prompt.noteZh;if(c.prompt.status!=='unknown'&&note) content.append(details(t('使用前说明','Before you try'),note));
  const provenance=el('details');provenance.append(el('summary','',t('来源与详细核验','Sources & verification')),el('p','stage-note',stageNote));
  const metrics=el('div','metrics');for(const [key,zh,en] of [['bookmarks','收藏','Bookmarks'],['likes','点赞','Likes'],['views','浏览','Views']]) {const item=el('p','',`${t(zh,en)} `);item.append(el('strong','',c.metrics[key]==null?'—':c.metrics[key].toLocaleString(state.lang==='en'?'en-US':'zh-CN')));metrics.append(item);}provenance.append(metrics,el('p','detail-note',t(`互动快照：${date(c.metrics.checkedAt)} UTC。未知数据保留为 —，不等于 0。`,`Metrics captured: ${date(c.metrics.checkedAt)} UTC. — indicates unknown, not zero.`)),link(t('X 原帖 ↗','Original X post ↗'),c.source.url),el('p','detail-note',t(`模型：${c.model.name}，依据作者公开说明，未逐条独立复现。`, `Model: ${c.model.name}, attributed by the creator. Works have not been independently reproduced.`)),link(t('模型依据 ↗','Model attribution ↗'),c.model.evidenceUrl),el('p','detail-note',t('原作者保留作品权利。外部公开链接不代表本项目取得转载许可。','Creators retain rights to their work. Public links do not establish redistribution permission.')));
  content.append(provenance);
  const related=relatedCases(cases,c);
  if(related.length){const section=el('section','related-works'),heading=el('h3','',t('继续看同类作品','More like this')),grid=el('div','related-grid');for(const item of related){const button=el('button','related-card');button.type='button';button.append(image(item),el('span','',title(item)));button.addEventListener('click',()=>{navigate({caseId:item.id},{replace:true,detail:true});$('close').focus({preventScroll:true});});grid.append(button);}section.append(heading,grid);content.append(section);}
  activeId=c.id;activeMissing=false;
  if(!$('viewer').open){savedOverflow=document.body.style.overflow;savedScroll=window.scrollY;document.body.style.overflow='hidden';$('viewer').showModal();} $('viewer').scrollTop=0;
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
}
function unload() {clearPlaybackTimer();playbackAbort?.abort();playbackAbort=null;const video=$('viewer').querySelector('video');if(video){video.pause();video.removeAttribute('src');video.load();}}
function hideViewer(){unload();activeId=null;activeMissing=false;if($('viewer').open)$('viewer').close();$('viewer-content').replaceChildren();document.title=t('Awesome AI Motion · 作品画廊','Awesome AI Motion · Gallery');document.body.style.overflow=savedOverflow;window.scrollTo(0,savedScroll);const target=returnFocus?.isConnected?returnFocus:$('works').querySelector(`.card-open[data-case-id="${returnFocus?.dataset.caseId || ''}"]`);target?.focus({preventScroll:true});returnFocus=null;}
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
  if(!['ArrowLeft','ArrowRight'].includes(event.key) || !$('viewer').open || $('trash').open || event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || document.fullscreenElement || document.pictureInPictureElement)return;
  const target=event.target;
  if(target instanceof Element && (target.isContentEditable || target.closest('input,textarea,select,[contenteditable]')))return;
  event.preventDefault();event.stopPropagation();
  if(!event.repeat)stepViewer(event.key==='ArrowLeft'?'previous':'next');
},true);
let backdropDown=false;$('viewer').addEventListener('pointerdown',event=>{const r=$('viewer').getBoundingClientRect();backdropDown=event.target===$('viewer')&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);});$('viewer').addEventListener('click',event=>{if(backdropDown && event.target===$('viewer'))closeViewer();backdropDown=false;});
$('page-home').addEventListener('click',()=>openCollection({page:'home',category:'all',query:'',sort:'bookmarks',playable:false,view:'all',duration:'all',prompt:'all',caseId:null}));
$('page-all').addEventListener('click',()=>openCollection({page:'all',category:'all',query:'',playable:false,view:'all',duration:'all',prompt:'all',caseId:null}));
$('search').addEventListener('input',()=>navigate({page:'all',query:$('search').value,caseId:null},{replace:state.page==='all'}));$('sort').addEventListener('change',()=>navigate({page:'all',sort:$('sort').value,caseId:null}));$('playable').addEventListener('change',()=>navigate({page:'all',playable:$('playable').checked,caseId:null}));
for(const id of ['view','duration','prompt'])$(id).addEventListener('change',()=>navigate({page:'all',[id]:$(id).value,caseId:null}));
$('reset').addEventListener('click',()=>{$('advanced-filters').open=false;navigate({page:'all',category:'all',query:'',playable:false,view:'all',duration:'all',prompt:'all',caseId:null});});
$('load-more').addEventListener('click',()=>{const selected=selectCases(cases,state),previous=visibleCount;visibleCount+=PAGE_SIZE;$('works').append(...selected.slice(previous,visibleCount).map(c=>card(c)));renderPagination(selected);});
$('language').addEventListener('click',()=>navigate({lang:state.lang==='zh'?'en':'zh'},{replace:true}));
function onLocation(){const next=readState(location.href),filterChanged=filterKeys.some(key=>state[key]!==next[key]),listChanged=listKeys.some(key=>state[key]!==next[key]),languageChanged=state.lang!==next.lang;state=next;if(filterChanged)visibleCount=PAGE_SIZE;if(listChanged)render();syncViewer({refresh:languageChanged});}window.addEventListener('popstate',onLocation);window.addEventListener('hashchange',onLocation);
try { const response=await fetch('./data/cases.json');if(!response.ok)throw new Error('Catalog unavailable');const catalog=await response.json();if(!Array.isArray(catalog.cases))throw new Error('Invalid catalog');cases=catalog.cases;$('loading').hidden=true;render();syncViewer(); }catch { renderLanguage();$('loading').textContent=t('作品列表暂时无法载入。请刷新重试，或从上方 GitHub 入口浏览。若在本地打开，请使用 HTTP 静态服务器预览。','The catalog could not load. Refresh or browse via GitHub above. For a local preview, use an HTTP static server.'); }

function renderCuration() {
  $('manage-works').hidden=!curator;
  $('manage-works').textContent=t('管理作品','Manage works');
  $('manage-works').setAttribute('aria-pressed',String(managing));
  $('deleted-works').hidden=!(curator&&managing);
  if(!curator)return;
  $('deleted-works').textContent=t(`已删除 · ${curator.trash.length}`,`Deleted · ${curator.trash.length}`);
  $('trash-title').textContent=t('已删除的作品','Deleted works');
  $('trash-note').textContent=t('可随时恢复。删除已同步到本地仓库，尚未推送 GitHub。','Restore at any time. Changes are saved in the local repository, not pushed to GitHub.');
  $('trash-list').replaceChildren(...curator.trash.map(item=>{
    const row=el('div','trash-row'),button=el('button','restore-button',t('恢复','Restore'));
    button.type='button';button.disabled=mutationPending;
    button.addEventListener('click',()=>mutate('restore',item.key,button));
    row.append(el('span','',title(item)),button);return row;
  }));
  if(!curator.trash.length)$('trash-list').append(el('p','',t('还没有删除作品。','No deleted works.')));
}
function featuredControl(c,compact=false) {
  const box=el('div',compact?'featured-control card-featured-control':'featured-control');
  const button=el('button','feature-button',isFeatured(c)?t('取消精选','Remove featured'):t(compact?'精选':'设为精选','Feature work'));
  const status=el('span','feature-status');status.setAttribute('role','status');
  button.type='button';button.setAttribute('aria-pressed',String(isFeatured(c)));
  button.setAttribute('aria-label',t(`${isFeatured(c)?'取消精选':'精选'}：${title(c)}`,`${isFeatured(c)?'Remove featured':'Feature'}: ${title(c)}`));
  button.addEventListener('click',()=>{
    const item=cases.find(row=>row.id===c.id);if(!item)return;
    const current=item.review||{highlights:[],later:false};
    mutate('review',c.id,button,status,{...current,highlights:[...current.highlights],later:false,featured:!isFeatured(item)});
  });
  box.append(button,status);return box;
}
function deleteControl(c,compact=false) {
  const box=el('div',compact?'delete-control card-delete-control':'delete-control'),button=el('button','delete-button',t(compact?'删除':'删除作品','Delete'));
  button.type='button';box.append(button);
  button.addEventListener('click',()=>{
    const confirm=el('button','delete-button',t('确认删除','Confirm deletion')),cancel=el('button','restore-button',t('取消','Cancel'));
    confirm.type=cancel.type='button';
    const status=el('p','delete-status');status.setAttribute('role','status');
    box.replaceChildren(el('p','',t('从画廊和本地仓库移除作品、提示词和封面；可在「已删除」中恢复。','Remove this work, its prompt and cover locally. Restore it from Deleted.')),confirm,cancel,status);
    confirm.addEventListener('click',()=>mutate('delete',c.id,confirm,status));
    cancel.addEventListener('click',()=>{const next=deleteControl(c,compact);box.replaceWith(next);next.querySelector('button').focus();});confirm.focus();
  });return box;
}
async function mutate(action,id,button,errorNode=$('trash-status'),review) {
  if(mutationPending)return;
  const fromCard=Boolean(button.closest('.card'));
  const fromFeature=button.classList.contains('feature-button');
  const reviewOption=button.dataset.reviewOption;
  mutationPending=true;button.disabled=true;errorNode.textContent='';
  try {
    const response=await fetch('./api/curation',{method:'POST',headers:{'Content-Type':'application/json','X-Curation-Token':curator.token},body:JSON.stringify({action,id,revision:curator.revision,review})});
    const data=await response.json();if(!response.ok)throw new Error(data.error);
    curator=data;cases=data.catalog.cases;
    if(action==='delete'){navigate({caseId:null},{replace:true});render();}else render();
    const status=$('curation-status');status.hidden=false;
    status.textContent=action==='review'?t('精选与评价已保存，推荐排序已更新。','Featured choice and review saved. Recommended order updated.'):action==='delete'?t('已从本地仓库删除，可在右上角「已删除」中恢复。未推送 GitHub。','Deleted locally. Restore via Deleted in the header. Not pushed to GitHub.'):t('已恢复作品及仓库资料。','Work and repository files restored.');
    if(action==='delete')$('deleted-works').focus();
    else if(action==='review'){
      const item=cases.find(c=>c.id===id);
      if(fromCard){($('works').querySelector(`.card[data-case-id="${id}"] .feature-button`)||$('works')).focus({preventScroll:true});}
      if(activeId===id&&item){
        const oldFeature=$('viewer-content').querySelector('.featured-control');
        if(oldFeature)oldFeature.replaceWith(featuredControl(item));
        const oldReview=$('viewer-content').querySelector('.review-control');
        if(oldReview){const next=reviewControl(item);next.open=oldReview.open;oldReview.replaceWith(next);next.querySelector('.review-status').textContent=t('已保存 · 推荐排序已更新','Saved · Recommended order updated');}
        if(!fromCard){const target=fromFeature?$('viewer-content').querySelector('.feature-button'):reviewOption?$('viewer-content').querySelector(`[data-review-option="${reviewOption}"]`):null;target?.focus({preventScroll:true});}
      }
    }
    else {$('trash-status').textContent=t('已恢复。','Restored.');$('trash-close').focus();}
  } catch(error) {errorNode.textContent=error.message||t('保存失败，请刷新后重试。','Save failed. Refresh and retry.');}
  finally {mutationPending=false;button.disabled=false;renderCuration();}
}
$('deleted-works').addEventListener('click',()=>{renderCuration();$('trash-status').textContent='';$('trash').showModal();});
$('trash-close').addEventListener('click',()=>$('trash').close());
$('manage-works').addEventListener('click',()=>{
  if(!curator)return;
  managing=!managing;
  if(!managing&&$('trash').open)$('trash').close();
  render();
  if(activeId)syncViewer({refresh:true});
  $('manage-works').focus({preventScroll:true});
});
// Static hosting has no local editor API: keep editing controls hidden there.
if(location.hostname==='127.0.0.1')try {
  const response=await fetch('./api/curation');
  if(response.ok){const data=await response.json();if(data.token&&data.catalog&&Array.isArray(data.trash)){curator=data;cases=data.catalog.cases;render();if(activeId)syncViewer({refresh:true});}}
}catch { /* Read-only gallery remains available. */ }

function reviewControl(c) {
  const box=el('details','review-control'),labels=reviewLabels(c,state.lang);
  box.append(el('summary','',t('评价与排序','Review & order')+(labels.length?` · ${labels.join(' · ')}`:'')));
  box.append(el('p','review-help',t('精选和认可的作品优先，一般的排后。两项优点可同时选择；再次点击可取消。只影响推荐排序，作品始终保留。','Featured and liked works come first; average works appear later. Select both strengths, or click again to undo. Only recommended order changes; works remain available.')));
  const controls=el('div','review-options'),status=el('p','review-status');status.setAttribute('role','status');
  for(const option of [...REVIEW_OPTIONS,{id:'later',zh:'一般，排后',en:'Show later'},{id:'reset',zh:'清除评价',en:'Clear review'}]) {
    const button=el('button','review-button',option[state.lang]);button.type='button';button.dataset.reviewOption=option.id;
    const selected=option.id==='later'?Boolean(c.review?.later):Boolean(c.review?.highlights?.includes(option.id));
    if(option.id!=='reset')button.setAttribute('aria-pressed',String(selected));
    button.addEventListener('click',()=>{
      const current=cases.find(item=>item.id===c.id)?.review || {highlights:[],later:false};
      let next={highlights:[],later:false,...(current.featured===undefined?{}:{featured:current.featured})};
      if(option.id==='later')next={...current,highlights:[],later:!current.later,featured:false};
      else if(option.id!=='reset')next={...current,later:false,highlights:current.highlights.includes(option.id)?current.highlights.filter(id=>id!==option.id):[...current.highlights,option.id]};
      mutate('review',c.id,button,status,next);
    });controls.append(button);
  }
  box.append(controls,status);return box;
}
