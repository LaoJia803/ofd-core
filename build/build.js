// 把 src/ 下的片段按顺序拼成 build/ofd.js，再压缩出 build/ofd.min.js
// 用法：node build/build.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

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
 * ofd.js v__OFD_VERSION__ — OFD 纯前端解析与 SVG 渲染引擎
 * 零依赖，ZIP 解压使用浏览器原生 DecompressionStream
 */
(function (global) {
  "use strict";

`;

const TAIL = `  OFD.version = "__OFD_VERSION__";
  global.OFD = OFD;
  if (typeof module !== "undefined" && module.exports) module.exports = OFD;
})(typeof window !== "undefined" ? window : this);
`;

const crlf = (s) => s.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");

function concat() {
  const parts = [crlf(HEAD)];
  // 第三方库片段排在自有代码之前，按文件名字母序（external/）
  // pdf.min.js 是 pdf.js 的 UMD 包，仅供 Node 端独立转换脚本 build/pdf2ofd.js 用
  // （pdf.js dist 目录里的 pdf.mjs 才是转换器实际加载的），
  // 不并入浏览器引擎产物，否则 155KB 会涨到近 2MB。
  const STANDALONE = ["pdf.min.js"];
  const extDir = path.join(ROOT, "external");
  const ext = fs.existsSync(extDir)
    ? fs.readdirSync(extDir).filter((f) => f.endsWith(".js") && !STANDALONE.includes(f)).sort()
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
  return parts.join("").replace(/__OFD_VERSION__/g, VERSION);
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

// ---- 最小 ZIP 打包器（零依赖：deflate + CRC32）----
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}
// entries: [{ name, data(Buffer) }] -> zip Buffer
function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const raw = e.data;
    const deflated = zlib.deflateRawSync(raw);
    const useStore = deflated.length >= raw.length;
    const comp = useStore ? raw : deflated;
    const method = useStore ? 0 : 8;
    const crc = crc32(raw);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // UTF-8 文件名标志
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(0, 10); // time
    lh.writeUInt16LE(0, 12); // date
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, comp);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);

    offset += lh.length + nameBuf.length + comp.length;
  }
  const localPart = Buffer.concat(locals);
  const centralPart = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralPart.length, 12);
  eocd.writeUInt32LE(localPart.length, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([localPart, centralPart, eocd]);
}
function walkFiles(dir, base) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? base + "/" + name : name;
    if (fs.statSync(full).isDirectory()) out.push(...walkFiles(full, rel));
    else out.push({ full, rel });
  }
  return out;
}
// 打包时对 web/ 文件做处理：移除「测试文件选择器」下拉框及其事件与默认测试文件，
// 使发行包不依赖仓库里的 test/ofdFile（源目录 web/ 不受影响）。
//
// 注意：下面这些 replace 一旦源文件改了写法就会**静默失配**（不报错、也不替换），
// 发行包就会残留指向 test/ofdFile 的死路径。所以每条都配了 mustReplace 断言，
// 失配时直接让构建失败 —— 宁可构建中断，也不要发一个坏包出去。
function distTransform(rel, buf) {
  const norm = rel.replace(/\\/g, "/");
  if (norm === "viewer.html") {
    return Buffer.from(
      buf
        .toString("utf8")
        .replace(/<!--\s*测试文件选择器\s*-->\s*<div class="file-selector">[\s\S]*?<\/div>\s*/m, "")
        .replace(/<div class="file-selector">[\s\S]*?<\/div>\s*/m, ""),
      "utf8",
    );
  }
  if (norm === "viewer.js") {
    let s = buf.toString("utf8");
    // mustReplace(re, label)：正则必须命中，否则抛错终止构建。
    // 命中后返回替换值；未命中即视为源码与本脚本脱节。
    const sub = (re, label, replacement) => {
      if (!re.test(s)) {
        throw new Error(
          `distTransform: viewer.js 的「${label}」替换失配。\n` +
            `  正则 ${re}\n` +
            `  源文件写法已变，请同步更新 build/build.js 的 distTransform()。\n` +
            `  不做断言的话会静默发一个仍指向 test/ofdFile 的坏包。`,
        );
      }
      return s.replace(re, replacement);
    };

    // 1) 去掉下拉框 change 事件（元素已从 html 移除，留着会因 els.fileSelect 为 null 报错）
    s = sub(
      /\/\/ 文件选择器（下拉框）\s*els\.fileSelect\.addEventListener\([\s\S]*?\}\);\s*/m,
      "文件选择器 change 事件",
      "",
    );
    // 2) 去掉默认测试文件路径，改为无 file 参数时不自动加载
    s = sub(
      /const url = params\.get\('file'\) \|\| '\.\.\/test\/ofdFile\/999\.ofd';/,
      "默认测试文件路径",
      "const url = params.get('file');",
    );
    s = sub(
      /state\.fileName = url\.split\('\/'\)\.pop\(\) \|\| '999\.ofd';\s*await openSource\(url, state\.fileName\);/,
      "无 file 参数时的自动加载",
      "if (url) {\n      state.fileName = url.split('/').pop() || 'document.ofd';\n      await openSource(url, state.fileName);\n    }",
    );
    return Buffer.from(s, "utf8");
  }
  return buf;
}

const FONT_README = [
  "外部字体目录 / External fonts",
  "",
  "引擎在 OFD 未内嵌某字体、且内置系统映射与本机同名字体都取不到时，",
  "会按「字体原始名.ttf|.otf|.woff2」从这个目录加载。",
  "默认目录由 ofd.min.js 的位置推断为 <根>/font/，把字体文件放进本目录即可，",
  "无需再调用 OFD.setFontBase()。若引擎被放在别处，可显式指定：",
  "  OFD.setFontBase('path/to/font/');",
  "",
  "When an OFD references a font that is not embedded and cannot be resolved via",
  "the built-in/system mapping, the engine fetches it as <originalName>.ttf|.otf|.woff2",
  "from this directory. It is auto-detected from the ofd.min.js location as <root>/font/,",
  "so no OFD.setFontBase() call is required.",
].join("\r\n");

// 在仓库根创建 font/ 目录（外部字体目录），空时写入说明占位，保证目录存在且随发行包带上
function ensureFontDir() {
  const fontDir = path.join(ROOT, "font");
  fs.mkdirSync(fontDir, { recursive: true });
  const readme = path.join(fontDir, "README.txt");
  if (!fs.existsSync(readme)) fs.writeFileSync(readme, FONT_README, "utf8");
  return fontDir;
}

function buildDist() {
  const version = VERSION;
  const zipName = `ofdjs-${version}-dist.zip`;
  const distDir = path.join(ROOT, "dist");
  fs.mkdirSync(distDir, { recursive: true });

  const entries = [];
  // build/：只放引擎产物 ofd.min.js 与 toPdf.js
  for (const f of ["ofd.min.js", "toPdf.js"]) {
    const p = path.join(ROOT, "build", f);
    if (!fs.existsSync(p)) throw new Error("缺少产物 build/" + f + "，请先构建");
    entries.push({ name: "build/" + f, data: fs.readFileSync(p) });
  }
  // web/：整个 web 目录内容（打包时剥离「测试文件选择器」，它引用 test/ofdFile，发行包里没有）
  const webDir = path.join(ROOT, "web");
  if (fs.existsSync(webDir)) {
    for (const { full, rel } of walkFiles(webDir, "")) {
      entries.push({ name: "web/" + rel, data: distTransform(rel, fs.readFileSync(full)) });
    }
  }
  // 根目录 LICENSE
  const lic = path.join(ROOT, "LICENSE");
  if (fs.existsSync(lic)) entries.push({ name: "LICENSE", data: fs.readFileSync(lic) });
  // 根目录 font/：外部字体目录（引擎默认从 ofd.min.js 位置推断到 <root>/font/），随发行包带上
  const fontDir = path.join(ROOT, "font");
  if (fs.existsSync(fontDir)) {
    let added = 0;
    for (const { full, rel } of walkFiles(fontDir, "")) {
      entries.push({ name: "font/" + rel, data: fs.readFileSync(full) });
      added++;
    }
    if (!added) entries.push({ name: "font/README.txt", data: Buffer.from(FONT_README, "utf8") });
  }

  const zip = makeZip(entries);
  const outPath = path.join(distDir, zipName);
  fs.writeFileSync(outPath, zip);
  console.log(
    `dist/${zipName}  ${zip.length} 字节  ${entries.length} 个文件  md5 ` +
      crypto.createHash("md5").update(zip).digest("hex"),
  );
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

  ensureFontDir();
  buildDist();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
