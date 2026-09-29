import test from 'node:test';
import assert from 'node:assert/strict';
import {readState,stateUrl,selectCases,detailNeighbors} from '../assets/gallery-model.mjs';

const base='https://example.com/awesome-ai-motion/';
const defaults=readState(base);
const rows=Array.from({length:80},(_,index)=>({
  id:String(index+1), title:index===0?'only-single':'Video',
  category:index%2===0?'短动效':'知识讲解',
  metrics:{bookmarks:100-index},
  source:{publishedAt:new Date(Date.UTC(2026,0,index+1)).toISOString()},
}));

test('首页与完整目录有独立可刷新的地址，语言与深链接保留当前页面',()=>{
  assert.equal(defaults.page,'home');
  const all={...defaults,page:'all'};
  const url=stateUrl(all,base);
  assert.equal(url.searchParams.get('page'),'all');
  assert.deepEqual(readState(url),all);
  for(const page of ['home','all']){
    const state={...defaults,page,lang:'en',caseId:'123'};
    assert.deepEqual(readState(stateUrl(state,base)),state);
  }
  const homeUrl=stateUrl(defaults,url);
  assert.equal(homeUrl.searchParams.has('page'),false);
  assert.deepEqual(readState(homeUrl),defaults);
});

test('旧的分类搜索和排序链接仍打开列表，无效参数不破坏首页',()=>{
  for(const suffix of ['?category=motion','?category=all','?q=Video','?sort=latest','?view=discovery','?duration=short','?prompt=original','?playable=1'])assert.equal(readState(base+suffix).page,'all',suffix);
  assert.deepEqual(readState(base+'?page=bad&category=bad&sort=bad&view=bad&duration=bad&prompt=bad&playable=bad'),defaults);
  const queryState={...defaults,query:'Video'};
  assert.equal(readState(stateUrl(queryState,base)).page,'all');
});

test('已移除的馆藏状态不再隐藏作品，旧分享链接保留其他筛选和详情',()=>{
  const input=rows.map((row,index)=>({...row,stage:index%2?'discovery':'catalogued',review:{featured:index===0,highlights:[],later:false}}));
  for(const view of ['all','featured','catalogued','discovery']) {
    const state=readState(`${base}?view=${view}&category=motion&lang=en#case-71`);
    const selected=selectCases(input,state);
    assert.equal(state.page,'all');
    assert.equal(selected.length,40);
    assert.equal(detailNeighbors(input,state).total,40);
    const url=stateUrl(state,`${base}?view=${view}&unrelated=keep`);
    assert.equal(url.searchParams.has('view'),false);
    assert.equal(url.searchParams.get('unrelated'),'keep');
    assert.equal(url.hash,'#case-71');
    assert.deepEqual(readState(url),state);
  }
});

test('详情按完整筛选结果导航，跨过第 36 条仍有下一条',()=>{
  const state={...defaults,page:'all',category:'motion',caseId:'71'};
  const neighbors=detailNeighbors(rows,state);
  assert.equal(neighbors.total,40);
  assert.equal(neighbors.index,35);
  assert.equal(neighbors.previous.id,'69');
  assert.equal(neighbors.next.id,'73');
  const latest=detailNeighbors(rows,{...state,sort:'latest'});
  assert.equal(latest.index,4);
  assert.equal(latest.previous.id,'73');
  assert.equal(latest.next.id,'69');
});

test('首尾不循环；单个、空列表和筛选外深链接不会跳到无关作品',()=>{
  const state={...defaults,page:'all'};
  const first=detailNeighbors(rows,{...state,caseId:'1'});
  assert.equal(first.index,0);assert.equal(first.previous,null);assert.equal(first.next.id,'2');
  const last=detailNeighbors(rows,{...state,caseId:'80'});
  assert.equal(last.index,79);assert.equal(last.previous.id,'79');assert.equal(last.next,null);
  const single=detailNeighbors(rows,{...state,query:'only-single',caseId:'1'});
  assert.deepEqual(single,{total:1,index:0,previous:null,next:null});
  for(const [input,filter] of [[[],{}],[rows,{category:'motion',caseId:'2'}],[rows,{query:'missing'}]]){
    const result=detailNeighbors(input,{...state,caseId:'1',...filter});
    assert.equal(result.index,-1);assert.equal(result.previous,null);assert.equal(result.next,null);
  }
});

test('首页详情按全库收藏顺序切换，且不修改原始目录',()=>{
  const before=structuredClone(rows);
  const neighbors=detailNeighbors(rows,{...defaults,caseId:'7'});
  assert.equal(neighbors.total,80);assert.equal(neighbors.index,6);
  assert.equal(neighbors.previous.id,'6');assert.equal(neighbors.next.id,'8');
  assert.equal(selectCases(rows,{...defaults,page:'all'}).length,80);
  assert.deepEqual(rows,before);
});
