import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as model from '../assets/gallery-model.mjs';

// Run the real gallery event handlers with a small DOM and a controlled clock.
async function gallery() {
  class Node {
    constructor(){this.listeners=new Map();this.dataset={};this.style={};this.options=[];this.classList={toggle(){}};}
    addEventListener(type,listener){this.listeners.set(type,listener);}
    setAttribute(){}
    removeAttribute(){}
    replaceChildren(){}
    append(){}
    querySelector(){return null;}
    focus(){document.activeElement=this;}
    send(type,event={}){this.listeners.get(type)?.(event);}
  }
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,new Node()]));
  for(const [,id,body] of html.matchAll(/<select id="([^"]+)"[^>]*>(.*?)<\/select>/gs))nodes.get(id).options=[...body.matchAll(/<option value="([^"]+)"/g)].map(([,value])=>({value}));
  const document={getElementById:id=>nodes.get(id),createElement:()=>new Node(),querySelector:()=>new Node(),documentElement:{},body:{style:{}},addEventListener(){},activeElement:null};
  const location=new URL('https://gallery.test/?page=all');
  const timers=new Map(),windowListeners=new Map();let timerId=0;
  const history={state:null,pushState(data,_,url){this.state=data;location.href=url;},replaceState(data,_,url){this.state=data;location.href=url;}};
  const context={...model,document,location,history,Element:Node,URL,Intl,Date,console,
    window:{addEventListener:(type,listener)=>windowListeners.set(type,listener),scrollTo(){}},
    fetch:async()=>({ok:true,json:async()=>({cases:[]})}),
    setTimeout:callback=>{timers.set(++timerId,callback);return timerId;},clearTimeout:id=>timers.delete(id),
  };
  const source=fs.readFileSync(new URL('../assets/gallery.mjs',import.meta.url),'utf8').replace(/^import .*?;\n/,'');
  await vm.runInNewContext(`(async()=>{${source}\n})()`,context);
  assert.equal(nodes.get('loading').hidden,true,'真实页面初始化应成功');
  const flush=()=>{for(const [id,callback] of [...timers]){timers.delete(id);callback();}};
  const input=(value,event={})=>{nodes.get('search').value=value;nodes.get('search').send('input',event);};
  return {nodes,location,timers,flush,input,document,windowListeners};
}

test('连续搜索只应用最后一个值，Enter 立即查询且不会留下延迟更新',async()=>{
  const app=await gallery();
  app.input('U');app.input('UI');
  assert.equal(app.location.searchParams.has('q'),false);
  assert.equal(app.timers.size,1);
  app.flush();
  assert.equal(app.location.searchParams.get('q'),'UI');
  app.input('像素');app.nodes.get('search').send('keydown',{key:'Enter',isComposing:false});
  assert.equal(app.location.searchParams.get('q'),'像素');
  assert.equal(app.timers.size,0);
});

test('待应用的搜索与筛选合并，清除筛选取消延迟查询并返回搜索焦点',async()=>{
  const app=await gallery();
  app.input('UI');app.nodes.get('prompt').value='brief';app.nodes.get('prompt').send('change');
  assert.equal(app.location.searchParams.get('q'),'UI');
  assert.equal(app.location.searchParams.get('prompt'),'brief');
  assert.equal(app.timers.size,0);
  app.input('待取消');app.nodes.get('clear-filters').send('click');app.flush();
  assert.equal(app.location.searchParams.has('q'),false);
  assert.equal(app.location.searchParams.has('prompt'),false);
  assert.equal(app.nodes.get('search').value,'');
  assert.equal(app.document.activeElement,app.nodes.get('search'));
});

test('中文输入组合期间不筛选，完成后查询；浏览器返回取消待应用输入',async()=>{
  const app=await gallery(),search=app.nodes.get('search');
  app.input('old');search.send('compositionstart');app.input('拼音',{isComposing:true});
  search.send('keydown',{key:'Enter',isComposing:true});
  assert.equal(app.timers.size,0);
  assert.equal(app.location.searchParams.has('q'),false);
  search.value='动画';search.send('compositionend');app.flush();
  assert.equal(app.location.searchParams.get('q'),'动画');
  app.input('pending');app.location.href='https://gallery.test/?page=all';app.windowListeners.get('popstate')();app.flush();
  assert.equal(app.location.searchParams.has('q'),false);
  assert.equal(search.value,'');
});
