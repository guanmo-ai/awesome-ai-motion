// Reject auto-generated workstation addresses without printing the identity.
export function hasLocalCommitIdentity(value) {
  const email=String(value).match(/<([^>]+)>/)?.[1]?.trim().toLowerCase();
  if(!email)return true;
  const domain=email.split('@')[1];
  return !domain || !domain.includes('.') || /\.(?:local|lan|home|internal)$/.test(domain);
}

export function isPrivateFile(file) {
  return /(?:^|\/)(?:\.env(?:\.[^/]*)?|\.netrc|\.npmrc|\.pypirc|credentials(?:\.json)?|id_(?:rsa|ed25519))(?:$|\/)/i.test(file)
    || /\.(?:pem|key|p12|pfx)$/i.test(file);
}
