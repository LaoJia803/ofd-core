# ofd2pdf.js — OFD → PDF 前端转换模块

> **成熟度提示（beta / 演示级）**：本模块处于 beta 阶段，且源码头部自述为「**演示级**」——即转换结果可用于预览与一般流转，但**不保证与 OFD 原件逐像素一致**。API 与行为可能随版本演进而调整。用于正式归档、合同、票据等场景前，请务必人工核对输出文件。

## 概述

`build/ofd2pdf/ofd2pdf.js` 是纯前端的 OFD → PDF 转换模块（beta 版本），复用 `ofd.js` 的公开 API：

- 逐页调用 `OFD.renderPageToString()` 得到毫米坐标的 SVG 字符串
- 将 SVG 内容映射为 PDF 页面内容流（Content Stream）
- 组装完整的 PDF 字节返回（`Uint8Array`），不依赖任何后端服务

模块以 IIFE 打包，浏览器端挂载为全局对象 `TOPDF`，同时支持 CommonJS（`module.exports`）导出。

同一个构建有两种输出形态：

| | 命令 | 输出 |
| --- | --- | --- |
| 仓库产物 | `npm run build:ofd2pdf` | `build/ofd2pdf/ofd2pdf.js` + `build/ofd2pdf/ofd2pdf.min.js` |
| 模块 zip | `npm run build:zips` | `dist/<版本>/ofd2pdf.zip`（包内为 `ofd2pdf/ofd2pdf.js` + `ofd2pdf/ofd2pdf.min.js`；该命令会先构建三个模块） |
| npm 包（`ofd2pdf`） | `npm run build:ofd2pdf-npm` | `dist/<版本>/ofd2pdf/`（`lib/ofd2pdf.js` + `lib/ofd2pdf.min.js`，并生成 `package.json` / `README.md` / `LICENSE`） |

npm 包是依赖式的：它在 `dependencies` 里声明 `ofd-core`，**不**把引擎打进包内，所以安装时要一起装（`npm install ofd2pdf ofd-core`）。

## 设计理念

### 复用核心渲染管线

不重复解析 OFD，直接依赖 `ofd.js` 的 `renderPageToString` / `getPageDimensions` / `getPageCount`。因此页面中的矢量、文本、图像、印章与**注释（高亮/下划线等）**都会随 SVG 一并转换，保持与预览器一致的呈现效果。

### SVG → PDF 内容流映射

| SVG 元素 | PDF 映射 |
| --- | --- |
| `<path>` | `M/L/C/Q/A/Z` 直转 PDF 路径（Q 二次贝塞尔转三次、A 弧拆分为三次贝塞尔） |
| `<rect>` / `<ellipse>` | 转为对应 PDF 绘制操作 |
| `<text>` | ASCII 用标准 14 字体（Helvetica / Times / Courier，含粗斜体变体）；中文用 Adobe-GB1 标准 CID 字体（宋体 `/STSong-Light`、黑体 `/STHeiti-*`、楷体 `/STKaiti`、仿宋 `/STFangsong-Light`）。均不嵌入字体文件 |
| `<image>` | JPEG 直嵌（`DCTDecode`，按 SOF 通道数选 `DeviceGray`/`DeviceRGB`/`DeviceCMYK`）；PNG / BMP（1/4/8/24/32 位、RLE8/RLE4）/ GIF（透明、LZW、隔行）解码为 RGBA 后 Flate 压缩，透明通道保留（生成 `SMask`）；`opacity` 映射为 ExtGState |
| `<g>` | `q`/`Q` 包裹，`transform` 映射为 PDF `cm`，`opacity` / `mix-blend-mode` 映射为 ExtGState，`clip-path` 生效 |
| `clipPath` | 支持 `<rect>` / `<path>` / `<ellipse>` 组成的裁切路径，映射为 `W n`（evenodd 用 `W* n`）；`<g>` 与各图元的 `clip-path` 均生效 |
| 渐变（`linearGradient` / `radialGradient`） | 映射为 PDF 着色字典（`/ShadingType 2` 轴向、`/ShadingType 3` 径向，`/FunctionType 3` 分段函数），路径先裁切再 `sh` 上色；渐变描边与渐变文字退化为中值纯色，色标透明度用平均 alpha 近似 |

单位换算：1 mm = 72/25.4 pt，页面尺寸由 `getPageDimensions` 提供。

### 图像资源去重与共享

转换过程中维护 `imageReg` / `alphaReg` 注册表，同一张图、同一个透明度值只注册一次，页面间复用（`Im0`、`GS0`…），避免 PDF 体积膨胀。

### 图像解码路径

图像解码分两条路径，输出统一为 RGBA：

- **浏览器**：JPEG 直接嵌入（`/DCTDecode`，不解码）；PNG/BMP/GIF 交给 canvas 解码（Blob → Image → `getImageData`），浏览器能显示的图像形式都能处理（PNG 隔行、RLE、GIF 动画等），GIF 动画取首帧，透明通道由浏览器原生解析
- **Node**：回退到内置纯 JS 解码器（`decodePng` / `decodeBmp` / `decodeGif`），支持 PNG（8/16 位、灰度/真彩/调色板/RGBA、Adam7 隔行）、BMP（1/4/8/24/32 位、RLE8/RLE4）、GIF（87a/89a、透明、隔行）

RGBA 数据经 deflate 压缩后写入 PDF；存在半透明像素时，额外生成一张 DeviceGray 灰度图作为 SMask 表达 alpha。

## 引入方式

浏览器（**必须先加载 ofd.js**）：

```html
<script src="build/ofd/ofd.js"></script>
<script src="build/ofd2pdf/ofd2pdf.js"></script>
<script>
  // TOPDF 全局对象可用
</script>
```

CommonJS（Node）：

```js
const OFD   = require('./build/ofd/ofd.js');
const TOPDF = require('./build/ofd2pdf/ofd2pdf.js');
```

`ofd2pdf.js` 内部通过 `getCore()` 延迟解析依赖：浏览器取 `window.OFD`；Node 下依次尝试同目录 `./ofd.js`、`../ofd/ofd.js`（仓库构建树）与 npm 依赖 `ofd-core`。

装上 npm 包后可直接按包名引入，不需要相对路径：

```js
const TOPDF = require('ofd2pdf');   // 自动解析依赖的 ofd-core
```

## 公开 API

### TOPDF.ofdToPdf(ofd, opts)

将 OFD 文档转换为 PDF 字节。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| ofd | object | `OFD.load()` 的返回对象 |
| opts.title | string | PDF 标题，可选 |
| opts.author | string | PDF 作者，可选 |
| opts.subject | string | PDF 主题，可选 |
| opts.renderOpts | object | 透传给 `renderPageToString` 的渲染选项（如 `width`），可选 |
| opts.onProgress | function | 进度回调 `(done, total)`，逐页转换后调用，可选 |

返回：`Promise<Uint8Array>`，即 PDF 文件字节。

```js
const pdf = await TOPDF.ofdToPdf(ofd, {
  title: '发票',
  onProgress: (done, total) => console.log(`${done}/${total}`)
});
```

### TOPDF.svgToPdf(svgString, pageWmm, pageHmm, opts)

将单页 SVG 字符串转换为 PDF 字节（便于调试单个页面）。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| svgString | string | `renderPageToString` 产出的 SVG 字符串 |
| pageWmm | number | 页面宽度（毫米） |
| pageHmm | number | 页面高度（毫米） |
| opts | object | 同 `ofdToPdf` 的元信息选项 |

返回：`Promise<Uint8Array>`。

### TOPDF._internals

暴露内部函数，便于扩展/调试：

```js
const {
  svgToContentStream,  // (svgStr, pageWmm, pageHmm, ctx) => Promise<string>
  parseSvgXml,         // (str) => 裸节点 {tag, attrs, children, text}
  pathToPdf,           // (svgD) => PDF 路径操作符串
  parseTransform,      // (str) => 变换矩阵
  assemblePdf          // (pages, imageReg, alphaReg, opts) => Uint8Array
} = TOPDF._internals;
```

`parseXml` 作为 `parseSvgXml` 的旧名保留为别名，新代码请用 `parseSvgXml`。

> **与 ofd.js 的同名 API 不可混用**，两者返回结构不同：
>
> | 函数 | 输入 | 返回 |
> | --- | --- | --- |
> | `TOPDF._internals.parseSvgXml(str)` | ofd.js 自己产出的 SVG（可信、结构已知） | 裸节点，宽松解析 |
> | `OFD._internals.parseXml(str)` | 不可信的 OFD 输入 | `{ documentElement }`，显式栈 + 严格校验标签匹配 |
>
> 颜色的 `parseCssColor(str)`（解析 CSS 颜色串）与 `OFD._internals.parseColor(el)`
> （读 OFD 元素的 `Value`/`Alpha` 属性）同样是两个不同的东西。

## 完整示例

### 浏览器：转换并下载

```js
// 先加载 ofd.js 与 ofd2pdf.js
const file = document.getElementById('file').files[0];
const ofd  = await OFD.load(await file.arrayBuffer());
const pdf  = await TOPDF.ofdToPdf(ofd, { title: '发票.pdf' });
const blob = new Blob([pdf], { type: 'application/pdf' });
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = '发票.pdf';
a.click();
```

### Node：转换并写文件

```js
const fs  = require('fs');
const OFD   = require('./build/ofd/ofd.js');
const TOPDF = require('./build/ofd2pdf/ofd2pdf.js');

(async () => {
  const data = new Uint8Array(fs.readFileSync('a.ofd'));
  const ofd  = await OFD.load(data);
  const pdf  = await TOPDF.ofdToPdf(ofd, { title: 'a.ofd' });
  fs.writeFileSync('a.pdf', Buffer.from(pdf));
})();
```

## 安全与资源限制

`ofd2pdf.js` 会处理 OFD 中的图像与文本，转换大文档时可能占用可观内存。

### 已实现的限制

| 限制 | 值 | 位置 |
| --- | --- | --- |
| 单张图像解码像素上限 | **1 亿像素**（约 400 MB RGBA） | `checkImageSize()` |
| 图像尺寸合法性 | 宽高必须 > 0，否则跳过并报错 | `checkImageSize()` |
| 解码失败隔离 | 单张图像失败仅 `console.warn` 并跳过，页面其余内容正常输出 | `svgToContentStream` |
| ZIP 解压体积上限 | 256 MB/条目（由核心引擎提供） | `ofd.js` |

图像像素上限是**必需的**：图像头里的宽高由文件自行声明、可被伪造，不限上限的话一个几 KB 的文件就能触发巨额内存分配导致 OOM。

### 需要注意

1. **转换是全页量的**。`ofdToPdf` 会逐页渲染并累积内容流，大文档（数百页、多图）峰值内存可能达到数百 MB。建议在 Worker 中运行或分批处理。
2. **不解压页面层裁剪**。若 OFD 里有超大背景块，转换结果可能包含本应被裁掉的区域（核心引擎采用「只剔除、不表达」策略，详见核心引擎文档）。
3. **不校验 SM2/SM3**。本模块只做格式转换，不做任何签名验证。输出的 PDF 不含数字签名，**不要当作已签名的文档流转**。
4. **Beta / 演示级**。未覆盖 PDF 全部特性（表单、超链接、加密等），正式场景请评估兼容性。

## 注意事项

- **依赖顺序**：`ofd2pdf.js` 必须后于 `ofd.js` 加载，否则 `ofdToPdf` 抛出「需要先加载 ofd.js」
- **压缩能力**：浏览器优先用 `CompressionStream`，Node 用内置 `zlib`；两者都不可用时 deflate 失败
- **字体**：ASCII 走标准 14 字体（Helvetica / Times / Courier，粗体与斜体用对应的 -Bold / -Italic 变体），中文走 Adobe-GB1 标准 CID 字体（宋体 `/STSong-Light`、黑体 `/STHeiti-Light` 与 `/STHeiti-Regular`、楷体 `/STKaiti`、仿宋 `/STFangsong-Light`）；都不嵌入字体文件，字形由阅读器决定（非黑体字体的粗体用描画两遍近似）
- **图像格式**：支持 JPEG（直嵌）、PNG、BMP（1/4/8/24/32 位，含 RLE 压缩）、GIF（87a/89a，含透明与隔行）；TIFF 由 `ofd.js` 预先转换为 BMP 数据源后一并支持；不支持的格式或解码失败会 `console.warn` 并跳过该图像（页面其余内容不受影响）
- **透明通道**：浏览器经 canvas 原生解码、Node 经纯 JS 解码为 RGBA，保留 alpha 并生成 SMask；GIF 多帧动画仅取首帧
- **已知与原件可能存在差异**：字形由阅读器内置字体决定（不嵌入字体文件，个别字可能缺字）、注释与印章显示可能不完整、渐变描边与文字只能用纯色近似

