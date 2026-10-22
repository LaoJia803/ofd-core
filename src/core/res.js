  // ==================== OFD 资源解析 ====================
  function mergeRes(target, src) {
    Object.assign(target.fonts, src.fonts);
    Object.assign(target.colorSpaces, src.colorSpaces);
    Object.assign(target.multiMedias, src.multiMedias);
    Object.assign(target.drawParams, src.drawParams);
    Object.assign(target.compositeUnits, src.compositeUnits);
  }

  async function parseRes(resPath, zip, defaultCs) {
    const res = {
      fonts: {},
      colorSpaces: {},
      multiMedias: {},
      drawParams: {},
      compositeUnits: {},
    };
    const xmlText = await readEntryText(zip, resPath);
    if (!xmlText) return res;
    const root = parseXml(xmlText).documentElement;
    const baseLoc = attr(root, "BaseLoc") || "";
    const baseDir = baseLoc ? resolvePath(resPath, baseLoc) : dirOf(resPath);

    // 先解析颜色空间：后面的 DrawParam / 页面图元都要按它解释通道
    const csEl = child(root, "ColorSpaces");
    if (csEl)
      for (const c of children(csEl, "ColorSpace")) {
        const palEl = child(c, "Palette");
        res.colorSpaces[attr(c, "ID")] = {
          type: attr(c, "Type"),
          bits: attr(c, "BitsPerComponent"),
          palette: palEl
            ? children(palEl, "CV").map((cv) => parseColorComponents(text(cv)))
            : null,
        };
      }

    const fontsEl = child(root, "Fonts");
    if (fontsEl)
      for (const f of children(fontsEl, "Font")) {
        const fontFileEl = child(f, "FontFile");
        res.fonts[attr(f, "ID")] = {
          fontName: attr(f, "FontName"),
          familyName: attr(f, "FamilyName"),
          fontFile: fontFileEl ? text(fontFileEl) : null,
          fontBaseDir: baseDir,
          _zip: zip,
        };
      }
    const mmEl = child(root, "MultiMedias");
    if (mmEl)
      for (const m of children(mmEl, "MultiMedia")) {
        const mf = child(m, "MediaFile");
        res.multiMedias[attr(m, "ID")] = {
          type: attr(m, "Type"),
          format: attr(m, "Format"),
          mediaFile: mf ? text(mf) : null,
          baseDir,
          _zip: zip,
        };
      }
    const dpEl = child(root, "DrawParams");
    if (dpEl)
      for (const d of children(dpEl, "DrawParam")) {
        const dp = {
          id: attr(d, "ID"),
          lineWidth: num(d, "LineWidth", null),
          dashPattern: attr(d, "DashPattern") || null,
          cap: attr(d, "Cap"),
          join: attr(d, "Join"),
          miterLimit: num(d, "MiterLimit", null),
          dashOffset: num(d, "DashOffset", null),
        };
        const sc = child(d, "StrokeColor");
        if (sc) {
          const g = parseGradient(sc);
          if (g) dp.strokeGradient = g;
          else dp.strokeColor = parseColor(sc, res, defaultCs);
        }
        const fc = child(d, "FillColor");
        if (fc) {
          const g = parseGradient(fc);
          if (g) dp.fillGradient = g;
          else dp.fillColor = parseColor(fc, res, defaultCs);
        }
        res.drawParams[attr(d, "ID")] = dp;
      }
    return res;
  }
