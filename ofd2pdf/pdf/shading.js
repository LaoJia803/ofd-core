// SVG 渐变 → PDF 着色（Shading）字典，配合内容流的 sh 算子使用。
// 只做 DeviceRGB：OFD 的渐变颜色本来就是 RGB，无需 CMYK。
// 色标透明度在 PDF 着色器里没有对应字段，只能整体按平均 alpha 写进 ExtGState。
import { parseCssColor } from "../core/color.js";
import { fmtNum } from "../core/util.js";

/* ------------------------- 渐变 ------------------------- */
const clamp01 = v => Math.max(0, Math.min(1, v));
// 解析 <linearGradient>/<radialGradient>（ofd.js 一律用 userSpaceOnUse、坐标为页面 mm）
export function parseGradient(el) {
  const stops = [];
  for (const c of el.children) {
    if (c.tag !== 'stop') continue;
    const raw = String(c.attrs.offset == null ? '0' : c.attrs.offset);
    let off = parseFloat(raw);
    if (!isFinite(off)) off = 0;
    if (/%$/.test(raw)) off /= 100;
    const col = parseCssColor(c.attrs['stop-color']) || { r: 0, g: 0, b: 0 };
    const op = parseFloat(c.attrs['stop-opacity']);
    stops.push({
      offset: clamp01(off),
      r: col.r, g: col.g, b: col.b,
      a: isFinite(op) ? clamp01(op) : 1
    });
  }
  if (!stops.length) return null;
  stops.sort((x, y) => x.offset - y.offset);
  // 单色标：退化成纯色渐变（PDF 至少要两个色标才能插值）
  if (stops.length === 1) stops.push(Object.assign({}, stops[0], { offset: 1 }));
  // spreadMethod 只有 pad 能精确表达；repeat/reflect 用 pad 近似（宁可少铺，不要算错坐标）
  const extend = [true, true];
  const num = k => {
    const v = parseFloat(el.attrs[k]);
    return isFinite(v) ? v : 0;
  };
  if (el.tag === 'lineargradient') {
    const coords = [num('x1'), num('y1'), num('x2'), num('y2')];
    // 起终点重合的渐变在 PDF 里是非法着色，直接丢弃
    if (Math.abs(coords[0] - coords[2]) < 1e-9 && Math.abs(coords[1] - coords[3]) < 1e-9) return null;
    return { type: 2, coords, stops, extend };
  }
  const r = num('r');
  if (!(r > 0)) return null;
  return { type: 3, coords: [num('cx'), num('cy'), 0, num('cx'), num('cy'), r], stops, extend };
}
const rgb = c => [fmtNum(c.r / 255), fmtNum(c.g / 255), fmtNum(c.b / 255)].join(' ');
// 两色标之间的线性函数（FunctionType 2）
const segmentFn = (c0, c1) =>
  '<< /FunctionType 2 /Domain [0 1] /C0 [' + rgb(c0) + '] /C1 [' + rgb(c1) + '] /N 1 >>';
// 拼接函数（FunctionType 3）：把 N 个色标拆成 N-1 段
function stitchFunction(stops) {
  const fns = [], bounds = [], enc = [];
  for (let i = 0; i < stops.length - 1; i++) {
    fns.push(segmentFn(stops[i], stops[i + 1]));
    enc.push('0 1');
    if (i < stops.length - 2) bounds.push(fmtNum(stops[i + 1].offset));
  }
  return '<< /FunctionType 3 /Domain [0 1] /Functions [' + fns.join(' ') +
    '] /Bounds [' + bounds.join(' ') + '] /Encode [' + enc.join(' ') + '] >>';
}
// 规整色标：去掉重复 offset，并补首尾（保证 Domain [0 1] 全覆盖）
function normalizeStops(stops) {
  const out = [];
  for (const s of stops) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.offset - s.offset) < 1e-6) out[out.length - 1] = s;
    else out.push(s);
  }
  if (out[0].offset > 1e-6) out.unshift(Object.assign({}, out[0], { offset: 0 }));
  const tail = out[out.length - 1];
  if (tail.offset < 1 - 1e-6) out.push(Object.assign({}, tail, { offset: 1 }));
  return out;
}
// 生成 PDF 着色字典（作为页面 /Shading 资源，配合 sh 使用）
export function buildShadingDict(g) {
  const stops = normalizeStops(g.stops);
  const ext = g.extend && g.extend[0] && g.extend[1] ? 'true true' : (g.extend && g.extend[0] ? 'true false' : 'false false');
  return '<< /ShadingType ' + g.type + ' /ColorSpace /DeviceRGB /Coords [' +
    g.coords.map(fmtNum).join(' ') + '] /Function ' + stitchFunction(stops) +
    ' /Extend [' + ext + '] >>';
}
// 渐变平均不透明度（着色器没有 alpha，只能整体近似）
export function gradientAlpha(g) {
  if (!g || !g.stops || !g.stops.length) return null;
  let sum = 0;
  for (const s of g.stops) sum += s.a;
  const a = sum / g.stops.length;
  return a < 1 ? a : null;
}
// 渐变在 t 处的颜色：描边/文字这类无法用 sh 的场景退化为纯色
export function gradientColorAt(g, t) {
  const stops = g && g.stops;
  if (!stops || !stops.length) return { r: 0, g: 0, b: 0 };
  t = clamp01(t == null ? 0.5 : t);
  if (t <= stops[0].offset) return { r: stops[0].r, g: stops[0].g, b: stops[0].b };
  for (let i = 1; i < stops.length; i++) {
    const s1 = stops[i];
    if (t <= s1.offset) {
      const s0 = stops[i - 1];
      const span = s1.offset - s0.offset;
      const k = span > 1e-9 ? (t - s0.offset) / span : 0;
      return {
        r: Math.round(s0.r + (s1.r - s0.r) * k),
        g: Math.round(s0.g + (s1.g - s0.g) * k),
        b: Math.round(s0.b + (s1.b - s0.b) * k)
      };
    }
  }
  const last = stops[stops.length - 1];
  return { r: last.r, g: last.g, b: last.b };
}
