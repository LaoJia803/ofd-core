# pdf2ofd — PDF → OFD 转换

> **成熟度提示（beta）**：本模块处于 beta 阶段。转换结果可用于预览与一般流转，版面、文字、内嵌字体、图像、渐变与线型均已对齐，但**不保证与 PDF 原件逐像素一致**，也不支持表单域、注释与Type3 字体。API 与行为可能随版本演进而调整。用于正式归档、合同、票据等场景前，请务必人工核对输出文件。

## 概述

把 PDF 转成符合 **GB/T 33190**（电子文件存储与交换格式·版式文档）的 OFD 包，保留可搜索文字、内嵌子集字体与位图，图表以矢量路径、渐变填充与虚线线型表达。

- **解析**：用 pdf.js（`pdfjs-dist` 的 ESM 版本）读取 PDF，拿到每页的绘制指令流与文本层
- **映射**：矢量路径 → `PathObject`，文本 → `TextObject`，图像 → `ImageObject` + PNG 资源，Form XObject → **内联展开**为页面级图元
- **打包**：生成 `OFD.xml` / `Document.xml` / `PublicRes.xml` / `DocumentRes.xml` / 各页 `Content.xml`，用 ZIP（deflate）封装

产物可被 `ofd.js` 直接回读渲染，也可在 WPS、数科等第三方 OFD 阅读器打开。

## 两种用法

### 一、npm 包（推荐）

```bash
npm install pdf2ofd pdfjs-dist
```

`pdfjs-dist` 是 **peerDependency**（≥ 4），需单独安装 —— 它负责解析 PDF，本包只做 OFD 侧的输出。本包自身零运行时依赖。

仓库内自行组装：

```bash
npm run build:pdf2ofd        # 转换器产物 → build/pdf2ofd/（pdf2ofd.js / pdf2ofd.min.js）
npm run build:pdf2ofd-npm    # npm 包 → dist/<版本>/pdf2ofd/
```

### 二、源码树直接跑

```bash
node build/pdf2ofd/pdf2ofd.js input.pdf                # 输出 input.ofd
node build/pdf2ofd/pdf2ofd.js input.pdf output.ofd     # 指定输出路径
```

## 命令行

npm 包提供的 `pdf2ofd` 命令：

```bash
pdf2ofd input.pdf                # 输出 input.ofd
pdf2ofd input.pdf out/result.ofd # 指定输出
pdf2ofd -q input.pdf out.ofd     # 静默
pdf2ofd --help
```

进度与统计信息走 stderr，转换正常时输出：

```
  已处理 14/14 页
完成：out/result.ofd（14 页，24 字体，90 图像，875598 字节）
```

## 代码调用

```js
const { convert } = require('pdf2ofd');

const stats = await convert('input.pdf', 'output.ofd', {
  onProgress: (done, total) => console.log(`${done}/${total}`),
  quiet: true,          // 静默，不打印进度与统计
});
// stats = { pages, fonts, images, bytes }
```

`ofdPath` 省略时与输入同名（`.pdf` → `.ofd`）。

批量：

```js
const { convertMany } = require('pdf2ofd');

// 顺序执行，避免大文件并发吃满内存
await convertMany(['a.pdf', 'b.pdf'], { quiet: true });

// 也可逐项指定输出与选项
await convertMany([
  { from: 'a.pdf', to: 'out/a.ofd' },
  { from: 'b.pdf', options: { quiet: true } },
]);
```

## 导出成员

| 成员 | 说明 |
| --- | --- |
| `convert(pdfPath, ofdPath?, options?)` | 主转换函数，返回统计对象 |
| `convertMany(list, options?)` | 批量转换，顺序执行，返回统计对象数组 |
| `ZipWriter` | 最小 ZIP 写入器（deflate），`add(name, data)` + `build()` |
| `encodePng(width, height, rgba)` | RGBA → PNG 字节 |
| `PT_TO_MM` | 点到毫米换算系数 `25.4/72` |
| `version` | 包版本号 |

`options` 只支持两个字段：`onProgress(done, total)` 与 `quiet`。**没有** `cMapUrl` / `maxPages` / `imageWaitMs` / `defaultFont` 等参数 —— pdf.js 的资源路径由包内按 `require.resolve('pdfjs-dist/…')` 自行解析，不依赖调用方传路径。

## 环境要求

- **Node.js 18+**（用到 `fs` / `zlib` / ESM 动态 `import()`）
- **pdfjs-dist ≥ 4**（源码树里已在 `devDependencies`，npm 包里是 peerDependency）

本模块**仅在 Node 环境运行**。早期版本做过浏览器双端支持（`rt` 运行时适配层 + Buffer polyfill），已按需求移除 —— 浏览器缺少 `zlib`，PNG 的 IDAT 只能退化成zlib 存储模式（体积膨胀十余倍），维护成本高于收益。

## 产物结构

```
OFD.xml                              文档根（DocID / 创建时间 / DocRoot）
Doc_0/Document.xml                   页面清单 + PublicRes / DocumentRes 引用
Doc_0/PublicRes.xml                  字体声明（ofd:Font → FontFile）
Doc_0/DocumentRes.xml                图像声明（ofd:MultiMedia）
Doc_0/Res/font_<id>_<id>.otf|ttf     内嵌字体二进制
Doc_0/Res/image_<id>.png             图像资源
Doc_0/Pages/Page_<n>/Content.xml     各页图元
```

`DocumentRes.xml` 里**没有** `CompositeGraphicUnits` —— 见下文「复合图形单元」。

## 实现要点

以下几处是踩过坑后定下的实现，改动前请先读代码注释。

### 坐标与单位

`1pt = 25.4/72 mm`；PDF Y 轴向上、OFD Y 轴向下。

图元坐标**保留 PDF 用户空间原值**，把「CTM + pt→mm + Y 轴翻转」整体交给 OFD 的 CTM 属性表达，而不是在生成路径点时把矩阵烘焙进去。旋转 / 斜切 / 镜像因此不会丢失 —— 烘焙后的坐标只能表达平移+缩放。

渲染器按「Boundary 原点 + CTM(坐标)」定位，所以坐标要先归一化：令 `(dx,dy) = L⁻¹·(T − B0)`，输出 `(x+dx, y+dy)`，则任意仿射变换下落点都严格等于 `L(x,y)+T`。

### 线宽与虚线：绝不预先乘 CTM

OFD 的 `LineWidth` 与 `DashPattern` 都和 `AbbreviatedData` **同处一个坐标空间**，渲染时会被 CTM 再缩放一次。

所以这两个属性必须写 **PDF 用户空间原值**（如 `1` / `2` / `3` / `5`），不能预先乘 CTM 的 mm 缩放系数。旧实现乘了，等于把线宽缩小了近 3 倍（`0.3528` 因子 × 图表内 `0.35~0.47` 的 CTM），所有线细成同一条 —— 正是「连线有些粗有些细、现在一样细」的根因。

`DashPattern` 在 OFD 规范里是 `PathObject` 的**属性**（`DashPattern="4 4"`），**不是子元素**。写成子元素引擎会忽略，虚线椭圆全部退化成实线。

唯一的例外：坐标被 `absorbScale()` 乘过 `k` 时，同一空间的线宽与虚线也要跟着乘 `k`。

### 极小 CTM：把缩放吸收进坐标

`fmt()` 只保留 4 位小数，而图表里 CTM 缩放过小是常态 —— 第 11 页坐标轴的 CTM 缩放只有 `7.638e-5`（PDF 用 transform 把线框坐标放大了一万三千倍），直接被写成 `0`，CTM 输出成 `0 0 0 0 0 0`，路径全部塌缩到一点，整片坐标轴消失。

对策（与数科产物一致）：缩放过小时不再依赖 CTM 表达缩放，而是**把缩放吸收进图元坐标**，CTM退化为单位阵。效果是坐标从 `322739` 变成 `~24.6`、CTM 从 `0` 变成 `0.3528`，数值落在 `fmt()` 的有效精度内。

阈值 `CTM_TINY = 0.05`。注意 `geom()` 必须收**缩放后**的点，否则 Boundary 会被算成天文数字（`6446519`），CTM 又退化成 `1 0 0 1`。

### 裁剪：pdf.js 的 clip 是延迟一位消费的

pdf.js 的 `clip()` / `eoClip()` **只置位** `pendingClip`，真正建立裁剪区是在**下一个** `constructPath` 被 `consumePath()` 消费时。

所以转换器里也延迟一位：`clip` 只置位 `pendingClipMode`，随后那条 `constructPath(endPath)` 才拿来登记裁剪区。旧实现相反 —— `clip` 到达时立刻消费 `pendingPath`，那是**上一条**已用掉的陈旧路径，于是裁剪区整体错位，把图例色块之类的小图元误剔（第 10/13 页图表标签前的颜色标识就是这样消失的：色块实际在 clip 区外侧约 1mm）。

还有一条**不能二选一**的规则：一条 `endPath` 可能**既是**裁剪区**又是**填充区。PDF 里 `W n` 之后紧跟 `sh f` 是常见写法（先裁剪、再用同一形状填渐变）。所以 clip 分支里**只能** `clipBoxes.push()`，**绝不能**清掉 `pendingPath` —— 清了之后紧随其后的 `shadingFill` 拿不到区域，81 根渐变柱会被静默丢弃。

### 渐变：必须先 await 预取

渐变以 OFD 轴向渐变表达：

```xml
<ofd:FillColor>
  <ofd:AxialShd Extend="3" StartPoint="x0 y0" EndPoint="x1 y1">
    <ofd:Segment Position="0"><ofd:Color Value="155 193 255"/></ofd:Segment>
    <ofd:Segment Position="1"><ofd:Color Value="63 128 205"/></ofd:Segment>
  </ofd:AxialShd>
</ofd:FillColor>
```

`page.objs.get(id)` 对未解析对象返回的是 **Promise**，不能同步取用。任何按 id 取对象的逻辑（渐变、图案）都必须先 `await` 预解析。

`prefetchGradients()` 会在进入操作符循环前扫一遍 `fnArray`，把所有 `shadingFill` 引用的 pattern id 收集起来 `await` 完，存进 `gradShades` 缓存。旧实现直接在 `shadingFill` 里同步 `objs.get(patId)`，抛错落进 catch → 返回兜底色 `0.5` → 表现为 `FillColor` 默认 `0 0 0`纯黑。

径向渐变按轴向近似（OFD 有对应规范但兼容性未验证）。

### 平铺图案（TilingPattern）：只取平均色，不还原纹理

`setFillColorN` / `setStrokeColorN` 的参数不一定是普通颜色——第 13 页的灰度网点就是一张 `TilingPattern`。`patternImageId()` 从 `[ 'TilingPattern', backdrop, { fnArray, argsArray }, matrix, bbox ]` 里挖出图案内联图片的 objId，`prefetchPatternColors()` 与 `prefetchGradients()` 一起在算子循环之前预取（同样因为 `page.objs.get()` 是异步的），解码每张图案图一次并求**平均 RGB** 存进 `patternColors`；填充/描边色随后替换成这个平均色，区域明暗与原件一致。

只保留平均色调，不表达平铺纹理（OFD 里没有 WPS 能稳定渲染的对应写法）。其余 `...ColorN` 色彩空间（Indexed / CMYK / Lab）仍不支持，策略是保持上一个颜色，而不是塌成纯黑。

### 复合图形单元：本转换器不输出

**Form XObject 一律内联展开**为页面级 `PathObject` / `ImageObject`（语义等价于 `save + concat(matrix) … restore`），**不**收进 `DocumentRes` 的 `<ofd:CompositeGraphicUnit>`，页面也**不**用 `<ofd:CompositeObject>` 引用。

原因：引擎不识别 `CompositeObject` 时整个图表会消失（实测第 6 页）。数科基准产物里 `CompositeObject` 只用于个别分组，页面 `Content.xml` 直接包含数百个 `PathObject` / `ImageObject`；本项目因WPS 裁没内容的历史踩坑，同样采取「不引入」策略。

产物实测：`CompositeGraphicUnits` 0 处、`CompositeObject` 0 处。改代码时不要依据旧版本文档的说法反着来。

Form 内部常含「远大于自身」的背景块（如 1152×2199 的整页白底）。按 PDF 语义它被限制在 Form 的 BBox 内，所以 `paintFormXObjectBegin` 会把 BBox 登记进 `clipBoxes`，供剔除与丢弃使用，但**不输出 `<ofd:Clips>`**（见下）。

### 页面层不输出 `<ofd:Clips>`

两次实测都证明：在页面层发 `Clips` 会让 WPS 把内容整块裁没（2026-10-13 停发后第 10/11/13 页图表正常；同日尝试恢复，第 9/10/12 页图表又全部消失）。

所以采取「**只剔除、不表达**」的保守策略：

- `clipBoxes` 的包围盒用于剔除裁剪区外的图元
- `isOversizedRect()` 对「比可见区域大出 1.8 倍以上的纯矩形填充块」直接丢弃

为什么不把超大块收敛成可见区域大小的矩形：那样会在图注文字之后留下一小块底色板，照样把图注盖住 —— 第 6 页就是这么丢的。丢弃的代价只是少了底色，而底色本来就是白的。`isOversizedRect()` 仅对**纯矩形**生效，曲线/折线图元保持原样，避免把图表裁坏。

### 可见性判定的两种模式

`visible(box, mode)` 的 `mode` 决定用哪种可见区域：

- `'page'`（文字 / 描边线）→ 只用页面范围，**完全不受 `clipBoxes` 影响**
- `'clip'`（填充块）→ 按裁剪区求交，这才是 PDF 语义要求的

为什么描边线也要豁免裁剪区：表格框线横跨整行/整列，往往在「单元格裁剪区建立之前」就已发出，或跨越多个裁剪区。实测某签名板文档第 2 页 12 条表格框线（`box=[29.8, 25.5, 150.5, 0]`，横跨 150mm 整行宽）里有 10 条被单元格 `eoClip` 剔掉。容差 `CLIP_EPS = 0.6`：贴着裁剪边界的图框线/ 图注不误杀，页外上千毫米的垃圾路径仍会清掉。

### 字体嵌入

从 worker 消息层（`doc._transport.messageHandler.comObj`）拦截 pdf.js 编译后的子集字体字节，随文档嵌入 `PublicRes`。

三个必须注意的点：

1. **非嵌入字体也必须写进 `PublicRes`**。Helvetica 等 14 种标准字体在消息里 `mimetype=null`、无 `data`，若被 `if (!f) continue` 跳过，会出现「有 1064 个文字对象但 `PublicRes` 里 0 个字体」，严格渲染器会显示异常。
2. **同名不同 Font ID 要各自独立注册**。一份 PDF 里 `Calibri` 可能有 3 个 Font ID（子集不同、cmap 大小不同）。viewer 侧按 `ofdf_<id>_<name>` 生成 family 区分，只用 `fontName` 做 key 会导致只有第一个注册成功、其余静默回退系统字体。
3. **`ensureMacCmap()` 给内嵌字体补 Mac(platform 1/0) cmap 子表**。pdf.js 编译出的子集字体常只带 Windows(3/1) format-4 cmap，部分查看器优先读 Mac 表，故补上以提升兼容性。注意：这**并不能单独修好** WPS 图表标签乱码 —— 用无 ToUnicode 子集字体画的标签带的是私有区假码（`0x21`…），任何 cmap 子表都还原不出真实文字，需要重映射标签文本本身。

### 图像

`page.objs` 只有 `get` / `has`，图像数据在 `getOperatorList()` 之后异步送达。故 `waitImages()` 先扫 ops 收集 `paintImageXObject` 引用的 objId，再以 20ms 间隔轮询，**上限 8 秒**。

`imageToRgba()` 按 `img.kind` 分派：1=灰度、2=RGB、3=RGBA（旧实现只认 3，RGB/灰度图会被整块丢弃），统一转成 RGBA 后由 `encodePng()` 编成 PNG。

> 编码时逐行拷贝用 `raw.set(rgba.subarray(...))`，**不要**改回 `Buffer.from(buffer, off, len).copy()` —— 三参数重载的边界行为曾导致每行像素都写成第 0 行，而 PNG 的签名/尺寸/CRC 全部校验通过，极难察觉。

### 文本

文字取自操作符列表里 `showText` 的字形（每个字形自带 Unicode 与宽度），**不用** `getTextContent()`。填充色与字号取自 `showText` 处的图形/文字状态。

`TextCode` 的坐标 / `DeltaX` / `Size` 统一用**字号空间**（1 单位 = 1/Size em），字形包围盒同理。

`Glyphs` 数组长度必须严格等于 `DeltaX` 项数 + 1（对齐数科产物，实测 2175 个 TextObject 无一例外）：末位字形是真实字形，但它的 `DeltaX` 不单独给出，由渲染器自行推进。`codeList` 与 `Glyphs` 保持严格 1:1。

### PNG 编码

纯 JS 手写（IHDR / IDAT / IEND + CRC32），走 Node `zlib.deflateSync({level:9})`。

## 实测数据

以 `test/` 下保留的那份 14 页论文 PDF（US Letter，正文 + 矢量图表 + 9 种子集字体）为基线：

```bash
node build/pdf2ofd/pdf2ofd.js test/<你的样本>.pdf
#   已处理 14/14 页
# 完成：test/<你的样本>.ofd（14 页，24 字体，90 图像，875598 字节）
```

与数科（商业转换器）对同一份 PDF 的产物对齐情况：

| 检查项 | 数科 | 本转换器 |
| --- | --- | --- |
| 第 2 页虚线路径 | 5 | 7（同源，多出2 条同参数副本） |
| 第 6 页线宽档位 | 1 / 2 / 3 / 5 | 1 / 2 / 3 / 5 ✓ |
| 第 7 页线宽档位 | 1 / 2 / 3 / 5 / 8 | 1 / 2 / 3 / 4 / 5 / 8 ✓ |
| 第 10 页图例色块 | 有 | 灰 / 深灰 2 色 ✓ |
| 第 11 页 CTM 全零路径 | 0 | 0 ✓ |
| 第 11 页 AxialShd | 162 | 162 ✓ |
| 第 11 页渐变柱 | 81 | 81 ✓ |
| 第 13 页灰度网点 | `TilingPattern` 纹理 | 平铺灰（只保留图案平均色） |

**已知未对齐项**：数科把每个图形拆成独立 `CompositeGraphicUnit`（226 个 Unit，其中 96 个为空）靠裁剪隔离；本转换器全部平铺在页面层且不输出裁剪，因此曲线会溢出到相邻图形。另外数科全文档只保留 22 条骨架线（线宽集中在 0.75 / 2 / 3），丢弃了 PDF 的 190 条描边。这两点已确认不再跟进。

## 资源与安全

本转换器会解析外部 PDF 文件。

- **内存**：单页操作符列表、图像解码结果、渐变预取表都在内存中。数百页的高分辨率扫描件可能占用可观内存（实测 14 页论文样本峰值约 200 MB）。
- **图像等待上限 8 秒**：`waitImages()` 轮询 pdf.js 异步送达的图像数据，超过 8 秒按「已就绪」处理（缺失图像会被跳过，不报错）。极端情况下可能出现图像缺失但不告警。
- **不验证 PDF 自身签名**。输入 PDF 若带数字签名，本工具**不校验**签名有效性，只做内容转换。
- **pdf.js 解析层的安全防护**由 pdfjs-dist 负责，本工具不做额外加固。若需处理不可信来源的 PDF，建议在受限环境（容器 / 低权限进程）中运行。

## 已知限制

1. **不支持**：表单域、注释、Type3 字体
2. **径向渐变按轴向近似**，未验证严格视觉一致性
3. **平铺图案只取平均色**：网点/纹理本身不还原；除图案内联图片外的 `...ColorN` 色彩空间（Indexed / CMYK / Lab）保持上一个颜色
4. **图像型PDF 体积会涨**：pdf.js 给的是解码后像素，重编 PNG 通常比原 JPEG 大，扫描件尤其明显
5. **文本间距近似**：逐字 `DeltaX` 均分总宽，长串拉丁文本可能有轻微字距偏移（中文等宽准确）
6. **CropBox 偏移未特殊处理**，页面尺寸取 `page.view`
7. **Beta 阶段**：API 与行为可能随版本演进而调整；未覆盖 PDF 全部特性，用于正式归档、合同、票据等场景前请人工核对输出文件

## 维护者注记

以下几项**不会**自动同步，发布前需手动处理：

| 项 | 位置 | 说明 |
| --- | --- | --- |
| npm 包版本号 | `build/build-pdf2ofd-npm.js` 的 `PKG.version` | 自动读取仓库根 `package.json` 的 `version`，与 `dist/<版本>/` 目录保持一致 |
| npm 包名 | `build/build-pdf2ofd-npm.js` 的 `PKG.name` | `pdf2ofd` 在 npmjs 上已被占用时需改名 |
| 发行包的文件剥离 | `build/common.js` 的 `distTransform()` | 改了 `web/viewer.html` / `web/viewer.js` 的结构（选择器、事件、测试文件默认值）后，正则会失配。已加断言，构建会报错提示，不会静默发坏包 |

`npm run build:pdf2ofd-npm` 只重新组装 `dist/<版本>/pdf2ofd/`，不发布。发布是独立动作：

```bash
cd dist/<版本>/pdf2ofd
npm publish --access public
```

## 排查指引

改完转换器后，跑一遍基准样本并核对统计数字（应为 14 页 / 24 字体 / 90 图像）：

```bash
node build/pdf2ofd/pdf2ofd.js test/<你的样本>.pdf /tmp/chk.ofd
```

产物完整性检查（ZIP 条目可解压 + CRC32、PNG chunk CRC、MultiMedia 声明数 == 图像条目数 == 各页 ImageObject 合计）可临时写脚本验证，**注意三个易错点**：

- **ZIP 头是小端，PNG chunk 头是大端**。混用会读出「条目数 0」的假象。
- **结构校验通过 ≠ 内容正确**。PNG 的签名/尺寸/CRC/inflate 全过，像素内容仍可能完全错。涉及图像编码必须做逐字节像素比对。
- **只看「没有全零 CTM」不够**。第 11 页颜色丢失那次，CTM 全零路径 0 条、描边路径 8 条都正常，但 81 根渐变柱被静默丢弃了。**按图元类型分别计数**（AxialShd 数、ImageObject 数、TextObject 数）才能定位。

排查显示问题时优先复用项目现成的 `ofd/core/zip.js`，别自己重写 ZIP 解析器。

## 六条通用规律

以下是本项目 PDF → OFD 转换反复验证过的规律，改动转换器时务必逐条对照：

1. `LineWidth` / `DashPattern` 与 `AbbreviatedData` 同坐标空间，**绝不**预先乘 CTM
2. `DashPattern` 是 `PathObject` 的**属性**，不是子元素
3. pdf.js 的 clip 延迟一位消费，`clip` 本身不携带路径
4. `fmt()` 的 4 位小数对极小 CTM 是致命的；缩放过小时应把缩放吸收进坐标
5. `page.objs.get()` 任何按 id 取对象都必须先 `await` 预取
6. 一条 `endPath` 可能同时是 clip 区与填充区，两者不能二选一
