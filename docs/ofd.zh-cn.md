# ofd.js — OFD 解析与渲染核心引擎

## 概述

`build/ofd.js` 是 OFD 在线阅读器的核心引擎，负责：

- **解析**：读取 OFD（ZIP 容器）文件，解析 OFD.xml / Document.xml / 页面 / 资源 / 签名 / 注解
- **渲染**：将每个页面渲染为 SVG 字符串或 DOM 元素（文本、路径、图像、模板、印章）
- **验证**：文件摘要比对（SM3/SHA）、ASN.1 证书/签名结构解析、签章数据提取（不含签名值 / 证书链 / 时间戳验证）

产物由 `src/` 下的片段拼接而成（`node build/build.js`），在浏览器端挂载为全局对象 `OFD`，同时支持 CommonJS（`module.exports`）导出。

## 设计理念

### IIFE 单文件零依赖

产物是一个 IIFE（立即调用函数表达式），运行时不依赖任何第三方库。XML 解析、SM3 哈希、ASN.1 解析、ZIP 容器结构解析均纯手写实现；Deflate 解压使用浏览器原生 `DecompressionStream`。好处是：

- 体积小、加载快、无依赖冲突
- 同一份代码同时跑在浏览器和 Node.js 中（`typeof window` 判断环境）
- 源码按 `src/shared` / `src/core` / `src/display` 分层维护，构建时拼回同一个单文件（见「目录（大纲）」）

### 懒解析 + 缓存

`load()` 阶段只解析文档元信息（OFD.xml / Document.xml）、资源、签名/印章与注解，收集页面路径列表但**不解析页面内容**。每页的 XML 在首次 `renderPageToString` 时才通过 `ensurePageParsed` 解析，解析结果缓存到页面对象的 `_parsed` 字段（模板同理缓存在 `templates[i]._parsed`）。这样：

- 大文件（千页级）加载阶段不会卡在逐页解析上
- 只渲染需要的页面，未渲染的页面不占内存
- 重复渲染同一页时直接命中缓存

页面解析之外，还有两级渲染结果缓存：

- **页面 SVG 缓存**（`ofd._svgCache`，按 `pageIndex|width` 键控，上限 256 条）：每页最终 SVG 字符串挂在 ofd 实例上。翻页、打印、搜索、PDF 转换（`toPdf` 逐页调 `renderPageToString`）等重复渲染直接返回缓存字符串，命中约 0ms。
- **简写路径缓存**（模块级 `abbrPathCache`，上限 4096 条）：`abbreviatedToSvgPath` 按原始路径字符串 memoize，避免跨页/跨渲染重复 tokenize 同一路径数据。

> 两类缓存（页面 SVG 缓存、简写路径缓存）均由模块内的 `LRUCache` 类（`src/shared/lru.js`）实现：命中时把键移到队尾，容量超限时**淘汰最旧的一个条目**（标准 LRU），不是批量清理。

### SVG 矢量渲染

选择 SVG 而非 Canvas 作为渲染目标：

- 矢量缩放不失真，适合文档场景
- 文本可选可搜，原生支持搜索高亮
- DOM 可交互，签章区域可挂事件
- 坐标系统天然匹配 OFD（Y 轴向下、毫米 user unit）

### 分层架构

引擎源码分三层，判据是「能不能碰 DOM」，不是代码行数：

| 层次 | 职责 | 代表文件 |
| --- | --- | --- |
| shared | 纯工具，无状态可复用 | `util.js`（打点）、`xml.js`、`path.js`、`color.js`、`lru.js` |
| core | 二进制与结构解析，不碰 document/window | `zip.js`、`parser.js`、`image.js`、`md.js`、`seal.js`、`asn1.js`、`verify.js`、`res.js`、`page.js`、`signature.js`、`outline.js`、`annotation.js`、`document.js` |
| display | 渲染与公开 API，唯一允许碰 DOM / FontFace | `font.js`、`svg.js`、`api.js` |

解析层产出纯数据对象，渲染层消费数据产出 SVG 字符串，两层之间无反向依赖。

### 图像按需加载

`load()` 阶段不预载所有图片。`renderPageToString` 渲染某页时，先收集该页引用的图像 ID，`Promise.allSettled` 并行加载（`ensureImageDataUrl`），加载后缓存在 `mm.dataUrl` 上。后续渲染同一图片直接读缓存。

## 函数调用流程

### 加载阶段

```
OFD.load(source)
  ├─ 读取文件数据 (fetch / Blob / ArrayBuffer → Uint8Array)
  ├─ readZip(data)                        → ZIP 句柄
  └─ parseOFD(zip)
       └─ parseDocument(zip)
            ├─ readEntryText(zip, 'OFD.xml')     → 解析文档信息 info
            ├─ readEntryText(zip, docPath)       → 解析 Document.xml
            │    ├─ parseBox()                   → 页面物理尺寸 pageBox
            │    ├─ parseRes(publicRes)          → 公共资源（字体/颜色/图片引用）
            │    ├─ parseRes(documentRes)        → 文档资源，mergeRes 合并
            │    └─ 收集页面路径列表 pages（不解析页面内容）
            ├─ parseSignatures(zip)              → 签名/印章/ASN.1 结构
            ├─ parseOutline(zip)                 → 目录（大纲）
            └─ parseAnnotations(zip)             → 注解（含贴片章）
```

### 渲染阶段

```
OFD.renderPageToString(ofd, pageIndex, opts)
  ├─ 命中 ofd._svgCache 则直接返回
  ├─ ensurePageParsed(ofd, pageIndex)     → 页面 XML 解析（结果缓存 _parsed）
  ├─ 组装图层：背景模板 → 页面图层 → 前景模板
  ├─ 预取：图像 ensureImageDataUrl / 字体 ensureFontLoaded + fetchFontIndex
  ├─ 逐对象 renderObject
  │    ├─ renderPathObject   路径/描边/填充/裁剪
  │    ├─ renderTextObject   文字（字体映射 + DeltaX/DeltaY 逐字定位）
  │    └─ renderImageObject  图像
  ├─ renderStamp / renderAnnot            → 印章与注解贴片
  └─ 拼 <svg viewBox="0 0 W H"> 写入缓存
```

### 签名验证阶段（仅文件摘要比对）

```
OFD.verifySignature(ofd, index)
  ├─ 取 doc.signatures[index]
  ├─ 遍历 references[]：readEntry(zip, fileRef) → hashBytes(data, checkMethod)
  └─ base64ToBytes(checkValue) 与重算摘要 digestMatches 比对
       ├─ 全部一致 → { valid: true,  status: 'valid',   checked, failed: [] }
       ├─ 有不一致 → { valid: false, status: 'invalid', checked, failed }
       └─ 无可验证数据 → { valid: false, status: 'unknown' }
```

## 引入方式

浏览器：

```html
<script src="build/ofd.js"></script>
<!-- 或压缩版 -->
<script src="build/ofd.min.js"></script>
```

Node.js（ZIP 解压依赖 `DecompressionStream`，需 Node 20+）：

```js
const OFD = require('./build/ofd.js');
```

## 核心数据结构

`load()` 返回的 `ofd` 对象：

```js
{
  info,                 // 文档元信息（getDocumentInfo 的数据来源）
  document: {
    docPath,            // Document.xml 所在目录，作为相对路径基准
    pageBox,            // 文档默认页面尺寸 { x, y, w, h }（毫米）
    templates,          // 模板页列表，懒解析结果缓存在各元素 _parsed
    templateById,       // 模板 id → 模板对象 的 Map
    pages,              // 页面列表 [ { id, baseLoc, pagePath, ... } ]
    res,                // 资源表，见下
    stamps,             // 印章贴片（签章 / 注解）
    signatures,         // 签名原始数据（getSignatures 的数据来源）
    outlines,           // 目录（大纲）树
  },
  zip,                  // ZIP 句柄（readEntry / readEntryText 使用）
  _svgCache,            // 页面 SVG LRU 缓存，首次渲染时创建
}
```

资源表 `document.res`：

```js
{
  fonts:        {},     // id → { fontName, fontFile, fontBaseDir, ... }
  colorSpaces:  {},     // id → 颜色空间（含调色板）
  multiMedias:  {},     // id → 图像对象（含 type/format，dataUrl 渲染时补）
  drawParams:   {},     // id → 绘制参数（线宽/线帽/虚线等）
}
```

页面解析结果（缓存在 `pages[i]._parsed`）：

```js
{
  pagePath,
  pageBox,              // 页面自身 Area/PhysicalBox，缺省回落文档 pageBox
  templates,            // [ { templateId, zOrder } ]，zOrder 默认 'Background'
  layers: [ { objects: [ ... ] } ],   // 对象：path / text / image
}
```

## 公开 API

### OFD.load(source)

加载 OFD 文件并解析，返回 `ofd` 对象。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| source | `string` \| `Blob` \| `File` \| `ArrayBuffer` \| `Uint8Array` | 字符串视为 URL（`fetch` 加载，拒绝 `javascript:`/`file:`/`data:` 协议）；其余为二进制数据源 |

```js
// 从 URL 加载
const ofd = await OFD.load('999.ofd');

// 从 <input type="file"> 加载
const file = document.getElementById('fileInput').files[0];
const ofd = await OFD.load(file);

// 从 ArrayBuffer 加载
const buf = await fetch('999.ofd').then(r => r.arrayBuffer());
const ofd = await OFD.load(buf);
```

### OFD.renderPageToString(ofd, pageIndex, opts)

渲染指定页面为 SVG 字符串。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| ofd | object | `load()` 的返回对象 |
| pageIndex | number | 0-based 页码 |
| opts.width | number | 可选，SVG 的 width 属性（不传则由容器决定） |

```js
const svg = await OFD.renderPageToString(ofd, 0);
document.getElementById('container').innerHTML = svg;
```

### OFD.renderPage(ofd, pageIndex, opts)

同 `renderPageToString`，但返回**挂载好的 SVG DOM 元素**，可直接插入页面。无 DOM 环境（Node）退化为返回 SVG 字符串。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| ofd | object | `load()` 的返回对象 |
| pageIndex | number | 0-based 页码 |
| opts.width | number | 可选，SVG 的 width 属性（像素） |

```js
const svgEl = await OFD.renderPage(ofd, 0);
document.getElementById('container').appendChild(svgEl);
```

### OFD.renderAll(ofd, opts)

渲染全部页面，返回 SVG 元素数组（按页码顺序）。

```js
const pages = await OFD.renderAll(ofd);
pages.forEach(svg => container.appendChild(svg));
```

### OFD.getPageCount(ofd)

返回页数。

```js
const total = OFD.getPageCount(ofd);
console.log('共', total, '页');
```

### OFD.getPageDimensions(ofd, pageIndex)

返回 `{ width, height, unit: 'mm' }`，尺寸单位毫米。`pageIndex` 缺省为 0。

```js
const dim = await OFD.getPageDimensions(ofd, 0);
console.log(dim.width + 'mm × ' + dim.height + 'mm');
```

### OFD.getDocumentInfo(ofd)

返回 `{ pageCount, ...info }`（合并文档元信息）。

```js
const info = OFD.getDocumentInfo(ofd);
console.log(info.title, info.author, info.pageCount + '页');
```

`info` 字段：`docId`、`title`、`author`、`subject`、`creator`、`producer`、`creationDate`、`modDate`、`customDatas`（CustomData 键值对）。时间字段为原始串，未格式化。

### OFD.expandDelta(str)

将 OFD 的 `DeltaX/DeltaY` 增量串（空白分隔的数字序列）展开为数组，供文本逐字定位使用。支持 `g N V` 重复语法（其后 N 个增量都取 V）。

```js
const dx = OFD.expandDelta('0 5.2 3.1 -2.0');
// [0, 5.2, 3.1, -2]

const dy = OFD.expandDelta('g 3 1.5 0.2');
// [1.5, 1.5, 1.5, 0.2]
```

### OFD.getSignatures(ofd)

返回签名数组（解析自 `Signatures.xml`），每个签名项结构：

```js
{
  index,               // 签名索引（0-based）
  id,                  // 签名 ID
  signer,              // 签名者（证书 subject / 印章名 / 供应商名，按优先级取）
  signTime,            // 签名时间（已格式化，如 2020-08-17 11:13:29）
  provider,            // 签名供应商
  providerVersion,     // 供应商版本
  checkMethod,         // 摘要算法 OID
  signatureMethod,     // 签名算法 OID
  digestMethod,        // 摘要算法 OID
  references: [        // 被保护文件及其摘要
    { fileRef, checkValue }
  ],
  signedValuePath,     // 签名值文件路径
  signedValueSize,     // 签名值字节数
  signaturePath,       // 签名结构文件路径
  signatureDigest,     // 签名摘要
  signatureValueHex,   // 签名值（十六进制）
  sealAttrs,           // 印章属性 { id, name, type, createTime, notBefore, notAfter }
  pages: [],           // 印章所在页码（1-based）
  positions: [         // 印章位置
    { page, boundary } // page 1-based；boundary 为页面坐标
  ],
  sealImage,           // { type: 'image'|'svg', data }，无印章为 null
}
```

```js
const sigs = await OFD.getSignatures(ofd);
sigs.forEach(s => console.log(s.index, s.signer, s.signTime, s.pages));
```

### OFD.verifySignature(ofd, index)

对第 `index` 个签名做**文件摘要比对**验证，返回：

```js
{
  valid,        // 布尔，是否通过
  status,       // 'valid' | 'invalid' | 'unknown'
  message,      // 人类可读结论
  digestValid,  // 摘要是否全部一致（unknown 时无此字段）
  checked,      // 校验通过的文件清单
  failed,       // 校验失败的文件清单（含原因）
}
```

```js
const res = await OFD.verifySignature(ofd, 0);
console.log(res.status, res.message);
```

> **注意**：只做「文件摘要比对」——把签名里登记的 `CheckValue` 与重新计算的摘要逐字节比对，用于发现文件被改动或受保护文件缺失。签名值验证、证书链验证、时间戳验证均未实现。而且 `CheckValue` 存在 OFD 文件内部，改内容后可被同步重算，所以「验证通过」只说明文件自洽，**不等同于签名真实有效**（见 `src/core/verify.js` 开头注释）。

### OFD.setProfiling(on) / OFD.getLastProfile()

耗时打点开关与结果读取。开启后各阶段耗时以 `console.table` 输出。

```js
OFD.setProfiling(true);
await OFD.renderPageToString(ofd, 0);
const p = OFD.getLastProfile();
// { title: '渲染 第 1 页', rows: [ { 阶段, 增量ms, 累计ms }, ... ] }
OFD.setProfiling(false);
```

### OFD.setFontBase(base)

设置外部字体目录 URL 前缀（以 `/` 结尾）。字体文件按 `encodeURIComponent(字体名) + '.ttf|otf|woff2'` 逐个试探；目录索引用目录列表页（如 nginx autoindex）解析 `href`，取不到索引就直接试文件名。

默认值自动推断：取 `<script src=".../ofd.js">` 所在目录的**上一级** + `font/`，即 `build/ofd.js` 默认找 `<根>/font/`。

```js
OFD.setFontBase('external/font/');
```

> 本仓库把字体放在 `external/font/`，不叫 `font/`，所以页面里要显式调用上面这一句，否则外部字体加载不到（内置字体与 OFD 内嵌字体不受影响）。

### OFD.\_internals

不稳定接口，仅为已有取用方保留：

```js
OFD._internals = {
  parsePage, readEntry, readEntryText, resolvePath,
  parseXml, hashBytes, base64ToBytes, decodeEntities
};
```

- `build/toPdf.js` 用 `base64ToBytes`、`decodeEntities`
- `test/benchmark.html` 用其余六个

新代码请用公开 API；要调试别的内部函数请直接在源码断点。

## 目录（大纲）

```
src/                    源码（裸片段，无 import/export，拼进同一个 IIFE 闭包）
├─ shared/              纯工具：util.js 打点 / xml.js 节点工具 / path.js 路径 / color.js 颜色 / lru.js LRU
├─ core/                解析层：zip / parser / image / md(SM3) / seal / asn1 / verify
│                       res / page / signature / outline / annotation / document
├─ display/             渲染层：font(字体映射与加载) / svg(元素渲染) / api(缓存与公开 API)
└─ index.js             公开 API 汇总（OFD 对象 + _internals 白名单）

build/
├─ build.js             构建脚本：按固定顺序拼接 → ofd.js，terser 压缩 → ofd.min.js
├─ ofd.js               产物（可读版）
├─ ofd.min.js           产物（压缩版）
└─ toPdf.js             OFD → PDF 转换模块（独立件，非引擎一部分）

external/               第三方代码与资源（font/ 字体文件；第三方 JS 由 build.js 拼在产物最前）
```

> 拼接顺序写死在 `build.js` 里，且顺序承重：`class LRUCache`（`src/shared/lru.js`）不提升，而 `src/display/svg.js` 顶层 `new LRUCache(...)` 用到它。改顺序前先看 `build.js` 顶部注释。

## 渲染管线

1. **图层合成**：背景模板 → 页面 Content 的 Layer → 前景模板（`zOrder="Foreground"`），依序拼接 SVG 片段
2. **路径**：OFD 简写路径 → `abbreviatedToSvgPath` 分词 → SVG `d` 属性；填充/描边/线帽/虚线/裁剪按 `drawParams` 解析
3. **文字**：字体名 → `mapFontFamily`（内置栈 / 本地字体 / 外部字体）→ `<text>`；逐字位置用 `expandDelta(DeltaX/DeltaY)` 展开定位
4. **图像**：`ensureImageDataUrl` 把 TIFF/JPEG/BMP 等转 data URL（TIFF 自带 LZW 解码与 BMP 封装），`<image href>` 引用
5. **印章与注解**：签章走 `renderStamp`（内嵌 OFD 印章转 SVG 或位图），注解走 `renderAnnot`
6. **输出**：`<svg viewBox="0 0 W H" class="ofd-page-svg">`，W/H 为毫米

## 关键内部机制

- **相对路径解析**：`resolvePath(base, rel)` 以 `docPath` 为基准处理 `..` / 绝对路径
- **颜色解析**：`parseColor` 支持 `"156 82 35"` / `#9C5223` / `"#ee #20 #25"` / 灰度 `"255"` 与 `Alpha` 通道，结果缓存 `_colorCache`
- **字体加载**：`font.js` 内嵌 `FontFace` 动态加载，`fontLoadCache` 去重，`embeddedFontMap` 收录 OFD 内嵌字体（`parseOFD` 时登记），`fetchFontIndex` 解析外部字体目录索引
- **ZIP 读取**：`readZip` 扫描中央目录，`readEntry` 按条目缓存解压结果（`LRUCache`），`readEntryText` UTF-8 解码
- **摘要算法**：`md.js` 手写 SM3，`hashBytes(data, method)` 按 OID 分发（SM3 / SHA 系列）

## 注意事项

1. 尺寸单位统一为**毫米**；`pageIndex` 一律 **0-based**（`getSignatures` 返回的 `pages`/`positions.page` 除外，它们是 1-based）
2. `verifySignature` 只是文件摘要比对，**不是**签名有效性判定
3. 外部字体需要 `setFontBase` 指向正确目录；本仓库为 `external/font/`
4. `ofd` 对象是不透明句柄，只当参数传，不要读内部字段
5. `_internals` 随时可能变化
6. Node 里跑需要 Node 20+（`DecompressionStream`）
