/*!
 * ofd2pdf.js v1.0.0 — OFD → PDF 转换模块（演示级）
 * 逐页取 ofd.js 的 renderPageToString 输出，再映射为 PDF 内容流。
 * 运行时依赖同目录/同包的 ofd.js（浏览器取 globalThis.OFD，Node 由本文件收尾段注入）。
 */
(() => {
  // ofd2pdf/core/platform.js
  var core = null;
  function getCore() {
    if (core) return core;
    if (typeof globalThis !== "undefined" && globalThis.OFD) core = globalThis.OFD;
    return core;
  }
  function nodeZlib() {
    if (typeof globalThis !== "undefined" && globalThis.__OFD2PDF_ZLIB__) return globalThis.__OFD2PDF_ZLIB__;
    return null;
  }

  // ofd2pdf/core/constants.js
  var MM_TO_PT = 72 / 25.4;

  // ofd2pdf/core/util.js
  function fmtNum(v) {
    if (typeof v !== "number" || !isFinite(v)) return "0";
    const r = Math.round(v * 1e4) / 1e4;
    return String(r);
  }
  function numList(str) {
    if (!str) return [];
    return String(str).trim().split(/[\s,]+/).filter(Boolean).map(parseFloat);
  }
  function unescapeXml(s) {
    const fn = getCore() && getCore()._internals && getCore()._internals.decodeEntities;
    if (fn) return fn(s);
    return String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  }
  function base64ToBytes(b64) {
    const fn = getCore() && getCore()._internals && getCore()._internals.base64ToBytes;
    if (fn) return fn(b64);
    let s = String(b64).replace(/[\s\x00]/g, "").replace(/-/g, "+").replace(/_/g, "/");
    const pad = s.length % 4;
    if (pad === 2) s += "==";
    else if (pad === 3) s += "=";
    else if (pad === 1) throw new Error("base64 长度非法");
    let bin;
    if (typeof atob === "function") {
      bin = atob(s);
    } else {
      const table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      const eq = "=".charCodeAt(0);
      bin = "";
      for (let i = 0; i < s.length; i += 4) {
        const c = [s[i], s[i + 1], s[i + 2], s[i + 3]].map((ch) => ch === "=" ? eq : table.indexOf(ch));
        const n = c[0] << 18 | c[1] << 12 | c[2] << 6 | c[3];
        bin += String.fromCharCode(n >> 16 & 255, n >> 8 & 255, n & 255);
      }
      const eqs = /\=*$/.exec(s)[0].length;
      if (eqs) bin = bin.slice(0, 3 - eqs);
    }
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // ofd2pdf/pdf/docstring.js
  function utf16beHex(ch) {
    let code = ch.codePointAt(0);
    if (code > 65535) {
      code -= 65536;
      const hi = 55296 + (code >> 10);
      const lo = 56320 + (code & 1023);
      return hi.toString(16).padStart(4, "0") + lo.toString(16).padStart(4, "0");
    }
    return code.toString(16).padStart(4, "0");
  }
  function pdfTextString(s) {
    s = String(s);
    if (/^[\x20-\x7E]*$/.test(s)) {
      return "(" + s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)") + ")";
    }
    let hex = "FEFF";
    for (let i = 0; i < s.length; i++) {
      let cp = s.codePointAt(i);
      if (cp > 65535) {
        const v = cp - 65536;
        cp = (v >> 10) + 55296 << 16 | (v & 1023) + 56320 & 65535;
        hex += (cp >>> 16).toString(16).padStart(4, "0");
        i++;
      }
      hex += cp.toString(16).padStart(4, "0");
    }
    return "<" + hex + ">";
  }
  function buildInfo(opts) {
    const info = {
      Producer: "OFD-Viewer ofd2pdf.js",
      Creator: "OFD-Viewer",
      // PDF 标准日期格式：D:YYYYMMDDHHmmSS+hh'mm'（去 ISO 的 T 与毫秒）
      CreationDate: "D:" + (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z/, "Z").replace("T", "")
    };
    if (opts.title) info.Title = opts.title;
    if (opts.author) info.Author = opts.author;
    if (opts.subject) info.Subject = opts.subject;
    return "<< " + Object.keys(info).map((k) => "/" + k + " " + pdfTextString(info[k])).join("\n") + " >>";
  }

  // ofd2pdf/pdf/writer.js
  function assemblePdf(pages, a, b, c) {
    let regs, opts;
    if (a && (a.imageReg || a.fontReg || a.shadingReg || a.alphaReg)) {
      regs = a;
      opts = b || {};
    } else {
      regs = { imageReg: a, alphaReg: b };
      opts = c || {};
    }
    const imageReg = regs.imageReg || /* @__PURE__ */ new Map();
    const alphaReg = regs.alphaReg || /* @__PURE__ */ new Map();
    const shadingReg = regs.shadingReg || /* @__PURE__ */ new Map();
    const fontReg = regs.fontReg || /* @__PURE__ */ new Map();
    const enc = new TextEncoder();
    const chunks = [];
    const offsets = [];
    let byteOff = 0;
    let obj = 1;
    const catalogObj = obj++;
    const pagesObj = obj++;
    const infoObj = obj++;
    const pageObjs = [], contentObjs = [];
    for (let i = 0; i < pages.length; i++) {
      pageObjs.push(obj++);
      contentObjs.push(obj++);
    }
    const fontObjs = {};
    for (const f of fontReg.values()) {
      const objs = { kind: f.kind, base: f.base };
      if (f.kind === "cid") {
        objs.type0 = obj++;
        objs.cid = obj++;
        objs.fd = obj++;
      } else objs.type1 = obj++;
      fontObjs[f.name] = objs;
    }
    const gsObjs = {}, shadingObjs = {}, imgObjs = {}, smaskObjs = {};
    for (const a2 of alphaReg.keys()) gsObjs[alphaReg.get(a2).name] = obj++;
    for (const s of shadingReg.values()) shadingObjs[s.name] = obj++;
    for (const key of imageReg.keys()) {
      const im = imageReg.get(key);
      imgObjs[im.name] = obj++;
      if (im.smask) smaskObjs[im.name] = obj++;
    }
    const size = obj;
    const pushBytes = (b2) => {
      chunks.push(b2);
      byteOff += b2.length;
    };
    const emit = (s) => {
      offsets.push(byteOff);
      pushBytes(typeof s === "string" ? enc.encode(s) : s);
    };
    const streamEnd = () => enc.encode("\nendstream\nendobj\n");
    pushBytes(enc.encode("%PDF-1.4\n%"));
    pushBytes(new Uint8Array([226, 227, 207, 211]));
    pushBytes(enc.encode("\n"));
    emit("1 0 obj\n<< /Type /Catalog /Pages " + pagesObj + " 0 R >>\nendobj\n");
    const kids = pageObjs.map((n) => n + " 0 R").join(" ");
    emit(pagesObj + " 0 obj\n<< /Type /Pages /Kids [" + kids + "] /Count " + pages.length + " >>\nendobj\n");
    emit(infoObj + " 0 obj\n" + buildInfo(opts) + "\nendobj\n");
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const media = "[0 0 " + fmtNum(p.w * MM_TO_PT) + " " + fmtNum(p.h * MM_TO_PT) + "]";
      let fontRes = "";
      if (p.fonts && p.fonts.length) {
        fontRes = " /Font << " + p.fonts.map((n) => {
          const o = fontObjs[n];
          return "/" + n + " " + (o.kind === "cid" ? o.type0 : o.type1) + " 0 R";
        }).join(" ") + " >>";
      }
      let gsRes = "";
      if (p.alphas && p.alphas.length) {
        gsRes = " /ExtGState << " + p.alphas.map((n) => "/" + n + " " + gsObjs[n] + " 0 R").join(" ") + " >>";
      }
      let patRes = "";
      if (p.shadings && p.shadings.length) {
        patRes = " /Shading << " + p.shadings.map((n) => "/" + n + " " + shadingObjs[n] + " 0 R").join(" ") + " >>";
      }
      let xoRes = "";
      if (p.images && p.images.length) {
        xoRes = " /XObject << " + p.images.map((n) => "/" + n + " " + imgObjs[n] + " 0 R").join(" ") + " >>";
      }
      const resources = "<< /ProcSet [/PDF /Text /ImageB /ImageC /ImageI]" + fontRes + gsRes + patRes + xoRes + " >>";
      emit(pageObjs[i] + " 0 obj\n<< /Type /Page /Parent " + pagesObj + " 0 R /MediaBox " + media + " /Resources " + resources + " /Contents " + contentObjs[i] + " 0 R >>\nendobj\n");
      const contentBytes = enc.encode(p.content);
      emit(contentObjs[i] + " 0 obj\n<< /Length " + contentBytes.length + " >>\nstream\n");
      pushBytes(contentBytes);
      pushBytes(streamEnd());
    }
    for (const name of Object.keys(fontObjs)) {
      const f = fontObjs[name];
      if (f.kind === "cid") {
        emit(f.type0 + " 0 obj\n<< /Type /Font /Subtype /Type0 /BaseFont /" + f.base + " /Encoding /UniGB-UCS2-H /DescendantFonts [" + f.cid + " 0 R] >>\nendobj\n");
        emit(f.cid + " 0 obj\n<< /Type /Font /Subtype /CIDFontType0 /BaseFont /" + f.base + " /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /FontDescriptor " + f.fd + " 0 R >>\nendobj\n");
        emit(f.fd + " 0 obj\n<< /Type /FontDescriptor /FontName /" + f.base + " /Flags 4 /FontBBox [-241 -260 1120 932] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 762 /StemV 80 >>\nendobj\n");
      } else {
        emit(f.type1 + " 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /" + f.base + " /Encoding /WinAnsiEncoding >>\nendobj\n");
      }
    }
    for (const a2 of alphaReg.keys()) {
      const g = alphaReg.get(a2);
      const dict = "/Type /ExtGState" + (g.a < 1 ? " /ca " + g.a + " /CA " + g.a + " /AIS false" : "") + (g.blend ? " /BM /" + g.blend.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("") : "");
      emit(gsObjs[g.name] + " 0 obj\n<< " + dict + " >>\nendobj\n");
    }
    for (const s of shadingReg.values()) {
      emit(shadingObjs[s.name] + " 0 obj\n" + s.dict + "\nendobj\n");
    }
    for (const key of imageReg.keys()) {
      const im = imageReg.get(key);
      const cs = im.colorSpace || "DeviceRGB";
      let dict = "<< /Type /XObject /Subtype /Image /Width " + im.w + " /Height " + im.h + " /ColorSpace /" + cs + " /BitsPerComponent 8 /Filter /" + im.filter + " /Length " + im.data.length;
      if (im.decode) dict += " /Decode [" + im.decode.join(" ") + "]";
      if (im.smask) dict += " /SMask " + smaskObjs[im.name] + " 0 R";
      dict += " >>";
      emit(imgObjs[im.name] + " 0 obj\n" + dict + "\nstream\n");
      pushBytes(im.data);
      pushBytes(streamEnd());
      if (im.smask) {
        const s = im.smask;
        emit(smaskObjs[im.name] + " 0 obj\n<< /Type /XObject /Subtype /Image /Width " + im.w + " /Height " + im.h + " /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /" + s.filter + " /Length " + s.data.length + " >>\nstream\n");
        pushBytes(s.data);
        pushBytes(streamEnd());
      }
    }
    const xrefPos = byteOff;
    const xref = ["xref", "0 " + size, "0000000000 65535 f "].concat(offsets.map((o) => String(o).padStart(10, "0") + " 00000 n ")).join("\n");
    const trailer = "trailer\n<< /Size " + size + " /Root " + catalogObj + " 0 R /Info " + infoObj + " 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF";
    const xrefBytes = enc.encode(xref + "\n" + trailer + "\n");
    chunks.push(xrefBytes);
    const total = xrefPos + xrefBytes.length;
    const out = new Uint8Array(total);
    let off2 = 0;
    for (const c2 of chunks) {
      out.set(c2, off2);
      off2 += c2.length;
    }
    return out;
  }

  // ofd2pdf/core/color.js
  function parseCssColor(str) {
    str = String(str || "").trim();
    if (!str || str === "none") return null;
    let m;
    if (m = /^#([0-9a-f]{3})$/i.exec(str)) {
      return {
        r: parseInt(m[1][0] + m[1][0], 16),
        g: parseInt(m[1][1] + m[1][1], 16),
        b: parseInt(m[1][2] + m[1][2], 16)
      };
    }
    if (m = /^#([0-9a-f]{6})$/i.exec(str)) {
      return {
        r: parseInt(m[1].substr(0, 2), 16),
        g: parseInt(m[1].substr(2, 2), 16),
        b: parseInt(m[1].substr(4, 2), 16)
      };
    }
    if (m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(str)) {
      return { r: +m[1], g: +m[2], b: +m[3] };
    }
    if (m = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i.exec(str)) {
      return { r: +m[1], g: +m[2], b: +m[3], a: parseFloat(m[4]) };
    }
    if (str === "black") return { r: 0, g: 0, b: 0 };
    if (str === "white") return { r: 255, g: 255, b: 255 };
    if (str === "red") return { r: 255, g: 0, b: 0 };
    return null;
  }

  // ofd2pdf/image/bmp.js
  function decodeBmp(bytes) {
    if (bytes.length < 26 || bytes[0] !== 66 || bytes[1] !== 77) throw new Error("无效 BMP 头");
    const hdrSize = (bytes[14] | bytes[15] << 8 | bytes[16] << 16 | bytes[17] << 24) >>> 0;
    let w, h, bpp, comp = 0, palSize = 0, palOff;
    if (hdrSize === 12) {
      w = bytes[18] | bytes[19] << 8;
      h = bytes[20] | bytes[21] << 8;
      bpp = bytes[24] | bytes[25] << 8;
      palOff = 26;
    } else {
      w = bytes[18] | bytes[19] << 8 | bytes[20] << 16 | bytes[21] << 24 | 0;
      h = bytes[22] | bytes[23] << 8 | bytes[24] << 16 | bytes[25] << 24 | 0;
      bpp = bytes[28] | bytes[29] << 8;
      comp = (bytes[30] | bytes[31] << 8 | bytes[32] << 16 | bytes[33] << 24) >>> 0;
      palSize = (bytes[46] | bytes[47] << 8 | bytes[48] << 16 | bytes[49] << 24) >>> 0;
      palOff = 14 + hdrSize;
    }
    if (!w || !h || w > 65536 || h > 65536) throw new Error("无效 BMP 尺寸");
    const topDown = h < 0;
    h = Math.abs(h);
    if (comp > 3) throw new Error("BMP 压缩 " + comp + " 不支持");
    checkImageSize(w, h);
    const palette = [];
    if (bpp <= 8) {
      const n = Math.min(palSize || 1 << bpp, bytes.length - palOff >> 2);
      for (let i = 0; i < n; i++) {
        palette.push([bytes[palOff + 4 * i + 2], bytes[palOff + 4 * i + 1], bytes[palOff + 4 * i], 255]);
      }
      while (palette.length < 1 << bpp) palette.push([0, 0, 0, 255]);
    }
    const rgba = new Uint8Array(w * h * 4);
    let hasAlpha = false;
    if ((comp === 1 || comp === 2) && (bpp === 8 || bpp === 4)) {
      const idx = new Uint8Array(w * h);
      let pos2 = (bytes[10] | bytes[11] << 8 | bytes[12] << 16 | bytes[13] << 24) >>> 0;
      let x = 0, y = 0;
      const put = (v) => {
        if (x < w && y < h) idx[y * w + x] = v;
        x++;
      };
      const nibble = comp === 2;
      while (y < h && pos2 + 1 < bytes.length) {
        const a = bytes[pos2], b = bytes[pos2 + 1];
        pos2 += 2;
        if (a === 0) {
          if (b === 0) {
            x = 0;
            y++;
          } else if (b === 1) break;
          else if (b === 2) {
            x += bytes[pos2];
            y += bytes[pos2 + 1];
            if (x > w) x = w;
            if (y > h) y = h;
            pos2 += 2;
          } else {
            let len = b;
            if (nibble) {
              for (let i = 0; i < len; i++) {
                const v = i % 2 === 0 ? bytes[pos2] >> 4 : bytes[pos2] & 15;
                if (i % 2 === 1) pos2++;
                put(v);
              }
              pos2 += len + 1 >> 1;
            } else {
              for (let i = 0; i < len; i++) put(bytes[pos2 + i]);
              pos2 += len + (len & 1);
            }
          }
        } else {
          const v = bytes[pos2];
          pos2++;
          if (nibble) {
            const hi = v >> 4, lo = v & 15;
            for (let i = 0; i < a; i++) put(hi);
            for (let i = 0; i < a; i++) put(lo);
          } else {
            for (let i = 0; i < a; i++) put(v);
          }
        }
      }
      const row = (yy) => topDown ? yy : h - 1 - yy;
      for (let yy = 0; yy < h; yy++) {
        for (let xx = 0; xx < w; xx++) {
          const c = palette[idx[yy * w + xx]];
          const o = (row(yy) * w + xx) * 4;
          rgba[o] = c[0];
          rgba[o + 1] = c[1];
          rgba[o + 2] = c[2];
          rgba[o + 3] = c[3];
        }
      }
      return { rgba, w, h, hasAlpha };
    }
    const rowBytes = Math.ceil(w * bpp / 32) * 4;
    let pos = (bytes[10] | bytes[11] << 8 | bytes[12] << 16 | bytes[13] << 24) >>> 0;
    if (pos + rowBytes * h > bytes.length) throw new Error("BMP 数据不完整");
    const pick = (x, y, ch) => {
      const yy = topDown ? y : h - 1 - y;
      const base = pos + yy * rowBytes + (x * bpp >> 3);
      const bit = bpp === 1 ? 7 - (x & 7) : bpp === 4 ? x & 1 ? 0 : 4 : 0;
      return bpp <= 8 ? bytes[base] >> bit & (1 << Math.min(bpp, 8)) - 1 : bytes[base + ch];
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        if (bpp >= 24) {
          rgba[o] = pick(x, y, 2);
          rgba[o + 1] = pick(x, y, 1);
          rgba[o + 2] = pick(x, y, 0);
          rgba[o + 3] = bpp === 32 ? pick(x, y, 3) : 255;
          if (rgba[o + 3] < 255) hasAlpha = true;
        } else {
          const c = palette[pick(x, y, 0)];
          rgba[o] = c[0];
          rgba[o + 1] = c[1];
          rgba[o + 2] = c[2];
          rgba[o + 3] = c[3];
        }
      }
    }
    return { rgba, w, h, hasAlpha };
  }

  // ofd2pdf/image/canvas.js
  function canvasImageToRgba(bytes, mime) {
    return new Promise((resolve, reject) => {
      let url;
      try {
        const blob = new Blob([bytes], { type: mime });
        url = URL.createObjectURL(blob);
      } catch (e) {
        reject(e);
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          if (!img.width || !img.height) throw new Error("图像尺寸为 0");
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const g = canvas.getContext("2d", { willReadFrequently: true });
          if (!g) throw new Error("无法获取 canvas 2d 上下文");
          g.drawImage(img, 0, 0);
          const data = g.getImageData(0, 0, img.width, img.height).data;
          resolve({ w: img.width, h: img.height, rgba: data });
        } catch (e) {
          reject(e);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(mime + " 图像加载失败"));
      };
      img.src = url;
    });
  }

  // ofd2pdf/image/deflate.js
  async function deflate(bytes, zlib) {
    if (typeof CompressionStream !== "undefined") {
      const cs = new CompressionStream("deflate");
      const writer = cs.writable.getWriter();
      const writeP = writer.write(bytes);
      const closeP = writer.close();
      const chunks = [];
      let total = 0;
      const reader = cs.readable.getReader();
      try {
        for (; ; ) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          total += value.length;
        }
      } finally {
        reader.releaseLock();
        writer.releaseLock();
        await Promise.allSettled([writeP, closeP]);
      }
      const out = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        out.set(c, off);
        off += c.length;
      }
      return out;
    }
    if (zlib) return new Uint8Array(zlib.deflateSync(Buffer.from(bytes)));
    throw new Error("当前环境不支持 deflate 压缩");
  }

  // ofd2pdf/image/gif.js
  function decodeGif(bytes) {
    if (bytes[0] !== 71 || bytes[1] !== 73 || bytes[2] !== 70) throw new Error("无效 GIF 头");
    const w = bytes[6] | bytes[7] << 8;
    const h = bytes[8] | bytes[9] << 8;
    if (!w || !h || w > 65536 || h > 65536) throw new Error("无效 GIF 尺寸");
    const packed = bytes[10];
    let pos = 13;
    const globalPal = [];
    if (packed & 128) {
      const n = 2 << (packed & 7);
      for (let i = 0; i < n; i++) {
        globalPal.push([bytes[pos], bytes[pos + 1], bytes[pos + 2]]);
        pos += 3;
      }
    }
    let transparent = -1;
    const chunks = () => {
      const out = [];
      for (; ; ) {
        const n = bytes[pos++];
        if (n === 0) break;
        out.push(bytes.subarray(pos, pos + n));
        pos += n;
      }
      return out;
    };
    while (pos + 1 < bytes.length) {
      const tag = bytes[pos++];
      if (tag === 59) break;
      if (tag === 33) {
        const label = bytes[pos++];
        if (label === 249) {
          pos++;
          const flags = bytes[pos++];
          pos += 2;
          if (flags & 1) transparent = bytes[pos];
          pos += 2;
        } else {
          chunks();
        }
      } else if (tag === 44) {
        const left = bytes[pos] | bytes[pos + 1] << 8;
        const top = bytes[pos + 2] | bytes[pos + 3] << 8;
        const imgW = bytes[pos + 4] | bytes[pos + 5] << 8;
        const imgH = bytes[pos + 6] | bytes[pos + 7] << 8;
        const ipacked = bytes[pos + 8];
        pos += 9;
        let pal = globalPal;
        if (ipacked & 128) {
          const n = 2 << (ipacked & 7);
          pal = [];
          for (let i = 0; i < n; i++) {
            pal.push([bytes[pos], bytes[pos + 1], bytes[pos + 2]]);
            pos += 3;
          }
        }
        const pix = gifLzwDecode(bytes[pos++], chunks(), imgW * imgH);
        let rows = null;
        if (ipacked & 64) {
          rows = [];
          for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]])
            for (let y = start; y < imgH; y += step) rows.push(y);
        }
        checkImageSize(w, h);
        const rgba = new Uint8Array(w * h * 4);
        let hasAlpha = false;
        let di = 0;
        const fillRow = (yy) => {
          for (let x = 0; x < imgW && di < pix.length; x++) {
            const c = pal[pix[di]];
            const o = ((top + yy) * w + left + x) * 4;
            const a = pix[di] === transparent ? 0 : 255;
            rgba[o] = c[0];
            rgba[o + 1] = c[1];
            rgba[o + 2] = c[2];
            rgba[o + 3] = a;
            if (a < 255) hasAlpha = true;
            di++;
          }
        };
        if (rows) for (const yy of rows) fillRow(yy);
        else for (let yy = 0; yy < imgH; yy++) fillRow(yy);
        return { rgba, w, h, hasAlpha };
      }
    }
    throw new Error("GIF 无图像数据");
  }
  function gifLzwDecode(minBits, chunks, need) {
    if (!(need > 0) || need > MAX_IMAGE_PIXELS * 4) throw new Error("LZW 输出尺寸异常：" + need);
    const clear = 1 << minBits;
    const end = clear + 1;
    let codeSize = minBits + 1;
    const dict = new Int32Array(4096 * 2);
    for (let i = 0; i < clear; i++) {
      dict[i * 2] = -1;
      dict[i * 2 + 1] = i;
    }
    let next = clear + 2;
    const out = new Uint8Array(need);
    let oi = 0;
    let bitBuf = 0, bitCnt = 0, bi = 0;
    let total = 0;
    for (const b of chunks) total += b.length;
    const flat = new Uint8Array(total);
    let fo = 0;
    for (const b of chunks) {
      flat.set(b, fo);
      fo += b.length;
    }
    const readCode = () => {
      while (bitCnt < codeSize) {
        if (bi >= flat.length) return -1;
        bitBuf |= flat[bi++] << bitCnt;
        bitCnt += 8;
      }
      const code = bitBuf & (1 << codeSize) - 1;
      bitBuf >>= codeSize;
      bitCnt -= codeSize;
      return code;
    };
    let prev = -1;
    const stack = new Uint16Array(4096);
    for (; ; ) {
      const code = readCode();
      if (code < 0) break;
      if (code === clear) {
        codeSize = minBits + 1;
        next = clear + 2;
        prev = -1;
        continue;
      }
      if (code === end) break;
      let emit;
      let kwk = false;
      if (code < next) {
        emit = code;
      } else if (code === next && prev >= 0) {
        emit = prev;
        kwk = true;
      } else {
        break;
      }
      let sp = 0;
      let c = emit;
      while (c >= 0) {
        stack[sp++] = dict[c * 2 + 1];
        c = dict[c * 2];
      }
      const first = stack[sp - 1];
      if (kwk) stack[sp++] = first;
      while (sp > 0 && oi < need) out[oi++] = stack[--sp];
      if (prev >= 0 && next < 4096) {
        dict[next * 2] = prev;
        dict[next * 2 + 1] = first;
        next++;
        if (next === 1 << codeSize && codeSize < 12) codeSize++;
      }
      prev = code;
      if (oi >= need) break;
    }
    return out;
  }

  // ofd2pdf/image/jpeg.js
  function parseJpegDims(bytes) {
    let pos = 2;
    let adobe = false;
    while (pos + 9 < bytes.length) {
      if (bytes[pos] !== 255) {
        pos++;
        continue;
      }
      const marker = bytes[pos + 1];
      pos += 2;
      if (marker === 218) break;
      if (marker === 216 || marker === 217 || marker >= 208 && marker <= 215) continue;
      const segLen = bytes[pos] << 8 | bytes[pos + 1];
      if (segLen < 2 || pos + segLen > bytes.length) break;
      if (marker === 238 && segLen >= 7 && bytes[pos + 2] === 65 && bytes[pos + 3] === 100 && bytes[pos + 4] === 111 && bytes[pos + 5] === 98 && bytes[pos + 6] === 101) {
        adobe = true;
      }
      if (marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204) {
        return {
          h: bytes[pos + 3] << 8 | bytes[pos + 4],
          w: bytes[pos + 5] << 8 | bytes[pos + 6],
          comps: bytes[pos + 7] || 3,
          adobe
        };
      }
      pos += segLen;
    }
    throw new Error("无法解析 JPEG 尺寸");
  }

  // ofd2pdf/image/png.js
  function decodePng(bytes, zlib) {
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) throw new Error("非 PNG 图像");
    const readU32 = (b, o2) => (b[o2] << 24 | b[o2 + 1] << 16 | b[o2 + 2] << 8 | b[o2 + 3]) >>> 0;
    let pos = 8, w = 0, h = 0, bitDepth = 8, colorType = 2, interlace = 0;
    let palette = null, trns = null;
    const idat = [];
    while (pos + 8 <= bytes.length) {
      const len = readU32(bytes, pos);
      const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
      const data = bytes.subarray(pos + 8, pos + 8 + len);
      pos += 12 + len;
      if (type === "IHDR") {
        w = readU32(data, 0);
        h = readU32(data, 4);
        bitDepth = data[8];
        colorType = data[9];
        interlace = data[12];
      } else if (type === "PLTE") {
        palette = data;
      } else if (type === "tRNS") {
        trns = data;
      } else if (type === "IDAT") {
        idat.push(data);
      } else if (type === "IEND") {
        break;
      }
    }
    if (interlace !== 0 && interlace !== 1) throw new Error("PNG 隔行方式 " + interlace + " 不支持");
    if (bitDepth !== 8 && bitDepth !== 16) throw new Error("PNG 位深 " + bitDepth + " 不支持");
    if ([0, 2, 3, 4, 6].indexOf(colorType) < 0) throw new Error("PNG 颜色类型 " + colorType + " 不支持");
    checkImageSize(w, h);
    let all = new Uint8Array(idat.reduce((s, d) => s + d.length, 0));
    let off = 0;
    for (const d of idat) {
      all.set(d, off);
      off += d.length;
    }
    all = new Uint8Array(zlib.inflateSync(Buffer.from(all)));
    const ch = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : 4;
    const depthBytes = bitDepth === 16 ? 2 : 1;
    const bpp = ch * depthBytes;
    const rowBytes = w * ch * depthBytes;
    const recon = new Uint8Array(h * rowBytes);
    const readScanlines = (src, pw, ph, passRowBytes) => {
      const buf = new Uint8Array(ph * passRowBytes);
      let prev = new Uint8Array(passRowBytes);
      for (let y = 0; y < ph; y++) {
        const f = all[src++];
        const row = buf.subarray(y * passRowBytes, (y + 1) * passRowBytes);
        for (let x = 0; x < passRowBytes; x++) {
          const left = x >= bpp ? row[x - bpp] : 0;
          const up = prev[x];
          const ul = x >= bpp ? prev[x - bpp] : 0;
          let v = all[src++];
          if (f === 1) v += left;
          else if (f === 2) v += up;
          else if (f === 3) v += left + up >> 1;
          else if (f === 4) {
            const p = left + up - ul;
            const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - ul);
            v += pa <= pb && pa <= pc ? left : pb <= pc ? up : ul;
          }
          row[x] = v & 255;
        }
        prev = row;
      }
      return { buf, next: src };
    };
    if (interlace === 0) {
      const r = readScanlines(0, w, h, rowBytes);
      recon.set(r.buf);
    } else {
      const PASSES = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
      let src = 0;
      for (const ps of PASSES) {
        const x0 = ps[0], y0 = ps[1], dx = ps[2], dy = ps[3];
        const pw = Math.ceil((w - x0) / dx), ph = Math.ceil((h - y0) / dy);
        if (pw <= 0 || ph <= 0) continue;
        const passRowBytes = pw * bpp;
        const r = readScanlines(src, pw, ph, passRowBytes);
        src = r.next;
        for (let py = 0; py < ph; py++) {
          const rowOff = (y0 + py * dy) * rowBytes;
          const pOff = py * passRowBytes;
          for (let px = 0; px < pw; px++) {
            const o2 = rowOff + (x0 + px * dx) * bpp;
            const po = pOff + px * bpp;
            for (let k = 0; k < bpp; k++) recon[o2 + k] = r.buf[po + k];
          }
        }
      }
    }
    const rgba = new Uint8Array(w * h * 4);
    let hasAlpha = false;
    const u16 = (o2) => trns[o2] << 8 | trns[o2 + 1];
    const grayKey = trns ? bitDepth === 16 ? u16(0) >> 8 : Math.round(u16(0) / 257) : -1;
    const rgbKey = trns && colorType === 2 ? [u16(0), u16(2), u16(4)].map((v) => bitDepth === 16 ? v >> 8 : Math.round(v / 257)) : null;
    let o = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const base = y * rowBytes + x * bpp;
        let r, g, b, a = 255;
        if (colorType === 3) {
          const idx = recon[base];
          r = palette ? palette[idx * 3] : idx;
          g = palette ? palette[idx * 3 + 1] : idx;
          b = palette ? palette[idx * 3 + 2] : idx;
          if (trns) a = trns[idx] !== void 0 ? trns[idx] : 255;
        } else if (colorType === 0) {
          r = g = b = recon[base];
          if (trns && recon[base] === grayKey) a = 0;
        } else if (colorType === 2) {
          r = recon[base];
          g = recon[base + depthBytes];
          b = recon[base + 2 * depthBytes];
          if (rgbKey && r === rgbKey[0] && g === rgbKey[1] && b === rgbKey[2]) a = 0;
        } else if (colorType === 4) {
          r = g = b = recon[base];
          a = recon[base + depthBytes];
        } else {
          r = recon[base];
          g = recon[base + depthBytes];
          b = recon[base + 2 * depthBytes];
          a = recon[base + 3 * depthBytes];
        }
        rgba[o++] = r;
        rgba[o++] = g;
        rgba[o++] = b;
        rgba[o++] = a;
        if (a < 255) hasAlpha = true;
      }
    }
    return { rgba, w, h, hasAlpha };
  }

  // ofd2pdf/image/xobject.js
  var MAX_IMAGE_PIXELS = 100 * 1e3 * 1e3;
  function checkImageSize(w, h) {
    if (!(w > 0) || !(h > 0)) throw new Error("无效图像尺寸：" + w + "×" + h);
    if (w * h > MAX_IMAGE_PIXELS) {
      throw new Error("图像尺寸过大（" + w + "×" + h + "），已跳过解码以防内存耗尽");
    }
  }
  async function decodeToXObject(bytes, mime, decode) {
    if (typeof document !== "undefined" && document.createElement) {
      return rgbaToXObject(await canvasImageToRgba(bytes, mime));
    }
    const zlib = nodeZlib();
    if (!zlib) throw new Error("Node 环境缺少 zlib，无法压缩图像数据");
    return rgbaToXObject(decode(bytes, zlib), zlib);
  }
  async function rgbaToXObject(p, zlib) {
    const w = p.w, h = p.h, rgba = p.rgba;
    const n = w * h;
    const color = new Uint8Array(n * 3);
    const alpha = new Uint8Array(n);
    let o = 0, a = 0, hasAlpha = false;
    for (let i = 0; i < rgba.length; i += 4) {
      color[o] = rgba[i];
      color[o + 1] = rgba[i + 1];
      color[o + 2] = rgba[i + 2];
      o += 3;
      alpha[a++] = rgba[i + 3];
      if (rgba[i + 3] < 255) hasAlpha = true;
    }
    const data = await deflate(color, zlib);
    let smask = null;
    if (hasAlpha) smask = { data: await deflate(alpha, zlib), filter: "FlateDecode" };
    return { w, h, data, filter: "FlateDecode", smask };
  }
  async function addImage(dataUrl, ctx) {
    if (ctx.imageReg.has(dataUrl)) {
      const im2 = ctx.imageReg.get(dataUrl);
      ctx.images.add(im2.name);
      return im2.name;
    }
    const m = /^data:([^;,]+)(;[^,]*)?,(.*)$/.exec(dataUrl);
    const mime = m ? m[1] : "";
    const isB64 = !!(m && m[2] && /;base64/i.test(m[2]));
    const body = m ? m[3] : "";
    let bytes;
    try {
      bytes = isB64 ? base64ToBytes(body) : new TextEncoder().encode(decodeURIComponent(body));
    } catch (e) {
      console.warn("[TOPDF] 图像数据解析失败，已跳过");
      return null;
    }
    let im;
    try {
      if (/jpe?g$/i.test(mime)) {
        const d = parseJpegDims(bytes);
        const cs = d.comps === 1 ? "DeviceGray" : d.comps === 4 ? "DeviceCMYK" : "DeviceRGB";
        im = { w: d.w, h: d.h, data: bytes, filter: "DCTDecode", colorSpace: cs };
        if (cs === "DeviceCMYK" && d.adobe) im.decode = [1, 0, 1, 0, 1, 0, 1, 0];
      } else if (/png$/i.test(mime)) {
        im = await decodeToXObject(bytes, "image/png", decodePng);
      } else if (/bmp$/i.test(mime)) {
        im = await decodeToXObject(bytes, "image/bmp", decodeBmp);
      } else if (/gif$/i.test(mime)) {
        im = await decodeToXObject(bytes, "image/gif", decodeGif);
      } else {
        console.warn("[TOPDF] 不支持的图像格式: " + mime);
        return null;
      }
    } catch (e) {
      console.warn("[TOPDF] 图像嵌入失败已跳过: " + e.message);
      return null;
    }
    im.name = "Im" + ctx.imageReg.size;
    ctx.imageReg.set(dataUrl, im);
    ctx.images.add(im.name);
    return im.name;
  }

  // ofd2pdf/svg/parse.js
  function parseSvgXml(str) {
    let pos = 0;
    const len = str.length;
    function skipWs() {
      while (pos < len && /\s/.test(str[pos])) pos++;
    }
    function parseEl() {
      if (str.substr(pos, 4) === "<!--") {
        const end = str.indexOf("-->", pos + 4);
        pos = end < 0 ? len : end + 3;
        return null;
      }
      pos++;
      skipWs();
      let tag = "";
      while (pos < len && !/[\s/>]/.test(str[pos])) tag += str[pos++];
      const el = { tag: tag.toLowerCase(), attrs: {}, children: [], text: "", rawText: "" };
      skipWs();
      for (; ; ) {
        if (pos >= len) break;
        const ch = str[pos];
        if (ch === "/") {
          pos++;
          skipWs();
          if (str[pos] === ">") {
            pos++;
            return el;
          }
        }
        if (ch === ">") {
          pos++;
          break;
        }
        let name = "";
        while (pos < len && !/[\s=/>]/.test(str[pos])) name += str[pos++];
        skipWs();
        let value = "";
        if (str[pos] === "=") {
          pos++;
          skipWs();
          if (str[pos] === '"' || str[pos] === "'") {
            const q = str[pos++];
            while (pos < len && str[pos] !== q) value += str[pos++];
            pos++;
          } else {
            while (pos < len && !/[\s/>]/.test(str[pos])) value += str[pos++];
          }
        }
        if (name) el.attrs[name] = unescapeXml(value);
        skipWs();
      }
      let text = "";
      for (; ; ) {
        if (pos >= len) break;
        if (str[pos] === "<") {
          if (str.substr(pos, 2) === "</") {
            const end = str.indexOf(">", pos);
            pos = end < 0 ? len : end + 1;
            break;
          }
          const child = parseEl();
          if (child) el.children.push(child);
        } else {
          text += str[pos++];
        }
      }
      if (text) {
        el.rawText = unescapeXml(text);
        el.text = el.rawText.trim();
      }
      return el;
    }
    return parseEl();
  }

  // ofd2pdf/svg/path.js
  function arcToCubics(x0, y0, rx, ry, rotDeg, laf, sf, x1, y1) {
    const segs = [];
    if (x0 === x1 && y0 === y1) return segs;
    rx = Math.abs(rx);
    ry = Math.abs(ry);
    if (rx === 0 || ry === 0) {
      segs.push({ c1: [x1, y1], c2: [x1, y1], p: [x1, y1] });
      return segs;
    }
    const phi = rotDeg * Math.PI / 180;
    const cosP = Math.cos(phi), sinP = Math.sin(phi);
    const dx = (x0 - x1) / 2, dy = (y0 - y1) / 2;
    const x1p = cosP * dx + sinP * dy;
    const y1p = -sinP * dx + cosP * dy;
    let rx2 = rx * rx, ry2 = ry * ry;
    const lam = x1p * x1p / rx2 + y1p * y1p / ry2;
    if (lam > 1) {
      rx *= Math.sqrt(lam);
      ry *= Math.sqrt(lam);
      rx2 = rx * rx;
      ry2 = ry * ry;
    }
    const num = rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p;
    const den = rx2 * y1p * y1p + ry2 * x1p * x1p;
    let rad = den ? Math.sqrt(Math.max(0, num / den)) : 0;
    if (laf === sf) rad = -rad;
    const cxp = rad * rx * y1p / ry;
    const cyp = -rad * ry * x1p / rx;
    const cx = cosP * cxp - sinP * cyp + (x0 + x1) / 2;
    const cy = sinP * cxp + cosP * cyp + (y0 + y1) / 2;
    const ang = (ux, uy, vx, vy) => {
      const dot = ux * vx + uy * vy;
      const l = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy)) || 1;
      let a = Math.acos(Math.max(-1, Math.min(1, dot / l)));
      if (ux * vy - uy * vx < 0) a = -a;
      return a;
    };
    const theta1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let dtheta = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!sf && dtheta > 0) dtheta -= 2 * Math.PI;
    else if (sf && dtheta < 0) dtheta += 2 * Math.PI;
    const n = Math.max(1, Math.ceil(Math.abs(dtheta) / (Math.PI / 2)));
    const dth = dtheta / n;
    const pt = (t) => [
      cx + rx * Math.cos(t) * cosP - ry * Math.sin(t) * sinP,
      cy + rx * Math.cos(t) * sinP + ry * Math.sin(t) * cosP
    ];
    let a0 = theta1;
    for (let k = 0; k < n; k++) {
      const a1 = a0 + dth;
      const p1 = pt(a0 + dth / 3);
      const p2 = pt(a0 + 2 * dth / 3);
      const p3 = pt(a1);
      segs.push({ c1: [p1[0], p1[1]], c2: [p2[0], p2[1]], p: [p3[0], p3[1]] });
      a0 = a1;
    }
    return segs;
  }
  function ellipseToCubics(cx, cy, rx, ry) {
    const k = 0.5522847498307936;
    const kx = rx * k, ky = ry * k;
    return [
      { c1: [cx + rx, cy + ky], c2: [cx + kx, cy + ry], p: [cx, cy + ry] },
      { c1: [cx - kx, cy + ry], c2: [cx - rx, cy + ky], p: [cx - rx, cy] },
      { c1: [cx - rx, cy - ky], c2: [cx - kx, cy - ry], p: [cx, cy - ry] },
      { c1: [cx + kx, cy - ry], c2: [cx + rx, cy - ky], p: [cx + rx, cy] }
    ];
  }
  function pathToPdf(d, tm) {
    const re = /[MLCQAZ]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
    const toks = String(d).match(re) || [];
    const out = [];
    let i = 0;
    let curX = 0, curY = 0, subX = 0, subY = 0;
    let prevCmd = "";
    const read = () => parseFloat(toks[i++]);
    const isLetter = (t) => /^[MLCQAZ]$/.test(t);
    const xf = (x, y) => tm ? [tm[0] * x + tm[2] * y + tm[4], tm[1] * x + tm[3] * y + tm[5]] : [x, y];
    while (i < toks.length) {
      let cmd = toks[i];
      if (isLetter(cmd)) {
        i++;
        prevCmd = cmd;
      } else {
        cmd = prevCmd === "M" ? "L" : prevCmd || "L";
      }
      if (cmd === "Z") {
        out.push("h");
        curX = subX;
        curY = subY;
        continue;
      }
      const arity = cmd === "C" ? 6 : cmd === "Q" ? 4 : cmd === "A" ? 7 : 2;
      do {
        if (i >= toks.length || isLetter(toks[i])) break;
        const p = [];
        for (let k = 0; k < arity; k++) p.push(read());
        if (p.some((v) => !isFinite(v))) break;
        if (cmd === "M") {
          const q = xf(p[0], p[1]);
          curX = q[0];
          curY = q[1];
          out.push(fmtNum(curX) + " " + fmtNum(curY) + " m");
          subX = curX;
          subY = curY;
          prevCmd = "L";
        } else if (cmd === "L") {
          const q = xf(p[0], p[1]);
          curX = q[0];
          curY = q[1];
          out.push(fmtNum(curX) + " " + fmtNum(curY) + " l");
        } else if (cmd === "C") {
          const q1 = xf(p[0], p[1]), q2 = xf(p[2], p[3]), q3 = xf(p[4], p[5]);
          curX = q3[0];
          curY = q3[1];
          out.push(fmtNum(q1[0]) + " " + fmtNum(q1[1]) + " " + fmtNum(q2[0]) + " " + fmtNum(q2[1]) + " " + fmtNum(curX) + " " + fmtNum(curY) + " c");
        } else if (cmd === "Q") {
          const q1 = xf(p[0], p[1]), q2 = xf(p[2], p[3]);
          const c1x = curX + (q1[0] - curX) * 2 / 3;
          const c1y = curY + (q1[1] - curY) * 2 / 3;
          const c2x = q2[0] + (q1[0] - q2[0]) * 2 / 3;
          const c2y = q2[1] + (q1[1] - q2[1]) * 2 / 3;
          curX = q2[0];
          curY = q2[1];
          out.push(fmtNum(c1x) + " " + fmtNum(c1y) + " " + fmtNum(c2x) + " " + fmtNum(c2y) + " " + fmtNum(curX) + " " + fmtNum(curY) + " c");
        } else {
          const q = xf(p[5], p[6]);
          const segs = arcToCubics(curX, curY, p[0], p[1], p[2], p[3], p[4], q[0], q[1]);
          for (const s of segs) {
            out.push(fmtNum(s.c1[0]) + " " + fmtNum(s.c1[1]) + " " + fmtNum(s.c2[0]) + " " + fmtNum(s.c2[1]) + " " + fmtNum(s.p[0]) + " " + fmtNum(s.p[1]) + " c");
          }
          curX = q[0];
          curY = q[1];
        }
      } while (i < toks.length && !isLetter(toks[i]));
    }
    return out.join(" ");
  }

  // ofd2pdf/svg/transform.js
  function parseTransform(str) {
    let m = [1, 0, 0, 1, 0, 0];
    const re = /(translate|matrix|scale|rotate)\(([^)]*)\)/g;
    let mm;
    while (mm = re.exec(str || "")) {
      const args = mm[2].trim().split(/[\s,]+/).map(Number);
      let t;
      if (mm[1] === "translate") {
        t = [1, 0, 0, 1, args[0] || 0, args[1] || 0];
      } else if (mm[1] === "matrix") {
        t = args;
      } else if (mm[1] === "scale") {
        const sx = args[0] || 1;
        t = [sx, 0, 0, args[1] != null ? args[1] : sx, 0, 0];
      } else {
        const ang = (args[0] || 0) * Math.PI / 180;
        const c = Math.cos(ang), s = Math.sin(ang);
        const cx = args[1] || 0, cy = args[2] || 0;
        t = [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
      }
      m = [
        m[0] * t[0] + m[2] * t[1],
        m[1] * t[0] + m[3] * t[1],
        m[0] * t[2] + m[2] * t[3],
        m[1] * t[2] + m[3] * t[3],
        m[0] * t[4] + m[2] * t[5] + m[4],
        m[1] * t[4] + m[3] * t[5] + m[5]
      ];
    }
    return m;
  }
  function parseRotate(str) {
    const m = /rotate\(\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)\s*\)/.exec(str || "");
    if (!m) return null;
    return { ang: parseFloat(m[1]) * Math.PI / 180, cx: parseFloat(m[2]), cy: parseFloat(m[3]) };
  }
  function parseClipRef(str) {
    const m = /url\(\s*#([^)\s]+)\s*\)/.exec(str || "");
    return m ? m[1] : null;
  }

  // ofd2pdf/pdf/font.js
  function familyKind(fam) {
    const s = String(fam || "").toLowerCase();
    if (/wingdings|webdings|dingbat|symbol|cmsy|cmex/.test(s)) return "symbol";
    if (/courier|monospace|consolas|menlo|cmtt|mono\b/.test(s)) return "mono";
    if (/楷|kai/.test(s)) return "kai";
    if (/仿宋|fangsong/.test(s)) return "fangsong";
    if (/黑|hei|yahei|雅黑|sans|arial|helvetica|verdana|calibri|segoe|tahoma|cmss/.test(s)) return "sans";
    return "serif";
  }
  var TYPE1 = {
    mono: ["Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique"],
    sans: ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique"],
    serif: ["Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic"]
  };
  var CJK = {
    serif: { regular: "STSong-Light" },
    sans: { regular: "STHeiti-Light", bold: "STHeiti-Regular" },
    kai: { regular: "STKaiti" },
    fangsong: { regular: "STFangsong-Light" },
    symbol: { regular: "STSong-Light" },
    mono: { regular: "STSong-Light" }
  };
  function resolveFont(attrs, cidOnly) {
    attrs = attrs || {};
    const kind = familyKind(unescapeXml(attrs["font-family"] || ""));
    const weight = String(attrs["font-weight"] || "normal").toLowerCase();
    const style = String(attrs["font-style"] || "normal").toLowerCase();
    const bold = weight === "bold" || weight === "bolder" || (parseInt(weight, 10) || 0) >= 600;
    const italic = style === "italic" || style === "oblique";
    if (!cidOnly && TYPE1[kind]) {
      const names = TYPE1[kind];
      return {
        kind: "type1",
        base: names[(bold ? 1 : 0) + (italic ? 2 : 0)],
        bold,
        italic,
        syntheticBold: false
      };
    }
    const fam = CJK[kind] || CJK.serif;
    let base = fam.regular;
    let syntheticBold = false;
    if (bold) {
      if (fam.bold) base = fam.bold;
      else syntheticBold = true;
    }
    return { kind: "cid", base, bold, italic, syntheticBold };
  }
  function ensureFont(font, ctx) {
    const key = font.kind + "|" + font.base;
    let e = ctx.fontReg.get(key);
    if (!e) {
      e = { name: "F" + (ctx.fontReg.size + 1), kind: font.kind, base: font.base };
      ctx.fontReg.set(key, e);
    }
    ctx.fonts.add(e.name);
    return e.name;
  }
  function encodeChar(font, ch) {
    if (font.kind === "type1") {
      return ch.codePointAt(0).toString(16).padStart(2, "0");
    }
    return utf16beHex(ch);
  }
  function isType1Safe(text) {
    for (const ch of String(text)) {
      const c = ch.codePointAt(0);
      if (c < 32 || c > 126) return false;
    }
    return true;
  }

  // ofd2pdf/pdf/shading.js
  var clamp01 = (v) => Math.max(0, Math.min(1, v));
  function parseGradient(el) {
    const stops = [];
    for (const c of el.children) {
      if (c.tag !== "stop") continue;
      const raw = String(c.attrs.offset == null ? "0" : c.attrs.offset);
      let off = parseFloat(raw);
      if (!isFinite(off)) off = 0;
      if (/%$/.test(raw)) off /= 100;
      const col = parseCssColor(c.attrs["stop-color"]) || { r: 0, g: 0, b: 0 };
      const op = parseFloat(c.attrs["stop-opacity"]);
      stops.push({
        offset: clamp01(off),
        r: col.r,
        g: col.g,
        b: col.b,
        a: isFinite(op) ? clamp01(op) : 1
      });
    }
    if (!stops.length) return null;
    stops.sort((x, y) => x.offset - y.offset);
    if (stops.length === 1) stops.push(Object.assign({}, stops[0], { offset: 1 }));
    const extend = [true, true];
    const num = (k) => {
      const v = parseFloat(el.attrs[k]);
      return isFinite(v) ? v : 0;
    };
    if (el.tag === "lineargradient") {
      const coords = [num("x1"), num("y1"), num("x2"), num("y2")];
      if (Math.abs(coords[0] - coords[2]) < 1e-9 && Math.abs(coords[1] - coords[3]) < 1e-9) return null;
      return { type: 2, coords, stops, extend };
    }
    const r = num("r");
    if (!(r > 0)) return null;
    return { type: 3, coords: [num("cx"), num("cy"), 0, num("cx"), num("cy"), r], stops, extend };
  }
  var rgb = (c) => [fmtNum(c.r / 255), fmtNum(c.g / 255), fmtNum(c.b / 255)].join(" ");
  var segmentFn = (c0, c1) => "<< /FunctionType 2 /Domain [0 1] /C0 [" + rgb(c0) + "] /C1 [" + rgb(c1) + "] /N 1 >>";
  function stitchFunction(stops) {
    const fns = [], bounds = [], enc = [];
    for (let i = 0; i < stops.length - 1; i++) {
      fns.push(segmentFn(stops[i], stops[i + 1]));
      enc.push("0 1");
      if (i < stops.length - 2) bounds.push(fmtNum(stops[i + 1].offset));
    }
    return "<< /FunctionType 3 /Domain [0 1] /Functions [" + fns.join(" ") + "] /Bounds [" + bounds.join(" ") + "] /Encode [" + enc.join(" ") + "] >>";
  }
  function normalizeStops(stops) {
    const out = [];
    for (const s of stops) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.offset - s.offset) < 1e-6) out[out.length - 1] = s;
      else out.push(s);
    }
    if (out[0].offset > 1e-6) out.unshift(Object.assign({}, out[0], { offset: 0 }));
    const tail = out[out.length - 1];
    if (tail.offset < 1 - 1e-6) out.push(Object.assign({}, tail, { offset: 1 }));
    return out;
  }
  function buildShadingDict(g) {
    const stops = normalizeStops(g.stops);
    const ext = g.extend && g.extend[0] && g.extend[1] ? "true true" : g.extend && g.extend[0] ? "true false" : "false false";
    return "<< /ShadingType " + g.type + " /ColorSpace /DeviceRGB /Coords [" + g.coords.map(fmtNum).join(" ") + "] /Function " + stitchFunction(stops) + " /Extend [" + ext + "] >>";
  }
  function gradientAlpha(g) {
    if (!g || !g.stops || !g.stops.length) return null;
    let sum = 0;
    for (const s of g.stops) sum += s.a;
    const a = sum / g.stops.length;
    return a < 1 ? a : null;
  }
  function gradientColorAt(g, t) {
    const stops = g && g.stops;
    if (!stops || !stops.length) return { r: 0, g: 0, b: 0 };
    t = clamp01(t == null ? 0.5 : t);
    if (t <= stops[0].offset) return { r: stops[0].r, g: stops[0].g, b: stops[0].b };
    for (let i = 1; i < stops.length; i++) {
      const s1 = stops[i];
      if (t <= s1.offset) {
        const s0 = stops[i - 1];
        const span = s1.offset - s0.offset;
        const k = span > 1e-9 ? (t - s0.offset) / span : 0;
        return {
          r: Math.round(s0.r + (s1.r - s0.r) * k),
          g: Math.round(s0.g + (s1.g - s0.g) * k),
          b: Math.round(s0.b + (s1.b - s0.b) * k)
        };
      }
    }
    const last = stops[stops.length - 1];
    return { r: last.r, g: last.g, b: last.b };
  }

  // ofd2pdf/pdf/render.js
  function blendOf(el) {
    const m = /mix-blend-mode\s*:\s*([a-zA-Z]+)/.exec(el.attrs.style || "");
    const b = m ? m[1].toLowerCase() : "";
    return b && b !== "normal" ? b : null;
  }
  function ensureGState(alpha, blend, ctx) {
    if ((alpha == null || alpha >= 1) && !blend) return null;
    const a = alpha == null ? 1 : Math.max(0, Math.min(1, alpha));
    const key = a + "|" + (blend || "");
    let g = ctx.alphaReg.get(key);
    if (!g) {
      g = { name: "GS" + ctx.alphaReg.size, a, blend };
      ctx.alphaReg.set(key, g);
    }
    ctx.alphas.add(g.name);
    return g.name;
  }
  function ensureShading(id, ctx) {
    const g = ctx.gradientDefs.get(id);
    if (!g) return null;
    const dict = buildShadingDict(g);
    let e = ctx.shadingReg.get(dict);
    if (!e) {
      e = { name: "Sh" + ctx.shadingReg.size, dict };
      ctx.shadingReg.set(dict, e);
    }
    ctx.shadings.add(e.name);
    return e.name;
  }
  function paintSource(raw, ctx) {
    if (!raw || raw === "none") return null;
    const c = parseCssColor(raw);
    if (c) return { color: c };
    const id = parseClipRef(raw);
    if (!id) return null;
    const g = ctx.gradientDefs.get(id);
    if (!g) return null;
    const name = ensureShading(id, ctx);
    return name ? { gradient: g, shading: name } : null;
  }
  var alphaOf = (c) => c && c.a != null && c.a < 1 ? c.a : null;
  function colorOp(c, isStroke) {
    return fmtNum(c.r / 255) + " " + fmtNum(c.g / 255) + " " + fmtNum(c.b / 255) + (isStroke ? " RG" : " rg");
  }
  function strokeStyle(el, parts) {
    const w = parseFloat(el.attrs["stroke-width"]);
    if (isFinite(w)) parts.push(fmtNum(w) + " w");
    const da = numList(el.attrs["stroke-dasharray"]);
    if (da.length) parts.push("[" + da.map(fmtNum).join(" ") + "] 0 d");
  }
  function paintShape(el, ctx, parts, pathOps, evenodd) {
    const fill = paintSource(el.attrs.fill, ctx);
    const stroke = paintSource(el.attrs.stroke, ctx);
    if (!fill && !stroke) return;
    const blend = blendOf(el);
    parts.push("q");
    if (fill && fill.color && stroke && stroke.color) {
      const fa = alphaOf(fill.color), sa = alphaOf(stroke.color);
      const gs = ensureGState(fa == null ? sa : sa == null ? fa : Math.min(fa, sa), blend, ctx);
      if (gs) parts.push("/" + gs + " gs");
      strokeStyle(el, parts);
      parts.push(pathOps);
      parts.push(colorOp(fill.color, false), colorOp(stroke.color, true));
      parts.push(evenodd ? "B*" : "B");
    } else {
      if (fill) {
        const gs = ensureGState(fill.color ? alphaOf(fill.color) : gradientAlpha(fill.gradient), blend, ctx);
        parts.push("q");
        if (gs) parts.push("/" + gs + " gs");
        parts.push(pathOps);
        if (fill.shading) {
          parts.push(evenodd ? "W* n" : "W n");
          parts.push("/" + fill.shading + " sh");
        } else {
          parts.push(colorOp(fill.color, false));
          parts.push(evenodd ? "f*" : "f");
        }
        parts.push("Q");
      }
      if (stroke) {
        const col = stroke.color || gradientColorAt(stroke.gradient, 0.5);
        const gs = ensureGState(stroke.color ? alphaOf(stroke.color) : gradientAlpha(stroke.gradient), blend, ctx);
        parts.push("q");
        if (gs) parts.push("/" + gs + " gs");
        strokeStyle(el, parts);
        parts.push(pathOps);
        parts.push(colorOp(col, true));
        parts.push("S");
        parts.push("Q");
      }
    }
    parts.push("Q");
  }
  function registerClip(el, ctx) {
    const id = el.attrs.id;
    if (!id) return;
    const shapes = [];
    for (const c of el.children) {
      const rule = c.attrs["clip-rule"] || c.attrs["fill-rule"] || "";
      const tm = c.attrs.transform ? parseTransform(c.attrs.transform) : null;
      if (c.tag === "rect") {
        shapes.push({
          kind: "rect",
          x: parseFloat(c.attrs.x) || 0,
          y: parseFloat(c.attrs.y) || 0,
          w: parseFloat(c.attrs.width) || 0,
          h: parseFloat(c.attrs.height) || 0,
          tm,
          rule
        });
      } else if (c.tag === "path") {
        if (c.attrs.d) shapes.push({ kind: "path", d: c.attrs.d, tm, rule });
      } else if (c.tag === "ellipse" || c.tag === "circle") {
        const cx = parseFloat(c.attrs.cx) || 0, cy = parseFloat(c.attrs.cy) || 0;
        const rx = c.tag === "circle" ? parseFloat(c.attrs.r) || 0 : parseFloat(c.attrs.rx) || 0;
        const ry = c.tag === "circle" ? parseFloat(c.attrs.r) || 0 : parseFloat(c.attrs.ry) || 0;
        if (rx && ry) shapes.push({ kind: "ellipse", cx, cy, rx, ry, tm, rule });
      }
    }
    ctx.clips.set(id, shapes);
  }
  function collectClips(root, ctx) {
    (function walk(el) {
      for (const c of el.children) {
        if (c.tag === "clippath") registerClip(c, ctx);
        walk(c);
      }
    })(root);
  }
  function ellipsePath(cx, cy, rx, ry) {
    const out = [fmtNum(cx + rx) + " " + fmtNum(cy) + " m"];
    for (const s of ellipseToCubics(cx, cy, rx, ry)) {
      out.push(fmtNum(s.c1[0]) + " " + fmtNum(s.c1[1]) + " " + fmtNum(s.c2[0]) + " " + fmtNum(s.c2[1]) + " " + fmtNum(s.p[0]) + " " + fmtNum(s.p[1]) + " c");
    }
    out.push("h");
    return out.join("\n");
  }
  function rectPath(s) {
    const x = s.x, y = s.y, w = s.w, h = s.h;
    if (!w || !h) return null;
    if (!s.tm) return fmtNum(x) + " " + fmtNum(y) + " " + fmtNum(w) + " " + fmtNum(h) + " re";
    const m = s.tm;
    const pt = (px, py) => [fmtNum(m[0] * px + m[2] * py + m[4]), fmtNum(m[1] * px + m[3] * py + m[5])];
    const p = [pt(x, y), pt(x + w, y), pt(x + w, y + h), pt(x, y + h)];
    return p[0].join(" ") + " m\n" + p.slice(1).map((q) => q.join(" ") + " l").join("\n") + "\nh";
  }
  function emitClip(id, ctx, parts) {
    const shapes = ctx.clips.get(id);
    if (!shapes || !shapes.length) return false;
    let evenodd = false, n = 0;
    for (const s of shapes) {
      if (s.rule === "evenodd") evenodd = true;
      let ops = null;
      if (s.kind === "rect") ops = rectPath(s);
      else if (s.kind === "path") ops = pathToPdf(s.d, s.tm);
      else if (s.kind === "ellipse") ops = ellipsePath(s.cx, s.cy, s.rx, s.ry);
      if (ops) {
        parts.push(ops);
        n++;
      }
    }
    if (!n) return false;
    parts.push(evenodd ? "W* n" : "W n");
    return true;
  }
  function renderRect(el, ctx, parts) {
    const x = parseFloat(el.attrs.x) || 0;
    const y = parseFloat(el.attrs.y) || 0;
    const w = parseFloat(el.attrs.width) || 0;
    const h = parseFloat(el.attrs.height) || 0;
    if (!w || !h) return;
    const fillColor = el.attrs.fill ? parseCssColor(el.attrs.fill) : null;
    if (fillColor && fillColor.r === 255 && fillColor.g === 255 && fillColor.b === 255 && !el.attrs.stroke && x <= 0.01 && y <= 0.01 && x + w >= (ctx.pageW || 0) - 0.01 && y + h >= (ctx.pageH || 0) - 0.01) return;
    const tm = el.attrs.transform ? parseTransform(el.attrs.transform) : null;
    parts.push("q");
    if (tm) parts.push(tm.map(fmtNum).join(" ") + " cm");
    paintShape(el, ctx, parts, fmtNum(x) + " " + fmtNum(y) + " " + fmtNum(w) + " " + fmtNum(h) + " re", false);
    parts.push("Q");
  }
  function renderPath(el, ctx, parts) {
    if (!el.attrs.d) return;
    const tm = el.attrs.transform ? parseTransform(el.attrs.transform) : null;
    const path = pathToPdf(el.attrs.d, null);
    if (!path) return;
    parts.push("q");
    if (tm) parts.push(tm.map(fmtNum).join(" ") + " cm");
    paintShape(el, ctx, parts, path, el.attrs["fill-rule"] === "evenodd");
    parts.push("Q");
  }
  function renderEllipse(el, ctx, parts) {
    const cx = parseFloat(el.attrs.cx) || 0;
    const cy = parseFloat(el.attrs.cy) || 0;
    let rx, ry;
    if (el.tag === "circle") {
      rx = ry = parseFloat(el.attrs.r) || 0;
    } else {
      rx = parseFloat(el.attrs.rx) || 0;
      ry = parseFloat(el.attrs.ry) || 0;
    }
    if (!rx || !ry) return;
    const tm = el.attrs.transform ? parseTransform(el.attrs.transform) : null;
    parts.push("q");
    if (tm) parts.push(tm.map(fmtNum).join(" ") + " cm");
    paintShape(el, ctx, parts, ellipsePath(cx, cy, rx, ry), false);
    parts.push("Q");
  }
  function tspanText(ts) {
    const raw = ts.rawText != null ? ts.rawText : ts.text;
    if (!raw) return "";
    return /[\r\n]/.test(raw) ? raw.trim() : raw;
  }
  function glyphMatrix(m, x, y, font, rot) {
    let tm;
    if (rot) {
      const c = Math.cos(rot.ang), s = Math.sin(rot.ang);
      const s0 = m[0];
      tm = [s0 * c, s0 * s, s, -c, s0 * rot.cx, rot.cy];
    } else {
      tm = [m[0], m[1], -m[2], -m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    }
    if (font.italic && font.kind === "cid" && !rot) {
      const t = Math.tan(12 * Math.PI / 180);
      tm = [tm[0], tm[1], tm[0] * t + tm[2], tm[1] * t + tm[3], tm[4], tm[5]];
    }
    return tm;
  }
  function pushGlyph(parts, font, ch, tm, size) {
    const hex = encodeChar(font, ch);
    parts.push(tm.map(fmtNum).join(" ") + " Tm");
    parts.push("<" + hex + "> Tj");
    if (font.syntheticBold) {
      const dx = tm[0] * size * 0.025, dy = tm[1] * size * 0.025;
      parts.push([tm[0], tm[1], tm[2], tm[3], tm[4] + dx, tm[5] + dy].map(fmtNum).join(" ") + " Tm");
      parts.push("<" + hex + "> Tj");
    }
  }
  function renderText(el, ctx, parts) {
    const fillAttr = el.attrs.fill;
    if (fillAttr === "none") return;
    const fillSrc = paintSource(fillAttr, ctx);
    const fill = fillSrc ? fillSrc.color || gradientColorAt(fillSrc.gradient, 0.5) : { r: 0, g: 0, b: 0 };
    const fillAlpha = fillSrc ? fillSrc.color ? alphaOf(fillSrc.color) : gradientAlpha(fillSrc.gradient) : null;
    const m = parseTransform(el.attrs.transform || "");
    const fontSize = parseFloat(el.attrs["font-size"]) || 3;
    const textRuns = [];
    const hasTspan = el.children.some((c) => c.tag === "tspan");
    if (hasTspan) {
      for (const ts of el.children) {
        if (ts.tag !== "tspan") continue;
        const body = tspanText(ts);
        if (body) textRuns.push({ text: body, x: ts.attrs.x, y: ts.attrs.y, transform: ts.attrs.transform });
      }
    } else if (el.text) {
      textRuns.push({ text: el.text, x: el.attrs.x, y: el.attrs.y, transform: null });
    }
    if (!textRuns.length) return;
    let font = resolveFont(el.attrs);
    if (font.kind === "type1") {
      for (const r of textRuns) {
        if (!isType1Safe(r.text)) {
          font = resolveFont(el.attrs, true);
          break;
        }
      }
    }
    const fname = ensureFont(font, ctx);
    const gs = ensureGState(fillAlpha, blendOf(el), ctx);
    if (gs) {
      parts.push("q");
      parts.push("/" + gs + " gs");
    }
    parts.push("BT");
    parts.push("/" + fname + " " + fmtNum(fontSize) + " Tf");
    parts.push(fmtNum(fill.r / 255) + " " + fmtNum(fill.g / 255) + " " + fmtNum(fill.b / 255) + " rg");
    for (let ti = 0; ti < textRuns.length; ti++) {
      const ts = textRuns[ti];
      const chars = Array.from(ts.text);
      if (!chars.length) continue;
      const xs = numList(ts.x);
      const ys = numList(ts.y);
      const rot = parseRotate(ts.transform);
      const isDirect = !hasTspan && ti === 0;
      if (isDirect) {
        const x0 = xs[0] || 0;
        const y0 = ys[0] || 0;
        const tm = glyphMatrix(m, x0, y0, font, rot);
        parts.push(tm.map(fmtNum).join(" ") + " Tm");
        parts.push("<" + chars.map((c) => encodeChar(font, c)).join("") + "> Tj");
      } else {
        for (let i = 0; i < chars.length; i++) {
          const x = i < xs.length ? xs[i] : xs.length ? xs[xs.length - 1] : 0;
          const y = i < ys.length ? ys[i] : ys.length ? ys[ys.length - 1] : 0;
          pushGlyph(parts, font, chars[i], glyphMatrix(m, x, y, font, rot), fontSize);
        }
      }
    }
    parts.push("ET");
    if (gs) parts.push("Q");
  }
  async function renderImage(el, ctx, parts) {
    const x = parseFloat(el.attrs.x) || 0;
    const y = parseFloat(el.attrs.y) || 0;
    const w = parseFloat(el.attrs.width) || 0;
    const h = parseFloat(el.attrs.height) || 0;
    if (!w || !h) return;
    const href = el.attrs.href || el.attrs["xlink:href"];
    if (!href) return;
    const name = await addImage(href, ctx);
    if (!name) return;
    const op = parseFloat(el.attrs.opacity);
    const gs = ensureGState(op && op < 1 ? op : null, blendOf(el), ctx);
    parts.push("q");
    if (gs) parts.push("/" + gs + " gs");
    const clipId = parseClipRef(el.attrs["clip-path"]);
    if (clipId) emitClip(clipId, ctx, parts);
    parts.push(fmtNum(w) + " 0 0 " + fmtNum(-h) + " " + fmtNum(x) + " " + fmtNum(y + h) + " cm");
    parts.push("/" + name + " Do");
    parts.push("Q");
  }
  async function renderGroup(el, ctx, parts) {
    const m = parseTransform(el.attrs.transform || "");
    const op = parseFloat(el.attrs.opacity);
    const gs = ensureGState(op && op < 1 ? op : null, blendOf(el), ctx);
    const hasM = m[0] !== 1 || m[1] !== 0 || m[2] !== 0 || m[3] !== 1 || m[4] !== 0 || m[5] !== 0;
    const clipId = parseClipRef(el.attrs["clip-path"]);
    parts.push("q");
    if (hasM) parts.push(m.map(fmtNum).join(" ") + " cm");
    if (clipId) emitClip(clipId, ctx, parts);
    if (gs) parts.push("/" + gs + " gs");
    for (const child of el.children) await renderElement(child, ctx, parts);
    parts.push("Q");
  }
  function renderShape(el, ctx, parts) {
    switch (el.tag) {
      case "rect":
        renderRect(el, ctx, parts);
        break;
      case "path":
        renderPath(el, ctx, parts);
        break;
      case "ellipse":
      case "circle":
        renderEllipse(el, ctx, parts);
        break;
      case "text":
        renderText(el, ctx, parts);
        break;
      default:
        break;
    }
  }
  async function renderElement(el, ctx, parts) {
    if (el.tag === "g") {
      await renderGroup(el, ctx, parts);
      return;
    }
    if (el.tag === "image") {
      await renderImage(el, ctx, parts);
      return;
    }
    const clipId = parseClipRef(el.attrs["clip-path"]);
    if (clipId && ctx.clips && ctx.clips.has(clipId)) {
      const probe = [];
      if (emitClip(clipId, ctx, probe)) {
        parts.push("q", ...probe);
        renderShape(el, ctx, parts);
        parts.push("Q");
        return;
      }
    }
    renderShape(el, ctx, parts);
  }
  function collectGradients(root, ctx) {
    (function walk(el) {
      if (el.tag === "lineargradient" || el.tag === "radialgradient") {
        const id = el.attrs.id;
        if (id && !ctx.gradientDefs.has(id)) {
          const g = parseGradient(el);
          if (g) ctx.gradientDefs.set(id, g);
        }
        return;
      }
      for (const c of el.children) walk(c);
    })(root);
  }
  async function svgToContentStream(svgStr, pageWmm, pageHmm, ctx) {
    ctx = ctx || {};
    ctx.images = ctx.images || /* @__PURE__ */ new Set();
    ctx.alphas = ctx.alphas || /* @__PURE__ */ new Set();
    ctx.clips = ctx.clips || /* @__PURE__ */ new Map();
    ctx.shadings = ctx.shadings || /* @__PURE__ */ new Set();
    ctx.fonts = ctx.fonts || /* @__PURE__ */ new Set();
    ctx.imageReg = ctx.imageReg || /* @__PURE__ */ new Map();
    ctx.alphaReg = ctx.alphaReg || /* @__PURE__ */ new Map();
    ctx.shadingReg = ctx.shadingReg || /* @__PURE__ */ new Map();
    ctx.fontReg = ctx.fontReg || /* @__PURE__ */ new Map();
    ctx.gradientDefs = ctx.gradientDefs || /* @__PURE__ */ new Map();
    ctx.pageW = pageWmm;
    ctx.pageH = pageHmm;
    const root = parseSvgXml(svgStr);
    collectClips(root, ctx);
    collectGradients(root, ctx);
    const parts = [];
    const pageHpt = pageHmm * MM_TO_PT;
    parts.push("q");
    parts.push(fmtNum(MM_TO_PT) + " 0 0 " + fmtNum(-MM_TO_PT) + " 0 " + fmtNum(pageHpt) + " cm");
    for (const child of root.children) await renderElement(child, ctx, parts);
    parts.push("Q");
    return parts.join("\n");
  }

  // ofd2pdf/index.js
  function pageContext(regs) {
    return {
      imageReg: regs.imageReg,
      alphaReg: regs.alphaReg,
      shadingReg: regs.shadingReg,
      fontReg: regs.fontReg
    };
  }
  function pdfRegs() {
    return { imageReg: /* @__PURE__ */ new Map(), alphaReg: /* @__PURE__ */ new Map(), shadingReg: /* @__PURE__ */ new Map(), fontReg: /* @__PURE__ */ new Map() };
  }
  function pageEntry(ctx, dims, content) {
    return {
      w: dims.width,
      h: dims.height,
      content,
      images: Array.from(ctx.images),
      alphas: Array.from(ctx.alphas),
      shadings: Array.from(ctx.shadings),
      fonts: Array.from(ctx.fonts)
    };
  }
  async function ofdToPdf(ofd, opts) {
    const coreFn = getCore();
    if (!coreFn || typeof coreFn.renderPageToString !== "function") {
      throw new Error("ofd2pdf.js 需要先加载 ofd.js");
    }
    opts = opts || {};
    const regs = pdfRegs();
    const pages = [];
    const count = coreFn.getPageCount(ofd);
    for (let i = 0; i < count; i++) {
      const svg = await coreFn.renderPageToString(ofd, i, opts.renderOpts);
      const dims = await coreFn.getPageDimensions(ofd, i);
      const ctx = pageContext(regs);
      const content = await svgToContentStream(svg, dims.width, dims.height, ctx);
      pages.push(pageEntry(ctx, dims, content));
      if (opts.onProgress) opts.onProgress(i + 1, count);
    }
    return assemblePdf(pages, regs, opts);
  }
  async function svgToPdf(svgString, pageWmm, pageHmm, opts) {
    const regs = pdfRegs();
    const ctx = pageContext(regs);
    const content = await svgToContentStream(svgString, pageWmm, pageHmm, ctx);
    const pages = [pageEntry(ctx, { width: pageWmm, height: pageHmm }, content)];
    return assemblePdf(pages, regs, opts);
  }
  var TOPDF = {
    ofdToPdf,
    svgToPdf,
    // 非稳定接口，供调试/扩展使用。
    // parseXml 是 parseSvgXml 的旧名，保留为别名以免打断既有脚本，新代码请用 parseSvgXml。
    _internals: {
      svgToContentStream,
      parseSvgXml,
      pathToPdf,
      parseTransform,
      assemblePdf,
      parseXml: parseSvgXml
    }
  };
  globalThis.TOPDF = TOPDF;
})();

if (typeof module !== "undefined" && module.exports) {
  if (!globalThis.__OFD2PDF_ZLIB__) {
    try { globalThis.__OFD2PDF_ZLIB__ = module.require("zlib"); } catch (e) {}
  }
  if (!globalThis.OFD) {
    try { module.require("./ofd.js"); } catch (e) {}
  }
  if (!globalThis.OFD) {
    try { module.require("../ofd/ofd.js"); } catch (e) {}
  }
  if (!globalThis.OFD) {
    try { module.require("ofd-core"); } catch (e) {}
  }
  module.exports = globalThis.TOPDF;
}
