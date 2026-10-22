# ofd-core 核心引擎 — OFD 解析与 SVG 渲染

> 库名 **ofd-core**；引擎产物文件名 `build/ofd.js`，全局对象 `OFD`。
> 本文后续出现的 `ofd.js` 均指文件，`OFD` 指全局对象。

## 概述

`build/ofd.js` 是 OFD 在线阅读器的核心引擎，负责：

- **解析**：读取 OFD（ZIP 容器）文件，解析 OFD.xml / Document.xml / 页面 / 资源 / 签名 / 注解
- **渲染**：将每个页面渲染为 SVG 字符串或 DOM 元素（文本、路径、图像、模板、印章）
- **验证**：签名值验证（GB/T 38540 SES 的 toSign 用证书 SM2 公钥验签，SM2/SM3）、文件摘要比对（SM3/SHA）、印章与证书有效期校验（按签名时间判定）（不含证书链与信任根 / 吊销查询 / 时间戳验证 / 印章自身签名验证）

产物由 `src/` 下的片段拼接而成（`node build/build.js`），在浏览器端挂载为全局对象 `OFD`，同时支持 CommonJS（`module.exports`）导出。

## 快速上手

```html
<script src="build/ofd.min.js"></script>
<script>
  const ofd   = await OFD.load('document.ofd');   // URL / File / ArrayBuffer / Uint8Array
  const count = OFD.getPageCount(ofd);             // 总页数
  const svg   = await OFD.renderPage(ofd, 0);      // 第 1 页 → SVG DOM 元素
  document.body.appendChild(svg);

  // 数字签名
  const sigs = await OFD.getSignatures(ofd);
  const r    = await OFD.verifySignature(ofd, 0); // { valid, status, message, checks }
</script>
```

Node.js（CommonJS）：

```js
const fs  = require('fs');
const OFD = require('./build/ofd.js');
const ofd = await OFD.load(new Uint8Array(fs.readFileSync('a.ofd')));
const svg = await OFD.renderPageToString(ofd, 0);
```

**运行环境**：需要 `DecompressionStream`（Chrome/Edge 80+、Firefox 113+、Safari 16.4+、Node 18+）。

### 算法自证

SM3 为纯手写实现，已用 GB/T 32905-2016 标准测试向量验证：

```
SM3("abc")      = 66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0
SM3("abcd"×16)  = debe9ff92275b8a138604889c18e5a4d6fdb70e5387e5765293dcba39c0c5732
```

SM2 验签依赖 `external/sm-crypto.js`（国密算法库，已拼入产物）。

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

- **页面 SVG 缓存**（`ofd._svgCache`，按 `pageIndex` 键控，上限 256 条）：缓存只存与宽度无关的 `head/mid/body`，不同 `width` 共享同一份页面内容，输出时再拼 `width` 属性；翻页、打印、搜索、PDF 转换（`toPdf` 逐页调 `renderPageToString`）等重复渲染直接命中。
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
            ├─ readEntryText(zip, 'OFD.xml')     → 解析文档信息 info + Version
            ├─ readEntryText(zip, docPath)       → 解析 Document.xml
            │    ├─ parseBox()                   → 页面物理尺寸 pageBox
            │    ├─ DefaultCS                    → 默认颜色空间 defaultCs
            │    ├─ parseRes(publicRes, zip, defaultCs)   → 公共资源（字体/颜色/图片引用）
            │    ├─ parseRes(documentRes, zip, defaultCs) → 文档资源，mergeRes 合并
            │    ├─ parseCompositeUnits(resPath, zip, ctx) → 复合图元 CompositeGraphicUnit
            │    └─ 收集页面路径列表 pages（不解析页面内容）
            ├─ parseSignatures(signaturesPath, zip)        → 签名/印章/ASN.1 结构
            ├─ parseAnnotations(annotationsPath, zip, ctx) → 注解（含贴片章、通用外观）
            └─ parseOutline / parseOutlineFromXml          → 目录（大纲），内嵌 Outlines 优先，否则 Document_Structure.xml
```

### 渲染阶段

```
OFD.renderPageToString(ofd, pageIndex, opts)
  ├─ 命中 ofd._svgCache 则直接返回
  ├─ ensurePageParsed(ofd, pageIndex)     → 页面 XML 解析（结果缓存 _parsed）
  ├─ 组装图层：背景模板 → 页面图层 → 前景模板
  ├─ 预取：图像 ensureImageDataUrl / 字体 ensureFontLoaded + fetchFontIndex
  ├─ 逐对象 renderObject
  │    ├─ buildPathObject    路径/描边/填充/渐变
  │    ├─ buildTextObject    文字（字体映射 + DeltaX/DeltaY + HScale/方向/描边）
  │    ├─ buildImageObject   图像（完整 CTM）
  │    └─ applyClips         对象级 Clips 裁剪（Path/Text Area）
  ├─ renderStamp / renderAnnot            → 印章与注解贴片
  └─ 拼 <svg viewBox="0 0 W H"> 写入缓存
```

### 签名验证阶段（签名值 + 摘要 + 有效期）

```
OFD.verifySignature(ofd, index)
  ├─ 取 doc.signatures[index]
  ├─ 读 signedValuePath → parseSesSignBlocks 定位 SES 签名块
  │    [待签数据 SEQUENCE, 证书 OCTET, 算法 OID, 签名 BIT STRING]
  ├─ extractCertPublicKey 取证书 SPKI 的 SM2 公钥 → SM_CRYPTO.sm2 验签 toSign 原始 DER
  ├─ 遍历 references[]：readEntry(zip, fileRef) → hashBytes(data, checkMethod)
  ├─ base64ToBytes(checkValue) 与重算摘要 digestMatches 比对
  ├─ checkPeriods：signTime 是否落在 sealAttrs.notBefore~notAfter 内
  │               signTime 是否落在每张证书 Validity 内（collectCerts → extractCertValidity）
  └─ 汇总为 { valid, status, checks: { sigValue, digest, sealPeriod, certPeriod } }
       ├─ 签名值 pass 且其余项非 fail → { valid: true,  status: 'valid' }
       ├─ 任一摘要/有效期 fail        → { valid: false, status: 'invalid' }
       ├─ 摘要 pass 但签名值 unknown  → { valid: false, status: 'partial' }（仅摘要自洽）
       └─ 无可验证数据               → { valid: false, status: 'unknown' }
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
    version,            // OFD.xml 的 Version（如 "1.1"），决定 Clips 的 TransFlag 缺省值
    defaultCs,          // CommonData/DefaultCS 默认颜色空间 id
    pageBox,            // 文档默认页面尺寸 { x, y, w, h }（毫米）
    templates,          // 模板页列表，懒解析结果缓存在各元素 _parsed
    templateById,       // 模板 id → 模板对象 的 Map
    pages,              // 页面列表 [ { id, baseLoc, _parsed } ]，首次渲染时才解析，结果缓存在 _parsed
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
  colorSpaces:  {},     // id → { type: GRAY|RGB|CMYK, bits, palette: [[...]] }
  multiMedias:  {},     // id → 图像对象（含 type/format，dataUrl 渲染时补）
  drawParams:   {},     // id → 绘制参数（线宽/线帽/线接/斜接/虚线 + 描边/填充渐变）
  compositeUnits: {},   // id → CompositeGraphicUnit（懒解析，缓存在 _templateObj）
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
const ofd = await OFD.load('sample.ofd');

// 从 <input type="file"> 加载
const file = document.getElementById('fileInput').files[0];
const ofd = await OFD.load(file);

// 从 ArrayBuffer 加载
const buf = await fetch('sample.ofd').then(r => r.arrayBuffer());
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
  certValidity,        // 证书有效期 [{ notBefore, notAfter }]（已格式化），无证书为 []
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

对第 `index` 个签名做验证，返回：

```js
{
  valid,        // 布尔，是否通过
  status,       // 'valid' | 'invalid' | 'unknown'
  message,      // 人类可读结论
  digestValid,  // 摘要是否全部一致（unknown 时无此字段）
  checked,      // 校验通过的文件清单
  failed,       // 校验失败的文件清单（含原因）
  checks: {     // 逐项结果，每项 'pass' | 'fail' | 'unknown'
    sigValue,    // 签名值验证（SM2 验签 toSign 原始 DER）
    digest,      // 文件摘要比对
    sealPeriod,  // 印章有效期是否覆盖签名时间
    certPeriod,  // 证书有效期是否覆盖签名时间
  },
}
```

判定规则：`valid = 各项均不为 fail`。缺数据记 `unknown`，不判失败，但会写进 `message`（如「未找到 SES 签名块」「印章有效期无数据，未校验」）。

**有效期按「签名时间」判定**，比较基准是 `SignedInfo/SignatureDateTime`，不是当前时间——证书或印章现在已过期，不代表当年那次签署无效。

```js
const res = await OFD.verifySignature(ofd, 0);
console.log(res.status, res.checks, res.message);
```

> **注意**：已实现签名值验证（SM2/SM3）、文件摘要比对、印章与证书有效期。仍未实现：**证书链与信任根校验、吊销状态查询（CRL/OCSP）、时间戳验证、印章自身签名验证**。签名值验证依赖 `external/sm-crypto.js`，该文件缺失时 `checks.sigValue` 返回 `unknown`（其余项照常）。另外 `CheckValue` 存在 OFD 文件内部、可被同步重算，所以真正的信任依据是签名值 + 证书有效性（见 `src/core/verify.js` 开头注释）。

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

设置外部字体目录 URL 前缀（以 `/` 结尾）。字体文件按 `encodeURIComponent(字体名) + '.ttf|otf|woff2'` 逐个试探。

默认值自动推断：取引擎 `<script>`（**同时识别 `ofd.js` 与 `ofd.min.js`**）所在目录的**上一级** + `font/`，即 `build/ofd.min.js` 默认找 `<根>/font/`。`npm run build` 还会在仓库根创建这个 `font/`（含 `README.txt` 占位），把字体放进去即可生效，无需调用 `setFontBase`。

```js
OFD.setFontBase('assets/font/');   // 仅当字体目录放在别处时才需要
```

> **外部字体依赖目录清单。** 引擎靠解析目录页里的文件 `href` 建索引，所以该目录必须**开启目录列表**才能用（如 nginx `autoindex on`，或 `serve` / `http-server` 的默认目录页）。不列目录的静态服务器抓取目录时返回 404，`fetchFontIndex()` 返回 `null`，即使文件存在也不会加载。
> 目录缺失或不可列时，渲染会静默回退到 OFD 内嵌字体与内置系统字体栈映射（声明了却加载不了的内嵌字体同样回落系统栈）。仅在 OFD 内嵌字体缺失或不全时才有必要自备外部字体。

### OFD.version

字符串，如 `"1.0.0"`。构建时从 `package.json` 的 `version` 注入（同时写入文件头注释与 dist 包名），始终与发布版本一致。

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

external/               vendored 第三方代码：sm-crypto.js（SM2/SM3，供签名值验证；由 build.js 拼在产物最前）、pdf.min.js（Apache-2.0，列在 build.js 的 `STANDALONE` 名单，不并入引擎、当前无使用方）
font/                   外部字体投放目录；由 `npm run build` 创建，自动识别为外部字体目录（见 `OFD.setFontBase`）
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
- **颜色解析**：`parseColor(el, res, defaultCs)` 读 `Value`（空格分隔的分量，每段可为十进制或 `#` 前缀十六进制，如 `"#ee #20 #25"`）、`ColorSpace`（缺省回退 `DefaultCS`）与 `Alpha`；按引用的颜色空间判定 GRAY/RGB/CMYK 与分量位宽（`BitsPerComponent`）缩放，带 `Index` 时取调色板 `CV` 项。`colorToCss` 负责序列化为 CSS 颜色并用 `_colorCache`（256 条）记忆化
- **字体加载**：`font.js` 内嵌 `FontFace` 动态加载，`fontLoadCache` 去重，`embeddedFontMap` 收录 OFD 内嵌字体（`parseOFD` 时登记），`fetchFontIndex` 解析外部字体目录索引；`parseDocument` 在登记新文档前调用 `resetFontCaches()`，清空这些缓存并把 `document.fonts` 里 `ofdf_` 前缀的旧 `FontFace` 删掉，打开第二份文档不会复用上一份的字体
- **ZIP 读取**：`readZip` 扫描中央目录，`readEntry` 按条目缓存解压结果（`LRUCache`），`readEntryText` UTF-8 解码
- **摘要算法**：`md.js` 手写 SM3，`hashBytes(data, method)` 按 OID 分发（SM3 / SHA 系列）

## 安全与健壮性

本引擎会解析不受信任的 OFD 文件。以下防护已在代码中实现，但**未经过专业安全审计**，处理外部文件前请自行评估风险。

### 已实现的防护

| 风险 | 对策 | 位置 |
| --- | --- | --- |
| 解压炸弹 | 单条目解压体积上限 **256 MB**，解压前按声明值拦一次、解压后按实际值再拦一次 | `core/zip.js` `MAX_UNCOMPRESSED_SIZE` |
| 内存膨胀 | ZIP 条目缓存上限 **64 项**（LRU）；SVG 页面缓存 256 项；简写路径缓存 4096 项 | `core/zip.js`、`display/api.js`、`display/svg.js` |
| 恶意 URL | 拒绝 `javascript:` / `file:` / `data:` 协议 | `display/api.js` `load()` |
| 畸形 XML 实体 | 字符引用做码点合法性校验，代理区与超 Unicode 上限的引用返回 U+FFFD，不抛 `RangeError` 中断解析 | `core/parser.js` `decodeEntities` |
| 标签不匹配 | 闭合标签与栈顶不匹配时抛明确错误（含标签名与位置），而非静默产出错乱结构 | `core/parser.js` `parseXml` |
| 单点失败拖垮全局 | 签名、批注、目录解析各自 `try/catch`，失败仅 `console.warn`；图像解码失败返回 `null` 占位 | `core/document.js` |
| ZIP64 | 显式检测并报错「暂不支持」，不误读偏移 | `core/zip.js` |

### 未覆盖的风险

- **压缩比异常**：只卡绝对体积（256 MB），未卡压缩比。理论上仍可用高压缩比条目消耗 CPU。
- **解析器复杂度攻击**：XML 解析为单遍线性扫描，无嵌套深度上限。构造深度嵌套的 XML 可消耗栈空间。
- **图像解码器**：`core/image.js` 的 TIFF/LZW 解码器为手写实现；已限制 TIFF 32MP、BMP 160MB 及 LZW 单条带输出上限，但仍建议只处理可信文件。
- **验签不等于可信**：见下节。

## 签名验证的能力边界

这是最容易被误用的部分，务必读完。

### 已实现

| 检查项 | 做法 |
| --- | --- |
| **SM2 签名值验证** | 解析 GB/T 38540 SES 结构，取 `toSign` 的**原始 DER 字节**，用签章人证书的 SM2 公钥验签 |
| **文件摘要比对** | 遍历 `References[]`，按 `CheckMethod` 重算摘要（SM3 / SHA-1 / 256 / 384 / 512）与 `CheckValue` 逐字节比对 |
| **有效期校验** | 印章 `notBefore`/`notAfter`、签名数据内**所有**证书的 `Validity`，是否覆盖**签名时刻** |

签名算法 OID `1.2.156.10197.1.501`（SM2withSM3）之外的算法返回 `unknown` 而非 `fail`。

有效期按**签名时间**（`SignatureDateTime`）判定，与当前时间无关 —— 证书今天过期不代表当时签错了。

### 未实现

- **证书链与信任根验证**
- **吊销状态**（CRL / OCSP）
- **时间戳（TSA）验证**
- **印章自身签名验证**

### 为什么 `valid: true` 不等于「签名可信」

签名证书是**按原样信任**的 —— 代码从 `SignedValue` 里取出证书、用它的公钥验签，**不构建证书链、不查信任根**。任何人自己生成一对密钥、自签一张证书，都能通过验证。

另外，`CheckValue` 摘要存放在 OFD 文件**内部**，改动文件内容后可以同步重算摘要。所以「摘要一致」只说明文件自洽；**签名值验证才是身份与完整性的依据**。

### 返回结构

```js
const r = await OFD.verifySignature(ofd, 0);
// {
//   valid: false,
//   status: 'invalid' | 'unknown' | 'partial', // 'valid' 时 valid 为 true；
//                                  // 'partial' 表示摘要一致但签名值未验证，valid 为 false
//   message: '验证失败：Doc_0/xxx.xml（摘要不一致）',
//   digestValid: false,              // 摘要是否一致
//   checked: ['Doc_0/a.xml', ...],   // 摘要一致的文件
//   failed:  ['Doc_0/b.xml（文件缺失）', ...],
//   checks: {
//     digest:     'pass' | 'fail' | 'unknown',
//     sigValue:   'pass' | 'fail' | 'unknown',
//     sealPeriod: 'pass' | 'fail' | 'unknown',
//     certPeriod: 'pass' | 'fail' | 'unknown',
//   },
// }
```

`status: 'unknown'` 表示**数据不足无法判断**，不是「验证通过」。UI 上必须与 `valid` 区分显示，不能把 `unknown` 当作 `valid`。

摘要比对的一个兼容处理：部分国密厂商 SDK 会把摘要写入固定长度缓冲区（实测 128 字节）并在尾部补零，因此 `CheckValue` 长度可能大于摘要本身。`digestMatches()` 允许「尾部全为 0」的补零形态，只比对前 `digest.length` 字节。

## 实现要点

以下几处是踩过坑后定下的设计，**改动前请先读代码注释**，它们大多反直觉。

### 内嵌字体的 key 形态必须与 family 名一致

`registerEmbeddedFonts()` 登记用的 key，必须与 `mapFontFamily()` 产出的 family 名**完全一致**，否则 `loadFontFace()` 按 family 名反查会 miss。

`mapFontFamily` 用的是 `uniqueFamily(fontId, v.base)`，而 `v.base` 是 `splitFontVariant()` **剥掉变体后缀后的基名**：

```
res.fonts[1289].fontName = "DengXian-Regular"
                           ↓剥 -Regular
mapFontFamily 产出 family = "ofdf_1289_DengXian"
```

若 `registerEmbeddedFonts` 按**原名**登记，key 就是 `ofdf_1289_DengXian-Regular` —— 查不到。

**失败链条**（这正是「所有字体都显示为黑体」的成因）：

```
查找 miss → emb = null
  → 退回 fetchFontIndex() 拉 font/ 目录
  → 该目录不存在，catch(() => null) 静默返回
  → new FontFace() 从未注册
  → CSS 落最后一个 family: sans-serif
  → Windows 上 sans-serif 默认解析为**黑体**
```

**症状对照**：全文档字体突变成黑体/无衬线，且内嵌字体明明存在（`res.fonts` 里有 `fontFile`），就是这个问题。

**修法**：`registerEmbeddedFonts()` 同时登记四个 key —— `ofdf_<id>_<base>`、`ofdf_<id>_<原名>`、裸 `base`、裸 `原名`；`hasEmbeddedFont()` 两种 base/raw 形态都试；`loadFontFace()` 不要拼 `ofdf_<id>_<id>` 这种错 key。

### 内嵌字体必须按 Font ID 区分

OFD 允许同一个 `FontName` 声明多次，不同 ID 指向不同字体文件。实测某文档里5 个不同 ID（121–125）都叫 `Calibri`，各自的 cmap / 字形集完全不同。

若只用 `fontName` 做 key，`ensureFontLoaded('Calibri')` 只会加载第一个，其余 4 个的 `@font-face` 从未注册 —— 浏览器静默回退系统字体，字形与度量全乱。

**做法**：family 名用 `ofdf_<FontID>_<FontName>` 保证唯一（`uniqueFamily`），cmap 也按这个唯一名缓存。

### 字体优先级：内嵌 > 系统栈 > 本地 > 外部目录

旧顺序是「系统字体优先」，导致 Helvetica 映射到系统 Arial、Calibri 映射到系统 Calibri，内嵌字体永远加载不上。`mapFontFamily` 已改为内嵌优先。

锁定内嵌字体以「真正加载成功」为前提：`mapFontFamily` 只有在 `loadFontFace()` 成功（记入 `embeddedLoaded`）时才锁定 `ofdf_<id>_<name>` 唯一名。若字体只是「声明为内嵌」、文件却不在包里，就不再死锁在一个未注册的 `@font-face` 上，而是继续回退到系统字体栈 / 本机字体 / 外部 `font/` 目录 —— 与 WPS、PDF 原稿渲染一致。

### 内嵌字体必须先登记，再收集字体名

`renderPageToString` 里 `registerEmbeddedFonts(doc.res.fonts)` 必须**先于**字体名收集执行。`hasEmbeddedFont()` 依赖 `embeddedFontMap`，顺序颠倒会把所有字体判为「无内嵌」。

### 无轮廓字符：cmap 与 Glyphs 双重确认

子集字体里大量字符用**私有区假码**（U+E000–U+E0FF）。实测 Calibri-Bold 子集里 `n/k/h/c/o/A` 的 cmap 全都没有，只有等量的私有区条目。

正确判据（两者都指向「无轮廓」才跳过）：

1. cmap 查不到该码位（`hasGlyphFor` 为 false），**且**
2. `Glyphs` 对应位置是占位 gid（`gid === 1`）或没有 Glyphs 信息

只看 cmap 会把整片正文误杀（实测 117 处）；只看 `gid === 1` 会漏判 —— 某文档第 11 页的 `#` 拿到 gid 17 就被画了出来。

跳过后**保留 `DeltaX` 占位**，后续字符绝对坐标不受影响。

### CTM 与坐标的组合变换

图元实际位置 = `Boundary` 原点 + `CTM·(局部坐标)`。渲染时统一为：

```
translate(boundary.x boundary.y) matrix(a b c d e f)
```

`CompositeObject` 展开时还要抵消 Unit 的局部原点：

```
translate(obj.boundary) · obj.ctm · translate(-unit.boundary)
```

### 模板图层顺序

背景模板（`zOrder != "Foreground"`）→ 页面 Content 的 Layer → 前景模板。顺序反了会让前景模板被页面内容盖住。

### `text` 只剥离 XML 缩进空白

`TextCode` 的文本要剥掉 XML 格式化产生的换行缩进，但**必须保留行内首尾空格** —— 它们按 `DeltaX` 占位，误删会导致后续字符合并到窄间距重叠。

### 描边线豁免裁剪区判定

表格框线横跨整行/整列，往往在「单元格裁剪区建立之前」就已发出，或跨越多个裁剪区。若按裁剪区剔除，会误杀大量框线。

## 注意事项

1. 尺寸单位统一为**毫米**；`pageIndex` 一律 **0-based**（`getSignatures` 返回的 `pages`/`positions.page` 除外，它们是 1-based）
2. `verifySignature` 的能力边界见上文「签名验证的能力边界」一节
3. 外部字体目录仓库不提供，需自行创建后用 `setFontBase` 指定；缺失时静默降级，不影响渲染
4. `ofd` 对象是不透明句柄，只当参数传，不要读内部字段
5. `_internals` 白名单随时可能变化，仅供 `toPdf.js` 与调试页使用
6. Node.js 需要 **18+**（`DecompressionStream`）
7. ZIP64 格式暂不支持，遇到会明确报错

## 常见故障排查

### 字体

**症状：所有字体都显示为黑体 / 无衬线**

几乎都是内嵌字体查找 miss。诊断：

```js
const ofd = await OFD.load('doc.ofd');
const fonts = ofd.document.res.fonts;
console.log('字体数', Object.keys(fonts).length);
console.log('带内嵌文件的', Object.values(fonts).filter(f => f.fontFile).length);
```

带 `fontFile` 却显示为黑体 → 查 `registerEmbeddedFonts` 的 key 形态是否与
`mapFontFamily` 产出的 family 名一致（见上文「实现要点」）。

渲染结果的 font-family 应该是 `"ofdf_<FontID>_<基名>"`，若出现裸字体名或
`Arial,Helvetica,sans-serif` 这类系统栈，说明该字体没匹配上内嵌文件。

**症状：字形是错的 / 乱码**

同名字体多 ID 时只有第一个生效，见「内嵌字体必须按 Font ID 区分」。

**症状：某字符显示成别的符号**

子集字体缺该码位的轮廓。引擎已用「cmap + Glyphs 双重确认」剔除无轮廓字符，
但如果转换器把私有区假码当成了真字符，仍会画错 —— 这是**转换侧**（`pdf2ofd.js`）
的问题，不是渲染侧。

### 渲染

**症状：整页内容不显示 / 被裁掉**

引擎会读取并应用图元对象上的 `<ofd:Clips>`（多个 Clip 取交集，Clip 内多个 Area 取并集，
按 `TransFlag` 决定是否受图元自身 CTM 影响）。但 `pdf2ofd` 转换器不会输出 `<ofd:Clips>`
（见 PDF→OFD 文档）。若整页被裁掉，先确认 OFD 里 Clip 的路径与 `Boundary/CTM` 是否符合预期。

**症状：单页渲染报错但其他页正常**

单页解析失败通常不抛异常（降级为空页）。用性能打点定位：

```js
OFD.setProfiling(true);
await OFD.renderPage(ofd, 10);
console.table(OFD.getLastProfile());
```

### 验签

**症状：`status: 'unknown'`**

不是验证通过，是**数据不足无法判断**。常见原因：签名算法不是
`1.2.156.10197.1.501`（SM2withSM3）、`SignedValue` 缺失、或签名文件本身
没有内嵌 `References` 摘要。UI 必须与 `valid` 区分显示。

**症状：明明改了文件，摘要校验却通过**

`CheckValue` 存放在 OFD 文件**内部**，可随篡改内容同步重算。
「摘要一致」只说明文件自洽。签名值验证（`checks.sigValue`）才是完整性依据。
