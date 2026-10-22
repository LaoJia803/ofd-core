// 组装 OFD 引擎 npm 包：dist/<版本号>/ofd/（包名 ofd-core，可直接 npm publish）
// 用法：node build/build-ofd-npm.js
const fs = require("fs");
const path = require("path");
const { ROOT, BUILD, DIST, VERSION, rmrf, walkFiles, md5 } = require("./common");

const OUT = path.join(DIST, VERSION, "ofd");

const PKG = {
  name: "ofd-core",
  version: VERSION,
  private: false,
  description: "OFD（GB/T 33190）解析与 SVG 渲染引擎，零运行时依赖，浏览器与 Node 通用",
  keywords: ["ofd", "svg", "renderer", "gbt33190", "版式文档", "电子公文"],
  license: "Apache-2.0",
  main: "lib/ofd.js",
  unpkg: "lib/ofd.min.js",
  files: ["lib", "README.md", "LICENSE"],
};

const README = `# ofd-core

OFD（GB/T 33190）解析与 SVG 渲染引擎。零运行时依赖，浏览器与 Node 通用。

## 浏览器

\`\`\`html
<script src="node_modules/ofd-core/lib/ofd.min.js"></script>
\`\`\`

加载后挂载全局对象 \`OFD\`。也可以直接用 CDN 指向 \`lib/ofd.min.js\`。

## Node

\`\`\`js
const OFD = require("ofd-core");
\`\`\`

## API

\`load\` / \`renderPage\` / \`renderPageToString\` / \`renderAll\` /
\`getPageCount\` / \`getPageDimensions\` / \`getDocumentInfo\` /
\`getSignatures\` / \`verifySignature\` / \`setFontBase\` /
\`setProfiling\` / \`getLastProfile\`

外部字体：默认从 \`ofd.min.js\` 所在目录的上一级 \`font/\` 读取，
也可用 \`OFD.setFontBase("path/to/font/")\` 显式指定。

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

  const src = path.join(BUILD, "ofd", "ofd.js");
  const min = path.join(BUILD, "ofd", "ofd.min.js");
  if (!fs.existsSync(src) || !fs.existsSync(min)) {
    throw new Error("缺少 build/ofd/ofd.js 或 ofd.min.js，请先执行 node build/build-ofd.js");
  }

  write("lib/ofd.js", fs.readFileSync(src));
  write("lib/ofd.min.js", fs.readFileSync(min));
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
  console.log(`组装完成: dist/${VERSION}/ofd/  (package: ${PKG.name}@${PKG.version})`);
  for (const f of files) {
    const buf = fs.readFileSync(path.join(OUT, f));
    console.log("  " + f.padEnd(18) + String(buf.length).padStart(9) + " 字节  md5 " + md5(buf).slice(0, 12));
  }
  console.log("");
  console.log(`发布：cd dist/${VERSION}/ofd && npm publish --access public`);
}

try {
  main();
} catch (e) {
  console.error("打包失败: " + (e && e.message ? e.message : e));
  process.exit(1);
}
