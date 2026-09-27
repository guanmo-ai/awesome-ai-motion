export function extractMetrics(tweet,item,checkedAt) {
  if(String(tweet?.id)!==item.id)throw new Error('返回作品 ID 不一致');
  if(tweet.author?.screen_name?.toLowerCase()!==item.author.handle.toLowerCase())throw new Error('返回作者不一致');
  const result={};
  for(const key of ['bookmarks','likes','views']) {
    const value=tweet[key]??null;
    if(value!==null&&(!Number.isSafeInteger(value)||value<0))throw new Error(`无效互动指标：${key}`);
    result[key]=value;
  }
  return {...result,checkedAt,sourceUrl:`https://x.com/${item.author.handle}/status/${item.id}`};
}
