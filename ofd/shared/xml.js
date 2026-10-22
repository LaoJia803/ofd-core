// ==================== XML 节点工具 ====================
export function stripNs(tag) {
  const c = tag.indexOf(":");
  return c >= 0 ? tag.slice(c + 1) : tag;
}
export function child(parent, name) {
  if (!parent || !parent.children) return null;
  for (const c of parent.children) {
    if (stripNs(c.tag) === name) return c;
  }
  return null;
}
export function children(parent, name) {
  const out = [];
  if (!parent || !parent.children) return out;
  for (const c of parent.children) {
    if (stripNs(c.tag) === name) out.push(c);
  }
  return out;
}
export function text(node) {
  return node ? (node.text || "").trim() : "";
}
export function attr(el, name) {
  return el && el.attrs[name] != null ? el.attrs[name] : null;
}
export function num(el, name, dflt) {
  const v = attr(el, name);
  if (v === null || v === "") return dflt;
  const n = parseFloat(v);
  return isFinite(n) ? n : dflt;
}
export function bool(el, name, dflt) {
  const v = attr(el, name);
  if (v === null || v === "") return dflt;
  return v === "true" || v === "1";
}

export function parseBox(str) {
  if (!str) return { x: 0, y: 0, w: 0, h: 0 };
  const p = str.trim().split(/\s+/).map(Number);
  return { x: p[0] || 0, y: p[1] || 0, w: p[2] || 0, h: p[3] || 0 };
}
export function parseMatrix(str) {
  if (!str) return null;
  const p = str.trim().split(/\s+/).map(Number);
  return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] || 0, p[4] || 0, p[5] || 0];
}

