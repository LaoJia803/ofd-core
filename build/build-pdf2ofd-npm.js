// 组装 PDF → OFD npm 包：dist/<版本号>/pdf2ofd/
// 用法：node build/build-pdf2ofd-npm.js
//
// 打包策略（别改成 bundle pdf.js）：
//   pdf.js 有两类东西 —— 代码（legacy/build/pdf.mjs）与资源（cmaps/ + standard_fonts/
//   的 .bcmap/.pfb 静态文件）。bundle pdf.js 会 OOM，而且资源本来就不是 JS。
//   所以走 npm 常规路线：pdfjs-dist 作为 peerDependency 由使用方安装，
//   本包只负责组装自身代码 + 转换器自身的元信息。
const fs = require("fs");
const path = require("path");
const { ROOT, BUILD, DIST, VERSION, rmrf, walkFiles, md5, readmeFromDocs } = require("./common");

const OUT = path.join(DIST, VERSION, "pdf2ofd");

// npm 包元信息。name 若已在 npmjs 上被占用，改这里即可。
const PKG = {
  name: "pdf2ofd",
  version: VERSION,
  private: false,
  description:
    "PDF → OFD 转换器。纯 Node 实现，零运行时依赖（pdf.js 作为 peerDependency），" +
    "保留可搜索文字、内嵌子集字体与位图，输出符合 GB/T 33190 的 OFD 包。",
  keywords: ["pdf", "ofd", "convert", "converter", "gb23190", "gbt33190", "电子公文", "版式"],
  license: "Apache-2.0",
  engines: { node: ">=18" },
  main: "lib/index.js",
  bin: { pdf2ofd: "bin/pdf2ofd.js" },
  files: ["lib", "bin", "README.md", "LICENSE"],
  peerDependencies: { "pdfjs-dist": ">=4.0.0" },
  peerDependenciesMeta: {
    // 只用 ESM 版 pdf.js，不强制 CJS
    "pdfjs-dist": { optional: false },
  },
};

function write(rel, content) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}

// ---------------------------------------------------------------------------
// lib/index.js —— CJS 主入口
// ---------------------------------------------------------------------------
const LIB_INDEX = `/*!
 * pdf2ofd v__VERSION__ — PDF → OFD 转换器
 * 由 ofd-core 项目的 build/build-pdf2ofd-npm.js 组装而来
 *
 * 用法：
 *   const { convert } = require('pdf2ofd');
 *   await convert('in.pdf', 'out.ofd', { onProgress: (done, total) => {} });
 */
'use strict';

// 转换器主体由 build/pdf2ofd/pdf2ofd.js 打包后复制而来；
// 它内部的 pdf.js 定位走 require.resolve，不依赖本文件所在层级，
// 因此在 npm 包与源码树里行为一致。
const impl = require('./pdf2ofd.js');

/**
 * PDF → OFD 转换
 * @param {string} pdfPath  输入 PDF 路径
 * @param {string} ofdPath  输出 OFD 路径；省略则与输入同名（.pdf → .ofd）
 * @param {object} [options]
 * @param {(done:number,total:number)=>void} [options.onProgress] 进度回调
 * @param {boolean} [options.quiet] 静默模式，不打印进度
 * @returns {Promise<{path:string, pages:number, fonts:number, images:number, bytes:number}>}
 */
async function convert(pdfPath, ofdPath, options) {
  const out = ofdPath || String(pdfPath).replace(/\\.pdf$/i, '.ofd');
  return impl.convert(pdfPath, out, options);
}

/** 批量转换（顺序执行，避免大文件并发吃满内存） */
async function convertMany(list, options) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const from = typeof item === 'string' ? item : item.from;
    const to = typeof item === 'string' ? undefined : item.to;
    const opts = typeof item === 'string' ? options : Object.assign({}, options, item.options);
    if (options && options.onProgress) {
      opts.onProgress = (done, total) => options.onProgress(i + 1, list.length, from);
    }
    out.push(await convert(from, to, opts));
  }
  return out;
}

module.exports = {
  convert,
  convertMany,
  // 低层接口，转换器自带
  ZipWriter: impl.ZipWriter,
  encodePng: impl.encodePng,
  PT_TO_MM: impl.PT_TO_MM,
  version: '__VERSION__',
};
`;

// ---------------------------------------------------------------------------
// bin/pdf2ofd.js —— CLI
// ---------------------------------------------------------------------------
const BIN_CLI = `#!/usr/bin/env node
/*!
 * pdf2ofd v__VERSION__ — 命令行入口
 *
 * 用法：
 *   pdf2ofd input.pdf [output.ofd]
 *   pdf2ofd --help
 *
 * 缺省输出名与输入同名（.pdf → .ofd），输出路径打印到 stdout。
 */
'use strict';

const fs = require('fs');

function usage() {
  console.log(
    [
      'pdf2ofd — PDF 转 OFD',
      '',
      '用法：',
      '  pdf2ofd <input.pdf> [output.ofd]',
      '',
      '选项：',
      '  -q, --quiet    静默模式，不打印进度',
      '  -h, --help     显示本帮助',
      '',
      '示例：',
      '  pdf2ofd paper.pdf',
      '  pdf2ofd paper.pdf out/paper.ofd',
      '  pdf2ofd -q paper.pdf out/paper.ofd',
    ].join('\\n'),
  );
}

function main(argv) {
  const args = argv.slice(2);
  let quiet = false;
  const pos = [];
  for (const a of args) {
    if (a === '-q' || a === '--quiet') quiet = true;
    else if (a === '-h' || a === '--help') {
      usage();
      process.exit(0);
    } else if (a.startsWith('-')) {
      console.error('未知选项: ' + a);
      usage();
      process.exit(1);
    } else pos.push(a);
  }

  if (!pos.length) {
    usage();
    process.exit(1);
  }

  const input = pos[0];
  const output = pos[1] || input.replace(/\\.pdf$/i, '.ofd');
  if (!fs.existsSync(input)) {
    console.error('输入文件不存在: ' + input);
    process.exit(1);
  }

  const { convert } = require('..');
  convert(input, output, { quiet })
    .then((r) => {
      console.log('完成: ' + (r.path || output));
    })
    .catch((e) => {
      console.error(e && e.stack ? e.stack : e);
      process.exit(1);
    });
}

main(process.argv);
`;

const README = readmeFromDocs("pdf2ofd");

function main() {
  rmrf(OUT);

  const src = path.join(BUILD, "pdf2ofd", "pdf2ofd.js");
  const min = path.join(BUILD, "pdf2ofd", "pdf2ofd.min.js");
  if (!fs.existsSync(src) || !fs.existsSync(min)) {
    throw new Error("缺少 build/pdf2ofd/pdf2ofd.js 或 pdf2ofd.min.js，请先执行 node build/build-pdf2ofd.js");
  }

  // 1) 转换器主体：去掉 CLI 入口，只留导出（npm 包通过 bin/ 提供 CLI）
  const converter = fs.readFileSync(src, "utf8");
  const marker = "\n// Node CLI 入口";
  const idx = converter.indexOf(marker);
  if (idx < 0) {
    throw new Error(
      "build/pdf2ofd/pdf2ofd.js 的 CLI 入口标记失配，无法剥离。请同步 build/build-pdf2ofd.js 的 TAIL。",
    );
  }
  write(
    "lib/pdf2ofd.js",
    "/* pdf2ofd 转换器主体（由 ofd-core build/build-pdf2ofd.js 组装，勿直接改本文件） */\n" +
      converter.slice(0, idx) +
      "\n",
  );
  write("lib/pdf2ofd.min.js", fs.readFileSync(min));

  // 2) 主入口 / CLI / README / LICENSE / package.json
  write("lib/index.js", LIB_INDEX.split("__VERSION__").join(VERSION));
  write("bin/pdf2ofd.js", BIN_CLI.split("__VERSION__").join(VERSION));
  write("README.md", README);
  const lic = path.join(ROOT, "LICENSE");
  if (fs.existsSync(lic)) write("LICENSE", fs.readFileSync(lic, "utf8"));

  write(
    "package.json",
    JSON.stringify(
      {
        ...PKG,
        scripts: {
          test: 'node -e "console.log(require(\'./lib/index.js\').version)"',
        },
      },
      null,
      2,
    ) + "\n",
  );

  // 3) 清单
  const files = [];
  for (const { rel } of walkFiles(OUT, "")) files.push(rel);
  files.sort();

  console.log(`组装完成: dist/${VERSION}/pdf2ofd/  (package: ${PKG.name}@${PKG.version})`);
  for (const f of files) {
    const buf = fs.readFileSync(path.join(OUT, f));
    console.log("  " + f.padEnd(20) + String(buf.length).padStart(9) + " 字节  md5 " + md5(buf).slice(0, 12));
  }
  console.log("");
  console.log("下一步：");
  console.log(`  发布到 npmjs：  cd dist/${VERSION}/pdf2ofd && npm publish --access public`);
  console.log(`  本地安装验证：  cd dist/${VERSION} && npm install ./pdf2ofd`);
}

try {
  main();
} catch (e) {
  console.error("打包失败: " + (e && e.message ? e.message : e));
  process.exit(1);
}
