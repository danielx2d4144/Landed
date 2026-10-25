'use strict';
// Dev inbox reader via the gws CLI (Gmail API). Production will use the Gmail
// REST API with Landed's own OAuth refresh token; same interface.
const { execFileSync } = require('child_process');
const { allowedSenderQuery } = require('../banks');

function gws(args) { return JSON.parse(execFileSync('gws', args, { maxBuffer: 1e8 }).toString()); }

function listIds(query, max = 50) {
  const r = gws(['gmail', 'users', 'messages', 'list', '--params', JSON.stringify({ userId: 'me', q: query, maxResults: max })]);
  return (r.messages || []).map((m) => m.id);
}
function getRaw(id) {
  const r = gws(['gmail', 'users', 'messages', 'get', '--params', JSON.stringify({ userId: 'me', id, format: 'raw' })]);
  return { raw: Buffer.from(r.raw, 'base64url'), receivedAt: Number(r.internalDate) };
}
// alerts for one merchant: forwarded to box+code@, or (owner) delivered directly
function queryFor(merchant, { inbox, hours = 48 }) {
  const days = Math.max(1, Math.ceil(hours / 24));
  const [user, dom] = inbox.split('@');
  const to = merchant.owner ? `(deliveredto:${user}+${merchant.code}@${dom} OR deliveredto:${inbox})` : `deliveredto:${user}+${merchant.code}@${dom}`;
  return `${to} ${allowedSenderQuery()} newer_than:${days}d`;
}
module.exports = { listIds, getRaw, queryFor };
