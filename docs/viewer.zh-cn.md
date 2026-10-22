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
  ├─ 读 URL 参数 ?file=（缺省指向 ../test/ofdFile/ 下的仓库自带样本）
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
├─ viewer.css    样式（工具栏图标引用 images/*.svg，不再使用 base64）
└─ images/       独立 SVG 图标（viewer.css 直接引用）

依赖：
├─ ../build/ofd.min.js  解析与渲染（必须；viewer.html 加载的是压缩版引擎）
├─ ../build/toPdf.js    导出 PDF（可选，缺失时按钮报「未加载 toPdf.js」）
└─ 外部字体目录          可选；放入 `<根>/font/`（`npm run build` 创建，据 ofd.min.js 自动识别），该目录需被服务器输出目录列表才生效
```

## 启动流程与 URL 参数

界面在 `file://` 下也能打开（图标为随页面的 `images/*.svg` 外链），但**按 URL 加载 OFD** 需要 HTTP（`file://` 下 `fetch` 被拦截）——在 `file://` 下请用工具栏「打开 OFD 文件」按钮选择本地 `.ofd`。

```bash
npx http-server .     # 根目录指向本仓库
```

访问 `http://localhost:8080/web/viewer.html?file=<你的 .ofd 路径>`（相对仓库根的路径也可，如 `../test/ofdFile/<你的样本>.ofd`）。

| 参数 | 说明 |
| --- | --- |
| `file` | 要打开的 OFD 路径或 URL，仓库内缺省指向 `test/ofdFile/` 下的样本文件；`dist` 发行包会剥离测试文件选择器与该缺省（无 `?file=` 时不自动加载） |
| `page` | 打开后自动跳转的页码（1-based） |
| `rotate` | 初始旋转角度（度） |
| `search` | 文档打开后自动检索并高亮的文本 |

## 功能模块

### 文档打开

工具栏「打开」按钮走 `<input type="file">` 选择本地 `.ofd`，也支持 URL 参数直接打开。

### 页面与导航

页码输入框（1-based）、上一页 / 下一页、滚动跟随换页；页码变化统一走 `setCurrentPage` 并触发 `onPageChange` 回调。

### 缩放

缩放 − / + 与下拉的缩放模式：`auto`（默认，优先适合页高，页面能完整显示时再放大到适合页宽，上限 1.5 倍）、`page-actual`（100%）、`page-fit`（整页适应容器）、`page-width`（适合页宽）、固定百分比，及手动缩放后的 `custom`。缩放只改容器尺寸与 SVG width，矢量不失真。

### 旋转

状态位 `state.rotation`，整文档旋转渲染。

### 搜索

全文搜索条：输入即搜，上一处 / 下一处，显示命中计数。命中位置按文本节点字符范围定位并滚动到可视区。按 `Ctrl+F` / `Cmd+F` 打开搜索条；若正文中有选中文字，会自动把选区文本填入搜索框并立即搜索（选区在搜索框或侧栏内时不覆盖当前查询）。

### 侧边栏

侧栏三块，可关闭：

- **缩略图**：每页 200px 宽缩略图，点击跳页，当前页高亮跟随
- **目录（大纲）**：文档书签树；无书签时按页生成「第 N 页」列表
- **签名**：签章列表（签署人 / 时间 / 印章图），可逐个「验证」跑摘要比对

### 目录（大纲）

大纲数据来自 `ofd.document.outlines`，点击定位到目标页并高亮点击项。

### 签名查看与验证

签名面板展示 `OFD.getSignatures` 的结果；「验证」按钮调 `OFD.verifySignature(ofd, sig.index)`，展示 `status` / `message`。页面上的签名区域可点击弹出详情。

### 注解与链接

页面注解（高亮、路径、水印、贴片章）由引擎 `renderAnnot` 随页渲染，`Visible="false"` 的注解不渲染。`Link` 注解额外叠一层透明热区（`.ofd-link`），点击在新标签打开其 `URL`（`noopener,noreferrer`），仅接受 `http(s)` 链接。

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
  scaleMode: 'auto',     // 'auto' | 'page-actual' | 'page-fit' | 'page-width' | 'custom'
  rotation: 0,
  pageContainers: [],    // 每页容器 DOM
  pageSvgs: [],          // 每页 SVG（懒渲染，卸载后为 null）
  renderedPages: new Set(), // 当前已渲染页索引，滚动卸载只遍历它
  pageDimensions: [],    // 每页 { width, height }（毫米）
  loadToken: 0,          // 加载竞态代次
  fileName: 'sample.ofd', // 当前文档显示名（取 URL/所选文件的末段；仓库版初值为 test 样本）
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

viewer 在全局 `OFD` 对象上挂载签章、翻页及工具栏操作接口。签章/翻页的 5 个接口在下面详细说明，其余工具栏操作见「工具栏操作接口」。

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

### 工具栏操作接口

| 接口 | 说明 |
| --- | --- |
| `OFD.openFile(source, fileName?)` | 打开文档。`source` 支持 URL / Blob / ArrayBuffer / Uint8Array，返回 `Promise<boolean>` |
| `OFD.chooseFile()` | 打开浏览器文件选择框（等同工具栏「打开」按钮） |
| `OFD.download()` | 原样下载当前 OFD，返回 `Promise<boolean>` |
| `OFD.print()` | 打开打印对话框，返回是否启动成功 |
| `OFD.convertToPdf()` | 转换为 PDF 并下载，返回 `Promise<boolean>` |
| `OFD.showDocumentInfo()` | 打开文档属性弹窗，返回是否成功 |
| `OFD.firstPage()` / `OFD.lastPage()` | 跳到首页 / 末页，返回是否成功 |
| `OFD.prevPage()` / `OFD.nextPage()` | 上一页 / 下一页，到边界返回 `false` |
| `OFD.setScale(value)` | `auto` / `page-actual` / `page-fit` / `page-width`，或 0.2–5 的数字；返回实际缩放 |
| `OFD.zoomIn()` / `OFD.zoomOut()` | 放大 / 缩小一级，返回实际缩放 |
| `OFD.rotate(delta)` | 相对旋转，`delta` 必须是 90 的倍数；返回当前角度 |
| `OFD.setRotation(deg)` | 绝对旋转，`deg` 必须是 90 的倍数；返回当前角度 |
| `OFD.setSidebar(view)` | 打开并切换到 `thumb` / `outline` / `sign` |
| `OFD.toggleSidebar(view)` | 切换指定侧栏：打开返回 `true`，关闭或参数无效返回 `false` |
| `OFD.closeSidebar()` | 关闭侧栏 |
| `OFD.openSearch()` | 打开搜索条（保留当前查询） |
| `OFD.search(query)` | 打开搜索条、填入并搜索，返回 `Promise<number>` 命中数 |
| `OFD.findNext()` / `OFD.findPrev()` | 下一个 / 上一个匹配，返回命中总数（无命中为 0） |
| `OFD.closeSearch()` | 关闭搜索条并清除高亮 |
| `OFD.stamp()` | 进入盖章模式（等同工具栏「盖章」按钮）；无文档/无印章时返回 `false` |
| `OFD.exitStamp()` | 退出盖章模式 |
| `OFD.toggleTools(show?)` | 打开/关闭次级工具栏；不传 `show` 则切换，返回是否可见 |
| `OFD.getViewerState()` | 返回当前 `{ fileName, page, pageCount, scale, scaleMode, rotation, sidebarOpen, sidebarView, searchQuery, searchCount, stampMode }` |

## 完整集成示例

```html
<script src="build/ofd.js"></script>
<script src="build/toPdf.js"></script>
<script src="web/viewer.js"></script>
<script>
  // 外部字体目录（可选；默认自动用 <根>/font/，此处演示指到别处）
  OFD.setFontBase('assets/font/');

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

### iframe 内嵌

viewer 是一个自包含页面，宿主页可以用 `<iframe>` 嵌入它，再通过 iframe 自身 `window` 上同样的 **`OFD` 接口** 驱动。下面是一个完整的宿主页示例：用 URL 打开文档、等文档真正就绪后挂上接口，并由控件驱动。

> 宿主页与 viewer 必须通过 **HTTP(S) 同源** 访问（如在仓库根 `npx http-server .`）——跨域时 `contentWindow.OFD` 会被浏览器拦截，且 `?file=` 依赖 `fetch`（`file://` 下不可用）。

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <title>OFD viewer iframe 示例</title>
</head>
<body>
  <div>
    <button id="open">加载 OFD</button>
    <input id="pg" type="number" min="1" value="3">
    <button id="go">goToPage</button>
    <button id="seal">setSeal 盖章</button>
    <span id="pgind">页: -</span>
  </div>

  <!-- viewer 自包含，纯靠 URL 参数打开文档（无需任何 JS） -->
  <iframe id="ofd" src="about:blank" style="width:100%;height:80vh"></iframe>

<script>
  const frame = document.getElementById('ofd');
  const log = (m) => console.log('[viewer]', m);
  const placeholderSeal = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">' +
    '<circle cx="40" cy="40" r="36" fill="none" stroke="#c00" stroke-width="3"/></svg>');

  let api = null;

  function wireIframe() {
    // load 只代表骨架就绪；viewer.js 跑完后 contentWindow.OFD 才存在。
    // ?file= 解析仍是异步，「真正可用」由首次 onPageChange 确认。
    try {
      api = frame.contentWindow.OFD;             // 仅限同源
    } catch (e) {
      log('拿不到 contentWindow.OFD —— 宿主页与 viewer 必须同源');
      return;
    }
    if (!api || !api.goToPage) { setTimeout(wireIframe, 50); return; }  // viewer.js 尚未执行完

    api.onPageChange((page, total) => {
      document.getElementById('pgind').textContent = `页: ${page}/${total}`;
    });

    // 取章：点工具栏「盖章」按钮时触发
    api.onGetSeal(async () => {
      const seal = await mySealService.pick();    // 你自己的取章 / 验密流程
      api.setSeal({ sealImg: seal.img, width: 36, height: 36, sealId: seal.id });
    });

    // 签章位置变化（放置 / 删除）→ 提交后端
    api.onSealChange((list, action) => {
      // list: [{ sealImg, width, height, sealId, page, x, y }]，page 为 1-based，x/y 单位毫米
      myApi.save(list, action);
    });
  }
  frame.addEventListener('load', wireIframe);

  document.getElementById('open').onclick = () => {
    const file = prompt('OFD 路径/URL（相对仓库根）', '../test/ofdFile/<你的样本>.ofd');
    if (file) frame.src = 'web/viewer.html?file=' + encodeURIComponent(file);
  };

  document.getElementById('go').onclick = () => {
    const n = parseInt(document.getElementById('pg').value, 10);
    // 文档未加载完时返回 false
    if (!api || !api.goToPage(n, { smooth: false })) log(`第 ${n} 页暂不可用`);
  };

  document.getElementById('seal').onclick = () => {
    if (api) api.setSeal({ sealImg: placeholderSeal, width: 36, height: 36, sealId: 'MANUAL' });
  };
</script>
</body>
</html>
```

### 最简形式

宿主页若只需打开并定位文档，完全不用写 JS，直接把 iframe 指向 viewer 即可：

```html
<iframe src="web/viewer.html?file=../test/ofdFile/<你的样本>.ofd&page=3&search=合同" width="100%" height="800"></iframe>
```

- **优先用 URL 参数打开 / 定位**：`?file=`（配合 `page` / `rotate` / `search`）无需任何 JS，是把 viewer 交给宿主页最简单的方式。
- **JS 接口需同源**：跨域父页只能传 URL 参数，浏览器会拦截 `contentWindow.OFD` 访问；要让 viewer 与宿主页同源才能调用接口。
- **时序**：`load` 事件只代表骨架就绪，`?file=` 解析仍是异步——文档未就绪时 `goToPage` 返回 `false`；若需在页面可用后再操作，等首次 `onPageChange` 触发。

## 交互约定

- 页码、`goToPage` / `onPageChange` 的页码均为 **1-based**；引擎 API 的 `pageIndex` 为 0-based
- 签章坐标为**毫米**，原点在页面左上角
- 已放置印章 **右键删除**；删除后 `onSealChange` 回调 `action='delete'`，`list` 为剩余签章
- 点击页面签名区域弹签章详情

## 安全注意事项

预览器会加载并解析外部 OFD 文件，这在设计上不可避免（OFD 就是用来展示外来文件的）。请注意：

### 引擎侧的解析防护

已实现（详见[核心引擎文档](ofd.zh-cn.md#安全与健壮性)）：

- ZIP 解压体积上限 256 MB/条目（防解压炸弹）、条目缓存 64 项
- 图像解码像素上限 1 亿
- 拒绝 `javascript:` / `file:` / `data:` URL 协议
- XML 字符引用做码点合法性校验，畸形引用返回 U+FFFD
- 签名/批注/目录解析各自 `try/catch`，单点失败不拖垮整份文档

**但未经过专业安全审计**，且已知未覆盖压缩比异常、XML 嵌套深度、手写 TIFF/LZW 解码器的边界完整性。处理外部文件前请自行评估。

### 转义情况

签名详情弹窗与印章列表会把引擎生成的 SVG 字符串直接赋给 `innerHTML`（`web/viewer.js` 中 `seal.innerHTML = sig.sealImage.data`）。这条路径上的转义状况：

- **文字内容** —— 经 `escapeXml()` 转义 ✓
- **图像 data URL** —— 经 `escapeXml()` 转义 ✓
- **字体名** —— 经 `cssFontName()` 剥离引号与反斜杠，属性无法逃逸 ✓
- **数值型属性**（`box.w` / `Boundary` / `CTM` / `lineWidth`）—— 经 `parseBox` / `parseFloat` 转成 number，无字符串拼接 ✓

渲染层未发现可利用的注入点。但这依赖"所有拼接点都走转义"这一约定 —— **新增图元类型时务必复用 `escapeXml()`**。

### 部署侧需要自己做的

1. **验签结果不是可信证明**。预览器里的「验证通过」仅代表签名值自洽、受保护文件未被改动、有效期覆盖签名时间。**不代表签名者被受信任机构签发** —— 证书按原样信任，不构建证书链。合规场景必须另建 CA 校验体系。
2. **验签的 `unknown` 不是 `valid`**。数据不足时返回 `status: 'unknown'`，UI 必须区分显示，不能渲染成通过。
3. **iframe 内嵌请配 `sandbox` 与 CSP**。默认参数下预览器执行同源 JS。
4. **`file` URL 参数会发起跨域请求**。面向公网开放时请对 `file` 做白名单校验，否则可能被用于探测内网资源（SSRF）。

## 注意事项

1. 界面在 `file://` 下可打开（图标为 `images/*.svg` 外链），但按 URL 加载 OFD 需 HTTP；`file://` 下请用「打开 OFD 文件」按钮
2. 导出 PDF 是演示级转换，复杂版式以实际效果为准；缺 `build/toPdf.js` 时报「未加载 toPdf.js，无法转换」
3. 外部字体是可选的。`npm run build` 会创建 `<根>/font/`，引擎据 `ofd.min.js` 位置自动识别，把 `字体原名.ttf|.otf|.woff2` 放进去即可，无需 `setFontBase`。但该目录必须被服务器**输出目录列表**（如 nginx autoindex、`serve`/`http-server`），否则 `fetchFontIndex()` 返回 `null`、外部字体加载不上；此时渲染仍回退到内嵌/系统字体栈（声明了却加载不了的内嵌字体同样回落系统栈）。仅当要指到别处时才用 `OFD.setFontBase('你的目录/')`
4. 打印会渲染全部页，超大文档注意内存与耗时
5. 搜索同样先全量渲染再匹配（`renderAllPages()`），千页文档一次检索会渲染整份文档，耗时与内存都明显上升
6. 盖章回调只记录**位置**，不做落章写回 OFD 文件；落库/写文件由第三方系统完成
7. `file` 参数为空时**不自动加载任何文件**（发行包已剥离仓库内的测试文件），需用户用工具栏按钮选择
