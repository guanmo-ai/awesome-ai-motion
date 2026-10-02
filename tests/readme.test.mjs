import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resourceLinks,readState} from '../assets/gallery-model.mjs';
import {README_SPOTLIGHTS,spotlightCases,catalogStats,sourceCases,buildOutputs} from '../scripts/build.mjs';

const catalog=JSON.parse(fs.readFileSync(new URL('../data/cases.json',import.meta.url),'utf8'));
const resource=(kind,url='https://example.com/source')=>({kind,url});

test('README 统计按作品计数，不把演示、工具或重复源码链接计为源码案例',()=>{
  const rows=[
    {prompt:{status:'original'},resources:[resource('code'),resource('code','https://example.com/second')]},
    {prompt:{status:'brief'},resources:[resource('demo')]},
    {prompt:{status:'unknown'},resources:[resource('tool')]},
    {prompt:{status:'original',display:'source_link'},codeUrl:'https://example.com/legacy'},
    {prompt:{status:'brief'},resources:[resource('code','javascript:alert(1)')]},
  ];
  const before=structuredClone(rows);
  assert.deepEqual(catalogStats(rows),{works:5,prompts:2,code:2});
  assert.deepEqual(rows,before);
});

test('README 导览保留编辑次序，删除或取消精选后不补入其他作品，也不改变评价',()=>{
  const rows=README_SPOTLIGHTS.map(({id})=>({id,cover:{path:`assets/covers/${id}.jpg`},source:{url:`https://x.com/creator/status/${id}`}}));
  const before=structuredClone(rows);
  assert.deepEqual(spotlightCases([...rows].reverse()).map(({item})=>item.id),rows.map(c=>c.id));
  assert.deepEqual(rows,before);
  rows[0].review={featured:false,highlights:[],later:false};
  rows[1].review={highlights:[],later:true};
  rows[2].cover.path='invalid';
  rows.pop();
  assert.deepEqual(spotlightCases(rows).map(({item})=>item.id),[rows[3].id,rows[4].id]);
  assert.deepEqual(spotlightCases([]),[]);
});

test('源码专区不混入公开网页或工具，保留收藏次序且尊重人工排后',()=>{
  const rows=[
    {id:'demo',metrics:{bookmarks:100},resources:[resource('demo')]},
    {id:'tool',metrics:{bookmarks:90},resources:[resource('tool')]},
    {id:'later',metrics:{bookmarks:80},resources:[resource('code')],review:{later:true}},
    {id:'code',metrics:{bookmarks:10},resources:[resource('code')]},
    {id:'legacy',metrics:{bookmarks:5},codeUrl:'https://example.com/legacy'},
  ];
  assert.deepEqual(sourceCases(rows).map(c=>c.id),['code','legacy']);
});

test('双语 README 导览及统计一致，入口带正确筛选和语言，不为缺失资源补链接',()=>{
  const outputs=buildOutputs(catalog),stats=catalogStats(catalog.cases),spotlights=spotlightCases(catalog.cases);
  for(const en of [false,true]) {
    const readme=outputs.get(`README${en?'.en':''}.md`);
    const hero=readme.split('<a id="browse">')[0];
    for(const n of Object.values(stats))assert.ok(hero.includes(String(n)));
    const links=[...hero.matchAll(/\]\((https:\/\/guanmo-ai\.github\.io\/awesome-ai-motion\/[^)]*)\)/g)].map(m=>readState(m[1]));
    assert.ok(links.some(s=>s.resource==='code'&&s.lang===(en?'en':'zh')));
    assert.ok(links.some(s=>s.prompt==='original'&&s.lang===(en?'en':'zh')));
    const section=readme.split('<a id="spotlights"></a>')[1].split('<a id="source-code">')[0];
    assert.deepEqual([...section.matchAll(/<img src="assets\/covers\/(\d+)\.jpg"/g)].map(m=>m[1]),spotlights.map(({item})=>item.id));
    for(const {item,note} of spotlights) {
      assert.ok(section.includes(note[en?'en':'zh']));
      for(const r of resourceLinks(item).filter(r=>r.kind==='code'))assert.ok(section.includes(r.url));
    }
    const sourceLabel=en?'Source code':'查看源码';
    assert.equal(section.split(`>${sourceLabel} ↗</a>`).length-1,spotlights.reduce((n,{item})=>n+resourceLinks(item).filter(r=>r.kind==='code').length,0));
    assert.ok(readme.indexOf('id="spotlights"')<readme.indexOf(en?'## Most bookmarked':'## 收藏最多'));
  }
});
