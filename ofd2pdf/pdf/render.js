// SVG → PDF 内容流：图元遍历、着色、裁剪、文本与图像。
import { MM_TO_PT } from "../core/constants.js";
import { parseCssColor } from "../core/color.js";
import { addImage } from "../image/xobject.js";
import { utf16beHex } from "./docstring.js";
import { parseSvgXml } from "../svg/parse.js";
import { ellipseToCubics, pathToPdf } from "../svg/path.js";
import { parseClipRef, parseRotate, parseTransform } from "../svg/transform.js";
import { fmtNum, numList } from "../core/util.js";

/* ------------------------- SVG → 内容流 ------------------------- */
// 提取元素的 mix-blend-mode（OFD 注释常用 Darken，保持文字在深色高亮下可见）
function blendOf(el) {
  const m = /mix-blend-mode\s*:\s*([a-zA-Z]+)/.exec(el.attrs.style || '');
  const b = m ? m[1].toLowerCase() : '';
  return b && b !== 'normal' ? b : null;
}
// 透明/混合模式需要 ExtGState（按 alpha+blend 组合去重）
function ensureGState(alpha, blend, ctx) {
  if ((alpha == null || alpha >= 1) && !blend) return null;
  const a = alpha == null ? 1 : Math.max(0, Math.min(1, alpha));
  const key = a + '|' + (blend || '');
  let g = ctx.alphaReg.get(key);
  if (!g) {
    g = { name: 'GS' + ctx.alphaReg.size, a, blend };
    ctx.alphaReg.set(key, g);
  }
  ctx.alphas.add(g.name);
  return g.name;
}
// 通用着色：gs / w / d / 颜色 / 填充描边结束操作
function paintAttrs(el, ctx, parts) {
  const fill = el.attrs.fill && el.attrs.fill !== 'none' ? parseCssColor(el.attrs.fill) : null;
  const stroke = el.attrs.stroke && el.attrs.stroke !== 'none' ? parseCssColor(el.attrs.stroke) : null;
  const alpha = (fill && fill.a != null && fill.a < 1) ? fill.a
    : (stroke && stroke.a != null && stroke.a < 1) ? stroke.a : null;
  const gs = ensureGState(alpha, blendOf(el), ctx);
  if (gs) parts.push('/' + gs + ' gs');
  if (stroke) {
    if (el.attrs['stroke-width']) parts.push(fmtNum(parseFloat(el.attrs['stroke-width'])) + ' w');
    const da = numList(el.attrs['stroke-dasharray']);
    if (da.length) parts.push('[' + da.map(fmtNum).join(' ') + '] 0 d');
  }
  if (fill) parts.push(fmtNum(fill.r / 255) + ' ' + fmtNum(fill.g / 255) + ' ' + fmtNum(fill.b / 255) + ' rg');
  if (stroke) parts.push(fmtNum(stroke.r / 255) + ' ' + fmtNum(stroke.g / 255) + ' ' + fmtNum(stroke.b / 255) + ' RG');
  if (fill && stroke) parts.push('B');
  else if (fill) parts.push('f');
  else if (stroke) parts.push('S');
}

function renderRect(el, ctx, parts) {
  const x = parseFloat(el.attrs.x) || 0;
  const y = parseFloat(el.attrs.y) || 0;
  const w = parseFloat(el.attrs.width) || 0;
  const h = parseFloat(el.attrs.height) || 0;
  if (!w || !h) return;
  const fill = el.attrs.fill ? parseCssColor(el.attrs.fill) : null;
  // 纯白背景（页面默认白底）且无描边：跳过
  if (fill && fill.r === 255 && fill.g === 255 && fill.b === 255 && !el.attrs.stroke) return;
  parts.push('q');
  parts.push(fmtNum(x) + ' ' + fmtNum(y) + ' ' + fmtNum(w) + ' ' + fmtNum(h) + ' re');
  paintAttrs(el, ctx, parts);
  parts.push('Q');
}
function renderPath(el, ctx, parts) {
  const tm = el.attrs.transform ? parseTransform(el.attrs.transform) : null;
  const path = pathToPdf(el.attrs.d, tm);
  if (!path) return;
  parts.push('q');
  parts.push(path);
  // 填充规则：evenodd → f* / B*（默认 NonZero 不变）
  if (el.attrs['fill-rule'] === 'evenodd') {
    const fill = el.attrs.fill && el.attrs.fill !== 'none' ? parseCssColor(el.attrs.fill) : null;
    const stroke = el.attrs.stroke && el.attrs.stroke !== 'none' ? parseCssColor(el.attrs.stroke) : null;
    const alpha = (fill && fill.a != null && fill.a < 1) ? fill.a
      : (stroke && stroke.a != null && stroke.a < 1) ? stroke.a : null;
    const gs = ensureGState(alpha, blendOf(el), ctx);
    if (gs) parts.push('/' + gs + ' gs');
    if (stroke) {
      if (el.attrs['stroke-width']) parts.push(fmtNum(parseFloat(el.attrs['stroke-width'])) + ' w');
      const da = numList(el.attrs['stroke-dasharray']);
      if (da.length) parts.push('[' + da.map(fmtNum).join(' ') + '] 0 d');
    }
    if (fill) parts.push(fmtNum(fill.r / 255) + ' ' + fmtNum(fill.g / 255) + ' ' + fmtNum(fill.b / 255) + ' rg');
    if (stroke) parts.push(fmtNum(stroke.r / 255) + ' ' + fmtNum(stroke.g / 255) + ' ' + fmtNum(stroke.b / 255) + ' RG');
    if (fill && stroke) parts.push('B*');
    else if (fill) parts.push('f*');
    else if (stroke) parts.push('S');
  } else {
    paintAttrs(el, ctx, parts);
  }
  parts.push('Q');
}
function renderEllipse(el, ctx, parts) {
  const cx = parseFloat(el.attrs.cx) || 0;
  const cy = parseFloat(el.attrs.cy) || 0;
  let rx, ry;
  if (el.tag === 'circle') { rx = ry = parseFloat(el.attrs.r) || 0; }
  else { rx = parseFloat(el.attrs.rx) || 0; ry = parseFloat(el.attrs.ry) || 0; }
  if (!rx || !ry) return;
  const segs = ellipseToCubics(cx, cy, rx, ry);
  parts.push('q');
  parts.push(fmtNum(cx + rx) + ' ' + fmtNum(cy) + ' m');
  for (const s of segs) {
    parts.push(fmtNum(s.c1[0]) + ' ' + fmtNum(s.c1[1]) + ' ' + fmtNum(s.c2[0]) + ' ' + fmtNum(s.c2[1]) +
      ' ' + fmtNum(s.p[0]) + ' ' + fmtNum(s.p[1]) + ' c');
  }
  parts.push('h');
  paintAttrs(el, ctx, parts);
  parts.push('Q');
}
function renderText(el, ctx, parts) {
  const fillAttr = el.attrs.fill;
  if (fillAttr === 'none') return;
  const fill = parseCssColor(fillAttr) || { r: 0, g: 0, b: 0 };
  // 文本元素的变换矩阵：无 CTM 时是恒等或 scale(hScale 1)；
  // 有 CTM 时为 translate(bx by) matrix(...) 的合并矩阵（此时 tspan 坐标为局部坐标）
  const m = parseTransform(el.attrs.transform || '');
  const fontSize = parseFloat(el.attrs['font-size']) || 3;
  const gs = ensureGState(fill.a, blendOf(el), ctx);
  if (gs) { parts.push('q'); parts.push('/' + gs + ' gs'); }
  parts.push('BT');
  parts.push('/F1 ' + fmtNum(fontSize) + ' Tf');
  parts.push(fmtNum(fill.r / 255) + ' ' + fmtNum(fill.g / 255) + ' ' + fmtNum(fill.b / 255) + ' rg');
  // 收集文本片段：优先 tspan 子元素，若无则取直接文本
  const textRuns = [];
  const hasTspan = el.children.some(c => c.tag === 'tspan');
  if (hasTspan) {
    for (const ts of el.children) {
      if (ts.tag !== 'tspan') continue;
      if (ts.text) textRuns.push({ text: ts.text, x: ts.attrs.x, y: ts.attrs.y, transform: ts.attrs.transform });
    }
  } else if (el.text) {
    textRuns.push({ text: el.text, x: el.attrs.x, y: el.attrs.y, transform: null });
  }
  for (let ti = 0; ti < textRuns.length; ti++) {
    const ts = textRuns[ti];
    const chars = Array.from(ts.text);
    if (!chars.length) continue;
    const xs = numList(ts.x);
    const ys = numList(ts.y);
    const rot = parseRotate(ts.transform);
    // 直接文本（非 tspan）无逐字符坐标时，按字体大小递增 x
    const isDirect = !hasTspan && ti === 0;
    if (isDirect) {
      // 直接文本：用首字符坐标 + 递增 x，一次 Tj 输出全部字符
      const x0 = xs[0] || 0;
      const y0 = ys[0] || 0;
      let tm;
      if (rot) {
        const c = Math.cos(rot.ang), s = Math.sin(rot.ang);
        const s0 = m[0];
        tm = [s0 * c, s0 * s, s, -c, s0 * rot.cx, rot.cy];
      } else {
        tm = [m[0], m[1], -m[2], -m[3],
          m[0] * x0 + m[2] * y0 + m[4],
          m[1] * x0 + m[3] * y0 + m[5]];
      }
      parts.push(tm.map(fmtNum).join(' ') + ' Tm');
      parts.push('<' + chars.map(c => utf16beHex(c)).join('') + '> Tj');
    } else {
      // tspan：每字符独立 Tm 定位
      for (let i = 0; i < chars.length; i++) {
        const x = i < xs.length ? xs[i] : (xs[xs.length - 1] || 0);
        const y = i < ys.length ? ys[i] : (ys[ys.length - 1] || 0);
        let tm;
        if (rot) {
          const c = Math.cos(rot.ang), s = Math.sin(rot.ang);
          const s0 = m[0];
          tm = [s0 * c, s0 * s, s, -c, s0 * rot.cx, rot.cy];
        } else {
          tm = [m[0], m[1], -m[2], -m[3],
            m[0] * x + m[2] * y + m[4],
            m[1] * x + m[3] * y + m[5]];
        }
        parts.push(tm.map(fmtNum).join(' ') + ' Tm');
        parts.push('<' + utf16beHex(chars[i]) + '> Tj');
      }
    }
  }
  parts.push('ET');
  if (gs) parts.push('Q');
}
async function renderImage(el, ctx, parts) {
  const x = parseFloat(el.attrs.x) || 0;
  const y = parseFloat(el.attrs.y) || 0;
  const w = parseFloat(el.attrs.width) || 0;
  const h = parseFloat(el.attrs.height) || 0;
  if (!w || !h) return;
  const href = el.attrs.href || el.attrs['xlink:href'];
  if (!href) return;
  const name = await addImage(href, ctx);
  if (!name) return;
  parts.push('q');
  const clipId = parseClipRef(el.attrs['clip-path']);
  if (clipId) {
    const rects = ctx.clips.get(clipId);
    if (rects && rects.length) {
      for (const r of rects) {
        parts.push(fmtNum(r.x) + ' ' + fmtNum(r.y) + ' ' + fmtNum(r.w) + ' ' + fmtNum(r.h) + ' re W n');
      }
    }
  }
  // 图像单位坐标 → 边界矩形。SVG y 为图像上边，PDF 图像数据自底向上，
  // 用负高并平移使图像不翻转：w 0 0 -h x (y+h) cm
  parts.push(fmtNum(w) + ' 0 0 ' + fmtNum(-h) + ' ' + fmtNum(x) + ' ' + fmtNum(y + h) + ' cm');
  parts.push('/' + name + ' Do');
  parts.push('Q');
}
async function renderGroup(el, ctx, parts) {
  const m = parseTransform(el.attrs.transform || '');
  const op = parseFloat(el.attrs.opacity);
  const gs = ensureGState(op && op < 1 ? op : null, blendOf(el), ctx);
  const hasM = m[0] !== 1 || m[1] !== 0 || m[2] !== 0 || m[3] !== 1 || m[4] !== 0 || m[5] !== 0;
  parts.push('q');
  if (hasM) parts.push(m.map(fmtNum).join(' ') + ' cm');
  if (gs) parts.push('/' + gs + ' gs');
  for (const child of el.children) await renderElement(child, ctx, parts);
  parts.push('Q');
}
function registerClip(el, ctx) {
  const id = el.attrs.id;
  if (!id) return;
  const rects = [];
  for (const child of el.children) {
    if (child.tag === 'rect') {
      rects.push({
        x: parseFloat(child.attrs.x) || 0,
        y: parseFloat(child.attrs.y) || 0,
        w: parseFloat(child.attrs.width) || 0,
        h: parseFloat(child.attrs.height) || 0
      });
    }
  }
  ctx.clips.set(id, rects);
}
function collectClips(root, ctx) {
  (function walk(el) {
    for (const c of el.children) {
      // parseSvgXml 已把标签名转小写：clipPath → clippath
      if (c.tag === 'clippath') registerClip(c, ctx);
      walk(c);
    }
  })(root);
}
async function renderElement(el, ctx, parts) {
  switch (el.tag) {
    case 'rect': renderRect(el, ctx, parts); break;
    case 'path': renderPath(el, ctx, parts); break;
    case 'ellipse':
    case 'circle': renderEllipse(el, ctx, parts); break;
    case 'text': renderText(el, ctx, parts); break;
    case 'image': await renderImage(el, ctx, parts); break;
    case 'g': await renderGroup(el, ctx, parts); break;
    default: break; // clipPath 等仅登记不绘制
  }
}

// SVG 字符串（mm 坐标、Y 向下）→ 单页 PDF 内容流
export async function svgToContentStream(svgStr, pageWmm, pageHmm, ctx) {
  const root = parseSvgXml(svgStr);
  collectClips(root, ctx);
  const parts = [];
  const pageHpt = pageHmm * MM_TO_PT;
  // 全局变换：mm → pt（2.8346 倍）并翻转 Y（PDF 原点在左下）
  parts.push('q');
  parts.push(fmtNum(MM_TO_PT) + ' 0 0 ' + fmtNum(-MM_TO_PT) + ' 0 ' + fmtNum(pageHpt) + ' cm');
  for (const child of root.children) await renderElement(child, ctx, parts);
  parts.push('Q');
  return parts.join('\n');
}
