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
  function splitFontVariant(fontName) {
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

  function builtinFontStack(fontName) {
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
  function localFontAvailable(fontName) {
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

  function mapFontFamily(fontName) {
    const v = splitFontVariant(fontName);
    const base = v.base || fontName;
    let family = builtinFontStack(base) || builtinFontStack(fontName);
    if (!family && localFontAvailable(base))
      family = '"' + cssFontName(base) + '",sans-serif';
    if (!family) {
      ensureFontLoaded(base);
      if (base !== fontName) ensureFontLoaded(fontName);
      family = '"' + cssFontName(base) + '",sans-serif';
    }
    return { family, weight: v.weight, style: v.style };
  }

  // ==================== 字体加载 ====================
  let fontBase = "";
  const FONT_EXTS = ["ttf", "otf", "woff2"];
  const fontLoadCache = new Map();
  const embeddedFontMap = new Map();

  function resolveFontBase() {
    if (fontBase) return fontBase;
    if (typeof document === "undefined") return "font/";
    const scripts = document.getElementsByTagName("script");
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src || "";
      if (/\/ofd\.js(\?|#|$)/.test(src)) {
        const dir = src.slice(0, src.lastIndexOf("/") + 1);
        fontBase = dir.replace(/[^/]*\/$/, "") + "font/";
        return fontBase;
      }
    }
    return "font/";
  }

  function ensureFontLoaded(fontName) {
    if (!fontName) return Promise.resolve(false);
    if (fontLoadCache.has(fontName)) return fontLoadCache.get(fontName);
    const p = loadFontFace(fontName).then(
      (ok) => ok,
      () => false,
    );
    fontLoadCache.set(fontName, p);
    return p;
  }

  async function loadFontFace(fontName) {
    if (
      typeof FontFace === "undefined" ||
      typeof document === "undefined" ||
      !document.fonts
    )
      return false;

    let emb = embeddedFontMap.get(fontName);
    if (!emb) {
      const lower = fontName.toLowerCase();
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
    if (emb && emb._zip && emb.fontFile) {
      try {
        const fontPath = resolvePath(emb.baseDir + "/_.x", emb.fontFile);
        const bytes = await readEntry(emb._zip, fontPath);
        if (bytes) {
          const face = new FontFace(fontName, bytes.buffer);
          await face.load();
          document.fonts.add(face);
          return true;
        }
      } catch (e) {
        console.warn("[OFD] 加载内嵌字体失败：" + fontName, e);
      }
    }

    const index = await fetchFontIndex();
    let loaded = false;
    if (index) {
      for (const ext of FONT_EXTS) {
        const file = fontName + "." + ext;
        if (index.indexOf(file) === -1) continue;
        const url =
          resolveFontBase() + encodeURIComponent(fontName) + "." + ext;
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const face = new FontFace(fontName, await res.arrayBuffer());
          await face.load();
          document.fonts.add(face);
          loaded = true;
          break;
        } catch (e) {
          console.warn("[OFD] 加载字体文件失败：" + url, e);
        }
      }
    }
    if (!loaded) {
      console.warn('[OFD] 未找到映射字体 "' + fontName + '"，已回退默认字体');
    }
    return loaded;
  }

  let fontIndexCache = null;
  function fetchFontIndex() {
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

  function setFontBase(base) {
    fontBase = base || "";
  }

