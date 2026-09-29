// Only reader-facing fields belong in the published catalog. Keep raw research local.
import {textPrivacyIssues} from './privacy.mjs';
const scalar=true;
const author={name:scalar,handle:scalar,url:scalar};
const caseFields={
  id:scalar,title:scalar,titleEn:scalar,category:scalar,summary:scalar,summaryEn:scalar,stage:scalar,
  author,source:{url:scalar,publishedAt:scalar},
  model:{name:scalar,basis:scalar,evidenceUrl:scalar,evidenceQuote:scalar},
  media:{durationSeconds:scalar,videoCount:scalar},
  cover:{path:scalar,sourceUrl:scalar,kind:scalar,timeSeconds:scalar,width:scalar,height:scalar,bytes:scalar},
  prompt:{status:scalar,display:scalar,text:scalar,language:scalar,sourceUrl:scalar,checkedAt:scalar,translationZh:scalar,noteZh:scalar,noteEn:scalar},
  metrics:{bookmarks:scalar,likes:scalar,views:scalar,checkedAt:scalar,sourceUrl:scalar},
  verification:{sourceReadAt:scalar,videoAttachmentConfirmed:scalar,promptMatchedSource:scalar,independentlyReproduced:scalar,authorClaimConfirmed:scalar,fullReview:scalar},
  discoveredVia:scalar,codeUrl:scalar,demoUrl:scalar,
  resources:[{kind:scalar,url:scalar,label:scalar,labelEn:scalar,evidenceUrl:scalar,checkedAt:scalar,license:scalar,licenseUrl:scalar,note:scalar,noteEn:scalar}],
  webPlayback:{kind:scalar,url:scalar,sourcePostUrl:scalar,checkedAt:scalar,contentType:scalar,attribution:author,reuploadPermission:scalar,verificationLevel:scalar,durationSeconds:scalar},
  guide:{takeawayZh:scalar,takeawayEn:scalar,stepsZh:[scalar],stepsEn:[scalar],tools:[scalar],evidenceUrls:[scalar]},
  review:{featured:scalar,highlights:[scalar],later:scalar},
};
const schema={schemaVersion:scalar,name:scalar,repository:scalar,cases:[caseFields]};

export function publicCatalogIssues(catalog) {
  const errors=[];
  function visit(value,allowed,location) {
    if(allowed===scalar) {
      if(value!==null&&typeof value==='object')errors.push(`公开字段不接受附加研究对象：${location}`);
      if(typeof value==='string')for(const issue of textPrivacyIssues(value))errors.push(`${issue}：${location}`);
      return;
    }
    if(Array.isArray(allowed)) {
      if(!Array.isArray(value)){errors.push(`公开字段应为数组：${location}`);return;}
      value.forEach((item,i)=>visit(item,allowed[0],`${location}[${i}]`));return;
    }
    if(!value||typeof value!=='object'||Array.isArray(value)){errors.push(`公开字段应为对象：${location}`);return;}
    for(const [key,item] of Object.entries(value)) {
      const field=location?`${location}.${key}`:key;
      if(!Object.hasOwn(allowed,key))errors.push(`未批准公开的字段：${field}`);
      else visit(item,allowed[key],field);
    }
  }
  visit(catalog,schema,'');
  for(const [i,item] of (Array.isArray(catalog?.cases)?catalog.cases:[]).entries()) {
    if(item?.prompt?.display==='source_link'&&(item.prompt.text||item.prompt.translationZh))errors.push(`仅原帖入口不得公开全文或译文：cases[${i}].prompt`);
    if(item?.metrics?.sourceUrl!==undefined&&item.metrics.sourceUrl!==item.source?.url)errors.push(`互动快照必须指向作者原帖：cases[${i}].metrics.sourceUrl`);
  }
  return errors;
}
