'use strict';
// HTML -> readable lines.
function htmlToText(html) {
  return String(html)
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|tr|td|th|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#8358;|&#x20a6;/gi, '₦')
    .replace(/[ \t\u00a0]+/g, ' ')
    .split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
}
function parseNaira(s) {
  const m = String(s).match(/(?:₦|NGN|N)\s?([\d,]+(?:\.\d{1,2})?)/i);
  if (!m) return null;
  return Math.round(parseFloat(m[1].replace(/,/g, '')) * 100); // kobo
}
// Value after "Label:" on the same line or the next line.
function field(text, labelRe) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(new RegExp('^\\s*(?:' + labelRe + ')\\s*[:：]?\\s*(.*)$', 'i'));
    if (m) return (m[1] && m[1].trim()) || (lines[i + 1] || '').trim();
  }
  return null;
}
module.exports = { htmlToText, parseNaira, field };
