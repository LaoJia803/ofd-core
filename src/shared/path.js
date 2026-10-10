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

