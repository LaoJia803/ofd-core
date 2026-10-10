// 把 src/ 下的片段按顺序拼成 build/ofd.js，再压缩出 build/ofd.min.js
// 用法：node build/build.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");

// 拼接顺序 = 原始 ofd.js 的行序，不能随意重排：
// shared/lru.js 的 class LRUCache 不提升，而 display/svg.js 顶层 `new LRUCache(...)` 在构造它。
const FILES = [
  "shared/util.js",
  "shared/xml.js",
  "shared/path.js",
  "shared/color.js",
  "core/parser.js",
  "shared/lru.js",
  "core/zip.js",
  "core/md.js",
  "core/seal.js",
  "core/asn1.js",
  "core/verify.js",
  "core/res.js",
  "core/image.js",
  "core/page.js",
  "core/signature.js",
  "core/outline.js",
  "core/annotation.js",
  "core/document.js",
  "display/font.js",
  "display/svg.js",
  "display/api.js",
  "index.js",
];

const HEAD = `/*!
 * ofd.js — OFD（GB/T 33190）纯前端解析与 SVG 渲染引擎
 * 零依赖，ZIP 解压使用浏览器原生 DecompressionStream
 */
(function (global) {
  "use strict";

`;

const TAIL = `  global.OFD = OFD;
  if (typeof module !== "undefined" && module.exports) module.exports = OFD;
})(typeof window !== "undefined" ? window : this);
`;

const crlf = (s) => s.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");

function concat() {
  const parts = [crlf(HEAD)];
  // 第三方库片段排在自有代码之前，按文件名字母序（external/，目前为空）
  const extDir = path.join(ROOT, "external");
  const ext = fs.existsSync(extDir)
    ? fs.readdirSync(extDir).filter((f) => f.endsWith(".js")).sort()
    : [];
  for (const f of ext) {
    parts.push(crlf(fs.readFileSync(path.join(extDir, f), "utf8")));
  }
  for (const f of FILES) {
    const p = path.join(SRC, f);
    if (!fs.existsSync(p)) throw new Error("缺少片段: " + f);
    parts.push(crlf(fs.readFileSync(p, "utf8")));
  }
  parts.push(crlf(TAIL));
  return parts.join("");
}

async function minify(code) {
  try {
    const terser = require("terser");
    const r = await terser.minify(code, {
      compress: true,
      mangle: true,
      ecma: 2020,
    });
    if (r.error) throw r.error;
    return r.code + "\n";
  } catch (e) {
    console.warn("  terser 不可用（" + e.message + "），改为保守压缩：只去注释和行首缩进");
    return code
      .replace(/\/\*[\s\S]*?\*\//g, (m) => (m.startsWith("/*!") ? m : ""))
      .replace(/^\s+/gm, "");
  }
}

async function main() {
  const outJs = path.join(ROOT, "build", "ofd.js");
  const outMin = path.join(ROOT, "build", "ofd.min.js");

  const code = concat();
  fs.writeFileSync(outJs, code, "utf8");
  console.log(
    "build/ofd.js     " + Buffer.byteLength(code) + " 字节  md5 " +
      crypto.createHash("md5").update(code).digest("hex"),
  );

  const min = await minify(code);
  fs.writeFileSync(outMin, min, "utf8");
  console.log(
    "build/ofd.min.js " + Buffer.byteLength(min) + " 字节  md5 " +
      crypto.createHash("md5").update(min).digest("hex"),
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
