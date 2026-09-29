import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resourceLinks,readState,stateUrl,selectCases,detailNeighbors} from '../assets/gallery-model.mjs';
import {buildOutputs,validateCatalog} from '../scripts/build.mjs';

const catalog=JSON.parse(fs.readFileSync(new URL('../data/cases.json',import.meta.url),'utf8'));
const resource={kind:'code',url:'https://example.com/source',label:'作品源码',labelEn:'Work source',license:'not_specified',evidenceUrl:'https://example.com/post',checkedAt:'2026-09-29T00:00:00Z'};

test('源码或网页包含直接源码与公开网页，排除仅工具，兼容旧入口并避免重复',()=>{
  const base=catalog.cases[0];
  const rows=[
    {...base,id:'1',resources:[resource],codeUrl:resource.url,demoUrl:'https://example.com/demo'},
    {...base,id:'2',resources:[{...resource,kind:'tool'}],codeUrl:undefined,demoUrl:undefined},
    {...base,id:'3',resources:undefined,codeUrl:'https://example.com/legacy',demoUrl:undefined},
    {...base,id:'4',resources:undefined,codeUrl:undefined,demoUrl:undefined},
    {...base,id:'5',resources:[{...resource,kind:'demo'}],codeUrl:undefined,demoUrl:undefined},
    {...base,id:'6',resources:undefined,codeUrl:undefined,demoUrl:'https://example.com/legacy-demo'},
    {...base,id:'7',resources:[{...resource,kind:'tool'}],codeUrl:undefined,demoUrl:'https://example.com/tool-and-demo'},
  ];
  assert.equal(resourceLinks(rows[0]).length,2);
  const ids=state=>selectCases(rows,state).map(c=>c.id).sort();
  assert.deepEqual(ids(readState('/?resource=code')),['1','3']);
  assert.deepEqual(ids(readState('/?resource=tool')),['2','7']);
  assert.deepEqual(ids(readState('/?resource=demo')),['1','5','6','7']);
  assert.deepEqual(ids(readState('/?resource=any')),['1','3','5','6','7']);
  assert.equal(detailNeighbors(rows,readState('/?resource=any'),'5').total,5);
  const state={...readState('/?resource=code&lang=en'),caseId:'1'};
  assert.deepEqual(readState(stateUrl(state,'https://example.com/')),state);
  assert.equal(detailNeighbors(rows,state,'1').total,2);
  assert.equal(readState('/?resource=invalid').resource,'all');
});

test('双语资源索引包含新旧链接，许可与出处保留在详情且名称转义',()=>{
  const copy=structuredClone(catalog),c=copy.cases[0];
  c.resources=[{...resource,label:'源码 <script>',labelEn:'Source <script>'}];
  c.demoUrl='https://example.com/legacy-demo';
  c.resources[0].license='MIT';c.resources[0].licenseUrl='https://example.com/LICENSE';
  const outputs=buildOutputs(copy);
  for(const suffix of ['','.en']){
    const index=outputs.get(`browse/resources${suffix}.md`);
    const detail=outputs.get(`cases/${c.id}${suffix}.md`);
    for(const output of [index,detail]){
      for(const url of [resource.url,resource.evidenceUrl,c.demoUrl])assert.ok(output.includes(url));
      assert.ok(!output.includes('<script>'));
      assert.ok(output.includes('[MIT](https://example.com/LICENSE)'));
    }
    assert.ok(outputs.get(`README${suffix}.md`).includes(`browse/resources${suffix}.md`));
  }
});

test('拒绝无出处、无许可、危险链接、重复资源及错误字段类型',()=>{
  const copy=structuredClone(catalog),c=copy.cases[0];
  c.resources=[resource];
  assert.deepEqual(validateCatalog(copy),[]);
  for(const invalid of [
    {kind:'download'}, {license:undefined}, {evidenceUrl:undefined},
    {url:'javascript:alert(1)'}, {url:'https://user:secret@example.com/code'},
    {evidenceUrl:'https://example.com/)(bad)'}, {checkedAt:'bad'},
    {label:42}, {labelEn:' '}, {note:'只有中文'}, {note:42,noteEn:'English'},
    {license:42}, {label:'line\nbreak'}, {licenseUrl:'javascript:alert(1)'}, {licenseUrl:'https://example.com/license'},
  ]){
    c.resources=[{...resource,...invalid}];
    assert.ok(validateCatalog(copy).some(e=>e.includes('源码资源')),JSON.stringify(invalid));
  }
  c.resources=[resource,resource];
  assert.ok(validateCatalog(copy).some(e=>e.includes('不得重复')));
});
