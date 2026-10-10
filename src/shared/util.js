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

