'use strict';
// Allow-list: which DKIM domain may vouch for which bank, and which parser reads it.
// Only add a bank after a real alert from it has passed DKIM (see research/dkim-validation.md).
const BANKS = [
  {
    id: 'opay', name: 'OPay',
    dkimDomains: ['opay-nigeria.com'],
    fromDomains: ['opay-nigeria.com'],
    parser: require('./parsers/opay'),
    validated: '2026-10-25 (debit email; credit format pending)',
  },
];

function bankFor(fromDomain, validDomains) {
  return BANKS.find((b) => b.fromDomains.includes(fromDomain)
    && b.dkimDomains.some((d) => validDomains.includes(d))) || null;
}

module.exports = { BANKS, bankFor };
