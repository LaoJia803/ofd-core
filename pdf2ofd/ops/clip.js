// 裁剪区：只做可见性剔除，不向 OFD 输出 <ofd:Clips>。

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
export function clipXml() {
  return '';
}

// 可视性判断：图元包围盒必须与「页面 ∩ 各级裁剪区」有实际重叠。
// <ofd:Clips> 只表达裁剪形状，但严格渲染器未必都支持；这里先用包围盒做一次剔除，
// 免得被裁掉的大块内容照画不误（那些路径往往横跨整个页面，正是图形错位的元凶）。
const CLIP_EPS = 0.6; // 容差：贴着裁剪边界的图框线/图注不误杀，页外上千毫米的垃圾路径仍会清掉

// `mode` 参数：判定用哪种可见区域。
//   'page'（文字/描边线）→ 只用页面范围，完全不受 clipBoxes 影响
//   'clip'（填充块）→ 按裁剪区求交，这才是 PDF 语义要求的
//
// 为什么描边线也要豁免裁剪区：表格框线横跨整行/整列，往往在「单元格裁剪区建立之前」
// 就已发出，或跨越多个裁剪区。实测一份国产表单类 PDF 的第 2 页 12 条表格框线
// （box=[29.8,25.5,150.5,0] 横跨 150mm 整行宽）里有 10 条被单元格 eoClip 剔掉，
// 表现就是「表格边框显示不全」—— 只剩零星几段竖线。
//
// 填充块仍按裁剪区剔：第 6 页那块 1152×2199 的画布白底就是靠这个防住遮挡的。
export function visible(st, box, mode) {
  const useClip = mode === 'clip';
  const { PageWmm, Hmm } = st;
  let r = [-CLIP_EPS, -CLIP_EPS, PageWmm + CLIP_EPS * 2, Hmm + CLIP_EPS * 2];
  for (const c of useClip ? st.sink.clipBoxes : []) {
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
export function clipRegion(st) {
  const cb = st.sink.clipBoxes;
  for (let i = cb.length - 1; i >= 0; i--) {
    const c = cb[i];
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
export function isOversizedRect(st, d, box) {
  if (!d || !/^M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ C$/.test(d)) return false;
  const r = clipRegion(st);
  if (!r) return false;
  // 图元没有显著超出可见区域就别动
  if (box[0] >= r[0] - 0.5 && box[1] >= r[1] - 0.5 &&
      box[0] + box[2] <= r[0] + r[2] + 0.5 && box[1] + box[3] <= r[1] + r[3] + 0.5) return false;
  return box[2] >= r[2] * CLAMP_RATIO && box[3] >= r[3] * CLAMP_RATIO;
}
