import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {validReview} from '../assets/gallery-model.mjs';
import {buildOutputs, validateCatalog} from './build.mjs';

const digest=body=>createHash('sha256').update(body).digest('hex');
const fail=message=>{throw Object.assign(new Error(message),{status:409});};
export function createCuration(root) {
  const target=file=>path.join(root,file);
  const read=file=>fs.existsSync(target(file))?fs.readFileSync(target(file)):null;
  const write=(file,body)=>{if(body===null)fs.rmSync(target(file),{force:true});else{fs.mkdirSync(path.dirname(target(file)),{recursive:true});fs.writeFileSync(target(file),body);}};
  const catalog=()=>{const body=read('data/cases.json');return {catalog:JSON.parse(body),revision:digest(body)};};
  const trashDir='.research/deleted-works';
  function entries() {
    if(!fs.existsSync(target(trashDir)))return [];
    return fs.readdirSync(target(trashDir)).filter(f=>/^[a-f0-9-]+\.json$/.test(f)).map(f=>JSON.parse(read(`${trashDir}/${f}`))).filter(e=>e.status==='deleted');
  }
  function snapshot() {
    return {...catalog(),trash:entries().map(e=>({key:e.key,id:e.item.id,title:e.item.title,titleEn:e.item.titleEn,deletedAt:e.deletedAt}))};
  }
  function mutate(action,id,revision,review) {
    const current=catalog();
    if(current.revision!==revision)fail('作品列表已变化，请刷新页面后重试。');
    const before=current.catalog, after=structuredClone(before);
    let entry,entryFile,cover;
    if(action==='review') {
      if(!validReview(review))throw Object.assign(new Error('评价格式无效。'),{status:400});
      const item=after.cases.find(c=>c.id===id);
      if(!item)fail('作品已不在画廊，请刷新页面。');
      if(!review.later&&!review.highlights.length&&review.featured===undefined)delete item.review;
      else item.review=structuredClone(review);
    } else if(action==='delete') {
      const index=after.cases.findIndex(c=>c.id===id);
      if(index<0)fail('该作品已被删除，请刷新页面。');
      const item=after.cases.splice(index,1)[0];
      if(!/^assets\/covers\/\d+\.jpg$/.test(item.cover.path))fail('封面路径无效。');
      entry={key:randomUUID(),status:'deleted',deletedAt:new Date().toISOString(),index,item,cover:read(item.cover.path)?.toString('base64')};
      if(!entry.cover)fail('封面缺失，未执行删除。');
      cover=after.cases.some(c=>c.cover.path===item.cover.path)?undefined:null;
    } else {
      entry=entries().find(e=>e.key===id);
      if(!entry)fail('没有找到可恢复的作品。');
      if(after.cases.some(c=>c.id===entry.item.id))fail('同一作品已存在，未覆盖现有内容。');
      if(!/^assets\/covers\/\d+\.jpg$/.test(entry.item.cover.path))fail('备份封面路径无效。');
      cover=Buffer.from(entry.cover,'base64');
      const existing=read(entry.item.cover.path);
      if(existing&&!existing.equals(cover))fail('封面已有其他内容，未覆盖。');
      const restored=structuredClone(entry.item);
      delete restored.playback;
      // Older private backups retain provenance details; publish only current public fields.
      delete restored.prompt.evidenceUrl;
      delete restored.metrics.method;
      restored.metrics.sourceUrl=restored.source.url;
      delete restored.verification.sourceReadUrl;
      if(restored.webPlayback) {
        if(restored.webPlayback.verificationMethod)restored.webPlayback.verificationLevel='source_media_matched';
        delete restored.webPlayback.verificationMethod;
        delete restored.webPlayback.evidence;
      }
      after.cases.splice(Math.min(entry.index,after.cases.length),0,restored);
      entry={...entry,status:'restored',restoredAt:new Date().toISOString()};
    }
    if(entry)entryFile=`${trashDir}/${entry.key}.json`;
    const oldOutputs=buildOutputs(before),newOutputs=buildOutputs(after),changes=new Map();
    for(const file of new Set([...oldOutputs.keys(),...newOutputs.keys()])) {
      if(oldOutputs.get(file)===newOutputs.get(file))continue;
      const actual=read(file),expected=oldOutputs.get(file);
      if(expected!==undefined ? actual?.toString()!==expected : actual!==null)fail(`文件有未同步修改，先核对后重新生成：${file}`);
      changes.set(file,newOutputs.has(file)?Buffer.from(newOutputs.get(file)):null);
    }
    if(cover!==undefined)changes.set(entry.item.cover.path,cover);
    changes.set('data/cases.json',Buffer.from(JSON.stringify(after,null,2)+'\n'));
    if(entry)changes.set(entryFile,Buffer.from(JSON.stringify(entry,null,2)+'\n'));
    const backups=new Map([...changes.keys()].map(file=>[file,read(file)]));
    // Keep a private transaction journal before touching any public file.
    const journal=`${trashDir}/transaction-${randomUUID()}.json`;
    write(journal,JSON.stringify({status:'pending',files:[...backups].map(([file,body])=>[file,body?.toString('base64')??null])}));
    try {
      for(const [file,body] of changes)write(file,body);
      const errors=validateCatalog(after,root);
      if(errors.length)throw new Error(errors.join('\n'));
      write(journal,null);
    } catch(error) {
      for(const [file,body] of backups)write(file,body);
      write(journal,null);
      throw error;
    }
    return snapshot();
  }
  // Recover an interrupted local transaction before serving the catalog.
  if(fs.existsSync(target(trashDir)))for(const file of fs.readdirSync(target(trashDir)).filter(f=>/^transaction-[a-f0-9-]+\.json$/.test(f))) {
    const journal=JSON.parse(read(`${trashDir}/${file}`));
    for(const [name,body] of journal.files)write(name,body===null?null:Buffer.from(body,'base64'));
    write(`${trashDir}/${file}`,null);
  }
  return {snapshot,mutate};
}
