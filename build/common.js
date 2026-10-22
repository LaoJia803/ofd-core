// 构建公共层：路径常量、esbuild/terser、CRLF、最小 ZIP 打包、发行包改写。
// 各 build-*.js 只保留自己的 banner / 收尾段与产物清单。
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, "build");
const DIST = path.join(ROOT, "dist");
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

const crlf = (s) => s.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");

function md5(content) {
  return crypto.createHash("md5").update(content).digest("hex");
}

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

// 写产物并打印一行清单：相对路径、字节数、md5 前 12 位。
function writeArtifact(file, code) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, code, "utf8");
  console.log(
    "  " +
      path.relative(ROOT, file).replace(/\\/g, "/").padEnd(28) +
      String(Buffer.byteLength(code)).padStart(9) +
      " 字节  md5 " +
      md5(code).slice(0, 12),
  );
}

async function esbuildBuild(entry, opts) {
  let esbuild;
  try {
    esbuild = require("esbuild");
  } catch (e) {
    throw new Error("打包需要 esbuild（devDependency）。请先 npm install。\n  " + e.message);
  }
  const res = await esbuild.build(
    Object.assign(
      {
        entryPoints: [entry],
        bundle: true,
        format: "iife",
        target: "es2020",
        write: false,
        charset: "utf8",
        logLevel: "silent",
        // 公开接口由入口模块挂 globalThis、由收尾段挂 module.exports，
        // 所以这里不用 global-name —— 它会把产物变成「具名导出的集合」而不是 API 对象本身。
      },
      opts || {},
    ),
  );
  if (res.errors.length) throw new Error("esbuild: " + JSON.stringify(res.errors));
  return res.outputFiles[0].text;
}

async function minify(code) {
  try {
    const terser = require("terser");
    const r = await terser.minify(code, { compress: true, mangle: true, ecma: 2020 });
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

// 发行包改写：源文件写法一变，正则就会静默失配。
// 每条替换都断言命中，失配直接中断构建 —— 宁可构建失败，也不要发一个坏包。
function mustReplace(s, re, label, replacement, file) {
  if (!re.test(s)) {
    throw new Error(
      `distTransform: ${file} 的「${label}」替换失配。\n` +
        `  正则 ${re}\n` +
        `  源文件写法已变，请同步更新 build/common.js 的 distTransform()。\n` +
        `  不做断言的话会静默发一个指向错误路径的坏包。`,
    );
  }
  return s.replace(re, replacement);
}

// 打包时对 web/ 文件做处理：
//   viewer.html —— 移除「测试文件选择器」下拉框，并把子目录脚本路径改回旧的扁平布局
//   viewer.js   —— 移除下拉框事件与默认测试文件，使发行包不依赖 test/ofdFile
// 源目录 web/ 不受影响。
function distTransform(rel, buf) {
  const norm = rel.replace(/\\/g, "/");
  if (norm === "viewer.html") {
    let s = buf.toString("utf8");
    s = mustReplace(
      s,
      /<!--\s*测试文件选择器\s*-->\s*<div class="file-selector">[\s\S]*?<\/div>\s*/m,
      "测试文件选择器区块",
      "",
      norm,
    );
    // 发行 zip 内保持旧布局：build/ofd.min.js 与 build/ofd2pdf.js 平铺。
    s = mustReplace(
      s,
      /(<script[^>]+src=")\.\.\/build\/ofd\/ofd\.min\.js(\?[^"]*)?(")/,
      "引擎脚本路径",
      "$1../build/ofd.min.js$2$3",
      norm,
    );
    s = mustReplace(
      s,
      /(<script[^>]+src=")\.\.\/build\/ofd2pdf\/ofd2pdf\.js(\?[^"]*)?(")/,
      "ofd2pdf 脚本路径",
      "$1../build/ofd2pdf.js$2$3",
      norm,
    );
    return Buffer.from(s, "utf8");
  }
  if (norm === "viewer.js") {
    let s = buf.toString("utf8");
    // 1) 去掉下拉框 change 事件（元素已从 html 移除，留着会因 els.fileSelect 为 null 报错）
    s = mustReplace(
      s,
      /\/\/ 文件选择器（下拉框）\s*els\.fileSelect\.addEventListener\([\s\S]*?\}\);\s*/m,
      "文件选择器 change 事件",
      "",
      norm,
    );
    // 2) 去掉默认测试文件路径，改为无 file 参数时不自动加载
    s = mustReplace(
      s,
      /const url = params\.get\('file'\) \|\| '\.\.\/test\/ofdFile\/999\.ofd';/,
      "默认测试文件路径",
      "const url = params.get('file');",
      norm,
    );
    s = mustReplace(
      s,
      /state\.fileName = url\.split\('\/'\)\.pop\(\) \|\| '999\.ofd';\s*await openSource\(url, state\.fileName\);/,
      "无 file 参数时的自动加载",
      "if (url) {\n      state.fileName = url.split('/').pop() || 'document.ofd';\n      await openSource(url, state.fileName);\n    }",
      norm,
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

module.exports = {
  ROOT,
  BUILD,
  DIST,
  VERSION,
  crlf,
  md5,
  rmrf,
  writeArtifact,
  esbuildBuild,
  minify,
  makeZip,
  walkFiles,
  distTransform,
  ensureFontDir,
  FONT_README,
};
