# OFD 预览器与渲染引擎

基于浏览器的 OFD（GB/T 33190 电子文件存储与交换格式·版式文档）预览器。**纯 SVG 矢量渲染，零运行时依赖，无需构建步骤**。

[English](README.md) | 简体中文

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

## 这是什么

OFD 是电子公文的国标格式（类似 PDF，但更贴合中文排版与电子签章）。本项目提供：

| 能力 | 说明 |
| --- | --- |
| **OFD 预览** | 纯前端解析渲染，矢量缩放不失真，文本可选可搜索 |
| **数字签名** | 签章解析、SM2 签名值验证、文件摘要比对（SM3/SHA）、证书与印章有效期校验 |
| **电子签章** | 支持第三方取章回调、自定义印章放置与删除 |
| **全文搜索** | 跨页搜索，按字符精确高亮定位 |
| **版式保真** | 对象级 Clips 裁剪、CMYK/灰度/调色板颜色、渐变描边、文字描边与 HScale/ReadDirection |
| **OFD → PDF** | 纯前端转换，零依赖（`build/toPdf.js`） |
| **PDF → OFD** | Node 命令行脚本 / npm 包（`build/pdf2ofd.js`，beta） |

## 快速开始

### 方式一：直接用（零构建）

克隆后用任意 HTTP 服务器托管，打开即用：

```bash
git clone https://gitee.com/LaoJia803/ofd-core.git
cd ofd-core
python -m http.server 8090
```

浏览器访问：

```
http://127.0.0.1:8090/web/viewer.html
```

其他等效命令：

```bash
npx http-server -p 8090     # Node
npx serve -p 8090# Node
php -S 127.0.0.1:8090# PHP
ruby -run -e httpd . -p 8090  # Ruby
```

> **为什么必须用 HTTP 而不能 `file://`**：预览器需要用 `fetch` 按 URL 加载 OFD 文件，`file://` 协议下会被浏览器拦截。
> 直接双击 `web/viewer.html` 能看到界面，但只能用工具栏「打开 OFD 文件」按钮手动选文件。

### 方式二：集成到自己的系统

引入引擎，两行代码渲染：

```html
<script src="build/ofd.min.js"></script>
<script>
  const ofd = await OFD.load('document.ofd');
  const svg = await OFD.renderPage(ofd, 0, { width: 800 });
  document.body.appendChild(svg);
</script>
```

完整 API 见 [核心引擎文档](docs/ofd.zh-cn.md)。

### 方式三：PDF → OFD 命令行

```bash
npm install
node build/pdf2ofd.js input.pdf output.ofd
```

或作为 npm 包：

```bash
npm install pdf2ofd pdfjs-dist
pdf2ofd input.pdf output.ofd
```

详见 [PDF → OFD 文档](docs/pdf2ofd.zh-cn.md)。

## 构建

源码在 `src/`（浏览器/Node 通用），用 esbuild 拼装、terser 压缩：

```bash
npm install       # 安装 esbuild / terser / pdfjs-dist
npm run build     # → build/ofd.js、build/ofd.min.js、dist/ofdjs-<版本>-dist.zip
npm run build:pdf2ofd   # → dist/pdf2ofd/（可发布的 npm 包）
```

`build.js` 读取 `package.json` 的 `version`，写入引擎头注释、`OFD.version` 与 dist 包名，三者始终同步。

## 目录结构

```
ofd-core/
├── build/                    # 构建产物 + 构建脚本
│   ├── ofd.js                # 核心引擎（未压缩，~198 KB）
│   ├── ofd.min.js                # 核心引擎（压缩，~104 KB）—— 实际加载这个
│   ├── toPdf.js              # OFD → PDF 转换模块（~61 KB）
│   ├── pdf2ofd.js            # PDF → OFD 转换脚本（Node，beta，~78 KB）
│   ├── build.js              # 引擎构建 + 发行 zip 打包
│   └── build-pdf2ofd.js      # 把 pdf2ofd.js 组装成 npm 包
├── src/                      # 引擎源码（22 个文件）
│   ├── index.js              # 公开 API 定义
│   ├── core/                 # 解析层：zip / parser / page / res / signature / verify / seal / asn1 / md / image
│   ├── display/              # 渲染层：api / svg / font
│   └── shared/               # 工具：util / xml / color / path / lru
├── web/                      # 预览器（viewer.html / css / js + SVG 图标，~186 KB）
├── font/                     # 外部字体投放目录（`npm run build` 创建；需服务器输出目录列表才生效）
├── external/                 # 第三方 vendored 代码：sm-crypto.js（国密，~42 KB）、pdf.min.js（无使用方，可删）
├── docs/                     # 详细文档（中英双语）
├── dist/                     # 构建输出（发行 zip + npm 包）
├── test/                     # 测试页面与 OFD 样本
├── LICENSE                   # Apache-2.0
└── 免责声明.md
```

### 最小部署体积

集成到自己的应用时，按需精简：

| 保留 | 大小 | 用途 |
| --- | --- | --- |
| `build/ofd.min.js` | ~104 KB | **必需**，核心引擎 |
| `build/toPdf.js` | ~61 KB | 仅需 OFD → PDF 时保留 |
| `external/sm-crypto.js` | ~42 KB | 仅需验签时保留 |
| `web/` | ~186 KB | 仅需完整预览器时保留 |
| `font/`（仓库根） | `npm run build` 创建 | 未映射 OFD 字体名的外部字体投放目录；所在目录需被服务器**输出目录列表**才生效 |

**可删**：`src/`（源码，构建用）、`external/pdf.min.js`（无使用方）、`docs/`、`test/`、`build/ofd.js`（未压缩版）、`build/pdf2ofd.js` 与 `build/build*.js`（Node 侧，浏览器不需要）。

精简到最小只需 `build/ofd.min.js` 即可渲染。外部字体是可选的：`npm run build` 会在包根创建 `font/` 目录，引擎据 `ofd.min.js` 的位置自动识别它为外部字体目录，把 `字体原名.ttf|.otf|.woff2` 放进去即可生效，无需调用 `OFD.setFontBase()`。但该目录必须被服务器**输出目录列表**（如 nginx `autoindex`，或 `serve`/`http-server`），否则索引抓取失败、外部字体加载不上；此时渲染仍会回退到 OFD 内嵌字体与内置系统字体栈映射。只有要把字体放到别处时，才用 `OFD.setFontBase('你的路径/')` 指定。

### 文件大小参考

| 文件 | 说明 | 大小 |
| --- | --- | --- |
| `build/ofd.js` | 核心引擎（未压缩） | ~198 KB |
| `build/ofd.min.js` | 核心引擎（压缩版） | ~104 KB |
| `build/toPdf.js` | OFD → PDF 转换模块 | ~61 KB |
| `build/pdf2ofd.js` | PDF → OFD 转换脚本（Node，beta） | ~78 KB |
| `external/sm-crypto.js` | 国密算法库 | ~42 KB |
| `web/viewer.js` | 预览器应用逻辑 | ~93 KB |
| `web/viewer.css` | 预览器样式（图标引用 `images/*.svg`，不使用 base64） | ~43 KB |

## 使用

### URL 参数

| 参数 | 说明 |
| --- | --- |
| `file` | OFD 文件 URL（不传则不自动加载，需用工具栏按钮选文件） |
| `page` | 打开后跳转到指定页（1-based） |
| `rotate` | 初始旋转角度（90 的整数倍，顺时针） |
| `search` | 打开搜索栏并自动执行搜索 |

```
http://127.0.0.1:8090/web/viewer.html?file=../test/ofdFile/<你的样本>.ofd&page=3&rotate=90&search=发票
```

### 核心引擎 API

```js
const ofd = await OFD.load('sample.ofd');              // 加载并解析
const svg = await OFD.renderPage(ofd, 0);           // 渲染页面为 SVG DOM
const sigs = await OFD.getSignatures(ofd);          // 获取数字签名
const result = await OFD.verifySignature(ofd, 0);   // SM2 验签 + 摘要比对 + 有效期
OFD.setFontBase('../assets/font/');                 // 覆盖 font/ 字体目录 URL
```

**加载方式**（`load` 接受多种类型）：

```js
await OFD.load('https://example.com/document.ofd');  // URL（拒绝 javascript:/file:/data: 协议）
await OFD.load(fileInput.files[0]);                  // File / Blob
await OFD.load(arrayBuffer);                         // ArrayBuffer
await OFD.load(uint8Array);                          // Uint8Array
```

**渲染与查询**：

```js
const svgString  = await OFD.renderPageToString(ofd, 0);  // SVG 字符串
const svgElement = await OFD.renderPage(ofd, 0);           // SVG DOM 元素
const pages      = await OFD.renderAll(ofd);                // 全部页面
OFD.getPageCount(ofd);                                      // 总页数
await OFD.getPageDimensions(ofd, 0);                        // { width, height, unit: 'mm' }
OFD.getDocumentInfo(ofd);                                   // 文档元信息
```

**性能打点**（排查大文档性能问题）：

```js
OFD.setProfiling(true);
await OFD.renderPage(ofd, 0);
console.table(OFD.getLastProfile());  // 各阶段耗时
```

### 预览器扩展 API

预览器把扩展能力挂到全局 `OFD` 上（详见[预览器文档](docs/viewer.zh-cn.md)）：

```js
OFD.onPageChange((page, total) => console.log(page + '/' + total));// 页码变化
OFD.goToPage(3);                                                     // 跳转到第 3 页
OFD.onGetSeal(async () => {                                          // 取章回调
  OFD.setSeal({ sealImg: await fetchSeal(), width: 40, height: 40 });
});
OFD.onSealChange((list, action) => saveSeals(list));                 // 签章变化（place/delete）
```

## 验签能力边界

这一节请务必读完再决定能否依赖本项目的验签结果。

**已实现**：

- **SM2 签名值验证** —— 用签章人证书的公钥对 GB/T 38540 SES 的 `toSign` 原始 DER 验签
- **文件摘要比对** —— 各 `References[].CheckValue` 以 SM3 / SHA 系列重算比对，检测受保护文件是否被改动或缺失
- **有效期校验** —— 印章有效期与签名数据内所有证书的有效期，是否覆盖**签名时刻**

**未实现**：

- 证书链与信任根验证
- 吊销状态检查（CRL / OCSP）
- 时间戳（TSA）验证
- 印章自身签名验证

> `valid: true` 表示签名值自洽、受保护文件未被改动、有效期覆盖签名时间。
> **不表示签名者是被信任的权威机构签发的。** 由于证书是「按原样信任」、不构建证书链，
> 任何人都能自签一份证书并通过验证。
>
> 另注：签名文件被修改后摘要可被同步重算，因此「摘要一致」只说明文件自洽；
> 签名值验证才是身份与完整性的依据。若摘要一致但签名值无法验证（如缺少 SM2 库或非 SES 结构），
> 返回 `status: "partial"`、`valid: false`，预览器显示「部分验证」。
>
> 法律意义上的电子签名有效性需要合规的 CA 体系与时间戳服务，本项目不提供。

## 浏览器支持

| 浏览器 | 最低版本 |
| --- | --- |
| Chrome / Edge | 80+ |
| Firefox | 113+ |
| Safari | 16.4+ |

ZIP 解压依赖原生 `DecompressionStream` API。
**Firefox 78–112 与 Safari 14–16.3 缺少该 API，无法解压 OFD。**

`toPdf.js` 的 PDF 压缩优先用 `CompressionStream`，但有 `zlib` 兜底路径（Node 环境），因此不额外抬高浏览器版本要求。

Node.js 18+ 可用于 PDF → OFD 转换（需要 `DecompressionStream`，Node 18+ 具备）。

## 安全说明

本项目会解析不受信任的 OFD 文件，已做以下防护，但**未经过专业安全审计**：

- ZIP 解压体积上限 256 MB/条目，条目缓存 64 项（防解压炸弹）
- 图像解码像素上限 1 亿像素（`toPdf.js`）
- 拒绝 `javascript:` / `file:` / `data:` URL 协议
- XML 字符引用做码点合法性校验，畸形引用返回 U+FFFD 而非抛异常中断解析
- 签名数据解析全程 `try/catch`，单个签名损坏不影响文档加载

处理外部来源的 OFD 前，请自行评估风险。

## 文档

### 中文

| 文档 | 内容 |
| --- | --- |
| [核心引擎](docs/ofd.zh-cn.md) | 公开 API、解析流程、签名验证范围与局限、性能打点、实现要点 |
| [预览器](docs/viewer.zh-cn.md) | 集成示例、URL 参数、工具栏/签章/导航接口、盖章流程、内部状态 |
| [OFD → PDF](docs/toPdf.zh-cn.md) | 转换能力、字体策略、图像支持、已知损失 |
| [PDF → OFD](docs/pdf2ofd.zh-cn.md) | CLI / npm 包、转换原理、与数科产物的对齐情况 |

可运行的示例页面在 `test/` 下：`example-intro.html`（入门）、`example-basic.html`（API 演示）、`example-seal.html`（盖章接入）、`example-topdf.html`（PDF 转换）、`benchmark.html`（性能剖析）。

### English

[Core engine](docs/ofd.md) · [Viewer](docs/viewer.md) · [toPdf](docs/toPdf.md) · [pdf2ofd](docs/pdf2ofd.md) · [README](README.md)

## 常见问题

**Q：所有字体都显示为黑体/无衬线**

内嵌字体没匹配上。OFD 自带的字体文件（`res.fonts[].fontFile`）没被成功注册为
`@font-face`，CSS 就落到最后一档 `sans-serif`，而 Windows 上它解析为黑体。

先诊断：

```js
const ofd = await OFD.load('doc.ofd');
const fonts = ofd.document.res.fonts;
console.log('字体总数', Object.keys(fonts).length);
console.log('带内嵌文件', Object.values(fonts).filter(f => f.fontFile).length);
```

若 `fontFile` 存在却仍显示黑体，是本项目的 bug，请连同 `docs/ofd.zh-cn.md`
的复现信息提 issue。排查路径见该文档的「常见故障排查」。

**Q：OFD 里的字体名找不到对应字体**

OFD 未内嵌字体的文档依赖系统字体。Windows 上一般有宋体/黑体/楷体/仿宋，
macOS/Linux 需自行安装或用 `OFD.setFontBase()` 指定字体目录。

**Q：`verifySignature` 返回 `valid: true`，能作为法律证据吗？**

不能。见上方「验签能力边界」—— 证书按原样信任、不建链，自签证书也能通过。

**Q：Firefox 上打不开**

ZIP 解压需要 `DecompressionStream`，Firefox 需 113+。

## 参与贡献

欢迎提issue 与 PR。

改动前请先读 `docs/` 下对应文档的「实现要点」一节 —— 那里记录了若干**反直觉的设计约束**，例如：

- `LineWidth` / `DashPattern` 绝不可预先乘 CTM（会缩小近3 倍）
- 页面层绝不输出 `<ofd:Clips>`（会让 WPS 把内容整块裁没）
- 内嵌字体必须按 Font ID 区分，不能只用字体名做 key

不看注释直接改，很容易引入回归。

## 致谢

- [ofd.js](https://github.com/DLTech21/ofd.js) —— OFD 解析思路参考
- [ofdrw](https://github.com/ofdrw/ofdrw) —— OFD 相关代码参考
- [pdf.js](https://github.com/mozilla/pdf.js) —— 阅读器界面风格参考
- Qoder CN，以及 Qwen3.8-Flash、Mimo-V2.6-Flash 大模型

## 项目地址

- Gitee：<https://gitee.com/LaoJia803/ofd-core>
- GitHub：<https://github.com/LaoJia803/ofd-core>

## 许可

Apache-2.0，见 [LICENSE](LICENSE)。另附[免责声明](免责声明.md)。

本项目与国家密码管理局、电子文件标准制定机构及任何 OFD 软件厂商无隶属关系；「OFD」相关标准归其发布方所有。