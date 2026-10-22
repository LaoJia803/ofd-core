// 打包 viewer 发行 zip：dist/<版本号>/ofdjs-<版本号>-dist.zip
// 会先执行 build-ofd.js 与 build-ofd2pdf.js，再按旧 zip 的扁平结构组装：
//   build/ofd.min.js、build/ofd2pdf.js、web/*（已剥离测试文件选择器）、LICENSE、font/*
// 用法：node build/build-viewer.js
const fs = require("fs");
const path = require("path");
const {
  ROOT,
  BUILD,
  DIST,
  VERSION,
  makeZip,
  walkFiles,
  distTransform,
  ensureFontDir,
  md5,
} = require("./common");
const ofdBuild = require("./build-ofd");
const ofd2pdfBuild = require("./build-ofd2pdf");

const ZIP_NAME = `ofdjs-${VERSION}-dist.zip`;

async function build() {
  await ofdBuild.build();
  await ofd2pdfBuild.build();

  const outDir = path.join(DIST, VERSION);
  fs.mkdirSync(outDir, { recursive: true });

  const entries = [
    // 发行 zip 保持旧布局：两个产物平铺在 build/ 下。
    { name: "build/ofd.min.js", data: fs.readFileSync(ofdBuild.OUT_MIN) },
    { name: "build/ofd2pdf.js", data: fs.readFileSync(ofd2pdfBuild.OUT) },
  ];

  // web/：整个目录，打包时改写 viewer.html / viewer.js（见 common.distTransform）
  const webDir = path.join(ROOT, "web");
  if (fs.existsSync(webDir)) {
    for (const { full, rel } of walkFiles(webDir, "")) {
      entries.push({ name: "web/" + rel, data: distTransform(rel, fs.readFileSync(full)) });
    }
  }

  const lic = path.join(ROOT, "LICENSE");
  if (fs.existsSync(lic)) entries.push({ name: "LICENSE", data: fs.readFileSync(lic) });

  // 根 font/：外部字体目录，随发行包带上（空时至少有 README.txt 占位）
  const fontDir = ensureFontDir();
  for (const { full, rel } of walkFiles(fontDir, "")) {
    entries.push({ name: "font/" + rel, data: fs.readFileSync(full) });
  }

  const zip = makeZip(entries);
  const outPath = path.join(outDir, ZIP_NAME);
  fs.writeFileSync(outPath, zip);
  console.log(
    `  dist/${VERSION}/${ZIP_NAME}  ${zip.length} 字节  ${entries.length} 个文件  md5 ` +
      md5(zip).slice(0, 12),
  );
  return { outPath, zip, entries };
}

module.exports = { build, ZIP_NAME };

if (require.main === module) {
  build().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}
