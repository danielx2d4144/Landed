'use strict';
// Allow-list: which DKIM domain may vouch for which bank, and which parser reads it.
// Only add a bank after a real alert from it has passed DKIM (see research/dkim-validation.md).
const BANKS = [
  {
    id: 'opay', name: 'OPay',
    dkimDomains: ['opay-nigeria.com'],
    fromDomains: ['opay-nigeria.com'],
    parser: require('./parsers/opay'),
    validated: '2026-10-25 (debit only; 240+ debit emails, NO credit emails seen: OPay may not email credits)',
  },
  {
    id: 'wema', name: 'Wema Bank / ALAT',
    dkimDomains: ['wemabank.com'],
    fromDomains: ['wemabank.com'],
    parser: require('./parsers/wema'),
    validated: '2026-10-25 (real credit + debit alerts, d=wemabank.com via Brevo)',
  },
];

function bankFor(fromDomain, validDomains) {
  return BANKS.find((b) => b.fromDomains.includes(fromDomain)
    && b.dkimDomains.some((d) => validDomains.includes(d))) || null;
}

module.exports = { BANKS, bankFor };
