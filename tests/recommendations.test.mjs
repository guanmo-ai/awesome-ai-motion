import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendedCases} from '../assets/gallery-model.mjs';

test('分类推荐尊重人工评价，不跨类别，不把推荐变成精选，且不改动源数据',()=>{
  const row=(id,stage,bookmarks,review,category='短动效')=>({id,stage,category,metrics:{bookmarks},review});
  const input=[row('1','discovery',100),row('2','catalogued',null),row('3','catalogued',0),row('4','discovery',1,{highlights:[],later:false,featured:true}),row('5','catalogued',10000,{highlights:[],later:true}),row('6','catalogued',200,undefined,'产品宣传')];
  const before=structuredClone(input);
  assert.deepEqual(recommendedCases(input,'短动效').map(c=>c.id),['4','3','2']);
  assert.deepEqual(recommendedCases(input,'短动效',10).map(c=>c.id),['4','3','2','1']);
  assert.deepEqual(recommendedCases(input,'不存在'),[]);
  assert.deepEqual(input,before);
});
