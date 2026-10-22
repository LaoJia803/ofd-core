// 颜色与路径名工具（资源预取与绘制共用）。
export function capJoinName(v, kind) {
  if (kind === 'Cap') return ['', 'Butt', 'Round', 'Square'][v] || 'Butt';
  return ['', 'Miter', 'Round', 'Bevel'][v] || 'Miter';
}
// 取 pdf.js 轴向/径向渐变 pattern 的色标序列。
//
// 关键：`page.objs.get()` 在对象尚未解析时返回的是 **Promise**，不是数组。
// 旧实现拿它当数组直接 find()，Promise 上没有这些属性 → 抛错落进 catch →
// 返回兜底色 0.5/0.5/0.5。第 11 页 143 根渐变柱因此全被填成纯黑 0 0 0
// （FillColor 默认值），颜色整片消失 —— 蓝色渐变（#9bc1ff→#3f80cd）全丢。
//
// 现在改为：从 operatorList 里**预先收集** pattern id 并 await 解析，
// 结果存进 gradShades 缓存，shadingFill 时同步查表。
// RadialAxial 结构: [kind, type, null, colorStops, startPoint, endPoint, ...]
// colorStops 形如 [[0,"#9bc1ff"],[1,"#3f80cd"]]
export function extractColorStops(p) {
  if (!Array.isArray(p)) return null;
  const stops = p.find(
    (x) => Array.isArray(x) && x.length && Array.isArray(x[0]) && typeof x[0][1] === 'string',
  );
  return stops && stops.length ? stops : null;
}

// RGBA 缓冲的（按 alpha 加权的）平均色，分量 0..1；无有效像素返回 null。
export function avgRgba(rgba) {
  if (!rgba || !rgba.length) return null;
  let r = 0, g = 0, b = 0, w = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (!a) continue;
    r += rgba[i] * a;
    g += rgba[i + 1] * a;
    b += rgba[i + 2] * a;
    w += a;
  }
  if (!w) return null;
  return { r: r / w / 255, g: g / w / 255, b: b / w / 255 };
}

// 渐变色标的平均色，用于拿不到渐变对象时的兜底。
export function stopsAvgColor(stops) {
  let r = 0,
    g = 0,
    b = 0;
  for (const [, hex] of stops) {
    const c = hexToRgb(hex);
    r += c.r;
    g += c.g;
    b += c.b;
  }
  const n = stops.length || 1;
  return { r: r / n, g: g / n, b: b / n };
}
export function hexToRgb(hex) {
  const h = String(hex || '#000000').replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
export function rgbVal(c) {
  const p = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `${p(c.r)} ${p(c.g)} ${p(c.b)}`;
}
