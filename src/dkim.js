'use strict';
// Verifies DKIM signatures on a raw RFC 5322 message and returns the
// domains whose signatures are valid and cover the whole body.
const { dkimVerify } = require('mailauth');

async function verifyDkim(raw, opts = {}) {
  const res = await dkimVerify(Buffer.isBuffer(raw) ? raw : Buffer.from(raw), {
    resolver: opts.resolver, // injectable for offline tests
  });
  const sigs = (res.results || []).map((r) => ({
    domain: (r.signingDomain || '').toLowerCase(),
    selector: r.selector,
    result: r.status && r.status.result,
    bodyLengthLimited: r.bodyLengthCount !== undefined && r.bodyLengthCount !== null,
    signedHeaders: (r.signingHeaders && r.signingHeaders.keys || '').toLowerCase().split(':').map((s) => s.trim()),
    algo: r.algo,
  }));
  const valid = sigs.filter((s) => s.result === 'pass' && !s.bodyLengthLimited
    && s.signedHeaders.includes('from'));
  return { sigs, validDomains: [...new Set(valid.map((s) => s.domain))] };
}

module.exports = { verifyDkim };
