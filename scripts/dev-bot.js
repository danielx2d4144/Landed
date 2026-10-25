'use strict';
// Dev runner: long-polls Telegram, reads the Landed Gmail inbox via gws.
// TELEGRAM_API defaults to the sandbox's injected-token URL.
const path = require('path');
const { handleUpdate } = require('../src/bot');
const { FileStore } = require('../src/store');
const inbox = require('../src/inbox/gws');
const API = process.env.TELEGRAM_API || 'https://api.telegram.org/bot__SAVED_KEY__';
const deps = { store: new FileStore(path.join(__dirname, '../data/dev-store.json')), inbox,
  inboxAddress: process.env.LANDED_INBOX || 'bloomover70@gmail.com', ownerUsername: process.env.OWNER_USERNAME || 'danielx2d', windowHours: Number(process.env.WINDOW_HOURS || 48) };
const tg = (m, body) => fetch(`${API}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
(async () => {
  await tg('setMyCommands', { commands: [{ command: 'start', description: 'Set up Landed' }, { command: 'check', description: 'Check a payment: /check 20000 Ruth Daniel' }, { command: 'help', description: 'How to use Landed' }] });
  let offset = 0; const until = Date.now() + Number(process.env.RUN_MINUTES || 18) * 60e3;
  console.log('bot up');
  while (Date.now() < until) {
    const r = await tg('getUpdates', { offset, timeout: 25 }).catch((e) => ({ result: [], e }));
    for (const u of r.result || []) {
      offset = u.update_id + 1;
      try { for (const rep of await handleUpdate(u, deps)) { await tg('sendMessage', { chat_id: rep.chatId, text: rep.text }); console.log(new Date().toISOString(), (u.message && u.message.text || '').split(' ')[0], '->', rep.text.split('\n')[0]); } }
      catch (e) { console.log('ERR', e.message); if (u.message) await tg('sendMessage', { chat_id: u.message.chat.id, text: 'Landed hit an error checking that. Try again in a minute.' }); }
    }
  }
  console.log('bot stopping (dev window over)');
})();
