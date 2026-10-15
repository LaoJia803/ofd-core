  // ==================== OFD 页面解析 ====================
  function parseLayer(layerEl, layerDp) {
    const drawParam = attr(layerEl, "DrawParam") || layerDp;
    const objects = [];
    for (const c of layerEl.children) {
      const name = stripNs(c.tag);
      if (name === "PathObject") objects.push(parsePathObject(c, drawParam));
      else if (name === "TextObject")
        objects.push(parseTextObject(c, drawParam));
      else if (name === "ImageObject") objects.push(parseImageObject(c));
      else if (name === "CompositeObject")
        // 复合图元：只记引用，真正的图元在 DocumentRes 的 CompositeGraphicUnit 里。
        // 渲染时由 renderObject 展开（见 display/svg.js）。
        objects.push({
          type: "composite",
          resourceId: attr(c, "ResourceID"),
          ctm: parseMatrix(attr(c, "CTM")),
          boundary: parseBox(attr(c, "Boundary")),
          drawParam: attr(c, "DrawParam") || layerDp,
        });
    }
    return { drawParam, objects };
  }

  // 解析 DocumentRes 里的 <ofd:CompositeGraphicUnit>，供 CompositeObject 引用展开。
  // 数科等第三方产物把 Form XObject 的内容放在这里（实测 tracemonkey 那份 226 个 Unit，
  // 内含 226 处 Clips），引擎此前完全忽略，导致页面里 731 个图元渲染不出来。
  async function parseCompositeUnits(resPath, zip) {
    const units = {};
    const xmlText = await readEntryText(zip, resPath);
    if (!xmlText) return units;
    const root = parseXml(xmlText).documentElement;
    const list = child(root, "CompositeGraphicUnits");
    if (!list) return units;
    for (const u of children(list, "CompositeGraphicUnit")) {
      const content = child(u, "Content");
      const layers = content ? children(content, "Layer").map((l) => parseLayer(l)) : [];
      units[attr(u, "ID")] = {
        boundary: parseBox(attr(u, "Boundary")),
        layers,
      };
    }
    return units;
  }

  function parsePathObject(el, layerDp) {
    const fillEl = child(el, "FillColor");
    const strokeEl = child(el, "StrokeColor");
    const abbr = child(el, "AbbreviatedData");
    return {
      type: "path",
      boundary: parseBox(attr(el, "Boundary")),
      ctm: parseMatrix(attr(el, "CTM")),
      lineWidth: num(el, "LineWidth", null),
      stroke: bool(el, "Stroke", true),
      fill: bool(el, "Fill", false),
      fillColor: fillEl ? parseColor(fillEl) : null,
      strokeColor: strokeEl ? parseColor(strokeEl) : null,
      abbreviatedData: abbr ? text(abbr) : "",
      rule: attr(el, "Rule"),
      drawParam: attr(el, "DrawParam") || layerDp,
    };
  }

  // 解析 <ofd:CGTransform>/<ofd:Glyphs>：字符码位 -> 字形索引的显式映射。
  //
  // 为什么必须解析：TextCode 的文本只是「可搜索副本」，真实字形由 Glyphs 指定。
  // 子集字体里相当多的码位没有 cmap 映射（例如 tracemonkey 第 10 页刻度标签
  // 里的 `#`），浏览器按 Unicode 交给 @font-face 时查不到轮廓，
  // 会按字体回退链显示成另一个符号 —— 表现就是「图表标签多出 # 等杂符号」。
  // 拿到 Glyphs 后，引擎可以逐字定位，让缺字形的字符只影响自己。
  function parseGlyphs(el) {
    const cg = child(el, "CGTransform");
    if (!cg) return null;
    const g = child(cg, "Glyphs");
    if (!g) return null;
    const raw = (g.text || "").trim();
    if (!raw) return null;
    const gids = raw.split(/\s+/).map(Number);
    if (!gids.length || gids.some((n) => !Number.isFinite(n))) return null;
    const cp = +attr(cg, "CodePosition");
    const cc = +attr(cg, "CodeCount");
    return {
      glyphs: gids,
      codePosition: Number.isFinite(cp) ? cp : 0,
      codeCount: Number.isFinite(cc) ? cc : gids.length,
    };
  }

  function parseTextObject(el, layerDp) {
    const fillEl = child(el, "FillColor");
    const strokeEl = child(el, "StrokeColor");
    const textCodes = children(el, "TextCode").map((tc) => ({
      x: num(tc, "X", 0),
      y: num(tc, "Y", 0),
      deltaX: attr(tc, "DeltaX"),
      deltaY: attr(tc, "DeltaY"),
      // 仅剥离 XML 缩进产生的换行空白；保留行内首尾空格字形（它们按 DeltaX 占位，
      // 若误删会导致后续字符合并到窄间距重叠，见 1287页.ofd 段首缩进）
      text: (tc.text || "").replace(/^\s*\n[\s ]*/, "").replace(/[\s ]*\n\s*$/, ""),
    }));
    const glyphInfo = parseGlyphs(el);
    return {
      type: "text",
      boundary: parseBox(attr(el, "Boundary")),
      ctm: parseMatrix(attr(el, "CTM")),
      fontId: attr(el, "Font"),
      size: num(el, "Size", null),
      readDirection: num(el, "ReadDirection", 0),
      charDirection: num(el, "CharDirection", 0),
      hScale: num(el, "HScale", 1),
      weight: num(el, "Weight", 400),
      italic: bool(el, "Italic", false),
      stroke: bool(el, "Stroke", false),
      fill: bool(el, "Fill", true),
      fillColor: fillEl ? parseColor(fillEl) : { r: 0, g: 0, b: 0, a: 1 },
      strokeColor: strokeEl ? parseColor(strokeEl) : null,
      textCodes,
      // 逐字字形索引；为 null 表示该 TextObject 未提供 Glyphs
      glyphs: glyphInfo ? glyphInfo.glyphs : null,
      codePosition: glyphInfo ? glyphInfo.codePosition : 0,
      codeCount: glyphInfo ? glyphInfo.codeCount : 0,
      drawParam: attr(el, "DrawParam") || layerDp,
    };
  }

  function parseImageObject(el) {
    return {
      type: "image",
      boundary: parseBox(attr(el, "Boundary")),
      ctm: parseMatrix(attr(el, "CTM")),
      resourceId: attr(el, "ResourceID"),
    };
  }

  async function parsePage(pagePath, zip) {
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
      ? children(content, "Layer").map((l) => parseLayer(l))
      : [];
    return { pagePath, pageBox, templates, layers };
  }

  async function parseSealOfd(sealZipBytes) {
    try {
      const sealZip = await readZip(sealZipBytes);
      // 读取 OFD.xml
      const ofdXmlText = await readEntryText(sealZip, "OFD.xml");
      if (!ofdXmlText) return null;
      const ofdRoot = parseXml(ofdXmlText).documentElement;
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
      let res = { fonts: {}, colorSpaces: {}, multiMedias: {}, drawParams: {} };
      const commonDataEl = child(docRoot, "CommonData");
      if (commonDataEl) {
        const publicResEl = child(commonDataEl, "PublicRes");
        if (publicResEl) {
          const publicResPath = resolvePath(docPath, text(publicResEl));
          res = await parseRes(publicResPath, sealZip);
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
      const page = await parsePage(pagePath, sealZip);

      return { page, res, pagePath };
    } catch (e) {
      console.warn("parseSealOfd error:", e);
      return null;
    }
  }

