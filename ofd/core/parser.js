import { stripNs } from "../shared/xml.js";

// ==================== XML 解析器 ====================
// 节点 { tag, attrs, children, text }，无 DOM 中间产物，浏览器/Node 通用
export function parseXml(str) {
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
export function decodeEntities(s) {
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
export function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => _xmlEscapeMap[c]);
}

// DeltaX/DeltaY: "v1 v2 ..." | "g N V ..."（g=重复N次取值V）
export function expandDelta(str) {
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

