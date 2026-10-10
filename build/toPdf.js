/* =====================================================================
 * toPdf.js — OFD → PDF 前端转换模块（演示级）
 * 能力：逐页调用 ofd.js 的 renderPageToString 得到 SVG（mm 坐标），
 *       再映射为 PDF 页面内容流，最终组装出完整的 PDF 字节。
 *       - 矢量路径：M/L/C/Q/A/Z 直转 PDF（Q 二次贝塞尔转三次、A 弧拆分为三次贝塞尔）
 *       - 文本：Type0 字体（/STSong-Light + /UniGB-UCS2-H，依赖阅读器内置中文字体，
 *               无需嵌入字体文件；楷体/黑体等字体会以宋体呈现）
 *       - 图像：JPEG 直嵌（DCTDecode）；PNG/BMP（含二值 BMP、RLE8/RLE4）/GIF（含透明与隔行）
 *               浏览器用 canvas 解码、Node 用纯 JS 解码，转 RGBA 后 Flate 压缩，透明通道保留（生成 SMask）
 * 依赖：ofd.js（全局 OFD），仅使用其公开 API，不改动核心。
 *
 * 用法示例：
 *   浏览器（先加载 ofd.js 再加载本模块）：
 *     const file = document.getElementById('file').files[0];
 *     const ofd  = await OFD.load(await file.arrayBuffer());
 *     const pdf  = await TOPDF.ofdToPdf(ofd, { title: '发票.pdf' });
 *     const blob = new Blob([pdf], { type: 'application/pdf' });
 *     location.href = URL.createObjectURL(blob); // 或 a[download] 触发下载
 *
 *   Node（CommonJS）：
 *     const OFD   = require('./build/ofd.js');
 *     const TOPDF = require('./build/toPdf.js');
 *     const data  = new Uint8Array(fs.readFileSync('a.ofd'));
 *     const ofd   = await OFD.load(data);
 *     const pdf   = await TOPDF.ofdToPdf(ofd, { title: 'a.ofd' });
 *     fs.writeFileSync('a.pdf', Buffer.from(pdf));
 * ===================================================================== */
(function (global) {
  'use strict';

  // 1mm = 72/25.4 pt
  const MM_TO_PT = 72 / 25.4;

  // 单张图像解码的像素上限（1 亿像素 ≈ 400MB RGBA）。
  // 图像头里的 w/h 由文件自行声明、可被伪造，若不限上限，极小的文件就能触发巨额内存分配（OOM）。
  const MAX_IMAGE_PIXELS = 100 * 1000 * 1000;
  function checkImageSize(w, h) {
    if (!(w > 0) || !(h > 0)) throw new Error('无效图像尺寸：' + w + '×' + h);
    if (w * h > MAX_IMAGE_PIXELS) {
      throw new Error('图像尺寸过大（' + w + '×' + h + '），已跳过解码以防内存耗尽');
    }
  }

  // 延迟解析 ofd.js 依赖：浏览器取 window.OFD，Node 下按 CommonJS 就近加载
  let core = null;
  function getCore() {
    if (core) return core;
    if (global && global.OFD) core = global.OFD;
    else if (typeof module !== 'undefined' && module.require) {
      try { core = module.require('./ofd.js'); } catch (e) { core = null; }
    }
    return core;
  }

  /* ------------------------- 基础工具 ------------------------- */
  // 数字格式化：保留最多 4 位小数，去掉多余的 0
  function fmtNum(v) {
    if (typeof v !== 'number' || !isFinite(v)) return '0';
    const r = Math.round(v * 10000) / 10000;
    return String(r);
  }
  function numList(str) {
    if (!str) return [];
    return String(str).trim().split(/[\s,]+/).filter(Boolean).map(parseFloat);
  }
  // 以下两个工具在 ofd.js 中有权威实现。这里优先复用 ofd.js 的（更强：
  // decodeEntities 额外支持 &#xNN; 字符引用，base64ToBytes 已在核心统一健壮化），
  // 未加载 ofd.js 时回退本地实现，保证 toPdf.js 仍可独立运行。
  function unescapeXml(s) {
    const fn = getCore() && getCore()._internals && getCore()._internals.decodeEntities;
    if (fn) return fn(s);
    return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }
  function base64ToBytes(b64) {
    const fn = getCore() && getCore()._internals && getCore()._internals.base64ToBytes;
    if (fn) return fn(b64);
    // 本地回退：规范化去空白/NULL、URL-safe 字符转标准、按需补齐 '=' 填充
    let s = String(b64).replace(/[\s\x00]/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = s.length % 4;
    if (pad === 2) s += '==';
    else if (pad === 3) s += '=';
    else if (pad === 1) throw new Error('base64 长度非法');
    let bin;
    if (typeof atob === 'function') {
      bin = atob(s);
    } else {
      // 兜底实现（无 atob 的环境），'=' 视为组内结束
      const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      const eq = '='.charCodeAt(0);
      bin = '';
      for (let i = 0; i < s.length; i += 4) {
        const c = [s[i], s[i + 1], s[i + 2], s[i + 3]]
          .map(ch => (ch === '=' ? eq : table.indexOf(ch)));
        const n = (c[0] << 18) | (c[1] << 12) | (c[2] << 6) | c[3];
        bin += String.fromCharCode((n >> 16) & 255, (n >> 8) & 255, n & 255);
      }
      const eqs = /\=*$/.exec(s)[0].length;
      if (eqs) bin = bin.slice(0, 3 - eqs);
    }
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function nodeZlib() {
    try {
      if (typeof require === 'function' && typeof module !== 'undefined' && module.require) {
        return module.require('zlib');
      }
    } catch (e) { /* Node 以外环境忽略 */ }
    return null;
  }
  // deflate（Flate 压缩）：浏览器用 CompressionStream，Node 用 zlib
  async function deflate(bytes, zlib) {
    if (typeof CompressionStream !== 'undefined') {
      const cs = new CompressionStream('deflate');
      const writer = cs.writable.getWriter();
      // 注意：不能先 await write 再读——大数据块会触发背压死锁
      // （writable 端等待 readable 端消费，readable 端等待 write 完成）。
      // 正确顺序：排队 write/close → 立即消费 readable → 最后再 await 写端。
      const writeP = writer.write(bytes);
      const closeP = writer.close();
      const chunks = [];
      let total = 0;
      const reader = cs.readable.getReader();
      try {
        for (;;) {
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
      for (const c of chunks) { out.set(c, off); off += c.length; }
      return out;
    }
    if (zlib) return new Uint8Array(zlib.deflateSync(Buffer.from(bytes)));
    throw new Error('当前环境不支持 deflate 压缩');
  }

  /* ------------------------- 颜色 ------------------------- */
  // 解析 CSS 颜色 → { r, g, b, a? }；'none'/未知返回 null
  // 注意：与 ofd.js 的 parseColor(el) 不是同一个东西——那边读 OFD 元素的 Value/Alpha
  // 属性，这边解析 CSS/SVG 颜色字符串。名字必须区分开，否则极易误调。
  function parseCssColor(str) {
    str = String(str || '').trim();
    if (!str || str === 'none') return null;
    let m;
    if ((m = /^#([0-9a-f]{3})$/i.exec(str))) {
      return {
        r: parseInt(m[1][0] + m[1][0], 16),
        g: parseInt(m[1][1] + m[1][1], 16),
        b: parseInt(m[1][2] + m[1][2], 16)
      };
    }
    if ((m = /^#([0-9a-f]{6})$/i.exec(str))) {
      return {
        r: parseInt(m[1].substr(0, 2), 16),
        g: parseInt(m[1].substr(2, 2), 16),
        b: parseInt(m[1].substr(4, 2), 16)
      };
    }
    if ((m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(str))) {
      return { r: +m[1], g: +m[2], b: +m[3] };
    }
    if ((m = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i.exec(str))) {
      return { r: +m[1], g: +m[2], b: +m[3], a: parseFloat(m[4]) };
    }
    if (str === 'black') return { r: 0, g: 0, b: 0 };
    if (str === 'white') return { r: 255, g: 255, b: 255 };
    if (str === 'red') return { r: 255, g: 0, b: 0 };
    return null;
  }

  /* ------------------------- 轻量 SVG XML 解析 ------------------------- */
  // 只解析 SVG 所需的结构（元素/属性/文本），返回裸节点 { tag, attrs, children, text }。
  // 与 ofd.js 的 parseXml(str) 刻意区分：那边返回 { documentElement }、用显式栈并严格
  // 校验标签匹配，用于解析不可信的 OFD 输入；这边面向 ofd.js 自己产出的 SVG（可信、
  // 结构已知），保持宽松省事。返回结构不同，绝不能互换调用。
  function parseSvgXml(str) {
    let pos = 0;
    const len = str.length;
    function skipWs() { while (pos < len && /\s/.test(str[pos])) pos++; }
    function parseEl() {
      if (str.substr(pos, 4) === '<!--') {
        const end = str.indexOf('-->', pos + 4);
        pos = end < 0 ? len : end + 3;
        return null;
      }
      pos++; // 跳过 '<'
      skipWs();
      let tag = '';
      while (pos < len && !/[\s/>]/.test(str[pos])) tag += str[pos++];
      const el = { tag: tag.toLowerCase(), attrs: {}, children: [], text: '' };
      skipWs();
      // 属性
      for (;;) {
        if (pos >= len) break;
        const ch = str[pos];
        if (ch === '/') {
          pos++; skipWs();
          if (str[pos] === '>') { pos++; return el; }
        }
        if (ch === '>') { pos++; break; }
        let name = '';
        while (pos < len && !/[\s=/>]/.test(str[pos])) name += str[pos++];
        skipWs();
        let value = '';
        if (str[pos] === '=') {
          pos++; skipWs();
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
      // 子元素 / 文本
      let text = '';
      for (;;) {
        if (pos >= len) break;
        if (str[pos] === '<') {
          if (str.substr(pos, 2) === '</') {
            const end = str.indexOf('>', pos);
            pos = end < 0 ? len : end + 1;
            break;
          }
          const child = parseEl();
          if (child) el.children.push(child);
        } else {
          text += str[pos++];
        }
      }
      if (text) el.text = unescapeXml(text).trim();
      return el;
    }
    return parseEl();
  }

  // 解析 SVG transform 属性 → 合并矩阵 [a,b,c,d,e,f]
  // SVG 变换按书写顺序作用（左侧先作用于坐标），即最终矩阵 = 各变换的矩阵乘积
  function parseTransform(str) {
    let m = [1, 0, 0, 1, 0, 0];
    const re = /(translate|matrix|scale|rotate)\(([^)]*)\)/g;
    let mm;
    while ((mm = re.exec(str || ''))) {
      const args = mm[2].trim().split(/[\s,]+/).map(Number);
      let t;
      if (mm[1] === 'translate') {
        t = [1, 0, 0, 1, args[0] || 0, args[1] || 0];
      } else if (mm[1] === 'matrix') {
        t = args;
      } else if (mm[1] === 'scale') {
        const sx = args[0] || 1;
        t = [sx, 0, 0, args[1] != null ? args[1] : sx, 0, 0];
      } else { // rotate
        const ang = (args[0] || 0) * Math.PI / 180;
        const c = Math.cos(ang), s = Math.sin(ang);
        const cx = args[1] || 0, cy = args[2] || 0;
        t = [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
      }
      // 新变换 t 叠加在已有 m 之后：m = m · t（SVG transform 列表按书写顺序，
      // 先出现的变换作用于更外层，矩阵乘法左乘）
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
  // 解析 tspan 的 rotate(ang cx cy)
  function parseRotate(str) {
    const m = /rotate\(\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)\s*\)/.exec(str || '');
    if (!m) return null;
    return { ang: parseFloat(m[1]) * Math.PI / 180, cx: parseFloat(m[2]), cy: parseFloat(m[3]) };
  }
  function parseClipRef(str) {
    const m = /url\(\s*#([^)\s]+)\s*\)/.exec(str || '');
    return m ? m[1] : null;
  }

  /* ------------------------- SVG 路径 → PDF ------------------------- */
  // SVG 弧（端点参数化）→ 若干三次贝塞尔段
  function arcToCubics(x0, y0, rx, ry, rotDeg, laf, sf, x1, y1) {
    const segs = [];
    if (x0 === x1 && y0 === y1) return segs;
    rx = Math.abs(rx); ry = Math.abs(ry);
    if (rx === 0 || ry === 0) { segs.push({ c1: [x1, y1], c2: [x1, y1], p: [x1, y1] }); return segs; }
    const phi = rotDeg * Math.PI / 180;
    const cosP = Math.cos(phi), sinP = Math.sin(phi);
    const dx = (x0 - x1) / 2, dy = (y0 - y1) / 2;
    const x1p = cosP * dx + sinP * dy;
    const y1p = -sinP * dx + cosP * dy;
    let rx2 = rx * rx, ry2 = ry * ry;
    const lam = x1p * x1p / rx2 + y1p * y1p / ry2;
    if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); rx2 = rx * rx; ry2 = ry * ry; }
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
    const pt = t => [
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
  // 椭圆 → 4 段三次贝塞尔（k = 4/3·(tan(π/8))）
  // 顺时针：右顶点 → 底部 → 左顶点 → 顶部 → 回到起点
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
  // SVG path d（M/L/C/Q/A/Z，支持命令简写续接）→ PDF 路径指令
  // tm：可选 2D 变换矩阵 [a,b,c,d,e,f]，对每个坐标点应用（SVG transform 语义：
  // x' = a·x + c·y + e, y' = b·x + d·y + f）。弧段只变换终点，rx/ry/旋转角不变（纯平移场景足够）
  function pathToPdf(d, tm) {
    const re = /[MLCQAZ]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
    const toks = String(d).match(re) || [];
    const out = [];
    let i = 0;
    let curX = 0, curY = 0, subX = 0, subY = 0;
    let prevCmd = '';
    const read = () => parseFloat(toks[i++]);
    const isLetter = t => /^[MLCQAZ]$/.test(t);
    const xf = (x, y) => tm
      ? [tm[0] * x + tm[2] * y + tm[4], tm[1] * x + tm[3] * y + tm[5]]
      : [x, y];
    while (i < toks.length) {
      let cmd = toks[i];
      if (isLetter(cmd)) { i++; prevCmd = cmd; }
      else { cmd = prevCmd === 'M' ? 'L' : (prevCmd || 'L'); }
      if (cmd === 'Z') {
        out.push('h');
        curX = subX; curY = subY;
        continue;
      }
      const arity = cmd === 'C' ? 6 : cmd === 'Q' ? 4 : cmd === 'A' ? 7 : 2;
      do {
        if (i >= toks.length || isLetter(toks[i])) break;
        const p = [];
        for (let k = 0; k < arity; k++) p.push(read());
        // 参数不足（非法/截断路径）：丢弃整条命令，避免 NaN 污染后续坐标
        if (p.some(v => !isFinite(v))) break;
        if (cmd === 'M') {
          const q = xf(p[0], p[1]);
          curX = q[0]; curY = q[1];
          out.push(fmtNum(curX) + ' ' + fmtNum(curY) + ' m');
          subX = curX; subY = curY;
          prevCmd = 'L'; // M 之后的隐式续接为直线
        } else if (cmd === 'L') {
          const q = xf(p[0], p[1]);
          curX = q[0]; curY = q[1];
          out.push(fmtNum(curX) + ' ' + fmtNum(curY) + ' l');
        } else if (cmd === 'C') {
          const q1 = xf(p[0], p[1]), q2 = xf(p[2], p[3]), q3 = xf(p[4], p[5]);
          curX = q3[0]; curY = q3[1];
          out.push(fmtNum(q1[0]) + ' ' + fmtNum(q1[1]) + ' ' + fmtNum(q2[0]) + ' ' + fmtNum(q2[1]) +
            ' ' + fmtNum(curX) + ' ' + fmtNum(curY) + ' c');
        } else if (cmd === 'Q') {
          // 二次贝塞尔 → 三次贝塞尔
          const q1 = xf(p[0], p[1]), q2 = xf(p[2], p[3]);
          const c1x = curX + (q1[0] - curX) * 2 / 3;
          const c1y = curY + (q1[1] - curY) * 2 / 3;
          const c2x = q2[0] + (q1[0] - q2[0]) * 2 / 3;
          const c2y = q2[1] + (q1[1] - q2[1]) * 2 / 3;
          curX = q2[0]; curY = q2[1];
          out.push(fmtNum(c1x) + ' ' + fmtNum(c1y) + ' ' + fmtNum(c2x) + ' ' + fmtNum(c2y) +
            ' ' + fmtNum(curX) + ' ' + fmtNum(curY) + ' c');
        } else { // A：拆分为三次贝塞尔
          const q = xf(p[5], p[6]);
          const segs = arcToCubics(curX, curY, p[0], p[1], p[2], p[3], p[4], q[0], q[1]);
          for (const s of segs) {
            out.push(fmtNum(s.c1[0]) + ' ' + fmtNum(s.c1[1]) + ' ' + fmtNum(s.c2[0]) + ' ' + fmtNum(s.c2[1]) +
              ' ' + fmtNum(s.p[0]) + ' ' + fmtNum(s.p[1]) + ' c');
          }
          curX = q[0]; curY = q[1];
        }
      } while (i < toks.length && !isLetter(toks[i]));
    }
    return out.join(' ');
  }

  /* ------------------------- 文本编码 ------------------------- */
  // 单个码点 → UTF-16BE 十六进制（UniGB-UCS2-H 的 Tj 字符串）
  function utf16beHex(ch) {
    let code = ch.codePointAt(0);
    if (code > 0xFFFF) {
      code -= 0x10000;
      const hi = 0xD800 + (code >> 10);
      const lo = 0xDC00 + (code & 0x3FF);
      return hi.toString(16).padStart(4, '0') + lo.toString(16).padStart(4, '0');
    }
    return code.toString(16).padStart(4, '0');
  }

  /* ------------------------- 图像 ------------------------- */
  // 解析 JPEG 尺寸（扫描 SOF 标记）
  function parseJpegDims(bytes) {
    let pos = 2;
    while (pos + 9 < bytes.length) {
      if (bytes[pos] !== 0xFF) { pos++; continue; }
      const marker = bytes[pos + 1];
      pos += 2;
      if (marker === 0xDA) break;
      if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) continue;
      const segLen = (bytes[pos] << 8) | bytes[pos + 1];
      // 段长非法（0/越界）：文件损坏，终止扫描避免死循环
      if (segLen < 2 || pos + segLen > bytes.length) break;
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        return {
          h: (bytes[pos + 3] << 8) | bytes[pos + 4],
          w: (bytes[pos + 5] << 8) | bytes[pos + 6]
        };
      }
      pos += segLen;
    }
    throw new Error('无法解析 JPEG 尺寸');
  }
  // 浏览器：GIF/BMP/PNG → canvas 提取 RGBA（透明通道保留；GIF 取首帧）
  function canvasImageToRgba(bytes, mime) {
    return new Promise((resolve, reject) => {
      let url;
      try {
        const blob = new Blob([bytes], { type: mime });
        url = URL.createObjectURL(blob);
      } catch (e) { reject(e); return; }
      const img = new Image();
      img.onload = () => {
        try {
          if (!img.width || !img.height) throw new Error('图像尺寸为 0');
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const g = canvas.getContext('2d', { willReadFrequently: true });
          if (!g) throw new Error('无法获取 canvas 2d 上下文');
          g.drawImage(img, 0, 0);
          const data = g.getImageData(0, 0, img.width, img.height).data;
          resolve({ w: img.width, h: img.height, rgba: data });
        } catch (e) { reject(e); }
        finally { URL.revokeObjectURL(url); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(mime + ' 图像加载失败')); };
      img.src = url;
    });
  }
  // Node：PNG 解码为 RGB（支持 8/16 位、灰/真彩/调色板/RGBA），返回 { rgb, w, h }
  function decodePng(bytes, zlib) {
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) throw new Error('非 PNG 图像');
    const readU32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
    let pos = 8, w = 0, h = 0, bitDepth = 8, colorType = 2, interlace = 0;
    let palette = null, trns = null;
    const idat = [];
    while (pos + 8 <= bytes.length) {
      const len = readU32(bytes, pos);
      const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
      const data = bytes.subarray(pos + 8, pos + 8 + len);
      pos += 12 + len;
      if (type === 'IHDR') {
        w = readU32(data, 0); h = readU32(data, 4);
        bitDepth = data[8]; colorType = data[9]; interlace = data[12];
      } else if (type === 'PLTE') {
        palette = data;
      } else if (type === 'tRNS') {
        trns = data;
      } else if (type === 'IDAT') {
        idat.push(data);
      } else if (type === 'IEND') {
        break;
      }
    }
    if (interlace !== 0) throw new Error('PNG 隔行扫描不支持');
    if (bitDepth !== 8 && bitDepth !== 16) throw new Error('PNG 位深 ' + bitDepth + ' 不支持');
    if ([0, 2, 3, 4, 6].indexOf(colorType) < 0) throw new Error('PNG 颜色类型 ' + colorType + ' 不支持');
    checkImageSize(w, h);
    let all = new Uint8Array(idat.reduce((s, d) => s + d.length, 0));
    let off = 0;
    for (const d of idat) { all.set(d, off); off += d.length; }
    all = new Uint8Array(zlib.inflateSync(Buffer.from(all)));
    const ch = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : 4;
    const depthBytes = bitDepth === 16 ? 2 : 1;
    const bpp = ch * depthBytes;
    const rowBytes = w * ch * depthBytes;
    const recon = new Uint8Array(h * rowBytes);
    let prev = new Uint8Array(rowBytes);
    let src = 0;
    for (let y = 0; y < h; y++) {
      const f = all[src++];
      const row = recon.subarray(y * rowBytes, (y + 1) * rowBytes);
      for (let x = 0; x < rowBytes; x++) {
        const left = x >= bpp ? row[x - bpp] : 0;
        const up = prev[x];
        const ul = x >= bpp ? prev[x - bpp] : 0;
        let v = all[src++];
        if (f === 1) v += left;
        else if (f === 2) v += up;
        else if (f === 3) v += (left + up) >> 1;
        else if (f === 4) {
          const p = left + up - ul;
          const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - ul);
          v += (pa <= pb && pa <= pc) ? left : (pb <= pc ? up : ul);
        }
        row[x] = v & 0xff;
      }
      prev = row;
    }
    // 展平为 RGBA（4 字节/像素），无透明像素时 hasAlpha=false（无需 SMask）
    const rgba = new Uint8Array(w * h * 4);
    let hasAlpha = false;
    // tRNS 透明色：灰/真彩单值匹配（8 位样本 = 16 位值/257；16 位样本取高字节）
    const u16 = o => (trns[o] << 8) | trns[o + 1];
    const grayKey = trns ? (bitDepth === 16 ? u16(0) >> 8 : Math.round(u16(0) / 257)) : -1;
    const rgbKey = trns && colorType === 2 ? [u16(0), u16(2), u16(4)].map(v => bitDepth === 16 ? v >> 8 : Math.round(v / 257)) : null;
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
          if (trns) a = trns[idx] !== undefined ? trns[idx] : 255;
        } else if (colorType === 0) {
          r = g = b = recon[base];
          if (trns && recon[base] === grayKey) a = 0;
        } else if (colorType === 2) {
          r = recon[base]; g = recon[base + depthBytes]; b = recon[base + 2 * depthBytes];
          if (rgbKey && r === rgbKey[0] && g === rgbKey[1] && b === rgbKey[2]) a = 0;
        } else if (colorType === 4) {
          r = g = b = recon[base];
          a = recon[base + depthBytes];
        } else {
          r = recon[base]; g = recon[base + depthBytes]; b = recon[base + 2 * depthBytes];
          a = recon[base + 3 * depthBytes];
        }
        rgba[o++] = r; rgba[o++] = g; rgba[o++] = b; rgba[o++] = a;
        if (a < 255) hasAlpha = true;
      }
    }
    return { rgba, w, h, hasAlpha };
  }
  // BMP（含二值 BMP）→ RGBA。支持 1/4/8/24/32 位、BI_RGB 与 RLE8/RLE4 压缩
  function decodeBmp(bytes) {
    if (bytes.length < 26 || bytes[0] !== 0x42 || bytes[1] !== 0x4D) throw new Error('无效 BMP 头');
    const hdrSize = (bytes[14] | (bytes[15] << 8) | (bytes[16] << 16) | (bytes[17] << 24)) >>> 0;
    let w, h, bpp, comp = 0, palSize = 0, palOff;
    if (hdrSize === 12) { // BITMAPCOREHEADER（OS/2 1.x）
      w = bytes[18] | (bytes[19] << 8);
      h = bytes[20] | (bytes[21] << 8);
      bpp = bytes[24] | (bytes[25] << 8);
      palOff = 26;
    } else {
      w = (bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24)) | 0;
      h = (bytes[22] | (bytes[23] << 8) | (bytes[24] << 16) | (bytes[25] << 24)) | 0;
      bpp = bytes[28] | (bytes[29] << 8);
      comp = (bytes[30] | (bytes[31] << 8) | (bytes[32] << 16) | (bytes[33] << 24)) >>> 0;
      palSize = (bytes[46] | (bytes[47] << 8) | (bytes[48] << 16) | (bytes[49] << 24)) >>> 0;
      palOff = 14 + hdrSize;
    }
    if (!w || !h || w > 65536 || h > 65536) throw new Error('无效 BMP 尺寸');
    const topDown = h < 0;
    h = Math.abs(h);
    if (comp > 3) throw new Error('BMP 压缩 ' + comp + ' 不支持');
    checkImageSize(w, h);
    const palette = [];
    if (bpp <= 8) {
      const n = Math.min(palSize || (1 << bpp), (bytes.length - palOff) >> 2);
      for (let i = 0; i < n; i++) {
        palette.push([bytes[palOff + 4 * i + 2], bytes[palOff + 4 * i + 1], bytes[palOff + 4 * i], 255]);
      }
      while (palette.length < (1 << bpp)) palette.push([0, 0, 0, 255]);
    }
    const rgba = new Uint8Array(w * h * 4);
    let hasAlpha = false;
    if ((comp === 1 || comp === 2) && (bpp === 8 || bpp === 4)) {
      // RLE8 / RLE4：先解出每像素索引，再映射调色板
      const idx = new Uint8Array(w * h);
      let pos = (bytes[10] | (bytes[11] << 8) | (bytes[12] << 16) | (bytes[13] << 24)) >>> 0;
      let x = 0, y = 0;
      const put = (v) => { if (x < w && y < h) idx[y * w + x] = v; x++; };
      const nibble = comp === 2;
      while (y < h && pos + 1 < bytes.length) {
        const a = bytes[pos], b = bytes[pos + 1];
        pos += 2;
        if (a === 0) {
          if (b === 0) { x = 0; y++; }
          else if (b === 1) break;
          else if (b === 2) {
            x += bytes[pos]; y += bytes[pos + 1];
            if (x > w) x = w;
            if (y > h) y = h;
            pos += 2;
          } else { // 绝对模式
            let len = b;
            if (nibble) {
              for (let i = 0; i < len; i++) {
                const v = i % 2 === 0 ? bytes[pos] >> 4 : bytes[pos] & 0x0F;
                if (i % 2 === 1) pos++;
                put(v);
              }
              pos += (len + 1) >> 1; // 半字节绝对块按字节对齐
            } else {
              for (let i = 0; i < len; i++) put(bytes[pos + i]);
              pos += len + (len & 1);
            }
          }
        } else {
          const v = bytes[pos];
          pos++;
          if (nibble) { const hi = v >> 4, lo = v & 0x0F; for (let i = 0; i < a; i++) put(hi); for (let i = 0; i < a; i++) put(lo); }
          else { for (let i = 0; i < a; i++) put(v); }
        }
      }
      const row = (yy) => topDown ? yy : h - 1 - yy;
      for (let yy = 0; yy < h; yy++) {
        for (let xx = 0; xx < w; xx++) {
          const c = palette[idx[yy * w + xx]];
          const o = (row(yy) * w + xx) * 4;
          rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = c[3];
        }
      }
      return { rgba, w, h, hasAlpha };
    }
    // BI_RGB：逐行解码（每行 4 字节对齐）
    const rowBytes = Math.ceil((w * bpp) / 32) * 4;
    let pos = (bytes[10] | (bytes[11] << 8) | (bytes[12] << 16) | (bytes[13] << 24)) >>> 0;
    if (pos + rowBytes * h > bytes.length) throw new Error('BMP 数据不完整');
    const pick = (x, y, ch) => {
      const yy = topDown ? y : h - 1 - y;
      const base = pos + yy * rowBytes + (x * bpp >> 3);
      const bit = bpp === 1 ? 7 - (x & 7) : bpp === 4 ? (x & 1 ? 0 : 4) : 0;
      return bpp <= 8 ? (bytes[base] >> bit) & ((1 << Math.min(bpp, 8)) - 1) : bytes[base + ch];
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        if (bpp >= 24) { // BGR(A) 存储
          rgba[o] = pick(x, y, 2); rgba[o + 1] = pick(x, y, 1); rgba[o + 2] = pick(x, y, 0);
          rgba[o + 3] = bpp === 32 ? pick(x, y, 3) : 255;
          if (rgba[o + 3] < 255) hasAlpha = true;
        } else {
          const c = palette[pick(x, y, 0)];
          rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = c[3];
        }
      }
    }
    return { rgba, w, h, hasAlpha };
  }
  // GIF（87a/89a）→ RGBA。支持全局/局部色表、GCE 透明、LZW、隔行；多帧时取第一帧
  function decodeGif(bytes) {
    if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46) throw new Error('无效 GIF 头');
    const w = bytes[6] | (bytes[7] << 8);
    const h = bytes[8] | (bytes[9] << 8);
    if (!w || !h || w > 65536 || h > 65536) throw new Error('无效 GIF 尺寸');
    const packed = bytes[10];
    let pos = 13;
    const globalPal = [];
    if (packed & 0x80) {
      const n = 2 << (packed & 7);
      for (let i = 0; i < n; i++) {
        globalPal.push([bytes[pos], bytes[pos + 1], bytes[pos + 2]]);
        pos += 3;
      }
    }
    let transparent = -1;
    // 数据是一串"长度+内容"的小块，读到 0 收尾
    const chunks = () => {
      const out = [];
      for (;;) {
        const n = bytes[pos++];
        if (n === 0) break;
        out.push(bytes.subarray(pos, pos + n));
        pos += n;
      }
      return out;
    };
    while (pos + 1 < bytes.length) {
      const tag = bytes[pos++];
      if (tag === 0x3B) break; // 结束符
      if (tag === 0x21) { // 扩展
        const label = bytes[pos++];
        if (label === 0xF9) { // 图形控制扩展：块大小 | flags | 延迟(2) | 透明索引 | 终止符
          pos++; // 块大小（固定 4）
          const flags = bytes[pos++];
          pos += 2; // 延迟时间 2 字节
          if (flags & 1) transparent = bytes[pos];
          pos += 2; // 透明索引 1 字节 + 终止符 1 字节
        } else {
          chunks(); // 注释/文本/应用扩展：跳过
        }
      } else if (tag === 0x2C) { // 图像描述符（主循环已消费 0x2C，此处直接读 left/top/w/h/packed 共 9 字节）
        const left = bytes[pos] | (bytes[pos + 1] << 8);
        const top = bytes[pos + 2] | (bytes[pos + 3] << 8);
        const imgW = bytes[pos + 4] | (bytes[pos + 5] << 8);
        const imgH = bytes[pos + 6] | (bytes[pos + 7] << 8);
        const ipacked = bytes[pos + 8];
        pos += 9;
        let pal = globalPal;
        if (ipacked & 0x80) { // 帧自带局部色表
          const n = 2 << (ipacked & 7);
          pal = [];
          for (let i = 0; i < n; i++) {
            pal.push([bytes[pos], bytes[pos + 1], bytes[pos + 2]]);
            pos += 3;
          }
        }
        const pix = gifLzwDecode(bytes[pos++], chunks(), imgW * imgH);
        // 隔行：像素按 4 个通道跳行存（行距 8/8/4/2），先算出行序再统一填充
        let rows = null;
        if (ipacked & 0x40) {
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
            rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = a;
            if (a < 255) hasAlpha = true;
            di++;
          }
        };
        if (rows) for (const yy of rows) fillRow(yy);
        else for (let yy = 0; yy < imgH; yy++) fillRow(yy);
        return { rgba, w, h, hasAlpha };
      }
    }
    throw new Error('GIF 无图像数据');
  }
  // GIF LZW 解压：LSB 优先、码宽随字典增长（minBits+1 ~ 12）
  function gifLzwDecode(minBits, chunks, need) {
    if (!(need > 0) || need > MAX_IMAGE_PIXELS * 4) throw new Error('LZW 输出尺寸异常：' + need);
    const clear = 1 << minBits;
    const end = clear + 1;
    let codeSize = minBits + 1;
    // 字典：code → [prefixCode, byte]（0..clear-1 为单字节根项；prefix 用 -1 表示根）
    const dict = new Int32Array(4096 * 2);
    for (let i = 0; i < clear; i++) { dict[i * 2] = -1; dict[i * 2 + 1] = i; }
    let next = clear + 2;
    const out = new Uint8Array(need);
    let oi = 0;
    let bitBuf = 0, bitCnt = 0, bi = 0;
    let total = 0;
    for (const b of chunks) total += b.length;
    const flat = new Uint8Array(total);
    let fo = 0;
    for (const b of chunks) { flat.set(b, fo); fo += b.length; }
    const readCode = () => {
      while (bitCnt < codeSize) {
        if (bi >= flat.length) return -1;
        bitBuf |= flat[bi++] << bitCnt;
        bitCnt += 8;
      }
      const code = bitBuf & ((1 << codeSize) - 1);
      bitBuf >>= codeSize;
      bitCnt -= codeSize;
      return code;
    };
    let prev = -1;
    const stack = new Uint16Array(4096);
    for (;;) {
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
        // KWK 特例：码尚未入字典，内容 = prev 链 + prev 首字节
        emit = prev;
        kwk = true;
      } else {
        break;
      }
      let sp = 0;
      let c = emit;
      // 沿前缀链回溯收集字节（根项 prefix=-1 终止；根项 0 也是有效字节）
      while (c >= 0) { stack[sp++] = dict[c * 2 + 1]; c = dict[c * 2]; }
      const first = stack[sp - 1];
      if (kwk) stack[sp++] = first;
      while (sp > 0 && oi < need) out[oi++] = stack[--sp];
      if (prev >= 0 && next < 4096) {
        dict[next * 2] = prev;
        dict[next * 2 + 1] = first;
        next++;
        if (next === (1 << codeSize) && codeSize < 12) codeSize++;
      }
      prev = code;
      if (oi >= need) break;
    }
    return out;
  }
  // 浏览器交给 canvas 解码（简单可靠），Node 回退纯 JS 解码器；两者都产出 RGBA
  // decode 签名 (bytes, zlib) → { rgba, w, h }，zlib 仅供 PNG 解压，BMP/GIF 忽略
  async function decodeToXObject(bytes, mime, decode) {
    if (typeof document !== 'undefined' && document.createElement) {
      return rgbaToXObject(await canvasImageToRgba(bytes, mime));
    }
    const zlib = nodeZlib();
    if (!zlib) throw new Error('Node 环境缺少 zlib，无法压缩图像数据');
    return rgbaToXObject(decode(bytes, zlib), zlib);
  }
  // RGBA 像素 → 颜色数据 + 可选 SMask 数据（全不透明时不生成 SMask）；单遍扫描同时产出两份数据
  async function rgbaToXObject(p, zlib) {
    const w = p.w, h = p.h, rgba = p.rgba;
    const n = w * h;
    const color = new Uint8Array(n * 3);
    const alpha = new Uint8Array(n);
    let o = 0, a = 0, hasAlpha = false;
    for (let i = 0; i < rgba.length; i += 4) {
      color[o] = rgba[i]; color[o + 1] = rgba[i + 1]; color[o + 2] = rgba[i + 2]; o += 3;
      alpha[a++] = rgba[i + 3];
      if (rgba[i + 3] < 255) hasAlpha = true;
    }
    const data = await deflate(color, zlib);
    let smask = null;
    if (hasAlpha) smask = { data: await deflate(alpha, zlib), filter: 'FlateDecode' };
    return { w, h, data, filter: 'FlateDecode', smask };
  }
  // dataUrl → 注册图像 XObject（同图去重），返回资源名（如 Im0）；失败返回 null
  async function addImage(dataUrl, ctx) {
    if (ctx.imageReg.has(dataUrl)) {
      const im = ctx.imageReg.get(dataUrl);
      ctx.images.add(im.name);
      return im.name;
    }
    const m = /^data:([^;,]+)(;[^,]*)?,(.*)$/.exec(dataUrl);
    const mime = m ? m[1] : '';
    const isB64 = !!(m && m[2] && /;base64/i.test(m[2]));
    const body = m ? m[3] : '';
    let bytes;
    try {
      bytes = isB64 ? base64ToBytes(body) : new TextEncoder().encode(decodeURIComponent(body));
    } catch (e) {
      console.warn('[TOPDF] 图像数据解析失败，已跳过');
      return null;
    }
    let im;
    try {
      if (/jpe?g$/i.test(mime)) {
        const d = parseJpegDims(bytes);
        im = { w: d.w, h: d.h, data: bytes, filter: 'DCTDecode' };
      } else if (/png$/i.test(mime)) {
        im = await decodeToXObject(bytes, 'image/png', decodePng);
      } else if (/bmp$/i.test(mime)) {
        im = await decodeToXObject(bytes, 'image/bmp', decodeBmp);
      } else if (/gif$/i.test(mime)) {
        im = await decodeToXObject(bytes, 'image/gif', decodeGif);
      } else {
        console.warn('[TOPDF] 不支持的图像格式: ' + mime);
        return null;
      }
    } catch (e) {
      console.warn('[TOPDF] 图像嵌入失败已跳过: ' + e.message);
      return null;
    }
    im.name = 'Im' + ctx.imageReg.size;
    ctx.imageReg.set(dataUrl, im);
    ctx.images.add(im.name);
    return im.name;
  }

  /* ------------------------- SVG → 内容流 ------------------------- */
  // 提取元素的 mix-blend-mode（OFD 注释常用 Darken，保持文字在深色高亮下可见）
  function blendOf(el) {
    const m = /mix-blend-mode\s*:\s*([a-zA-Z]+)/.exec(el.attrs.style || '');
    const b = m ? m[1].toLowerCase() : '';
    return b && b !== 'normal' ? b : null;
  }
  // 透明/混合模式需要 ExtGState（按 alpha+blend 组合去重）
  function ensureGState(alpha, blend, ctx) {
    if ((alpha == null || alpha >= 1) && !blend) return null;
    const a = alpha == null ? 1 : Math.max(0, Math.min(1, alpha));
    const key = a + '|' + (blend || '');
    let g = ctx.alphaReg.get(key);
    if (!g) {
      g = { name: 'GS' + ctx.alphaReg.size, a, blend };
      ctx.alphaReg.set(key, g);
    }
    ctx.alphas.add(g.name);
    return g.name;
  }
  // 通用着色：gs / w / d / 颜色 / 填充描边结束操作
  function paintAttrs(el, ctx, parts) {
    const fill = el.attrs.fill && el.attrs.fill !== 'none' ? parseCssColor(el.attrs.fill) : null;
    const stroke = el.attrs.stroke && el.attrs.stroke !== 'none' ? parseCssColor(el.attrs.stroke) : null;
    const alpha = (fill && fill.a != null && fill.a < 1) ? fill.a
      : (stroke && stroke.a != null && stroke.a < 1) ? stroke.a : null;
    const gs = ensureGState(alpha, blendOf(el), ctx);
    if (gs) parts.push('/' + gs + ' gs');
    if (stroke) {
      if (el.attrs['stroke-width']) parts.push(fmtNum(parseFloat(el.attrs['stroke-width'])) + ' w');
      const da = numList(el.attrs['stroke-dasharray']);
      if (da.length) parts.push('[' + da.map(fmtNum).join(' ') + '] 0 d');
    }
    if (fill) parts.push(fmtNum(fill.r / 255) + ' ' + fmtNum(fill.g / 255) + ' ' + fmtNum(fill.b / 255) + ' rg');
    if (stroke) parts.push(fmtNum(stroke.r / 255) + ' ' + fmtNum(stroke.g / 255) + ' ' + fmtNum(stroke.b / 255) + ' RG');
    if (fill && stroke) parts.push('B');
    else if (fill) parts.push('f');
    else if (stroke) parts.push('S');
  }

  function renderRect(el, ctx, parts) {
    const x = parseFloat(el.attrs.x) || 0;
    const y = parseFloat(el.attrs.y) || 0;
    const w = parseFloat(el.attrs.width) || 0;
    const h = parseFloat(el.attrs.height) || 0;
    if (!w || !h) return;
    const fill = el.attrs.fill ? parseCssColor(el.attrs.fill) : null;
    // 纯白背景（页面默认白底）且无描边：跳过
    if (fill && fill.r === 255 && fill.g === 255 && fill.b === 255 && !el.attrs.stroke) return;
    parts.push('q');
    parts.push(fmtNum(x) + ' ' + fmtNum(y) + ' ' + fmtNum(w) + ' ' + fmtNum(h) + ' re');
    paintAttrs(el, ctx, parts);
    parts.push('Q');
  }
  function renderPath(el, ctx, parts) {
    const tm = el.attrs.transform ? parseTransform(el.attrs.transform) : null;
    const path = pathToPdf(el.attrs.d, tm);
    if (!path) return;
    parts.push('q');
    parts.push(path);
    // 填充规则：evenodd → f* / B*（默认 NonZero 不变）
    if (el.attrs['fill-rule'] === 'evenodd') {
      const fill = el.attrs.fill && el.attrs.fill !== 'none' ? parseCssColor(el.attrs.fill) : null;
      const stroke = el.attrs.stroke && el.attrs.stroke !== 'none' ? parseCssColor(el.attrs.stroke) : null;
      const alpha = (fill && fill.a != null && fill.a < 1) ? fill.a
        : (stroke && stroke.a != null && stroke.a < 1) ? stroke.a : null;
      const gs = ensureGState(alpha, blendOf(el), ctx);
      if (gs) parts.push('/' + gs + ' gs');
      if (stroke) {
        if (el.attrs['stroke-width']) parts.push(fmtNum(parseFloat(el.attrs['stroke-width'])) + ' w');
        const da = numList(el.attrs['stroke-dasharray']);
        if (da.length) parts.push('[' + da.map(fmtNum).join(' ') + '] 0 d');
      }
      if (fill) parts.push(fmtNum(fill.r / 255) + ' ' + fmtNum(fill.g / 255) + ' ' + fmtNum(fill.b / 255) + ' rg');
      if (stroke) parts.push(fmtNum(stroke.r / 255) + ' ' + fmtNum(stroke.g / 255) + ' ' + fmtNum(stroke.b / 255) + ' RG');
      if (fill && stroke) parts.push('B*');
      else if (fill) parts.push('f*');
      else if (stroke) parts.push('S');
    } else {
      paintAttrs(el, ctx, parts);
    }
    parts.push('Q');
  }
  function renderEllipse(el, ctx, parts) {
    const cx = parseFloat(el.attrs.cx) || 0;
    const cy = parseFloat(el.attrs.cy) || 0;
    let rx, ry;
    if (el.tag === 'circle') { rx = ry = parseFloat(el.attrs.r) || 0; }
    else { rx = parseFloat(el.attrs.rx) || 0; ry = parseFloat(el.attrs.ry) || 0; }
    if (!rx || !ry) return;
    const segs = ellipseToCubics(cx, cy, rx, ry);
    parts.push('q');
    parts.push(fmtNum(cx + rx) + ' ' + fmtNum(cy) + ' m');
    for (const s of segs) {
      parts.push(fmtNum(s.c1[0]) + ' ' + fmtNum(s.c1[1]) + ' ' + fmtNum(s.c2[0]) + ' ' + fmtNum(s.c2[1]) +
        ' ' + fmtNum(s.p[0]) + ' ' + fmtNum(s.p[1]) + ' c');
    }
    parts.push('h');
    paintAttrs(el, ctx, parts);
    parts.push('Q');
  }
  function renderText(el, ctx, parts) {
    const fillAttr = el.attrs.fill;
    if (fillAttr === 'none') return;
    const fill = parseCssColor(fillAttr) || { r: 0, g: 0, b: 0 };
    // 文本元素的变换矩阵：无 CTM 时是恒等或 scale(hScale 1)；
    // 有 CTM 时为 translate(bx by) matrix(...) 的合并矩阵（此时 tspan 坐标为局部坐标）
    const m = parseTransform(el.attrs.transform || '');
    const fontSize = parseFloat(el.attrs['font-size']) || 3;
    const gs = ensureGState(fill.a, blendOf(el), ctx);
    if (gs) { parts.push('q'); parts.push('/' + gs + ' gs'); }
    parts.push('BT');
    parts.push('/F1 ' + fmtNum(fontSize) + ' Tf');
    parts.push(fmtNum(fill.r / 255) + ' ' + fmtNum(fill.g / 255) + ' ' + fmtNum(fill.b / 255) + ' rg');
    // 收集文本片段：优先 tspan 子元素，若无则取直接文本
    const textRuns = [];
    const hasTspan = el.children.some(c => c.tag === 'tspan');
    if (hasTspan) {
      for (const ts of el.children) {
        if (ts.tag !== 'tspan') continue;
        if (ts.text) textRuns.push({ text: ts.text, x: ts.attrs.x, y: ts.attrs.y, transform: ts.attrs.transform });
      }
    } else if (el.text) {
      textRuns.push({ text: el.text, x: el.attrs.x, y: el.attrs.y, transform: null });
    }
    for (let ti = 0; ti < textRuns.length; ti++) {
      const ts = textRuns[ti];
      const chars = Array.from(ts.text);
      if (!chars.length) continue;
      const xs = numList(ts.x);
      const ys = numList(ts.y);
      const rot = parseRotate(ts.transform);
      // 直接文本（非 tspan）无逐字符坐标时，按字体大小递增 x
      const isDirect = !hasTspan && ti === 0;
      if (isDirect) {
        // 直接文本：用首字符坐标 + 递增 x，一次 Tj 输出全部字符
        const x0 = xs[0] || 0;
        const y0 = ys[0] || 0;
        let tm;
        if (rot) {
          const c = Math.cos(rot.ang), s = Math.sin(rot.ang);
          const s0 = m[0];
          tm = [s0 * c, s0 * s, s, -c, s0 * rot.cx, rot.cy];
        } else {
          tm = [m[0], m[1], -m[2], -m[3],
            m[0] * x0 + m[2] * y0 + m[4],
            m[1] * x0 + m[3] * y0 + m[5]];
        }
        parts.push(tm.map(fmtNum).join(' ') + ' Tm');
        parts.push('<' + chars.map(c => utf16beHex(c)).join('') + '> Tj');
      } else {
        // tspan：每字符独立 Tm 定位
        for (let i = 0; i < chars.length; i++) {
          const x = i < xs.length ? xs[i] : (xs[xs.length - 1] || 0);
          const y = i < ys.length ? ys[i] : (ys[ys.length - 1] || 0);
          let tm;
          if (rot) {
            const c = Math.cos(rot.ang), s = Math.sin(rot.ang);
            const s0 = m[0];
            tm = [s0 * c, s0 * s, s, -c, s0 * rot.cx, rot.cy];
          } else {
            tm = [m[0], m[1], -m[2], -m[3],
              m[0] * x + m[2] * y + m[4],
              m[1] * x + m[3] * y + m[5]];
          }
          parts.push(tm.map(fmtNum).join(' ') + ' Tm');
          parts.push('<' + utf16beHex(chars[i]) + '> Tj');
        }
      }
    }
    parts.push('ET');
    if (gs) parts.push('Q');
  }
  async function renderImage(el, ctx, parts) {
    const x = parseFloat(el.attrs.x) || 0;
    const y = parseFloat(el.attrs.y) || 0;
    const w = parseFloat(el.attrs.width) || 0;
    const h = parseFloat(el.attrs.height) || 0;
    if (!w || !h) return;
    const href = el.attrs.href || el.attrs['xlink:href'];
    if (!href) return;
    const name = await addImage(href, ctx);
    if (!name) return;
    parts.push('q');
    const clipId = parseClipRef(el.attrs['clip-path']);
    if (clipId) {
      const rects = ctx.clips.get(clipId);
      if (rects && rects.length) {
        for (const r of rects) {
          parts.push(fmtNum(r.x) + ' ' + fmtNum(r.y) + ' ' + fmtNum(r.w) + ' ' + fmtNum(r.h) + ' re W n');
        }
      }
    }
    // 图像单位坐标 → 边界矩形。SVG y 为图像上边，PDF 图像数据自底向上，
    // 用负高并平移使图像不翻转：w 0 0 -h x (y+h) cm
    parts.push(fmtNum(w) + ' 0 0 ' + fmtNum(-h) + ' ' + fmtNum(x) + ' ' + fmtNum(y + h) + ' cm');
    parts.push('/' + name + ' Do');
    parts.push('Q');
  }
  async function renderGroup(el, ctx, parts) {
    const m = parseTransform(el.attrs.transform || '');
    const op = parseFloat(el.attrs.opacity);
    const gs = ensureGState(op && op < 1 ? op : null, blendOf(el), ctx);
    const hasM = m[0] !== 1 || m[1] !== 0 || m[2] !== 0 || m[3] !== 1 || m[4] !== 0 || m[5] !== 0;
    parts.push('q');
    if (hasM) parts.push(m.map(fmtNum).join(' ') + ' cm');
    if (gs) parts.push('/' + gs + ' gs');
    for (const child of el.children) await renderElement(child, ctx, parts);
    parts.push('Q');
  }
  function registerClip(el, ctx) {
    const id = el.attrs.id;
    if (!id) return;
    const rects = [];
    for (const child of el.children) {
      if (child.tag === 'rect') {
        rects.push({
          x: parseFloat(child.attrs.x) || 0,
          y: parseFloat(child.attrs.y) || 0,
          w: parseFloat(child.attrs.width) || 0,
          h: parseFloat(child.attrs.height) || 0
        });
      }
    }
    ctx.clips.set(id, rects);
  }
  function collectClips(root, ctx) {
    (function walk(el) {
      for (const c of el.children) {
        // parseSvgXml 已把标签名转小写：clipPath → clippath
        if (c.tag === 'clippath') registerClip(c, ctx);
        walk(c);
      }
    })(root);
  }
  async function renderElement(el, ctx, parts) {
    switch (el.tag) {
      case 'rect': renderRect(el, ctx, parts); break;
      case 'path': renderPath(el, ctx, parts); break;
      case 'ellipse':
      case 'circle': renderEllipse(el, ctx, parts); break;
      case 'text': renderText(el, ctx, parts); break;
      case 'image': await renderImage(el, ctx, parts); break;
      case 'g': await renderGroup(el, ctx, parts); break;
      default: break; // clipPath 等仅登记不绘制
    }
  }

  // SVG 字符串（mm 坐标、Y 向下）→ 单页 PDF 内容流
  async function svgToContentStream(svgStr, pageWmm, pageHmm, ctx) {
    const root = parseSvgXml(svgStr);
    collectClips(root, ctx);
    const parts = [];
    const pageHpt = pageHmm * MM_TO_PT;
    // 全局变换：mm → pt（2.8346 倍）并翻转 Y（PDF 原点在左下）
    parts.push('q');
    parts.push(fmtNum(MM_TO_PT) + ' 0 0 ' + fmtNum(-MM_TO_PT) + ' 0 ' + fmtNum(pageHpt) + ' cm');
    for (const child of root.children) await renderElement(child, ctx, parts);
    parts.push('Q');
    return parts.join('\n');
  }

  /* ------------------------- PDF 组装 ------------------------- */
  // PDF 文本字符串：纯 ASCII 用 literal，含非 ASCII 转 UTF-16BE+BOM 的 hex（避免阅读器乱码）
  function pdfTextString(s) {
    s = String(s);
    if (/^[\x20-\x7E]*$/.test(s)) {
      return '(' + s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + ')';
    }
    let hex = 'FEFF';
    for (let i = 0; i < s.length; i++) {
      let cp = s.codePointAt(i);
      if (cp > 0xFFFF) {
        const v = cp - 0x10000;
        cp = ((v >> 10) + 0xD800) << 16 | (((v & 0x3FF) + 0xDC00) & 0xFFFF);
        hex += (cp >>> 16).toString(16).padStart(4, '0');
        i++;
      }
      hex += cp.toString(16).padStart(4, '0');
    }
    return '<' + hex + '>';
  }
  function buildInfo(opts) {
    const info = {
      Producer: 'OFD-Viewer toPdf.js',
      Creator: 'OFD-Viewer',
      // PDF 标准日期格式：D:YYYYMMDDHHmmSS+hh'mm'（去 ISO 的 T 与毫秒）
      CreationDate: 'D:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z/, 'Z').replace('T', '')
    };
    if (opts.title) info.Title = opts.title;
    if (opts.author) info.Author = opts.author;
    if (opts.subject) info.Subject = opts.subject;
    return '<< ' + Object.keys(info).map(k => '/' + k + ' ' + pdfTextString(info[k])).join('\n') + ' >>';
  }
  // pages: [{ w, h, content, images: string[], alphas: string[] }]
  // imageReg: Map dataUrl → { name, w, h, data, filter }; alphaReg: Map a → { name, a }
  function assemblePdf(pages, imageReg, alphaReg, opts) {
    opts = opts || {};
    const enc = new TextEncoder();
    const chunks = [];
    const offsets = [];
    let byteOff = 0;
    let obj = 1;
    const catalogObj = obj++;
    const pagesObj = obj++;
    const infoObj = obj++;
    const pageObjs = [], contentObjs = [];
    for (let i = 0; i < pages.length; i++) { pageObjs.push(obj++); contentObjs.push(obj++); }
    const fontObj = obj++;
    const cidObj = obj++;
    const fdObj = obj++;
    const gsObjs = {}, imgObjs = {}, smaskObjs = {};
    for (const a of alphaReg.keys()) gsObjs[alphaReg.get(a).name] = obj++;
    for (const key of imageReg.keys()) {
      const im = imageReg.get(key);
      imgObjs[im.name] = obj++;
      if (im.smask) smaskObjs[im.name] = obj++;
    }
    const size = obj;
    const pushBytes = b => { chunks.push(b); byteOff += b.length; };
    const emit = s => { offsets.push(byteOff); pushBytes(typeof s === 'string' ? enc.encode(s) : s); };
    const streamEnd = () => enc.encode('\nendstream\nendobj\n');
    // 头
    pushBytes(enc.encode('%PDF-1.4\n%'));
    pushBytes(new Uint8Array([0xE2, 0xE3, 0xCF, 0xD3]));
    pushBytes(enc.encode('\n'));
    // 1 Catalog
    emit('1 0 obj\n<< /Type /Catalog /Pages ' + pagesObj + ' 0 R >>\nendobj\n');
    // 2 Pages
    const kids = pageObjs.map(n => n + ' 0 R').join(' ');
    emit(pagesObj + ' 0 obj\n<< /Type /Pages /Kids [' + kids + '] /Count ' + pages.length + ' >>\nendobj\n');
    // 3 Info
    emit(infoObj + ' 0 obj\n' + buildInfo(opts) + '\nendobj\n');
    // 页面
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const media = '[0 0 ' + fmtNum(p.w * MM_TO_PT) + ' ' + fmtNum(p.h * MM_TO_PT) + ']';
      let ext = '';
      if (p.alphas && p.alphas.length) {
        ext = ' /ExtGState << ' + p.alphas.map(n => '/' + n + ' ' + gsObjs[n] + ' 0 R').join(' ') + ' >>';
      }
      let xo = '';
      if (p.images && p.images.length) {
        xo = ' /XObject << ' + p.images.map(n => '/' + n + ' ' + imgObjs[n] + ' 0 R').join(' ') + ' >>';
      }
      const resources = '<< /Font << /F1 ' + fontObj + ' 0 R >>' + ext + xo + ' >>';
      emit(pageObjs[i] + ' 0 obj\n<< /Type /Page /Parent ' + pagesObj + ' 0 R /MediaBox ' + media +
        ' /Resources ' + resources + ' /Contents ' + contentObjs[i] + ' 0 R >>\nendobj\n');
      const contentBytes = enc.encode(p.content);
      emit(contentObjs[i] + ' 0 obj\n<< /Length ' + contentBytes.length + ' >>\nstream\n');
      pushBytes(contentBytes);
      pushBytes(streamEnd());
    }
    // 字体（Type0 + UniGB-UCS2-H，STSong-Light，依赖阅读器内置中文字体）
    emit(fontObj + ' 0 obj\n<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light ' +
      '/Encoding /UniGB-UCS2-H /DescendantFonts [' + cidObj + ' 0 R] >>\nendobj\n');
    emit(cidObj + ' 0 obj\n<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light ' +
      '/CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /FontDescriptor ' + fdObj + ' 0 R >>\nendobj\n');
    emit(fdObj + ' 0 obj\n<< /Type /FontDescriptor /FontName /STSong-Light /Flags 4 ' +
      '/FontBBox [-241 -260 1120 932] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 762 /StemV 80 >>\nendobj\n');
    // ExtGState（透明度 + 混合模式）
    for (const a of alphaReg.keys()) {
      const g = alphaReg.get(a);
      const dict = '/Type /ExtGState' +
        (g.a < 1 ? ' /ca ' + g.a + ' /CA ' + g.a + ' /AIS false' : '') +
        (g.blend ? ' /BM /' + g.blend.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('') : '');
      emit(gsObjs[g.name] + ' 0 obj\n<< ' + dict + ' >>\nendobj\n');
    }
    // 图像 XObject（带透明通道时附加 SMask 灰度图）
    for (const key of imageReg.keys()) {
      const im = imageReg.get(key);
      let dict = '<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /' + im.filter + ' /Length ' + im.data.length;
      if (im.smask) dict += ' /SMask ' + smaskObjs[im.name] + ' 0 R';
      dict += ' >>';
      emit(imgObjs[im.name] + ' 0 obj\n' + dict + '\nstream\n');
      pushBytes(im.data);
      pushBytes(streamEnd());
      if (im.smask) {
        const s = im.smask;
        emit(smaskObjs[im.name] + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + im.w +
          ' /Height ' + im.h + ' /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /' + s.filter +
          ' /Length ' + s.data.length + ' >>\nstream\n');
        pushBytes(s.data);
        pushBytes(streamEnd());
      }
    }
    // xref / trailer（byteOff 即当前总字节数，直接复用免重新累加）
    const xrefPos = byteOff;
    const xref = ['xref', '0 ' + size, '0000000000 65535 f ']
      .concat(offsets.map(o => String(o).padStart(10, '0') + ' 00000 n '))
      .join('\n');
    const trailer = 'trailer\n<< /Size ' + size + ' /Root ' + catalogObj + ' 0 R /Info ' + infoObj + ' 0 R >>\n' +
      'startxref\n' + xrefPos + '\n%%EOF';
    const xrefBytes = enc.encode(xref + '\n' + trailer + '\n');
    chunks.push(xrefBytes);
    const total = xrefPos + xrefBytes.length;
    const out = new Uint8Array(total);
    let off2 = 0;
    for (const c of chunks) { out.set(c, off2); off2 += c.length; }
    return out;
  }

  /* ------------------------- 公共 API ------------------------- */
  // ofdToPdf(ofd, opts) → Promise<Uint8Array>
  // opts: { title, author, subject, renderOpts, onProgress }
  async function ofdToPdf(ofd, opts) {
    const coreFn = getCore();
    if (!coreFn || typeof coreFn.renderPageToString !== 'function') {
      throw new Error('toPdf.js 需要先加载 ofd.js');
    }
    opts = opts || {};
    const imageReg = new Map();
    const alphaReg = new Map();
    const pages = [];
    const count = coreFn.getPageCount(ofd);
    for (let i = 0; i < count; i++) {
      const svg = await coreFn.renderPageToString(ofd, i, opts.renderOpts);
      const dims = await coreFn.getPageDimensions(ofd, i);
      const ctx = { imageReg, alphaReg, images: new Set(), alphas: new Set(), clips: new Map() };
      const content = await svgToContentStream(svg, dims.width, dims.height, ctx);
      pages.push({
        w: dims.width, h: dims.height, content,
        images: Array.from(ctx.images), alphas: Array.from(ctx.alphas)
      });
      if (opts.onProgress) opts.onProgress(i + 1, count);
    }
    return assemblePdf(pages, imageReg, alphaReg, opts);
  }
  // svgToPdf(svgString, pageWmm, pageHmm, opts) → Promise<Uint8Array>（单页，便于调试）
  async function svgToPdf(svgString, pageWmm, pageHmm, opts) {
    const imageReg = new Map();
    const alphaReg = new Map();
    const ctx = { imageReg, alphaReg, images: new Set(), alphas: new Set(), clips: new Map() };
    const content = await svgToContentStream(svgString, pageWmm, pageHmm, ctx);
    const pages = [{
      w: pageWmm, h: pageHmm, content,
      images: Array.from(ctx.images), alphas: Array.from(ctx.alphas)
    }];
    return assemblePdf(pages, imageReg, alphaReg, opts);
  }

  const TOPDF = {
    ofdToPdf,
    svgToPdf,
    // 非稳定接口，供调试/扩展使用。
    // parseXml 是 parseSvgXml 的旧名，保留为别名以免打断既有脚本，新代码请用 parseSvgXml。
    _internals: {
      svgToContentStream, parseSvgXml, pathToPdf, parseTransform, assemblePdf,
      parseXml: parseSvgXml
    }
  };

  global.TOPDF = TOPDF;
  if (typeof module !== 'undefined' && module.exports) module.exports = TOPDF;
})(typeof window !== 'undefined' ? window : globalThis);

