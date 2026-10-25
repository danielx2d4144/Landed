'use strict';
// Raw email -> verified alert, or a rejection with a reason code.
const crypto = require('crypto');
const { simpleParser } = require('mailparser');
const { verifyDkim } = require('./dkim');
const { bankFor } = require('./banks');
const { htmlToText } = require('./text');

async function readAlert(raw, opts = {}) {
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  const { validDomains, sigs } = await verifyDkim(buf, opts);
  const mail = await simpleParser(buf);
  const fromAddr = (mail.from && mail.from.value[0] && mail.from.value[0].address || '').toLowerCase();
  const fromDomain = fromAddr.split('@')[1] || '';
  const emailHash = crypto.createHash('sha256').update(buf).digest('hex');

  if (!validDomains.length) return { ok: false, code: 'DKIM_FAIL', fromDomain, sigs, emailHash };
  const bank = bankFor(fromDomain, validDomains);
  if (!bank) return { ok: false, code: 'UNSUPPORTED_SENDER', fromDomain, validDomains, emailHash };

  const text = mail.html ? htmlToText(mail.html) : htmlToText((mail.text || '').replace(/\n/g, '<br>'));
  const p = bank.parser.parse(text, mail.subject);
  if (!p) return { ok: false, code: 'UNPARSEABLE', bank: bank.id, emailHash };
  return {
    ok: true, bank: bank.id, dkimDomain: bank.dkimDomains.find((d) => validDomains.includes(d)),
    receivedAt: mail.date ? mail.date.toISOString() : null, emailHash, ...p,
  };
}
module.exports = { readAlert };
