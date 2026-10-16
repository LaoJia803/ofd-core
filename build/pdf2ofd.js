/* =====================================================================
 * pdf2ofd.js — PDF → OFD 转换器（从零实现，Node 环境，beta）
 *
 * 成熟度：beta。版面、文字、内嵌字体与图像已对齐，但不保证与 PDF 原件逐像素一致，
 *         也不支持表单域、注释、Type3 字体、渐变。正式归档前请人工核对产物。
 *         详见 docs/pdf2ofd.zh-cn.md。
 *
 * 思路：用 pdfjs-dist 解析 PDF，逐页遍历操作符列表（getOperatorList），
 *       把文字/矢量/图像还原成 OFD 的 TextObject / PathObject / ImageObject，
 *       并从 worker 消息层拦截子集字体字节，随文档嵌入 PublicRes。
 *       - 坐标：图元坐标保留 PDF 用户空间原值，「CTM + pt→mm + Y 翻转」交给 OFD 的 CTM 表达。
 *       - 文字：showText 的 glyph 带 unicode 与宽度，配合文本矩阵算出基线
 *               起点与逐字 DeltaX，输出 TextCode（保留可选可搜索文本）。
 *       - 字体：嵌入 PDF 内的真实子集 OTF/TTF（cmap 为 Unicode），FontFace 可加载。
 *       - 图像：解码为 RGBA 后编码 PNG 嵌入 DocumentRes。
 *       - 矢量：DrawOPS buffer 转 OFD 缩写路径（M/L/Q/B/C），应用 CTM。
 *
 * 用法：
 *   node build/pdf2ofd.js input.pdf [output.ofd]
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// QUIET=true 时不打印进度与完成信息（供脚本调用时静默转换）
let QUIET = false;

const PT_TO_MM = 25.4 / 72; // 1pt = 0.3527778mm

// ---------------------------------------------------------------------------
// CRC32（ZIP 用）
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

// ---------------------------------------------------------------------------
// 最小 ZIP 写入器（deflate）
// ---------------------------------------------------------------------------
// 字符串 -> UTF-8 字节
function toBytes(s) {
  return Buffer.from(s, 'utf8');
}

class ZipWriter {
  constructor() {
    this.entries = [];
  }
  add(name, data) {
    if (typeof data === 'string') data = toBytes(data);
    else if (typeof Buffer !== 'undefined' && !(data instanceof Buffer) && !(data instanceof Uint8Array))
      data = Buffer.from(data);
    this.entries.push({ name: toBytes(name), data });
  }
  // 组装 ZIP 字节流。
  build() {
    const chunks = [];
    const central = [];
    let offset = 0;
    for (const e of this.entries) {
      const comp = zlib.deflateRawSync(e.data, { level: 9 });
      const crc = crc32(e.data);
      const nameLen = e.name.length;
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4); // version needed
      local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
      local.writeUInt16LE(8, 8); // method: deflate
      local.writeUInt16LE(0, 10); // time
      local.writeUInt16LE(0, 12); // date
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(comp.length, 18);
      local.writeUInt32LE(e.data.length, 22);
      local.writeUInt16LE(nameLen, 26);
      local.writeUInt16LE(0, 28);
      chunks.push(local, e.name, comp);

      const cd = Buffer.alloc(46);
      cd.writeUInt32LE(0x02014b50, 0);
      cd.writeUInt16LE(20, 4);
      cd.writeUInt16LE(20, 6);
      cd.writeUInt16LE(0x0800, 8);
      cd.writeUInt16LE(8, 10);
      cd.writeUInt16LE(0, 12);
      cd.writeUInt16LE(0, 14);
      cd.writeUInt32LE(crc, 16);
      cd.writeUInt32LE(comp.length, 20);
      cd.writeUInt32LE(e.data.length, 24);
      cd.writeUInt16LE(nameLen, 28);
      cd.writeUInt16LE(0, 30);
      cd.writeUInt16LE(0, 32);
      cd.writeUInt16LE(0, 34);
      cd.writeUInt16LE(0, 36);
      cd.writeUInt32LE(0, 38);
      cd.writeUInt32LE(offset, 42);
      central.push(cd, e.name);

      offset += local.length + nameLen + comp.length;
    }
    const cdStart = offset;
    let cdSize = 0;
    for (const c of central) cdSize += c.length;
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(this.entries.length, 8);
    eocd.writeUInt16LE(this.entries.length, 10);
    eocd.writeUInt32LE(cdSize, 12);
    eocd.writeUInt32LE(cdStart, 16);
    eocd.writeUInt16LE(0, 20);
    return Buffer.concat([...chunks, ...central, eocd]);
  }
}

// ---------------------------------------------------------------------------
// 最小 PNG 编码器（RGBA → PNG）
// ---------------------------------------------------------------------------
function encodePng(width, height, rgba) {
  // 用 Uint8Array.set 逐行拷贝，不走 Buffer.from(arrayBuffer, off, len)，
  // 免得依赖那个三参数重载的边界行为。
  const rowBytes = width * 4;
  const raw = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (rowBytes + 1);
    raw[o] = 0; // filter none
    raw.set(rgba.subarray(y * rowBytes, (y + 1) * rowBytes), o + 1);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.concat([t, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcBuf), 0);
    return Buffer.concat([len, t, data, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------
// 仿射矩阵工具（6 元素 [a,b,c,d,e,f]，与 PDF 一致：x'=a*x+c*y+e, y'=b*x+d*y+f）
// ---------------------------------------------------------------------------
function matMul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
// ---------------------------------------------------------------------------
// 数值格式化：去掉多余 0，保留 4 位小数
// ---------------------------------------------------------------------------
// 数值格式化：默认 4 位小数（精度足够且不会拖大 XML），
// digits 可覆盖 —— 渐变色标的 Position 需要更高精度（值域 [0,1]，4 位只到万分之一）。
function fmt(n, digits) {
  if (!isFinite(n)) return '0';
  const d = digits === undefined ? 4 : digits;
  let s = n.toFixed(d);
  if (d > 0) s = s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  if (s === '-0' || s === '') s = '0';
  return s;
}
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===========================================================================
// 操作符遍历器：把一页的 PDF op 流还原为 OFD 对象 XML
//
// 坐标系约定（对齐数科 suwell-pdf2ofd 的产物）：
//   - 图元坐标保留 PDF 用户空间原值，把「CTM + pt→mm + Y 轴翻转」整体交给 OFD 的 CTM 属性，
//     这样旋转 / 斜切 / 镜像不会在坐标烘焙过程中丢失。旧实现把 CTM 烘进每个点，只能表达平移+缩放，
//     遇到带旋转的图像与文字必然错位。
//   - PDF 点 (x,y) 经 CTM=[a,b,c,d,e,f] 得设备坐标 (X,Y)：pt、Y 向上、原点左下。
//     OFD 需要 (X*s, Hmm − Y*s)，故 CTM 线性部分取 [a*s, −b*s, c*s, −d*s]，平移并入 Boundary。
//   - 渲染器按「Boundary 原点 + CTM(坐标)」定位，因此坐标必须先归一化：
//     令 (dx,dy) = L⁻¹·(T − B0)，输出 (x+dx, y+dy)，则任意仿射变换下落点都严格等于 L(x,y)+T。
//   - 裁剪只用于「剔除裁剪区外的图元」与「丢弃被裁剪后只剩底色的巨大矩形」，不写进 OFD。
//     页面层输出 <ofd:Clips> 会让 WPS 把内容整块裁没（两次实测：恢复后第 9/10/12 页图表消失）。
//     数科基准的页面 Content.xml 里零个 <ofd:Clip> —— 它把裁剪表达在 CompositeObject 上。
//     旧实现丢弃全部 clip，改用「跳过超大白块」的 hack，于是被裁剪的巨大路径会整块画出来
//     压住下方内容 —— 这正是图形错位、内容被盖住的根因。现由 clipBoxes + isOversizedRect 解决。
//   - Form XObject 转成 DocumentRes 里的 <ofd:CompositeGraphicUnit>，页面用 <ofd:CompositeObject> 引用，
//     内部图元只保留 Form 空间内的相对变换，避免子图元 CTM 无限累积。
// ===========================================================================
function walkOperators(tc, OPS, page, ctx) {
  const { pageWpt, pageHpt, fonts, fontResMap, imageStore, compositeUnits, fontCmap, gradShades, patternColors, nextId } = ctx;
  const scale = PT_TO_MM;
  const Hmm = pageHpt * scale;

  // ---- 图形状态 ----
  let ctm = [1, 0, 0, 1, 0, 0];
  const gStack = [];
  let fillColor = { r: 0, g: 0, b: 0 };
  let strokeColor = { r: 0, g: 0, b: 0 };
  let lineWidth = 1;
  let lineCap = 0,
    lineJoin = 0;
  // 虚线状态：PDF 的 setDash(args=[dashArray, dashPhase])。OFD 用 PathObject 的
  // DashPattern 属性（对齐数科产物：`<ofd:PathObject ... DashPattern="4 4">`），
  // 不是子元素 —— 写成子元素引擎会忽略，虚线椭圆就退化成实线。
  let dashArray = null;
  let dashPhase = 0;
  // pdf.js 的 clip/clipEO 只是「置位」pendingClip，真正建立裁剪区是在**下一个**
  // constructPath 被 consumePath() 消费时（pdf.mjs 19189-19208）。
  // 因此这里也延迟一位：clip 只置位，随后那条 constructPath 才拿来当裁剪区。
  // 旧实现相反 —— clip 到达时立刻消费 pendingPath，那是**上一条**已用掉的陈旧路径，
  // 于是裁剪区整体错位，把图例色块之类的小图元误剔
  // （第 10/13 页图表标签前的颜色标识就是这样消失的：色块实际在 clip 区外侧 ~1mm，
  //  错位的 clip 区把它判成不可见）。
  let pendingClipMode = 0; // 1 = clip，2 = eoClip

  // ---- 文本状态 ----
  let tm = [1, 0, 0, 1, 0, 0];
  let tlm = [1, 0, 0, 1, 0, 0];
  let fontName = null,
    fontSize = 0,
    leading = 0;

  // ---- 输出缓冲与裁剪区 ----
  const out = [];
  const PageWmm = pageWpt * scale;
  const PAGE_BOX = [0, 0, PageWmm, Hmm]; // 裁剪区 Path 用整页作 Boundary，坐标即绝对 mm
  let clipBoxes = []; // 各级裁剪区的轴对齐包围盒，用于剔除裁剪区外的图元
  let pendingPath = null; // endPath 定义的路径（绝对 mm 坐标），供 clip / shadingFill 取用

  let gradDbg = 0;
  const rev = walkOperators._rev || (walkOperators._rev = (() => {
    const r = {};
    for (const k of Object.keys(OPS)) r[OPS[k]] = k;
    return r;
  })());

  // 设备(pt, y-up) → OFD(mm, y-down)
  function px(x, y) {
    return [x * scale, Hmm - y * scale];
  }

  function emit(xml) {
    if (xml) out.push(xml);
  }

  // PDF 的 CTM 拆成 OFD 需要的「线性部分 L」与「平移 T」：
  //   x_ofd = a*s*x + c*s*y + e*s
  //   y_ofd = Hmm − (b*x + d*y + f)*s = (−b*s)*x + (−d*s)*y + (Hmm − f*s)
  function splitCtm(m) {
    return {
      L: [m[0] * scale, -m[1] * scale, m[2] * scale, -m[3] * scale],
      T: [m[4] * scale, Hmm - m[5] * scale],
    };
  }

  // CTM 线性部分「过小」时（图表里极常见）的处理。
  //
  // 现象：第 11 页坐标轴的 CTM 缩放只有 7.638e-5（PDF 用 transform
  // [0.00007874016, 0, 0, -0.00007874016, …] 把线框坐标放大了一万三千倍），
  // 而本转换器 fmt() 只保留 4 位小数 —— 7.638e-5 直接被写成 0，
  // CTM 输出成 "0 0 0 0 0 0"，路径全部塌缩到一点，坐标轴（网格线、刻度）整片消失。
  //
  // 对策（与数科产物一致）：缩放过小时不再依赖 CTM 表达缩放，而是
  // **把缩放吸收进图元坐标**，CTM 退化为单位阵（±scale 的 Y 翻转仍在）。
  // 效果是坐标从 322739 变成 ~24.6、CTM 从 0 变成 0.3528，
  // 数值落在 fmt 的有效精度内 —— 数科第 11 页正是这个形态
  // （CTM="0.3422 0 0 0.3422 …"，AbbreviatedData 坐标 17.5 / 168.7 这种量级）。
  //
  // 阈值取 0.05：CTM 线性项的量级低于它就说明路径数据已被 PDF 放大过，
  // 继续走 CTM 路线必然丢精度。
  const CTM_TINY = 0.05;
  // 抽出 CTM 的线性缩放（两轴几何平均），供 absorbScale 使用
  function ctmScaleOf(L) {
    return Math.sqrt(Math.abs(L[0] * L[3] - L[1] * L[2])) || 1;
  }
  // 把 m 的线性缩放整体吸进坐标：返回 [新矩阵, 缩放系数 k]，
  // 使得 新矩阵·(p·k) === 原矩阵·p（对任意仿射成立）。
  // k 取两轴几何平均，正数；符号信息保留在矩阵里。
  function absorbScale(m, L) {
    const k = ctmScaleOf(L);
    if (k >= CTM_TINY) return [m, 1];
    // 线性部分整体除以 k，等价于坐标整体乘以 k
    return [
      [m[0] / k, m[1] / k, m[2] / k, m[3] / k, m[4], m[5]],
      k,
    ];
  }

  // 依据 CTM 与 PDF 点集，算出 OFD 的 CTM 线性部分、Boundary、以及坐标归一化偏移。
  function geom(m, pts) {
    const { L, T } = splitCtm(m);
    let dminX = Infinity,
      dmaxX = -Infinity,
      dminY = Infinity,
      dmaxY = -Infinity;
    for (const p of pts) {
      const X = m[0] * p[0] + m[2] * p[1] + m[4];
      const Y = m[1] * p[0] + m[3] * p[1] + m[5];
      if (X < dminX) dminX = X;
      if (X > dmaxX) dmaxX = X;
      if (Y < dminY) dminY = Y;
      if (Y > dmaxY) dmaxY = Y;
    }
    const [bx, by] = px(dminX, dmaxY);
    const box = [bx, by, (dmaxX - dminX) * scale, (dmaxY - dminY) * scale];
    // 渲染器算的是 B0 + L·(p + d)，要让它等于 L·p + T ⇒ L·d = T − B0
    let dx = 0,
      dy = 0;
    const det = L[0] * L[3] - L[1] * L[2];
    if (Math.abs(det) > 1e-9) {
      const rx = T[0] - bx,
        ry = T[1] - by;
      dx = (L[3] * rx - L[2] * ry) / det;
      dy = (L[0] * ry - L[1] * rx) / det;
    }
    return { L, box, dx, dy };
  }

  function boxAttr(box) {
    return `${fmt(box[0])} ${fmt(box[1])} ${fmt(box[2])} ${fmt(box[3])}`;
  }
  function ctmAttr(L) {
    return `${fmt(L[0])} ${fmt(L[1])} ${fmt(L[2])} ${fmt(L[3])} 0 0`;
  }

  // 不输出 <ofd:Clips>。
  //
  // 两次实测都证明：在页面层发 Clips 会让 WPS 把内容整块裁没
  // （2026-10-13 停发后第 10/11/13 页图表正常显示；同日尝试恢复，第 9/10/12 页
  // 的图表又全部消失，用户反馈「你盖了之后都不出现了回退」）。
  // 数科页面 Content.xml 里零个 <ofd:Clip>，它把裁剪表达在 CompositeGraphicUnit /
  // CompositeObject 上；在没有引擎侧 CompositeObject 支持的前提下，本转换器
  // 采取「只剔除、不表达」的保守策略。
  //
  // 代价：靠裁剪区才能收敛的巨大图元（如第 6 页那个 1152×2199 的白底）会铺开。
  // 该问题改由 isOversizedRect() 在转换侧直接丢弃，不依赖渲染器支持 Clips。
  function clipXml() {
    return '';
  }

  // 可视性判断：图元包围盒必须与「页面 ∩ 各级裁剪区」有实际重叠。
  // <ofd:Clips> 只表达裁剪形状，但严格渲染器未必都支持；这里先用包围盒做一次剔除，
  // 免得被裁掉的大块内容照画不误（那些路径往往横跨整个页面，正是图形错位的元凶）。
  const CLIP_EPS = 0.6; // 容差：贴着裁剪边界的图框线/图注不误杀，页外上千毫米的垃圾路径仍会清掉
  //
  // `mode` 参数：判定用哪种可见区域。
  //   'page'（文字/描边线）→ 只用页面范围，完全不受 clipBoxes 影响
  //   'clip'（填充块）→ 按裁剪区求交，这才是 PDF 语义要求的
  //
  // 为什么描边线也要豁免裁剪区：表格框线横跨整行/整列，往往在「单元格裁剪区建立之前」
  // 就已发出，或跨越多个裁剪区。实测「电签通用签名板对接」第 2 页 12 条表格框线
  // （box=[29.8,25.5,150.5,0] 横跨 150mm 整行宽）里有 10 条被单元格 eoClip 剔掉，
  // 表现就是「表格边框显示不全」—— 只剩零星几段竖线。
  //
  // 填充块仍按裁剪区剔：第 6 页那块 1152×2199 的画布白底就是靠这个防住遮挡的。
  function visible(box, mode) {
    const useClip = mode === 'clip';
    let r = [-CLIP_EPS, -CLIP_EPS, PageWmm + CLIP_EPS * 2, Hmm + CLIP_EPS * 2];
    for (const c of useClip ? clipBoxes : []) {
      // 退化（零面积）裁剪区按 PDF 语义是「与区域求交 = 不变」，必须跳过；
      // 若当成真裁剪区去求交，整页内容会被一票否决（第 8 页 202 条路径就是这么消失的）。
      if (c[2] <= 0.01 || c[3] <= 0.01) continue;
      const x0 = Math.max(r[0], c[0] - CLIP_EPS);
      const y0 = Math.max(r[1], c[1] - CLIP_EPS);
      const x1 = Math.min(r[0] + r[2], c[0] + c[2] + CLIP_EPS);
      const y1 = Math.min(r[1] + r[3], c[1] + c[3] + CLIP_EPS);
      if (x1 - x0 <= 0.01 || y1 - y0 <= 0.01) return false;
      r = [x0, y0, x1 - x0, y1 - y0];
    }
    // 线状图元（表格框线/下划线/分隔线，包围盒宽或高为 0）也必须按最小厚度参与判断：
    // 直接用零面积求交会把「相交于一条线」判成不相交，整条线连同表格框就被误杀了。
    //
    // 最小厚度取 **1.0mm**：正文小字号的包围盒可能只有 0.02mm（见下），
    // 用 0.05mm 会让「相交 0.02mm」刚好越过 0.01mm 判定线而勉强存活，
    // 但裁剪区稍窄一点就整批被剔。放宽到 1mm 对可见性无副作用（页外垃圾路径
    // 动辄超出上千毫米），却能让真实的小字全部通过。
    const MIN_HIT = 1.0; // mm
    const bx0 = box[0];
    const by0 = box[1];
    const bx1 = box[0] + Math.max(box[2], MIN_HIT);
    const by1 = box[1] + Math.max(box[3], MIN_HIT);
    const x0 = Math.max(r[0], bx0);
    const y0 = Math.max(r[1], by0);
    const x1 = Math.min(r[0] + r[2], bx1);
    const y1 = Math.min(r[1] + r[3], by1);
    return x1 - x0 > 0.01 && y1 - y0 > 0.01;
  }

  // 可见区域，供 isOversizedRect 判定用。
  //
  // 取**最内层**那一个裁剪区（clipBoxes 的最后一项），而不是所有裁剪区的交集。
  // 图元是被最内层裁剪区限制的，用交集会出错：多个 Form 在页面上前后相邻时，
  // 交集可能落在某个具体插图内部，把背景块错误地塞进插图区
  // （第 6 页那块 1152×2199 的白底就是这样跑到了 x 124.5~134.2 的流程图位置，
  //  把图注文字盖住）。最内层裁剪区才是该图元真正的可见范围。
  function clipRegion() {
    for (let i = clipBoxes.length - 1; i >= 0; i--) {
      const c = clipBoxes[i];
      if (c[2] > 0.01 && c[3] > 0.01) return c.slice();
    }
    return null;
  }

  // 巨大填充块处理：图元比可见区域大出很多时（如整页 1152×2199 的画布底色），
  // 直接画出来会盖住正文与图注。
  //
  // 这类块在 PDF 里是 Form 的画布底色，靠 Form 边界裁剪；数科把它放进
  // CompositeGraphicUnit 并给 Boundary 框定可见范围（第 6 页 Unit 1054：
  // 内部 1152×2199，Boundary 137.1 25.4 33.7 48.0）。
  //
  // 本转换器不引入 CompositeObject（引擎不认它会导致整块消失），改为**直接丢弃**。
  // 为什么不「收敛成可见区域大小的矩形」：那会在图注文字之后留下一小块底色板，
  // 照样把图注盖住 —— 第 6 页就是这么丢的：白块被压成 x 124.5~134.2 / y 91.2~102.1
  // 的一小块，正好压住 y≈93 那行图注（用户反馈「第 6 页插图区文字被白色矩形盖住」）。
  // 丢弃的代价只是少了底色，而底色本来就是白的，画出来没有信息量。
  //
  // 仅对**纯矩形**填充块生效 —— 曲线/折线图元保持原样，避免把图表裁坏。
  const CLAMP_RATIO = 1.8;
  function isOversizedRect(d, box) {
    if (!d || !/^M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ C$/.test(d)) return false;
    const r = clipRegion();
    if (!r) return false;
    // 图元没有显著超出可见区域就别动
    if (box[0] >= r[0] - 0.5 && box[1] >= r[1] - 0.5 &&
        box[0] + box[2] <= r[0] + r[2] + 0.5 && box[1] + box[3] <= r[1] + r[3] + 0.5) return false;
    return box[2] >= r[2] * CLAMP_RATIO && box[3] >= r[3] * CLAMP_RATIO;
  }

  for (let i = 0; i < tc.fnArray.length; i++) {
    const name = rev[tc.fnArray[i]];
    const args = tc.argsArray[i];
    switch (name) {
      case 'save':
        gStack.push({ ctm, fillColor, strokeColor, lineWidth, lineCap, lineJoin, dashArray, dashPhase, leading, clipBoxes });
        ctm = ctm.slice();
        clipBoxes = clipBoxes.slice();
        break;
      case 'restore': {
        const s = gStack.pop();
        if (s) ({ ctm, fillColor, strokeColor, lineWidth, lineCap, lineJoin, dashArray, dashPhase, leading, clipBoxes } = s);
        break;
      }
      case 'transform':
        ctm = matMul(ctm, args);
        break;
      case 'setFillRGBColor':
        fillColor = hexToRgb(args[0]);
        break;
      case 'setStrokeRGBColor':
        strokeColor = hexToRgb(args[0]);
        break;
      case 'setFillGray':
        fillColor = { r: args[0], g: args[0], b: args[0] };
        break;
      case 'setStrokeGray':
        strokeColor = { r: args[0], g: args[0], b: args[0] };
        break;
      case 'setFillColorN':
      case 'setStrokeColorN': {
        // TilingPattern 填充：用预取好的图案平均色替换当前色。
        // 其它色彩空间（Indexed/CMYK/Lab）暂不支持 → 保持上一个颜色，至少不塌成黑。
        const id = patternImageId(args, OPS);
        const c = id && patternColors && patternColors.get(id);
        if (c) {
          if (name === 'setFillColorN') fillColor = c;
          else strokeColor = c;
        }
        break;
      }
      case 'setLineWidth':
        lineWidth = args[0];
        break;
      case 'setLineCap':
        lineCap = args[0];
        break;
      case 'setLineJoin':
        lineJoin = args[0];
        break;
      case 'setDash':
        // 记录虚线数组，输出为 PathObject 的 DashPattern 属性
        dashArray = args[0] && args[0].length ? Array.from(args[0]) : null;
        dashPhase = args[1] || 0;
        break;
      // ---- 文本 ----
      case 'beginText':
        tm = tlm = [1, 0, 0, 1, 0, 0];
        break;
      case 'endText':
        break;
      case 'setFont':
        fontName = args[0];
        fontSize = args[1];
        break;
      case 'setLeading':
        leading = args[0];
        break;
      case 'moveText':
        advanceLine(args[0], args[1]);
        break;
      case 'setLeadingMoveText':
        // pdf.js 源码（legacy/build/pdf.mjs ~18275）：
        //   setLeadingMoveText(opIdx, x, y) { setLeading(-y); moveText(x, y); }
        // 参数只有 **两个** [x, y]。旧代码读 args[2]/args[3] 越界 → 平移量 undefined
        //   → tm 变 NaN → 包围盒 NaN → visible() 误剔（1239 个文字只剩 39 个）。
        leading = -args[1];
        advanceLine(args[0], args[1]);
        break;
      case 'nextLine':
        advanceLine(0, -leading);
        break;
      case 'setTextMatrix': {
        // pdf.js 的 addOp(fn, [Float32Array]) 把参数包一层：args = [Float32Array(6)]
        // 关键坑：`args[0]` 是 **TypedArray**，不是普通 Array ——
        // `Array.isArray(args[0])` 恒为 false，只能用 length 或 ArrayBuffer 判别。
        // 旧写法判断不了嵌套，把整个外层数组赋给 tm，平移分量取到 undefined，
        // 包围盒算成 NaN，visible() 把 1239 个文字对象里的 1200 个误剔
        //（实测「电签通用签名板对接」3 页只剩 39 个文字，中文几乎全丢）。
        let m = args;
        if (m && m.length === 1 && m[0] && typeof m[0].length === 'number' && m[0].length >= 6)
          m = Array.from(m[0]); // TypedArray → 普通数组，避免下游按数组方法取值踩空
        if (!m || m.length < 6) m = [1, 0, 0, 1, 0, 0]; // 结构异常时退化为单位阵
        tm = tlm = m;
        break;
      }
      case 'showText':
      case 'showSpacedText':
        emit(emitText(args[0]));
        break;
      case 'nextLineShowText':
        tlm = matMul([1, 0, 0, 1, 0, -leading], tlm);
        tm = tlm.slice();
        emit(emitText(args[0]));
        break;
      case 'nextLineSetSpacingShowText':
        // args = [wordSpacing, charSpacing, glyphs]
        tlm = matMul([1, 0, 0, 1, 0, -leading], tlm);
        tm = tlm.slice();
        emit(emitText(args[2]));
        break;
      // ---- 矢量 ----
      case 'constructPath':
        emit(emitPath(args));
        break;
      case 'clip':
        // 只置位；裁剪区由紧随其后的 constructPath 建立（见 pendingClipMode 注释）
        pendingClipMode = 1;
        break;
      case 'eoClip':
        pendingClipMode = 2;
        break;
      case 'shadingFill': {
        // 渐变填充。老实现只取平均色近似，而且取色方式有 bug（见 patternAvgColor
        // 被替换后的注释）——第 11 页整片蓝色渐变柱因此全变成纯黑。
        //
        // 现在直接表达成 OFD 的轴向渐变 <ofd:AxialShd>，与数科产物同构：
        //   <ofd:FillColor><ofd:AxialShd Extend="3" StartPoint=".." EndPoint="..">
        //     <ofd:Segment Position="0"><ofd:Color Value="170 206 255"/></ofd:Segment>
        //     ...
        // 径向渐变 OFD 有 RadialShd，但两端色差在径向时视觉退化，
        // 统一按轴向表达更接近观感；确实拿不到色标才退回平均色实心填充。
        if (pendingPath) {
          const grad = gradShades.get(args[0]);
          if (process.env.P2OFD_DEBUG && gradDbg++ < 3) console.error('[dbg] size', gradShades.size, 'id', args[0], 'hit', !!grad, 'hasPendingPath', !!pendingPath);
          if (grad) {
            // 色标位置需在 [0,1]；PDF 给的是任意偏移量，按首尾归一化
            const pos = grad.stops.map(([t]) => t);
            const lo = Math.min(...pos);
            const hi = Math.max(...pos);
            const span = hi - lo || 1;
            // 渐变轴用 pattern 自带的起止点。pattern 里的点仍是 PDF 用户空间
// （第 11 页是 387523 这种被 transform 放大过的巨值），必须经当前 CTM
// 换算并做Y 翻转 —— 这些 Path 不带 CTM，只能直接写绝对 mm 坐标。
// p0/p1 缺失时退回填充区域的对角线两端，保证 StartPoint≠EndPoint。
const a0 = matMul(ctm, [1, 0, 0, 1, grad.p0[0], grad.p0[1]]);
const a1 = matMul(ctm, [1, 0, 0, 1, grad.p1[0], grad.p1[1]]);
let p0 = px(a0[4], a0[5]);
let p1 = px(a1[4], a1[5]);
if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 1e-6) {
              const bb = pendingPath.bounds || [0, 0, PageWmm, Hmm];
              p0 = [bb[0], bb[1]];
              p1 = [bb[0] + bb[2], bb[1] + bb[3]];
            }
            const segs = grad.stops
              .map(
                ([t, hex]) =>
                  `<ofd:Segment Position="${fmt((t - lo) / span, 6)}">` +
                  `<ofd:Color Value="${rgbVal(hexToRgb(hex))}"/></ofd:Segment>`,
              )
              .join('');
            emit(
              `<ofd:PathObject ID="${nextId()}" Boundary="${boxAttr(PAGE_BOX)}" Fill="true" Stroke="false">` +
                `<ofd:FillColor><ofd:AxialShd Extend="3" StartPoint="${fmt(p0[0], 4)} ${fmt(p0[1], 4)}" ` +
                `EndPoint="${fmt(p1[0], 4)} ${fmt(p1[1], 4)}">${segs}</ofd:AxialShd></ofd:FillColor>` +
                `${clipXml()}<ofd:AbbreviatedData>${pendingPath.d}</ofd:AbbreviatedData></ofd:PathObject>`,
            );
          } else {
            const col = { r: 0.5, g: 0.5, b: 0.5 };
            emit(
              `<ofd:PathObject ID="${nextId()}" Boundary="${boxAttr(PAGE_BOX)}" Fill="true" Stroke="false">` +
                `<ofd:FillColor Value="${rgbVal(col)}"/>${clipXml()}` +
                `<ofd:AbbreviatedData>${pendingPath.d}</ofd:AbbreviatedData></ofd:PathObject>`,
            );
          }
          pendingPath = null;
        }
        break;
      }
      // ---- 图像 ----
      case 'paintImageXObject':
        emit(emitImage(args[0]));
        break;
      // ---- Form XObject ----
      case 'paintFormXObjectBegin': {
        // Form XObject 语义等价于 save + concat(matrix) ... restore。
        // 与数科一致：内容内联展开为页面级图元 —— 数科产物里页面 Content.xml 直接包含数百个
        // PathObject/ImageObject，CompositeObject 只用于个别分组；若把 Form 收进
        // CompositeGraphicUnit，引擎不识别该元素时整个图表就消失了。
        gStack.push({ ctm, fillColor, strokeColor, lineWidth, lineCap, lineJoin, dashArray, dashPhase, leading, clipBoxes });
        const m = args[0] || [1, 0, 0, 1, 0, 0];
        ctm = matMul(ctm, m);
        clipBoxes = clipBoxes.slice();
        // Form 内部常含「远大于自身」的背景块（如 1152×2199 的整页白底），
        // 按 PDF 语义它被限制在 Form 的 BBox 内。只把 BBox 登记进 clipBoxes，
        // 供 visible() 剔除与 isOversizedRect() 丢弃使用，**不输出 <ofd:Clip>**
        // （页面层发 Clips 会让 WPS 把内容整块裁没，见 clipXml 上方注释）。
        // pdf.js 的 paintFormXObjectBegin 两个参数分别是 matrix 与 BBox 数组 [x0,y0,x1,y1]
        //（第 6 页两个 Form 分别是 [0,0,257,366] 与 [0,0,359,402]）。
        const fb = args[1];
        if (fb && fb.length >= 4 && fb[2] > fb[0] + 1 && fb[3] > fb[1] + 1) {
          const cs = [];
          for (const c of [[fb[0], fb[1]], [fb[2], fb[1]], [fb[2], fb[3]], [fb[0], fb[3]]]) {
            const dm = matMul(ctm, [1, 0, 0, 1, c[0], c[1]]);
            cs.push(px(dm[4], dm[5]));
          }
          const xs = cs.map((p) => p[0]),
            ys = cs.map((p) => p[1]);
          const bx = Math.min(...xs),
            by = Math.min(...ys);
          clipBoxes.push([bx, by, Math.max(...xs) - bx, Math.max(...ys) - by]);
        }
        break;
      }
      case 'paintFormXObjectEnd': {
        const s = gStack.pop();
        if (s) ({ ctm, fillColor, strokeColor, lineWidth, lineCap, lineJoin, dashArray, dashPhase, leading, clipBoxes } = s);
        break;
      }
      // 忽略：setGState / setRenderingIntent / setFlatness / dependency / beginAnnotation 等
    }
  }
  return out.join('');

  // ---- 文字输出 ----
  // 文字与路径的坐标系处理有一个本质区别：字形天生「从基线向上」绘制，
  // 因此 CTM 的线性部分绝不能带 Y 翻转（d 取负会把整个字形倒扣过来），
  // Y 翻转全部交给平移分量与 Boundary 吸收 —— 数科产物的文字 CTM d 分量恒为正，原因即在此。
  // TextCode 坐标 / DeltaX / Size 统一用「字号空间」：1 单位 = 1/Size em（即 em × fontSize）。
  // 文本行矩阵推进 ----
//
// 关键：Td/TD/T* 的位移量是**文本空间**单位，必须在 tlm 的**右侧**相乘（后乘）。
// 写成 matMul(trans, tlm)（左乘）会把位移施加到行起点之前，导致逐字 x 累加过快
//（实测「电签通用签名板对接」每字 155mm 一步，整行被推出页面，visible() 全部误剔）。
function advanceLine(x, y) {
  tlm = matMul(tlm, [1, 0, 0, 1, x, y]);
  tm = tlm.slice();
}

function emitText(glyphArr) {
    if (!glyphArr || !glyphArr.length) return '';
    const M = matMul(ctm, tm); // 文本空间(em) → 设备(pt, y-up)
    //
    // 两种 PDF 写法都要支持（这决定 Size 与边界盒怎么算）：
    //  a) 常规 PDF：Tm 是单位阵，setFont 的 size 就是磅值（tracemonkey 那份，size=9.6）
    //  b) 「字号编进 Tm」：setFont size=209 而 Tm=[0.05,0,0,-0.05,...]
    //     （国产 PDF / WPS 导出常见，电签那份即是）—— 真实磅值 = 209×0.05 = 10.45pt。
    //     若直接用 209，字会放大 20 倍，整页文字溢出页面被 visible() 剔光。
    //
    // OFD 的 Size 属性语义是「磅值」，而 CTM 承担其余缩放，所以这里：
    //   Size = fontSize × tmScale（真实磅值）
    //   M取 tm 的**单位化**版本（把 tmScale 除掉），让 CTM 不再重复缩放字号。
    const tmScale = Math.hypot(tm[0], tm[1]) || 1;
    const sizeTs = (fontSize || 1) * tmScale; // 真实磅值，写进 Size 属性
    const tmUnit = tmScale > 1e-6
      ? [tm[0] / tmScale, tm[1] / tmScale, tm[2] / tmScale, tm[3] / tmScale, tm[4], tm[5]]
      : tm;
    const Mdev = matMul(ctm, tmUnit); // 设备变换：CTM × 单位化文本矩阵

    let text = '';
    const adv = []; // 逐字 Advance（字号空间），与 glyph 对齐
    //
    // **一个 glyph 只产出一个字符**，codeList / text / adv 三者严格等长。
    //
    // 为什么：pdf.js 的 glyph.unicode 可能是多码点序列（ToUnicode 展开的产物，
    // 例如 `"` 会展开成 `"` + `quot` + `;`）。原实现把整个序列塞进 TextCode 文本，
    // 却每个字形只写一个 Glyphs，于是 3 个字形配 8 个字符：
    //   GlyphCount(3) ≠ CodeCount(8)、DeltaX(2) ≠ 字符数-1
    // 渲染器按 Glyphs 逐位取字形、按 TextCode 逐位取字符，两边错位，
    // 末尾被残留字形/文本补齐 —— 视觉表现就是「图表标签多出 # 等杂符号」
    // （实测第 10 页 39 处、第 13 页 30 处、第 2/11 页若干）。
    //
    // 修法：多码点序列只取**首码点**（它才是该字形真正可见的字符，
    // 且与 fontChar 一致），其余展开码位丢弃。这样
    //   Glyphs.length == CodeCount == text.length == DeltaX.length + 1
    // 恒成立，文本内容也更接近 PDF 视觉内容（`!"quot;#` -> `!"#`）。
    const codeList = [];
    for (const g of glyphArr) {
      if (typeof g === 'number') {
        // TJ 字距：与 glyph.width 同单位（1/1000 em），按规范从当前坐标里减去
        if (adv.length) adv[adv.length - 1] -= (g / 1000) * sizeTs;
        continue;
      }
      const u = g.unicode || '';
      if (!u) continue;
      const firstCp = u.codePointAt(0); // 首码点即该字形的可见字符
      // 取码优先级：fontChar（子集字体的原始真码）> unicode 首码点
      const code = g.fontChar ? g.fontChar.codePointAt(0) : firstCp;
      text += String.fromCodePoint(firstCp);
      codeList.push(code);
      adv.push((g.width / 1000) * sizeTs);
    }
    if (!text) return '';

    const fid = ensureFont(fontName);
    const f = fonts.get(fontName);
    const bold = f && f.bold ? ' Bold="true"' : '';
    const italic = f && f.italic ? ' Italic="true"' : '';

    // 逐字字形索引：直接从嵌入字体的 cmap 反查 glyph id，
    // 让查看器不必依赖码位→Unicode 的映射，子集字体的假码也就不会显示成乱码。
    //
    // Glyphs 数组长度必须 = DeltaX 项数 + 1（对齐数科产物，实测 2175 个 TextObject
    // 无一例外）：末位字形是真实字形，但它的 DeltaX 不单独给出，由渲染器自行推进。
    //
    // 绝不能把 glyph 0（.notdef）写进产物 —— 严格渲染器会把它画成可见的方框/杂符号。
    // 之前 `cmap.get(code) || 0` 的写法导致第 9/12 页各出现 65/66 处 glyph 0，
    // 正是用户反馈「标签多了其他符号」的原因。查不到真字形时退回 1（与哨兵同值，不可见）。
    // 逐字字形索引：直接从嵌入字体的 cmap 反查 glyph id，
    // 让查看器不必依赖码位→Unicode 的映射，子集字体的假码也就不会显示成乱码。
    //
    // 长度关系（必须严格成立）：
    //   Glyphs.length == CodeCount == text.length == DeltaX.length + 1
    // 一个 glyph 只产出一个字符（见下方累积循环），多码点序列只取首码点，
    // 因此三者天然等长，不会出现「3 个字形配 8 个字符」导致的渲染错位。
    //
    // glyph 0（.notdef）绝不能写进产物 —— 严格渲染器会画成方框/杂符号。
    //
    // 查不到真字形时**退回 gid 1**，与数科基准一致（实测数科第 10 页
    // `&-./012#3%4%56#` 的 Glyphs 为 41,7,33,6,26,5,8,1,34,40,32,40,29,35,1，
    // `#` 处正是 gid 1，且 CodeCount == Glyphs.length == 15）。
    //
    // 背景：这些字符（如 `#`）在 PDF 里的 isInFont=false —— 原 PDF 本身就没有该字形，
    // Acrobat/WPS 打开原 PDF 同样画不出，pdf.js 也只能给替代字形。
    // 因此这里不是转换缺陷，而是与基准、与原始 PDF 保持一致的正常行为。
    const cmap = fontCmap && fontCmap.get(fontName);
    let cg = '';
    if (cmap && cmap.size && codeList.length === text.length) {
      const gids = [];
      for (const code of codeList) {
        const gid = cmap.get(code);
        gids.push(gid ? gid : 1); // 0/.notdef 不可用，退回 1（对齐数科基准）
      }
      cg =
        `<ofd:CGTransform CodePosition="0" CodeCount="${gids.length}" GlyphCount="${gids.length}">` +
        `<ofd:Glyphs>${gids.join(' ')}</ofd:Glyphs></ofd:CGTransform>`;
    }

    // 字形包围盒：单位是**字号空间**（1 单位 = 1/Size em），与 TextCode / DeltaX 同单位，
    // 渲染器按 Size 属性换算成实际磅值。
    //
    // Mdev 已把 tm 的缩放剥离（字号交给 Size 属性），所以这里用 sizeTs（磅值）
    // 直接乘，与tracemonkey 基准的原有行为完全一致，不引入回归。
    const emAsc = f && isFinite(f.ascent) ? f.ascent : 0.88;
    const emDesc = f && isFinite(f.descent) ? f.descent : -0.22;
    let total = 0;
    for (const a of adv) total += Math.max(0, a); // adv 已是字号空间
    const totalW = Math.max(total, 0.01);
    const asc = emAsc * sizeTs;
    const desc = emDesc * sizeTs;

    const L = [Mdev[0] * scale, Mdev[1] * scale, Mdev[2] * scale, Mdev[3] * scale]; // 不取负，见函数头注释
    const T = [Mdev[4] * scale, Hmm - Mdev[5] * scale]; // Y 翻转在这里完成
    let dminX = Infinity,
      dmaxX = -Infinity,
      dminY = Infinity,
      dmaxY = -Infinity;
    for (const p of [[0, 0], [totalW, 0], [0, asc], [totalW, asc], [0, desc], [totalW, desc]]) {
      const X = Mdev[0] * p[0] + Mdev[2] * p[1] + Mdev[4];
      const Y = Mdev[1] * p[0] + Mdev[3] * p[1] + Mdev[5];
      if (X < dminX) dminX = X;
      if (X > dmaxX) dmaxX = X;
      if (Y < dminY) dminY = Y;
      if (Y > dmaxY) dmaxY = Y;
    }
    const [bx, by] = px(dminX, dmaxY);
    const box = [bx, by, (dmaxX - dminX) * scale, (dmaxY - dminY) * scale];
    // 渲染器算的是 B0 + L·(p + d)，令其等于 L·p + T ⇒ L·d = T − B0
    let ox = 0,
      oy = 0;
    const det = L[0] * L[3] - L[1] * L[2];
    if (Math.abs(det) > 1e-9) {
      const rx = T[0] - bx,
        ry = T[1] - by;
      ox = (L[3] * rx - L[2] * ry) / det;
      oy = (L[0] * ry - L[1] * rx) / det;
    }

    if (!visible(box, 'page')) return '';

    // DeltaX 只给「除末字外」的逐字 advance：Glyphs 数组比 DeltaX 多一项（末位真实字形），
    // 末字宽度由渲染器自行推进。写满 N 项会让末尾多出一段空白推进。
    const dx = adv.slice(0, -1).map((a) => fmt(a)).join(' ');
    return (
      `<ofd:TextObject ID="${nextId()}" CTM="${ctmAttr(L)}" Boundary="${boxAttr(box)}" ` +
      `Font="${fid}" Size="${fmt(sizeTs)}"${bold}${italic}>` +
      `<ofd:FillColor Value="${rgbVal(fillColor)}"/>${clipXml()}${cg}` +
      `<ofd:TextCode X="${fmt(ox)}" Y="${fmt(oy)}"${dx ? ` DeltaX="${dx}"` : ''}>${esc(text)}</ofd:TextCode>` +
      `</ofd:TextObject>`
    );
  }

  function ensureFont(loadedName) {
    if (!loadedName) return 0;
    if (fontResMap.has(loadedName)) return fontResMap.get(loadedName);
    const id = 100 + fontResMap.size;
    fontResMap.set(loadedName, id);
    return id;
  }

  // ---- 矢量输出 ----
  function emitPath(args) {
    const paintOp = rev[args[0]] || args[0];
    const buf = args[1] && args[1][0];
    if (!buf || !buf.length) return '';

    // pdf.js 路径缓冲命令码（pdfjs-dist 5.7 实测）：
    //   0=moveTo(2)  1=lineTo(2)  2=curveTo(6)  3=rectangle(4: x y w h)  4=closePath(0)
    // 该映射经全文档 997 条路径遍历校验：只有 {3→4 参数, 4→0 参数} 能恰好耗尽每个 buffer。
    // 多数 `re` 已被 pdf.js 展开成 moveTo/lineTo/close，但若遇到 3 必须按矩形处理，
    // 否则会把 (x,y,w,h) 当成二次贝塞尔的控制点，画出完全变形的图形。
    const cmds = [];
    let k = 0;
    while (k < buf.length) {
      const op = buf[k++];
      if (op === 0) cmds.push({ op: 'M', pts: [[buf[k++], buf[k++]]] });
      else if (op === 1) cmds.push({ op: 'L', pts: [[buf[k++], buf[k++]]] });
      else if (op === 2)
        cmds.push({
          op: 'B',
          pts: [
            [buf[k++], buf[k++]],
            [buf[k++], buf[k++]],
            [buf[k++], buf[k++]],
          ],
        });
      else if (op === 3) {
        const rx = buf[k++],
          ry = buf[k++],
          rw = buf[k++],
          rh = buf[k++];
        cmds.push({ op: 'M', pts: [[rx, ry]] });
        cmds.push({ op: 'L', pts: [[rx + rw, ry]] });
        cmds.push({ op: 'L', pts: [[rx + rw, ry + rh]] });
        cmds.push({ op: 'L', pts: [[rx, ry + rh]] });
        cmds.push({ op: 'C', pts: [] });
      } else if (op === 4) cmds.push({ op: 'C', pts: [] });
      else break; // 未知命令：停止，避免后续数据整体错位
    }
    if (!cmds.length) return '';

    const all = [];
    for (const c of cmds) for (const p of c.pts) all.push(p);
    if (!all.length) return '';

    // CTM 缩放过小时把缩放吸进坐标（见 absorbScale 注释），
    // 否则 7.6e-5 这类缩放会被 fmt 的 4 位小数抹成 0，整条路径塌缩消失。
    // 注意 geom 要收**缩放后**的点：它算出的 Boundary/dx/dy 都属于新坐标空间。
    const [effCtm, kScale] = absorbScale(ctm, splitCtm(ctm).L);
    const g = geom(effCtm, kScale === 1 ? all : all.map((p) => [p[0] * kScale, p[1] * kScale]));
    // 序列化命令流。conv 决定坐标落在哪个坐标系：
    //   绘制用图元 → 归一化偏移（保留 PDF 原值，靠 CTM 换算）
    //   裁剪区/渐变区 → 绝对页面 mm（这些 Path 不带 CTM，只能用绝对坐标）
    function serialize(conv) {
      let s = '';
      for (const c of cmds) {
        if (c.op === 'C') {
          s += 'C ';
          continue;
        }
        s += c.op;
        for (const p of c.pts) {
          const q = conv(p[0], p[1]);
          s += ` ${fmt(q[0])} ${fmt(q[1])}`;
        }
        s += ' ';
      }
      return s.trim();
    }
    const d = serialize((x, y) => [x * kScale + g.dx, y * kScale + g.dy]);
    if (!d) return '';

    if (paintOp === 'endPath') {
      // 路径已定义但暂不绘制 —— 留给随后的 shadingFill 取用。
      //
      // 若前面有 clip / eoClip 置位，这条路径**既是**裁剪区**又是**（可能的）填充区：
      // PDF 里 `W n` 之后紧跟 `sh f` 是常见写法（先裁剪、再用同一形状填渐变），
      // pdf.js 也是先 clip 再对同一路径填色。所以这里只登记裁剪区，
      // **不能清掉 pendingPath** —— 否则紧随其后的 shadingFill 会因拿不到区域而静默丢弃，
      // 表现为整片渐变柱凭空消失（第 11 页 81 处AxialShd 全丢）。
      if (pendingClipMode) {
        clipBoxes.push(g.box);
        pendingClipMode = 0;
      }
      const abs = serialize((x, y) => {
        const dm = matMul(effCtm, [1, 0, 0, 1, x * kScale, y * kScale]);
        return px(dm[4], dm[5]);
      });
      pendingPath = { d: abs, bounds: g.box };
      return '';
    }

    const fill = paintOp.includes('fill') || paintOp === 'fill' || paintOp === 'eoFill' || paintOp.includes('Fill');
    const stroke = paintOp.includes('stroke') || paintOp === 'stroke';
    const evenOdd =
      paintOp.includes('eoFill') ||
      paintOp === 'eoFill' ||
      paintOp === 'eoFillStroke' ||
      paintOp === 'closeEOFillStroke';

    // 描边线（表格框线/分隔线/下划线）豁免裁剪区，只有纯填充块按裁剪区剔。
    // 见visible() 上方注释：框线常横跨多个单元格裁剪区，按裁剪区剔会只剩零星几段。
    if (!visible(g.box, stroke ? 'page' : 'clip')) return '';

    // Form 画布底色类的巨大纯色矩形直接丢弃（见 isOversizedRect 注释）。
    // 不能「收敛成可见区域大小」—— 那会在正文之后留下一小块底色板照样盖住图注。
    if (fill && !stroke && isOversizedRect(d, g.box)) return '';

    const dOut = d;
    const boxOut = g.box;

    let s = `<ofd:PathObject ID="${nextId()}" CTM="${ctmAttr(g.L)}" Boundary="${boxAttr(boxOut)}"`;
    s += ` Fill="${fill}" Stroke="${stroke}"`;
    if (evenOdd) s += ' Rule="Even-Odd"';
    // 线宽：OFD 的 LineWidth 与 AbbreviatedData 同处一个坐标空间（会被 CTM 再缩放），
    // 因此必须写该空间下的值 —— PDF 用户空间原值（如 1/2/3/5），**不能**预先乘 CTM。
    // 旧实现乘了 CTM 的 mm 缩放系数，等于把线宽缩小了近 3 倍（0.3528 因子 × 图表内
    // 0.35~0.47 的 CTM），所有线都细成同一条 —— 正是「连线有些粗有些细、现在一样细」
    // 的根因。数科产物实测：第 6/7 页 LineWidth 为 1/2/3/5/8，与 PDF setLineWidth 一致。
    //
    // 但坐标被 absorbScale 乘过 k 时，同一空间的线宽也要跟着乘 k
    // （否则第 11 页 9525 会变成 9525×0.3528 的巨粗线；数科该页是 0.75）。
    const lw = Math.max(Math.abs(lineWidth) * kScale, 0.02);
    s += ` LineWidth="${fmt(lw)}"`;
    if (lineCap) s += ` Cap="${capJoinName(lineCap, 'Cap')}"`;
    if (lineJoin) s += ` Join="${capJoinName(lineJoin, 'Join')}"`;
    // 虚线：OFD 规范里 DashPattern 是 PathObject 的**属性**（不是子元素），
    // 值为「实线段 长 空格段 长 …」，与 AbbreviatedData 同坐标空间，故写 PDF 原值。
    // 漏掉它，第 2 页那些 4 4 虚线椭圆就会全部退化成实线边框。
    if (dashArray && dashArray.length && (dashArray.some((v) => v > 0) || dashArray.length % 2 === 0))
      s += ` DashPattern="${dashArray.map((v) => fmt(Math.abs(v) * kScale)).join(' ')}"`;
    s += '>';
    if (fill) s += `<ofd:FillColor Value="${rgbVal(fillColor)}"/>`;
    if (stroke) s += `<ofd:StrokeColor Value="${rgbVal(strokeColor)}"/>`;
    s += clipXml();
    s += `<ofd:AbbreviatedData>${dOut}</ofd:AbbreviatedData>`;
    s += '</ofd:PathObject>';
    return s;
  }

  // ---- 图像输出 ----
  function emitImage(objId) {
    let img = null;
    try {
      img = page.objs.get(objId);
    } catch (e) {
      return '';
    }
    if (!img || !img.width) return '';
    let store = imageStore.get(objId);
    if (!store) {
      const rgba = imageToRgba(img);
      if (!rgba) return '';
      const png = encodePng(img.width, img.height, rgba);
      store = { png, w: img.width, h: img.height, ofdId: nextId() };
      imageStore.set(objId, store);
    }
    // 图像画在单位正方形 [0,1]² 上。
    //
    // CTM 的 Y 分量**必须保持正值**，不能像路径那样取负。
    // 原因：OFD 渲染器算的是 `B0 + L·p`（图像的绘制矩形就是 Boundary 本身，p∈[0,1]²），
    // 若L 含 Y 翻转，就会把图像整体上下颠倒并推到 Boundary 的另一侧 ——
    // 实测「电签通用签名板对接」第 1 页落点变成 y −42.9~68.8（跑到页面外，WPS 直接不显示），
    // 而能显示的第 2 页恰好因为 CTM 的 b/c 分量为 0、翻转只影响 d 才没暴露问题。
    //
    // Y 翻转已由 Boundary（px() 里完成的 `Hmm − Y`）承担，这里只保留 PDF 的真实缩放/旋转。
    const L = [ctm[0] * scale, ctm[1] * scale, ctm[2] * scale, ctm[3] * scale];
    // 绝对落点仍按 geom() 算（含翻转），用于可见性剔除与 Boundary
    const g = geom(ctm, [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]);
    if (!visible(g.box, 'page')) return '';
    return (
      `<ofd:ImageObject ID="${nextId()}" CTM="${ctmAttr(L)}" Boundary="${boxAttr(g.box)}" ` +
      `ResourceID="${store.ofdId}"/>`
    );
  }
}

function capJoinName(v, kind) {
  if (kind === 'Cap') return ['', 'Butt', 'Round', 'Square'][v] || 'Butt';
  return ['', 'Miter', 'Round', 'Bevel'][v] || 'Miter';
}
// 取 pdf.js 轴向/径向渐变 pattern 的色标序列。
//
// 关键：`page.objs.get()` 在对象尚未解析时返回的是 **Promise**，不是数组。
// 旧实现拿它当数组直接 find()，Promise 上没有这些属性 → 抛错落进 catch →
// 返回兜底色 0.5/0.5/0.5。第 11 页 143 根渐变柱因此全被填成纯黑 0 0 0
// （FillColor 默认值），颜色整片消失 —— 蓝色渐变（#9bc1ff→#3f80cd）全丢。
//
// 现在改为：从 operatorList 里**预先收集** pattern id 并 await 解析，
// 结果存进 gradShades 缓存，shadingFill 时同步查表。
// RadialAxial 结构: [kind, type, null, colorStops, startPoint, endPoint, ...]
// colorStops 形如 [[0,"#9bc1ff"],[1,"#3f80cd"]]
function extractColorStops(p) {
  if (!Array.isArray(p)) return null;
  const stops = p.find(
    (x) => Array.isArray(x) && x.length && Array.isArray(x[0]) && typeof x[0][1] === 'string',
  );
  return stops && stops.length ? stops : null;
}

// 预解析页面里用到的全部渐变 pattern（必须在 shadingFill 之前 await 完，
// 因为运行期 objs.get 只能拿到未解析的 Promise）。
async function prefetchGradients(page, tc, OPS) {
  const ids = new Set();
  for (let i = 0; i < tc.fnArray.length; i++) {
    if (tc.fnArray[i] === OPS.shadingFill) ids.add(tc.argsArray[i][0]);
  }
  const map = new Map();
  for (const id of ids) {
    try {
      const p = await page.objs.get(id);
      const stops = extractColorStops(p);
      if (stops) {
        map.set(id, {
          stops,
          // type: 'axial' | 'radial'
          type: Array.isArray(p) && typeof p[1] === 'string' ? p[1] : 'axial',
          p0: Array.isArray(p) && Array.isArray(p[4]) ? p[4] : null,
          p1: Array.isArray(p) && Array.isArray(p[5]) ? p[5] : null,
        });
      }
    } catch (e) {
      /* 该 pattern 解析不出来就走平均色兜底 */
    }
  }
  return map;
}

// ---- setFillColorN / setStrokeColorN：平铺图案（TilingPattern）取色 ----
//
// 有些 PDF（如 tracemonkey 第 13 页 Figure 12）把图表色块/图例用「一张 80×80 小图作为
// 平铺图案」来填色：setFillColorN 的参数形如
//   [ 'TilingPattern', backdrop, {fnArray,argsArray}, matrix, bbox, ... ]
// 图案内容(argsArray[2]) 里是 paintImageXObject ['img_pX_Y', w, h]。
// 旧 walkOperators 完全没有 setFillColorN 分支，这类填充沿用上一个颜色（默认黑），
// 于是彩色柱状图/图例整片变黑或缺失 —— 数科同样支持不全。
//
// 方案（不违反「禁用栅格化」）：图案内联的图**本身就是已存在的位图**，我们只是**读取**
// 它的平均色当作该形状的填充色（图例色块通常是纯色，平均色即精确色），不产生新位图。
// 与渐变一样必须**预先 await** 解析 image 公共对象（运行期 objs.get 只能拿到 Promise）。

// 从 setFillColorN/setStrokeColorN 的 args 里取出 TilingPattern 内联图片的 objId；非图案返回 null。
function patternImageId(args, OPS) {
  if (!Array.isArray(args) || args[0] !== 'TilingPattern') return null;
  const content = args[2];
  if (!content || !content.fnArray) return null;
  for (let i = 0; i < content.fnArray.length; i++) {
    if (content.fnArray[i] === OPS.paintImageXObject) {
      const a = content.argsArray[i];
      const id = a && a[0];
      if (typeof id === 'string') return id;
    }
  }
  return null;
}

// RGBA 缓冲的（按 alpha 加权的）平均色，分量 0..1；无有效像素返回 null。
function avgRgba(rgba) {
  if (!rgba || !rgba.length) return null;
  let r = 0, g = 0, b = 0, w = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (!a) continue;
    r += rgba[i] * a;
    g += rgba[i + 1] * a;
    b += rgba[i + 2] * a;
    w += a;
  }
  if (!w) return null;
  return { r: r / w / 255, g: g / w / 255, b: b / w / 255 };
}

// 预取页面里所有 TilingPattern 填充图的平均色，返回 Map<objId,{r,g,b}>。
async function prefetchPatternColors(page, tc, OPS) {
  const ids = new Set();
  for (let i = 0; i < tc.fnArray.length; i++) {
    const f = tc.fnArray[i];
    if (f === OPS.setFillColorN || f === OPS.setStrokeColorN) {
      const id = patternImageId(tc.argsArray[i], OPS);
      if (id) ids.add(id);
    }
  }
  const map = new Map();
  for (const id of ids) {
    try {
      const img = await page.objs.get(id);
      const rgba = img && imageToRgba(img);
      const c = avgRgba(rgba);
      if (c) map.set(id, c);
    } catch (e) {
      /* 解析不出来就走原色兜底，不阻断整页 */
    }
  }
  return map;
}
function stopsAvgColor(stops) {
  let r = 0,
    g = 0,
    b = 0;
  for (const [, hex] of stops) {
    const c = hexToRgb(hex);
    r += c.r;
    g += c.g;
    b += c.b;
  }
  const n = stops.length || 1;
  return { r: r / n, g: g / n, b: b / n };
}
function hexToRgb(hex) {
  const h = String(hex || '#000000').replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
function rgbVal(c) {
  const p = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `${p(c.r)} ${p(c.g)} ${p(c.b)}`;
}
// 把 pdf.js 解码后的图像统一转成 RGBA：
//   kind 1 = 灰度 2 = RGB 3 = RGBA（旧实现只认 3，RGB/灰度图会被整块丢弃）
function imageToRgba(img) {
  if (!img || !img.width || !img.height) return null;
  const n = img.width * img.height;
  const src = img.data;
  if (!src) return null;
  if (img.kind === 3) {
    if (src.length < n * 4) return null;
    return new Uint8Array(src.buffer, src.byteOffset, n * 4);
  }
  if (img.kind === 2) {
    if (src.length < n * 3) return null;
    const out = Buffer.alloc(n * 4);
    for (let i = 0, o = 0; i < n; i++) {
      out[o++] = src[i * 3];
      out[o++] = src[i * 3 + 1];
      out[o++] = src[i * 3 + 2];
      out[o++] = 255;
    }
    return out;
  }
  if (img.kind === 1) {
    if (src.length < n) return null;
    const out = Buffer.alloc(n * 4);
    for (let i = 0, o = 0; i < n; i++) {
      const v = src[i];
      out[o++] = v;
      out[o++] = v;
      out[o++] = v;
      out[o++] = 255;
    }
    return out;
  }
  return null;
}

// 从嵌入字体的 cmap 建立「字符码 → 字形索引」映射，供 TextObject 的 CGTransform/Glyphs 使用。
// pdf.js 的 glyph 只给 fontChar（子集里的码位）不给字形 id，而 fontChar 正是 cmap 的键，
// 反查即可拿到 gid；查看器据此直接取字形，无需依赖码位→Unicode 映射，子集假码也就不会乱码。
function buildFontCmap(buf) {
  const map = new Map();
  try {
    if (!buf || buf.length < 12) return map;
    const numTables = buf.readUInt16BE(4);
    let cm = null;
    for (let i = 0; i < numTables; i++) {
      const o = 12 + i * 16;
      if (buf.slice(o, o + 4).toString('latin1') !== 'cmap') continue;
      const off = buf.readUInt32BE(o + 8);
      const len = buf.readUInt32BE(o + 12);
      cm = buf.slice(off, off + len);
      break;
    }
    if (!cm || cm.length < 4) return map;
    const n = cm.readUInt16BE(2);
    let fmt4 = -1;
    let fmt12 = -1;
    for (let i = 0; i < n; i++) {
      const r = 4 + i * 8;
      const plat = cm.readUInt16BE(r);
      const enc = cm.readUInt16BE(r + 2);
      const off = cm.readUInt32BE(r + 4);
      if (off + 2 > cm.length) continue;
      const fmt = cm.readUInt16BE(off);
      if (fmt === 4 && (fmt4 < 0 || (plat === 3 && enc === 1))) fmt4 = off;
      else if (fmt === 12 && fmt12 < 0) fmt12 = off;
    }
    if (fmt4 >= 0) return readFmt4(cm, fmt4);
    if (fmt12 >= 0) {
      const nGroups = cm.readUInt32BE(fmt12 + 12);
      for (let g = 0; g < nGroups; g++) {
        const o = fmt12 + 16 + g * 12;
        if (o + 12 > cm.length) break;
        const start = cm.readUInt32BE(o);
        const end = cm.readUInt32BE(o + 4);
        const gid = cm.readUInt32BE(o + 8);
        const hi = Math.min(end, start + 0xffff);
        for (let c = start; c <= hi; c++) map.set(c, gid + (c - start));
      }
    }
  } catch (e) {
    return map;
  }
  return map;
}

// ===========================================================================
// 主转换流程
// ===========================================================================
// pdf.js 的资源目录：一律转成正斜杠并以 '/' 结尾。
// 两个坑：
//   1) path.sep 在 Windows 上是 '\'，直接拼会被 pdf.js 判为「缺少结尾斜杠」而抛错；
//   2) 用 file:// URL 也不行 —— pdf.js 内部对该 URL 发 fetch()，Node 下读不了本地文件，
//      报「Unable to load CMap data at: file:///...」。
//   正确做法：普通本地路径 + 全部反斜杠换成正斜杠 + 结尾加 '/'。
//
// 打包成 npm 包后本文件位于 <pkg>/lib/，不再有 ../node_modules 这一层，
// 因此统一走 require.resolve('pdfjs-dist/...') 定位 ——
// 无论源码树、打包产物还是用户的 node_modules，解析规则一致。
function pdfjsResUrl(dir) {
  let base;
  try {
    base = path.dirname(require.resolve('pdfjs-dist/package.json'));
  } catch (e) {
    // 兜底：源码树布局 <repo>/build/../node_modules/pdfjs-dist
    base = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist');
  }
  return path.join(base, dir).replace(/\\/g, '/') + '/';
}
// pdf.js 主模块同样是 ESM（.mjs），必须用动态 import；
// 路径同样用 require.resolve 解析，避免依赖调用方的目录层级。
function pdfjsEntry() {
  try {
    return require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
  } catch (e) {
    return path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs');
  }
}
const cmapsUrl = () => pdfjsResUrl('cmaps');
const stdFontsUrl = () => pdfjsResUrl('standard_fonts');

// options: { onProgress(processed, total), quiet } —— quiet 为 true 时不打印进度
async function convert(pdfPath, ofdPath, options) {
  const onProgress = (options && options.onProgress) || null;
  const quiet = options && options.quiet != null ? options.quiet : QUIET;
  const pdfjs = await import(require('url').pathToFileURL(pdfjsEntry()).href);
  const OPS = pdfjs.OPS;
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({
    data,
    disableFontFace: false, // 关键：保留字体字节
    isEvalSupported: false,
    // 中文/日文等 CID 字体会报「Ensure that the `cMapUrl` API parameter is provided.」，
    // 字体加载随之失败 → 字体表为空 → 整页文字被丢弃（实测 tests.pdf 文字 0、字体 0）。
    // 注意：pdf.js 要求以「正斜杠」结尾，Windows 的 path.sep 是反斜杠，必须手工拼 '/'。
    cMapUrl: cmapsUrl(),
    cMapPacked: true,
    standardFontDataUrl: stdFontsUrl(),
    // 非嵌入的标准字体（Helvetica 等 14 种）需要度量信息做宽度计算
    useSystemFonts: true,
    fontExtraProperties: true,
  }).promise;

  // ---- 从 worker 消息层拦截字体字节（compileFontInfo 编译后的 buffer） ----
  const fonts = new Map(); // loadedName -> {name, mimetype, data(Uint8Array), ascent, descent}
  const fontCmap = new Map(); // loadedName -> Map<字符码, 字形索引>
  const comObj = doc._transport.messageHandler.comObj;
  comObj.addEventListener(
    'message',
    (e) => {
      const m = e.data;
      if (m && m.action === 'commonobj' && m.data && m.data[1] === 'Font') {
        const [id, , payload] = m.data;
        const info = parseCompiledFont(payload.buffer);
        // 元信息无条件登记，字节只在真有时才存。
        // 非嵌入字体（中文 CID 常见）没有 data，但页面上照样有 TextObject 引用它 ——
        // 若连元信息一起跳过，PublicRes 里就没有这个字体，TextObject 的 Font 引用悬空。
        fonts.set(id, {
          name: info && info.name,
          loadedName: info && info.loadedName,
          fallbackName: info && info.fallbackName,
          mimetype: info && info.mimetype,
          data: info && info.data,
          ascent: info && info.ascent,
          descent: info && info.descent,
        });
        if (info && info.data && info.data.length) {
          const raw = Buffer.from(info.data);
          fontCmap.set(id, buildFontCmap(raw));
        }
      }
    },
    true,
  );

  const pagesXml = [];
  const pageContents = [];
  const imageStore = new Map(); // objId -> {png, w, h}
  const fontResMap = new Map(); // loadedName -> ofdFontId
  const compositeUnits = []; // Form XObject → CompositeGraphicUnit XML
  let nextFontId = 100;
  let maxUnitId = 1000;
  let pageWpt = 612,
    pageHpt = 792;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    pageWpt = vp.width;
    pageHpt = vp.height;
    const tc = await page.getOperatorList();
    // 等待图像对象异步解码
    await waitImages(page, tc, OPS, imageStore);
    // 渐变 pattern 同样必须**预先 await 解析** —— 运行期 objs.get() 只能拿到未解析的
    // Promise，取不到色标就会退回灰色兜底（表现为图表颜色整片消失）
    const gradShades = await prefetchGradients(page, tc, OPS);
    const patternColors = await prefetchPatternColors(page, tc, OPS);
    const body = walkOperators(tc, OPS, page, {
      pageWpt,
      pageHpt,
      fonts,
      fontResMap,
      imageStore,
      compositeUnits,
      fontCmap,
      gradShades,
      patternColors,
      nextId: () => ++maxUnitId,
    });
    pageContents.push(body);
    pagesXml.push(
      `<ofd:Page ID="${p}" BaseLoc="Pages/Page_${p - 1}/Content.xml"/>`,
    );
    if (onProgress) onProgress(p, doc.numPages);
    if (!quiet) console.error(`  已处理 ${p}/${doc.numPages} 页`);
  }

  // ---- 组装 OFD ----
  const Wmm = pageWpt * PT_TO_MM;
  const Hmm = pageHpt * PT_TO_MM;

  // 字体资源（PublicRes）：对齐数科 —— 用真实字体名，并补 Bold / Italic / FixedWidth，
  // 文件名取 font_<ID>_<ID>.<ext>。字形正确性改由 TextObject 的 CGTransform/Glyphs 保证，
  // 不依赖系统字体名匹配，因此这里可以放心用真名。
  //
  // 关键：**非嵌入字体也必须写进 PublicRes**。
  // PDF 允许引用未嵌入的标准字体（中文常见 STSong-Light、STHeiti 等 CID 字体，
  // 也包括 PDF 文档未内嵌的 Helvetica/Times）。这类字体 pdf.js 拿不到字节
  // （commonobj 里 mimetype=null、无 data），此前在下面被 `if (!f) continue` 跳过，
  // 结果页面里的 TextObject 全部引用了一个不存在的 Font ID
  // （实测 tests.pdf：1064 个文字对象，PublicRes 里 0 个字体）—— 严格渲染器会拒绝或显示异常。
  // 正确做法：声明字体但不给 FontFile，由渲染器按 FontName 回退到系统字体。
  const fontEntries = [];
  const fontFiles = [];
  for (const [loadedName, fid] of fontResMap) {
    const f = fonts.get(loadedName);
    const base = fontNameOf(f) || loadedName || 'Unknown';
    if (!f || !f.data || !f.data.length) {
      // 无字体字节：只声明，不给 FontFile
      fontEntries.push(
        `<ofd:Font ID="${fid}" FontName="${esc(base)}"${fontProps(base)}/>`,
      );
      continue;
    }
    const ext = f.mimetype === 'font/opentype' || /\.(otf|otto)$/i.test(base) ? 'otf' : 'ttf';
    fontEntries.push(
      `<ofd:Font ID="${fid}" FontName="${esc(base)}"${fontProps(base)}><ofd:FontFile>font_${fid}_${fid}.${ext}</ofd:FontFile></ofd:Font>`,
    );
    fontFiles.push({ name: `Doc_0/Res/font_${fid}_${fid}.${ext}`, data: ensureMacCmap(Buffer.from(f.data)) });
  }

  // 图片资源（DocumentRes）
  const mmEntries = [];
  const resFiles = [];
  for (const [objId, img] of imageStore) {
    if (!img.ofdId) continue;
    mmEntries.push(
      `<ofd:MultiMedia ID="${img.ofdId}" Type="Image" Format="PNG"><ofd:MediaFile>image_${img.ofdId}.png</ofd:MediaFile></ofd:MultiMedia>`,
    );
    resFiles.push({ name: `Doc_0/Res/image_${img.ofdId}.png`, data: img.png });
  }

  const { date: today, stamp: nowStamp } = nowOfd();
  const zip = new ZipWriter();
  zip.add(
    'OFD.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<ofd:OFD xmlns:ofd="http://www.ofdspec.org/2016" Version="1.1" DocType="OFD"><ofd:DocBody><ofd:DocInfo><ofd:DocID>${randomId()}</ofd:DocID><ofd:CreationDate>${today}</ofd:CreationDate><ofd:ModDate>${nowStamp}</ofd:ModDate><ofd:Creator>ofd-core</ofd:Creator><ofd:CreatorVersion>1.0.0</ofd:CreatorVersion></ofd:DocInfo><ofd:DocRoot>Doc_0/Document.xml</ofd:DocRoot></ofd:DocBody></ofd:OFD>`,
  );
  zip.add(
    'Doc_0/Document.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<ofd:Document xmlns:ofd="http://www.ofdspec.org/2016"><ofd:CommonData><ofd:MaxUnitID>${maxUnitId + 10}</ofd:MaxUnitID><ofd:PageArea><ofd:PhysicalBox>0 0 ${fmt(Wmm)} ${fmt(Hmm)}</ofd:PhysicalBox></ofd:PageArea><ofd:PublicRes>PublicRes.xml</ofd:PublicRes><ofd:DocumentRes>DocumentRes.xml</ofd:DocumentRes></ofd:CommonData><ofd:Pages>${pagesXml.join('')}</ofd:Pages></ofd:Document>`,
  );
  zip.add(
    'Doc_0/PublicRes.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<ofd:Res xmlns:ofd="http://www.ofdspec.org/2016" BaseLoc="Res"><ofd:Fonts>${fontEntries.join('')}</ofd:Fonts></ofd:Res>`,
  );
  zip.add(
    'Doc_0/DocumentRes.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<ofd:Res xmlns:ofd="http://www.ofdspec.org/2016" BaseLoc="Res"><ofd:MultiMedias>${mmEntries.join('')}</ofd:MultiMedias>${compositeUnits.length ? `<ofd:CompositeGraphicUnits>${compositeUnits.join('')}</ofd:CompositeGraphicUnits>` : ''}</ofd:Res>`,
  );

  // 字体文件与图片资源
  for (const ff of fontFiles) zip.add(ff.name, ff.data);
  for (const rf of resFiles) zip.add(rf.name, rf.data);

  for (let i = 0; i < pageContents.length; i++) {
    zip.add(
      `Doc_0/Pages/Page_${i}/Content.xml`,
      `<?xml version="1.0" encoding="UTF-8"?>\n<ofd:Page xmlns:ofd="http://www.ofdspec.org/2016"><ofd:Area><ofd:PhysicalBox>0 0 ${fmt(Wmm)} ${fmt(Hmm)}</ofd:PhysicalBox></ofd:Area><ofd:Content><ofd:Layer ID="1">${pageContents[i]}</ofd:Layer></ofd:Content></ofd:Page>`,
    );
  }

  const outBytes = zip.build();
  fs.writeFileSync(ofdPath, outBytes);
  const stats = { pages: doc.numPages, fonts: fonts.size, images: imageStore.size, bytes: outBytes.length };
  if (!quiet)
    console.error(`完成：${ofdPath}（${stats.pages} 页，${stats.fonts} 字体，${stats.images} 图像，${stats.bytes} 字节）`);
  return stats;
}

function randomId() {
  return require('crypto').randomBytes(16).toString('hex');
}

// OFD 的日期写法：CreationDate 用 YYYY-MM-DD，ModDate 用带时区的完整时间戳
function nowOfd() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const off = -d.getTimezoneOffset();
  const ao = Math.abs(off);
  const tz = `${off >= 0 ? '+' : '-'}${p(Math.floor(ao / 60))}:${p(ao % 60)}`;
  return { date, stamp: `${date}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${tz}` };
}

// 字体名：去掉子集前缀（ABCDEF+），与数科一致用 PDF 里的真实字体名
function fontNameOf(f) {
  // f 可能为 undefined —— 非嵌入字体没有字节，页面上仍有 TextObject 引用它
  if (!f) return '';
  const raw = f.name || f.loadedName || f.fallbackName || 'Font';
  return String(raw).replace(/^[A-Z]{6}\+/, '');
}

// 从字体名推断字形特征（对齐数科输出的 Bold / Italic / FixedWidth）
function fontProps(n) {
  let s = '';
  if (/bold|black|heavy|semibold|demibold|medi$/i.test(n)) s += ' Bold="true"';
  if (/italic|oblique|slant/i.test(n)) s += ' Italic="true"';
  if (/mono|courier|cmtt|fixed/i.test(n)) s += ' FixedWidth="true"';
  return s;
}

// 解析 pdf.js 编译后的字体 buffer（布局见 pdf.worker FONT_INFO）
function parseCompiledFont(buffer) {
  if (!buffer || !buffer.byteLength) return null;
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  try {
    let off = 92; // OFFSET_STRINGS
    view.getUint32(off);
    off += 4;
    const out = {};
    const strs = ['fallbackName', 'loadedName', 'mimetype', 'name'];
    for (const s of strs) {
      const len = view.getUint32(off);
      off += 4;
      out[s] = new TextDecoder().decode(bytes.slice(off, off + len));
      off += len;
    }
    // 数值（ascent/defaultWidth/descent）在头部 3..27
    out.ascent = view.getFloat64(3);
    out.descent = view.getFloat64(19);
    // systemFontInfo
    let l = view.getUint32(off);
    off += 4 + l;
    // cssFontInfo
    l = view.getUint32(off);
    off += 4 + l;
    // data
    const dl = view.getUint32(off);
    off += 4;
    out.data = bytes.slice(off, off + dl);
    return out;
  } catch (e) {
    return null;
  }
}

// 等待操作符列表里引用的图像对象解码完成
async function waitImages(page, tc, OPS, imageStore) {
  const ids = [];
  for (let i = 0; i < tc.fnArray.length; i++) {
    if (tc.fnArray[i] === OPS.paintImageXObject) ids.push(tc.argsArray[i][0]);
  }
  if (!ids.length) return;
  const deadline = Date.now() + 8000;
  for (const id of ids) {
    while (!page.objs.has(id)) {
      if (Date.now() > deadline) break;
      await new Promise((r) => setTimeout(r, 20));
    }
  }
}

// ---- 给内嵌字体补 Mac(platform 1/0) cmap 子表 ----
// WPS 等严格 OFD 查看器读取内嵌字体时依赖 Mac(1/0) cmap；pdf.js 编译出的子集字体常只带
// Windows(3/1) format-4 cmap → WPS 认不出→回退系统字体→无 ToUnicode 的图表标签(假码 0x21…)显示成乱码。
// 这里从 Win format-4 子表还原 code→GID，另建一份内容相同的 Mac format-4 子表并置于首位，保留原 sfnt 版本。
function ensureMacCmap(buf) {
  try {
    const sfntVer = buf.readUInt32BE(0);
    const numTables = buf.readUInt16BE(4);
    const dirs = [];
    let cmapOff = -1;
    for (let i = 0; i < numTables; i++) {
      const o = 12 + i * 16;
      const tag = buf.slice(o, o + 4).toString('latin1');
      const off = buf.readUInt32BE(o + 8);
      const len = buf.readUInt32BE(o + 12);
      dirs.push({ tag, data: buf.slice(off, off + len) });
      if (tag === 'cmap') cmapOff = off;
    }
    if (cmapOff < 0) return buf;
    const cmap = dirs.find((d) => d.tag === 'cmap').data;
    const n = cmap.readUInt16BE(2);
    let winAbs = -1, macAbs = -1;
    for (let i = 0; i < n; i++) {
      const r = 4 + i * 8;
      const p = cmap.readUInt16BE(r), e = cmap.readUInt16BE(r + 2), off = cmap.readUInt32BE(r + 4);
      if (p === 3 && e === 1) winAbs = off;
      if (p === 1 && e === 0) macAbs = off;
    }
    if (macAbs >= 0) return buf; // 已有 Mac 子表
    if (winAbs < 0 || cmap.readUInt16BE(winAbs) !== 4) return buf; // 只处理 format-4 Win 表
    const map = readFmt4(cmap, winAbs);
    if (!map.size) return buf;
    const macSub = buildFmt4(map);
    if (!macSub) return buf;
    const winSub = cmap.slice(winAbs);
    const newCmap = buildCmap(winSub, macSub);
    const cmapDir = dirs.find((d) => d.tag === 'cmap');
    cmapDir.data = newCmap;
    return rebuildSfnt(sfntVer, dirs);
  } catch (e) {
    return buf;
  }
}
function readFmt4(buf, off) {
  const map = new Map();
  const segX2 = buf.readUInt16BE(off + 6), sc = segX2 / 2, base = off + 14;
  const end = [], start = [], delta = [], range = [];
  for (let i = 0; i < sc; i++) end.push(buf.readUInt16BE(base + i * 2));
  for (let i = 0; i < sc; i++) start.push(buf.readUInt16BE(base + segX2 + 2 + i * 2));
  for (let i = 0; i < sc; i++) delta.push(buf.readInt16BE(base + segX2 * 2 + 2 + i * 2));
  const rangeBase = base + segX2 * 3 + 2;
  for (let i = 0; i < sc; i++) range.push(buf.readUInt16BE(rangeBase + i * 2));
  for (let s = 0; s < sc; s++) {
    if (start[s] === 0xFFFF) continue;
    for (let c = start[s]; c <= end[s]; c++) {
      let gid;
      if (range[s] === 0) gid = (c + delta[s]) & 0xFFFF;
      else {
        const gi = rangeBase + s * 2 + range[s] + (c - start[s]) * 2;
        if (gi + 1 < buf.length) { gid = buf.readUInt16BE(gi); if (gid !== 0) gid = (gid + delta[s]) & 0xFFFF; }
        else gid = 0;
      }
      if (gid) map.set(c, gid);
    }
  }
  return map;
}
function buildFmt4(map) {
  const codes = [...map.keys()].filter((c) => c <= 0xFFFF && c !== 0xFFFF).sort((a, b) => a - b);
  if (!codes.length) return null;
  const segs = [];
  let s = codes[0], p = codes[0];
  for (let i = 1; i < codes.length; i++) {
    if (codes[i] === p + 1) p = codes[i];
    else { segs.push([s, p]); s = codes[i]; p = codes[i]; }
  }
  segs.push([s, p]); segs.push([0xFFFF, 0xFFFF]);
  const sc = segs.length, segX2 = sc * 2;
  const end = [], start = [], delta = [], gidArr = [];
  for (let i = 0; i < sc; i++) {
    const [a, b] = segs[i]; end.push(b); start.push(a);
    if (a === 0xFFFF) { delta.push(1); gidArr.push(null); continue; }
    const delta0 = ((map.get(a) || 0) - a) & 0xFFFF;
    let uniform = true;
    for (let c = a; c <= b; c++) if ((map.get(c) || 0) !== ((c + delta0) & 0xFFFF)) { uniform = false; break; }
    if (uniform) { delta.push(delta0); gidArr.push(null); }
    else {
      delta.push(0);
      const arr = []; for (let c = a; c <= b; c++) arr.push(map.get(c) || 0);
      gidArr.push(arr);
    }
  }
  const gidTotal = gidArr.reduce((n, r) => n + (r ? r.length : 0), 0);
  const size = 16 + segX2 * 4 + gidTotal * 2;
  const sub = Buffer.alloc(size);
  sub.writeUInt16BE(4, 0); sub.writeUInt16BE(size, 2); sub.writeUInt16BE(segX2, 6); sub.writeUInt16BE(1, 8);
  let o = 14;
  end.forEach((v) => { sub.writeUInt16BE(v, o); o += 2; });
  o += 2; // reservedPad
  start.forEach((v) => { sub.writeUInt16BE(v, o); o += 2; });
  delta.forEach((v) => { sub.writeUInt16BE(v & 0xFFFF, o); o += 2; });
  const rangeOffsetPos = o;
  const gidStart = rangeOffsetPos + sc * 2;
  let cursor = gidStart;
  for (let i = 0; i < sc; i++) {
    if (gidArr[i]) { gidArr[i].forEach((g) => { sub.writeUInt16BE(g, cursor); cursor += 2; }); }
  }
  for (let i = 0; i < sc; i++) {
    let gs = gidStart;
    for (let t = 0; t < i; t++) if (gidArr[t]) gs += gidArr[t].length * 2;
    const iro = gidArr[i] ? gs - (rangeOffsetPos + i * 2) : 0;
    sub.writeUInt16BE(iro, rangeOffsetPos + i * 2);
  }
  return sub;
}
function buildCmap(winSub, macSub) {
  const recs = [{ p: 1, e: 0, sub: macSub }, { p: 3, e: 1, sub: winSub }];
  const header = 4 + recs.length * 8;
  let total = header;
  for (const r of recs) { r.off = total; total += r.sub.length + ((4 - (r.sub.length % 4)) % 4); }
  const out = Buffer.alloc(total);
  out.writeUInt16BE(0, 0); out.writeUInt16BE(recs.length, 2);
  recs.forEach((r, i) => { const o = 4 + i * 8; out.writeUInt16BE(r.p, o); out.writeUInt16BE(r.e, o + 2); out.writeUInt32BE(r.off, o + 4); });
  recs.forEach((r) => r.sub.copy(out, r.off));
  return out;
}
function rebuildSfnt(sfntVer, dirs) {
  const sorted = dirs.slice().sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const num = sorted.length;
  let sr = 1, es = 0; while (sr * 2 <= num) { sr *= 2; es++; }
  const header = Buffer.alloc(12);
  header.writeUInt32BE(sfntVer, 0); header.writeUInt16BE(num, 4); header.writeUInt16BE(sr * 16, 6); header.writeUInt16BE(es, 8); header.writeUInt16BE((num - sr) * 16, 10);
  let cursor = 12 + num * 16; const entries = [];
  for (const d of sorted) { const len = d.data.length; entries.push({ tag: d.tag, data: d.data, chk: crc32(d.data), off: cursor, len }); cursor += len + ((4 - (len % 4)) % 4); }
  const out = Buffer.alloc(cursor); header.copy(out, 0);
  entries.forEach((e, i) => { const o = 12 + i * 16; Buffer.from(e.tag, 'latin1').copy(out, o); out.writeUInt32BE(e.chk, o + 4); out.writeUInt32BE(e.off, o + 8); out.writeUInt32BE(e.len, o + 12); });
  entries.forEach((e) => e.data.copy(out, e.off));
  const hi = entries.findIndex((e) => e.tag === 'head');
  if (hi >= 0) { out.writeUInt32BE(0, entries[hi].off + 8); const adj = (0xb1b0afba - crc32(out)) >>> 0; out.writeUInt32BE(adj, entries[hi].off + 8); }
  return out;
}

module.exports = { convert, ZipWriter, encodePng, PT_TO_MM };

// Node CLI 入口
if (require.main === module) {
  const [, , inp, outp] = process.argv;
  if (!inp) {
    console.error('用法: node build/pdf2ofd.js input.pdf [output.ofd]');
    process.exit(1);
  }
  convert(inp, outp || inp.replace(/\.pdf$/i, '.ofd')).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
