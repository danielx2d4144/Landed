'use strict';
// Wema Bank / ALAT alerts from wemaalert@wemabank.com. Credit + debit formats
// confirmed on real emails 2026-10-25. Payer name sits in Description,
// e.g. "NIP:CHIDI OKAFOR-<narration>".
const { parseNaira, field } = require('../text');

function payerFrom(desc) {
  if (!desc) return null;
  let d = desc.replace(/^(NIP|TRF|FT|MOB|USSD|POS)\s*[:/]\s*/i, '');
  d = d.split(/[-\/|]/)[0];
  d = d.replace(/[^A-Za-z .']/g, ' ').replace(/\s+/g, ' ').trim();
  return d ? d.toUpperCase() : null;
}

function parse(text, subject) {
  let direction = null;
  if (/credited/i.test(subject || '') || /Transaction Details\s*-\s*Credit/i.test(text)) direction = 'credit';
  else if (/debited/i.test(subject || '') || /Transaction Details\s*-\s*Debit/i.test(text)) direction = 'debit';
  const amountKobo = parseNaira(field(text, 'Transaction Amount|Amount') || '');
  const txnRef = field(text, 'Reference Number|Reference');
  const desc = field(text, 'Description|Narration');
  const acct = field(text, 'Account Number');
  if (!amountKobo || !txnRef) return null;
  return {
    direction, amountKobo,
    counterpartyName: direction === 'credit' ? payerFrom(desc) : null,
    counterpartyBank: null,
    accountLast4: acct ? (acct.replace(/[^\d]/g, '').slice(-2) || null) : null,
    txnRef: txnRef.replace(/\s+/g, ''),
    txnTime: field(text, 'Transaction Date & Time:?|Transaction Date') || null,
    narration: desc || null,
  };
}
module.exports = { parse, payerFrom };
