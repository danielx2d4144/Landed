'use strict';
// OPay transaction emails. Debit format ("Transfer Successful") seen on a real
// email 2026-10-25. Credit format is a best guess until a real sample arrives.
const { parseNaira, field } = require('../text');

function parse(text, subject) {
  const s = `${subject || ''}\n${text}`;
  let direction = null;
  if (/transfer of[\s\S]{0,40}is successful|transfer successful|debit/i.test(s)) direction = 'debit';
  if (/(received|credit(ed)?|incoming|you have got)/i.test(subject || '') ||
      /(you have received|has been credited|credit alert|received a transfer)/i.test(text)) direction = 'credit';

  const amount = parseNaira(field(text, 'Amount') || '') ?? parseNaira(text);
  const name = field(text, credit(direction) ? "Sender(?:'s)? Name|Sender|From|Name" : 'Name|Recipient|Beneficiary');
  const txn = field(text, 'Transaction No\\.?|Transaction ID|Session ID|Reference');
  const date = field(text, 'Transaction Date|Date');
  const acct = field(text, 'Account Number|Account No\\.?');
  const bank = field(text, 'Bank');
  if (!amount || !txn) return null;
  return {
    direction, amountKobo: amount,
    counterpartyName: name ? name.replace(/\s+/g, ' ').toUpperCase() : null,
    counterpartyBank: bank || null,
    accountLast4: acct ? acct.replace(/\D/g, '').slice(-4) || null : null,
    txnRef: txn.replace(/\s+/g, ''),
    txnTime: date || null,
  };
}
function credit(d) { return d === 'credit'; }
module.exports = { parse };
