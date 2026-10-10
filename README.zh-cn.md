# OFD 预览器

基于浏览器的 OFD（GB/T 33190）文档预览器，使用纯 SVG 渲染，零依赖、无构建步骤。

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

## 功能特性

- **SVG 矢量渲染**：页面矢量缩放不失真，文本可选、可搜索

- **数字签名**：签章解析、文件摘要比对（SM3/SHA）、证书信息展示。**验签边界：仅实现文件摘要比对**，不含签名值（RSA/SM2）、证书链、时间戳验证（详见 [docs/ofd.zh-cn.md](docs/ofd.zh-cn.md)）

- **盖章**：支持第三方取章、自定义印章放置与删除

- **搜索**：跨页全文搜索，按字符精确高亮定位

- **视图控制**：缩放（自动/页宽/实际大小/自定义）、旋转（90° 步进）、缩略图侧边栏

- **文件加载**：支持 URL、本地文件、拖放打开

- **打印下载**：新窗口打印、下载当前文档

- **PDF 转换**：纯前端 OFD → PDF 转换，模态框实时显示进度并自动下载（依赖 toPdf.js）

- **跨平台**：支持现代浏览器（Chrome 80+、Firefox 78+、Safari 14+、Edge 80+）和 Node.js

- **轻量级**：零依赖，无需构建步骤，直接托管静态文件即可运行

## 目录结构

```
ofd-viewer/
├── build/
│   ├── ofd.js      # 核心引擎：OFD 解析、SVG 渲染、文件摘要比对（SM3，IIFE，挂载为全局 OFD）
│   ├── ofd.min.js  # 核心引擎压缩版（由 ofd.js 经 terser 生成）
│   └── toPdf.js         # OFD → PDF 转换（纯前端，见 docs/toPdf.zh-cn.md）
├── font/                # 补充字体（OFD 中未映射的字体名自动从此目录加载）
├── web/
│   ├── viewer.html      # 预览器页面
│   ├── viewer.css       # PDF.js 风格样式
│   ├── viewer.js        # 应用逻辑（无框架原生 JS）
│   └── images/          # SVG 图标
├── docs/
│   ├── ofd.zh-cn.md     # 核心引擎文档（API、设计理念、函数调用流程）
│   ├── viewer.zh-cn.md   # 预览器文档（API、集成示例、函数调用流程）
│   ├── toPdf.zh-cn.md    # OFD → PDF 转换文档（API、示例、限制）
│   ├── ofd.md            # Core engine docs (English)
│   ├── viewer.md         # Viewer docs (English)
│   └── toPdf.md          # OFD → PDF conversion docs (English)
└── test/
    ├── example-basic.html           # 核心引擎开放 API 示例（load / renderPage / getSignatures / verifySignature 等）
    ├── example-intro.html           # 核心引擎入门介绍（内嵌文档 + 在线演示）
    ├── benchmark.html               # 性能剖析（load / 模板 / 页面 / 签名 / 渲染各阶段计时）
    ├── example-topdf.html           # OFD → PDF 转换示例
    ├── example-seal.html            # 盖章 · 第三方接入示例
    └── ofdFile/                     # 测试用 OFD 样本文件（含 GB/T 33190 符合性样本 6.1.x / 6.2.x、999.ofd 发票）
```

## 浏览器兼容性

| 浏览器     | 最低版本 |
| ------- | ---- |
| Chrome  | 80+  |
| Firefox | 78+  |
| Safari  | 14+  |
| Edge    | 80+  |

> **注意**：PDF 转换功能需要 `CompressionStream` API（Chrome 80+、Firefox 113+、Safari 16.4+）。

## 使用手册

将 OFD 预览器集成到您的应用前，建议按需精简以下内容，避免应用体积增大：

- **`test/`** **文件夹**：测试页面与 OFD 样本文件，仅用于演示

- **`docs/`** **文件夹**：项目文档，不影响运行

精简后仅需保留 `build/ofd.js`、`build/toPdf.js`、`web/` 与 `font/` 即可正常运行。

## 文件大小参考

| 文件                 | 说明        | 大小（约）    |
| ------------------ | --------- | -------- |
| `build/ofd.js`     | 核心引擎（未压缩） | \~113 KB |
| `build/ofd.min.js` | 核心引擎（压缩版） | \~54 KB  |
| `build/toPdf.js`   | PDF 转换模块  | \~60 KB  |
| `web/viewer.js`    | 预览器应用逻辑   | \~82 KB  |
| `web/viewer.css`   | 预览器样式     | \~42 KB  |

## 快速开始

无需构建，直接用 HTTP 服务器托管即可（浏览器不能通过 `file://` 加载 OFD 文件）：

```bash
cd ofd-viewer
python -m http.server 8090
```

访问：

```
http://127.0.0.1:8090/web/viewer.html
```

### 其他 HTTP 服务器

**Node.js (http-server):**

```bash
npx http-server -p 8090
```

**Node.js (serve):**

```bash
npx serve -p 8090
```

**PHP:**

```bash
php -S 127.0.0.1:8090
```

**Ruby:**

```bash
ruby -run -e httpd . -p 8090
```

## 使用方式

### URL 参数

| 参数       | 说明                                      |
| -------- | --------------------------------------- |
| `file`   | OFD 文件 URL，默认 `../test/ofdFile/999.ofd` |
| `page`   | 打开后跳转到指定页（1-based）                      |
| `rotate` | 初始旋转角度（90 的整数倍，顺时针）                     |
| `search` | 打开搜索栏并自动执行搜索                            |

```text
http://127.0.0.1:8090/web/viewer.html?file=../test/ofdFile/999.ofd&page=3&rotate=90&search=发票
```

### 集成到第三方系统

预览器将扩展能力挂载到全局 `OFD` 对象上：

```js
// 监听页码变化
OFD.onPageChange((page, total) => console.log(page + '/' + total));

// 注册取章回调（用户点击「盖章」按钮时触发）
OFD.onGetSeal(async () => {
  OFD.setSeal({ sealImg: await fetchSeal(), width: 40, height: 40 });
});

// 监听签章变化，提交到后端
OFD.onSealChange((list, action) => saveSeals(list));
```

## 核心引擎 API

```js
const ofd = await OFD.load('999.ofd');              // 加载并解析
const svg = await OFD.renderPage(ofd, 0);           // 渲染页面为 SVG DOM
const sigs = await OFD.getSignatures(ofd);          // 获取数字签名
const result = await OFD.verifySignature(ofd, 0);   // 文件摘要比对（非完整验签，见下方边界）
OFD.setFontBase('../assets/font/');                 // 覆盖 font/ 字体目录 URL
```

> **验签边界**：`verifySignature` 当前**只做文件摘要比对**——用签名登记的 `References[].CheckValue` 与重算摘要逐字节比对，检测受保护文件是否被改动或缺失。
> **未实现**：签名值验证（RSA / SM2 公钥验签）、证书链验证、时间戳（TSA）验证、保护范围 / 夹带文件检测。
> `CheckValue` 存放在 OFD 文件内部、可随篡改内容同步重算，因此 `valid: true` 只代表文件自洽，**不能证明签名真实有效**；印章与签名值仅解析展示。完整边界见 [docs/ofd.zh-cn.md](docs/ofd.zh-cn.md)。

### 常用操作

**从不同来源加载：**

```js
// 从 URL 加载
const ofd = await OFD.load('https://example.com/document.ofd');

// 从文件输入框加载
const file = document.getElementById('fileInput').files[0];
const ofd = await OFD.load(file);

// 从 ArrayBuffer 加载
const buffer = await fetch('document.ofd').then(r => r.arrayBuffer());
const ofd = await OFD.load(buffer);
```

**渲染和显示：**

```js
// 渲染为 SVG 字符串
const svgString = await OFD.renderPageToString(ofd, 0);
document.getElementById('container').innerHTML = svgString;

// 渲染为 SVG DOM 元素
const svgElement = await OFD.renderPage(ofd, 0);
document.getElementById('container').appendChild(svgElement);

// 渲染所有页面
const pages = await OFD.renderAll(ofd);
pages.forEach(page => container.appendChild(page));
```

**获取文档信息：**

```js
const pageInfo = OFD.getPageCount(ofd);           // 总页数
const dimensions = await OFD.getPageDimensions(ofd, 0); // { width, height, unit: 'mm' }
const docInfo = OFD.getDocumentInfo(ofd);          // 文档元信息
```

## 文档

### 中文文档

- [核心引擎文档](docs/ofd.zh-cn.md)：设计理念、公开 API、函数调用流程

- [预览器文档](docs/viewer.zh-cn.md)：设计理念、对外接口、完整集成示例

- [OFD → PDF 转换文档](docs/toPdf.zh-cn.md)：API、示例、beta 版本限制

### English Documentation

- [Core engine docs](docs/ofd.md): design philosophy, public API, call flows

- [Viewer docs](docs/viewer.md): design philosophy, extension API, integration example

- [toPdf docs](docs/toPdf.md): API, examples, beta limitations

- [README (English)](README.md)

## 贡献

欢迎贡献代码！请随时提交 Pull Request。

1. Fork 本仓库
2. 创建您的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m '添加某个新功能'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 开源许可

本项目采用 [Apache License 2.0](LICENSE)。使用、复制、修改与分发请遵守许可证条款。

## 致谢

本项目的实现参考了以下开源项目，在此表示感谢：

- [OFD 解析流程（CSDN 博客）](https://blog.csdn.net/u013823545/article/details/108151914)：借鉴 OFD 解析流程

- [ofd.js](https://github.com/DLTech21/ofd.js)：借鉴 OFD 解析

- [ofdrw](https://github.com/ofdrw/ofdrw)：OFD 相关代码参考

- [pdf.js](https://github.com/mozilla/pdf.js)：阅读器界面参考

## 项目地址

- Gitee：<https://gitee.com/LaoJia803/ofd-core>

- GitHub：<https://github.com/LaoJia803/ofd-core>

