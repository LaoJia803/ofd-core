// ==================== ASN.1 / 电子印章 ====================
export function extractSealPicture(bytes) {
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

export function extractSealName(bytes) {
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

export function oidDotStr(raw) {
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
export function decodeAscii(n) {
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

export function certSubjectAttrs(cert) {
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

export function collectCerts(bytes) {
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

