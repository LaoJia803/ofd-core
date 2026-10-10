  // ==================== OFD 文档解析 ====================
  async function parseDocument(zip) {
    mark("解析 OFD.xml", "load");
    const ofdXmlText = await readEntryText(zip, "OFD.xml");
    if (!ofdXmlText) throw new Error("OFD.xml 不存在");
    const ofdRoot = parseXml(ofdXmlText).documentElement;
    const docBody = child(ofdRoot, "DocBody");
    const docInfo = child(docBody, "DocInfo");
    const info = {
      docId: "",
      author: "",
      title: "",
      subject: "",
      creator: "",
      producer: "",
      creationDate: "",
      modDate: "",
      customDatas: {},
    };
    if (docInfo) {
      info.docId = text(child(docInfo, "DocID"));
      info.author = text(child(docInfo, "Author"));
      info.title = text(child(docInfo, "Title"));
      info.subject = text(child(docInfo, "Subject"));
      info.creator = text(child(docInfo, "Creator"));
      info.creationDate = text(child(docInfo, "CreationDate"));
      info.modDate = text(child(docInfo, "ModDate"));
      const cd = child(docInfo, "CustomDatas");
      if (cd)
        for (const c of children(cd, "CustomData")) {
          info.customDatas[attr(c, "Name") || (c.text || "").trim()] = (
            c.text || ""
          ).trim();
        }
    }
    const docRootEl = child(docBody, "DocRoot");
    const docPath = resolvePath("OFD.xml", text(docRootEl));

    const docXmlText = await readEntryText(zip, docPath);
    if (!docXmlText) throw new Error("Document.xml 不存在: " + docPath);
    const docRoot = parseXml(docXmlText).documentElement;
    mark("解析 Document.xml", "load");
    const common = child(docRoot, "CommonData");
    const pageArea = child(common, "PageArea");
    const physBox = child(pageArea, "PhysicalBox");
    const pageBox = parseBox(text(physBox));

    const templates = children(common, "TemplatePage").map((tp) => ({
      id: attr(tp, "ID"),
      baseLoc: resolvePath(docPath, attr(tp, "BaseLoc")),
      _parsed: null,
    }));
    const templateById = new Map(templates.map((t) => [t.id, t]));

    const res = { fonts: {}, colorSpaces: {}, multiMedias: {}, drawParams: {} };
    const publicRes = child(common, "PublicRes");
    const documentRes = child(common, "DocumentRes");
    if (publicRes)
      mergeRes(res, await parseRes(resolvePath(docPath, text(publicRes)), zip));
    if (documentRes)
      mergeRes(
        res,
        await parseRes(resolvePath(docPath, text(documentRes)), zip),
      );
    embeddedFontMap.clear();
    fontLoadCache.clear();
    fontIndexCache = null;
    for (const id in res.fonts) {
      const f = res.fonts[id];
      if (f.fontFile && f.fontName && !embeddedFontMap.has(f.fontName)) {
        embeddedFontMap.set(f.fontName, {
          fontFile: f.fontFile,
          baseDir: f.fontBaseDir,
          _zip: f._zip,
        });
      }
    }
    mark("解析资源/预载图像", "load");

    const pagesEl = child(docRoot, "Pages");
    const pages = pagesEl
      ? children(pagesEl, "Page").map((p) => ({
          id: attr(p, "ID"),
          baseLoc: resolvePath(docPath, attr(p, "BaseLoc")),
          _parsed: null,
        }))
      : [];

    let stamps = [];
    let signatures = [];
    const signaturesEl = child(docBody, "Signatures");
    if (signaturesEl) {
      const signaturesPath = resolvePath("OFD.xml", text(signaturesEl));
      try {
        const sr = await parseSignatures(signaturesPath, zip);
        stamps.push(...sr.stamps);
        signatures.push(...sr.signatures);
      } catch (e) {
        console.warn("[OFD] 解析签名文件失败：" + signaturesPath, e);
      }
    }
    const annotationsEl = child(docRoot, "Annotations");
    if (annotationsEl) {
      const annotationsPath = resolvePath(docPath, text(annotationsEl));
      try {
        stamps.push(...(await parseAnnotations(annotationsPath, zip)));
      } catch (e) {
        console.warn("[OFD] 解析批注文件失败：" + annotationsPath, e);
      }
    }
    let outlines = [];
    const embeddedOutlinesEl = child(docRoot, "Outlines");
    if (embeddedOutlinesEl) {
      outlines = parseOutline(embeddedOutlinesEl, pages);
    } else {
      const outlinePath = resolvePath(docPath, "Document_Structure.xml");
      try {
        const outlineText = await readEntryText(zip, outlinePath);
        if (outlineText) outlines = parseOutlineFromXml(outlineText, pages);
      } catch (e) {
        console.warn("[OFD] 解析目录大纲失败：" + outlinePath, e);
      }
    }
    mark("解析签名/印章/目录", "load");

    if (_profiling) flushProfile("OFD 加载", "load");

    return {
      info,
      document: {
        docPath,
        pageBox,
        templates,
        templateById,
        pages,
        res,
        stamps,
        signatures,
        outlines,
      },
      zip,
    };
  }

  async function parseOFD(zip) {
    return parseDocument(zip);
  }

