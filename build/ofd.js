/*!
 * ofd.js — OFD（GB/T 33190）纯前端解析与 SVG 渲染引擎
 * 零依赖，ZIP 解压使用浏览器原生 DecompressionStream
 */
(function (global) {
  "use strict";

  // ==================== 性能打点 ====================
  let _profiling = false;
  let _marks = [];
  let _lastProfile = null;

  function mark(label, tag) {
    if (!_profiling) return;
    _marks.push({ label, tag: tag || "", t: performance.now() });
  }
  function flushProfile(title, tag) {
    const tagFilter = tag || "";
    const my = tagFilter ? _marks.filter((m) => m.tag === tagFilter) : _marks;
    const rows = [];
    for (let i = 0; i < my.length; i++) {
      const cur = my[i];
      const prev = i > 0 ? my[i - 1] : null;
      rows.push({
        阶段: cur.label,
        增量ms: +(cur.t - (prev ? prev.t : cur.t)).toFixed(1),
        累计ms: +(cur.t - my[0].t).toFixed(1),
      });
    }
    const name = title ? "[" + title + "] " : "";
    if (typeof console !== "undefined" && console.table) {
      console.log("%c" + name + "耗时打点", "color:#4B3FE3;font-weight:bold");
      console.table(rows);
    }
    _lastProfile = { title: title || "", rows };
    if (tagFilter) _marks = _marks.filter((m) => m.tag !== tagFilter);
    else _marks = [];
    return rows;
  }

  // ==================== XML 节点工具 ====================
  function stripNs(tag) {
    const c = tag.indexOf(":");
    return c >= 0 ? tag.slice(c + 1) : tag;
  }
  function child(parent, name) {
    if (!parent || !parent.children) return null;
    for (const c of parent.children) {
      if (stripNs(c.tag) === name) return c;
    }
    return null;
  }
  function children(parent, name) {
    const out = [];
    if (!parent || !parent.children) return out;
    for (const c of parent.children) {
      if (stripNs(c.tag) === name) out.push(c);
    }
    return out;
  }
  function text(node) {
    return node ? (node.text || "").trim() : "";
  }
  function attr(el, name) {
    return el && el.attrs[name] != null ? el.attrs[name] : null;
  }
  function num(el, name, dflt) {
    const v = attr(el, name);
    if (v === null || v === "") return dflt;
    const n = parseFloat(v);
    return isFinite(n) ? n : dflt;
  }
  function bool(el, name, dflt) {
    const v = attr(el, name);
    if (v === null || v === "") return dflt;
    return v === "true" || v === "1";
  }

  function parseBox(str) {
    if (!str) return { x: 0, y: 0, w: 0, h: 0 };
    const p = str.trim().split(/\s+/).map(Number);
    return { x: p[0] || 0, y: p[1] || 0, w: p[2] || 0, h: p[3] || 0 };
  }
  function parseMatrix(str) {
    if (!str) return null;
    const p = str.trim().split(/\s+/).map(Number);
    return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] || 0, p[4] || 0, p[5] || 0];
  }

  // ==================== 路径 ====================
  function dirOf(path) {
    const i = path.lastIndexOf("/");
    return i >= 0 ? path.slice(0, i) : "";
  }
  function resolvePath(base, rel) {
    if (!rel) return rel;
    if (/^[a-zA-Z]+:\/\//.test(rel) || rel.startsWith("/"))
      return rel.replace(/^\//, "");
    const parts = (dirOf(base) ? dirOf(base) + "/" : "") + rel;
    const segs = parts.split("/");
    const out = [];
    for (const s of segs) {
      if (s === "." || s === "") continue;
      if (s === "..") out.pop();
      else out.push(s);
    }
    return out.join("/");
  }

  // ==================== 颜色 ====================
  // "156 82 35" | "#9C5223" | "#ee #20 #25" | "255"(灰度)
  function parseColor(el) {
    if (!el) return null;
    const val = attr(el, "Value");
    const alpha = attr(el, "Alpha");
    let a = 1;
    if (alpha !== null && alpha !== "")
      a = Math.max(0, Math.min(1, parseFloat(alpha) / 255));
    if (!val) return { r: 0, g: 0, b: 0, a };
    const parts = val.trim().split(/\s+/);
    if (parts.length === 1) {
      if (parts[0].startsWith("#")) {
        const hex = parts[0].slice(1);
        const full =
          hex.length === 3
            ? hex
                .split("")
                .map((c) => c + c)
                .join("")
            : hex;
        const n = parseInt(full, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
      }
      const g = parseInt(parts[0]);
      return { r: g, g: g, b: g, a };
    }
    // 多分量：可能是 "156 82 35" 或 "#ee #20 #25"
    const parseComp = (s) => {
      if (s.startsWith("#")) {
        const v = parseInt(s.slice(1), 16);
        return isNaN(v) ? 0 : v;
      }
      const v = parseInt(s);
      return isNaN(v) ? 0 : v;
    };
    return {
      r: parseComp(parts[0]),
      g: parseComp(parts[1]),
      b: parseComp(parts[2]),
      a,
    };
  }
  const _colorCache = new Map();
  function colorToCss(c) {
    if (!c) return "#000";
    const key = c.r + "," + c.g + "," + c.b + "," + c.a;
    let css = _colorCache.get(key);
    if (css !== undefined) return css;
    css =
      c.a < 1
        ? `rgba(${c.r},${c.g},${c.b},${c.a})`
        : `rgb(${c.r},${c.g},${c.b})`;
    if (_colorCache.size >= 256) _colorCache.clear(); // 简单防膨胀
    _colorCache.set(key, css);
    return css;
  }

  // ==================== XML 解析器 ====================
  // 节点 { tag, attrs, children, text }，无 DOM 中间产物，浏览器/Node 通用
  function parseXml(str) {
    const root = { tag: "#root", attrs: {}, children: [], text: "" };
    const stack = [root];
    let i = 0;
    const n = str.length;
    while (i < n) {
      const lt = str.indexOf("<", i);
      const cur = stack[stack.length - 1];
      if (lt < 0) {
        cur.text += decodeEntities(str.slice(i));
        break;
      }
      if (lt > i) cur.text += decodeEntities(str.slice(i, lt));
      if (str[lt + 1] === "!" && str.startsWith("<![CDATA[", lt)) {
        const end = str.indexOf("]]>", lt + 9);
        cur.text += str.slice(lt + 9, end < 0 ? n : end);
        i = end < 0 ? n : end + 3;
        continue;
      }
      if (str[lt + 1] === "?" || (str[lt + 1] === "!" && str[lt + 2] !== "[")) {
        // XML 声明 / 注释 / DOCTYPE：跳到对应结束标记
        const close = str.startsWith("<!--", lt) ? "-->" : ">";
        const end = str.indexOf(close, lt + 2);
        i = end < 0 ? n : end + close.length;
        continue;
      }
      if (str[lt + 1] === "/") {
        // 闭合标签：校验与栈顶匹配后弹出
        const gt = str.indexOf(">", lt);
        const name = str.slice(lt + 2, gt < 0 ? n : gt).trim();
        const top = stack[stack.length - 1];
        if (stack.length > 1 && name && stripNs(top.tag) !== stripNs(name)) {
          throw new Error(
            "XML 解析错误: 标签不匹配 <" +
              top.tag +
              "> 与 </" +
              name +
              ">（位置 " +
              lt +
              "）",
          );
        }
        stack.pop();
        i = gt < 0 ? n : gt + 1;
        continue;
      }
      // 开始标签
      const r = parseStartTag(str, lt);
      const node = { tag: r.name, attrs: r.attrs, children: [], text: "" };
      stack[stack.length - 1].children.push(node);
      if (!r.selfClosing) stack.push(node);
      i = r.end;
    }
    const el = root.children[0];
    if (!el) throw new Error("XML 解析错误: 无根元素");
    return { documentElement: el };
  }

  function _isSpace(c) {
    const cc = c.charCodeAt(0);
    return cc === 32 || cc === 9 || cc === 10 || cc === 13;
  }
  function _isNameEnd(c) {
    return c === ">" || c === "/" || _isSpace(c);
  }
  function _isAttrEnd(c) {
    return c === "=" || c === ">" || c === "/" || _isSpace(c);
  }
  function _isValEnd(c) {
    return c === ">" || _isSpace(c);
  }

  function parseStartTag(str, start) {
    const n = str.length;
    let i = start + 1;
    let name = "";
    while (i < n && !_isNameEnd(str[i])) {
      name += str[i];
      i++;
    }
    const attrs = {};
    let selfClosing = false;
    while (i < n) {
      while (i < n && _isSpace(str[i])) i++;
      if (i >= n) break;
      const ch = str[i];
      if (ch === ">") {
        i++;
        break;
      }
      if (ch === "/") {
        selfClosing = true;
        i++;
        if (str[i] === ">") i++;
        break;
      }
      let an = "";
      while (i < n && !_isAttrEnd(str[i])) {
        an += str[i];
        i++;
      }
      while (i < n && _isSpace(str[i])) i++;
      if (i < n && str[i] === "=") {
        i++;
        while (i < n && _isSpace(str[i])) i++;
        if (i < n && (str[i] === '"' || str[i] === "'")) {
          const q = str[i];
          const qe = str.indexOf(q, i + 1);
          attrs[an] = decodeEntities(str.slice(i + 1, qe < 0 ? n : qe));
          i = qe < 0 ? n : qe + 1;
        } else {
          let v = "";
          while (i < n && !_isValEnd(str[i])) {
            v += str[i];
            i++;
          }
          attrs[an] = decodeEntities(v);
        }
      } else if (an) {
        attrs[an] = ""; // 无值属性（布尔属性）
      }
    }
    return { name, attrs, selfClosing, end: i };
  }

  // XML 实体解码：5 个预定义实体 + 十进制/十六进制字符引用
  function decodeEntities(s) {
    if (s.indexOf("&") < 0) return s;
    return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, e) => {
      switch (e) {
        case "amp":
          return "&";
        case "lt":
          return "<";
        case "gt":
          return ">";
        case "quot":
          return '"';
        case "apos":
          return "'";
        default: {
          const cp =
            e[1] === "x" || e[1] === "X"
              ? parseInt(e.slice(2), 16)
              : parseInt(e.slice(1), 10);
          // 码点合法性校验：代理区与超 Unicode 上限的畸形引用返回 U+FFFD，
          // 避免 String.fromCodePoint 抛 RangeError 中断整个解析
          if (
            !isFinite(cp) ||
            cp < 0 ||
            cp > 0x10ffff ||
            (cp >= 0xd800 && cp <= 0xdfff)
          )
            return "\uFFFD";
          return String.fromCodePoint(cp);
        }
      }
    });
  }

  // XML 转义：与 decodeEntities 互逆，只处理 5 个预定义实体
  const _xmlEscapeMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  };
  function escapeXml(s) {
    return String(s).replace(/[&<>"']/g, (c) => _xmlEscapeMap[c]);
  }

  // DeltaX/DeltaY: "v1 v2 ..." | "g N V ..."（g=重复N次取值V）
  function expandDelta(str) {
    if (!str) return [];
    const tokens = str.trim().split(/\s+/);
    const result = [];
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === "g" || t === "G") {
        const n = parseInt(tokens[i + 1], 10);
        const v = parseFloat(tokens[i + 2]);
        for (let j = 0; j < n; j++) result.push(v);
        i += 3;
      } else {
        result.push(parseFloat(t));
        i += 1;
      }
    }
    return result;
  }

  // ==================== 通用数据结构 ====================
  // LRU 缓存：SVG 页面缓存、ZIP 条目缓存、路径缩写缓存共用。
  // class 不提升，故定义必须早于所有构造点。
  class LRUCache {
    constructor(max) {
      this._max = max;
      this._map = new Map();
    }
    get(key) {
      const v = this._map.get(key);
      if (v !== undefined) {
        this._map.delete(key);
        this._map.set(key, v);
      }
      return v;
    }
    set(key, val) {
      if (this._map.has(key)) this._map.delete(key);
      this._map.set(key, val);
      if (this._map.size > this._max) {
        const first = this._map.keys().next().value;
        this._map.delete(first);
      }
    }
    has(key) {
      return this._map.has(key);
    }
  }

  // ==================== ZIP 解压 ====================
  const _utf8Decoder = new TextDecoder("utf-8");

  // 单条目解压后体积上限（256MB），用于阻断 ZIP 炸弹；OFD 内单个资源远超此值即属异常
  const MAX_UNCOMPRESSED_SIZE = 256 * 1024 * 1024;
  // ZIP 条目缓存上限（条目数），避免大文档 / 多图文档内存无限膨胀
  const ZIP_ENTRY_CACHE_MAX = 64;

  async function readZip(data) {
    if (!(data instanceof Uint8Array)) data = new Uint8Array(data);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const len = data.byteLength;
    // 查找 End of Central Directory 记录
    let eocd = -1;
    for (let i = len - 22; i >= 0 && i >= len - 22 - 65535; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("无效的 OFD/ZIP 文件：未找到 EOCD");
    if (view.getUint32(eocd + 16, true) === 0xffffffff) {
      throw new Error("暂不支持 ZIP64 格式的 OFD 文件");
    }
    const cdEntries = view.getUint16(eocd + 10, true);
    const cdOffset = view.getUint32(eocd + 16, true);
    const entries = Object.create(null);
    let off = cdOffset;
    for (let i = 0; i < cdEntries; i++) {
      if (view.getUint32(off, true) !== 0x02014b50) break;
      const compMethod = view.getUint16(off + 10, true);
      const compSize = view.getUint32(off + 20, true);
      const uncompSize = view.getUint32(off + 24, true);
      const nameLen = view.getUint16(off + 28, true);
      const extraLen = view.getUint16(off + 30, true);
      const commentLen = view.getUint16(off + 32, true);
      const localOff = view.getUint32(off + 42, true);
      const nameBytes = data.subarray(off + 46, off + 46 + nameLen);
      const name = _utf8Decoder.decode(nameBytes);
      entries[name] = { compMethod, compSize, uncompSize, localOff };
      off += 46 + nameLen + extraLen + commentLen;
    }
    return { data, view, entries, cache: new LRUCache(ZIP_ENTRY_CACHE_MAX) };
  }

  async function readEntry(zip, name) {
    if (!zip) return null;
    if (zip.cache && zip.cache.has(name)) return zip.cache.get(name);
    const e = zip.entries[name];
    if (!e) return null;
    const lOff = e.localOff;
    const nameLen = zip.view.getUint16(lOff + 26, true);
    const extraLen = zip.view.getUint16(lOff + 28, true);
    const dataStart = lOff + 30 + nameLen + extraLen;
    const compressed = zip.data.subarray(dataStart, dataStart + e.compSize);
    let result = null;
    if (e.compMethod === 0) {
      result = compressed;
    } else if (e.compMethod === 8) {
      // 先按声明体积拦截；uncompSize 可能与实际不符，解压后再按真实体积校验一次
      if (e.uncompSize > MAX_UNCOMPRESSED_SIZE) {
        throw new Error(
          "ZIP 条目声明解压体积过大（" +
            e.uncompSize +
            " 字节），已中止以防解压炸弹",
        );
      }
      const ds = new DecompressionStream("deflate-raw");
      const rs = new ReadableStream({
        start(c) {
          c.enqueue(compressed);
          c.close();
        },
      });
      const buf = await new Response(rs.pipeThrough(ds)).arrayBuffer();
      if (buf.byteLength > MAX_UNCOMPRESSED_SIZE) {
        throw new Error(
          "ZIP 条目解压后体积超过上限（" +
            buf.byteLength +
            " 字节），已中止以防解压炸弹",
        );
      }
      result = new Uint8Array(buf);
    } else {
      throw new Error("不支持的压缩方法: " + e.compMethod);
    }
    if (zip.cache) zip.cache.set(name, result);
    return result;
  }

  async function readEntryText(zip, name) {
    const bytes = await readEntry(zip, name);
    if (!bytes) return null;
    return _utf8Decoder.decode(bytes);
  }

  /* ---------- 字节与编码工具（base64 / hex / 比较） ---------- */
  function bytesToBase64(bytes) {
    let s = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(s);
  }

  // base64 → 字节。做三件事以防真实文档里的脏输入直接抛异常：
  //   1) 去空白/NULL —— XML 里的内嵌图像 base64 常带换行；
  //   2) URL-safe 字符 '-' '_' 转回 '+' '/' —— 否则 atob 抛 InvalidCharacterError；
  //   3) 按需补 '=' 填充，并对长度 %4===1 的非法输入显式报错而非静默出错。
  function base64ToBytes(b64) {
    let s = String(b64)
      .replace(/[\s\x00]/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const pad = s.length % 4;
    if (pad === 2) s += "==";
    else if (pad === 3) s += "=";
    else if (pad === 1) throw new Error("base64 长度非法");
    let bin;
    if (typeof atob === "function") {
      bin = atob(s);
    } else {
      // 兜底实现（无 atob 的环境），'=' 视为组内结束
      const table =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      const eq = "=".charCodeAt(0);
      bin = "";
      for (let i = 0; i < s.length; i += 4) {
        const c = [s[i], s[i + 1], s[i + 2], s[i + 3]].map((ch) =>
          ch === "=" ? eq : table.indexOf(ch),
        );
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

  function bytesEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // 摘要比对。部分国密厂商 SDK（如 Provider="sdt"）会把摘要写入固定长度缓冲区
  // （实测为 128 字节）并在尾部补零，因此 CheckValue 长度可能大于摘要本身。
  // 此时允许「尾部全为 0」的补零形态，只比对前 digest.length 字节。
  function digestMatches(digest, expected) {
    if (bytesEqual(digest, expected)) return true;
    if (expected.length <= digest.length) return false;
    for (let i = digest.length; i < expected.length; i++)
      if (expected[i] !== 0) return false;
    return bytesEqual(digest, expected.subarray(0, digest.length));
  }

  // ==================== SM3 哈希 ====================
  const SM3_IV = new Uint32Array([
    0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600, 0xa96f30bc, 0x163138aa,
    0xe38dee4d, 0xb0fb0e4e,
  ]);
  function sm3Rotl(x, n) {
    return ((x << n) | (x >>> (32 - n))) >>> 0;
  }
  function sm3P0(x) {
    return (x ^ sm3Rotl(x, 9) ^ sm3Rotl(x, 17)) >>> 0;
  }
  function sm3P1(x) {
    return (x ^ sm3Rotl(x, 15) ^ sm3Rotl(x, 23)) >>> 0;
  }
  function sm3FF(x, y, z, j) {
    return j < 16 ? (x ^ y ^ z) >>> 0 : ((x & y) | (x & z) | (y & z)) >>> 0;
  }
  function sm3GG(x, y, z, j) {
    return j < 16 ? (x ^ y ^ z) >>> 0 : ((x & y) | (~x & z)) >>> 0;
  }
  function sm3Hash(data) {
    const msg = data instanceof Uint8Array ? data : new Uint8Array(data);
    const bitLen = msg.length * 8;
    const rem = msg.length % 64;
    const padLen = rem >= 56 ? 128 - rem : 64 - rem;
    const padded = new Uint8Array(msg.length + padLen);
    padded.set(msg);
    padded[msg.length] = 0x80;
    const pv = new DataView(padded.buffer);
    pv.setUint32(padded.length - 8, 0, false);
    pv.setUint32(padded.length - 4, bitLen >>> 0, false);

    const V = SM3_IV.slice();
    const W = new Uint32Array(68);
    const Wp = new Uint32Array(64);
    for (let off = 0; off < padded.length; off += 64) {
      for (let t = 0; t < 16; t++) {
        const i = off + t * 4;
        W[t] =
          ((padded[i] << 24) |
            (padded[i + 1] << 16) |
            (padded[i + 2] << 8) |
            padded[i + 3]) >>>
          0;
      }
      for (let t = 16; t < 68; t++) {
        W[t] =
          (sm3P1(W[t - 16] ^ W[t - 9] ^ sm3Rotl(W[t - 3], 15)) ^
            sm3Rotl(W[t - 13], 7) ^
            W[t - 6]) >>>
          0;
      }
      for (let t = 0; t < 64; t++) Wp[t] = (W[t] ^ W[t + 4]) >>> 0;

      let a = V[0],
        b = V[1],
        c = V[2],
        d = V[3];
      let e = V[4],
        f = V[5],
        g = V[6],
        h = V[7];
      for (let t = 0; t < 64; t++) {
        const T = t < 16 ? 0x79cc4519 : 0x7a879d8a;
        const ss1 = sm3Rotl((sm3Rotl(a, 12) + e + sm3Rotl(T, t)) >>> 0, 7);
        const ss2 = (ss1 ^ sm3Rotl(a, 12)) >>> 0;
        const tt1 = (sm3FF(a, b, c, t) + d + ss2 + Wp[t]) >>> 0;
        const tt2 = (sm3GG(e, f, g, t) + h + ss1 + W[t]) >>> 0;
        d = c;
        c = sm3Rotl(b, 9);
        b = a;
        a = tt1;
        h = g;
        g = sm3Rotl(f, 19);
        f = e;
        e = sm3P0(tt2);
      }
      V[0] = (V[0] ^ a) >>> 0;
      V[1] = (V[1] ^ b) >>> 0;
      V[2] = (V[2] ^ c) >>> 0;
      V[3] = (V[3] ^ d) >>> 0;
      V[4] = (V[4] ^ e) >>> 0;
      V[5] = (V[5] ^ f) >>> 0;
      V[6] = (V[6] ^ g) >>> 0;
      V[7] = (V[7] ^ h) >>> 0;
    }
    const out = new Uint8Array(32);
    const ov = new DataView(out.buffer);
    for (let t = 0; t < 8; t++) ov.setUint32(t * 4, V[t], false);
    return out;
  }

  // ==================== 哈希算法 ====================
  async function hashBytes(data, checkMethod) {
    const cm = String(checkMethod || "").toLowerCase();
    if (/sm3|\.401/.test(cm)) return sm3Hash(data);
    let alg = null;
    if (cm.indexOf("sha-256") >= 0 || cm.indexOf("sha256") >= 0)
      alg = "SHA-256";
    else if (cm.indexOf("sha-1") >= 0 || cm.indexOf("sha1") >= 0) alg = "SHA-1";
    else if (cm.indexOf("sha-384") >= 0 || cm.indexOf("sha384") >= 0)
      alg = "SHA-384";
    else if (cm.indexOf("sha-512") >= 0 || cm.indexOf("sha512") >= 0)
      alg = "SHA-512";
    if (!alg) throw new Error("不支持的摘要算法: " + (checkMethod || "未知"));
    const buf = await crypto.subtle.digest(alg, data);
    return new Uint8Array(buf);
  }

  // ==================== ASN.1 / 电子印章 ====================
  function extractSealPicture(bytes) {
    if (!bytes || bytes.length < 10) return null;
    const targets = [
      { type: "ofd", bytes: [0x6f, 0x66, 0x64] }, // "ofd"
      { type: "png", bytes: [0x70, 0x6e, 0x67] }, // "png"
    ];
    for (const target of targets) {
      for (let i = 0; i < bytes.length - target.bytes.length; i++) {
        let match = true;
        for (let j = 0; j < target.bytes.length; j++) {
          if (bytes[i + j] !== target.bytes[j]) {
            match = false;
            break;
          }
        }
        if (!match) continue;
        let strTagOffset = -1;
        let strContentStart = -1;
        let strContentLen = -1;
        if (
          i >= 2 &&
          (bytes[i - 2] === 0x0c || bytes[i - 2] === 0x16) &&
          bytes[i - 1] === target.bytes.length
        ) {
          strTagOffset = i - 2;
          strContentStart = i;
          strContentLen = target.bytes.length;
        }
        if (
          strTagOffset < 0 &&
          i >= 4 &&
          (bytes[i - 4] === 0x0c || bytes[i - 4] === 0x16) &&
          bytes[i - 3] === 0x82
        ) {
          const len = (bytes[i - 2] << 8) | bytes[i - 1];
          if (len === target.bytes.length) {
            strTagOffset = i - 4;
            strContentStart = i;
            strContentLen = target.bytes.length;
          }
        }
        if (strTagOffset < 0) continue;

        let octOffset = strContentStart + strContentLen;
        while (octOffset < bytes.length && bytes[octOffset] !== 0x04)
          octOffset++;
        if (octOffset >= bytes.length) continue;

        octOffset++;
        let octLen, octHeaderLen;
        if (bytes[octOffset] < 0x80) {
          octLen = bytes[octOffset];
          octHeaderLen = 1;
        } else {
          const numBytes = bytes[octOffset] & 0x7f;
          if (numBytes < 1 || numBytes > 4) continue;
          octLen = 0;
          for (let j = 1; j <= numBytes; j++) {
            octLen = (octLen << 8) | bytes[octOffset + j];
          }
          octHeaderLen = 1 + numBytes;
        }
        const octDataStart = octOffset + octHeaderLen;
        if (octDataStart + octLen > bytes.length) continue;
        const octData = bytes.subarray(octDataStart, octDataStart + octLen);

        if (target.type === "ofd") {
          if (octData[0] === 0x50 && octData[1] === 0x4b) {
            return { type: "ofd", data: octData };
          }
        } else if (target.type === "png") {
          if (octData[0] === 0x89 && octData[1] === 0x50) {
            return { type: "png", data: octData };
          }
        }
      }
    }
    return extractSealImageFallback(bytes);
  }

  function extractSealImageFallback(bytes) {
    if (!bytes || bytes.length < 8) return null;
    // PNG
    for (let i = 0; i <= bytes.length - 8; i++) {
      if (
        bytes[i] === 0x89 &&
        bytes[i + 1] === 0x50 &&
        bytes[i + 2] === 0x4e &&
        bytes[i + 3] === 0x47
      ) {
        for (let j = bytes.length - 8; j >= i + 4; j--) {
          if (
            bytes[j] === 0x49 &&
            bytes[j + 1] === 0x45 &&
            bytes[j + 2] === 0x4e &&
            bytes[j + 3] === 0x44
          ) {
            return { type: "png", data: bytes.subarray(i, j + 8) };
          }
        }
      }
    }
    // JPEG
    for (let i = 0; i <= bytes.length - 4; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
        for (let j = bytes.length - 2; j >= i + 3; j--) {
          if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
            return { type: "jpeg", data: bytes.subarray(i, j + 2) };
          }
        }
      }
    }
    return null;
  }

  function extractSealName(bytes) {
    if (!bytes || bytes.length < 10) return null;
    let bestStr = null;
    let bestLen = 0;
    for (let i = 0; i < bytes.length - 3; i++) {
      if (bytes[i] !== 0x0c) continue;
      let lenByte = bytes[i + 1];
      let contentLen, headerLen;
      if (lenByte < 0x80) {
        contentLen = lenByte;
        headerLen = 1;
      } else {
        const numBytes = lenByte & 0x7f;
        if (numBytes < 1 || numBytes > 4) continue;
        contentLen = 0;
        for (let j = 1; j <= numBytes; j++) {
          contentLen = (contentLen << 8) | bytes[i + 1 + j];
        }
        headerLen = 1 + numBytes;
      }
      if (contentLen < 4 || contentLen > 500) continue;
      const contentStart = i + 1 + headerLen;
      if (contentStart + contentLen > bytes.length) continue;
      const strBytes = bytes.subarray(contentStart, contentStart + contentLen);
      try {
        const str = new TextDecoder("utf-8", { fatal: true }).decode(strBytes);
        if (/[\u4e00-\u9fff]/.test(str) && str.length > bestLen) {
          bestStr = str;
          bestLen = str.length;
        }
      } catch (e) {
        /* skip */
      }
    }
    return bestStr;
  }

  function asn1LenAt(bytes, p) {
    const lb = bytes[p];
    if (lb < 0x80) return { len: lb, next: p + 1 };
    const n = lb & 0x7f;
    let len = 0;
    for (let k = 1; k <= n; k++) len = (len << 8) | bytes[p + k];
    return { len, next: p + 1 + n };
  }

  function oidDotStr(raw) {
    if (!raw || !raw.length) return "";
    const first = raw[0];
    const parts = [String(Math.floor(first / 40)), String(first % 40)];
    let val = 0;
    for (let k = 1; k < raw.length; k++) {
      val = (val << 7) | (raw[k] & 0x7f);
      if (!(raw[k] & 0x80)) {
        parts.push(String(val));
        val = 0;
      }
    }
    return parts.join(".");
  }

  // DER 字符串/时间节点 → 文本（ascii 解码，失败回退空串）
  function decodeAscii(n) {
    try {
      return new TextDecoder("ascii").decode(n.content);
    } catch (e) {
      return "";
    }
  }

  function dirStrAt(bytes, p) {
    const tag = bytes[p];
    let t = asn1LenAt(bytes, p + 1);
    const raw = bytes.subarray(t.next, t.next + t.len);
    try {
      if (tag === 0x0c) return new TextDecoder("utf-8").decode(raw);
      if (tag === 0x13) return new TextDecoder("ascii").decode(raw);
      if (tag === 0x14) return new TextDecoder("latin1").decode(raw);
      if (tag === 0x1e) return new TextDecoder("utf-16be").decode(raw);
    } catch (e) {
      console.warn("[OFD] ASN.1 目录字符串解码失败", e);
    }
    return null;
  }

  function certSubjectAttrs(cert) {
    let p = 1;
    let t = asn1LenAt(cert, p);
    if (cert[t.next] === 0x30) {
      t = asn1LenAt(cert, t.next + 1);
    }
    p = t.next;
    if ((cert[p] & 0xe0) === 0xa0) {
      t = asn1LenAt(cert, p + 1);
      p = t.next + t.len;
    }
    if (cert[p] === 0x02) {
      t = asn1LenAt(cert, p + 1);
      p = t.next + t.len;
    }
    if (cert[p] === 0x30 || cert[p] === 0x06) {
      t = asn1LenAt(cert, p + 1);
      p = t.next + t.len;
    }
    if (cert[p] === 0x30) {
      t = asn1LenAt(cert, p + 1);
      p = t.next + t.len;
    }
    if (cert[p] === 0x30) {
      t = asn1LenAt(cert, p + 1);
      p = t.next + t.len;
    }
    if (cert[p] !== 0x30) return null;
    t = asn1LenAt(cert, p + 1);
    const end = t.next + t.len;
    let q = t.next;
    const attrs = [];
    while (q < end) {
      if (cert[q] !== 0x31) {
        q++;
        continue;
      } // RDN ::= SET
      const s = asn1LenAt(cert, q + 1);
      let r = s.next;
      const sEnd = s.next + s.len;
      while (r < sEnd) {
        if (cert[r] === 0x30) {
          const a = asn1LenAt(cert, r + 1);
          const aEnd = a.next + a.len;
          let m = a.next;
          if (cert[m] === 0x06) {
            const o = asn1LenAt(cert, m + 1);
            const oid = oidDotStr(cert.subarray(o.next, o.next + o.len));
            const v = dirStrAt(cert, o.next + o.len);
            if (v) attrs.push({ oid, value: v });
          }
          r = aEnd;
        } else r++;
      }
      q = sEnd;
    }
    return attrs;
  }

  function collectCerts(bytes) {
    const certs = [];
    const scan = (buf) => {
      let i = 0;
      const n = buf.length;
      while (i < n - 4) {
        if (buf[i] !== 0x30) {
          i++;
          continue;
        }
        const lb = buf[i + 1];
        let len, h;
        if (lb < 0x80) {
          len = lb;
          h = 2;
        } else if (lb === 0x81) {
          len = buf[i + 2];
          h = 3;
        } else if (lb === 0x82) {
          len = (buf[i + 2] << 8) | buf[i + 3];
          h = 4;
        } else {
          i++;
          continue;
        }
        if (
          len > 200 &&
          len < 20000 &&
          i + h + len <= n &&
          buf[i + h] === 0x30
        ) {
          certs.push(buf.subarray(i, i + h + len));
          i = i + h + len;
          continue;
        }
        i++;
      }
    };
    (function walkTLV(buf) {
      let i = 0;
      const n = buf.length;
      while (i < n) {
        const tag = buf[i];
        const t = asn1LenAt(buf, i + 1);
        if (!t.len && t.next <= i + 1) {
          i++;
          continue;
        }
        const start = t.next;
        const seg = buf.subarray(start, start + t.len);
        if (tag === 0x30 || tag === 0x31 || (tag & 0xe0) === 0xa0) walkTLV(seg);
        else if (tag === 0x04) scan(seg);
        i = start + t.len;
      }
    })(bytes);
    return certs;
  }

  function extractSignerName(bytes, sealName) {
    if (!bytes || bytes.length < 20) return null;
    let certs;
    try {
      certs = collectCerts(bytes);
    } catch (e) {
      return null;
    }
    const CN_OID = "2.5.4.3",
      O_OID = "2.5.4.10";
    for (const cert of certs) {
      let attrs;
      try {
        attrs = certSubjectAttrs(cert);
      } catch (e) {
        continue;
      }
      if (!attrs || !attrs.length) continue;
      const cn = attrs.find((a) => a.oid === CN_OID);
      const o = attrs.find((a) => a.oid === O_OID);
      const s = (cn && cn.value) || (o && o.value) || "";
      if (!s) continue;
      if (
        sealName &&
        (s === sealName || s.indexOf(sealName) >= 0 || sealName.indexOf(s) >= 0)
      )
        continue;
      if (/监制章/.test(s)) continue;
      return s;
    }
    return null;
  }

  function extractSignatureValue(bytes) {
    if (!bytes || bytes.length < 70) return "";
    for (let i = 0; i < bytes.length - 69; i++) {
      if (bytes[i] !== 0x30) continue;
      const len = bytes[i + 1];
      if (len < 0x40 || len > 0x48) continue;
      if (bytes[i + 2] !== 0x02 || bytes[i + 3] !== 0x20) continue;
      if (bytes[i + 36] !== 0x02 || bytes[i + 37] !== 0x20) continue;
      const total = 2 + len;
      if (i + total > bytes.length) continue;
      let hex = "";
      for (let j = i; j < i + total; j++)
        hex += ("0" + bytes[j].toString(16)).slice(-2);
      return hex.toUpperCase();
    }
    return "";
  }

  function parseTlvTree(data) {
    let pos = 0;
    function readLen() {
      const lb = data[pos++];
      if (lb < 0x80) return lb;
      const n = lb & 0x7f;
      if (n < 1 || n > 4) return 0;
      let l = 0;
      for (let i = 0; i < n; i++) l = (l << 8) | data[pos++];
      return l;
    }
    function readNode() {
      if (pos >= data.length) return null;
      const tag = data[pos++];
      const len = readLen();
      const start = pos;
      const content = data.subarray(start, start + len);
      const node = { tag, len, content, children: [], parent: null };
      const isContainer = tag === 0x30 || tag === 0x31 || (tag & 0xe0) === 0xa0;
      if (isContainer) {
        pos = start;
        const childEnd = start + len;
        while (pos < childEnd) {
          const child = readNode();
          if (!child) break;
          child.parent = node;
          node.children.push(child);
        }
        pos = childEnd;
      } else {
        pos = start + len;
      }
      return node;
    }
    return readNode();
  }

  function asn1IntToStr(content) {
    if (!content || !content.length) return "";
    let hex = "";
    for (let i = 0; i < content.length; i++)
      hex += ("0" + content[i].toString(16)).slice(-2);
    return BigInt("0x" + hex).toString();
  }

  function extractSealAttrs(bytes) {
    if (!bytes || bytes.length < 10) return null;
    let root = null;
    try {
      root = parseTlvTree(bytes);
    } catch (e) {
      return null;
    }
    if (!root) return null;

    // 单次遍历：同时查找 ElectronicSeal 结构 & 收集兜底数据
    let sealInfoSeq = null,
      sealSeqRef = null;
    const fallbackInts = [],
      fallbackGtimes = [];
    let fallbackNameNode = null,
      fallbackNameLen = 0;

    function isIa5(n, val) {
      return (
        n &&
        (n.tag === 0x16 || n.tag === 0x13) &&
        n.content &&
        (() => {
          try {
            return new TextDecoder("ascii").decode(n.content) === val;
          } catch (e) {
            return false;
          }
        })()
      );
    }
    function decodeUtf8(n) {
      try {
        return new TextDecoder("utf-8").decode(n.content);
      } catch (e) {
        return "";
      }
    }

    (function walk(node) {
      if (
        sealInfoSeq &&
        fallbackInts.length &&
        fallbackGtimes.length &&
        fallbackNameNode
      )
        return;
      if (!node.children) {
        // 叶子节点：收集兜底数据
        if (node.tag === 0x02) fallbackInts.push(node);
        else if (node.tag === 0x18 || node.tag === 0x17) {
          const s = decodeAscii(node);
          if (s) fallbackGtimes.push(s);
        } else if (node.tag === 0x0c) {
          const s = decodeUtf8(node);
          if (s && /[\u4e00-\u9fff]/.test(s) && s.length > fallbackNameLen) {
            fallbackNameNode = node;
            fallbackNameLen = s.length;
          }
        }
        return;
      }
      // 容器节点：尝试匹配 ElectronicSeal Header (SEQUENCE { "ES" INTEGER ... })
      if (
        node.tag === 0x30 &&
        node.children.length >= 3 &&
        isIa5(node.children[0], "ES") &&
        node.children[1].tag === 0x02
      ) {
        const sealSeq = node.parent;
        if (sealSeq && sealSeq.tag === 0x30 && sealSeq.children.length >= 3) {
          const candidate = sealSeq.children[2];
          if (
            candidate &&
            candidate.tag === 0x30 &&
            candidate.children &&
            candidate.children.length >= 2
          ) {
            sealInfoSeq = candidate;
            sealSeqRef = sealSeq;
          }
        }
      }
      for (const c of node.children) walk(c);
      // 递归解析 OCTET_STRING（某些签名将 ElectronicSeal 嵌套在其中）
      if (
        !sealInfoSeq &&
        node.tag === 0x04 &&
        node.content &&
        node.content.length > 10
      ) {
        try {
          const t = parseTlvTree(node.content);
          if (t) walk(t);
        } catch (e) {
          console.warn("[OFD] 电子印章 OCTET_STRING 嵌套解析失败", e);
        }
      }
    })(root);

    const attrs = {};

    if (sealInfoSeq) {
      // 从 ElectronicSeal 结构精确提取
      if (sealSeqRef && sealSeqRef.children.length >= 2) {
        const idNode = sealSeqRef.children[1];
        if (idNode && (idNode.tag === 0x16 || idNode.tag === 0x13))
          attrs.id = decodeAscii(idNode);
      }
      const ic = sealInfoSeq.children;
      if (ic.length >= 2) {
        if (ic[0].tag === 0x02) attrs.type = asn1IntToStr(ic[0].content);
        if (ic[1].tag === 0x0c) attrs.name = decodeUtf8(ic[1]);
      }
      const gtimes = ic.filter((c) => c.tag === 0x18).map(decodeAscii);
      if (gtimes.length) attrs.createTime = gtimes[0];
      if (gtimes.length > 1) attrs.notBefore = gtimes[1];
      if (gtimes.length > 2) attrs.notAfter = gtimes[2];
    }

    // 兜底：从全局遍历数据中补全缺失字段
    if (!attrs.id && fallbackInts.length)
      attrs.id = asn1IntToStr(fallbackInts[0].content);
    if (!attrs.name && fallbackNameNode) {
      attrs.name = decodeUtf8(fallbackNameNode);
      if (!attrs.type) {
        const container = fallbackNameNode.parent;
        if (container) {
          const intChild = container.children.find((c) => c.tag === 0x02);
          if (intChild) attrs.type = asn1IntToStr(intChild.content);
        }
      }
    }
    if (!attrs.createTime && fallbackGtimes.length)
      attrs.createTime = fallbackGtimes[0];
    if (!attrs.notBefore && fallbackGtimes.length > 1)
      attrs.notBefore = fallbackGtimes[1];
    if (!attrs.notAfter && fallbackGtimes.length > 2)
      attrs.notAfter = fallbackGtimes[2];

    return attrs;
  }

  function oidName(oid) {
    const map = {
      "1.2.156.10197.1.401": "SM3",
      "1.2.156.10197.1.501": "SM2-SM3（签名）",
      "1.2.156.10197.1.301": "SM2（公钥）",
      "1.2.156.10197.1.302": "SM2-SM3（签名）",
      "1.2.840.113549.1.1.1": "RSA",
      "1.2.840.113549.1.1.11": "SHA256-RSA",
      "1.2.840.113549.1.1.13": "SHA512-RSA",
      "2.16.840.1.101.3.4.2.1": "SHA-256",
      "1.3.14.3.2.26": "SHA-1",
    };
    return map[oid] || oid;
  }

  // ==================== 签名验证（仅文件摘要比对） ====================
  // 当前仅实现「文件摘要比对」：用签名中登记的 References[].CheckValue 与重新计算
  // 的摘要逐字节比对，用于检测文件内容是否被改动、受保护文件是否缺失。
  // 签名值验证、证书链验证、时间戳验证暂不实现（相关逻辑已移除，需要时再补）。
  // 注意：CheckValue 存放于 OFD 文件内部，改内容后可被同步重算，因此「摘要一致」
  // 只能说明文件自洽，不等同于签名真实有效。
  async function verifySignature(ofd, index) {
    const doc = ofd.document;
    const sig = doc.signatures && doc.signatures[index];
    if (!sig)
      return { valid: false, status: "unknown", message: "未找到该签名" };

    if (!sig.references || sig.references.length === 0) {
      return {
        valid: false,
        status: "unknown",
        message: "签名未包含摘要引用（References）数据，无法验证",
      };
    }

    const checked = [];
    const failed = [];
    for (const ref of sig.references) {
      if (!ref.fileRef || !ref.checkValue) continue;
      const data = await readEntry(ofd.zip, ref.fileRef.replace(/^\//, ""));
      if (!data) {
        failed.push(ref.fileRef + "（文件缺失）");
        continue;
      }
      let digest;
      try {
        digest = await hashBytes(data, sig.checkMethod);
      } catch (e) {
        return {
          valid: false,
          status: "unknown",
          message:
            "摘要算法暂不支持：" + (sig.checkMethod || "未知") + "，无法验证",
        };
      }
      const expected = base64ToBytes(ref.checkValue);
      if (digestMatches(digest, expected)) checked.push(ref.fileRef);
      else failed.push(ref.fileRef + "（摘要不一致）");
    }

    if (failed.length) {
      return {
        valid: false,
        status: "invalid",
        message: "验证失败：" + failed.join("；"),
        digestValid: false,
        checked: checked,
        failed: failed,
      };
    }
    if (!checked.length) {
      return {
        valid: false,
        status: "unknown",
        message: "没有可验证的摘要数据",
        digestValid: false,
        checked: checked,
        failed: failed,
      };
    }
    return {
      valid: true,
      status: "valid",
      message: "验证通过：" + checked.length + " 个文件摘要校验一致",
      digestValid: true,
      checked: checked,
      failed: failed,
    };
  }

  // ==================== OFD 资源解析 ====================
  function mergeRes(target, src) {
    Object.assign(target.fonts, src.fonts);
    Object.assign(target.colorSpaces, src.colorSpaces);
    Object.assign(target.multiMedias, src.multiMedias);
    Object.assign(target.drawParams, src.drawParams);
  }

  async function parseRes(resPath, zip) {
    const res = { fonts: {}, colorSpaces: {}, multiMedias: {}, drawParams: {} };
    const xmlText = await readEntryText(zip, resPath);
    if (!xmlText) return res;
    const root = parseXml(xmlText).documentElement;
    const baseLoc = attr(root, "BaseLoc") || "";
    const baseDir = baseLoc ? resolvePath(resPath, baseLoc) : dirOf(resPath);

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
    const csEl = child(root, "ColorSpaces");
    if (csEl)
      for (const c of children(csEl, "ColorSpace")) {
        res.colorSpaces[attr(c, "ID")] = {
          type: attr(c, "Type"),
          bits: attr(c, "BitsPerComponent"),
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
        const dp = { id: attr(d, "ID"), lineWidth: num(d, "LineWidth", null) };
        const sc = child(d, "StrokeColor");
        if (sc) dp.strokeColor = parseColor(sc);
        const fc = child(d, "FillColor");
        if (fc) dp.fillColor = parseColor(fc);
        res.drawParams[attr(d, "ID")] = dp;
      }
    return res;
  }

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

  // ==================== 签名解析 ====================
  async function parseSignatures(signaturesPath, zip) {
    const stamps = [];
    const signatures = [];
    const sigsXmlText = await readEntryText(zip, signaturesPath);
    if (!sigsXmlText) return { stamps, signatures };
    const sigsRoot = parseXml(sigsXmlText).documentElement;

    for (const sig of children(sigsRoot, "Signature")) {
      const sigBaseLoc = attr(sig, "BaseLoc");
      if (!sigBaseLoc) continue;
      const sigPath = resolvePath(signaturesPath, sigBaseLoc);
      const sigXmlText = await readEntryText(zip, sigPath);
      if (!sigXmlText) continue;
      const sigRoot = parseXml(sigXmlText).documentElement;
      const signedInfo = child(sigRoot, "SignedInfo");

      let provider = "";
      let providerVersion = "";
      let signTime = "";
      let checkMethod = "";
      let signatureMethod = "";
      const references = [];
      if (signedInfo) {
        const providerEl = child(signedInfo, "Provider");
        if (providerEl) {
          provider =
            attr(providerEl, "ProviderName") ||
            text(child(providerEl, "ProviderName")) ||
            attr(providerEl, "Company") ||
            "";
          providerVersion = attr(providerEl, "Version") || "";
        }
        signatureMethod = text(child(signedInfo, "SignatureMethod")) || "";
        signTime = text(child(signedInfo, "SignatureDateTime")) || "";
        const refsEl = child(signedInfo, "References");
        if (refsEl) {
          checkMethod = attr(refsEl, "CheckMethod") || "";
          for (const ref of children(refsEl, "Reference")) {
            references.push({
              fileRef: attr(ref, "FileRef") || "",
              checkValue: text(child(ref, "CheckValue")) || "",
            });
          }
        }
      }

      let signatureDigest = "";
      const sigRaw = await readEntry(zip, sigPath);
      if (sigRaw) {
        try {
          const d = await hashBytes(sigRaw, "SM3");
          let hex = "";
          for (let i = 0; i < d.length; i++)
            hex += ("0" + d[i].toString(16)).slice(-2);
          signatureDigest = hex;
        } catch (e) {
          signatureDigest = "";
        }
      }

      let sealDataUrl = null;
      let sealOfd = null;
      const sealEl = signedInfo ? child(signedInfo, "Seal") : null;
      if (sealEl) {
        const sealBaseLoc = text(child(sealEl, "BaseLoc"));
        if (sealBaseLoc) {
          const sealPath = resolvePath(sigPath, sealBaseLoc);
          const sealBytes = await readEntry(zip, sealPath);
          if (sealBytes) {
            const pic = extractSealPicture(sealBytes);
            if (pic) {
              if (pic.type === "png") {
                sealDataUrl =
                  "data:image/png;base64," + bytesToBase64(pic.data);
              } else if (pic.type === "jpeg") {
                sealDataUrl =
                  "data:image/jpeg;base64," + bytesToBase64(pic.data);
              } else if (pic.type === "ofd") {
                sealOfd = await parseSealOfd(pic.data);
              }
            }
          }
        }
      }

      let signedValuePath = "";
      let svBytes = null;
      const signedValue = child(sigRoot, "SignedValue");
      if (signedValue) {
        signedValuePath = text(signedValue);
        if (signedValuePath)
          svBytes = await readEntry(zip, resolvePath(sigPath, signedValuePath));
      }

      if (!sealDataUrl && !sealOfd && svBytes) {
        const pic = extractSealPicture(svBytes);
        if (pic) {
          if (pic.type === "png") {
            sealDataUrl = "data:image/png;base64," + bytesToBase64(pic.data);
          } else if (pic.type === "jpeg") {
            sealDataUrl = "data:image/jpeg;base64," + bytesToBase64(pic.data);
          } else if (pic.type === "ofd") {
            sealOfd = await parseSealOfd(pic.data);
          }
        }
      }
      let sealName = null;
      let signerName = null;
      if (svBytes) {
        sealName = extractSealName(svBytes);
        signerName = extractSignerName(svBytes, sealName);
      }
      const signatureValueHex = svBytes ? extractSignatureValue(svBytes) : "";

      // 回退提取签章时间和签名方法：某些 OFD 文件将签章时间存储在 SignedValue 的
      // CMS SignerInfo 的 OCTET_STRING 中（格式 "YYYYMMDDHHMMSSZ"），
      // 签名算法以 OID 存储而非 XML SignatureMethod 元素。
      // 单次解析 + 单次遍历同时查找两者。
      if ((!signTime || !signatureMethod) && svBytes) {
        try {
          const svTree = parseTlvTree(svBytes);
          const tsRe = /^\d{14}Z$/;
          const signAlgRe =
            /^(1\.2\.156\.10197\.1\.501|1\.2\.840\.113549\.1\.1\.\d+|1\.2\.840\.10045\.4\.3)$/;
          (function find(node) {
            if ((!signTime || !signatureMethod) && node.children) {
              for (const c of node.children) find(c);
            }
            if (!signTime && (node.tag === 0x17 || node.tag === 0x18)) {
              const s = decodeAscii(node);
              if (tsRe.test(s)) signTime = s;
            }
            if (
              !signTime &&
              node.tag === 0x04 &&
              node.content &&
              node.content.length >= 14 &&
              node.content.length <= 20
            ) {
              const s = decodeAscii(node);
              if (tsRe.test(s.trim())) signTime = s.trim();
            }
            if (!signatureMethod && node.tag === 0x06) {
              const oid = oidDotStr(node.content);
              if (signAlgRe.test(oid)) signatureMethod = oid;
            }
          })(svTree);
          // 递归进入 OCTET_STRING（签名时间可能嵌套其中）
          if (!signTime || !signatureMethod) {
            (function findInOctets(node) {
              if ((!signTime || !signatureMethod) && node.children) {
                for (const c of node.children) findInOctets(c);
              }
              if (
                node.tag === 0x04 &&
                node.content &&
                node.content.length > 10
              ) {
                try {
                  const inner = parseTlvTree(node.content);
                  if (inner) find(inner);
                } catch (e) {
                  console.warn("[OFD] 签名 SignedValue 嵌套解析失败", e);
                }
              }
            })(svTree);
          }
        } catch (e) {
          /* 签名值解析失败不影响整体 */
        }
      }

      const pageRefs = [];
      const positions = [];
      if (signedInfo) {
        for (const sa of children(signedInfo, "StampAnnot")) {
          const pageRef = attr(sa, "PageRef");
          const boundary = parseBox(attr(sa, "Boundary"));
          const clip = attr(sa, "Clip") ? parseBox(attr(sa, "Clip")) : null;
          stamps.push({
            pageRef,
            boundary,
            clip,
            sealDataUrl,
            sealName,
            sealOfd,
          });
          if (pageRef && pageRefs.indexOf(pageRef) < 0) pageRefs.push(pageRef);
          if (pageRef && boundary) positions.push({ pageRef, boundary });
        }
      }

      const sealAttrs = svBytes ? extractSealAttrs(svBytes) : null;

      signatures.push({
        id: attr(sig, "ID") || "",
        signer: signerName || sealName || provider || "",
        signTime,
        provider,
        providerVersion,
        checkMethod,
        signatureMethod,
        sealDataUrl,
        sealOfd,
        pages: pageRefs,
        positions,
        references,
        signedValuePath,
        signedValueSize: svBytes ? svBytes.length : 0,
        signaturePath: "/" + sigPath,
        signatureDigest,
        signatureValueHex,
        sealAttrs,
        hasSignedValue: !!(svBytes && svBytes.length),
      });
    }
    return { stamps, signatures };
  }

  // ==================== 目录解析 ====================
  function parseOutline(outlinesEl, pages) {
    if (!outlinesEl) return [];

    function collectChildItems(parent) {
      let items = children(parent, "OutlineElem");
      if (items.length) return items;
      return children(parent, "OutlineItem");
    }

    const pageMap = new Map();
    pages.forEach((p, idx) => {
      pageMap.set(String(p.id || ""), idx);
    });
    function resolvePageIndex(id) {
      if (id == null || id === "") return null;
      const s = String(id);
      if (pageMap.has(s)) return pageMap.get(s);
      const n = Number(s);
      if (isFinite(n) && n >= 1 && n <= pages.length) return Math.floor(n) - 1;
      for (const [k, v] of pageMap) {
        if (k.toLowerCase() === s.toLowerCase()) return v;
      }
      return null;
    }

    function extractDest(item) {
      let pageId =
        attr(item, "PageID") ||
        attr(item, "BookmarkPageID") ||
        attr(item, "PageRef") ||
        attr(item, "DestPage");
      let x = null,
        y = null;
      const actions = child(item, "Actions");
      if (actions) {
        for (const action of children(actions, "Action")) {
          const goto = child(action, "Goto");
          if (!goto) continue;
          const dest = child(goto, "Dest");
          if (dest) {
            const pid = attr(dest, "PageID");
            if (pid) pageId = pid;
            const dx = attr(dest, "Left");
            const dy = attr(dest, "Top");
            if (dx != null && dx !== "") x = parseFloat(dx);
            if (dy != null && dy !== "") y = parseFloat(dy);
          }
        }
      }
      return { pageId, x, y };
    }

    function extractItems(items) {
      const result = [];
      for (const item of items) {
        let title = attr(item, "Title");
        if (title == null || title === "") title = text(child(item, "Title"));
        if (!title) title = attr(item, "Name") || "(无标题)";

        const { pageId, x, y } = extractDest(item);
        const pageIndex = resolvePageIndex(pageId);

        const out = {
          title: title,
          page: pageIndex,
          dest: x != null && y != null ? { x, y } : null,
          children: [],
        };

        const subItems = collectChildItems(item);
        if (subItems.length) {
          out.children = extractItems(subItems);
        }
        result.push(out);
      }
      return result;
    }

    return extractItems(collectChildItems(outlinesEl));
  }

  function parseOutlineFromXml(xmlText, pages) {
    const root = parseXml(xmlText).documentElement;
    const outlinesEl = child(root, "Outlines");
    return parseOutline(outlinesEl || root, pages);
  }

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

  // ==================== SVG 渲染 ====================
  const FONT_VARIANT_SUFFIX = [
    "BoldItalic",
    "Bold",
    "Italic",
    "Black",
    "Heavy",
    "ExtraBold",
    "SemiBold",
    "DemiBold",
    "Medium",
    "Regular",
    "Book",
    "Light",
  ];
  const FONT_VARIANT_RE = new RegExp(
    "^(.*?)[-\\s]+(" + FONT_VARIANT_SUFFIX.join("|") + ")$",
    "i",
  );
  const FONT_WEIGHT_MAP = {
    bold: "700",
    black: "900",
    heavy: "900",
    extrabold: "800",
    semibold: "600",
    demibold: "600",
    medium: "500",
    light: "300",
    regular: "normal",
    book: "normal",
  };
  function splitFontVariant(fontName) {
    if (!fontName) return { base: fontName, weight: "", style: "" };
    const m = fontName.match(FONT_VARIANT_RE);
    if (!m) return { base: fontName, weight: "", style: "" };
    const suf = m[2].toLowerCase();
    return {
      base: m[1],
      weight: FONT_WEIGHT_MAP[suf] || "",
      style: suf === "italic" || suf === "bolditalic" ? "italic" : "normal",
    };
  }

  function cssFontName(name) {
    return String(name).replace(/["\\]/g, "");
  }

  // 精确字体名匹配表（模块级常量，避免每次调用重建正则）
  const BUILTIN_FONT_EXACT = [
    [/dengxian|等线/, '"DengXian","等线",sans-serif'],
    [/yahei|微软雅黑/, '"Microsoft YaHei","微软雅黑",sans-serif'],
    [/pingfang|苹方/, '"PingFang SC","苹方",sans-serif'],
    [
      /source han sans|sourcehansans|noto sans|notosans|思源黑体|鸿蒙|harmonyos/,
      '"Source Han Sans SC","Noto Sans CJK SC","HarmonyOS Sans SC","思源黑体",sans-serif',
    ],
    [
      /source han serif|sourcehanserif|noto serif|notoserif|思源宋体/,
      '"Source Han Serif SC","Noto Serif CJK SC","思源宋体",serif',
    ],
  ];

  function builtinFontStack(fontName) {
    if (!fontName) return "sans-serif";
    const n = fontName.toLowerCase();
    for (let i = 0; i < BUILTIN_FONT_EXACT.length; i++) {
      if (BUILTIN_FONT_EXACT[i][0].test(n)) return BUILTIN_FONT_EXACT[i][1];
    }
    if (fontName.includes("仿") || n === "fangsong" || n.includes("fang"))
      return '"仿宋",FangSong,"STFangsong",serif';
    if (fontName.includes("宋") || n === "simsun" || n.includes("song"))
      return '"宋体",SimSun,"Songti SC",serif';
    if (fontName.includes("楷") || n === "kaiti" || n.includes("kai"))
      return '"楷体",KaiTi,"STKaiti",serif';
    if (fontName.includes("黑") || n === "simhei" || n.includes("hei"))
      return '"黑体",SimHei,"Heiti SC",sans-serif';
    if (fontName.includes("隶")) return '"隶书","LiSu",serif';
    if (fontName.includes("行")) return '"行楷","Xingkai SC",cursive';
    if (n.includes("courier")) return '"Courier New",Courier,monospace';
    if (n.includes("times")) return '"Times New Roman",serif';
    if (n.includes("arial") || n.includes("helvetica"))
      return "Arial,Helvetica,sans-serif";
    return null;
  }

  const localFontCache = new Map();
  function localFontAvailable(fontName) {
    if (
      !fontName ||
      typeof document === "undefined" ||
      !document.fonts ||
      !document.fonts.check
    )
      return false;
    if (localFontCache.has(fontName)) return localFontCache.get(fontName);
    let ok = false;
    try {
      ok = document.fonts.check('16px "' + cssFontName(fontName) + '"');
    } catch (e) {
      console.warn("[OFD] 检查本地字体可用性失败", e);
    }
    localFontCache.set(fontName, ok);
    return ok;
  }

  function mapFontFamily(fontName) {
    const v = splitFontVariant(fontName);
    const base = v.base || fontName;
    let family = builtinFontStack(base) || builtinFontStack(fontName);
    if (!family && localFontAvailable(base))
      family = '"' + cssFontName(base) + '",sans-serif';
    if (!family) {
      ensureFontLoaded(base);
      if (base !== fontName) ensureFontLoaded(fontName);
      family = '"' + cssFontName(base) + '",sans-serif';
    }
    return { family, weight: v.weight, style: v.style };
  }

  // ==================== 字体加载 ====================
  let fontBase = "";
  const FONT_EXTS = ["ttf", "otf", "woff2"];
  const fontLoadCache = new Map();
  const embeddedFontMap = new Map();

  function resolveFontBase() {
    if (fontBase) return fontBase;
    if (typeof document === "undefined") return "font/";
    const scripts = document.getElementsByTagName("script");
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src || "";
      if (/\/ofd\.js(\?|#|$)/.test(src)) {
        const dir = src.slice(0, src.lastIndexOf("/") + 1);
        fontBase = dir.replace(/[^/]*\/$/, "") + "font/";
        return fontBase;
      }
    }
    return "font/";
  }

  function ensureFontLoaded(fontName) {
    if (!fontName) return Promise.resolve(false);
    if (fontLoadCache.has(fontName)) return fontLoadCache.get(fontName);
    const p = loadFontFace(fontName).then(
      (ok) => ok,
      () => false,
    );
    fontLoadCache.set(fontName, p);
    return p;
  }

  async function loadFontFace(fontName) {
    if (
      typeof FontFace === "undefined" ||
      typeof document === "undefined" ||
      !document.fonts
    )
      return false;

    let emb = embeddedFontMap.get(fontName);
    if (!emb) {
      const lower = fontName.toLowerCase();
      for (const [k, v] of embeddedFontMap) {
        const kl = k.toLowerCase();
        if (
          kl === lower ||
          kl.startsWith(lower + "-") ||
          lower.startsWith(kl + "-")
        ) {
          emb = v;
          break;
        }
      }
    }
    if (emb && emb._zip && emb.fontFile) {
      try {
        const fontPath = resolvePath(emb.baseDir + "/_.x", emb.fontFile);
        const bytes = await readEntry(emb._zip, fontPath);
        if (bytes) {
          const face = new FontFace(fontName, bytes.buffer);
          await face.load();
          document.fonts.add(face);
          return true;
        }
      } catch (e) {
        console.warn("[OFD] 加载内嵌字体失败：" + fontName, e);
      }
    }

    const index = await fetchFontIndex();
    let loaded = false;
    if (index) {
      for (const ext of FONT_EXTS) {
        const file = fontName + "." + ext;
        if (index.indexOf(file) === -1) continue;
        const url =
          resolveFontBase() + encodeURIComponent(fontName) + "." + ext;
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const face = new FontFace(fontName, await res.arrayBuffer());
          await face.load();
          document.fonts.add(face);
          loaded = true;
          break;
        } catch (e) {
          console.warn("[OFD] 加载字体文件失败：" + url, e);
        }
      }
    }
    if (!loaded) {
      console.warn('[OFD] 未找到映射字体 "' + fontName + '"，已回退默认字体');
    }
    return loaded;
  }

  let fontIndexCache = null;
  function fetchFontIndex() {
    if (fontIndexCache) return fontIndexCache;
    fontIndexCache = fetch(resolveFontBase())
      .then((res) => {
        if (!res.ok) return null;
        return res.text();
      })
      .then((html) => {
        if (!html) return null;
        const names = [];
        const re = /href="([^"]+)"/g;
        let m;
        while ((m = re.exec(html)))
          names.push(decodeURIComponent(m[1].split(/[?#]/)[0]));
        return names;
      })
      .catch(() => null);
    return fontIndexCache;
  }

  function setFontBase(base) {
    fontBase = base || "";
  }

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

    const imgIds = new Set();
    const fontNames = new Set();
    for (const layer of layers) {
      for (const obj of layer.objects) {
        if (obj.type === "image") imgIds.add(obj.resourceId);
        if (obj.type === "text") {
          const f = doc.res.fonts[obj.fontId];
          if (f && f.fontName) fontNames.add(f.fontName);
        }
      }
    }

    const prefetchTasks = [];
    for (const id of imgIds) {
      const mm = doc.res.multiMedias[id];
      if (mm && !mm.dataUrl) prefetchTasks.push(ensureImageDataUrl(mm));
    }
    let needFontIndex = false;
    for (const name of fontNames) {
      const v = splitFontVariant(name);
      if (
        !builtinFontStack(v.base) &&
        !builtinFontStack(name) &&
        !localFontAvailable(v.base)
      ) {
        needFontIndex = true;
        prefetchTasks.push(ensureFontLoaded(v.base));
        if (v.base !== name) prefetchTasks.push(ensureFontLoaded(name));
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
          pages: pageNums,
          positions,
          sealImage,
        };
      }),
    );
  }

  // ==================== 公开 API ====================
  const OFD = {
    load,
    renderPage,
    renderPageToString,
    renderAll,
    getPageCount,
    getPageDimensions,
    getDocumentInfo,
    expandDelta,
    getSignatures,
    verifySignature,
    setProfiling: function (on) {
      _profiling = !!on;
      _marks = [];
      if (!on) _lastProfile = null;
    },
    getLastProfile: function () {
      return _lastProfile;
    },
    setFontBase: setFontBase,
    // 非稳定接口，仅为外部实际取用处保留（公共 API 见上方命名导出）：
    //   build/toPdf.js       → base64ToBytes, decodeEntities
    //   test/benchmark.html  → parsePage, readEntry, readEntryText, resolvePath,
    //                          parseXml, hashBytes
    // 需要调试其它内部函数时，请直接在源码中断点。
    _internals: {
      parsePage,
      readEntry,
      readEntryText,
      resolvePath,
      parseXml,
      hashBytes,
      base64ToBytes,
      decodeEntities,
    },
  };

  global.OFD = OFD;
  if (typeof module !== "undefined" && module.exports) module.exports = OFD;
})(typeof window !== "undefined" ? window : this);
