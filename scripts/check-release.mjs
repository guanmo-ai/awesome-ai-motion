import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {hasLocalCommitIdentity,isPrivateFile} from './privacy.mjs';
const root=path.resolve(import.meta.dirname,'..');
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const errors=[];
const identityArgs=process.env.GITHUB_ACTIONS==='true' ? ['log','-1','--format=%an <%ae>%n%cn <%ce>'] : null;
const identities=identityArgs ? execFileSync('git',identityArgs,{cwd:root,encoding:'utf8'}).trim().split('\n') : ['GIT_AUTHOR_IDENT','GIT_COMMITTER_IDENT'].map(key=>execFileSync('git',['var',key],{cwd:root,encoding:'utf8'}));
if(identities.some(hasLocalCommitIdentity))errors.push('提交身份包含本机地址或缺少公开邮箱；请使用公开署名与 GitHub noreply 邮箱。');
for(const file of new Set(files)) {
  if(isPrivateFile(file))errors.push(`不应发布私有配置或密钥文件：${file}`);
  if(/^(\.research|\.superpowers|docs\/superpowers)\//.test(file)||/\.(mp4|mov|webm|mp3|wav)$/i.test(file)||file==='preview.html')errors.push(`不应发布：${file}`);
  const full=path.join(root,file);if(!fs.existsSync(full))continue;
  if(fs.statSync(full).size>(file==='data/cases.json'?2_000_000:500_000))errors.push(`文件过大：${file}`);
  if(!/\.(md|json|txt|yml|mjs|html|css)$/.test(file))continue;
  const text=fs.readFileSync(full,'utf8');
  if(/\/Users\/|\/home\/[^/]+\//.test(text))errors.push(`包含本机路径：${file}`);
  if(/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{30,})/.test(text))errors.push(`疑似凭据：${file}`);
  if(!file.endsWith('.md'))continue;
  for(const m of text.matchAll(/\]\(([^)]+)\)/g)) {
    const link=m[1];if(/^(https?:|#|mailto:)/.test(link))continue;
    const target=path.resolve(path.dirname(full),link.split('#')[0]);
    if(!target.startsWith(root+path.sep)||!fs.existsSync(target))errors.push(`本地链接失效：${file} → ${link}`);
  }
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(`发布检查通过：${new Set(files).size} 个文件；无视频大文件、本机路径或失效本地链接。`);
