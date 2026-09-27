import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendedCases,relatedCases,readState,stateUrl,selectCases} from '../assets/gallery-model.mjs';

test('分类推荐尊重人工评价，不跨类别，不把推荐变成精选，且不改动源数据',()=>{
  const row=(id,stage,bookmarks,review,category='短动效')=>({id,stage,category,metrics:{bookmarks},review});
  const input=[row('1','discovery',100),row('2','catalogued',null),row('3','catalogued',0),row('4','discovery',1,{highlights:[],later:false,featured:true}),row('5','catalogued',10000,{highlights:[],later:true}),row('6','catalogued',200,undefined,'产品宣传')];
  const before=structuredClone(input);
  assert.deepEqual(recommendedCases(input,'短动效').map(c=>c.id),['4','3','2']);
  assert.deepEqual(recommendedCases(input,'短动效',10).map(c=>c.id),['4','3','2','1']);
  assert.deepEqual(recommendedCases(input,'不存在'),[]);
  assert.deepEqual(input,before);
});
test('同类相关推荐排除当前作品，返回列表仍保留组合筛选',()=>{
  const row=(id,category,prompt,duration)=>({id,category,title:'动效作品',author:{handle:id},source:{publishedAt:'2026-01-01'},prompt:{status:prompt},media:{durationSeconds:duration}});
  const input=[row('1','短动效','original',20),row('2','短动效','original',25),row('3','短动效','brief',60),row('4','短动效','unknown',100),row('5','产品宣传','original',20)];
  assert.deepEqual(relatedCases(input,input[0]).map(c=>c.id),['2','3','4']);
  const list={...readState('https://example.com/'),category:'motion',duration:'short',prompt:'original',query:'动效'};
  const listUrl=stateUrl(list,'https://example.com/gallery/');
  const detailUrl=stateUrl({...list,caseId:'1'},listUrl);
  assert.deepEqual(selectCases(input,readState(listUrl)).map(c=>c.id),['1','2']);
  assert.deepEqual(readState(detailUrl),{...list,caseId:'1'});
  assert.deepEqual(selectCases(input,readState(listUrl)).map(c=>c.id),['1','2']);
});
