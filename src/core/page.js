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
    }
    return { drawParam, objects };
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
      text: (tc.text || "").replace(/^\s*\n[\s\u00A0]*/, "").replace(/[\s\u00A0]*\n\s*$/, ""),
    }));
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

