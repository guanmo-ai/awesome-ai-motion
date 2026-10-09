import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildOutputs,validateCatalog} from '../scripts/build.mjs';

const catalog=JSON.parse(fs.readFileSync(new URL('../data/cases.json',import.meta.url),'utf8'));
const sample=()=>({...structuredClone(catalog),cases:[structuredClone(catalog.cases[0])]});

test('覆盖统计随增删、提示词与视听评价变化，保存内容参与生成一致性检查',()=>{
  const data=sample(),item=data.cases[0];
  item.stage='discovery';item.prompt={...item.prompt,status:'original',display:'source_link',text:''};
  delete item.prompt.translationZh;delete item.webPlayback;item.verification.fullReview=false;
  let body=buildOutputs(data).get('docs/COVERAGE.md');
  assert.match(body,/公开案例 \| 1/);assert.match(body,/原帖媒体入口 \| 0/);
  assert.match(body,/发现池 \| 1/);assert.match(body,/公开提示词 \| 1/);assert.match(body,/其中 1 条仅链接原文/);
  assert.match(body,/0 个作品标为已完成/);
  item.stage='catalogued';item.verification.fullReview=true;
  body=buildOutputs(data).get('docs/COVERAGE.md');
  assert.match(body,/已编目 \| 1/);assert.match(body,/1 个作品标为已完成/);
  data.cases=[];assert.match(buildOutputs(data).get('docs/COVERAGE.md'),/公开案例 \| 0/);
  assert.equal(fs.readFileSync(new URL('../docs/COVERAGE.md',import.meta.url),'utf8'),buildOutputs(catalog).get('docs/COVERAGE.md'));
});

test('编目阶段可接受有作者来源依据的其他模型，缺失依据仍拒绝',()=>{
  for(const name of ['Seedance 2.5','GPT-6 Astra','Ling-3.1-flash']) {
    const data=sample(),item=data.cases[0];
    item.stage='catalogued';item.model.name=name;item.model.evidenceQuote=`Created with ${name}`;
    assert.deepEqual(validateCatalog(data),[],name);
    item.model.evidenceQuote='';assert.ok(validateCatalog(data).some(e=>e.includes('模型')));
  }
});

test('异常字段不能伪装成已核验，校验返回错误而非崩溃',()=>{
  const changes=[{source:{url:12}},{model:{name:12}},{prompt:{text:12}},{media:{durationSeconds:-1}},{media:{videoCount:0}},{verification:{videoAttachmentConfirmed:'false'}},{verification:{authorClaimConfirmed:'false'}},{source:{publishedAt:'invalid'}},{title:12},{media:null}];
  for(const change of changes) {
    const data=sample(),item=data.cases[0];item.stage='discovery';item.verification.authorClaimConfirmed=true;
    for(const [key,value] of Object.entries(change))item[key]=value&&typeof value==='object'?{...item[key],...value}:value;
    assert.ok(validateCatalog(data).length,JSON.stringify(change));
  }
  for(const cases of [[null],[12],[[]]])assert.ok(validateCatalog({...sample(),cases}).length);
  for(const value of [null,12,[]])assert.ok(validateCatalog(value).length);
});

test('媒体地址中的非标准端口和片段不能通过构建校验',()=>{
  for(const url of ['https://video.twimg.com:444/source/video.mp4','https://video.twimg.com/source/video.mp4#fragment']) {
    const data=sample();data.cases[0].webPlayback.url=url;
    assert.ok(validateCatalog(data).some(e=>e.includes('原媒体地址')));
  }
});

test('不同帖子引用同一媒体，即使换码率或查询参数也拒绝重复收录',()=>{
  const data=structuredClone(catalog);data.cases=data.cases.filter(c=>c.webPlayback).slice(0,2);
  data.cases[1].webPlayback.url=data.cases[0].webPlayback.url.replace(/\?.*$/,'')+'?tag=99';
  assert.ok(validateCatalog(data).some(e=>e.includes('重复作品媒体')));
});
