// 基础工具：数字格式化、列表解析、XML 实体与 base64。
import { getCore } from "./platform.js";

/* ------------------------- 基础工具 ------------------------- */
// 数字格式化：保留最多 4 位小数，去掉多余的 0
export function fmtNum(v) {
  if (typeof v !== 'number' || !isFinite(v)) return '0';
  const r = Math.round(v * 10000) / 10000;
  return String(r);
}
export function numList(str) {
  if (!str) return [];
  return String(str).trim().split(/[\s,]+/).filter(Boolean).map(parseFloat);
}
// 以下两个工具在 ofd.js 中有权威实现。这里优先复用 ofd.js 的（更强：
// decodeEntities 额外支持 &#xNN; 字符引用，base64ToBytes 已在核心统一健壮化），
// 未加载 ofd.js 时回退本地实现，保证 ofd2pdf.js 仍可独立运行。
export function unescapeXml(s) {
  const fn = getCore() && getCore()._internals && getCore()._internals.decodeEntities;
  if (fn) return fn(s);
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
export function base64ToBytes(b64) {
  const fn = getCore() && getCore()._internals && getCore()._internals.base64ToBytes;
  if (fn) return fn(b64);
  // 本地回退：规范化去空白/NULL、URL-safe 字符转标准、按需补齐 '=' 填充
  let s = String(b64).replace(/[\s\x00]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad === 2) s += '==';
  else if (pad === 3) s += '=';
  else if (pad === 1) throw new Error('base64 长度非法');
  let bin;
  if (typeof atob === 'function') {
    bin = atob(s);
  } else {
    // 兜底实现（无 atob 的环境），'=' 视为组内结束
    const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const eq = '='.charCodeAt(0);
    bin = '';
    for (let i = 0; i < s.length; i += 4) {
      const c = [s[i], s[i + 1], s[i + 2], s[i + 3]]
        .map(ch => (ch === '=' ? eq : table.indexOf(ch)));
      const n = (c[0] << 18) | (c[1] << 12) | (c[2] << 6) | c[3];
      bin += String.fromCharCode((n >> 16) & 255, (n >> 8) & 255, n & 255);
    }
    const eqs = /\=*$/.exec(s)[0].length;
    if (eqs) bin = bin.slice(0, 3 - eqs);
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
