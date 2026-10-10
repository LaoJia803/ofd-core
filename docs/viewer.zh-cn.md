# viewer.js — OFD 预览器应用逻辑

## 概述

`web/viewer.js` 是 OFD 在线阅读器的应用层逻辑，配合 `viewer.html` / `viewer.css` 提供完整的阅读体验：懒渲染翻页、缩放旋转、全文搜索、缩略图 / 大纲 / 签名侧栏、签章放置、打印、下载、导出 PDF。

它不重复造轮子：解析与渲染全部委托 `build/ofd.js`，PDF 导出委托 `build/toPdf.js`，自身只做状态管理、DOM 交互与调度。

## 设计理念

### 无框架原生 JS

零依赖、零构建：`viewer.js` 是单个 IIFE，直接 `<script>` 引入。所有 DOM 用原生 API 操作，样式全在 `viewer.css`。

### 状态驱动

全局唯一 `state` 对象持有全部运行时状态（页数、当前页、缩放、搜索结果、签章位置……）。任何交互先改 `state`，再由对应的渲染函数把状态同步到 DOM，避免事件之间互相直接改对方的界面。

### 懒渲染（可视区渲染 + 离屏卸载）

只渲染视口内 ±`lazyBuffer`（默认 2）页：

- 滚动到哪页才渲染哪页，千页文档首屏只画可见几页
- 离屏页**卸载**（移除 SVG），回到可视区再重绘
- 每页一个渲染代次 `renderTokens[i]`，卸载/重渲染时递增，使在途的异步渲染结果作废（`loadToken` 同理保护整个文档加载）

### 分层职责

| 层 | 职责 | 归属 |
| --- | --- | --- |
| 解析 / 渲染 | OFD → SVG | `build/ofd.js` |
| 转换 | SVG → PDF | `build/toPdf.js` |
| 应用 | 状态、交互、调度 | `web/viewer.js` |

### loadToken 竞态保护

连续打开多个文件、或加载未完成时又发起加载，旧的加载结果不能覆盖新的界面。每次加载 `state.loadToken++`，异步回调返回时比对代次，不一致直接丢弃。

## 函数调用流程

### 启动流程

```
DOMContentLoaded
  ├─ 缓存 DOM 元素（els.*）
  ├─ 绑定工具栏 / 侧栏 / 查找条事件
  ├─ 读 URL 参数 ?file=（缺省 ../test/ofdFile/999.ofd）
  └─ openFile(url)
```

### 文件打开流程

```
openFile(source)
  ├─ state.loadToken++（旧加载作废）
  ├─ OFD.load(source)                 → ofd
  ├─ OFD.getPageCount / getPageDimensions（逐页缓存 pageDimensions）
  ├─ 渲染缩略图（renderPage width:200，懒执行）
  ├─ OFD.getSignatures → 签名面板 + 页面签名热区
  └─ 触发首屏懒渲染
```

### 缩放流程

```
setScale(value | 'auto')
  ├─ state.scale / scaleMode 更新
  ├─ 各页容器宽高按 pageDimensions × scale 重算
  └─ 已渲染页重排（SVG width 属性跟随），未渲染页留给懒渲染
```

### 搜索流程

```
onSearchInput(query)
  ├─ 遍历各页文本节点（state.pageSvgs 里的 <text>）
  ├─ 收集命中 { page, textIdx, start, end, rect }
  ├─ 更新计数显示，上一处/下一处跳转并滚动定位
  └─ 命中高亮（叠加矩形）
```

### 盖章流程

```
工具栏「盖章」按钮
  ├─ 已注册 onGetSeal？→ cb() 由第三方取章，成功后调 OFD.setSeal()
  ├─ 否则复用上次印章（sessionStorage: ofd_last_seal）
  └─ enterStampMode()：点击页面放置
       ├─ 换算毫米坐标（左上角原点）
       ├─ placeSealVisual 绘制印章（.seal-placed，右键删除）
       ├─ state.sealPlaced 记录 { sealImg, width, height, sealId, page, x, y }
       └─ emitSealChange('place', buildSealList()) → onSealChange 回调
```

### 翻页流程

```
滚动 / 翻页按钮 / 页码输入 / 缩略图点击 / goToPage
  ├─ setCurrentPage(idx)：更新页码框、当前页高亮
  ├─ 懒渲染：渲染新可视区页，卸载远离的页
  └─ state.pageChangeCb(page, total)（onPageChange 注册的回调）
```

## 目录与依赖

```
web/
├─ viewer.html   页面骨架（工具栏 / 侧栏 / 查找条 / 主容器）
├─ viewer.js     应用逻辑（本文件）
├─ viewer.css    样式
└─ images/       图标（按钮图标均为 SVG）

依赖：
├─ ../build/ofd.js     解析与渲染（必须）
├─ ../build/toPdf.js   导出 PDF（可选，缺失时按钮报「未加载 toPdf.js」）
└─ 外部字体目录          由 OFD.setFontBase 指定，本仓库为 external/font/
```

## 启动流程与 URL 参数

用静态服务器打开（`file://` 下 fetch 受限）：

```bash
npx http-server .     # 根目录指向本仓库
```

访问 `http://localhost:8080/web/viewer.html?file=../test/ofdFile/999.ofd`。

| 参数 | 说明 |
| --- | --- |
| `file` | 要打开的 OFD 路径或 URL，缺省 `../test/ofdFile/999.ofd` |

## 功能模块

### 文档打开

工具栏「打开」按钮走 `<input type="file">` 选择本地 `.ofd`，也支持 URL 参数直接打开。

### 页面与导航

页码输入框（1-based）、上一页 / 下一页、滚动跟随换页；页码变化统一走 `setCurrentPage` 并触发 `onPageChange` 回调。

### 缩放

缩放 − / + 与「自动」模式（`scaleMode: 'auto'` 按容器宽度自适应）。缩放只改容器尺寸与 SVG width，矢量不失真。

### 旋转

状态位 `state.rotation`，整文档旋转渲染。

### 搜索

全文搜索条：输入即搜，上一处 / 下一处，显示命中计数。命中位置按文本节点字符范围定位并滚动到可视区。

### 侧边栏

侧栏三块，可关闭：

- **缩略图**：每页 200px 宽缩略图，点击跳页，当前页高亮跟随
- **目录（大纲）**：文档书签树；无书签时按页生成「第 N 页」列表
- **签名**：签章列表（签署人 / 时间 / 印章图），可逐个「验证」跑摘要比对

### 目录（大纲）

大纲数据来自 `ofd.document.outlines`，点击定位到目标页并高亮点击项。

### 签名查看与验证

签名面板展示 `OFD.getSignatures` 的结果；「验证」按钮调 `OFD.verifySignature(ofd, sig.index)`，展示 `status` / `message`。页面上的签名区域可点击弹出详情。

### 盖章（签章放置）

进入选位模式后点击页面放置印章，右键已放置印章可删除（弹 `sealMenu` 确认）。位置以毫米记账（左上角原点），页面卸载重绘时由 `applySealsToPage` 重放。

### 工具栏附加功能

| 按钮 | 行为 |
| --- | --- |
| 打印 | 隐藏 iframe 里渲染全部页后调浏览器打印 |
| 下载 | 下载原始 `.ofd`（沿用原文件名） |
| 导出 PDF | 调 `build/toPdf.js` 转换，下载同名 `.pdf` |
| 文档属性 | 展示 `OFD.getDocumentInfo` 的元信息 |

## 状态对象（state）

```js
const state = {
  ofd: null,             // OFD.load 返回的句柄
  pageCount: 0,
  currentPage: 0,        // 0-based
  scale: 1.0,
  scaleMode: 'auto',     // 'auto' | 手动倍数
  rotation: 0,
  pageContainers: [],    // 每页容器 DOM
  pageSvgs: [],          // 每页 SVG（懒渲染，卸载后为 null）
  pageDimensions: [],    // 每页 { width, height }（毫米）
  loadToken: 0,          // 加载竞态代次
  fileName: '999.ofd',
  searchMatches: [],     // 命中列表
  searchIndex: -1,
  searchQuery: '',
  sidebarView: 'thumb',  // 侧栏当前面板
  activeOutlineLink: null,
  sigHighlight: null,
  stampMode: false,      // 盖章选位模式
  seal: null,            // 当前印章 { sealImg, width, height, sealId }
  sealGetCb: null,       // onGetSeal 注册的回调
  sealChangeCb: null,    // onSealChange 注册的回调
  pageChangeCb: null,    // onPageChange 注册的回调
  sealPlaced: [],        // 已放置印章（毫米坐标）
  sealContextTarget: null,
  pdfConverting: false,
  lazyBuffer: 2,         // 视口上下各预渲染页数
  renderTokens: [],      // 每页渲染代次
};
```

## 对外接口

viewer 在全局 `OFD` 对象上额外挂 5 个接口，供第三方系统做签章集成与翻页联动。

### OFD.setSeal(opts)

提供印章并进入盖章选位模式。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| opts.sealImg | string | 必填，印章图片 base64 或图片 URL |
| opts.width | number | 毫米，默认 36 |
| opts.height | number | 毫米，默认同 width |
| opts.sealId | string | 签章 ID，透传进回调列表 |

```js
OFD.setSeal({ sealImg: 'data:image/png;base64,...', width: 36, height: 36, sealId: 'S001' });
```

配置会存进 `sessionStorage`（键 `ofd_last_seal`），刷新页面后点「盖章」直接复用上次印章。

### OFD.onGetSeal(cb)

注册取章回调：点工具栏「盖章」按钮时触发 `cb()`，由第三方完成取章 / 密码验证，成功后调用 `OFD.setSeal()` 进入选位模式。未注册时按钮直接复用上次印章。

```js
OFD.onGetSeal(async () => {
  const seal = await mySealService.pick();   // 第三方取章
  OFD.setSeal({ sealImg: seal.img, width: 36, height: 36, sealId: seal.id });
});
```

### OFD.onSealChange(cb)

注册签章变化统一回调，放置（`'place'`）与删除（`'delete'`）都会触发。

```js
OFD.onSealChange((list, action) => {
  // list: [{ sealImg, width, height, sealId, page, x, y }]，变化后的全部签章位置
  // page 1-based；x / y 毫米，左上角坐标；action: 'place' | 'delete'
  console.log(action, list);
});
```

### OFD.goToPage(page, opts)

跳转到指定页。`page` 1-based；`opts.smooth === false` 关闭平滑滚动。返回是否跳转成功。

```js
OFD.goToPage(3);                 // 跳到第 3 页
OFD.goToPage(3, { smooth: false });
```

### OFD.onPageChange(cb)

注册页码监听：翻页按钮 / 页码输入 / 滚动换页 / 跳转 / 缩略图点击都会触发。

```js
OFD.onPageChange((page, total) => {
  console.log('当前', page, '/', total);   // page 1-based
});
```

## 完整集成示例

```html
<script src="build/ofd.js"></script>
<script src="build/toPdf.js"></script>
<script src="web/viewer.js"></script>
<script>
  // 外部字体目录（本仓库字体在 external/font/）
  OFD.setFontBase('external/font/');

  // 取章：点「盖章」时弹自己的取章框
  OFD.onGetSeal(async () => {
    const seal = await mySealService.pick();
    OFD.setSeal({ sealImg: seal.img, width: 36, height: 36, sealId: seal.id });
  });

  // 签章位置变化：提交给业务系统
  OFD.onSealChange((list, action) => {
    if (action === 'place') myApi.saveSignatures(list);
    else myApi.deleteSignature(list);
  });

  // 翻页联动（比如记录阅读进度）
  OFD.onPageChange((page, total) => myApi.saveProgress(page, total));

  // 主动跳页
  OFD.goToPage(1);
</script>
```

## 交互约定

- 页码、`goToPage` / `onPageChange` 的页码均为 **1-based**；引擎 API 的 `pageIndex` 为 0-based
- 签章坐标为**毫米**，原点在页面左上角
- 已放置印章 **右键删除**；删除后 `onSealChange` 回调 `action='delete'`，`list` 为剩余签章
- 点击页面签名区域弹签章详情

## 注意事项

1. 必须用静态服务器打开（`file://` 下 `fetch` 不可用）
2. 导出 PDF 是演示级转换，复杂版式以实际效果为准；缺 `build/toPdf.js` 时报「未加载 toPdf.js，无法转换」
3. 外部字体目录默认 `<根>/font/`，本仓库是 `external/font/`，需显式 `OFD.setFontBase('external/font/')`
4. 打印会渲染全部页，超大文档注意内存与耗时
5. 盖章回调只记录**位置**，不做落章写回 OFD 文件；落库/写文件由第三方系统完成
