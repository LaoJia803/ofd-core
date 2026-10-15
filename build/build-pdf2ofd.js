// =============================================================================
// build/build-pdf2ofd.js —— 把 PDF → OFD 转换器组装成可发布的 npm 包
//
// 产物：dist/pdf2ofd/（npm 包根目录，npm publish dist/pdf2ofd 即可）
//
// 打包策略（重要，别改成bundle pdf.js）：
//   pdf.js 有两类东西 —— 代码（legacy/build/pdf.mjs，984KB 的 ESM）与
//   资源（cmaps/ 1.4MB + standard_fonts/ 804KB 的 .bcmap/.pfb 静态文件）。
//   实测把 pdf.js 一起 esbuild bundle 会直接 OOM（Node 堆溢出），
//   而且 cmaps/standard_fonts 本来就不是 JS，bundle 也带不进去。
//   所以走 npm 常规路线：pdfjs-dist 作为 peerDependency 由使用方安装，
//   本包只负责组装自身代码 + 转换器自身的元信息。
//
// 用法：
//   node build/build-pdf2ofd.js
//   npm run build:pdf2ofd
// =============================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'pdf2ofd');

// npm 包元信息。name 若已在 npmjs 上被占用，改这里即可。
const PKG = {
  name: 'pdf2ofd',
  version: '1.0.0',
  description:
    'PDF → OFD 转换器。纯 Node 实现，零运行时依赖（pdf.js 作为 peerDependency），' +
    '保留可搜索文字、内嵌子集字体与位图，输出符合 GB/T 33190 的 OFD 包。',
  keywords: ['pdf', 'ofd', 'convert', 'converter', 'gb23190', 'gbt33190', '电子公文', '版式'],
  license: 'Apache-2.0',
  engines: { node: '>=18' },
  main: 'lib/index.js',
  bin: { pdf2ofd: 'bin/pdf2ofd.js' },
  files: ['lib', 'bin', 'README.md', 'LICENSE'],
  peerDependencies: { 'pdfjs-dist': '>=4.0.0' },
  peerDependenciesMeta: {
    // 只用 ESM 版 pdf.js，不强制 CJS
    'pdfjs-dist': { optional: false },
  },
};

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function write(rel, content) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}

function md5(buf) {
  return crypto.createHash('md5').update(buf).digest('hex');
}

// ---------------------------------------------------------------------------
// lib/index.js —— CJS 主入口
// ---------------------------------------------------------------------------
const LIB_INDEX = `/*!
 * pdf2ofd v__VERSION__ — PDF → OFD 转换器
 * 由 ofd-core 项目的 build/pdf2ofd.js 组装而来
 *
 * 用法：
 *   const { convert } = require('pdf2ofd');
 *   await convert('in.pdf', 'out.ofd', { onProgress: (done, total) => {} });
 */
'use strict';

const path = require('path');
const crypto = require('crypto');

// ---- 加载转换器实现 ----
// 源文件是 CommonJS，直接 require 即可；它内部的 pdf.js 定位走require.resolve，
// 不依赖本文件所在层级，因此在 npm 包与源码树里行为一致。
const impl = require('./converter.js');

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
  const r = await impl.convert(pdfPath, out, options);
  return r;
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
 * 缺省输出名与输入同名（.pdf → .ofd），输出路径打印到stdout。
 */
'use strict';

const path = require('path');
const fs = require('fs');

function usage() {
  console.log(
    [
      'pdf2ofd — PDF 转OFD',
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

// ---------------------------------------------------------------------------
// README（npm 包页面的正文）
// ---------------------------------------------------------------------------
const README = `# pdf2ofd

PDF → OFD 转换器。Node 环境，零运行时依赖。

把 PDF 转成符合 **GB/T 33190**（电子文件存储与交换格式·版式文档）的 OFD 包，
保留可搜索文字、内嵌子集字体与位图，图表以矢量路径、轴向渐变与虚线线型表达。

> **beta**：不保证与 PDF 原件逐像素一致。正式归档前请人工核对产物。

## 安装

\`\`\`bash
npm install pdf2ofd pdfjs-dist
\`\`\`

\`pdfjs-dist\` 是 peerDependency（版本 ≥ 4），需单独安装 ——
它负责解析 PDF，本包只做 OFD 侧的输出。

## 命令行

\`\`\`bash
pdf2ofd input.pdf                  # 输出 input.ofd
pdf2ofd input.pdf out/result.ofd   # 指定输出
pdf2ofd -q input.pdf out.ofd       # 静默
pdf2ofd --help
\`\`\`

## 代码调用

\`\`\`js
const { convert } = require('pdf2ofd');

const r = await convert('in.pdf', 'out.ofd', {
  onProgress: (done, total) => console.log(\`\${done}/\${total}\`),
  quiet: false,
});
console.log(r); // { path, pages, fonts, images, bytes }
\`\`\`

批量（顺序执行，避免大文件并发吃满内存）：

\`\`\`js
const { convertMany } = require('pdf2ofd');
await convertMany(['a.pdf', 'b.pdf'], { quiet: true });
await convertMany([
  { from: 'a.pdf', to: 'out/a.ofd' },
  { from: 'b.pdf', options: { quiet: true } },
]);
\`\`\`

## 导出

| 成员 | 说明 |
| --- | --- |
| \`convert(pdfPath, ofdPath?, options?)\` | 主转换函数，返回统计对象 |
| \`convertMany(list, options?)\` | 批量转换，返回统计对象数组 |
| \`ZipWriter\` | 最小 ZIP 写入器（deflate） |
| \`encodePng(w, h, rgba)\` | RGBA → PNG 字节 |
| \`PT_TO_MM\` | 点到毫米换算系数 \`25.4/72\` |
| \`version\` | 包版本号 |

## 环境要求

- Node.js 18+
- pdfjs-dist ≥ 4

## 已知边界

- 不支持表单域、注释、Type3 字体
- 渐变以 OFD 轴向渐变（\`AxialShd\`）表达；径向渐变按轴向近似
- Form XObject 内联展开为页面级图元，不输出 \`CompositeObject\` /
  \`CompositeGraphicUnit\`（引擎不识别时会导致整块图表消失）
- 页面层不输出裁剪（\`<ofd:Clips>\`），仅在生成阶段按裁剪区剔除图元 ——
  部分引擎会因页面层裁剪导致整块内容不显示

## License

Apache-2.0
`;

function main() {
  rmrf(OUT);
  fs.mkdirSync(OUT, { recursive: true });

  const src = path.join(BUILD, 'pdf2ofd.js');
  if (!fs.existsSync(src)) throw new Error('缺少 build/pdf2ofd.js');

  // 1) 转换器主体：源码去掉 CLI 入口，只留导出
  let converter = fs.readFileSync(src, 'utf8');
  converter = converter.replace(
    /\n\/\/ Node CLI 入口[\s\S]*$/m,
    '\n',
  );
  converter = `/* pdf2ofd 转换器主体（由 ofd-core build/pdf2ofd.js 组装，勿直接改本文件） */\n` + converter;
  write('lib/converter.js', converter);

  // 2) 主入口 / CLI / README / LICENSE / package.json
  write('lib/index.js', LIB_INDEX.split('__VERSION__').join(PKG.version));
  write('bin/pdf2ofd.js', BIN_CLI.split('__VERSION__').join(PKG.version));
  write('README.md', README);
  const lic = path.join(ROOT, 'LICENSE');
  if (fs.existsSync(lic)) write('LICENSE', fs.readFileSync(lic, 'utf8'));

  write(
    'package.json',
    JSON.stringify(
      {
        ...PKG,
        scripts: {
          test: 'node -e "console.log(require(\'./lib/index.js\').version)"',
        },
      },
      null,
      2,
    ) + '\n',
  );

  // 3) 清单
  const files = [];
  (function walk(dir, base) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = base ? base + '/' + name : name;
      if (fs.statSync(full).isDirectory()) walk(full, rel);
      else files.push(rel);
    }
  })(OUT, '');
  files.sort();

  const packPath = path.join(DIST, `${PKG.name}-${PKG.version}.tgz`);
  console.log('组装完成: dist/pdf2ofd/');
  for (const f of files) {
    const buf = fs.readFileSync(path.join(OUT, f));
    console.log('  ' + f.padEnd(18) + String(buf.length).padStart(9) + ' 字节  md5 ' + md5(buf).slice(0, 12));
  }
  console.log('');
  console.log('下一步：');
  console.log('  发布到npmjs：  cd dist/pdf2ofd && npm publish --access public');
  console.log('  本地安装验证：  cd dist && npm install ./pdf2ofd');
  console.log('');
  console.log(`（如需生成 .tgz：cd dist/pdf2ofd && npm pack，输出 ${path.basename(packPath)}）`);
}

try {
  main();
} catch (e) {
  console.error('打包失败: ' + (e && e.message ? e.message : e));
  process.exit(1);
}