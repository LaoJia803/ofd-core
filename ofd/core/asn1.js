import { certSubjectAttrs, collectCerts, decodeAscii } from "./seal.js";
import { child } from "../shared/xml.js";

export function extractSignerName(bytes, sealName) {
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

export function extractSignatureValue(bytes) {
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

export function parseTlvTree(data) {
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
    const nodeOff = pos;
    const tag = data[pos++];
    const len = readLen();
    const start = pos;
    const content = data.subarray(start, start + len);
    const node = {
      tag,
      len,
      content,
      children: [],
      parent: null,
      off: nodeOff,
      derLen: start - nodeOff + len,
    };
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

// X.509 证书有效期：TBSCertificate 里唯一「恰好两个时间子节点」的 SEQUENCE
export function extractCertValidity(derBytes) {
  let found = null;
  (function walk(node) {
    if (!node || found) return;
    if (
      node.tag === 0x30 &&
      node.children.length === 2 &&
      node.children.every((c) => c.tag === 0x17 || c.tag === 0x18)
    ) {
      found = node.children.map(decodeAscii);
      return;
    }
    for (const c of node.children) walk(c);
  })(parseTlvTree(derBytes));
  return found ? { notBefore: found[0], notAfter: found[1] } : null;
}

// ASN.1 时间 / OFD 签章时间 → Unix 毫秒（UTC）
// 兼容 UTCTime(YYMMDDHHMMSSZ)、GeneralizedTime(YYYYMMDDHHMMSSZ) 与 "2020-08-17T11:13:29"
// GB/T 38540 SES 签名块：父 SEQUENCE 的子节点形如
//   [待签数据 SEQUENCE, 证书 OCTET STRING, 算法 OID, 签名值 BIT STRING]
// 返回的节点仍指向原字节（tbs.off / derLen 用于切出原始 DER，签名不可重新编码）
export function parseSesSignBlocks(data) {
  const out = [];
  (function walk(node) {
    if (!node) return;
    const ch = node.children;
    for (let k = 2; k < ch.length - 1; k++) {
      if (
        ch[k].tag === 0x06 &&
        ch[k + 1].tag === 0x03 &&
        ch[k - 1].tag === 0x04 &&
        (ch[k - 2].tag === 0x30 || ch[k - 2].tag === 0x31)
      ) {
        out.push({ tbs: ch[k - 2], cert: ch[k - 1], alg: ch[k], sig: ch[k + 1] });
      }
    }
    for (const c of ch) walk(c);
  })(parseTlvTree(data));
  return out;
}

// 证书 SubjectPublicKeyInfo → SM2 未压缩公钥点（130 位 hex，含 04 前缀）
export function extractCertPublicKey(derBytes) {
  const root = parseTlvTree(derBytes);
  const tbs = root && root.children[0];
  if (!tbs) return "";
  for (const c of tbs.children) {
    if (c.tag !== 0x30 || c.children.length < 2) continue;
    const algId = c.children[0];
    const bits = c.children[1];
    if (algId.tag !== 0x30 || bits.tag !== 0x03) continue;
    if (bits.len !== 66 && bits.len !== 65) continue;
    const skip = bits.len === 66 ? 1 : 0; // 66 = 1 字节 unusedBits + 65 字节点
    const pt = bits.content.subarray(skip, skip + 65);
    if (pt.length === 65 && pt[0] === 0x04) {
      let hex = "";
      for (let i = 0; i < pt.length; i++) hex += ("0" + pt[i].toString(16)).slice(-2);
      return hex;
    }
  }
  return "";
}

export function asn1TimeToMs(str) {
  const d = String(str || "").replace(/[^0-9]/g, "");
  if (d.length < 10) return NaN;
  const short = d.length <= 12; // UTCTime 的两位年
  const yy = Number(d.slice(0, short ? 2 : 4));
  const year = short ? (yy < 50 ? 2000 + yy : 1900 + yy) : yy;
  const off = short ? 2 : 4;
  const month = Number(d.slice(off, off + 2)) - 1;
  const day = Number(d.slice(off + 2, off + 4));
  const hour = Number(d.slice(off + 4, off + 6));
  const min = Number(d.slice(off + 6, off + 8));
  const sec = Number(d.slice(off + 8, off + 10)) || 0;
  if ([month, day, hour, min].some((v) => !isFinite(v))) return NaN;
  return Date.UTC(year, month, day, hour, min, sec);
}

function asn1IntToStr(content) {
  if (!content || !content.length) return "";
  let hex = "";
  for (let i = 0; i < content.length; i++)
    hex += ("0" + content[i].toString(16)).slice(-2);
  return BigInt("0x" + hex).toString();
}

export function extractSealAttrs(bytes) {
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

export function oidName(oid) {
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

