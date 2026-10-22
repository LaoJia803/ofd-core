import { hashBytes } from "./core/md.js";
import { parsePage } from "./core/page.js";
import { decodeEntities, expandDelta, parseXml } from "./core/parser.js";
import { verifySignature } from "./core/verify.js";
import { base64ToBytes, readEntry, readEntryText } from "./core/zip.js";
import {
  getDocumentInfo,
  getPageCount,
  getPageDimensions,
  getSignatures,
  load,
  renderAll,
  renderPage,
  renderPageToString,
} from "./display/api.js";
import { setFontBase } from "./display/font.js";
import { resolvePath } from "./shared/path.js";
import { getLastProfile, setProfiling } from "./shared/util.js";

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
  setProfiling,
  getLastProfile,
  setFontBase: setFontBase,
  // 非稳定接口，仅为外部实际取用处保留（公共 API 见上方命名导出）：
  //   build/ofd2pdf/ofd2pdf.js → base64ToBytes, decodeEntities
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

// 只挂 globalThis，不碰 module/exports：源码里一旦出现 `module`，esbuild 会把入口判成
// CommonJS 并套一个假的 module 壳，赋值就落到内层、Node 侧 require 拿到空对象。
// CJS 桥接在 build/build-ofd.js 的 TAIL 里做（那里是真实的文件作用域）。
OFD.version = "__OFD_VERSION__";
globalThis.OFD = OFD;

