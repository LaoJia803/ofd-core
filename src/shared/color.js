  // ==================== 颜色 ====================
  // "156 82 35" | "#9C5223" | "#ee #20 #25" | "255"(灰度)
  // ColorSpace 支持 GRAY / RGB / CMYK，以及调色板（<Color Index="n">）。
  function parseColorComponents(str) {
    const parts = String(str || "").trim().split(/\s+/).filter(Boolean);
    const out = [];
    for (const s of parts) {
      if (s.startsWith("#")) {
        const v = parseInt(s.slice(1), 16);
        out.push(isNaN(v) ? 0 : v);
      } else {
        const v = parseFloat(s);
        out.push(isNaN(v) ? 0 : v);
      }
    }
    return out;
  }

  function colorFromComponents(vals, cs, a) {
    const type = ((cs && cs.type) || "RGB").toUpperCase();
    const bits = cs && +cs.bits > 0 ? +cs.bits : 8;
    const max = Math.pow(2, bits) - 1;
    const ch = vals.map((v) => {
      const n = Math.max(0, Math.min(max, v));
      return Math.round((n * 255) / max);
    });
    if (type === "GRAY") {
      const g = ch.length ? ch[0] : 0;
      return { r: g, g, b: g, a };
    }
    if (type === "CMYK") {
      const c = ch.length > 0 ? ch[0] : 0;
      const m = ch.length > 1 ? ch[1] : 0;
      const y = ch.length > 2 ? ch[2] : 0;
      const k = ch.length > 3 ? ch[3] : 0;
      // 简单 CMYK→RGB（不做 ICC 色彩管理）
      return {
        r: Math.round(255 * (1 - c / 255) * (1 - k / 255)),
        g: Math.round(255 * (1 - m / 255) * (1 - k / 255)),
        b: Math.round(255 * (1 - y / 255) * (1 - k / 255)),
        a,
      };
    }
    return {
      r: ch.length > 0 ? ch[0] : 0,
      g: ch.length > 1 ? ch[1] : 0,
      b: ch.length > 2 ? ch[2] : 0,
      a,
    };
  }

  function parseColor(el, res, defaultCs) {
    if (!el) return null;
    const alpha = attr(el, "Alpha");
    let a = 1;
    if (alpha !== null && alpha !== "")
      a = Math.max(0, Math.min(1, parseFloat(alpha) / 255));
    const csId = attr(el, "ColorSpace") || defaultCs || "";
    const cs =
      res && res.colorSpaces && csId != null ? res.colorSpaces[csId] : null;
    const index = attr(el, "Index");
    if (index !== null && index !== "" && cs && cs.palette) {
      const entry = cs.palette[parseInt(index, 10)];
      if (entry) return colorFromComponents(entry, cs, a);
    }
    const val = attr(el, "Value");
    if (!val) return { r: 0, g: 0, b: 0, a };
    return colorFromComponents(parseColorComponents(val), cs, a);
  }
  const _colorCache = new Map();
  function colorToCss(c) {
    if (!c) return "#000";
    const key = c.r + "," + c.g + "," + c.b + "," + c.a;
    let css = _colorCache.get(key);
    if (css !== undefined) return css;
    css =
      c.a < 1
        ? `rgba(${c.r},${c.g},${c.b},${c.a})`
        : `rgb(${c.r},${c.g},${c.b})`;
    if (_colorCache.size >= 256) _colorCache.clear(); // 简单防膨胀
    _colorCache.set(key, css);
    return css;
  }
