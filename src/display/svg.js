  // ==================== SVG 元素渲染 ====================
  // 把解析后的页面图元（路径 / 文字 / 图像 / 印章 / 注解）转成 SVG 片段。
  const ABBR_PATH_CACHE_MAX = 4096;
  const abbrPathCache = new LRUCache(ABBR_PATH_CACHE_MAX);
  function abbreviatedToSvgPath(abbr) {
    if (!abbr) return "";
    if (abbrPathCache.has(abbr)) return abbrPathCache.get(abbr);
    const tokens = abbr.trim().split(/\s+/);
    const numRe = /^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?$/;
    let d = "";
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (!t) {
        i++;
        continue;
      }
      const cmd = t[0];
      if (cmd === "C" && t.length === 1) {
        d += "Z ";
        i++;
        continue;
      }
      if ("MLQBAS".indexOf(cmd) >= 0) {
        const svgCmd = cmd === "B" ? "C" : cmd === "S" ? "M" : cmd;
        d += svgCmd;
        i++;
        while (i < tokens.length && numRe.test(tokens[i])) {
          d += " " + tokens[i];
          i++;
        }
        d += " ";
      } else if (numRe.test(t)) {
        i++;
      } else {
        i++;
      }
    }
    d = d.trim();
    abbrPathCache.set(abbr, d);
    return d;
  }

  function renderPathObject(obj, res) {
    const d = abbreviatedToSvgPath(obj.abbreviatedData);
    if (!d) return "";
    const b = obj.boundary;
    const bx = b.x,
      by = b.y;
    let transform = `translate(${bx} ${by})`;
    if (obj.ctm) transform += ` matrix(${obj.ctm.join(" ")})`;
    const dp = obj.drawParam ? res.drawParams[obj.drawParam] : null;
    const lineWidth =
      obj.lineWidth != null
        ? obj.lineWidth
        : dp && dp.lineWidth != null
          ? dp.lineWidth
          : 0.7;
    const strokeColor = obj.strokeColor || (dp && dp.strokeColor) || null;
    const fillColor = obj.fillColor || (dp && dp.fillColor) || null;
    let attrs = `fill="none"`;
    if (obj.fill && fillColor) attrs = `fill="${colorToCss(fillColor)}"`;
    if (obj.rule === "Even-Odd") attrs += ' fill-rule="evenodd"';
    if (obj.stroke) {
      attrs += ` stroke="${colorToCss(strokeColor || fillColor || { r: 0, g: 0, b: 0, a: 1 })}" stroke-width="${lineWidth}"`;
    }
    return `<g transform="${transform}"><path d="${d}" ${attrs}/></g>`;
  }

  function renderTextObject(obj, res) {
    const font = res.fonts[obj.fontId] || {};
    const fv = mapFontFamily(font.fontName);
    const hScale = obj.hScale != null ? obj.hScale : 1;
    const ctm = obj.ctm;
    const bx = obj.boundary.x,
      by = obj.boundary.y;
    const fill = obj.fill ? colorToCss(obj.fillColor) : "none";
    const weight = fv.weight || (obj.weight >= 700 ? "bold" : "normal");
    const fontStyle = fv.style || (obj.italic ? "italic" : "normal");

    // 生成单个 TextCode 的 tspan 片段：
    // - 可合并（无需逐字符 rotate）：输出一个 tspan，x/y 用值列表保留每字符绝对坐标，
    //   文本为整段内容，textContent 与逐字符 tspan 完全一致（渲染/搜索/选中不受影响）。
    // - readDirection=90/270 需逐字符 rotate：保持逐字符 tspan + rotate。
    function buildTextCodeParts(tc, ox0, oy0, hScale, readDirection) {
      const txt = tc.text;
      if (!txt) return "";
      const dxArr = expandDelta(tc.deltaX);
      const dyArr = expandDelta(tc.deltaY);
      let ox = ox0,
        oy = oy0;
      if (readDirection === 90 || readDirection === 270) {
        const ang = readDirection;
        let s = "";
        for (let i = 0; i < txt.length; i++) {
          const adjX = hScale !== 1 ? ox / hScale : ox;
          s += `<tspan x="${adjX.toFixed(4)}" y="${oy.toFixed(4)}" transform="rotate(${ang} ${adjX.toFixed(4)} ${oy.toFixed(4)})">${escapeXml(txt[i])}</tspan>`;
          ox += i < dxArr.length ? dxArr[i] : 0;
          oy += i < dyArr.length ? dyArr[i] : 0;
        }
        return s;
      }
      let xs = "",
        ys = "";
      for (let i = 0; i < txt.length; i++) {
        const adjX = hScale !== 1 ? ox / hScale : ox;
        xs += (i ? " " : "") + adjX.toFixed(4);
        ys += (i ? " " : "") + oy.toFixed(4);
        ox += i < dxArr.length ? dxArr[i] : 0;
        oy += i < dyArr.length ? dyArr[i] : 0;
      }
      return `<tspan x="${xs}" y="${ys}">${escapeXml(txt)}</tspan>`;
    }

    // CTM 分支：使用 SVG matrix 变换（含旋转），文字坐标为局部坐标
    // OFD CTM = [a, b, c, d, e, f]，变换：x' = a*x + c*y + e, y' = b*x + d*y + f
    // SVG matrix(a, b, c, d, e, f) 同理
    if (ctm) {
      const fontSize = obj.size != null ? obj.size : 3;
      const parts = [];
      for (const tc of obj.textCodes) {
        parts.push(buildTextCodeParts(tc, tc.x, tc.y, 1, 0));
      }
      const transform = `translate(${bx} ${by}) matrix(${ctm[0]} ${ctm[1]} ${ctm[2]} ${ctm[3]} ${ctm[4]} ${ctm[5]})`;
      return `<text font-family="${escapeXml(fv.family)}" font-size="${fontSize}" font-weight="${weight}" font-style="${fontStyle}" fill="${fill}" transform="${transform}" xml:space="preserve" text-rendering="geometricPrecision">${parts.join("")}</text>`;
    }

    // 无 CTM：简单定位
    const fontSize = obj.size != null ? obj.size : 3;
    const parts = [];
    for (const tc of obj.textCodes) {
      parts.push(
        buildTextCodeParts(tc, bx + tc.x, by + tc.y, hScale, obj.readDirection),
      );
    }
    let transform = "";
    if (hScale !== 1) transform = ` transform="scale(${hScale} 1)"`;
    return `<text font-family="${escapeXml(fv.family)}" font-size="${fontSize}" font-weight="${weight}" font-style="${fontStyle}" fill="${fill}"${transform} xml:space="preserve" text-rendering="geometricPrecision">${parts.join("")}</text>`;
  }

  async function renderImageObject(obj, res) {
    const mm = res.multiMedias[obj.resourceId];
    if (!mm) return "";
    if (!mm.dataUrl) await ensureImageDataUrl(mm); // 渲染到该页时才懒加载图像
    if (!mm.dataUrl) return "";
    const b = obj.boundary;
    let x, y, w, h;
    if (obj.ctm) {
      const a = obj.ctm;
      // CTM 将单位图像 (0..1) 映射到 boundary 局部坐标（Y 向下）
      w = a[0];
      h = a[3];
      x = b.x + a[4];
      y = b.y + a[5];
    } else {
      x = b.x;
      y = b.y;
      w = b.w;
      h = b.h;
    }
    return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${escapeXml(mm.dataUrl)}" preserveAspectRatio="none"/>`;
  }

  async function renderObject(obj, res) {
    switch (obj.type) {
      case "path":
        return renderPathObject(obj, res);
      case "text":
        return renderTextObject(obj, res);
      case "image":
        return await renderImageObject(obj, res);
    }
    return "";
  }

  async function getTemplateLayers(tpl, ofd) {
    if (!tpl._parsed) tpl._parsed = await parsePage(tpl.baseLoc, ofd.zip);
    return tpl._parsed.layers;
  }

  async function ensurePageParsed(ofd, pageIndex) {
    const doc = ofd.document;
    const p = doc.pages[pageIndex];
    if (!p) throw new Error("页码越界: " + pageIndex);
    if (!p._parsed) p._parsed = await parsePage(p.baseLoc, ofd.zip);
    return p._parsed;
  }

  // 渲染印章（StampAnnot）
  // Boundary 定义印章在页面上的位置和大小（OFD 坐标，Y 向下）
  // Clip 定义可见区域（Boundary 局部坐标，Y 向下）；骑缝章时 Clip 只占完整印章的一部分
  // 页面印章（签章）渲染透明度，1 为完全不透明。文本下方的印章需半透明以便透出字迹。
  const SEAL_OPACITY = 0.8;

  async function renderStamp(stamp, stampIdx) {
    const b = stamp.boundary;
    const x = b.x,
      y = b.y,
      w = b.w,
      h = b.h;
    // 标记：供前端点击事件定位到对应印章（data-stamp-idx 为「当前页内」印章序号）
    const dataAttr = ' data-stamp-idx="' + stampIdx + '"';

    // 1. OFD 矢量印章：递归渲染印章的 OFD 内容
    if (stamp.sealOfd) {
      const sealPage = stamp.sealOfd.page;
      const sealRes = stamp.sealOfd.res;
      const sealPageBox = sealPage.pageBox || { w: w, h: h };
      const sealW = sealPageBox.w;
      const sealH = sealPageBox.h;

      // 分离路径和文字：先画路径（椭圆环），再画文字（避免椭圆线遮挡文字）
      const pathParts = [],
        textParts = [];
      for (const layer of sealPage.layers) {
        for (const obj of layer.objects) {
          if (obj.type === "text") {
            textParts.push(await renderObject(obj, sealRes));
          } else {
            pathParts.push(await renderObject(obj, sealRes));
          }
        }
      }
      const sealSvg = pathParts.join("") + textParts.join("");

      // 缩放比例：印章 OFD 坐标系 → 页面坐标系
      const scaleX = w / sealW;
      const scaleY = h / sealH;

      const clip = stamp.clip;
      if (
        clip &&
        clip.w > 0 &&
        clip.h > 0 &&
        (clip.x > 0 || clip.y > 0 || clip.w < w || clip.h < h)
      ) {
        // 骑缝章裁剪
        const clipId = "stampClip_" + stampIdx;
        const clipSvgX = x + clip.x;
        const clipSvgY = y + clip.y;
        return (
          `<clipPath id="${clipId}"><rect x="${clipSvgX}" y="${clipSvgY}" width="${clip.w}" height="${clip.h}"/></clipPath>` +
          `<g transform="translate(${x} ${y}) scale(${scaleX} ${scaleY})" clip-path="url(#${clipId})" opacity="${SEAL_OPACITY}"${dataAttr}>${sealSvg}</g>`
        );
      }

      return `<g transform="translate(${x} ${y}) scale(${scaleX} ${scaleY})" opacity="${SEAL_OPACITY}"${dataAttr}>${sealSvg}</g>`;
    }

    // 2. PNG 位图印章
    if (stamp.sealDataUrl) {
      const clip = stamp.clip;
      if (
        clip &&
        clip.w > 0 &&
        clip.h > 0 &&
        (clip.x > 0 || clip.y > 0 || clip.w < w || clip.h < h)
      ) {
        const clipId = "stampClip_" + stampIdx;
        const clipSvgX = x + clip.x;
        const clipSvgY = y + clip.y;
        return (
          `<clipPath id="${clipId}"><rect x="${clipSvgX}" y="${clipSvgY}" width="${clip.w}" height="${clip.h}"/></clipPath>` +
          `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${escapeXml(stamp.sealDataUrl)}" preserveAspectRatio="none" clip-path="url(#${clipId})" opacity="${SEAL_OPACITY}"${dataAttr}/>`
        );
      }
      return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${escapeXml(stamp.sealDataUrl)}" preserveAspectRatio="none" opacity="${SEAL_OPACITY}"${dataAttr}/>`;
    }

    // 3. 无印章图片也无 OFD 矢量：渲染占位符
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    const strokeWidth = Math.max(0.4, Math.min(rx, ry) * 0.06);
    return (
      `<g opacity="${SEAL_OPACITY}"${dataAttr}>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="red" stroke-width="${strokeWidth}" stroke-dasharray="2 1"/>` +
      `</g>`
    );
  }

  function renderAnnot(annot) {
    const b = annot.boundary;
    const parts = [];
    for (const p of annot.paths) {
      const d = abbreviatedToSvgPath(p.abbr);
      if (!d) continue;
      const tx = b.x + p.boundary.x;
      const ty = b.y + p.boundary.y;
      let attrs = 'fill="none"';
      if (p.fill && p.fillColor) attrs = `fill="${colorToCss(p.fillColor)}"`;
      if (p.stroke) {
        const sw = p.lineWidth != null ? p.lineWidth : 0.7;
        attrs += ` stroke="${colorToCss(p.strokeColor || p.fillColor || { r: 0, g: 0, b: 0, a: 1 })}" stroke-width="${sw}"`;
      }
      if (p.rule === "Even-Odd") attrs += ' fill-rule="evenodd"';
      const blend = (p.blendMode || "Normal").toLowerCase();
      const style =
        blend === "normal" ? "" : ` style="mix-blend-mode:${blend}"`;
      parts.push(
        `<path d="${d}" ${attrs} transform="translate(${tx} ${ty})"${style}/>`,
      );
    }
    return parts.join("");
  }

  async function sealToSvgString(sealOfd, widthPx) {
    const page = sealOfd.page;
    const res = sealOfd.res;
    const box = page.pageBox || { w: 1, h: 1 };
    let body = "";
    for (const layer of page.layers) {
      for (const obj of layer.objects) body += await renderObject(obj, res);
    }
    const w = widthPx || 100;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.w} ${box.h}" width="${w}" preserveAspectRatio="xMidYMid meet" style="display:block">${body}</svg>`;
  }

