import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CATEGORIES,FEATURED,isFeatured,stageOf,curationCounts,PAGE_SIZE,pageCases,reviewRank,validReview,categoryOf,safeUrl,coverPath,playbackUrl,tagsOf,readState,stateUrl,selectCases,categoryCounts,formatDuration} from '../assets/gallery-model.mjs';
const {cases}=JSON.parse(fs.readFileSync(new URL('../data/cases.json',import.meta.url)));
const defaults=readState('https://example.com/gallery/');
test('all works including briefs are discoverable by use, without changing source data',()=>{
  assert.equal(selectCases(cases,defaults).length,cases.length);
  const briefs=cases.filter(c=>c.prompt.status==='brief');
  for(const c of cases){assert.notEqual(categoryOf(c),'all');assert.ok(selectCases(cases,{...defaults,category:categoryOf(c)}).includes(c));}
  assert.equal(CATEGORIES.length,8);
});
test('featured IDs lead the gallery in curated order and sorting never mutates catalog',()=>{
  const unrated=cases.map(({review,...item})=>item),order=cases.map(c=>c.id),featured=FEATURED.filter(id=>order.includes(id));assert.deepEqual(selectCases(unrated,defaults).slice(0,featured.length).map(c=>c.id),featured);assert.deepEqual(cases.map(c=>c.id),order);
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
test('share URL round-trips category, curation, duration, prompt and detail without breaking subpaths',()=>{
  const state={category:'motion',query:'UI + 中文',sort:'latest',playable:true,view:'discovery',duration:'medium',prompt:'unknown',lang:'en',caseId:'123'};const url=stateUrl(state,'https://example.com/project/?unrelated=keep');assert.equal(url.pathname,'/project/');assert.equal(url.searchParams.get('unrelated'),'keep');assert.deepEqual(readState(url),state);
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

test('评价覆盖默认精选权重但不改变最新和收藏排序，排后的作品仍可搜索',()=>{
  const row=(id,review,date,bookmarks)=>({id,review,title:'测试作品',source:{publishedAt:date},metrics:{bookmarks}});
  const input=[row(FEATURED[0],{highlights:[],later:true},'2026-01-03',30),row('normal',undefined,'2026-01-02',20),row('favorite',{highlights:['motion','overall'],later:false},'2026-01-01',10)];
  assert.deepEqual(selectCases(input,defaults).map(c=>c.id),['favorite','normal',FEATURED[0]]);
  for(const sort of ['latest','bookmarks'])assert.deepEqual(selectCases(input,{...defaults,sort}).map(c=>c.id),[FEATURED[0],'normal','favorite']);
  assert.equal(selectCases(input,{...defaults,query:'测试作品'}).length,3);
});
test('明确精选可覆盖内置名单，取消精选保留优点评价且只改变默认排序',()=>{
  const row=(id,review,date)=>({id,review,title:'测试作品',source:{publishedAt:date},metrics:{bookmarks:0}});
  const input=[row(FEATURED[0],{highlights:[],later:false,featured:false},'2026-01-04'),row(FEATURED[1],undefined,'2026-01-03'),row('manual',{highlights:[],later:false,featured:true},'2026-01-01'),row('liked',{highlights:['motion'],later:false,featured:false},'2026-01-02')];
  assert.equal(isFeatured(input[0]),false);assert.equal(isFeatured(input[1]),true);
  assert.deepEqual(selectCases(input,defaults).map(c=>c.id),[FEATURED[1],'manual','liked',FEATURED[0]]);
  assert.deepEqual(selectCases(input,{...defaults,sort:'latest'}).map(c=>c.id),[FEATURED[0],FEATURED[1],'liked','manual']);
  assert.equal(reviewRank(input[1]),2);
  assert.equal(validReview({highlights:['motion'],later:false,featured:false}),true);
  assert.equal(validReview({highlights:[],later:true,featured:true}),false);
});
test('策展阶段、提示词和时长筛选可组合，边界 30 与 120 秒准确',()=>{
  const row=(id,stage,prompt,seconds,featured)=>({id,stage,review:featured?{highlights:[],later:false,featured:true}:undefined,title:'测试作品',category:'短动效',prompt:{status:prompt},media:{durationSeconds:seconds},source:{publishedAt:'2026-01-01'},metrics:{bookmarks:0}});
  const input=[row('1',undefined,'original',30,true),row('2','discovery','unknown',31,false),row('3','discovery','brief',120,false),row('4','catalogued','unknown',121,false)];
  assert.equal(stageOf(input[0]),'catalogued');
  assert.deepEqual(curationCounts(input),{all:4,featured:1,catalogued:2,discovery:2});
  assert.deepEqual(selectCases(input,{...defaults,view:'featured'}).map(c=>c.id),['1']);
  assert.deepEqual(selectCases(input,{...defaults,view:'discovery',duration:'medium'}).map(c=>c.id),['2','3']);
  assert.deepEqual(selectCases(input,{...defaults,view:'discovery',duration:'medium',prompt:'unknown'}).map(c=>c.id),['2']);
  assert.deepEqual(selectCases(input,{...defaults,duration:'short'}).map(c=>c.id),['1']);
  assert.deepEqual(selectCases(input,{...defaults,duration:'long'}).map(c=>c.id),['4']);
  assert.equal(categoryCounts(input,{...defaults,view:'discovery',prompt:'unknown'}).motion,1);
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
