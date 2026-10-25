'use strict';
// Offline tests: synthetic emails signed with a throwaway key; DNS is mocked.
const assert = require('assert');
const crypto = require('crypto');
const { dkimSign } = require('mailauth');
const { readAlert } = require('../src/alert');
const { decide } = require('../src/matcher');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const resolver = async (name, type) => {
  if (type === 'TXT' && (name === 'test._domainkey.opay-nigeria.com' || name === 'test._domainkey.wemabank.com')) return [[`v=DKIM1; k=rsa; p=${pub}`]];
  const e = new Error('nx'); e.code = 'ENOTFOUND'; throw e;
};
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });

function opayEmail({ from = 'no-reply@opay-nigeria.com', subject = 'Money Received', amount = '480,000.00', name = 'CHIDI OKAFOR', ref = '260725010203040506070809', credit = true }) {
  const body = credit
    ? `<p>Dear MERCHANT,</p><p>You have received</p><p>&#8358;${amount}</p><p>Transfer Details:</p><p>Sender Name:</p><p>${name}</p><p>Bank:</p><p>GTBank</p><p>Amount:</p><p>&#8358;${amount}</p><p>Transaction No.:</p><p>${ref}</p><p>Transaction Date:</p><p>Oct 25th, 2026 14:02:11</p>`
    : `<p>Your transfer of</p><p>&#8358;${amount}</p><p>is successful.</p><p>Name:</p><p>${name}</p><p>Amount:</p><p>&#8358;${amount}</p><p>Transaction No.:</p><p>${ref}</p>`;
  return Buffer.from([
    `From: OPay <${from}>`, 'To: merchant@example.com', `Subject: ${subject}`,
    'Date: Sun, 25 Oct 2026 13:02:11 +0000', `Message-ID: <${ref}@opay-nigeria.com>`,
    'MIME-Version: 1.0', 'Content-Type: text/html; charset=utf-8', '', body, ''].join('\r\n'));
}
async function sign(raw, domain = 'opay-nigeria.com') {
  const r = await dkimSign(raw, { canonicalization: 'relaxed/relaxed', signatureData: [{ signingDomain: domain, selector: 'test', privateKey: pem }] });
  return Buffer.concat([Buffer.from(r.signatures), raw]);
}

const tests = [];
const t = (n, f) => tests.push([n, f]);

t('valid signed OPay credit parses', async () => {
  const a = await readAlert(await sign(opayEmail({})), { resolver });
  assert.strictEqual(a.ok, true, JSON.stringify(a));
  assert.strictEqual(a.direction, 'credit');
  assert.strictEqual(a.amountKobo, 48000000);
  assert.strictEqual(a.counterpartyName, 'CHIDI OKAFOR');
  assert.strictEqual(a.txnRef, '260725010203040506070809');
});
t('edited amount after signing -> DKIM_FAIL', async () => {
  const s = (await sign(opayEmail({}))).toString().replace(/480,000\.00/g, '980,000.00');
  assert.strictEqual((await readAlert(Buffer.from(s), { resolver })).code, 'DKIM_FAIL');
});
t('unsigned email -> DKIM_FAIL', async () => {
  assert.strictEqual((await readAlert(opayEmail({}), { resolver })).code, 'DKIM_FAIL');
});
t('lookalike sender domain -> UNSUPPORTED_SENDER', async () => {
  const a = await readAlert(await sign(opayEmail({ from: 'alerts@opay-nigeria.com.ng' })), { resolver });
  assert.strictEqual(a.code, 'UNSUPPORTED_SENDER');
});
t('debit email is not a credit', async () => {
  const a = await readAlert(await sign(opayEmail({ credit: false, subject: 'Transfer Successful' })), { resolver });
  assert.strictEqual(a.direction, 'debit');
  assert.strictEqual(decide({ amountKobo: 48000000, payerName: 'Chidi Okafor' }, [a]).verdict, 'WAITING');
});

function wemaEmail({ amount = '20,000.00', payer = 'RUTH D DANIEL', ref = 'S12345678' } = {}) {
  const body = `<p>We wish to inform you that a Credit transaction recently occurred on your bank account.</p><p>Transaction Details - Credit</p><p>Account Number</p><p>:</p><p>0123****02</p><p>Description</p><p>:</p><p>NIP:${payer}-transfer to merchant</p><p>Reference Number</p><p>:</p><p>${ref}</p><p>Transaction Amount</p><p>:</p><p>${amount} NGN</p><p>Transaction Date & Time:</p><p>:</p><p>11-10-2026 18:08:36</p>`;
  return Buffer.from(['From: Wema Alert <wemaalert@wemabank.com>', 'To: m@example.com', 'Subject: Your WEMA Account Has Been Credited',
    'Date: Sun, 11 Oct 2026 17:08:14 +0000', `Message-ID: <${ref}@wemabank.com>`, 'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8', '', body, ''].join('\r\n'));
}
t('valid signed Wema credit parses payer from Description', async () => {
  const a = await readAlert(await sign(wemaEmail(), 'wemabank.com'), { resolver });
  assert.strictEqual(a.ok, true, JSON.stringify(a));
  assert.deepStrictEqual([a.bank, a.direction, a.amountKobo, a.counterpartyName, a.txnRef], ['wema', 'credit', 2000000, 'RUTH D DANIEL', 'S12345678']);
  assert.strictEqual(decide({ amountKobo: 2000000, payerName: 'Ruth Daniel' }, [a]).verdict, 'LANDED');
});
t('Wema-signed email claiming to be OPay -> UNSUPPORTED_SENDER', async () => {
  const a = await readAlert(await sign(opayEmail({}), 'wemabank.com'), { resolver });
  assert.strictEqual(a.code, 'UNSUPPORTED_SENDER');
});

const alert = { ok: true, direction: 'credit', amountKobo: 48000000, counterpartyName: 'CHIDI OKAFOR', txnRef: 'R1' };
t('match -> LANDED', () => assert.strictEqual(decide({ amountKobo: 48000000, payerName: 'Okafor Chidi' }, [alert]).verdict, 'LANDED'));
t('reused alert -> REJECT', () => {
  const d = decide({ amountKobo: 48000000, payerName: 'Chidi Okafor' }, [alert], new Set(['R1']));
  assert.deepStrictEqual([d.verdict, d.reason], ['REJECT', 'ALERT_ALREADY_USED']);
});
t('short payment -> AMOUNT_MISMATCH', () => {
  const d = decide({ amountKobo: 50000000, payerName: 'Chidi Okafor' }, [alert]);
  assert.deepStrictEqual([d.verdict, d.reason, d.diffKobo], ['MISMATCH', 'AMOUNT_MISMATCH', -2000000]);
});
t('third-party payer -> NAME_MISMATCH', () => {
  assert.strictEqual(decide({ amountKobo: 48000000, payerName: 'Bola Ade' }, [alert]).reason, 'NAME_MISMATCH');
});
t('nothing yet -> WAITING', () => assert.strictEqual(decide({ amountKobo: 1000, payerName: 'X' }, []).verdict, 'WAITING'));

(async () => {
  let pass = 0;
  for (const [n, f] of tests) {
    try { await f(); pass++; console.log('ok  ', n); } catch (e) { console.log('FAIL', n, '\n   ', e.message); }
  }
  console.log(`${pass}/${tests.length} passed`);
  process.exit(pass === tests.length ? 0 : 1);
})();
