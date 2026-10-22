// 打包 PDF → OFD 转换器：build/pdf2ofd/pdf2ofd.js + build/pdf2ofd/pdf2ofd.min.js
// 用法：node build/build-pdf2ofd.js
const path = require("path");
const { ROOT, BUILD, VERSION, crlf, esbuildBuild, minify, writeArtifact } = require("./common");

const OUT_DIR = path.join(BUILD, "pdf2ofd");
const OUT = path.join(OUT_DIR, "pdf2ofd.js");
const OUT_MIN = path.join(OUT_DIR, "pdf2ofd.min.js");

const HEAD = `/*!
 * pdf2ofd.js v__OFD_VERSION__ — PDF → OFD 转换器（Node 环境，beta）
 * 由 pdf2ofd/ 的 ESM 模块打包为 CommonJS；CLI 与 module.exports 均可用。
 * 仅供 Node：pdf.js 通过动态 import 从 pdfjs-dist 加载（peerDependency）。
 */
`;

// CLI 放在 bundle 之后而不是 ESM 源码里：源码中出现 require / module 会被 esbuild
// 当作 CommonJS 处理，且 ESM 本身没有 __dirname / require.main 这些概念。
const TAIL = `
// Node CLI 入口
if (require.main === module) {
  const [, , inp, outp] = process.argv;
  if (!inp) {
    console.error("用法: node build/pdf2ofd/pdf2ofd.js input.pdf [output.ofd]");
    process.exit(1);
  }
  module.exports.convert(inp, outp || inp.replace(/\\.pdf$/i, ".ofd")).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
`;

async function build() {
  const bundled = await esbuildBuild(path.join(ROOT, "pdf2ofd", "index.js"), {
    format: "cjs",
    platform: "node",
    // pdf.js 是 peerDependency，运行时按调用方环境解析，不能打进 bundle。
    external: ["pdfjs-dist", "pdfjs-dist/*"],
  });
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
