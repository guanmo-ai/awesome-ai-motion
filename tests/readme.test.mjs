import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readState} from '../assets/gallery-model.mjs';
import {spotlightCases,catalogStats,buildOutputs} from '../scripts/build.mjs';

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

const row=(id,bookmarks,publishedAt='2026-10-12T00:00:00Z')=>({id,metrics:{bookmarks},source:{url:`https://x.com/creator/status/${id}`,publishedAt},cover:{path:`assets/covers/${id}.jpg`}});

test('README 综合排序在同收藏时优先较新作品，同日期时优先高收藏，保留高收藏旧作',()=>{
  const rows=[row('1',100,'2026-09-28T00:00:00Z'),row('2',100),row('3',1000,'2026-09-28T00:00:00Z'),row('4',10)];
  const before=structuredClone(rows);
  assert.deepEqual(spotlightCases(rows).map(c=>c.id),['3','2','1','4']);
  assert.deepEqual(spotlightCases([...rows].reverse()).map(c=>c.id),['3','2','1','4']);
  assert.deepEqual(spotlightCases(rows,2).map(c=>c.id),['3','2']);
  assert.deepEqual(rows,before);
});

test('README 排序把未知收藏放在已知零之后，缺失日期排后，相同分数稳定排序',()=>{
  const rows=[row('2',0),row('1',0),row('3',null),row('4',undefined),row('5',0,'invalid')];
  assert.deepEqual(spotlightCases(rows).map(c=>c.id),['1','2','5','3','4']);
  assert.deepEqual(spotlightCases([]),[]);
});

test('README 拼接墙和热门卡片排除指定水面作品、排后或取消精选作品及无效来源，不改变评价',()=>{
  const rows=[row('1',100),row('2',90),row('3',80),row('4',70),row('5',60),row('2102786378282987591',100000)];
  rows[1].review={featured:false,highlights:[],later:false};
  rows[2].review={highlights:[],later:true};
  rows[3].cover.path='invalid';
  rows[4].source.url='javascript:alert(1)';
  const before=structuredClone(rows);
  assert.deepEqual(spotlightCases(rows,60).map(c=>c.id),['1']);
  assert.deepEqual(rows,before);
  assert.deepEqual(spotlightCases(rows.filter(c=>c.id!=='1')),[]);
});

test('双语拼接墙由一百六十个等尺寸封面组成单张 SVG，卡片仅有观看与原帖操作',()=>{
  const outputs=buildOutputs(catalog),ranked=spotlightCases(catalog.cases,160);
  const mosaic=outputs.get('assets/readme-covers/mosaic.svg');
  assert.ok(mosaic.includes('width="5120" height="1800" viewBox="0 0 5120 1800"'));
  const tiles=[...mosaic.matchAll(/<image id="case-(\d+)" x="(\d+)" y="(\d+)" width="320" height="180" preserveAspectRatio="xMidYMid slice" href="data:image\/jpeg;base64,([^"]+)"\/>/g)];
  assert.equal(tiles.length,160);
  assert.equal(new Set(tiles.map(m=>m[1])).size,160);
  assert.deepEqual(tiles.map(m=>m[1]),ranked.map(c=>c.id));
  for(const [index,tile] of tiles.entries()) {
    assert.equal(Number(tile[2]),index%16*320);
    assert.equal(Number(tile[3]),Math.floor(index/16)*180);
    assert.deepEqual(Buffer.from(tile[4],'base64'),fs.readFileSync(new URL('../'+ranked[index].cover.path,import.meta.url)));
  }
  assert.equal([...mosaic.matchAll(/href="/g)].length,160,'每张封面直接内嵌，不依赖外部资源');
  assert.doesNotMatch(mosaic,/<(?:a|script|foreignObject)\b|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
  for(const item of ranked.slice(0,6)) {
    const framed=outputs.get(`assets/readme-covers/${item.id}.svg`);
    assert.ok(framed.includes('width="320" height="180" viewBox="0 0 320 180"'));
    assert.ok(framed.includes('preserveAspectRatio="xMidYMid slice"'),'居中裁切，不能拉伸画面');
    assert.deepEqual(Buffer.from(framed.match(/data:image\/jpeg;base64,([^"]+)/)[1],'base64'),fs.readFileSync(new URL('../'+item.cover.path,import.meta.url)),'只改变画框，不改原图');
  }
  for(const en of [false,true]) {
    const readme=outputs.get(`README${en?'.en':''}.md`);
    const wall=readme.split('<a id="mosaic"></a>')[1].split('<a id="spotlights"></a>')[0];
    assert.ok(wall.includes(`${catalog.cases.length} ${en?'works':'个作品'}`));
    assert.equal([...wall.matchAll(/<img /g)].length,1,'单张 SVG 避免文字行高造成窄屏白缝');
    assert.ok(wall.includes(`<a href="https://guanmo-ai.github.io/awesome-ai-motion/${en?'?lang=en':''}"><img src="assets/readme-covers/mosaic.svg" width="100%"`));
    assert.ok(wall.includes(en?'Click the mosaic to open the gallery':'点击拼图进入画廊'));
    assert.doesNotMatch(wall,/<br\b|align="(?:left|top)"/);
    const cards=readme.split('<a id="spotlights"></a>')[1].split('<a id="browse"></a>')[0];
    assert.deepEqual([...cards.matchAll(/<img src="assets\/readme-covers\/(\d+)\.svg"/g)].map(m=>m[1]),ranked.slice(0,6).map(c=>c.id));
    for(const item of ranked.slice(0,6)) {
      assert.ok(cards.includes(item.source.url));
      assert.ok(cards.includes(item.author.url));
    }
    assert.ok(!cards.includes('href="cases/'));
    assert.ok(!cards.match(/>(?:提示词|源码|体验|Prompt|Source|Demo)<\/a>/));
    assert.equal([...cards.matchAll(new RegExp(`>${en?'Original':'原帖'}</a>`,'g'))].length,6);
    for(const m of cards.matchAll(/href="(https:\/\/guanmo-ai\.github\.io\/awesome-ai-motion\/[^"]*)"/g)) {
      const state=readState(m[1]);
      assert.equal(state.lang,en?'en':'zh');
      assert.ok(state.caseId);
    }
    assert.ok(!readme.includes('?resource=code'));
    assert.ok(!readme.includes('?prompt=original'));
  }
});

test('目录删除或排后会同步移出拼接墙与热门卡片，后续作品自动补位',()=>{
  const first=spotlightCases(catalog.cases)[0].id;
  for(const change of ['remove','later','unfeature']) {
    const copy=structuredClone(catalog);
    if(change==='remove')copy.cases=copy.cases.filter(c=>c.id!==first);
    else {
      const item=copy.cases.find(c=>c.id===first);
      item.review={...item.review,...(change==='later'?{later:true}:{featured:false})};
    }
    for(const en of [false,true]) {
      const outputs=buildOutputs(copy);
      const intro=outputs.get(`README${en?'.en':''}.md`).split('<a id="browse"></a>')[0];
      assert.ok(!intro.includes(`assets/readme-covers/${first}.svg`));
      assert.equal([...intro.matchAll(/<img /g)].length,7);
      const mosaic=outputs.get('assets/readme-covers/mosaic.svg');
      assert.ok(!mosaic.includes(`id="case-${first}"`));
      assert.equal([...mosaic.matchAll(/<image /g)].length,160);
    }
  }
});
