const publicNames=new Set(['观默','@guanmo_ai','guanmo-ai','观默 / @guanmo_ai']);
const githubNoreply=/^(?:\d+\+)?[a-z0-9-]+@users\.noreply\.github\.com$/i;

// Return only a verdict: callers must never echo an identity into release logs.
export function hasLocalCommitIdentity(value,{ci=false}={}) {
  const match=String(value).match(/^\s*(.*?)\s*<([^<>]+)>/);
  if(!match)return true;
  const name=match[1].trim(),email=match[2].trim();
  if(!githubNoreply.test(email)&&!(ci&&email.toLowerCase()==='noreply@github.com'))return true;
  return !ci&&!publicNames.has(name);
}

export function isPrivateFile(file) {
  const parts=String(file).replaceAll('\\','/').split('/');
  const name=parts.at(-1)||'';
  if(parts.some(part=>/^\.(?:research|superpowers|ssh|aws|kube|gnupg|config)$/i.test(part)))return true;
  if(parts[0]==='docs'&&parts[1]==='superpowers')return true;
  if(parts.some((part,index)=>part==='.docker'&&parts[index+1]==='config.json'))return true;
  return /^(?:\.env(?:\..*)?|\.netrc|\.npmrc|\.pypirc|\.DS_Store|Thumbs\.db|desktop\.ini|credentials(?:\..*)?|secrets?(?:\..*)?|token(?:\..*)?|service[-_]account(?:\..*)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\..*)?|(?:\.bash|\.zsh|\.python|\.node_repl)_history|npm-debug\.log(?:\..*)?|yarn-(?:debug|error)\.log(?:\..*)?)$/i.test(name)
    || /\.(?:pem|key|p12|pfx|jks|keystore|log|sqlite|sqlite3|db|bak|swp|swo|orig|rej)$/i.test(name)
    || name.endsWith('~');
}

export function textPrivacyIssues(text) {
  const issues=[];
  if(/(?:\/Users\/[^/\s"'<>]+\/|\/home\/[^/\s"'<>]+\/|\/root\/(?:[^\s"'<>]+)|[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\\/\s"'<>]+[\\/]|file:\/\/)/i.test(text))issues.push('本机路径');
  if(/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,})/.test(text)
    || /\bAuthorization\s*:\s*(?:Bearer|Basic)\s+[A-Za-z0-9._~+\/-]{12,}/i.test(text))issues.push('疑似访问令牌');
  if(/-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/.test(text))issues.push('私钥内容');
  if(/\b(?:Set-)?Cookie\s*:[^\r\n]*\b[^\s;=]*(?:session|auth|token|jwt)[^\s;=]*=[^\s;]{8,}/i.test(text))issues.push('认证 Cookie');
  for(const match of text.matchAll(/(?:\]\(|\b(?:href|src)\s*=\s*["']|\burl\(\s*["']?)([^\s"')>]+)(?:["'])?/gi)) {
    if(/^(?:https?:|mailto:|data:|#)/i.test(match[1]))continue;
    let target=match[1].split(/[?#]/,1)[0];
    try {target=decodeURIComponent(target);} catch { /* Keep malformed links for the normal link check. */ }
    if(isPrivateFile(target)){issues.push('私有文件引用');break;}
  }
  return issues;
}

// Decode by content, including text with unfamiliar extensions; do not turn binary into replacement characters.
export function decodeText(buffer) {
  if(buffer.length>=2&&buffer[0]===0xff&&buffer[1]===0xfe)return new TextDecoder('utf-16le',{fatal:true}).decode(buffer);
  if(buffer.length>=2&&buffer[0]===0xfe&&buffer[1]===0xff)return new TextDecoder('utf-16be',{fatal:true}).decode(buffer);
  if(buffer.includes(0))return null;
  try {
    const text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);
    const controls=text.match(/[\x01-\x08\x0b\x0e-\x1f]/g)?.length||0;
    return controls>Math.max(2,text.length/100) ? null : text;
  } catch {return null;}
}
