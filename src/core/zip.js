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

