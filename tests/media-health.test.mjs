import test from 'node:test';
import assert from 'node:assert/strict';
import {checkMedia,checkCatalogMedia,originalMediaUrl} from '../scripts/check-media.mjs';

const item={id:'1',source:{url:'https://x.com/creator/status/1'},webPlayback:{kind:'external_source_video',sourcePostUrl:'https://x.com/creator/status/1',url:'https://video.twimg.com/source/video.mp4?tag=12'}};
const bytes=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(1012)]);
const response=(body=bytes,status=206,headers={})=>new Response(body,{status,headers:{'content-type':'video/mp4','content-range':'bytes 0-1023/8000',...headers}});

test('媒体检查限制来源、请求范围，不发送来源头或跟随重定向',async()=>{
  let calls=0;
  const result=await checkMedia(item,{fetcher:async(url,options)=>{
    calls++;assert.equal(url,item.webPlayback.url);assert.equal(options.redirect,'manual');
    assert.equal(options.headers.Range,'bytes=0-1023');assert.equal(options.referrerPolicy,'no-referrer');
    assert.equal(options.headers.Referer,undefined);return response();
  }});
  assert.equal(result.ok,true);assert.equal(result.bytesInspected,1024);assert.equal(calls,1);
  for(const url of ['https://video.twimg.com.evil.test/a.mp4','https://user:pass@video.twimg.com/a.mp4','http://video.twimg.com/a.mp4','https://video.twimg.com:444/a.mp4','https://video.twimg.com/a.mp4?token=secret'])assert.equal(originalMediaUrl({...item,webPlayback:{...item.webPlayback,url}}),null);
  assert.equal(originalMediaUrl({...item,source:{url:'https://x.com/other/status/1'}}),null);
});

test('错误页、重定向、错位范围和截断响应不能误判为可用视频',async()=>{
  for(const make of [()=>response('',403),()=>response('',302,{location:'https://elsewhere.test/video.mp4'}),()=>response('<html>Error</html>',200,{'content-type':'text/html'}),()=>response(bytes,206,{'content-range':'bytes 100-1123/8000'}),()=>response(bytes.subarray(0,8)),()=>response(Buffer.alloc(1024))]) {
    assert.equal((await checkMedia(item,{fetcher:async()=>make()})).ok,false);
  }
});

test('超时包括响应体读取，且发出取消信号',async()=>{
  let signal;
  const result=await checkMedia(item,{timeoutMs:15,fetcher:async(_,options)=>{
    signal=options.signal;
    return new Response(new ReadableStream({start(){}}),{headers:{'content-type':'video/mp4'}});
  }});
  assert.equal(result.ok,false);assert.equal(result.reason,'请求超时');assert.equal(signal.aborted,true);
});

test('服务器忽略 Range 时也只保留前 1024 字节并取消流',async()=>{
  let canceled=false;
  const body=new ReadableStream({start(controller){controller.enqueue(Buffer.concat([bytes,Buffer.alloc(8000)]));},cancel(){canceled=true;}});
  const result=await checkMedia(item,{fetcher:async()=>new Response(body,{headers:{'content-type':'video/mp4'}})});
  assert.equal(result.ok,true);assert.equal(result.bytesInspected,1024);assert.equal(canceled,true);
});

test('批量检查限制并发，保留顺序和失败记录',async()=>{
  let active=0,max=0;
  const cases=Array.from({length:7},(_,i)=>({...item,id:String(i)}));
  const result=await checkCatalogMedia(cases,{concurrency:2,fetcher:async()=>{
    max=Math.max(max,++active);await new Promise(resolve=>setTimeout(resolve,5));active--;return response();
  }});
  assert.equal(max,2);assert.equal(result.passed,7);assert.deepEqual(result.results.map(x=>x.id),cases.map(x=>x.id));
  assert.match(result.scope,/不代表/);
  await assert.rejects(()=>checkCatalogMedia(cases,{concurrency:0}));
});

test('无页内媒体的原帖入口单独列出，已填写的错误地址仍导致失败',async()=>{
  const fallback={id:'2',source:{url:'https://x.com/creator/status/2'}};
  const invalid={...item,id:'3',webPlayback:{...item.webPlayback,url:'https://example.test/video.mp4'}};
  let calls=0;
  const report=await checkCatalogMedia([item,fallback,invalid],{fetcher:async()=>{calls++;return response();}});
  assert.equal(calls,1);assert.equal(report.total,3);assert.equal(report.checked,2);
  assert.equal(report.passed,1);assert.equal(report.failed,1);assert.equal(report.skipped,1);
  assert.equal(report.results[1].ok,null);assert.equal(report.results[1].skipped,true);
  assert.match(report.results[1].reason,/原帖/);assert.equal(report.results[2].ok,false);
  assert.equal((await checkMedia({...item,webPlayback:null})).ok,false);
});
