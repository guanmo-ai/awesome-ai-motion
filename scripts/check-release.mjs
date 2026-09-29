import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {publicCatalogIssues} from './catalog-privacy.mjs';
import {decodeText,hasLocalCommitIdentity,isPrivateFile,textPrivacyIssues} from './privacy.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const gitOptions=root=>({cwd:root,maxBuffer:16_000_000});
const git=(root,...args)=>execFileSync('git',args,gitOptions(root));
const fileLabel=file=>JSON.stringify(file);

export function checkRelease(root=ROOT,{ci=process.env.GITHUB_ACTIONS==='true',checkIdentity=true}={}) {
  root=fs.realpathSync(root);
  const errors=[];
  if(checkIdentity) {
    const identities=ci
      ? git(root,'log','-1','--format=%an <%ae>%n%cn <%ce>').toString('utf8').trim().split('\n')
      : ['GIT_AUTHOR_IDENT','GIT_COMMITTER_IDENT'].map(key=>git(root,'var',key).toString('utf8'));
    if(identities.some(value=>hasLocalCommitIdentity(value,{ci})))errors.push('提交身份：须使用公开署名与 GitHub noreply 邮箱');
  }

  const indexed=new Map();
  for(const entry of git(root,'ls-files','--stage','-z').toString('utf8').split('\0').filter(Boolean)) {
    const match=entry.match(/^(\d{6}) ([0-9a-f]+) ([0-3])\t([\s\S]+)$/);
    if(!match){errors.push('Git 索引：无法解析');continue;}
    const [,mode,hash,stage,file]=match;
    if(stage!=='0'){errors.push(`Git 索引冲突：${fileLabel(file)}`);continue;}
    indexed.set(file,{mode,hash});
  }
  const untracked=git(root,'ls-files','--others','--exclude-standard','-z').toString('utf8').split('\0').filter(Boolean);
  const staged=new Set(git(root,'diff','--cached','--name-only','--diff-filter=ACMRT','-z').toString('utf8').split('\0').filter(Boolean));
  const files=new Set([...indexed.keys(),...untracked]);

  function inspect(file,version,buffer,{symlink=false}={}) {
    const label=fileLabel(file);
    if(symlink){errors.push(`符号链接：${label}（${version}）`);return;}
    // README 的原尺寸 PNG 预览单独放宽，其他图片继续使用默认限制。
    const limit=file==='assets/gallery-preview.png'?4_000_000:file==='data/cases.json'?2_000_000:500_000;
    if(buffer.length>limit)errors.push(`文件过大：${label}（${version}）`);
    const text=decodeText(buffer);
    if(text===null)return;
    for(const issue of textPrivacyIssues(text))errors.push(`${issue}：${label}（${version}）`);
    if(file==='data/cases.json') {
      try {
        if(publicCatalogIssues(JSON.parse(text)).length)errors.push(`案例数据未通过公开字段检查：${label}（${version}）`);
      } catch {errors.push(`案例数据 JSON 无法解析：${label}（${version}）`);}
    }
    if(!file.endsWith('.md'))return;
    for(const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      const link=match[1];
      if(/^(?:https?:|#|mailto:)/i.test(link))continue;
      const target=path.resolve(root,path.dirname(file),link.split(/[?#]/,1)[0]);
      if(!target.startsWith(root+path.sep)||!fs.existsSync(target))errors.push(`本地链接失效或越界：${label}（${version}）`);
      else if(fs.realpathSync(target).startsWith(root+path.sep)===false||isPrivateFile(path.relative(root,target)))errors.push(`本地链接指向私有文件：${label}（${version}）`);
    }
  }

  for(const file of files) {
    if(isPrivateFile(file))errors.push(`私有文件：${fileLabel(file)}`);
    if(/\.(?:mp4|mov|webm|mp3|wav)$/i.test(file)||file==='preview.html')errors.push(`不应发布：${fileLabel(file)}`);
    const index=indexed.get(file);
    if(index?.mode==='120000'&&!staged.has(file))errors.push(`符号链接：${fileLabel(file)}（Git 索引）`);
    else if(index&&index.mode!=='120000'&&index.mode!=='100644'&&index.mode!=='100755')errors.push(`非普通文件：${fileLabel(file)}（Git 索引）`);
    if(index&&staged.has(file)) {
      if(index.mode==='120000')inspect(file,'暂存',Buffer.alloc(0),{symlink:true});
      else if(index.mode!=='100644'&&index.mode!=='100755')errors.push(`非普通文件：${fileLabel(file)}（暂存）`);
      else inspect(file,'暂存',git(root,'cat-file','blob',index.hash));
    }
    const full=path.join(root,file);
    let stat;
    try {stat=fs.lstatSync(full);} catch(error) {if(error.code==='ENOENT')continue;throw error;}
    if(stat.isSymbolicLink())inspect(file,'工作树',Buffer.alloc(0),{symlink:true});
    else if(!stat.isFile())errors.push(`非普通文件：${fileLabel(file)}（工作树）`);
    else inspect(file,'工作树',fs.readFileSync(full));
  }
  return {errors,files:files.size};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const {errors,files}=checkRelease();
    if(errors.length){console.error(errors.slice(0,30).join('\n'));if(errors.length>30)console.error(`另有 ${errors.length-30} 项发布风险。`);process.exitCode=1;}
    else console.log(`发布检查通过：${files} 个文件；无私有文件、凭据、本机路径或失效本地链接。`);
  } catch(error) {
    console.error(`发布检查无法完成：${error.code||error.name}`);
    process.exitCode=1;
  }
}
