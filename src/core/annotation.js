  // ==================== 注解解析 ====================
  // Appearance 是完整页块：可以包含 PathObject / TextObject / ImageObject / CompositeObject，
  // 不能只认 PathObject（Watermark 常见文字/图片外观）。
  function parseAppearance(appearance, ctx) {
    const boundary = parseBox(attr(appearance, "Boundary"));
    const dp = attr(appearance, "DrawParam") || null;
    const objects = [];
    const walk = (el) => {
      for (const c of el.children) {
        const name = stripNs(c.tag);
        if (name === "Layer" || name === "Content") {
          walk(c);
          continue;
        }
        const obj = parseObjectEl(c, dp, ctx);
        if (obj) objects.push(obj);
      }
    };
    walk(appearance);
    return {
      boundary,
      objects,
      blendMode: attr(appearance, "BlendMode") || "Normal",
    };
  }

  async function parseAnnotations(annotationsPath, zip, ctx) {
    ctx = ctx || {};
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
        if (!bool(annot, "Visible", true)) continue;
        const type = attr(annot, "Type");
        const subtype = attr(annot, "Subtype") || type;
        const appearance = child(annot, "Appearance");
        const app = appearance ? parseAppearance(appearance, ctx) : null;

        if (type === "Stamp") {
          if (subtype === "SignatureInFile") continue;
          if (app && app.objects.length) {
            stamps.push({
              pageRef: pageId,
              boundary: app.boundary,
              annotType: subtype,
              objects: app.objects,
              blendMode: app.blendMode,
              isAnnot: true,
            });
          } else if (appearance) {
            stamps.push({
              pageRef: pageId,
              boundary: app.boundary,
              clip: null,
              sealDataUrl: null,
              isPlaceholder: true,
            });
          }
          continue;
        }

        const params = {};
        const paramsEl = child(annot, "Parameters");
        if (paramsEl)
          for (const p of children(paramsEl, "Parameter")) {
            const name = attr(p, "Name");
            if (name) params[name] = text(p);
          }

        if (type === "Link") {
          let url = "";
          for (const k in params)
            if (k.toLowerCase() === "url" && params[k]) url = params[k];
          if (app && (app.objects.length || url)) {
            stamps.push({
              pageRef: pageId,
              boundary: app.boundary,
              annotType: "Link",
              objects: app.objects,
              blendMode: app.blendMode,
              linkUrl: url,
              isAnnot: true,
            });
          }
          continue;
        }

        // Path / Highlight / Watermark 以及其他带外观的注解统一按页块渲染
        if (app && app.objects.length) {
          stamps.push({
            pageRef: pageId,
            boundary: app.boundary,
            annotType: subtype,
            objects: app.objects,
            blendMode: app.blendMode,
            isAnnot: true,
          });
        }
      }
    }
    return stamps;
  }
