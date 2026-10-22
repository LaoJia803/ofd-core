import {
  extractCertValidity,
  extractSealAttrs,
  extractSignatureValue,
  extractSignerName,
  parseTlvTree,
} from "./asn1.js";
import { hashBytes } from "./md.js";
import { parseSealOfd } from "./page.js";
import { parseXml } from "./parser.js";
import {
  collectCerts,
  decodeAscii,
  extractSealName,
  extractSealPicture,
  oidDotStr,
} from "./seal.js";
import { bytesToBase64, readEntry, readEntryText } from "./zip.js";
import { resolvePath } from "../shared/path.js";
import {
  attr,
  child,
  children,
  parseBox,
  text,
} from "../shared/xml.js";

// ==================== 签名解析 ====================
export async function parseSignatures(signaturesPath, zip) {
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
    const certValidity = svBytes
      ? collectCerts(svBytes)
          .map(extractCertValidity)
          .filter(Boolean)
      : [];

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
      certValidity,
      hasSignedValue: !!(svBytes && svBytes.length),
    });
  }
  return { stamps, signatures };
}

