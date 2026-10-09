import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(import.meta.dirname,'..');
export function originalMediaUrl(item) {
  try {
    const media=item.webPlayback, url=new URL(media?.url);
    return media.kind==='external_source_video' && media.sourcePostUrl===item.source?.url &&
      url.protocol==='https:' && url.host==='video.twimg.com' && !url.username && !url.password &&
      url.pathname.endsWith('.mp4') && !url.hash && [...url.searchParams.keys()].every(key=>key==='tag') ? url.href : null;
  } catch { return null; }
}

// A bounded prefix check, deliberately not a browser or full audiovisual review.
export async function checkMedia(item,{fetcher=fetch,timeoutMs=10000}={}) {
  const result={id:item.id,sourceUrl:item.source?.url,checkedAt:new Date().toISOString()};
  if(item.webPlayback===undefined)return {...result,ok:null,skipped:true,reason:'未设置页内媒体，保留原帖观看入口'};
  const url=originalMediaUrl(item);
  if(!url)return {...result,ok:false,reason:'原帖媒体地址无效或缺失'};
  const controller=new AbortController();
  let timer;
  try {
    const check=async()=>{
      const response=await fetcher(url,{headers:{Range:'bytes=0-1023',Accept:'video/mp4'},redirect:'manual',referrerPolicy:'no-referrer',signal:controller.signal});
      result.httpStatus=response.status;
      if(![200,206].includes(response.status))throw new Error(`HTTP ${response.status}（不自动跟随重定向）`);
      if(!/^video\/mp4(?:;|$)/i.test(response.headers.get('content-type')||''))throw new Error('响应不是 video/mp4');
      if(response.status===206 && !/^bytes 0-\d+\/\d+$/.test(response.headers.get('content-range')||''))throw new Error('媒体范围响应不从字节 0 开始');
      if(!response.body)throw new Error('媒体响应为空');
      const reader=response.body.getReader(),prefix=new Uint8Array(1024);
      let size=0;
      try {
        while(size<prefix.length) {
          const {done,value}=await reader.read();
          if(done)break;
          const count=Math.min(value.length,prefix.length-size);
          prefix.set(value.subarray(0,count),size);size+=count;
        }
      } finally { await reader.cancel().catch(()=>{}); }
      if(size<12 || new TextDecoder().decode(prefix.subarray(4,8))!=='ftyp')throw new Error('缺少 MP4 文件头或响应被截断');
      return {...result,ok:true,bytesInspected:size};
    };
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('请求超时'));},timeoutMs);});
    return await Promise.race([check(),timeout]);
  } catch(error) { return {...result,ok:false,reason:controller.signal.aborted?'请求超时':error.message}; }
  finally { clearTimeout(timer);controller.abort(); }
}

export async function checkCatalogMedia(cases,{concurrency=4,...options}={}) {
  const results=new Array(cases.length);let cursor=0;
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8)throw new Error('并发数必须在 1–8 之间');
  await Promise.all(Array.from({length:Math.min(concurrency,cases.length)},async()=>{
    while(cursor<cases.length) {const index=cursor++;results[index]=await checkMedia(cases[index],options);}
  }));
  return {checkedAt:new Date().toISOString(),scope:'仅检查已设置原帖 MP4 的文件头和响应；无页内媒体的原帖入口单独列出，不代表浏览器起播或完整视听审看',total:results.length,checked:results.filter(row=>!row.skipped).length,skipped:results.filter(row=>row.skipped).length,passed:results.filter(row=>row.ok===true).length,failed:results.filter(row=>row.ok===false).length,results};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2);let limit=Infinity;
    if(args.length) {
      if(args.length!==2||args[0]!=='--limit'||!/^\d+$/.test(args[1])||Number(args[1])<1)throw new Error('用法：node scripts/check-media.mjs [--limit 正整数]');
      limit=Number(args[1]);
    }
    const catalog=JSON.parse(await fs.readFile(path.join(ROOT,'data/cases.json'),'utf8'));
    const report=await checkCatalogMedia(catalog.cases.slice(0,limit));
    const destination=path.join(ROOT,'.research/media-health.json');
    await fs.mkdir(path.dirname(destination),{recursive:true});
    await fs.writeFile(destination,JSON.stringify(report,null,2)+'\n');
    console.log(`原帖媒体检查：${report.passed}/${report.checked} 通过；${report.skipped} 条保留原帖入口；报告 .research/media-health.json`);
    for(const row of report.results.filter(row=>row.ok===false))console.error(`${row.id}: ${row.reason}`);
    process.exitCode=report.failed?1:0;
  } catch(error) {console.error(error.message);process.exitCode=2;}
}
