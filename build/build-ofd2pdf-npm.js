// 组装 OFD → PDF npm 包：dist/<版本号>/ofd2pdf/（依赖式：dependencies.ofd-core）
// 用法：node build/build-ofd2pdf-npm.js
const fs = require("fs");
const path = require("path");
const { ROOT, BUILD, DIST, VERSION, rmrf, walkFiles, md5 } = require("./common");

const OUT = path.join(DIST, VERSION, "ofd2pdf");

const PKG = {
  name: "ofd2pdf",
  version: VERSION,
  private: false,
  description: "OFD → PDF 转换模块（演示级），依赖 ofd-core 的渲染能力",
  keywords: ["ofd", "pdf", "convert", "gbt33190", "版式文档", "电子公文"],
  license: "Apache-2.0",
  main: "lib/ofd2pdf.js",
  unpkg: "lib/ofd2pdf.min.js",
  files: ["lib", "README.md", "LICENSE"],
  dependencies: { "ofd-core": "^" + VERSION },
};

const README = `# ofd2pdf

OFD → PDF 转换模块（演示级）。复用 [ofd-core](https://www.npmjs.com/package/ofd-core)
的渲染能力，逐页把 SVG 映射为 PDF 内容流。

> beta：不保证与 OFD 原版逐像素一致，导出结果请人工核对。

## 安装

\`\`\`bash
npm install ofd2pdf ofd-core
\`\`\`

## 用法

\`\`\`js
const OFD = require("ofd-core");
const TOPDF = require("ofd2pdf");

const ofd = await OFD.load(data);          // data: ArrayBuffer / Uint8Array
const pdf = await TOPDF.ofdToPdf(ofd);     // → Uint8Array
\`\`\`

单页调试：\`TOPDF.svgToPdf(svgString, pageWmm, pageHmm, opts)\`。

## 浏览器

\`\`\`html
<script src="node_modules/ofd-core/lib/ofd.min.js"></script>
<script src="node_modules/ofd2pdf/lib/ofd2pdf.min.js"></script>
\`\`\`

加载后挂载全局对象 \`TOPDF\`。

## License

Apache-2.0
`;

function write(rel, content) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}

function main() {
  rmrf(OUT);

  const src = path.join(BUILD, "ofd2pdf", "ofd2pdf.js");
  const min = path.join(BUILD, "ofd2pdf", "ofd2pdf.min.js");
  if (!fs.existsSync(src) || !fs.existsSync(min)) {
    throw new Error("缺少 build/ofd2pdf/ofd2pdf.js 或 ofd2pdf.min.js，请先执行 node build/build-ofd2pdf.js");
  }

  write("lib/ofd2pdf.js", fs.readFileSync(src));
  write("lib/ofd2pdf.min.js", fs.readFileSync(min));
  write("README.md", README);
  const lic = path.join(ROOT, "LICENSE");
  if (fs.existsSync(lic)) write("LICENSE", fs.readFileSync(lic));
  write("package.json", JSON.stringify(PKG, null, 2) + "\n");

  printManifest();
}

function printManifest() {
  const files = [];
  for (const { rel } of walkFiles(OUT, "")) files.push(rel);
  files.sort();
  console.log(`组装完成: dist/${VERSION}/ofd2pdf/  (package: ${PKG.name}@${PKG.version})`);
  for (const f of files) {
    const buf = fs.readFileSync(path.join(OUT, f));
    console.log("  " + f.padEnd(18) + String(buf.length).padStart(9) + " 字节  md5 " + md5(buf).slice(0, 12));
  }
  console.log("");
  console.log(`发布：cd dist/${VERSION}/ofd2pdf && npm publish --access public`);
}

try {
  main();
} catch (e) {
  console.error("打包失败: " + (e && e.message ? e.message : e));
  process.exit(1);
}
