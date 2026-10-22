// 打包 OFD 引擎：build/ofd/ofd.js + build/ofd/ofd.min.js
// 用法：node build/build-ofd.js
const path = require("path");
const { ROOT, BUILD, VERSION, crlf, esbuildBuild, minify, writeArtifact } = require("./common");

const OUT_DIR = path.join(BUILD, "ofd");
const OUT = path.join(OUT_DIR, "ofd.js");
const OUT_MIN = path.join(OUT_DIR, "ofd.min.js");

const HEAD = `/*!
 * ofd.js v__OFD_VERSION__ — OFD 纯前端解析与 SVG 渲染引擎
 * 零依赖，ZIP 解压使用浏览器原生 DecompressionStream
 */
(function () {
  "use strict";

`;

const TAIL = `
  // Node 侧 require('./build/ofd/ofd.js') 走这条桥接；浏览器里 module 不存在，直接跳过。
  if (typeof module !== "undefined" && module.exports) module.exports = globalThis.OFD;
})();
`;

async function build() {
  const bundled = await esbuildBuild(path.join(ROOT, "ofd", "index.js"));
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
