  // ==================== 颜色 ====================
  // "156 82 35" | "#9C5223" | "#ee #20 #25" | "255"(灰度)
  function parseColor(el) {
    if (!el) return null;
    const val = attr(el, "Value");
    const alpha = attr(el, "Alpha");
    let a = 1;
    if (alpha !== null && alpha !== "")
      a = Math.max(0, Math.min(1, parseFloat(alpha) / 255));
    if (!val) return { r: 0, g: 0, b: 0, a };
    const parts = val.trim().split(/\s+/);
    if (parts.length === 1) {
      if (parts[0].startsWith("#")) {
        const hex = parts[0].slice(1);
        const full =
          hex.length === 3
            ? hex
                .split("")
                .map((c) => c + c)
                .join("")
            : hex;
        const n = parseInt(full, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
      }
      const g = parseInt(parts[0]);
      return { r: g, g: g, b: g, a };
    }
    // 多分量：可能是 "156 82 35" 或 "#ee #20 #25"
    const parseComp = (s) => {
      if (s.startsWith("#")) {
        const v = parseInt(s.slice(1), 16);
        return isNaN(v) ? 0 : v;
      }
      const v = parseInt(s);
      return isNaN(v) ? 0 : v;
    };
    return {
      r: parseComp(parts[0]),
      g: parseComp(parts[1]),
      b: parseComp(parts[2]),
      a,
    };
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

