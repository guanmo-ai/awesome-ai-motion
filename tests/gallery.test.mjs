import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CATEGORIES,FEATURED,isFeatured,stageOf,PAGE_SIZE,pageCases,reviewRank,validReview,categoryOf,safeUrl,coverPath,playbackUrl,tagsOf,readState,stateUrl,selectCases,categoryCounts,formatDuration,introCases} from '../assets/gallery-model.mjs';
const {cases}=JSON.parse(fs.readFileSync(new URL('../data/cases.json',import.meta.url)));
const defaults=readState('https://example.com/gallery/');
test('默认按收藏排序，分享链接省略默认值并保留显式精选',()=>{
  assert.equal(defaults.sort,'bookmarks');
  const defaultUrl=stateUrl(defaults,'https://example.com/gallery/?sort=featured&unrelated=keep');
  assert.equal(defaultUrl.searchParams.has('sort'),false);
  assert.equal(defaultUrl.searchParams.get('unrelated'),'keep');
  assert.deepEqual(readState(defaultUrl),defaults);
  const featuredUrl=stateUrl({...defaults,page:'all',sort:'featured'},defaultUrl);
  assert.equal(featuredUrl.searchParams.get('sort'),'featured');
  assert.deepEqual(readState(featuredUrl),{...defaults,page:'all',sort:'featured'});
});
test('all works including briefs are discoverable by use, without changing source data',()=>{
  assert.equal(selectCases(cases,defaults).length,cases.length);
  const briefs=cases.filter(c=>c.prompt.status==='brief');
  for(const c of cases){assert.notEqual(categoryOf(c),'all');assert.ok(selectCases(cases,{...defaults,category:categoryOf(c)}).includes(c));}
  assert.equal(CATEGORIES.length,8);
});
test('featured IDs lead the gallery in curated order and sorting never mutates catalog',()=>{
  const unrated=cases.map(({review,...item})=>item),order=cases.map(c=>c.id),featured=FEATURED.filter(id=>order.includes(id));assert.deepEqual(selectCases(unrated,{...defaults,sort:'featured'}).slice(0,featured.length).map(c=>c.id),featured);assert.deepEqual(cases.map(c=>c.id),order);
});
test('filters combine category, multilingual search and supported playback; counts share filters',()=>{
  if(!cases.length)return;
  const original=cases[0];const c={...original,webPlayback:{kind:'external_source_video',url:'https://video.twimg.com/demo/video.mp4'}};const input=[c,...cases.slice(1)];const state={...defaults,query:c.author.handle,playable:true};const selected=selectCases(input,state);assert.ok(selected.includes(c));assert.ok(selected.every(c=>playbackUrl(c)));assert.equal(categoryCounts(input,state).all,selected.length);
  assert.deepEqual(selectCases(cases,{...state,query:'NO_SUCH_WORK_987'}),[]);
  assert.equal(selectCases([{...original,title:'像素测试',titleEn:'Pixel test'}],{...defaults,query:'像素'}).length,1);
});
test('latest sorts by source timestamp; bookmarks distinguish zero from unknown',()=>{
  const mock=[{id:'1',source:{publishedAt:'2026-01-01'},metrics:{bookmarks:null}},{id:'2',source:{publishedAt:'2026-01-02'},metrics:{bookmarks:0}},{id:'3',source:{publishedAt:'2026-01-03'},metrics:{bookmarks:4}}];
  assert.deepEqual(selectCases(mock,{...defaults,sort:'bookmarks'}).map(c=>c.id),['3','2','1']);assert.deepEqual(selectCases(mock,{...defaults,sort:'latest'}).map(c=>c.id),['3','2','1']);
});
test('share URL round-trips category, duration, prompt and detail without breaking subpaths',()=>{
  const state={resource:'code',page:'all',category:'motion',query:'UI + 中文',sort:'latest',playable:true,duration:'medium',prompt:'unknown',lang:'en',caseId:'123'};const url=stateUrl(state,'https://example.com/project/?unrelated=keep');assert.equal(url.pathname,'/project/');assert.equal(url.searchParams.get('unrelated'),'keep');assert.deepEqual(readState(url),state);
  assert.deepEqual(readState('https://example.com/?category=bad&sort=bad&view=bad&duration=bad&prompt=bad&lang=bad#case-x'),defaults);
});
test('unsafe data URLs, protocols and cover traversal cannot become media sources',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,hello','http://example.com','https://u:p@example.com'])assert.equal(safeUrl(url),'');
  assert.equal(safeUrl('https://x.com/creator'),'https://x.com/creator');
  assert.equal(coverPath('assets/covers/../secrets.jpg'),'');assert.equal(coverPath('//external.test/x.jpg'),'');assert.equal(coverPath('assets/covers/123.jpg'),'assets/covers/123.jpg');
  assert.equal(playbackUrl({playback:{kind:'external_github_attachment',url:'https://evil.test/video.mp4'}}),'');assert.equal(playbackUrl({playback:{kind:'external_github_attachment',url:'https://github.com/user-attachments/assets/abc'}}),'');assert.equal(playbackUrl({webPlayback:{kind:'external_source_video',url:'https://video.twimg.com/demo/video.mp4?tag=12'}}),'https://video.twimg.com/demo/video.mp4?tag=12');
});
test('duration handles fractional minutes and missing values, tags rely on explicit title words',()=>{
  assert.equal(formatDuration(59.8),'1:00');assert.equal(formatDuration(157.593),'2:38');assert.equal(formatDuration(null),'—');assert.equal(formatDuration(0),'0:00');
  assert.deepEqual(tagsOf({title:'像素巫师',titleEn:'Pixel wizard'}),['像素']);assert.deepEqual(tagsOf({title:'产品讲解',category:'像素与角色'}),[]);
});

test('保留无 Referer 策略，避免原媒体服务拒绝独立画廊的浏览器请求',()=>{
  const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(page,/<meta\s+name="referrer"\s+content="no-referrer"\s*>/);
});

test('评价只改变显式精选排序，不改变最新和收藏排序，排后的作品仍可搜索',()=>{
  const row=(id,review,date,bookmarks)=>({id,review,title:'测试作品',source:{publishedAt:date},metrics:{bookmarks}});
  const input=[row(FEATURED[0],{highlights:[],later:true},'2026-01-03',30),row('normal',undefined,'2026-01-02',20),row('favorite',{highlights:['motion','overall'],later:false},'2026-01-01',10)];
  assert.deepEqual(selectCases(input,{...defaults,sort:'featured'}).map(c=>c.id),['favorite','normal',FEATURED[0]]);
  for(const sort of ['latest','bookmarks'])assert.deepEqual(selectCases(input,{...defaults,sort}).map(c=>c.id),[FEATURED[0],'normal','favorite']);
  assert.equal(selectCases(input,{...defaults,query:'测试作品'}).length,3);
});
test('明确精选可覆盖内置名单，取消精选保留优点评价且只改变精选排序',()=>{
  const row=(id,review,date)=>({id,review,title:'测试作品',source:{publishedAt:date},metrics:{bookmarks:0}});
  const input=[row(FEATURED[0],{highlights:[],later:false,featured:false},'2026-01-04'),row(FEATURED[1],undefined,'2026-01-03'),row('manual',{highlights:[],later:false,featured:true},'2026-01-01'),row('liked',{highlights:['motion'],later:false,featured:false},'2026-01-02')];
  assert.equal(isFeatured(input[0]),false);assert.equal(isFeatured(input[1]),true);
  assert.deepEqual(selectCases(input,{...defaults,sort:'featured'}).map(c=>c.id),[FEATURED[1],'manual','liked',FEATURED[0]]);
  assert.deepEqual(selectCases(input,{...defaults,sort:'latest'}).map(c=>c.id),[FEATURED[0],FEATURED[1],'liked','manual']);
  assert.equal(reviewRank(input[1]),2);
  assert.equal(validReview({highlights:['motion'],later:false,featured:false}),true);
  assert.equal(validReview({highlights:[],later:true,featured:true}),false);
});
test('提示词和时长筛选可组合，不按编目阶段隐藏作品，边界 30 与 120 秒准确',()=>{
  const row=(id,stage,prompt,seconds,featured)=>({id,stage,review:featured?{highlights:[],later:false,featured:true}:undefined,title:'测试作品',category:'短动效',prompt:{status:prompt},media:{durationSeconds:seconds},source:{publishedAt:'2026-01-01'},metrics:{bookmarks:0}});
  const input=[row('1',undefined,'original',30,true),row('2','discovery','unknown',31,false),row('3','discovery','brief',120,false),row('4','catalogued','unknown',121,false)];
  assert.equal(stageOf(input[0]),'catalogued');
  assert.deepEqual(selectCases(input,{...defaults,duration:'medium'}).map(c=>c.id),['2','3']);
  assert.deepEqual(selectCases(input,{...defaults,duration:'medium',prompt:'unknown'}).map(c=>c.id),['2']);
  assert.deepEqual(selectCases(input,{...defaults,duration:'short'}).map(c=>c.id),['1']);
  assert.deepEqual(selectCases(input,{...defaults,duration:'long'}).map(c=>c.id),['4']);
  assert.equal(categoryCounts(input,{...defaults,prompt:'unknown'}).motion,2);
});
test('分页首批 36 条，下一批只追加剩余项，边界不重复',()=>{
  const input=Array.from({length:73},(_,i)=>({id:String(i+1)}));
  assert.equal(PAGE_SIZE,36);
  const first=pageCases(input),second=pageCases(input,72),third=pageCases(input,108);
  assert.equal(first.visible.length,36);assert.equal(first.remaining,37);
  assert.deepEqual(second.visible.slice(36).map(c=>c.id),input.slice(36,72).map(c=>c.id));assert.equal(second.remaining,1);
  assert.equal(third.visible.length,73);assert.equal(third.remaining,0);
  assert.deepEqual(pageCases(input.slice(0,36)).visible.length,36);
});
test('访客首页按原帖收藏快照展示全库前六名，且不修改内容源',()=>{
  const before=structuredClone(cases),intro=introCases(cases);
  assert.equal(intro.length,6);
  const expected=[...cases].sort((a,b)=>(b.metrics.bookmarks??-1)-(a.metrics.bookmarks??-1)).slice(0,6);
  assert.deepEqual(intro.map(c=>c.id),expected.map(c=>c.id));
  for(const c of intro){assert.ok(coverPath(c.cover.path));assert.ok(fs.existsSync(new URL(`../${c.cover.path}`,import.meta.url)));assert.ok(safeUrl(c.source.url));}
  assert.deepEqual(cases,before);
});
test('首页收藏前六名不设作者或类别配额，人工排后仍按收藏入选，未知值排在零之后',()=>{
  const row=(id,bookmarks,review)=>({id,category:'短动效',author:{handle:'same-author'},review,cover:{path:`assets/covers/${id}.jpg`},source:{url:`https://x.com/same-author/status/${id}`},metrics:{bookmarks}});
  const rows=[row('low',1,{highlights:[],later:false,featured:true}),row('top',100,{highlights:[],later:true}),row('second',90),row('third',80),row('fourth',70),row('fifth',60),row('sixth',50)];
  const before=structuredClone(rows);
  assert.deepEqual(introCases(rows).map(c=>c.id),['top','second','third','fourth','fifth','sixth']);
  assert.deepEqual(introCases([row('unknown',null),row('zero',0),row('positive',2)],3).map(c=>c.id),['positive','zero','unknown']);
  assert.deepEqual(rows,before);
});
test('访客入口删除冗余操作，关注创作者与 GitHub 位于顶部导航',()=>{
  const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const script=fs.readFileSync(new URL('../assets/gallery.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(page,/id="(?:submit|manage-works|clear-filters)"/);
  assert.doesNotMatch(script,/api\/curation/);
  assert.match(page,/<nav class="header-actions"[^>]*>[\s\S]*id="follow-creator"[\s\S]*id="github"[\s\S]*id="language"/);
  assert.match(page,/<a id="follow-creator"[^>]*href="https:\/\/x\.com\/guanmo_ai"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
});
