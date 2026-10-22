// OFD 的 XML 基础工具：转义、数值格式化、DocID 与日期。
import crypto from "node:crypto";

// 数值格式化：默认 4 位小数（精度足够且不会拖大 XML），
// digits 可覆盖 —— 渐变色标的 Position 需要更高精度（值域 [0,1]，4 位只到万分之一）。
export function fmt(n, digits) {
  if (!isFinite(n)) return '0';
  const d = digits === undefined ? 4 : digits;
  let s = n.toFixed(d);
  if (d > 0) s = s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  if (s === '-0' || s === '') s = '0';
  return s;
}

export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function randomId() {
  return crypto.randomBytes(16).toString('hex');
}

// OFD 的日期写法：CreationDate 用 YYYY-MM-DD，ModDate 用带时区的完整时间戳
export function nowOfd() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const off = -d.getTimezoneOffset();
  const ao = Math.abs(off);
  const tz = `${off >= 0 ? '+' : '-'}${p(Math.floor(ao / 60))}:${p(ao % 60)}`;
  return { date, stamp: `${date}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${tz}` };
}
