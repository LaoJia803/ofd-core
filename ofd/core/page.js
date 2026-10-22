import { parseXml } from "./parser.js";
import { parseRes } from "./res.js";
import { readEntryText, readZip } from "./zip.js";
import { parseColor } from "../shared/color.js";
import { resolvePath } from "../shared/path.js";
import {
  attr,
  bool,
  child,
  children,
  num,
  parseBox,
  parseMatrix,
  stripNs,
  text,
} from "../shared/xml.js";

// ==================== OFD 页面解析 ====================
// 解析上下文：文档版本（决定 Clips 的 TransFlag 默认值）、资源表（颜色空间）、默认颜色空间
function normalizeCtx(ctx) {
  return ctx || {};
}

// Clips 采用对象空间坐标系：
//   - 多个 Clip 取交集；
//   - 一个 Clip 内的多个 Area（Path）取并集。
// TransFlag 控制裁剪区是否受“图元自身 CTM”影响。OFD 1.2 起缺省为 false；
// 1.1 文档（如 Foxit 产物）实测缺省为 true，否则裁剪区会被缩到左上角。
function parseClips(el, ctx) {
  const clipsEl = child(el, "Clips");
  if (!clipsEl) return null;
  const tfAttr = attr(clipsEl, "TransFlag");
  let transFlag;
  if (tfAttr !== null && tfAttr !== "") {
    transFlag = /^(true|1)$/i.test(tfAttr);
  } else {
    const ver = parseFloat(ctx && ctx.version);
    transFlag = isFinite(ver) ? ver < 1.2 : true;
  }
  const clips = [];
  for (const clipEl of children(clipsEl, "Clip")) {
    const areas = [];
    for (const areaEl of children(clipEl, "Area")) {
      const ctm = parseMatrix(attr(areaEl, "CTM"));
      const paths = children(areaEl, "Path").map((p) => ({
        boundary: parseBox(attr(p, "Boundary")),
        ctm: parseMatrix(attr(p, "CTM")),
        abbr: text(child(p, "AbbreviatedData")),
        rule: attr(p, "Rule"),
      }));
      // Area 的裁剪对象也可以是文字（CT_Text），其结构与 TextObject 相同
      const texts = children(areaEl, "Text").map((t) =>
        parseTextObject(t, undefined, ctx),
      );
      if (paths.length || texts.length) areas.push({ ctm, paths, texts });
    }
    if (areas.length) clips.push({ transFlag, areas });
  }
  return clips.length ? clips : null;
}

export function parseObjectEl(c, layerDp, ctx) {
  const name = stripNs(c.tag);
  if (name === "PathObject") return parsePathObject(c, layerDp, ctx);
  if (name === "TextObject") return parseTextObject(c, layerDp, ctx);
  if (name === "ImageObject") return parseImageObject(c, ctx);
  if (name === "CompositeObject")
    // 复合图元：只记引用，真正的图元在 DocumentRes 的 CompositeGraphicUnit 里。
    // 渲染时由 renderObject 展开（见 display/svg.js）。
    return {
      type: "composite",
      resourceId: attr(c, "ResourceID"),
      ctm: parseMatrix(attr(c, "CTM")),
      boundary: parseBox(attr(c, "Boundary")),
      drawParam: attr(c, "DrawParam") || layerDp,
      clips: parseClips(c, ctx),
    };
  return null;
}

function parseLayer(layerEl, layerDp, ctx) {
  const drawParam = attr(layerEl, "DrawParam") || layerDp;
  const objects = [];
  for (const c of layerEl.children) {
    const obj = parseObjectEl(c, drawParam, ctx);
    if (obj) objects.push(obj);
  }
  return { drawParam, objects };
}

// 解析 DocumentRes/PublicRes 里的 <ofd:CompositeGraphicUnit>，供 CompositeObject 引用展开。
// 两种常见写法都要支持：标准 <Content><Layer><PathObject/></Layer></Content>，
// 以及数科产物 <Content><PathObject/></Content>（图元直接挂在 Content 下）。
export async function parseCompositeUnits(resPath, zip, ctx) {
  ctx = normalizeCtx(ctx);
  const units = {};
  const xmlText = await readEntryText(zip, resPath);
  if (!xmlText) return units;
  const root = parseXml(xmlText).documentElement;
  const list = child(root, "CompositeGraphicUnits");
  if (!list) return units;
  for (const u of children(list, "CompositeGraphicUnit")) {
    const layers = [];
    for (const content of children(u, "Content")) {
      const layerEls = children(content, "Layer");
      if (layerEls.length) {
        for (const l of layerEls) layers.push(parseLayer(l, undefined, ctx));
        // Layer 之外直接挂在 Content 下的图元也不能丢
        const direct = parseLayer(content, undefined, ctx);
        if (direct.objects.length) layers.push(direct);
      } else {
        layers.push(parseLayer(content, undefined, ctx));
      }
    }
    const boundary = attr(u, "Boundary")
      ? parseBox(attr(u, "Boundary"))
      : { x: 0, y: 0, w: num(u, "Width", 0), h: num(u, "Height", 0) };
    units[attr(u, "ID")] = { boundary, layers };
  }
  return units;
}

// 解析填充/描边色节点里的渐变子元素（OFD AxialShd / RadialShd）。
// 返回 null 表示普通纯色（调用方走 parseColor）；否则返回
//   { kind:'axial'|'radial', extend, start:[x,y,(r)], end:[x,y,(r)], stops:[{pos,color}] }
// StartPoint/EndPoint 与 AbbreviatedData 同在对象用户坐标系（渐变按 userSpaceOnUse 对齐）。
export function parseGradient(el, res, defaultCs) {
  if (!el) return null;
  const ax = child(el, "AxialShd");
  const rad = child(el, "RadialShd");
  const g = ax || rad;
  if (!g) return null;
  const nums = (s) =>
    (s || "")
      .trim()
      .split(/\s+/)
      .map(parseFloat)
      .filter((n) => !isNaN(n));
  const readStops = (name) =>
    children(g, name).map((seg) => {
      let pos = parseFloat(
        attr(seg, "Position") != null ? attr(seg, "Position") : attr(seg, "Offset"),
      );
      if (isNaN(pos)) pos = null;
      const colorEl = child(seg, "Color") || seg;
      return { pos, color: parseColor(colorEl, res, defaultCs) };
    });
  let stops = readStops("Segment");
  if (!stops.length) stops = readStops("Stop");
  // 缺省 Position 时按下标均分 0..1
  if (stops.some((s) => s.pos === null)) {
    const n = stops.length || 1;
    stops = stops.map((s, i) => ({ pos: s.pos === null ? i / (n - 1 || 1) : s.pos, color: s.color }));
  }
  return {
    kind: ax ? "axial" : "radial",
    extend: attr(g, "Extend") || "",
    start: nums(attr(g, "StartPoint")),
    end: nums(attr(g, "EndPoint")),
    stops,
  };
}

function parsePathObject(el, layerDp, ctx) {
  ctx = normalizeCtx(ctx);
  const fillEl = child(el, "FillColor");
  const strokeEl = child(el, "StrokeColor");
  const abbr = child(el, "AbbreviatedData");
  const fillGrad = parseGradient(fillEl, ctx.res, ctx.defaultCs);
  const strokeGrad = parseGradient(strokeEl, ctx.res, ctx.defaultCs);
  return {
    type: "path",
    id: attr(el, "ID"),
    boundary: parseBox(attr(el, "Boundary")),
    ctm: parseMatrix(attr(el, "CTM")),
    lineWidth: num(el, "LineWidth", null),
    dash: attr(el, "DashPattern") || null,
    stroke: bool(el, "Stroke", true),
    fill: bool(el, "Fill", false),
    fillColor: fillGrad
      ? null
      : fillEl
        ? parseColor(fillEl, ctx.res, ctx.defaultCs)
        : null,
    fillGradient: fillGrad,
    strokeColor: strokeGrad
      ? null
      : strokeEl
        ? parseColor(strokeEl, ctx.res, ctx.defaultCs)
        : null,
    strokeGradient: strokeGrad,
    abbreviatedData: abbr ? text(abbr) : "",
    rule: attr(el, "Rule"),
    drawParam: attr(el, "DrawParam") || layerDp,
    clips: parseClips(el, ctx),
  };
}

// 解析 <ofd:CGTransform>/<ofd:Glyphs>：字符码位 -> 字形索引的显式映射。
//
// 为什么必须解析：TextCode 的文本只是「可搜索副本」，真实字形由 Glyphs 指定。
// 子集字体里相当多的码位没有 cmap 映射（例如图表刻度标签里的
// `#`），浏览器按 Unicode 交给 @font-face 时查不到轮廓，
// 会按字体回退链显示成另一个符号 —— 表现就是「图表标签多出 # 等杂符号」。
// 拿到 Glyphs 后，引擎可以逐字定位，让缺字形的字符只影响自己。
//
// 一个 TextObject 可以包含多个 CGTransform，各自用 CodePosition/CodeCount
// 指定覆盖的字符区间；多个 TextCode 之间也要按累计字符偏移取字形。
function parseGlyphMap(el) {
  const segments = [];
  for (const cg of children(el, "CGTransform")) {
    const g = child(cg, "Glyphs");
    if (!g) continue;
    const raw = (g.text || "").trim();
    if (!raw) continue;
    const gids = raw.split(/\s+/).map(Number);
    if (!gids.length || gids.some((n) => !Number.isFinite(n))) continue;
    const cp = +attr(cg, "CodePosition");
    const cc = +attr(cg, "CodeCount");
    segments.push({
      codePosition: Number.isFinite(cp) && cp >= 0 ? cp : 0,
      codeCount:
        Number.isFinite(cc) && cc > 0
          ? Math.min(cc, 1000000)
          : gids.length,
      glyphs: gids,
    });
  }
  if (!segments.length) return null;
  const map = [];
  for (const seg of segments) {
    for (let j = 0; j < seg.codeCount; j++) {
      // GlyphCount < CodeCount 时，规范约定重复使用最后一个字形
      const gid = seg.glyphs[Math.min(j, seg.glyphs.length - 1)];
      map[seg.codePosition + j] = gid;
    }
  }
  return map;
}

function parseTextObject(el, layerDp, ctx) {
  ctx = normalizeCtx(ctx);
  const fillEl = child(el, "FillColor");
  const strokeEl = child(el, "StrokeColor");
  const textCodes = children(el, "TextCode").map((tc) => ({
    x: num(tc, "X", 0),
    y: num(tc, "Y", 0),
    deltaX: attr(tc, "DeltaX"),
    deltaY: attr(tc, "DeltaY"),
    // 仅剥离 XML 缩进产生的换行空白；保留行内首尾空格字形（它们按 DeltaX 占位，
    // 若误删会导致后续字符合并到窄间距重叠，整段文字挤成一团）
    text: (tc.text || "").replace(/^\s*\n[\s ]*/, "").replace(/[\s ]*\n\s*$/, ""),
  }));
  // CGTransform 的 CodePosition 以 TextObject 的全文为基准；为每个 TextCode
  // 记录累计字符偏移（按码点计数，避免代理对把后续字形整体错位）。
  let codeOffset = 0;
  for (const tc of textCodes) {
    tc.codeStart = codeOffset;
    codeOffset += Array.from(tc.text).length;
  }
  const glyphMap = parseGlyphMap(el);
  return {
    type: "text",
    id: attr(el, "ID"),
    boundary: parseBox(attr(el, "Boundary")),
    ctm: parseMatrix(attr(el, "CTM")),
    fontId: attr(el, "Font"),
    size: num(el, "Size", null),
    readDirection: num(el, "ReadDirection", 0),
    charDirection: num(el, "CharDirection", 0),
    hScale: num(el, "HScale", 1),
    lineWidth: num(el, "LineWidth", null),
    weight: num(el, "Weight", 400),
    italic: bool(el, "Italic", false),
    stroke: bool(el, "Stroke", false),
    fill: bool(el, "Fill", true),
    fillColor: fillEl
      ? parseColor(fillEl, ctx.res, ctx.defaultCs)
      : { r: 0, g: 0, b: 0, a: 1 },
    strokeColor: strokeEl
      ? parseColor(strokeEl, ctx.res, ctx.defaultCs)
      : null,
    textCodes,
    // 全文逐字字形索引；null 表示未提供 Glyphs
    glyphMap,
    drawParam: attr(el, "DrawParam") || layerDp,
    clips: parseClips(el, ctx),
  };
}

function parseImageObject(el, ctx) {
  return {
    type: "image",
    boundary: parseBox(attr(el, "Boundary")),
    ctm: parseMatrix(attr(el, "CTM")),
    resourceId: attr(el, "ResourceID"),
    clips: parseClips(el, ctx),
  };
}

export async function parsePage(pagePath, zip, ctx) {
  ctx = normalizeCtx(ctx);
  const xmlText = await readEntryText(zip, pagePath);
  if (!xmlText) return { pagePath, pageBox: null, templates: [], layers: [] };
  const root = parseXml(xmlText).documentElement;
  const area = child(root, "Area");
  let pageBox = null;
  if (area) {
    const box = child(area, "PhysicalBox");
    if (box) pageBox = parseBox(text(box));
  }
  const templates = children(root, "Template").map((t) => ({
    templateId: attr(t, "TemplateID"),
    zOrder: attr(t, "ZOrder") || "Background",
  }));
  const content = child(root, "Content");
  const layers = content
    ? children(content, "Layer").map((l) => parseLayer(l, undefined, ctx))
    : [];
  return { pagePath, pageBox, templates, layers };
}

export async function parseSealOfd(sealZipBytes) {
  try {
    const sealZip = await readZip(sealZipBytes);
    // 读取 OFD.xml
    const ofdXmlText = await readEntryText(sealZip, "OFD.xml");
    if (!ofdXmlText) return null;
    const ofdRoot = parseXml(ofdXmlText).documentElement;
    const version = attr(ofdRoot, "Version") || "";
    const docBody = child(ofdRoot, "DocBody");
    if (!docBody) return null;
    const docEle = child(docBody, "DocRoot");
    if (!docEle) return null;
    const docPath = text(docEle);

    // 读取 Document.xml
    const docXmlText = await readEntryText(sealZip, docPath);
    if (!docXmlText) return null;
    const docRoot = parseXml(docXmlText).documentElement;

    // 解析公共资源（CommonData > PublicRes）
    let res = {
      fonts: {},
      colorSpaces: {},
      multiMedias: {},
      drawParams: {},
      compositeUnits: {},
    };
    const commonDataEl = child(docRoot, "CommonData");
    const defaultCs = commonDataEl
      ? text(child(commonDataEl, "DefaultCS"))
      : "";
    if (commonDataEl) {
      const publicResEl = child(commonDataEl, "PublicRes");
      if (publicResEl) {
        const publicResPath = resolvePath(docPath, text(publicResEl));
        res = await parseRes(publicResPath, sealZip, defaultCs);
      }
    }

    // 解析第一个页面
    const pagesEl = child(docRoot, "Pages");
    if (!pagesEl) return null;
    const pageEl = child(pagesEl, "Page");
    if (!pageEl) return null;
    const pageBaseLoc = attr(pageEl, "BaseLoc");
    if (!pageBaseLoc) return null;
    const pagePath = resolvePath(docPath, pageBaseLoc);
    const page = await parsePage(pagePath, sealZip, {
      version,
      res,
      defaultCs: null,
    });

    return { page, res, pagePath };
  } catch (e) {
    console.warn("parseSealOfd error:", e);
    return null;
  }
}
