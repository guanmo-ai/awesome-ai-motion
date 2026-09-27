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
export function curationCounts(items) {
  return {all:items.length,featured:items.filter(isFeatured).length,catalogued:items.filter(item=>stageOf(item)==='catalogued').length,discovery:items.filter(item=>stageOf(item)==='discovery').length};
}
export const categoryOf = item => CATEGORIES.find(c => c.source === item.category)?.id || 'all';
export function safeUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
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
  return {category:CATEGORIES.some(c => c.id === p.get('category')) ? p.get('category') : 'all', query:p.get('q') || '', sort:['featured','latest','bookmarks'].includes(p.get('sort')) ? p.get('sort') : 'featured', playable:p.get('playable') === '1', view:['featured','catalogued','discovery'].includes(p.get('view')) ? p.get('view') : 'all', duration:['short','medium','long'].includes(p.get('duration')) ? p.get('duration') : 'all', prompt:['original','brief','unknown'].includes(p.get('prompt')) ? p.get('prompt') : 'all', lang:p.get('lang') === 'en' ? 'en' : 'zh', caseId:/^#case-\d+$/.test(url.hash) ? url.hash.slice(6) : null};
}
export function stateUrl(state, base) {
  const url = new URL(base);
  for (const key of ['category','q','sort','playable','view','duration','prompt','lang']) url.searchParams.delete(key);
  if (state.category !== 'all') url.searchParams.set('category', state.category);
  if (state.query) url.searchParams.set('q', state.query);
  if (state.sort !== 'featured') url.searchParams.set('sort', state.sort);
  if (state.playable) url.searchParams.set('playable', '1');
  if (state.view && state.view !== 'all') url.searchParams.set('view', state.view);
  if (state.duration && state.duration !== 'all') url.searchParams.set('duration', state.duration);
  if (state.prompt && state.prompt !== 'all') url.searchParams.set('prompt', state.prompt);
  if (state.lang === 'en') url.searchParams.set('lang', 'en');
  url.hash = state.caseId ? `case-${state.caseId}` : '';
  return url;
}
export function matches(item, state, ignoreCategory = false) {
  if (!ignoreCategory && state.category !== 'all' && categoryOf(item) !== state.category) return false;
  if (state.view === 'featured' && !isFeatured(item)) return false;
  if (['catalogued','discovery'].includes(state.view) && stageOf(item) !== state.view) return false;
  if (state.prompt && state.prompt !== 'all' && item.prompt?.status !== state.prompt) return false;
  const seconds=item.media?.durationSeconds;
  if (state.duration && state.duration !== 'all' && (!Number.isFinite(seconds) || seconds < 0 || (state.duration === 'short' ? seconds > 30 : state.duration === 'medium' ? seconds <= 30 || seconds > 120 : seconds <= 120))) return false;
  if (state.playable && !playbackUrl(item)) return false;
  const fields = [item.title,item.titleEn,item.summary,item.summaryEn,item.author?.name,item.author?.handle,item.category,...tagsOf(item,'zh'),...tagsOf(item,'en'),CATEGORIES.find(c=>c.id===categoryOf(item))?.en].join(' ').toLocaleLowerCase();
  return state.query.trim().toLocaleLowerCase().split(/\s+/).every(term => fields.includes(term));
}
const stamp = item => Date.parse(item.source?.publishedAt) || 0;
const bookmarks = item => Number.isFinite(item.metrics?.bookmarks) ? item.metrics.bookmarks : -1;
export function selectCases(cases, state) {
  const rank = item => isFeatured(item) ? (FEATURED.includes(item.id) ? FEATURED.indexOf(item.id) : FEATURED.length) : FEATURED.length+1;
  return cases.filter(item => matches(item,state)).sort((a,b) => {
    if (state.sort === 'featured') { const preference=reviewRank(b)-reviewRank(a);if(preference)return preference;const diff = rank(a)-rank(b); if(diff) return diff; }
    if (state.sort === 'bookmarks') { const diff = bookmarks(b)-bookmarks(a); if(diff) return diff; }
    return stamp(b)-stamp(a) || a.id.localeCompare(b.id);
  });
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


// Category entry points prefer existing curation, then catalogued works and source snapshots.
export function recommendedCases(items, source, limit=3) {
  return items.filter(c=>c.category===source&&!c.review?.later).sort((a,b)=>
    reviewRank(b)-reviewRank(a) || (stageOf(a)==='catalogued'?0:1)-(stageOf(b)==='catalogued'?0:1) ||
    bookmarks(b)-bookmarks(a) || a.id.localeCompare(b.id)).slice(0,limit);
}

// A cross-category route into the collection. This is independent of featured
// status and does not imply a complete audiovisual review.
const INTRO_ROUTE=['2103502614134718609','2103099194693271874','2102786378282987591','2103757767727255661','2102801274173587569','2103746671591256286'];
export function introCases(items, limit=6) {
  const eligible=items.filter(item=>!item.review?.later && categoryOf(item)!=='all' && coverPath(item.cover?.path) && safeUrl(item.source?.url));
  const priority=item=>stageOf(item)==='catalogued'?(item.guide?3:2):(item.guide?1:0);
  const route=item=>INTRO_ROUTE.includes(item.id)?INTRO_ROUTE.indexOf(item.id):INTRO_ROUTE.length;
  const ordered=eligible.sort((a,b)=>
    route(a)-route(b) ||
    priority(b)-priority(a) ||
    bookmarks(b)-bookmarks(a) || String(a.id).localeCompare(String(b.id)));
  const chosen=[],usedIds=new Set(),authors=new Set(),categories=new Set();
  const add=item=>{chosen.push(item);usedIds.add(item.id);authors.add(item.author?.handle?.toLowerCase());categories.add(categoryOf(item));};
  for(const item of ordered) if(chosen.length<limit && !categories.has(categoryOf(item)) && !authors.has(item.author?.handle?.toLowerCase())) add(item);
  for(const item of ordered) if(chosen.length<limit && !usedIds.has(item.id) && !authors.has(item.author?.handle?.toLowerCase())) add(item);
  for(const item of ordered) if(chosen.length<limit && !usedIds.has(item.id)) add(item);
  return chosen;
}

export function relatedCases(items, current, limit=3) {
  return recommendedCases(items.filter(item=>item.id!==current.id),current.category,limit);
}
