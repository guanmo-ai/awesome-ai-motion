import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMetrics } from '../scripts/metrics.mjs';

const item={id:'123',author:{handle:'creator'}};
const checkedAt='2026-09-27T10:00:00.000Z';
test('匿名快照只接受同一个作者、同一条作品的指标；未知仍为 null',()=>{
  const result=extractMetrics({id:'123',author:{screen_name:'Creator'},bookmarks:0,likes:2},item,checkedAt);
  assert.equal(result.bookmarks,0);
  assert.equal(result.views,null);
  assert.equal(result.checkedAt,checkedAt);
  assert.match(result.sourceUrl,/creator\/status\/123$/);
  assert.throws(()=>extractMetrics({id:'999',author:{screen_name:'creator'}},item,checkedAt),/作品/);
  assert.throws(()=>extractMetrics({id:'123',author:{screen_name:'someone_else'}},item,checkedAt),/作者/);
});
test('损坏的数字不能污染已保存的快照',()=>{
  for(const likes of [-1,'unknown',Infinity])assert.throws(()=>extractMetrics({id:'123',author:{screen_name:'creator'},likes},item,checkedAt),/指标/);
});
