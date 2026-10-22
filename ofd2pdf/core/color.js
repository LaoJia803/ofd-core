// CSS 颜色解析（与 ofd.js 的 parseColor 不是一回事）。
/* ------------------------- 颜色 ------------------------- */
// 解析 CSS 颜色 → { r, g, b, a? }；'none'/未知返回 null
// 注意：与 ofd.js 的 parseColor(el) 不是同一个东西——那边读 OFD 元素的 Value/Alpha
// 属性，这边解析 CSS/SVG 颜色字符串。名字必须区分开，否则极易误调。
export function parseCssColor(str) {
  str = String(str || '').trim();
  if (!str || str === 'none') return null;
  let m;
  if ((m = /^#([0-9a-f]{3})$/i.exec(str))) {
    return {
      r: parseInt(m[1][0] + m[1][0], 16),
      g: parseInt(m[1][1] + m[1][1], 16),
      b: parseInt(m[1][2] + m[1][2], 16)
    };
  }
  if ((m = /^#([0-9a-f]{6})$/i.exec(str))) {
    return {
      r: parseInt(m[1].substr(0, 2), 16),
      g: parseInt(m[1].substr(2, 2), 16),
      b: parseInt(m[1].substr(4, 2), 16)
    };
  }
  if ((m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(str))) {
    return { r: +m[1], g: +m[2], b: +m[3] };
  }
  if ((m = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i.exec(str))) {
    return { r: +m[1], g: +m[2], b: +m[3], a: parseFloat(m[4]) };
  }
  if (str === 'black') return { r: 0, g: 0, b: 0 };
  if (str === 'white') return { r: 255, g: 255, b: 255 };
  if (str === 'red') return { r: 255, g: 0, b: 0 };
  return null;
}
