  // ==================== 图像解码 ====================
  const TIFF_TYPE_SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];
  function parseTiffTags(bytes) {
    const le = bytes[0] === 0x49 && bytes[1] === 0x49;
    const u16 = (o) =>
      le ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1];
    const u32 = (o) =>
      le
        ? bytes[o] |
          (bytes[o + 1] << 8) |
          (bytes[o + 2] << 16) |
          (bytes[o + 3] << 24)
        : (bytes[o] << 24) |
          (bytes[o + 1] << 16) |
          (bytes[o + 2] << 8) |
          bytes[o + 3];
    if (bytes.length < 8 || u16(2) !== 42) return null;
    const ifd = u32(4);
    if (ifd + 2 > bytes.length) return null;
    const cnt = u16(ifd);
    const tags = {};
    for (let i = 0; i < cnt; i++) {
      const eo = ifd + 2 + i * 12;
      if (eo + 12 > bytes.length) break;
      const tag = u16(eo),
        type = u16(eo + 2),
        c = u32(eo + 4);
      const tsz = TIFF_TYPE_SIZE[type] || 1;
      const off = tsz * c <= 4 ? eo + 8 : u32(eo + 8);
      const vals = [];
      if (type === 1 || type === 7) {
        for (let j = 0; j < c && off + j < bytes.length; j++)
          vals.push(bytes[off + j]);
      } else if (type === 3) {
        for (let j = 0; j < c && off + j * 2 + 1 < bytes.length; j++)
          vals.push(u16(off + j * 2));
      } else if (type === 4) {
        for (let j = 0; j < c && off + j * 4 + 3 < bytes.length; j++)
          vals.push(u32(off + j * 4));
      }
      tags[tag] = { vals, count: c };
    }
    return tags;
  }

  function tiffLzwDecode(data) {
    const out = [];
    const dict = new Array(4096);
    let bitPos = 0,
      codeWidth = 9,
      next = 258,
      prev = null;
    for (;;) {
      if (bitPos + codeWidth > data.length * 8) break;
      let code = 0;
      for (let i = 0; i < codeWidth; i++) {
        code =
          (code << 1) |
          ((data[(bitPos + i) >> 3] >> (7 - ((bitPos + i) & 7))) & 1);
      }
      bitPos += codeWidth;
      if (code === 256) {
        next = 258;
        codeWidth = 9;
        prev = null;
        continue;
      }
      if (code === 257) break;
      let entry;
      if (code <= 255) entry = [code];
      else if (code < next) entry = dict[code];
      else if (code === next && prev) entry = prev.concat(prev[0]);
      else break;
      for (let j = 0; j < entry.length; j++) out.push(entry[j]);
      if (prev) {
        dict[next++] = prev.concat(entry[0]);
        if (codeWidth === 9 && next >= 511) codeWidth = 10;
        else if (codeWidth === 10 && next >= 1023) codeWidth = 11;
        else if (codeWidth === 11 && next >= 2047) codeWidth = 12;
      }
      prev = entry;
    }
    return out;
  }
  function tiffToBmpDataUrl(bytes) {
    const tags = parseTiffTags(bytes);
    if (!tags) return null;
    const w = tags[256] ? tags[256].vals[0] : 0;
    const h = tags[257] ? tags[257].vals[0] : 0;
    if (!w || !h) return null;
    const bps = tags[258] ? tags[258].vals : [8];
    if (bps.some((b) => b !== 8)) return null;
    const spp = tags[277] ? tags[277].vals[0] : bps.length;
    const comp = tags[259] ? tags[259].vals[0] : 1;
    if (comp !== 1 && comp !== 5) return null;
    const photo = tags[262] ? tags[262].vals[0] : 1;
    const planar = tags[284] ? tags[284].vals[0] : 1;
    if (planar !== 1) return null;
    const rowsPerStrip = tags[278] ? tags[278].vals[0] : h;
    const offsets = tags[273] ? tags[273].vals : [];
    const counts = tags[279] ? tags[279].vals : [];
    if (!offsets.length || !counts.length) return null;
    const predictor = tags[317] ? tags[317].vals[0] : 1;
    const cmap =
      photo === 3 && tags[320] && tags[320].vals.length >= 768
        ? tags[320].vals
        : null;
    const rgb = new Uint8Array(w * h * 3);
    const rowBytes = w * spp;
    for (let s = 0; s < offsets.length; s++) {
      if (offsets[s] + counts[s] > bytes.length) continue;
      const raw = bytes.subarray(offsets[s], offsets[s] + counts[s]);
      const px =
        comp === 5 ? tiffLzwDecode(raw) : Array.prototype.slice.call(raw);
      if (predictor === 2) {
        const rowsThis0 = Math.min(rowsPerStrip, h - s * rowsPerStrip);
        for (let r = 0; r < rowsThis0; r++) {
          const base = r * rowBytes;
          for (let x = 1; x < w; x++) {
            const cur = base + x * spp,
              prv = base + (x - 1) * spp;
            for (let c = 0; c < spp; c++)
              px[cur + c] = (px[cur + c] + px[prv + c]) & 0xff;
          }
        }
      }
      const rowsThis = Math.min(rowsPerStrip, h - s * rowsPerStrip);
      for (let r = 0; r < rowsThis; r++) {
        const y = s * rowsPerStrip + r;
        const srcOff = r * rowBytes,
          dstOff = y * w * 3;
        for (let x = 0; x < w; x++) {
          const p = srcOff + x * spp,
            d = dstOff + x * 3;
          let cr, cg, cb;
          if (photo === 2) {
            cr = px[p];
            cg = px[p + 1];
            cb = px[p + 2];
          } else if (cmap) {
            const idx = px[p];
            cr = cmap[idx];
            cg = cmap[256 + idx];
            cb = cmap[512 + idx];
          } else {
            const g = px[p];
            cr = cg = cb = g;
          }
          if (spp >= 4 && px[p + 3] < 255) {
            const a = px[p + 3] / 255;
            cr = cr * a + 255 * (1 - a);
            cg = cg * a + 255 * (1 - a);
            cb = cb * a + 255 * (1 - a);
          }
          rgb[d] = cr;
          rgb[d + 1] = cg;
          rgb[d + 2] = cb;
        }
      }
    }
    const rowSize = Math.floor((w * 24 + 31) / 32) * 4;
    const dataSize = rowSize * h;
    const buf = new Uint8Array(54 + dataSize);
    buf[0] = 0x42;
    buf[1] = 0x4d;
    const dv = new DataView(buf.buffer);
    dv.setUint32(2, buf.length, true);
    dv.setUint32(10, 54, true);
    dv.setUint32(14, 40, true);
    dv.setInt32(18, w, true);
    dv.setInt32(22, h, true);
    dv.setUint16(26, 1, true);
    dv.setUint16(28, 24, true);
    dv.setUint32(34, dataSize, true);
    let o = 54;
    for (let y = h - 1; y >= 0; y--) {
      const srcOff = y * w * 3;
      for (let x = 0; x < w; x++) {
        buf[o++] = rgb[srcOff + x * 3 + 2];
        buf[o++] = rgb[srcOff + x * 3 + 1];
        buf[o++] = rgb[srcOff + x * 3];
      }
      o += rowSize - w * 3;
    }
    return "data:image/bmp;base64," + bytesToBase64(buf);
  }

  async function ensureImageDataUrl(mm) {
    if (!mm || !mm.mediaFile || mm.dataUrl) return mm && mm.dataUrl;
    const zip = mm._zip;
    if (!zip) return null;
    try {
      const imgPath = resolvePath(mm.baseDir + "/_.x", mm.mediaFile);
      const bytes = await readEntry(zip, imgPath);
      if (bytes) {
        const ext = (mm.mediaFile.match(/\.[^./]+$/) || [""])[0].slice(1);
        const fmt = (mm.format || ext || "").toUpperCase();
        if (fmt === "TIF" || fmt === "TIFF") {
          mm.dataUrl = tiffToBmpDataUrl(bytes);
        } else {
          const mime =
            fmt === "JPEG" || fmt === "JPG"
              ? "image/jpeg"
              : fmt === "BMP"
                ? "image/bmp"
                : fmt === "GIF"
                  ? "image/gif"
                  : "image/png";
          mm.dataUrl = "data:" + mime + ";base64," + bytesToBase64(bytes);
        }
      }
    } catch (e) {
      console.warn("[OFD] 图像资源 " + (mm.mediaFile || "") + " 解码失败", e);
    }
    return mm.dataUrl;
  }

