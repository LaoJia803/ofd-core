import { ensureImageDataUrl } from "../core/image.js";
import { parsePage } from "../core/page.js";
import { escapeXml, expandDelta } from "../core/parser.js";
import { hasGlyphFor, mapFontFamily } from "./font.js";
import { colorToCss } from "../shared/color.js";
import { LRUCache } from "../shared/lru.js";
import { child } from "../shared/xml.js";

// ==================== SVG 元素渲染 ====================
// 把解析后的页面图元（路径 / 文字 / 图像 / 印章 / 注解）转成 SVG 片段。
const ABBR_PATH_CACHE_MAX = 4096;
const abbrPathCache = new LRUCache(ABBR_PATH_CACHE_MAX);
function abbreviatedToSvgPath(abbr) {
  if (!abbr) return "";
  if (abbrPathCache.has(abbr)) return abbrPathCache.get(abbr);
  const tokens = abbr.trim().split(/\s+/);
  const numRe = /^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?$/;
  let d = "";
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (!t) {
      i++;
      continue;
    }
    const cmd = t[0];
    if (cmd === "C" && t.length === 1) {
      d += "Z ";
      i++;
      continue;
    }
    if ("MLQBAS".indexOf(cmd) >= 0) {
      const svgCmd = cmd === "B" ? "C" : cmd === "S" ? "M" : cmd;
      d += svgCmd;
      i++;
      while (i < tokens.length && numRe.test(tokens[i])) {
        d += " " + tokens[i];
        i++;
      }
      d += " ";
    } else if (numRe.test(t)) {
      i++;
    } else {
      i++;
    }
  }
  d = d.trim();
  abbrPathCache.set(abbr, d);
  return d;
}

// DashPattern 只允许数字序列（空格或逗号分隔），防止属性值逃逸
const DASH_TOKEN_RE = /^[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?$/;
function safeDashPattern(value) {
  const tokens = String(value || "").trim().split(/[\s,]+/);
  if (!tokens.length || !tokens[0]) return "";
  for (const t of tokens) if (!DASH_TOKEN_RE.test(t)) return "";
  return tokens.join(" ");
}

let _gradSeq = 0;
function buildGradient(gradient) {
  if (!gradient || !gradient.stops || !gradient.stops.length) return null;
  // ID 只由引擎生成，绝不拼接文档里的 ID（后者可用于属性注入）
  const id = "ofd-grad-" + (++_gradSeq);
  const clamp01 = (v) => (v == null || isNaN(v) ? 0 : Math.max(0, Math.min(1, v)));
  const stops = gradient.stops
    .map((s) => {
      const c = s.color || { r: 0, g: 0, b: 0, a: 1 };
      const op = c.a != null ? c.a : 1;
      return `<stop offset="${clamp01(s.pos)}" stop-color="${colorToCss({ r: c.r, g: c.g, b: c.b, a: 1 })}"${op < 1 ? ` stop-opacity="${op}"` : ""}/>`;
    })
    .join("");
  const spread =
    /repeat/i.test(gradient.extend) ? "repeat"
      : /reflect/i.test(gradient.extend) ? "reflect"
        : "pad";
  let def;
  if (gradient.kind === "axial") {
    const s = gradient.start || [], e = gradient.end || [];
    def = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${s[0] || 0}" y1="${s[1] || 0}" x2="${e[0] || 0}" y2="${e[1] || 0}" spreadMethod="${spread}">${stops}</linearGradient>`;
  } else {
    const e = (gradient.end && gradient.end.length >= 3) ? gradient.end : (gradient.start || []);
    def = `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${e[0] || 0}" cy="${e[1] || 0}" r="${e[2] || 0}" spreadMethod="${spread}">${stops}</radialGradient>`;
  }
  return { id, def };
}

// ==================== 对象级裁剪 ====================
// Clips 采用对象空间坐标系；多个 Clip 取交集，一个 Clip 内的多个 Area 取并集。
// TransFlag=true 时裁剪区受图元自身 CTM 影响（在 placement 组内引用）；
// false 时只受 Boundary 平移影响（在 placement 组外引用，祖先 CTM 仍自然生效）。
let _clipSeq = 0;
function areaToClipSvg(area, outerTransform, res) {
  const parts = [];
  const areaTf = area.ctm ? `matrix(${area.ctm.join(" ")}) ` : "";
  for (const p of area.paths || []) {
    const d = abbreviatedToSvgPath(p.abbr);
    if (!d) continue;
    let tf = outerTransform + areaTf;
    if (p.boundary && (p.boundary.x || p.boundary.y))
      tf += `translate(${p.boundary.x} ${p.boundary.y}) `;
    if (p.ctm) tf += `matrix(${p.ctm.join(" ")}) `;
    const rule = p.rule === "Even-Odd" ? ' clip-rule="evenodd"' : "";
    parts.push(
      `<path d="${d}"${rule}${tf.trim() ? ` transform="${tf.trim()}"` : ""}/>`,
    );
  }
  for (const t of area.texts || []) {
    const built = buildTextObject(t, res);
    if (!built) continue;
    parts.push(
      `<g transform="${outerTransform}${areaTf}"><g transform="${built.transform}">${built.inner}</g></g>`,
    );
  }
  return parts.join("");
}
function applyClips(inner, transform, clips, boundary, res) {
  const placed = `<g transform="${transform}">${inner}</g>`;
  if (!clips || !clips.length) return placed;
  const defs = [];
  const inside = [];
  const outside = [];
  for (const clip of clips) {
    const id = "ofd-clip-" + (++_clipSeq);
    const outer = clip.transFlag
      ? ""
      : `translate(${boundary.x} ${boundary.y}) `;
    const paths = clip.areas
      .map((a) => areaToClipSvg(a, outer, res))
      .join("");
    if (!paths) continue;
    defs.push(
      `<clipPath id="${id}" clipPathUnits="userSpaceOnUse">${paths}</clipPath>`,
    );
    (clip.transFlag ? inside : outside).push(id);
  }
  if (!defs.length) return placed;
  let local = inner;
  for (const id of inside) local = `<g clip-path="url(#${id})">${local}</g>`;
  let out = `<g transform="${transform}">${local}</g>`;
  for (const id of outside) out = `<g clip-path="url(#${id})">${out}</g>`;
  return `<defs>${defs.join("")}</defs>${out}`;
}

const LINE_CAPS = ["butt", "round", "square"];
const LINE_JOINS = ["miter", "round", "bevel"];

function buildPathObject(obj, res) {
  const d = abbreviatedToSvgPath(obj.abbreviatedData);
  if (!d) return null;
  const b = obj.boundary;
  let transform = `translate(${b.x} ${b.y})`;
  if (obj.ctm) transform += ` matrix(${obj.ctm.join(" ")})`;
  const dp = obj.drawParam ? res.drawParams[obj.drawParam] : null;
  let lineWidth =
    obj.lineWidth != null
      ? obj.lineWidth
      : dp && dp.lineWidth != null
        ? dp.lineWidth
        : 0.7;
  if (!isFinite(lineWidth) || lineWidth < 0) lineWidth = 0.7;
  const strokeColor = obj.strokeColor || (dp && dp.strokeColor) || null;
  const fillColor = obj.fillColor || (dp && dp.fillColor) || null;
  const fillGrad = obj.fillGradient || (dp && dp.fillGradient) || null;
  const strokeGrad = obj.strokeGradient || (dp && dp.strokeGradient) || null;

  const defs = [];
  let attrs = "";
  if (obj.fill) {
    if (fillGrad) {
      const g = buildGradient(fillGrad);
      if (g) {
        attrs += ` fill="url(#${g.id})"`;
        defs.push(g.def);
      } else attrs += ' fill="none"';
    } else if (fillColor) attrs += ` fill="${colorToCss(fillColor)}"`;
    else attrs += ' fill="none"';
  } else attrs += ' fill="none"';
  if (obj.rule === "Even-Odd") attrs += ' fill-rule="evenodd"';
  if (obj.stroke) {
    if (strokeGrad) {
      const g = buildGradient(strokeGrad);
      if (g) {
        attrs += ` stroke="url(#${g.id})"`;
        defs.push(g.def);
      } else {
        attrs += ` stroke="${colorToCss(strokeColor || fillColor || { r: 0, g: 0, b: 0, a: 1 })}"`;
      }
    } else {
      attrs += ` stroke="${colorToCss(strokeColor || fillColor || { r: 0, g: 0, b: 0, a: 1 })}"`;
    }
    attrs += ` stroke-width="${lineWidth}"`;
    const dash = safeDashPattern(
      obj.dash != null && obj.dash !== ""
        ? obj.dash
        : dp && dp.dashPattern,
    );
    if (dash) attrs += ` stroke-dasharray="${dash}"`;
    if (dp) {
      const cap = LINE_CAPS[+dp.cap];
      if (cap) attrs += ` stroke-linecap="${cap}"`;
      const join = LINE_JOINS[+dp.join];
      if (join) attrs += ` stroke-linejoin="${join}"`;
      if (dp.dashOffset != null && isFinite(dp.dashOffset))
        attrs += ` stroke-dashoffset="${dp.dashOffset}"`;
    }
    // OFD 的 MiterLimit 默认值是 3.528，SVG 是 4；未声明时也要显式对齐
    const miter =
      dp && dp.miterLimit != null && isFinite(dp.miterLimit)
        ? dp.miterLimit
        : !dp || dp.join == null || +dp.join === 0
          ? 3.528
          : null;
    if (miter != null) attrs += ` stroke-miterlimit="${miter}"`;
  }
  return {
    transform,
    inner: `${defs.length ? `<defs>${defs.join("")}</defs>` : ""}<path d="${d}"${attrs}/>`,
  };
}

function buildTextObject(obj, res) {
  const font = res.fonts[obj.fontId] || {};
  const fv = mapFontFamily(font.fontName, obj.fontId);
  let hScale = obj.hScale != null ? obj.hScale : 1;
  if (!isFinite(hScale) || hScale === 0) hScale = 1;
  const bx = obj.boundary.x,
    by = obj.boundary.y;
  const fill = obj.fill
    ? colorToCss(obj.fillColor || { r: 0, g: 0, b: 0, a: 1 })
    : "none";
  const weight = fv.weight || (obj.weight >= 700 ? "bold" : "normal");
  const fontStyle = fv.style || (obj.italic ? "italic" : "normal");
  const dp = obj.drawParam ? res.drawParams[obj.drawParam] : null;

  // 渲染单个 TextCode 的 tspan 片段。
  //
  // 「无轮廓字符」的判定：**cmap 与 Glyphs 双重确认**，缺一不可。
  //
  // 为什么不能只看 cmap：子集字体里大量字符用**私有区假码**（U+E000–U+E0FF）。
  // 实测 Calibri-Bold 子集：n/k/h/c/o/A 这些正文常用字母的 cmap 里全都没有，
  // 只有等量的私有区条目。只看 cmap 会把第 6 页的 Anchor / Branch / AnchorTable
  // 整片误杀（实测 117 处）。
  //
  // 为什么不能只看 Glyphs：转换器对查不到字形的码位写 gid 1，
  // 但 gid 1 在不同子集字体里指向的东西完全不同（实测 Calibri 子集
  // gid 1 无人引用、gid 17 其实是 `>`），
  // 「gid===1 就跳过」会漏判 —— 第 11 页的 `#` 拿到 gid 17 就被画了出来。
  //
  // 正确判据（两者都指向「无轮廓」才跳过）：
  //   1. cmap 里查不到该码位（hasGlyphFor 为false），**且**
  //   2. Glyphs 对应位置是占位 gid（gid === 1），或没有 Glyphs 信息
  // 这样：私有区假码的正文靠 Glyphs 的非占位 gid 保留；
  //真正无轮廓的 `#` 因 cmap 查不到且 gid 为占位而被剔除。
  //
  // 跳过后**保留 DeltaX 占位**，后续字符绝对坐标不受影响，
  // 与 WPS/Acrobat 打开原 PDF 的表现一致（原 PDF 那格也是空白）。
  function buildTextCodeParts(
    tc,
    ox0,
    oy0,
    hScale,
    readDirection,
    charDirection,
    fontName,
    glyphMap,
  ) {
    const txt = tc.text;
    if (!txt) return "";
    const chars = Array.from(txt); // 按码点，避免代理对被拆成两个字符
    const dxArr = expandDelta(tc.deltaX);
    const dyArr = expandDelta(tc.deltaY);
    const codeStart = tc.codeStart || 0;
    const draw = [];
    let anySkip = false;
    for (let i = 0; i < chars.length; i++) {
      const cp = chars[i].codePointAt(0);
      let ok = true;
      if (!hasGlyphFor(fontName, cp)) {
        // cmap 无此码位 —— 再看 Glyphs 是否为占位
        const gid = glyphMap ? glyphMap[codeStart + i] : undefined;
        const isPlaceholder = gid === undefined || gid === 1;
        ok = !isPlaceholder; // 有真字形（私有区假码）-> 仍要画
      }
      draw.push(ok);
      if (!ok) anySkip = true;
    }
    const step = (i) => (i < dxArr.length ? dxArr[i] : 0);
    const stepY = (i) => (i < dyArr.length ? dyArr[i] : 0);
    const adj = (x) => (hScale !== 1 ? x / hScale : x);
    const vertical = readDirection === 90 || readDirection === 270;
    // CharDirection 是单字符旋转；未指定时竖排沿用阅读方向
    const rot =
      charDirection && charDirection % 360
        ? charDirection
        : vertical
          ? readDirection
          : 0;

    if (vertical) {
      let ox = ox0,
        oy = oy0;
      let s = "";
      for (let i = 0; i < chars.length; i++) {
        const x = adj(ox);
        if (draw[i])
          s += `<tspan x="${x.toFixed(4)}" y="${oy.toFixed(4)}"${rot ? ` transform="rotate(${rot} ${x.toFixed(4)} ${oy.toFixed(4)})"` : ""}>${escapeXml(chars[i])}</tspan>`;
        ox += step(i);
        oy += stepY(i);
      }
      return s;
    }

    // 180：字形保持直立，但字符顺序从右向左排
    let rtlPos = null;
    if (readDirection === 180) {
      let total = 0;
      for (let i = 0; i < chars.length; i++) total += step(i);
      rtlPos = [];
      let prefix = 0;
      for (let i = 0; i < chars.length; i++) {
        prefix += step(i);
        rtlPos.push(ox0 + total - prefix);
      }
    }

    // 常规方向：可合并为一个 tspan；但若需要跳过字符或逐字旋转，则逐字符输出
    if (!anySkip && !rot) {
      let xs = "",
        ys = "",
        ox = ox0,
        oy = oy0;
      for (let i = 0; i < chars.length; i++) {
        const x = rtlPos ? rtlPos[i] : ox;
        xs += (i ? " " : "") + adj(x).toFixed(4);
        ys += (i ? " " : "") + oy.toFixed(4);
        ox += step(i);
        oy += stepY(i);
      }
      return `<tspan x="${xs}" y="${ys}">${escapeXml(txt)}</tspan>`;
    }

    let s = "";
    let ox = ox0,
      oy = oy0;
    for (let i = 0; i < chars.length; i++) {
      const x = rtlPos ? rtlPos[i] : ox;
      const adjX = adj(x);
      // 无轮廓字符 -> 输出空 tspan 只推进坐标，不绘制
      const body = draw[i] ? escapeXml(chars[i]) : "";
      const tr = rot
        ? ` transform="rotate(${rot} ${adjX.toFixed(4)} ${oy.toFixed(4)})"`
        : "";
      s += `<tspan x="${adjX.toFixed(4)}" y="${oy.toFixed(4)}"${tr}>${body}</tspan>`;
      ox += step(i);
      oy += stepY(i);
    }
    return s;
  }

  const fontSize =
    obj.size != null && isFinite(obj.size) && obj.size > 0 ? obj.size : 3;
  const parts = [];
  for (const tc of obj.textCodes) {
    parts.push(
      buildTextCodeParts(
        tc,
        tc.x,
        tc.y,
        hScale,
        obj.readDirection,
        obj.charDirection,
        fv.key || font.fontName,
        obj.glyphMap,
      ),
    );
  }

  let attrs = ` font-family="${escapeXml(fv.family)}" font-size="${fontSize}" font-weight="${weight}" font-style="${fontStyle}" fill="${fill}"`;
  // 文字描边（Stroke/StrokeColor/LineWidth），缺省宽度沿用 DrawParam
  if (obj.stroke) {
    let sw =
      obj.lineWidth != null
        ? obj.lineWidth
        : dp && dp.lineWidth != null
          ? dp.lineWidth
          : 0.7;
    if (!isFinite(sw) || sw < 0) sw = 0.7;
    const sc =
      obj.strokeColor ||
      (dp && dp.strokeColor) || { r: 0, g: 0, b: 0, a: 1 };
    attrs += ` stroke="${colorToCss(sc)}" stroke-width="${sw}"`;
  }
  if (hScale !== 1) attrs += ` transform="scale(${hScale} 1)"`;

  // OFD CTM = [a,b,c,d,e,f]：x' = a*x + c*y + e, y' = b*x + d*y + f
  let transform = `translate(${bx} ${by})`;
  if (obj.ctm)
    transform += ` matrix(${obj.ctm[0]} ${obj.ctm[1]} ${obj.ctm[2]} ${obj.ctm[3]} ${obj.ctm[4]} ${obj.ctm[5]})`;

  return {
    transform,
    inner: `<text${attrs} xml:space="preserve" text-rendering="geometricPrecision">${parts.join("")}</text>`,
  };
}

async function buildImageObject(obj, res) {
  const mm = res.multiMedias[obj.resourceId];
  if (!mm) return null;
  if (!mm.dataUrl) await ensureImageDataUrl(mm); // 渲染到该页时才懒加载图像
  if (!mm.dataUrl) return null;
  const b = obj.boundary;
  if (obj.ctm) {
    // 完整 CTM：单位图像 (0..1) 经 matrix 映射到页面，支持旋转/镜像/斜切
    return {
      transform: `translate(${b.x} ${b.y}) matrix(${obj.ctm.join(" ")})`,
      inner: `<image x="0" y="0" width="1" height="1" href="${escapeXml(mm.dataUrl)}" preserveAspectRatio="none"/>`,
    };
  }
  return {
    transform: `translate(${b.x} ${b.y})`,
    inner: `<image x="0" y="0" width="${b.w}" height="${b.h}" href="${escapeXml(mm.dataUrl)}" preserveAspectRatio="none"/>`,
  };
}

async function buildObjectSvg(obj, res, depth) {
  switch (obj.type) {
    case "path":
      return buildPathObject(obj, res);
    case "text":
      return buildTextObject(obj, res);
    case "image":
      return await buildImageObject(obj, res);
    case "composite":
      return await buildCompositeObject(obj, res, depth);
  }
  return null;
}

export async function renderObject(obj, res, depth = 0) {
  const built = await buildObjectSvg(obj, res, depth);
  if (!built || !built.inner) return "";
  return applyClips(
    built.inner,
    built.transform,
    obj.clips,
    obj.boundary || { x: 0, y: 0, w: 0, h: 0 },
    res,
  );
}

// 收集图元及其引用的 CompositeGraphicUnit 内的图像/字体，供整页预取
export function collectObjectResources(obj, res, imgIds, fontIds, seenUnits) {
  if (!obj) return;
  // 文字裁剪区里的 CT_Text 也要预取字体
  if (obj.clips)
    for (const clip of obj.clips)
      for (const area of clip.areas)
        for (const t of area.texts || [])
          if (t.fontId != null) fontIds.add(t.fontId);
  if (obj.type === "image") {
    imgIds.add(obj.resourceId);
    return;
  }
  if (obj.type === "text" && obj.fontId != null) {
    fontIds.add(obj.fontId);
    return;
  }
  if (obj.type !== "composite") return;
  const unit = res.compositeUnits && res.compositeUnits[obj.resourceId];
  if (!unit || !unit.layers || seenUnits.has(obj.resourceId)) return;
  seenUnits.add(obj.resourceId);
  for (const layer of unit.layers) {
    for (const child of layer.objects || [])
      collectObjectResources(child, res, imgIds, fontIds, seenUnits);
  }
}

// 展开 <ofd:CompositeObject>：把 DocumentRes 里对应 CompositeGraphicUnit 的
// 内部图元套上「Unit 边界 → 页面 CTM/Boundary」的组合变换后渲染。
//
// OFD 渲染语义与 PathObject 一致：图元实际位置 = Boundary原点 + CTM·(内部路径点)，
// Unit 内部的图元用 Unit 自己的 Boundary 作为局部原点，因此合成矩阵为
//   页面变换 = translate(obj.boundary) · obj.ctm · translate(-unit.boundary)
async function buildCompositeObject(obj, res, depth = 0) {
  // 防自引用/互相引用造成无限递归（正常文档不会超过几层）
  if (depth > 64) return null;
  const unit = res.compositeUnits && res.compositeUnits[obj.resourceId];
  if (!unit || !unit.layers) return null;
  const b = obj.boundary;
  const ub = unit.boundary;
  const m = obj.ctm;
  // 组装：先移到页面 Boundary，再按 CTM 变换，最后抵消 Unit 的局部原点
  let tf = `translate(${b.x} ${b.y})`;
  if (m) tf += ` matrix(${m.join(" ")})`;
  if (ub && (ub.x !== 0 || ub.y !== 0)) tf += ` translate(${-ub.x} ${-ub.y})`;
  const parts = [];
  for (const layer of unit.layers) {
    for (const o of layer.objects || [])
      parts.push(await renderObject(o, res, depth + 1));
  }
  const inner = parts.join("");
  if (!inner) return null;
  return { transform: tf, inner };
}

function parseCtxOf(ofd) {
  const doc = ofd.document;
  return {
    version: doc.version || "",
    res: doc.res,
    defaultCs: doc.defaultCs || "",
  };
}

export async function getTemplateLayers(tpl, ofd) {
  if (!tpl._parsed)
    tpl._parsed = await parsePage(tpl.baseLoc, ofd.zip, parseCtxOf(ofd));
  return tpl._parsed.layers;
}

export async function ensurePageParsed(ofd, pageIndex) {
  const doc = ofd.document;
  const p = doc.pages[pageIndex];
  if (!p) throw new Error("页码越界: " + pageIndex);
  if (!p._parsed)
    p._parsed = await parsePage(p.baseLoc, ofd.zip, parseCtxOf(ofd));
  return p._parsed;
}

// 渲染印章（StampAnnot）
// Boundary 定义印章在页面上的位置和大小（OFD 坐标，Y 向下）
// Clip 定义可见区域（Boundary 局部坐标，Y 向下）；骑缝章时 Clip 只占完整印章的一部分
// 页面印章（签章）渲染透明度，1 为完全不透明。文本下方的印章需半透明以便透出字迹。
const SEAL_OPACITY = 0.8;
// 只接受 CSS mix-blend-mode 的标准取值，避免把文档里的字符串直接拼进 style
const BLEND_MODES = new Set([
  "normal", "multiply", "screen", "overlay", "darken", "lighten",
  "color-dodge", "color-burn", "hard-light", "soft-light", "difference",
  "exclusion", "hue", "saturation", "color", "luminosity",
]);
// 多页同时内联时，印章裁剪 ID 必须全局唯一
let _stampClipSeq = 0;

export async function renderStamp(stamp, stampIdx) {
  const b = stamp.boundary;
  const x = b.x,
    y = b.y,
    w = b.w,
    h = b.h;
  // 标记：供前端点击事件定位到对应印章（data-stamp-idx 为「当前页内」印章序号）
  const dataAttr = ' data-stamp-idx="' + stampIdx + '"';

  // 1. OFD 矢量印章：递归渲染印章的 OFD 内容
  if (stamp.sealOfd) {
    const sealPage = stamp.sealOfd.page;
    const sealRes = stamp.sealOfd.res;
    const sealPageBox = sealPage.pageBox || { w: w, h: h };
    const sealW = sealPageBox.w;
    const sealH = sealPageBox.h;

    // 分离路径和文字：先画路径（椭圆环），再画文字（避免椭圆线遮挡文字）
    const pathParts = [],
      textParts = [];
    for (const layer of sealPage.layers) {
      for (const obj of layer.objects) {
        if (obj.type === "text") {
          textParts.push(await renderObject(obj, sealRes));
        } else {
          pathParts.push(await renderObject(obj, sealRes));
        }
      }
    }
    const sealSvg = pathParts.join("") + textParts.join("");

    // 缩放比例：印章 OFD 坐标系 → 页面坐标系
    const scaleX = w / sealW;
    const scaleY = h / sealH;

    const clip = stamp.clip;
    if (
      clip &&
      clip.w > 0 &&
      clip.h > 0 &&
      (clip.x > 0 || clip.y > 0 || clip.w < w || clip.h < h)
    ) {
      // 骑缝章裁剪
      const clipId = "stampClip_" + (++_stampClipSeq);
      const clipSvgX = x + clip.x;
      const clipSvgY = y + clip.y;
      return (
        `<clipPath id="${clipId}"><rect x="${clipSvgX}" y="${clipSvgY}" width="${clip.w}" height="${clip.h}"/></clipPath>` +
        `<g transform="translate(${x} ${y}) scale(${scaleX} ${scaleY})" clip-path="url(#${clipId})" opacity="${SEAL_OPACITY}"${dataAttr}>${sealSvg}</g>`
      );
    }

    return `<g transform="translate(${x} ${y}) scale(${scaleX} ${scaleY})" opacity="${SEAL_OPACITY}"${dataAttr}>${sealSvg}</g>`;
  }

  // 2. PNG 位图印章
  if (stamp.sealDataUrl) {
    const clip = stamp.clip;
    if (
      clip &&
      clip.w > 0 &&
      clip.h > 0 &&
      (clip.x > 0 || clip.y > 0 || clip.w < w || clip.h < h)
    ) {
      const clipId = "stampClip_" + (++_stampClipSeq);
      const clipSvgX = x + clip.x;
      const clipSvgY = y + clip.y;
      return (
        `<clipPath id="${clipId}"><rect x="${clipSvgX}" y="${clipSvgY}" width="${clip.w}" height="${clip.h}"/></clipPath>` +
        `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${escapeXml(stamp.sealDataUrl)}" preserveAspectRatio="none" clip-path="url(#${clipId})" opacity="${SEAL_OPACITY}"${dataAttr}/>`
      );
    }
    return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${escapeXml(stamp.sealDataUrl)}" preserveAspectRatio="none" opacity="${SEAL_OPACITY}"${dataAttr}/>`;
  }

  // 3. 无印章图片也无 OFD 矢量：渲染占位符
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const strokeWidth = Math.max(0.4, Math.min(rx, ry) * 0.06);
  return (
    `<g opacity="${SEAL_OPACITY}"${dataAttr}>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="red" stroke-width="${strokeWidth}" stroke-dasharray="2 1"/>` +
    `</g>`
  );
}

export async function renderAnnot(annot, res) {
  const b = annot.boundary || { x: 0, y: 0, w: 0, h: 0 };
  const rawBlend = String(annot.blendMode || "Normal").toLowerCase();
  const blend = BLEND_MODES.has(rawBlend) ? rawBlend : "normal";
  const style = blend === "normal" ? "" : ` style="mix-blend-mode:${blend}"`;
  const parts = [];
  for (const o of annot.objects || []) parts.push(await renderObject(o, res));
  let out = parts.join("");
  if (out) out = `<g transform="translate(${b.x} ${b.y})"${style}>${out}</g>`;
  // Link 注释本身没有外观，只提供可点击区域；URL 仅允许 http(s)，避免 javascript: 注入
  if (annot.linkUrl && b.w > 0 && b.h > 0 && /^https?:\/\//i.test(annot.linkUrl)) {
    out +=
      `<rect class="ofd-link" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"` +
      ` fill="none" pointer-events="all" data-link-url="${escapeXml(annot.linkUrl)}"/>`;
  }
  return out;
}

export async function sealToSvgString(sealOfd, widthPx) {
  const page = sealOfd.page;
  const res = sealOfd.res;
  const box = page.pageBox || { w: 1, h: 1 };
  let body = "";
  for (const layer of page.layers) {
    for (const obj of layer.objects) body += await renderObject(obj, res);
  }
  const w = widthPx || 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.w} ${box.h}" width="${w}" preserveAspectRatio="xMidYMid meet" style="display:block">${body}</svg>`;
}

