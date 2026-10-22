// 打包 OFD → PDF 模块：build/ofd2pdf/ofd2pdf.js + build/ofd2pdf/ofd2pdf.min.js
// 用法：node build/build-ofd2pdf.js
const path = require("path");
const { ROOT, BUILD, VERSION, crlf, esbuildBuild, minify, writeArtifact } = require("./common");

const OUT_DIR = path.join(BUILD, "ofd2pdf");
const OUT = path.join(OUT_DIR, "ofd2pdf.js");
const OUT_MIN = path.join(OUT_DIR, "ofd2pdf.min.js");

const HEAD = `/*!
 * ofd2pdf.js v__OFD_VERSION__ — OFD → PDF 转换模块（演示级）
 * 逐页取 ofd.js 的 renderPageToString 输出，再映射为 PDF 内容流。
 * 运行时依赖同目录/同包的 ofd.js（浏览器取 globalThis.OFD，Node 由本文件收尾段注入）。
 */
`;

// Node 侧的依赖注入放在这里，而不是 ofd2pdf/ 源码里：
// 源码一旦出现 module / require，esbuild 会把那个模块判成 CommonJS 并套上假 module 壳，
// module.require 就落到内层、什么也取不到。这里才是真实文件作用域。
//
// 解析顺序覆盖三种放置方式：
//   ./ofd.js            旧发行 zip：build/ofd.min.js 与 build/ofd2pdf.js 平铺
//   ../ofd/ofd.js       仓库构建产物：build/ofd2pdf/ 与 build/ofd/ 同级
//   ofd-core            npm 依赖式安装：ofd2pdf 声明 dependencies.ofd-core
const TAIL = `
if (typeof module !== "undefined" && module.exports) {
  if (!globalThis.__OFD2PDF_ZLIB__) {
    try { globalThis.__OFD2PDF_ZLIB__ = module.require("zlib"); } catch (e) {}
  }
  if (!globalThis.OFD) {
    try { module.require("./ofd.js"); } catch (e) {}
  }
  if (!globalThis.OFD) {
    try { module.require("../ofd/ofd.js"); } catch (e) {}
  }
  if (!globalThis.OFD) {
    try { module.require("ofd-core"); } catch (e) {}
  }
  module.exports = globalThis.TOPDF;
}
`;

async function build() {
  const bundled = await esbuildBuild(path.join(ROOT, "ofd2pdf", "index.js"));
  const code = crlf(HEAD + bundled + TAIL).replace(/__OFD_VERSION__/g, VERSION);

  writeArtifact(OUT, code);
  writeArtifact(OUT_MIN, await minify(code));
  return { OUT, OUT_MIN };
}

module.exports = { build, OUT_DIR, OUT, OUT_MIN };

if (require.main === module) {
  build().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}
