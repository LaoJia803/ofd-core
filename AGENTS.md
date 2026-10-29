# AGENTS.md

面向在本仓库工作的 AI 代理的约定说明。用户可见文档见 `README.md` / `README.zh-cn.md`。

## 项目概览

浏览器端 OFD（GB/T 33190）预览与转换引擎，纯 SVG 矢量渲染，运行时零第三方依赖。

| 目录 | 职责 |
| --- | --- |
| `ofd/` | 引擎核心：OFD 解析、页面排版渲染为 SVG、签名与签章校验 |
| `ofd2pdf/` | OFD → PDF：逐页取 `ofd.js` 的 SVG 输出，再映射为手写 PDF 内容流 |
| `pdf2ofd/` | PDF → OFD（beta）：基于 pdfjs-dist 的 Node 转换器 |
| `web/` | 预览器界面（viewer.html / viewer.js / viewer.css） |
| `build/` | esbuild 构建脚本与产物（产物目录，不手改） |
| `docs/` | 各模块中英文文档，成对维护 |
| `test/` | 示例页面与 `test/ofdFile/` 下的 OFD 样例（含国标合规样例） |
| `font/` | 外部字体目录，存放未内嵌字体的回退字体文件 |

- 源码是唯一真实来源。`build/`、`dist/` 下的文件都是生成物，改逻辑必须改 `ofd/`、`ofd2pdf/`、`pdf2ofd/`、`web/` 后重新构建。
- `ofd/`、`ofd2pdf/`、`pdf2ofd/` 源码为 ESM；`build/*.js` 为 CommonJS。两边风格不要混。
- 构建产物走 IIFE + `globalThis` 挂 API，Node 侧依赖（如 `zlib`、`ofd.js`）由构建脚本的收尾段注入，不要写进源码。

## 常用命令

```bash
npm install                 # 首次：esbuild / terser / pdfjs-dist / sm-crypto 均为 devDependencies
npm run build:ofd           # ofd/        → build/ofd/
npm run build:ofd2pdf       # ofd2pdf/    → build/ofd2pdf/
npm run build:pdf2ofd       # pdf2ofd/    → build/pdf2ofd/
npm run build:viewer        # web/        → build/viewer/
npm run build:zips          # 三个模块产物各自打 zip → dist/<版本号>/<模块>.zip
npm run build:all           # 以上四个全构建
npm run build:npm           # 构建 + npm 包形态产物
```

- 只改了一个模块就只跑对应 `build:<模块>`，不要顺手跑全量构建。
- Windows PowerShell 下命令分隔用 `;`，不要用 `&&`。
- 预览器必须经 HTTP 访问（`fetch` 加载 OFD 会被 `file://` 拦截）。

## 代码约定

- 缩进 2 空格，保留分号，字符串按所在文件既有写法（源码多为单引号，`build/` 多为双引号）。
- 注释用中文，说明「为什么」而非「做了什么」；标识符、API 名用英文。
- 运行时不要引入第三方库：`ofd/`、`ofd2pdf/`、`web/` 必须保持零运行时依赖，新依赖只能进 devDependencies 且仅用于构建或验证。
- 改动 PDF/OFD 二进制写法时，注释里写清对应的规范条目或算子语义，避免后续「看起来能跑」的回归。

## 文档

- `docs/<模块>.md`（英文）与 `docs/<模块>.zh-cn.md`（中文）成对存在，功能变化必须同步两版，不允许只改一边。
- npm 包 README 由 `docs/` 下同名文档拼装生成，文档内不要写相对链接。
- 能力或限制一旦变化（例如新增支持的解码方式、新字体策略、仍不支持的项），同步更新文档的映射表与「注意事项/已知限制」。

## 更新记录

- 每次完成功能新增、缺陷修复或行为变更，都必须在 `CHANGELOG.md` 补条目，不能只改代码。
- 格式：`日期 v.版本号 版本` + `更新内容：`，下按模块分组（`ofd`、`ofd2pdf`、`viewer`、`pdf2ofd`），新版本在前。
- 版本号必须与 `package.json` 的 `version` 一致；未发布的改动并入当前版本条目，不虚构历史版本。
- 某版本中某模块无变更，则该模块整块省略，不写「无变化」。
- 条目写用户可感知的结果（「渐变图形正确还原」），不写代码级细节（算子名、函数名、内部字段）。

## 验证与清理

- 验证脚本用 Node.js 运行（`node xxx.cjs|mjs`），不依赖浏览器手工点检；转换结果建议用 `pdfjs-dist` 重新解析，统计告警/错误与算子数量做回归对比。
- 临时脚本（`tmp-*.cjs`、`tmp-*.mjs` 等）用完立即删除，任务结束前确认工作区无残留。
- 不要为了让测试通过而放宽断言或吞掉异常；已知未修的问题写进文档的「已知限制」并在回复中说明。

## Git

- 仅在用户明确要求时执行提交/推送；不擅自 `git commit`、`git push`、`git reset`。
- 提交前区分「本次改动」与「工作区既有未提交改动」，不要顺手提交或回退无关文件。
