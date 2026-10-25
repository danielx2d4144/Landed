<img src="logo.svg" width="64" alt="Landed logo">

# Landed

**Don't release on a fake alert.** Landed tells a Nigerian P2P merchant, or their staff, whether a naira payment really landed, before they release USDT or goods.

It reads the credit-alert email the bank already sends the merchant and checks the bank's **DKIM signature**. A screenshot, a fake SMS, or an edited email can't pass: change one digit and the signature breaks.

## Status: v0 core (no bot yet)

| Piece | State |
|---|---|
| DKIM verifier (`src/dkim.js`) | Done. Full-body signatures only (`l=` rejected), `From` must be signed |
| Bank allow-list (`src/banks.js`) | Wema/ALAT (`wemabank.com`): real credit + debit alerts verified. OPay (`opay-nigeria.com`): real debit alerts verified, but OPay doesn't seem to email credits |
| Parsers (`src/parsers/`) | Wema credit/debit confirmed (payer from Description). OPay debit confirmed; credit provisional |
| Matcher (`src/matcher.js`) | LANDED / WAITING / MISMATCH (amount, name) / REJECT (alert reused) |
| Telegram bot, inbox, receipts | Next |

## Try it

```bash
npm install
npm test                                  # offline, throwaway signing key
node scripts/verify-eml.js alert.eml      # Gmail: ⋮ > Download message
```

## How a check works

1. Merchant sets a Gmail filter that auto-forwards bank alerts to their Landed address (auto-forward keeps the original signature; manual "Forward" breaks it).
2. Landed verifies DKIM, checks the signing domain is on the bank allow-list, and parses amount, payer name and transaction number.
3. Staff send `/check 480000 Chidi Okafor`. Landed answers ✅ LANDED, ⏳ WAITING, or ❌ with the reason. Each alert can only clear one trade.

Landed never holds money and never asks for bank logins. Raw emails are not stored: only the parsed fields and a SHA-256 hash.

## Privacy
Never commit real emails. `*.eml` is git-ignored.
