import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {REPOSITORY} from './build.mjs';

export function isPublishTarget(url) {
  const match=url.trim().match(/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/);
  return match?.[1].toLowerCase()===REPOSITORY.toLowerCase();
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const urls=execFileSync('git',['remote','get-url','--push','--all','origin'],{encoding:'utf8',cwd:path.resolve(import.meta.dirname,'..')}).trim().split('\n');
    if(urls.length!==1 || !isPublishTarget(urls[0]))throw new Error('origin 的推送地址与正式仓库不一致');
    console.log(`发布目标正确：${REPOSITORY}`);
  } catch(error) {
    console.error(`发布已阻止：${error.message}。请先核对 origin。`);
    process.exit(1);
  }
}
