// 轻量 SVG XML 解析：输入是 ofd.js 自己产出的 SVG，可信且结构已知。
import { unescapeXml } from "../core/util.js";

/* ------------------------- 轻量 SVG XML 解析 ------------------------- */
// 只解析 SVG 所需的结构（元素/属性/文本），返回裸节点 { tag, attrs, children, text }。
// 与 ofd.js 的 parseXml(str) 刻意区分：那边返回 { documentElement }、用显式栈并严格
// 校验标签匹配，用于解析不可信的 OFD 输入；这边面向 ofd.js 自己产出的 SVG（可信、
// 结构已知），保持宽松省事。返回结构不同，绝不能互换调用。
export function parseSvgXml(str) {
  let pos = 0;
  const len = str.length;
  function skipWs() { while (pos < len && /\s/.test(str[pos])) pos++; }
  function parseEl() {
    if (str.substr(pos, 4) === '<!--') {
      const end = str.indexOf('-->', pos + 4);
      pos = end < 0 ? len : end + 3;
      return null;
    }
    pos++; // 跳过 '<'
    skipWs();
    let tag = '';
    while (pos < len && !/[\s/>]/.test(str[pos])) tag += str[pos++];
    const el = { tag: tag.toLowerCase(), attrs: {}, children: [], text: '', rawText: '' };
    skipWs();
    // 属性
    for (;;) {
      if (pos >= len) break;
      const ch = str[pos];
      if (ch === '/') {
        pos++; skipWs();
        if (str[pos] === '>') { pos++; return el; }
      }
      if (ch === '>') { pos++; break; }
      let name = '';
      while (pos < len && !/[\s=/>]/.test(str[pos])) name += str[pos++];
      skipWs();
      let value = '';
      if (str[pos] === '=') {
        pos++; skipWs();
        if (str[pos] === '"' || str[pos] === "'") {
          const q = str[pos++];
          while (pos < len && str[pos] !== q) value += str[pos++];
          pos++;
        } else {
          while (pos < len && !/[\s/>]/.test(str[pos])) value += str[pos++];
        }
      }
      if (name) el.attrs[name] = unescapeXml(value);
      skipWs();
    }
    // 子元素 / 文本
    let text = '';
    for (;;) {
      if (pos >= len) break;
      if (str[pos] === '<') {
        if (str.substr(pos, 2) === '</') {
          const end = str.indexOf('>', pos);
          pos = end < 0 ? len : end + 1;
          break;
        }
        const child = parseEl();
        if (child) el.children.push(child);
      } else {
        text += str[pos++];
      }
    }
    if (text) {
      // text 去掉首尾空白（元素间排版）；rawText 原样保留，供 tspan 逐字定位使用
      el.rawText = unescapeXml(text);
      el.text = el.rawText.trim();
    }
    return el;
  }
  return parseEl();
}
