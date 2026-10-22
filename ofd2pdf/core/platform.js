// 环境层：浏览器取 globalThis.OFD，Node 侧由构建脚本的收尾段注入。
//
// 这里刻意不出现 module / require 字样：源码一旦被 esbuild 判成 CommonJS，整个入口会被
// 套进一个假的 module 壳，module.require 就落到内层、什么也拿不到。Node 的注入在
// build/build-ofd2pdf.js 的 TOPDF_TAIL 里做——那里才是真实文件作用域。
let core = null;
export function getCore() {
  if (core) return core;
  if (typeof globalThis !== "undefined" && globalThis.OFD) core = globalThis.OFD;
  return core;
}

export function nodeZlib() {
  if (typeof globalThis !== "undefined" && globalThis.__OFD2PDF_ZLIB__) return globalThis.__OFD2PDF_ZLIB__;
  return null;
}
