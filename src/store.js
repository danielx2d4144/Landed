'use strict';
// Minimal JSON-file store for dev. Holds merchants, parsed alert fields (never
// raw emails), and which alert refs were already used. Swap for Redis/KV later.
const fs = require('fs');
const crypto = require('crypto');

class FileStore {
  constructor(path) { this.path = path; this.d = { merchants: {}, alerts: {}, used: {} };
    if (path && fs.existsSync(path)) this.d = JSON.parse(fs.readFileSync(path, 'utf8')); }
  save() { if (this.path) fs.writeFileSync(this.path, JSON.stringify(this.d, null, 1)); }
  merchantByChat(chatId) { return Object.values(this.d.merchants).find((m) => m.chats.includes(String(chatId))) || null; }
  createMerchant({ chatId, name, owner = false }) {
    const code = crypto.randomBytes(4).toString('hex');
    const m = { id: code, code, name, owner, chats: [String(chatId)], createdAt: Date.now() };
    this.d.merchants[code] = m; this.save(); return m;
  }
  cachedAlert(gmailId) { return this.d.alerts[gmailId] || null; }
  cacheAlert(gmailId, a) {
    // keep parsed fields + hash only
    const keep = (({ ok, code, bank, direction, amountKobo, counterpartyName, txnRef, txnTime, emailHash, receivedAt, to }) =>
      ({ ok, code, bank, direction, amountKobo, counterpartyName, txnRef, txnTime, emailHash, receivedAt, to }))(a);
    this.d.alerts[gmailId] = keep; this.save(); return keep;
  }
  usedSet(merchantId) { return new Set(Object.keys(this.d.used[merchantId] || {})); }
  markUsed(merchantId, txnRef, info) {
    // a ref is global per bank alert: refuse reuse across merchants too
    (this.d.used[merchantId] ||= {})[txnRef] = { at: Date.now(), ...info }; this.save();
  }
  usedAnywhere(txnRef) { return Object.values(this.d.used).some((u) => u[txnRef]); }
}
module.exports = { FileStore };
