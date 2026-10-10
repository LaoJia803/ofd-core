  // ==================== 注解解析 ====================
  async function parseAnnotations(annotationsPath, zip) {
    const stamps = [];
    const annotsXmlText = await readEntryText(zip, annotationsPath);
    if (!annotsXmlText) return stamps;
    const annotsRoot = parseXml(annotsXmlText).documentElement;

    for (const pa of children(annotsRoot, "Page")) {
      const pageId = attr(pa, "PageID");
      const fileLocEl = child(pa, "FileLoc");
      const fileLoc = fileLocEl ? text(fileLocEl) : attr(pa, "FileLoc");
      if (!fileLoc) continue;
      const annotPath = resolvePath(annotationsPath, fileLoc);
      const annotXmlText = await readEntryText(zip, annotPath);
      if (!annotXmlText) continue;
      const annotRoot = parseXml(annotXmlText).documentElement;

      for (const annot of children(annotRoot, "Annot")) {
        const type = attr(annot, "Type");
        const subtype = attr(annot, "Subtype") || type;
        if (type === "Stamp") {
          if (subtype === "SignatureInFile") continue;
          const appearance = child(annot, "Appearance");
          if (appearance) {
            const boundary = parseBox(attr(appearance, "Boundary"));
            stamps.push({
              pageRef: pageId,
              boundary,
              clip: null,
              sealDataUrl: null,
              isPlaceholder: true,
            });
          }
        } else if (type === "Highlight" || type === "Path") {
          const appearance = child(annot, "Appearance");
          if (appearance) {
            const boundary = parseBox(attr(appearance, "Boundary"));
            const appearanceBlend = attr(appearance, "BlendMode") || "Normal";
            const paths = [];
            for (const po of children(appearance, "PathObject")) {
              paths.push({
                boundary: parseBox(attr(po, "Boundary")),
                stroke: bool(po, "Stroke", true),
                fill: bool(po, "Fill", false),
                fillColor: parseColor(child(po, "FillColor")),
                strokeColor: parseColor(child(po, "StrokeColor")),
                lineWidth: num(po, "LineWidth", null),
                rule: attr(po, "Rule"),
                blendMode: attr(po, "BlendMode") || appearanceBlend,
                abbr: text(child(po, "AbbreviatedData")),
              });
            }
            if (paths.length) {
              stamps.push({
                pageRef: pageId,
                boundary,
                annotType: subtype,
                paths,
                isAnnot: true,
              });
            }
          }
        }
      }
    }
    return stamps;
  }

