'use strict';
// Decide a /check against stored verified alerts.
// check: { amountKobo, payerName, sinceMs? }  alerts: verified credit alerts
// used: Set of txnRefs already consumed by earlier checks.
function norm(n) { return String(n || '').toUpperCase().replace(/[^A-Z ]/g, ' ').split(/\s+/).filter(Boolean); }
function nameScore(a, b) {
  const A = new Set(norm(a)), B = norm(b);
  if (!A.size || !B.length) return 0;
  const hit = B.filter((t) => A.has(t)).length;
  return hit / Math.max(A.size, B.length);
}

function decide(check, alerts, used = new Set()) {
  const credits = alerts.filter((a) => a.ok && a.direction === 'credit');
  const sameAmt = credits.filter((a) => a.amountKobo === check.amountKobo);
  const fresh = sameAmt.filter((a) => !used.has(a.txnRef));
  const named = fresh.map((a) => ({ a, s: nameScore(a.counterpartyName, check.payerName) }))
    .sort((x, y) => y.s - x.s);

  if (named.length && named[0].s >= 0.66) return { verdict: 'LANDED', alert: named[0].a, nameScore: named[0].s };
  if (named.length) return { verdict: 'MISMATCH', reason: 'NAME_MISMATCH', alert: named[0].a, nameScore: named[0].s };
  if (sameAmt.length) return { verdict: 'REJECT', reason: 'ALERT_ALREADY_USED' };
  const near = credits.filter((a) => nameScore(a.counterpartyName, check.payerName) >= 0.66 && !used.has(a.txnRef));
  if (near.length) return { verdict: 'MISMATCH', reason: 'AMOUNT_MISMATCH', alert: near[0],
    diffKobo: near[0].amountKobo - check.amountKobo };
  return { verdict: 'WAITING', reason: 'NO_ALERT_YET' };
}
module.exports = { decide, nameScore };
