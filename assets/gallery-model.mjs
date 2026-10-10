export const CATEGORIES = [
  {id:'all', zh:'全部作品', en:'All works'},
  {id:'product', source:'产品宣传', zh:'产品宣传', en:'Product films'},
  {id:'education', source:'知识讲解', zh:'知识讲解', en:'Explainers'},
  {id:'motion', source:'短动效', zh:'短动效', en:'Motion design'},
  {id:'characters', source:'像素与角色', zh:'角色动画', en:'Character animation'},
  {id:'interactive', source:'3D 与交互', zh:'交互演示', en:'Interactive demos'},
  {id:'stories', source:'叙事短片', zh:'叙事短片', en:'Storytelling'},
  {id:'music', source:'音乐与歌词', zh:'音乐与歌词', en:'Music & lyrics'},
];
export const FEATURED = ['2103918792845963545','2103315922098470926','2102583898865873225','2103099194693271874','2103116235009347650'];
export const isFeatured = item => !item.review?.later && (item.review?.featured ?? FEATURED.includes(item.id));
export const stageOf = item => item.stage === 'discovery' ? 'discovery' : 'catalogued';
export const PAGE_SIZE = 36;
export const pageCases = (items, limit = PAGE_SIZE) => ({visible:items.slice(0,limit),remaining:Math.max(0,items.length-limit)});
export const categoryOf = item => CATEGORIES.find(c => c.source === item.category)?.id || 'all';
export function safeUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function resourceLinks(item) {
  const links=(Array.isArray(item.resources)?item.resources:[]).filter(r=>r&&['code','demo','tool'].includes(r.kind)&&safeUrl(r.url));
  const legacy=[{kind:'demo',url:item.demoUrl,label:'交互体验',labelEn:'Interactive demo'},{kind:'code',url:item.codeUrl,label:'作者源码',labelEn:'Creator’s source code'}];
  return [...links,...legacy.filter(r=>safeUrl(r.url)&&!links.some(link=>link.url===r.url))];
}
export const resourceLabel = (kind,lang='zh') => ({code:['直接源码','Direct source'],demo:['公开网页','Public web page'],tool:['相关工具','Related tool']}[kind]?.[lang==='en'?1:0] || '');
export function coverPath(value) { return /^assets\/covers\/[\w-]+\.(?:jpg|jpeg|png|webp)$/.test(value || '') ? value : ''; }
export function playbackUrl(item) {
  const value = safeUrl(item.webPlayback?.url);
  return item.webPlayback?.kind === 'external_source_video' && /^https:\/\/video\.twimg\.com\/.+\.mp4(?:\?.*)?$/.test(value) ? value : '';
}
export function tagsOf(item, lang = 'zh') {
  const title = `${item.title || ''} ${item.titleEn || ''}`;
  const rules = [[/像素|pixel/i, '像素', 'Pixel'], [/线稿|line art/i, '线稿', 'Line art'], [/3D/i, '3D', '3D'], [/丙烯|acrylic/i, '丙烯', 'Acrylic']];
  return rules.filter(([pattern]) => pattern.test(title)).map(rule => rule[lang === 'en' ? 2 : 1]);
}
export function readState(input) {
  const url = input instanceof URL ? input : new URL(input, 'https://gallery.local');
  const p = url.searchParams;
  // Every entry opens the usable collection; legacy homepage links remain valid.
  return {resource:['any','code','demo','both','tool'].includes(p.get('resource'))?p.get('resource'):'all',page:'all', category:CATEGORIES.some(c => c.id === p.get('category')) ? p.get('category') : 'all', query:p.get('q') || '', sort:['featured','latest','bookmarks'].includes(p.get('sort')) ? p.get('sort') : 'bookmarks', playable:p.get('playable') === '1', duration:['short','medium','long'].includes(p.get('duration')) ? p.get('duration') : 'all', prompt:['original','brief','unknown'].includes(p.get('prompt')) ? p.get('prompt') : 'all', lang:p.get('lang') === 'en' ? 'en' : 'zh', caseId:/^#case-\d+$/.test(url.hash) ? url.hash.slice(6) : null};
}
export function stateUrl(state, base) {
  const url = new URL(base);
  for (const key of ['page','category','q','sort','playable','view','duration','prompt','resource','lang']) url.searchParams.delete(key);
  if (state.category !== 'all') url.searchParams.set('category', state.category);
  if (state.query) url.searchParams.set('q', state.query);
  if (state.sort && state.sort !== 'bookmarks') url.searchParams.set('sort', state.sort);
  if (state.playable) url.searchParams.set('playable', '1');
  if (state.duration && state.duration !== 'all') url.searchParams.set('duration', state.duration);
  if (state.prompt && state.prompt !== 'all') url.searchParams.set('prompt', state.prompt);
  if (state.resource && state.resource !== 'all') url.searchParams.set('resource', state.resource);
  if (state.lang === 'en') url.searchParams.set('lang', 'en');
  url.hash = state.caseId ? `case-${state.caseId}` : '';
  return url;
}
export function matches(item, state, ignoreCategory = false) {
  if (!ignoreCategory && state.category !== 'all' && categoryOf(item) !== state.category) return false;
  if (state.prompt && state.prompt !== 'all' && item.prompt?.status !== state.prompt) return false;
  if (state.resource && state.resource !== 'all') {
    const kinds=resourceLinks(item).map(r=>r.kind);
    if (state.resource==='both' ? !['code','demo'].every(kind=>kinds.includes(kind)) : !kinds.some(kind=>state.resource==='any' ? kind==='code'||kind==='demo' : kind===state.resource)) return false;
  }
  const seconds=item.media?.durationSeconds;
  if (state.duration && state.duration !== 'all' && (!Number.isFinite(seconds) || seconds < 0 || (state.duration === 'short' ? seconds > 30 : state.duration === 'medium' ? seconds <= 30 || seconds > 120 : seconds <= 120))) return false;
  if (state.playable && !playbackUrl(item)) return false;
  if(!state.query.trim())return true;
  const fields = [item.title,item.titleEn,item.summary,item.summaryEn,item.author?.name,item.author?.handle,item.category,...resourceLinks(item).flatMap(r=>[r.label,r.labelEn,r.url]),...tagsOf(item,'zh'),...tagsOf(item,'en'),CATEGORIES.find(c=>c.id===categoryOf(item))?.en].join(' ').toLocaleLowerCase();
  return state.query.trim().toLocaleLowerCase().split(/\s+/).every(term => fields.includes(term));
}
const stamp = item => Date.parse(item.source?.publishedAt) || 0;
const bookmarks = item => Number.isFinite(item.metrics?.bookmarks) ? item.metrics.bookmarks : -1;
const byBookmarks = (a,b) => bookmarks(b)-bookmarks(a) || stamp(b)-stamp(a) || a.id.localeCompare(b.id);
export function selectCases(cases, state) {
  const rank = item => isFeatured(item) ? (FEATURED.includes(item.id) ? FEATURED.indexOf(item.id) : FEATURED.length) : FEATURED.length+1;
  return cases.filter(item => matches(item,state)).sort((a,b) => {
    if (state.sort === 'featured') { const preference=reviewRank(b)-reviewRank(a);if(preference)return preference;const diff = rank(a)-rank(b); if(diff) return diff; }
    if (state.sort === 'bookmarks') return byBookmarks(a,b);
    return stamp(b)-stamp(a) || a.id.localeCompare(b.id);
  });
}
export function detailNeighbors(cases, state) {
  const items=selectCases(cases,state), index=items.findIndex(item=>item.id===state.caseId);
  return {total:items.length,index,previous:index>0?items[index-1]:null,next:index>=0&&index<items.length-1?items[index+1]:null};
}
export function categoryCounts(cases, state) {
  const counts = Object.fromEntries(CATEGORIES.map(c => [c.id,0]));
  for(const item of cases.filter(item=>matches(item,state,true))) { counts.all++; const id=categoryOf(item); if(id!=='all') counts[id]++; }
  return counts;
}
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;
}

export const REVIEW_OPTIONS = [
  {id:'motion',zh:'动效很酷',en:'Great motion'},
  {id:'overall',zh:'整体优秀',en:'Excellent overall'},
];
export function validReview(review) {
  return review && typeof review==='object' && !Array.isArray(review) &&
    Object.keys(review).every(key=>['highlights','later','featured'].includes(key)) &&
    (review.featured===undefined || typeof review.featured==='boolean') &&
    typeof review.later==='boolean' && Array.isArray(review.highlights) &&
    review.highlights.every(id=>REVIEW_OPTIONS.some(option=>option.id===id)) &&
    new Set(review.highlights).size===review.highlights.length &&
    !(review.later && (review.highlights.length || review.featured===true));
}
export const reviewRank = item => item.review?.later ? -1 : isFeatured(item) ? 2 : item.review?.highlights?.length ? 1 : 0;
export function reviewLabels(item,lang='zh') {
  if(item.review?.later)return [lang==='en'?'Show later':'一般，排后'];
  return [...(item.review?.featured===true ? [lang==='en'?'Featured':'精选'] : []),...REVIEW_OPTIONS.filter(option=>item.review?.highlights?.includes(option.id)).map(option=>option[lang])];
}


// Editorial recommendations stay available; homepage previews choose bookmark order.
export function recommendedCases(items, source, limit=3, sort='featured') {
  if(sort==='bookmarks')return items.filter(c=>c.category===source).sort(byBookmarks).slice(0,limit);
  return items.filter(c=>c.category===source&&!c.review?.later).sort((a,b)=>
    reviewRank(b)-reviewRank(a) || (stageOf(a)==='catalogued'?0:1)-(stageOf(b)==='catalogued'?0:1) ||
    bookmarks(b)-bookmarks(a) || a.id.localeCompare(b.id)).slice(0,limit);
}

// Homepage order follows public bookmark snapshots, independent of editorial review.
export function introCases(items, limit=6) {
  return items.filter(item=>categoryOf(item)!=='all' && coverPath(item.cover?.path) && safeUrl(item.source?.url)).sort(byBookmarks).slice(0,limit);
}

export function relatedCases(items, current, limit=3) {
  return recommendedCases(items.filter(item=>item.id!==current.id),current.category,limit);
}
