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

