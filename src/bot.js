'use strict';
// Telegram command handling, transport-agnostic: handleUpdate(update, deps)
// returns [{ chatId, text }] replies. Used by the dev poller and later a webhook.
const { readAlert } = require('./alert');
const { decide } = require('./matcher');

function naira(k) { return '₦' + (k / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function parseAmount(s) {
  const m = String(s || '').toLowerCase().replace(/[₦,\s]|ngn|naira/g, '').match(/^(\d+(?:\.\d{1,2})?)(k|m)?$/);
  if (!m) return null;
  const v = parseFloat(m[1]) * (m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1);
  return Math.round(v * 100);
}
function parseCheck(text) {
  const parts = text.trim().split(/\s+/).slice(1);
  if (!parts.length) return null;
  const amountKobo = parseAmount(parts[0]);
  const payerName = parts.slice(1).join(' ').trim();
  if (!amountKobo || !payerName) return null;
  return { amountKobo, payerName };
}

const HELP = 'Send /check <amount> <payer name>\nExample: /check 20000 Ruth Daniel';

function startText(m, inbox) {
  const [u, d] = inbox.split('@');
  return [
    `Welcome to Landed, ${m.name}.`, '',
    'Landed tells you if a naira payment really landed, by checking your bank\'s own signed alert email. Fake screenshots and SMS can\'t pass.', '',
    'Setup (one time):',
    `1. Your private Landed address: ${u}+${m.code}@${d}`,
    '2. In the Gmail that gets your bank alerts, add that address under Settings > Forwarding, then create a filter for your bank\'s alert sender that forwards to it. Use automatic forwarding: manually forwarded emails fail the check.',
    m.owner ? '(Alerts already arriving in this inbox directly are covered too.)' : '',
    '', 'Banks supported now: Wema/ALAT credit alerts. OPay doesn\'t seem to email credits yet.', '', HELP,
  ].filter((l) => l !== null).join('\n');
}

function verdictText(r, check) {
  const a = r.alert;
  const ask = `${naira(check.amountKobo)} from ${check.payerName}`;
  switch (r.verdict) {
    case 'LANDED':
      return `✅ LANDED\n${naira(a.amountKobo)} from ${a.counterpartyName}\nBank: ${a.bank.toUpperCase()} · Ref …${a.txnRef.slice(-4)}\nTime: ${a.txnTime || '-'}\nVerified by the bank's DKIM signature. This alert is now marked used.`;
    case 'WAITING':
      return `⏳ WAITING\nNo verified alert for ${ask} yet. Don't release. Check again in a minute.`;
    case 'MISMATCH':
      if (r.reason === 'AMOUNT_MISMATCH')
        return `⚠️ MISMATCH: amount\nFound ${naira(a.amountKobo)} from ${a.counterpartyName}, not ${naira(check.amountKobo)}. Don't release the full order.`;
      return `⚠️ MISMATCH: name\n${naira(a.amountKobo)} landed, but from ${a.counterpartyName}, not ${check.payerName}. Possible third-party payment. Don't release unless you're sure.`;
    case 'REJECT':
      return `⛔ REJECT: alert already used\nThe matching ${naira(check.amountKobo)} payment was already used for an earlier check. Don't release.`;
    default: return 'Something went wrong. Try again.';
  }
}

async function loadAlerts(m, deps) {
  const ids = deps.inbox.listIds(deps.inbox.queryFor(m, { inbox: deps.inboxAddress, hours: deps.windowHours || 48 }));
  const out = [];
  for (const id of ids) {
    let a = deps.store.cachedAlert(id);
    if (!a) {
      const { raw, receivedAt } = deps.inbox.getRaw(id);
      const r = await readAlert(raw, deps.readOpts || {});
      a = deps.store.cacheAlert(id, { ...r, receivedAt });
    }
    if (Date.now() - (a.receivedAt || 0) <= (deps.windowHours || 48) * 3600e3) out.push(a);
  }
  return out;
}

async function handleUpdate(u, deps) {
  const msg = u.message; if (!msg || !msg.text) return [];
  const chatId = msg.chat.id, text = msg.text.trim();
  const cmd = text.split(/\s+/)[0].split('@')[0].toLowerCase();
  let m = deps.store.merchantByChat(chatId);

  if (cmd === '/start') {
    if (!m) m = deps.store.createMerchant({ chatId, name: msg.from.first_name || 'there',
      owner: !!deps.ownerUsername && msg.from.username === deps.ownerUsername });
    return [{ chatId, text: startText(m, deps.inboxAddress) }];
  }
  if (cmd === '/help') return [{ chatId, text: HELP }];
  if (cmd === '/check') {
    if (!m) return [{ chatId, text: 'Send /start first.' }];
    const check = parseCheck(text);
    if (!check) return [{ chatId, text: HELP }];
    const alerts = await loadAlerts(m, deps);
    const used = deps.store.usedSet(m.id);
    for (const a of alerts) if (a.ok && deps.store.usedAnywhere(a.txnRef)) used.add(a.txnRef);
    const r = decide(check, alerts, used);
    if (r.verdict === 'LANDED') deps.store.markUsed(m.id, r.alert.txnRef, { amountKobo: r.alert.amountKobo, by: chatId });
    return [{ chatId, text: verdictText(r, check) }];
  }
  return [{ chatId, text: HELP }];
}
module.exports = { handleUpdate, parseCheck, parseAmount, verdictText };
