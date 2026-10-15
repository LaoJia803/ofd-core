  // ==================== SVG 缓存 ====================
  const SVG_CACHE_MAX = 256;
  function svgCacheKey(pageIndex, opts) {
    return pageIndex + "|" + (opts && opts.width ? opts.width : "");
  }
  async function renderPageToString(ofd, pageIndex, opts) {
    opts = opts || {};
    if (!ofd._svgCache) ofd._svgCache = new LRUCache(SVG_CACHE_MAX);
    const cacheKey = svgCacheKey(pageIndex, opts);
    const cached = ofd._svgCache.get(cacheKey);
    if (cached !== undefined) return cached;
    const doc = ofd.document;
    const pgTag = _profiling ? "page-" + pageIndex : "";
    if (_profiling)
      mark("页面 " + (pageIndex + 1) + "：解析页面 XML", pgTag);
    const page = await ensurePageParsed(ofd, pageIndex);
    const pageBox = page.pageBox || doc.pageBox;
    const pageW = pageBox.w,
      pageH = pageBox.h;

    const layers = [];
    for (const t of page.templates) {
      if (t.zOrder !== "Foreground") {
        const tpl = doc.templateById.get(t.templateId);
        if (tpl) layers.push(...(await getTemplateLayers(tpl, ofd)));
      }
    }
    layers.push(...page.layers);
    for (const t of page.templates) {
      if (t.zOrder === "Foreground") {
        const tpl = doc.templateById.get(t.templateId);
        if (tpl) layers.push(...(await getTemplateLayers(tpl, ofd)));
      }
    }
    if (_profiling)
      mark("页面 " + (pageIndex + 1) + "：加载模板/图层", pgTag);

    // 必须**先**登记内嵌字体，再收集字体名 ——
    // hasEmbeddedFont() 依赖 embeddedFontMap，顺序颠倒会导致全部字体被判为「无内嵌」
    // 而退回系统字体栈（build/font/ 是空目录），字形与 PDF 原稿、WPS 都不一致。
    registerEmbeddedFonts(doc.res.fonts);

    const imgIds = new Set();
    // 收集 **Font ID**（而不是字体名）：同名不同 ID 的内嵌字体必须各自预取，
    // 否则只有第一个注册成功，其余静默回退系统字体（第 13 页整页乱码的真凶）。
    const fontIds = new Set();
    for (const layer of layers) {
      for (const obj of layer.objects) {
        if (obj.type === "image") imgIds.add(obj.resourceId);
        if (obj.type === "text" && obj.fontId != null) fontIds.add(obj.fontId);
      }
    }

    const prefetchTasks = [];
    for (const id of imgIds) {
      const mm = doc.res.multiMedias[id];
      if (mm && !mm.dataUrl) prefetchTasks.push(ensureImageDataUrl(mm));
    }
    // 字体预取：与 mapFontFamily 的优先级保持一致 ——
    // **只要有内嵌字体就必须加载**（内嵌优先于系统字体栈），
    // 否则 Helvetica/Calibri 这类命中 builtinFontStack 的名字会被跳过预取，
    // SVG 用系统字体渲染，字形与 PDF 原稿、WPS 都不一致。
    let needFontIndex = false;
    for (const fid of fontIds) {
      const f = doc.res.fonts[fid];
      const name = f && f.fontName;
      if (!name) continue;
      const v = splitFontVariant(name);
      const family = uniqueFamily(fid, v.base || name);
      if (hasEmbeddedFont(name, fid) || hasEmbeddedFont(v.base, fid)) {
        prefetchTasks.push(ensureFontLoaded(family, fid));
        continue;
      }
      if (
        !builtinFontStack(v.base) &&
        !builtinFontStack(name) &&
        !localFontAvailable(v.base)
      ) {
        needFontIndex = true;
        prefetchTasks.push(ensureFontLoaded(family, fid));
      }
    }
    if (needFontIndex) prefetchTasks.push(fetchFontIndex());
    if (prefetchTasks.length) await Promise.allSettled(prefetchTasks);
    if (_profiling) mark("页面 " + (pageIndex + 1) + "：预取", pgTag);

    const bodyParts = [
      `<rect x="0" y="0" width="${pageW}" height="${pageH}" fill="#ffffff"/>`,
    ];
    for (const layer of layers) {
      for (const obj of layer.objects)
        bodyParts.push(await renderObject(obj, doc.res));
    }
    const pageId = doc.pages[pageIndex] ? doc.pages[pageIndex].id : null;
    if (doc.stamps && pageId) {
      let stampIdx = 0;
      for (const stamp of doc.stamps) {
        if (stamp.pageRef === pageId) {
          if (stamp.isAnnot) {
            bodyParts.push(renderAnnot(stamp));
          } else {
            bodyParts.push(await renderStamp(stamp, stampIdx++));
          }
        }
      }
    }
    if (_profiling) mark("页面 " + (pageIndex + 1) + "：SVG 构建", pgTag);
    const widthAttr = opts.width ? ` width="${opts.width}"` : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageW} ${pageH}"${widthAttr} preserveAspectRatio="xMidYMin meet" class="ofd-page-svg">${bodyParts.join("")}</svg>`;
    ofd._svgCache.set(cacheKey, svg);
    if (_profiling) mark("页面 " + (pageIndex + 1) + "：渲染完成", pgTag);
    if (_profiling) flushProfile("渲染 第 " + (pageIndex + 1) + " 页", pgTag);
    return svg;
  }

  function svgStringToElement(svgString) {
    if (typeof document === "undefined") return svgString;
    const container = document.createElement("div");
    container.innerHTML = svgString;
    return container.firstElementChild;
  }

  async function load(source) {
    mark("读取文件数据", "load");
    let data;
    if (typeof source === "string") {
      if (/^(javascript|file|data):/i.test(source))
        throw new Error("不安全的 URL 协议");
      const res = await fetch(source);
      if (!res.ok)
        throw new Error("加载 OFD 失败: " + res.status + " " + res.statusText);
      data = new Uint8Array(await res.arrayBuffer());
    } else if (typeof Blob !== "undefined" && source instanceof Blob) {
      data = new Uint8Array(await source.arrayBuffer());
    } else if (source instanceof ArrayBuffer) {
      data = new Uint8Array(source);
    } else if (source instanceof Uint8Array) {
      data = source;
    } else if (source && source.byteLength !== undefined) {
      data = new Uint8Array(source.buffer ? source.buffer : source);
    } else {
      throw new Error("不支持的 source 类型");
    }
    const zip = await readZip(data);
    mark("ZIP 解压", "load");
    return await parseOFD(zip);
  }

  async function renderPage(ofd, pageIndex, opts) {
    return svgStringToElement(await renderPageToString(ofd, pageIndex, opts));
  }

  async function renderAll(ofd, opts) {
    const count = ofd.document.pages.length;
    const els = [];
    for (let i = 0; i < count; i++) els.push(await renderPage(ofd, i, opts));
    return els;
  }

  function getPageCount(ofd) {
    return ofd.document.pages.length;
  }

  async function getPageDimensions(ofd, pageIndex) {
    if (pageIndex == null) pageIndex = 0;
    const page = await ensurePageParsed(ofd, pageIndex);
    const box = page.pageBox || ofd.document.pageBox;
    return { width: box.w, height: box.h, unit: "mm" };
  }

  function getDocumentInfo(ofd) {
    return Object.assign({ pageCount: ofd.document.pages.length }, ofd.info);
  }

  // ==================== 签名 API ====================
  function formatSignTime(t) {
    if (!t) return "";
    const s = String(t).trim();
    let m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z?$/);
    if (m)
      return (
        m[1] + "-" + m[2] + "-" + m[3] + " " + m[4] + ":" + m[5] + ":" + m[6]
      );
    m = s.match(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/);
    if (m) return s.replace("T", " ");
    return s;
  }

  // ASN.1 时间（UTCTime 12 位 / GeneralizedTime 14 位）→ "YYYY-MM-DD HH:MM:SS"（UTC）
  function formatAsn1Time(s) {
    const ms = asn1TimeToMs(s);
    if (!isFinite(ms)) return s || "";
    const d = new Date(ms);
    const p = (v) => (v < 10 ? "0" + v : "" + v);
    return (
      d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()) +
      " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds())
    );
  }

  async function getSignatures(ofd) {
    const doc = ofd.document;
    const sigs = doc.signatures || [];
    // 页 id → 索引：把下面每个 pageRef 的 O(N) findIndex 降为 O(1)。
    // 用原始 id 作 key（保留 === 语义），重复 id 取首次出现。
    const pageIndex = new Map();
    for (let i = 0; i < doc.pages.length; i++) {
      const id = doc.pages[i].id;
      if (!pageIndex.has(id)) pageIndex.set(id, i);
    }
    return Promise.all(
      sigs.map(async (s, i) => {
        const pageNums = [];
        for (const ref of s.pages) {
          const idx = pageIndex.get(ref);
          if (idx !== undefined) pageNums.push(idx + 1);
        }
        const positions = (s.positions || [])
          .map((pos) => {
            const idx = pageIndex.get(pos.pageRef);
            return idx !== undefined ? { page: idx + 1, boundary: pos.boundary } : null;
          })
          .filter(Boolean);
        let sealImage = null;
        if (s.sealDataUrl) sealImage = { type: "image", data: s.sealDataUrl };
        else if (s.sealOfd)
          sealImage = {
            type: "svg",
            data: await sealToSvgString(s.sealOfd, 100),
          };
        let sealAttrs = null;
        if (s.sealAttrs) {
          sealAttrs = {
            id: s.sealAttrs.id || "",
            name: s.sealAttrs.name || "",
            type: s.sealAttrs.type || "",
            createTime: formatSignTime(s.sealAttrs.createTime),
            notBefore: formatSignTime(s.sealAttrs.notBefore),
            notAfter: formatSignTime(s.sealAttrs.notAfter),
          };
        }
        return {
          index: i,
          id: s.id,
          signer: s.signer || "",
          signTime: formatSignTime(s.signTime),
          provider: s.provider || "",
          providerVersion: s.providerVersion || "",
          checkMethod: s.checkMethod || "",
          signatureMethod: oidName(s.signatureMethod),
          digestMethod: oidName(s.checkMethod),
          references: (s.references || []).map((r) => ({
            fileRef: r.fileRef,
            checkValue: r.checkValue,
          })),
          signedValuePath: s.signedValuePath || "",
          signedValueSize: s.signedValueSize || 0,
          signaturePath: s.signaturePath || "",
          signatureDigest: s.signatureDigest || "",
          signatureValueHex: s.signatureValueHex || "",
          sealAttrs,
          certValidity: (s.certValidity || []).map((c) => ({
            notBefore: formatAsn1Time(c.notBefore),
            notAfter: formatAsn1Time(c.notAfter),
          })),
          pages: pageNums,
          positions,
          sealImage,
        };
      }),
    );
  }

