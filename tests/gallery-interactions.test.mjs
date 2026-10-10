import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as model from '../assets/gallery-model.mjs';

// Run the real gallery event handlers with a small DOM and a controlled clock.
async function gallery(search='?page=all',rows=[],preferences={}) {
  class Node {
    constructor(tagName='div'){this.tagName=tagName.toUpperCase();this.paused=true;this.readyState=0;this.listeners=new Map();this.dataset={};this.style={};this.options=[];this.children=[];this.classList={toggle(){}};}
    addEventListener(type,listener){this.listeners.set(type,listener);}
    setAttribute(name,value){this[name]=String(value);}
    getAttribute(name){return this[name]??null;}
    removeAttribute(name){delete this[name];}
    replaceChildren(...children){this.children=children;}
    append(...children){this.children.push(...children);for(const child of children)child.parentElement=this;}
    contains(node){return this===node||this.children.some(child=>child.contains?.(node));}
    closest(selector){for(let node=this;node;node=node.parentElement){if(selector.split(',').includes(node.tagName.toLowerCase())||(selector.includes('[contenteditable]')&&node.isContentEditable))return node;}return null;}
    querySelector(selector){
      const id=selector.match(/data-case-id="([^"]*)"/)?.[1];
      const className=selector.match(/^\.([\w-]+)/)?.[1];
      const visit=children=>{for(const child of children){if(((className&&child.className===className)||selector===child.tagName.toLowerCase())&&(id===undefined||child.dataset.caseId===id))return child;const nested=visit(child.children||[]);if(nested)return nested;}return null;};
      return visit(this.children);
    }
    pause(){this.paused=true;}
    play(){this.paused=false;return Promise.resolve();}
    load(){}
    showModal(){this.open=true;}
    close(){this.open=false;document.activeElement=null;}
    focus(){document.activeElement=this;}
    send(type,event={}){this.listeners.get(type)?.(event);}
  }
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,new Node()]));
  nodes.get('viewer').append(nodes.get('viewer-content'));
  for(const [,id,body] of html.matchAll(/<select id="([^"]+)"[^>]*>(.*?)<\/select>/gs))nodes.get(id).options=[...body.matchAll(/<option value="([^"]+)"/g)].map(([,value])=>({value}));
  const documentListeners=new Map();
  const document={getElementById:id=>nodes.get(id),createElement:tagName=>new Node(tagName),querySelector:()=>new Node(),documentElement:{},body:{style:{}},addEventListener:(type,listener)=>documentListeners.set(type,listener),activeElement:null};
  const location=new URL(`https://gallery.test/${search}`);
  const timers=new Map(),windowListeners=new Map();let timerId=0;
  let observer;
  class IntersectionObserver {
    constructor(callback){this.callback=callback;this.targets=new Set();observer=this;}
    observe(node){this.targets.add(node);}
    disconnect(){this.targets.clear();}
    send(node,visible){this.callback([{target:node,isIntersecting:visible,intersectionRatio:visible?1:0}]);}
  }
  const history={state:null,pushState(data,_,url){this.state=data;location.href=url;},replaceState(data,_,url){this.state=data;location.href=url;}};
  const context={...model,document,location,history,Element:Node,URL,Intl,Date,console,AbortController,IntersectionObserver,
    navigator:{connection:{saveData:Boolean(preferences.saveData)}},
    window:{matchMedia:()=>({matches:Boolean(preferences.reducedMotion),addEventListener(){}}),addEventListener:(type,listener)=>windowListeners.set(type,listener),scrollTo(){}},
    fetch:async()=>({ok:true,json:async()=>({cases:rows})}),
    setTimeout:callback=>{timers.set(++timerId,callback);return timerId;},clearTimeout:id=>timers.delete(id),
  };
  const source=fs.readFileSync(new URL('../assets/gallery.mjs',import.meta.url),'utf8').replace(/^import .*?;\n/,'');
  await vm.runInNewContext(`(async()=>{${source}\n})()`,context);
  assert.equal(nodes.get('loading').hidden,true,'真实页面初始化应成功');
  const flush=()=>{for(const [id,callback] of [...timers]){timers.delete(id);callback();}};
  const input=(value,event={})=>{nodes.get('search').value=value;nodes.get('search').send('input',event);};
  return {nodes,location,timers,flush,input,document,windowListeners,documentListeners,observer};
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

test('待应用的搜索与排序合并，查看全部作品取消延迟查询并返回搜索焦点',async()=>{
  const app=await gallery();
  app.input('UI');app.nodes.get('sort').value='latest';app.nodes.get('sort').send('change');
  assert.equal(app.location.searchParams.get('q'),'UI');
  assert.equal(app.location.searchParams.get('sort'),'latest');
  assert.equal(app.timers.size,0);
  app.input('待取消');app.nodes.get('reset').send('click');app.flush();
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

test('旧手动筛选链接不再隐藏作品，保留分类和浏览器返回行为',async()=>{
  const row=(id,status,seconds)=>({id,title:'测试作品',category:'短动效',author:{handle:'maker'},prompt:{status},media:{durationSeconds:seconds}});
  const rows=[row('1','original',121),row('2','brief',15)];
  const app=await gallery('?page=all&category=motion&prompt=brief&duration=short&playable=1',rows);
  assert.equal(app.nodes.get('result-count').textContent,'2 个作品','移除的条件不能留下不可见的筛选');
  assert.equal(app.location.searchParams.get('category'),'motion');
  for(const key of ['prompt','duration','playable'])assert.equal(app.location.searchParams.has(key),false);
  assert.equal(app.nodes.has('advanced-filters'),false);
  app.location.href='https://gallery.test/?page=all&category=motion&prompt=unknown&playable=1';
  app.windowListeners.get('popstate')();
  assert.equal(app.nodes.get('result-count').textContent,'2 个作品');
  assert.equal(app.location.searchParams.has('prompt'),false);
});

test('README 的提示词和源码入口保留用途，并显示明确的集合标题',async()=>{
  const original=await gallery('?prompt=original');
  assert.equal(original.location.searchParams.get('prompt'),'original');
  assert.equal(original.nodes.get('collection-title').textContent,'提示词原文');
  const source=await gallery('?resource=code&lang=en');
  assert.equal(source.location.searchParams.get('resource'),'code');
  assert.equal(source.nodes.get('collection-title').textContent,'Source code');
});

test('旧链接同时限定源码和提示词原文时，标题说明全部集合条件',async()=>{
  const row=(id,status,kind)=>({id,title:'测试作品',category:'短动效',author:{handle:'maker'},prompt:{status},resources:[{kind,url:'https://example.com/work'}]});
  const app=await gallery('?category=motion&resource=code&prompt=original',[row('1','original','code'),row('2','brief','code'),row('3','original','demo')]);
  assert.equal(app.nodes.get('result-count').textContent,'1 个作品');
  assert.equal(app.nodes.get('collection-title').textContent,'短动效 · 作品源码 · 提示词原文');
  assert.equal(app.location.searchParams.get('resource'),'code');
  assert.equal(app.location.searchParams.get('prompt'),'original');
});

test('分享直达的详情关闭后聚焦对应作品，作品不在首批时聚焦浏览区域',async()=>{
  const sample=JSON.parse(fs.readFileSync(new URL('../data/cases.json',import.meta.url))).cases[0];
  const rows=Array.from({length:37},(_,i)=>({...sample,id:String(i+1),webPlayback:undefined,metrics:{...sample.metrics,bookmarks:1000-i}}));
  const visible=await gallery('?page=all#case-1',rows);
  assert.equal(visible.nodes.get('viewer').open,true);
  visible.nodes.get('close').send('click');
  assert.equal(visible.location.hash,'');
  assert.equal(visible.document.activeElement?.dataset.caseId,'1');
  const later=await gallery('?page=all#case-37',rows);
  later.nodes.get('close').send('click');
  assert.equal(later.document.activeElement,later.nodes.get('works'));
});

test('不存在作品的分享提示关闭后保留分类并恢复浏览焦点',async()=>{
  const app=await gallery('?category=characters#case-404');
  assert.equal(app.nodes.get('viewer').open,true);
  app.nodes.get('close').send('click');
  assert.equal(app.location.hash,'');
  assert.equal(app.location.searchParams.get('category'),'characters');
  assert.equal(app.document.activeElement,app.nodes.get('works'));
});

test('加载更多后聚焦第一张新增作品，最后一批按钮消失也不丢失焦点',async()=>{
  const rows=Array.from({length:73},(_,i)=>({id:String(i+1),title:'测试作品',category:'短动效',author:{handle:'maker'},metrics:{bookmarks:1000-i}}));
  const app=await gallery('?page=all',rows),more=app.nodes.get('load-more');
  more.focus();more.send('click');
  assert.equal(app.nodes.get('works').children.length,72);
  assert.equal(app.document.activeElement?.dataset.caseId,'37');
  more.focus();more.send('click');
  assert.equal(app.nodes.get('works').children.length,73);
  assert.equal(more.hidden,true);
  assert.equal(app.document.activeElement?.dataset.caseId,'73');
});

test('播放器方向键保留快进快退，详情其他控件仍可切换作品',async()=>{
  const sample=JSON.parse(fs.readFileSync(new URL('../data/cases.json',import.meta.url))).cases[0];
  const rows=[1,2].map(id=>({...sample,id:String(id),webPlayback:undefined,metrics:{...sample.metrics,bookmarks:1000-id}}));
  const app=await gallery('?page=all#case-1',rows);
  const keydown=(target,key)=>{const event={target,key,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){}};app.documentListeners.get('keydown')(event);return event;};
  const video=app.document.createElement('video'),control=app.document.createElement('button');
  video.append(control);
  for(const target of [video,control,app.document.createElement('input')]){
    for(const key of ['ArrowLeft','ArrowRight']){
      assert.equal(keydown(target,key).defaultPrevented,false,'原生控件应收到方向键');
      assert.equal(app.location.hash,'#case-1','操作播放器不能切换作品');
    }
  }
  assert.equal(keydown(app.nodes.get('close'),'ArrowRight').defaultPrevented,true);
  assert.equal(app.location.hash,'#case-2');
  keydown(app.nodes.get('close'),'ArrowLeft');
  assert.equal(app.location.hash,'#case-1');
});

test('视频已有播放数据时不误报网络停滞，真正缓冲超时仍可重试并恢复',async()=>{
  const sample=JSON.parse(fs.readFileSync(new URL('../data/cases.json',import.meta.url))).cases.find(c=>c.webPlayback);
  const app=await gallery(`?page=all#case-${sample.id}`,[sample]);
  const content=app.nodes.get('viewer-content'),video=content.querySelector('video'),error=content.querySelector('.playback-error'),retry=content.querySelector('.playback-retry');
  video.paused=false;video.readyState=4;video.send('canplay');video.send('stalled');app.flush();
  assert.equal(error.hidden,true,'已经能播放时，网络stalled不能变成播放超时');
  video.readyState=2;video.send('waiting');video.readyState=4;app.flush();
  assert.equal(error.hidden,true,'计时器到期时重新检查已恢复的播放状态');
  video.readyState=2;video.send('waiting');app.flush();
  assert.equal(error.hidden,false,'真正缺少后续数据仍报告超时');
  assert.equal(retry.hidden,false);
  video.readyState=4;video.send('canplay');
  assert.equal(error.hidden,true);
  assert.equal(retry.hidden,true);
});

const settlePreviews=()=>new Promise(resolve=>setImmediate(resolve));
const playableSample=()=>JSON.parse(fs.readFileSync(new URL('../data/cases.json',import.meta.url))).cases.find(c=>c.webPlayback);

test('可见卡片同时静音循环起播，离屏释放媒体，封面保留到真正播放',async()=>{
  const sample=playableSample(),app=await gallery('?page=all',[sample,{...sample,id:'2'},{...sample,id:'3',webPlayback:undefined}]);
  const thumbs=[...app.observer.targets],videos=thumbs.map(thumb=>thumb.querySelector('video'));
  assert.equal(thumbs.length,2,'没有原帖媒体的卡片保留封面入口');
  for(const video of videos){assert.equal(video.src,undefined);assert.equal(video.hidden,true);}
  for(const thumb of thumbs)app.observer.send(thumb,true);
  await settlePreviews();
  for(const video of videos){
    assert.equal(video.paused,false);assert.equal(video.muted,true);assert.equal(video.loop,true);assert.equal(video.playsInline,true);
    assert.equal(video.src,sample.webPlayback.url);assert.equal(video.hidden,true);
    video.send('playing');assert.equal(video.hidden,false);
  }
  app.observer.send(thumbs[0],false);
  assert.equal(videos[0].paused,true);assert.equal(videos[0].src,undefined);assert.equal(videos[0].hidden,true);
  assert.equal(videos[1].paused,false,'其他可见卡片继续播放');
});

test('暂停开关、后台和详情暂停卡片，关闭详情后恢复；重绘释放旧播放器',async()=>{
  const sample=playableSample(),app=await gallery('?page=all',[sample]);
  const thumb=[...app.observer.targets][0],video=thumb.querySelector('video');
  app.observer.send(thumb,true);await settlePreviews();
  app.nodes.get('toggle-previews').send('click');
  assert.equal(video.paused,true);assert.equal(video.src,undefined);
  app.nodes.get('toggle-previews').send('click');await settlePreviews();assert.equal(video.paused,false);
  app.document.hidden=true;app.documentListeners.get('visibilitychange')();assert.equal(video.paused,true);
  app.document.hidden=false;app.documentListeners.get('visibilitychange')();await settlePreviews();assert.equal(video.paused,false);
  app.location.hash=`#case-${sample.id}`;app.windowListeners.get('hashchange')();
  assert.equal(app.nodes.get('viewer').open,true);assert.equal(video.paused,true);
  app.nodes.get('close').send('click');await settlePreviews();assert.equal(video.paused,false);
  app.input('NO_SUCH_WORK_987');app.flush();
  assert.equal(video.paused,true);assert.equal(video.src,undefined);assert.equal(app.observer.targets.size,0);
});

test('减少动态和省流量时不自动加载，手动开启可预览；媒体失败保持封面',async()=>{
  for(const preferences of [{reducedMotion:true},{saveData:true}]){
    const app=await gallery('?page=all',[playableSample()],preferences),thumb=[...app.observer.targets][0],video=thumb.querySelector('video');
    app.observer.send(thumb,true);
    assert.equal(video.src,undefined);assert.equal(app.nodes.get('toggle-previews').textContent,'播放预览');
    app.nodes.get('toggle-previews').send('click');await settlePreviews();video.send('playing');
    assert.equal(video.paused,false);assert.equal(video.hidden,false);
    video.send('error');assert.equal(video.hidden,true);assert.equal(video.paused,true);assert.equal(video.src,undefined);
    app.observer.send(thumb,false);app.observer.send(thumb,true);assert.equal(video.src,undefined,'失败媒体不循环重试');
    assert.ok(thumb.querySelector('img'));
  }
});

test('快速离屏再返回会恢复被打断的起播；浏览器拒绝自动播放时不无限重试',async()=>{
  const app=await gallery('?page=all',[playableSample()]),thumb=[...app.observer.targets][0],video=thumb.querySelector('video');
  let rejectPlay,calls=0;
  video.play=()=>{calls++;return new Promise((resolve,reject)=>{rejectPlay=reject;});};
  app.observer.send(thumb,true);app.observer.send(thumb,false);app.observer.send(thumb,true);
  video.play=()=>{calls++;video.paused=false;return Promise.resolve();};
  rejectPlay({name:'AbortError'});await settlePreviews();assert.equal(video.paused,false);assert.equal(calls,2);
  app.observer.send(thumb,false);
  video.play=()=>{calls++;return Promise.reject({name:'NotAllowedError'});};
  app.observer.send(thumb,true);await settlePreviews();
  assert.equal(calls,3);assert.equal(video.hidden,true);assert.equal(video.paused,true);
});
