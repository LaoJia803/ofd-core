import { readEntry } from "../core/zip.js";
import { resolvePath } from "../shared/path.js";

// ==================== SVG 渲染 ====================
const FONT_VARIANT_SUFFIX = [
  "BoldItalic",
  "Bold",
  "Italic",
  "Black",
  "Heavy",
  "ExtraBold",
  "SemiBold",
  "DemiBold",
  "Medium",
  "Regular",
  "Book",
  "Light",
];
const FONT_VARIANT_RE = new RegExp(
  "^(.*?)[-\\s]+(" + FONT_VARIANT_SUFFIX.join("|") + ")$",
  "i",
);
const FONT_WEIGHT_MAP = {
  bold: "700",
  black: "900",
  heavy: "900",
  extrabold: "800",
  semibold: "600",
  demibold: "600",
  medium: "500",
  light: "300",
  regular: "normal",
  book: "normal",
};
export function splitFontVariant(fontName) {
  if (!fontName) return { base: fontName, weight: "", style: "" };
  const m = fontName.match(FONT_VARIANT_RE);
  if (!m) return { base: fontName, weight: "", style: "" };
  const suf = m[2].toLowerCase();
  return {
    base: m[1],
    weight: FONT_WEIGHT_MAP[suf] || "",
    style: suf === "italic" || suf === "bolditalic" ? "italic" : "normal",
  };
}

function cssFontName(name) {
  return String(name).replace(/["\\]/g, "");
}

// 精确字体名匹配表（模块级常量，避免每次调用重建正则）
const BUILTIN_FONT_EXACT = [
  [/dengxian|等线/, '"DengXian","等线",sans-serif'],
  [/yahei|微软雅黑/, '"Microsoft YaHei","微软雅黑",sans-serif'],
  [/pingfang|苹方/, '"PingFang SC","苹方",sans-serif'],
  [
    /source han sans|sourcehansans|noto sans|notosans|思源黑体|鸿蒙|harmonyos/,
    '"Source Han Sans SC","Noto Sans CJK SC","HarmonyOS Sans SC","思源黑体",sans-serif',
  ],
  [
    /source han serif|sourcehanserif|noto serif|notoserif|思源宋体/,
    '"Source Han Serif SC","Noto Serif CJK SC","思源宋体",serif',
  ],
];

export function builtinFontStack(fontName) {
  if (!fontName) return "sans-serif";
  const n = fontName.toLowerCase();
  for (let i = 0; i < BUILTIN_FONT_EXACT.length; i++) {
    if (BUILTIN_FONT_EXACT[i][0].test(n)) return BUILTIN_FONT_EXACT[i][1];
  }
  if (fontName.includes("仿") || n === "fangsong" || n.includes("fang"))
    return '"仿宋",FangSong,"STFangsong",serif';
  if (fontName.includes("宋") || n === "simsun" || n.includes("song"))
    return '"宋体",SimSun,"Songti SC",serif';
  if (fontName.includes("楷") || n === "kaiti" || n.includes("kai"))
    return '"楷体",KaiTi,"STKaiti",serif';
  if (fontName.includes("黑") || n === "simhei" || n.includes("hei"))
    return '"黑体",SimHei,"Heiti SC",sans-serif';
  if (fontName.includes("隶")) return '"隶书","LiSu",serif';
  if (fontName.includes("行")) return '"行楷","Xingkai SC",cursive';
  if (n.includes("courier")) return '"Courier New",Courier,monospace';
  if (n.includes("times")) return '"Times New Roman",serif';
  if (n.includes("arial") || n.includes("helvetica"))
    return "Arial,Helvetica,sans-serif";
  return null;
}

const localFontCache = new Map();
export function localFontAvailable(fontName) {
  if (
    !fontName ||
    typeof document === "undefined" ||
    !document.fonts ||
    !document.fonts.check
  )
    return false;
  if (localFontCache.has(fontName)) return localFontCache.get(fontName);
  let ok = false;
  try {
    ok = document.fonts.check('16px "' + cssFontName(fontName) + '"');
  } catch (e) {
    console.warn("[OFD] 检查本地字体可用性失败", e);
  }
  localFontCache.set(fontName, ok);
  return ok;
}

// 判断某个字体是否有内嵌字体文件可用（有则必须优先用内嵌的）
//
// fontId 传入时走精确匹配：同名不同 ID 的字体文件不同（实测 5 个 Calibri），
// 只按名字匹配会张冠李戴。查不到再退回按名字匹配，保持对旧产物的兼容。
//
// 注意变体后缀：res.fonts[id].fontName 可能是 "DengXian-Regular"，
// 而 mapFontFamily 里的 base 是 "DengXian"。registerEmbeddedFonts 两个 key 都登记，
// 这里也两种形态都试，否则带后缀的字体会被误判为「无内嵌」而走系统字体栈。
export function hasEmbeddedFont(fontName, fontId) {
  if (!fontName || !embeddedFontMap.size) return false;
  const base = splitFontVariant(fontName).base || fontName;
  if (fontId) {
    if (embeddedFontMap.has("ofdf_" + fontId + "_" + base)) return true;
    if (embeddedFontMap.has("ofdf_" + fontId + "_" + fontName)) return true;
  }
  if (embeddedFontMap.has(base)) return true;
  if (embeddedFontMap.has(fontName)) return true;
  const lower = base.toLowerCase();
  for (const k of embeddedFontMap.keys()) {
    const kl = k.toLowerCase();
    if (kl === lower || kl.startsWith(lower + "-") || lower.startsWith(kl + "-")) return true;
  }
  return false;
}

// 字体 family 的选择顺序：
//   1) **内嵌字体**（OFD 包里带FontFile 的那个）—— 与 WPS/数科 一致，必须优先
//   2) 系统字体栈（builtinFontStack）—— 仅在无内嵌字体时兜底
//   3) 本地同名字体 → 4) 按字体名直接引用
//
// 旧顺序是「系统字体优先」，导致 Helvetica 被映射到系统 Arial、
// Calibri 被映射到系统 Calibri，内嵌字体永远加载不上 ——
// 表现就是自家 viewer 的字形与 PDF 原稿、和 WPS 都不一致。
// 修复前实测：数科那份 24 个字体里 Helvetica/Calibri 系列全部走系统字体。
//
// fontId 用于生成**唯一** family 名（见 uniqueFamily 注释）：
// 同名不同 ID 的多个内嵌字体必须各自注册，否则只有第一个生效。
export function mapFontFamily(fontName, fontId) {
  const v = splitFontVariant(fontName);
  const base = v.base || fontName;
  const familyName = uniqueFamily(fontId, base);
  if (
    (hasEmbeddedFont(fontName, fontId) || hasEmbeddedFont(base, fontId)) &&
    embeddedLoaded.has(familyName)
  ) {
    // 内嵌字体确实已加载（@font-face 注册成功）：用唯一 family 名
    return { family: '"' + cssFontName(familyName) + '",sans-serif', weight: v.weight, style: v.style, embedded: true, key: familyName };
  }
  // 声明了内嵌但字节缺失 / 加载失败：不锁定内嵌名，继续往下走系统栈兜底
  let family = builtinFontStack(base) || builtinFontStack(fontName);
  if (!family && localFontAvailable(base))
    family = '"' + cssFontName(base) + '",sans-serif';
  if (!family) {
    ensureFontLoaded(familyName, fontId);
    family = '"' + cssFontName(familyName) + '",sans-serif';
  }
  return { family, weight: v.weight, style: v.style, embedded: false, key: familyName };
}

// ==================== 字体加载 ====================
let fontBase = "";
const FONT_EXTS = ["ttf", "otf", "woff2"];
const fontLoadCache = new Map();
export const embeddedFontMap = new Map();
// 真正加载成功的内嵌 family 名集合（loadFontFace 从包里读到字节并注册 @font-face 后加入）。
// mapFontFamily 仅在此命中时才锁定内嵌唯一名；声明了内嵌但文件缺失/读取失败时，
// 继续走系统字体栈 / 本机同名字体 / 外部目录兜底，避免文字落在一个不存在的字体名上。
const embeddedLoaded = new Set();
// Font ID -> 唯一的 @font-face family 名
//
// 为什么必须按 ID 区分：OFD 允许同一个 FontName 声明多次（不同 ID 指向不同字体文件）。
// 实测某份转换产物里 5 个不同 ID（121~125）都叫 Calibri，
// 各自的 cmap / 字形集完全不同（Font 122 有 `#` 的真实轮廓 gid 17，
// Font 123 则完全没有）。
// 若只用 fontName 做 key，ensureFontLoaded('Calibri') 只会加载**第一个**，
// 其余 4 个的 @font-face 从未注册 —— 浏览器静默回退到系统字体，
// 字形与度量全乱（第 13 页整页乱码的真凶）。
//
// 解决：family 名用 `<FontID>_<FontName>` 保证唯一，
// 同时把 cmap 也按这个唯一名缓存，hasGlyphFor 才能判准。
export function uniqueFamily(fontId, fontName) {
  return fontId ? "ofdf_" + fontId + "_" + (fontName || "unknown") : fontName;
}

function resolveFontBase() {
  if (fontBase) return fontBase;
  if (typeof document === "undefined") return "font/";
  const scripts = document.getElementsByTagName("script");
  for (let i = 0; i < scripts.length; i++) {
    const src = scripts[i].src || "";
    if (/\/ofd(\.min)?\.js(\?|#|$)/.test(src)) {
      const dir = src.slice(0, src.lastIndexOf("/") + 1);
      // 兼容两种构建布局：build/ofd/ofd.min.js（子目录）与旧发行 zip 的
      // build/ofd.min.js（平铺）。两者都指向包根的 font/，而不是 build/font/。
      const m = /^(.*\/)?build\/(?:ofd\/)?$/.exec(dir);
      fontBase = (m ? m[1] || "" : dir.replace(/[^/]*\/$/, "")) + "font/";
      return fontBase;
    }
  }
  return "font/";
}

// familyName：唯一 family 名（uniqueFamily 产物）
// fontId：Font ID，用于在 embeddedFontMap 里精确定位字体文件（同名多 ID 时必需）
export function ensureFontLoaded(familyName, fontId) {
  if (!familyName) return Promise.resolve(false);
  if (fontLoadCache.has(familyName)) return fontLoadCache.get(familyName);
  const p = loadFontFace(familyName, fontId).then(
    (ok) => {
      if (ok) embeddedLoaded.add(familyName);
      return ok;
    },
    () => false,
  );
  fontLoadCache.set(familyName, p);
  return p;
}

// 码位 -> 字形索引 的反向能力（判断某字符在**内嵌字体**里是否真有轮廓）。
//
// 为什么需要：TextObject 的 Glyphs 里，查不到字形的码位会被转换器写成 gid 1，
// 但「gid 1」在不同子集字体里指向的东西完全不同（实测 Calibri 子集里
// gid 1 无人引用、gid 17 其实是 `>`），单看 Glyphs 无法判断某字符该不该画。
// 而浏览器拿不到轮廓时会走字体回退链，把整串文字的字形与度量全部打乱，
// 表现为「乱码」。
//
// 正确做法：解析内嵌字体自己的 cmap，直接回答「这个码位有没有轮廓」。
const fontCmapCache = new Map();

function parseSfntCmap(buf) {
  const map = new Map();
  try {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    if (dv.byteLength < 12) return map;
    const numTables = dv.getUint16(4);
    let cmapOff = -1,
      cmapLen = 0;
    for (let i = 0; i < numTables; i++) {
      const o = 12 + i * 16;
      const tag = String.fromCharCode(
        dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3),
      );
      if (tag === "cmap") {
        cmapOff = dv.getUint32(o + 8);
        cmapLen = dv.getUint32(o + 12);
        break;
      }
    }
    if (cmapOff < 0 || cmapLen < 4) return map;
    const n = dv.getUint16(cmapOff + 2);
    // 优先 3,10(Unicode BMP) > 3,1(Windows BMP) > 0,x > 3,0(symbol)
    let best = -1,
      bestScore = -1;
    for (let i = 0; i < n; i++) {
      const r = cmapOff + 4 + i * 8;
      const pid = dv.getUint16(r),
        eid = dv.getUint16(r + 2);
      const off = dv.getUint32(r + 4);
      let score = 0;
      if (pid === 3 && eid === 10) score = 5;
      else if (pid === 3 && eid === 1) score = 4;
      else if (pid === 0) score = 3;
      else if (pid === 3 && eid === 0) score = 1;
      if (score > bestScore) {
        bestScore = score;
        best = cmapOff + off;
      }
    }
    if (best < 0) return map;
    const fmt = dv.getUint16(best);
    if (fmt === 4) {
      const segX2 = dv.getUint16(best + 6),
        seg = segX2 >> 1;
      const endO = best + 14,
        startO = endO + segX2 + 2;
      const deltaO = startO + segX2,
        rangeO = deltaO + segX2;
      for (let s = 0; s < seg; s++) {
        const end = dv.getUint16(endO + s * 2);
        const start = dv.getUint16(startO + s * 2);
        const delta = dv.getInt16(deltaO + s * 2);
        const ro = dv.getUint16(rangeO + s * 2);
        if (start === 0xffff) continue;
        for (let c = start; c <= end && c !== 0x10000; c++) {
          let g;
          if (ro === 0) g = (c + delta) & 0xffff;
          else {
            const gi = rangeO + s * 2 + ro + (c - start) * 2;
            if (gi + 1 >= dv.byteLength) continue;
            g = dv.getUint16(gi);
            if (g !== 0) g = (g + delta) & 0xffff;
          }
          if (g) map.set(c, g);
        }
      }
    } else if (fmt === 12) {
      const nGroups = dv.getUint32(best + 12);
      for (let i = 0; i < nGroups; i++) {
        const o = best + 16 + i * 12;
        const sc = dv.getUint32(o),
          ec = dv.getUint32(o + 4),
          sg = dv.getUint32(o + 8);
        for (let c = sc; c <= ec; c++) map.set(c, sg + (c - sc));
      }
    }
  } catch (e) {
    /* 解析失败按「无信息」处理 */
  }
  return map;
}

// 登记内嵌字体的 cmap（loadFontFace 拿到字节后调用）
function cacheFontCmap(fontName, bytes) {
  if (!fontName || !bytes || fontCmapCache.has(fontName)) return;
  try {
    fontCmapCache.set(fontName, parseSfntCmap(bytes));
  } catch (e) {
    fontCmapCache.set(fontName, new Map());
  }
}

// 该码位在指定内嵌字体里是否真有轮廓
export function hasGlyphFor(fontName, codePoint) {
  const cm = fontCmapCache.get(fontName);
  if (!cm) return true; // 无信息 -> 不干预，保持原有行为
  if (!cm.size) return true;
  return cm.has(codePoint);
}

async function loadFontFace(familyName, fontId) {
  if (
    typeof FontFace === "undefined" ||
    typeof document === "undefined" ||
    !document.fonts
  )
    return false;

  // 按 Font ID 精确取。key 形态由 registerEmbeddedFonts 决定：
  //   uniqueFamily(fontId, base) 与 uniqueFamily(fontId, rawName) 两个都会登记，
  //   这里逐个试；都 miss 再退回按 family 名/字体名匹配。
  let emb = null;
  if (fontId && familyName) {
    const m = /^ofdf_[^_]+_(.+)$/.exec(familyName);
    const rawName = m ? m[1] : familyName;
    emb =
      embeddedFontMap.get(familyName) ||
      embeddedFontMap.get(rawName) ||
      null;
  }
  if (!emb && familyName) {
    // familyName 形如 ofdf_<id>_<name>，取尾部原名做匹配
    const m = /^ofdf_[^_]+_(.+)$/.exec(familyName);
    const rawName = m ? m[1] : familyName;
    emb =
      embeddedFontMap.get(familyName) ||
      embeddedFontMap.get(rawName) ||
      null;
    if (!emb) {
      const lower = rawName.toLowerCase();
      for (const [k, v] of embeddedFontMap) {
        const kl = k.toLowerCase();
        if (
          kl === lower ||
          kl.startsWith(lower + "-") ||
          lower.startsWith(kl + "-")
        ) {
          emb = v;
          break;
        }
      }
    }
  }
  if (emb && emb._zip && emb.fontFile) {
    try {
      const fontPath = resolvePath(emb.baseDir + "/_.x", emb.fontFile);
      const bytes = await readEntry(emb._zip, fontPath);
      if (bytes) {
        // 必须传 bytes 本身：Stored 条目是 ZIP 的 subarray，bytes.buffer 会从 ZIP 头开始解析
        const face = new FontFace(familyName, bytes);
        await face.load();
        document.fonts.add(face);
        // 同步解析 cmap：供 hasGlyphFor 判断某码位在本格栅字体里是否真有轮廓
        // 按唯一 family 名缓存 —— 同名不同 ID 的字体 cmap 完全不同
        cacheFontCmap(familyName, bytes);
        return true;
      }
    } catch (e) {
      console.warn("[OFD] 加载内嵌字体失败：" + familyName, e);
    }
  }

  const index = await fetchFontIndex();
  let loaded = false;
  if (index) {
    // 外部字体目录按**原始字体名**索引，不带 ID 前缀
    const rawName = /^ofdf_[^_]+_(.+)$/.exec(familyName);
    const lookupName = rawName ? rawName[1] : familyName;
    for (const ext of FONT_EXTS) {
      const file = lookupName + "." + ext;
      if (index.indexOf(file) === -1) continue;
      const url =
        resolveFontBase() + encodeURIComponent(lookupName) + "." + ext;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const ab = await res.arrayBuffer();
        const face = new FontFace(familyName, ab);
        await face.load();
        document.fonts.add(face);
        cacheFontCmap(familyName, new Uint8Array(ab));
        loaded = true;
        break;
      } catch (e) {
        console.warn("[OFD] 加载字体文件失败：" + url, e);
      }
    }
  }
  if (!loaded) {
    // 有内置映射或本机同名字体可兜底时，mapFontFamily 会用系统字体渲染（非默认字体），不再告警
    const m = /^ofdf_[^_]+_(.+)$/.exec(familyName);
    const base = m ? m[1] : familyName;
    if (!(builtinFontStack(base) || builtinFontStack(familyName) || localFontAvailable(base))) {
      console.warn('[OFD] 未找到字体 "' + familyName + '"，且无系统映射，回退 sans-serif');
    }
  }
  return loaded;
}

let fontIndexCache = null;
// 切换文档时清空所有字体状态，并移除上一份文档注册的 @font-face。
// 仅清 Map 不够：同名 family 的旧 FontFace 仍留在 document.fonts 里，
// 新文档同 FontID/字体名会命中旧字形。
export function resetFontCaches() {
  embeddedFontMap.clear();
  embeddedLoaded.clear();
  fontLoadCache.clear();
  fontCmapCache.clear();
  fontIndexCache = null;
  if (typeof document !== "undefined" && document.fonts) {
    try {
      const stale = [];
      document.fonts.forEach((face) => {
        if (face && face.family && /^ofdf_/.test(face.family))
          stale.push(face);
      });
      for (const face of stale) document.fonts.delete(face);
    } catch (e) {
      // 某些环境没有 FontFaceSet.delete，忽略即可
    }
  }
}
export function fetchFontIndex() {
  if (fontIndexCache) return fontIndexCache;
  fontIndexCache = fetch(resolveFontBase())
    .then((res) => {
      if (!res.ok) return null;
      return res.text();
    })
    .then((html) => {
      if (!html) return null;
      const names = [];
      const re = /href="([^"]+)"/g;
      let m;
      while ((m = re.exec(html)))
        names.push(decodeURIComponent(m[1].split(/[?#]/)[0]));
      return names;
    })
    .catch(() => null);
  return fontIndexCache;
}

// ==================== 内嵌字体登记 ====================
// 把 OFD 资源里声明了 <ofd:FontFile> 的字体登记进 embeddedFontMap。
//
// 为什么必须有这一步：embeddedFontMap 原本只读不写，导致：
//   1) hasEmbeddedFont() 恒返回 false  -> mapFontFamily 永远走 builtinFontStack
//   2) loadFontFace() 找不到 emb       -> 只能退回 font/ 目录
// 而 font/ 目录不存在，于是全部字体落sans-serif（Windows 上解析为黑体）——
// 这就是「所有字体都显示为黑体」的直接原因。
//
// 参照 ensureImageDataUrl(mm) 的做法：res.fonts[id] 本身就带
// fontFile / fontBaseDir / _zip，直接登记即可，无需额外 I/O。
//
// **登记的 key 必须与 mapFontFamily 生成的 family 名严格一致**，否则
// loadFontFace 按familyName 反查会miss。这里有两条命名路径：
//   mapFontFamily → uniqueFamily(fontId, v.base || fontName)
//   v.base 是 splitFontVariant 剥掉 -Regular/-Bold 等后缀后的**基名**
// 所以必须用同一个 base 拼 key。实测踩过的坑：
//   res.fonts[1289].fontName = "DengXian-Regular"
//   若按原名登记 → key "ofdf_1289_DengXian-Regular"
//   但 mapFontFamily 产出的是 "ofdf_1289_DengXian"（base）
//   查找 miss → 退回 font/ 目录 → 加载失败 → sans-serif → 黑体
export function registerEmbeddedFonts(fonts) {
  if (!fonts) return;
  for (const key in fonts) {
    const f = fonts[key];
    if (!f || !f.fontFile || !f._zip) continue;
    const name = f.fontName || f.familyName;
    if (!name) continue;
    const entry = {
      fontFile: f.fontFile,
      baseDir: f.fontBaseDir || "",
      _zip: f._zip,
    };
    // 基名（与 mapFontFamily 的 uniqueFamily 参数一致）—— 主路径，必须命中
    const base = splitFontVariant(name).base || name;
    const uniqBase = uniqueFamily(key, base);
    if (!embeddedFontMap.has(uniqBase)) embeddedFontMap.set(uniqBase, entry);
    // 原名（含变体后缀）—— mapFontFamily 未剥后缀时用得到
    const uniqRaw = uniqueFamily(key, name);
    if (!embeddedFontMap.has(uniqRaw)) embeddedFontMap.set(uniqRaw, entry);
    // 裸名条目，兼容按字体名查找的旧路径
    if (!embeddedFontMap.has(base)) embeddedFontMap.set(base, entry);
    if (!embeddedFontMap.has(name)) embeddedFontMap.set(name, entry);
  }
}

export function setFontBase(base) {
  fontBase = base || "";
}

function getEmbeddedFontNames() {
  return Array.from(embeddedFontMap.keys());
}

