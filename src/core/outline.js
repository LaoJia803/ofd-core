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

