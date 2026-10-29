// 打包三个模块的产物 zip：dist/<版本号>/<模块>.zip
// 先执行对应模块的构建，再按 build/<模块>/ 的目录结构打进包内，解压即得同名文件夹。
// 产物 zip 只落在 dist/（已 gitignore），不再混进 build/ 目录。
// 用法：node build/build-zips.js
const fs = require("fs");
const path = require("path");
const { BUILD, DIST, VERSION, makeZip, md5 } = require("./common");

const MODULES = [
  { name: "ofd", script: "./build-ofd" },
  { name: "ofd2pdf", script: "./build-ofd2pdf" },
  { name: "pdf2ofd", script: "./build-pdf2ofd" },
];

async function build() {
  const outDir = path.join(DIST, VERSION);
  fs.mkdirSync(outDir, { recursive: true });

  const outPaths = [];
  for (const m of MODULES) {
    const mod = require(m.script);
    await mod.build();

    // 打包 build/<模块>/ 下的全部产物，目录结构原样保留在 zip 内。
    const dir = path.join(BUILD, m.name);
    const entries = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".js"))
      .sort()
      .map((f) => ({ name: `${m.name}/${f}`, data: fs.readFileSync(path.join(dir, f)) }));

    const zip = makeZip(entries);
    const outPath = path.join(outDir, `${m.name}.zip`);
    fs.writeFileSync(outPath, zip);
    console.log(
      `  dist/${VERSION}/${m.name}.zip  ${String(zip.length).padStart(7)} 字节  ` +
        `${entries.length} 个文件  md5 ` +
        md5(zip).slice(0, 12),
    );
    outPaths.push(outPath);
  }
  return outPaths;
}

module.exports = { build, MODULES };

if (require.main === module) {
  build().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}
