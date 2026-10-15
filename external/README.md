# external

第三方代码和资源放这里，自己写的代码进 `src/`（shared / core / display）。

```
external/
├─ sm-crypto.js  国密 SM2/SM3/SM4（MIT）esbuild 打包产物，供签名值验证使用
└─ pdf.min.js    pdf.js（Apache-2.0，含内联 worker，1.67 MB）历史遗留，当前无使用方
```

> **`font/` 目录默认不存在**。引擎在需要外部字体时会 `fetch` 该目录下的索引页，
> 拿不到就静默降级（`catch(() => null)`），不影响渲染 —— OFD 自带内嵌字体时完全用不到它。
> 需要兜底字体时，自行创建 `font/` 目录并放入 `.ttf` / `.otf` / `.woff2`，
> 或用 `OFD.setFontBase('你的目录/')` 指定其他位置。

约定：

- 一个库一个文件，文件名沿用原库名，保留原版权头（`/*! ... */`），不改内容
- `build.js` 会把这里的 `.js`（不递归子目录）拼在产物最前面，按文件名字母序
- **例外**：`pdf.min.js` 记在 `build.js` 的 `STANDALONE` 名单里，不并入 `ofd.js`（否则 155 KB 的引擎会涨到近 2 MB）
- 库文件必须是自闭合的（IIFE 或只声明函数），不依赖本引擎的内部函数
- 引擎按全局名取用（`SM_CRYPTO`）；库缺失时相关能力返回 `unknown` 或直接提示，不影响其它功能

> **关于 `pdf.min.js`**：`build/pdf2ofd.js` 是纯 Node 脚本，实际从 `node_modules/pdfjs-dist/legacy/build/pdf.mjs`
> 动态 `import()`，**不加载这个文件**。它原先服务于浏览器端的 PDF 转换演示页，那套能力已移除。
> 目前保留仅为构建规则上的隔离，若确认无外部依赖可直接删除该文件与 `build.js` 里的 `STANDALONE` 条目。

重新打包（源码更新时）：

```bash
# sm-crypto
npm i -D sm-crypto esbuild
npx esbuild node_modules/sm-crypto/src/index.js --bundle --format=iife \
  --global-name=SM_CRYPTO --minify --platform=browser --target=es2017 \
  --outfile=external/sm-crypto.js

# pdf.js（入口 4 行：把主线程与 worker 一起打进来并挂全局）
npm i -D pdfjs-dist esbuild
npx esbuild --bundle --format=iife --global-name=PDFJS_BOOTSTRAP --minify \
  --platform=browser --target=es2020 --legal-comments=none \
  --outfile=external/pdf.min.js <<< "
import * as lib from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as worker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
globalThis.pdfjsLib = lib;
globalThis.pdfjsWorker = worker;
"
```

pdf.js 这条的版权头用 `--banner:js` 传会被 Windows shell 的引号拆坏，改为手工写在文件首行。

