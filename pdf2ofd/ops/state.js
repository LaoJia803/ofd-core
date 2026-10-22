// 一页转换过程的显式状态：gs（图形状态）、ts（文本状态）、sink（输出与裁剪）。
import { PT_TO_MM } from "../core/util.js";

export function createState(pageWpt, pageHpt) {
  const scale = PT_TO_MM;
  const Hmm = pageHpt * scale;
  const PageWmm = pageWpt * scale;
  return {
    scale,
    Hmm,
    PageWmm,
    PAGE_BOX: [0, 0, PageWmm, Hmm], // 裁剪区 Path 用整页作 Boundary，坐标即绝对 mm
    gs: {
      ctm: [1, 0, 0, 1, 0, 0],
      fillColor: { r: 0, g: 0, b: 0 },
      strokeColor: { r: 0, g: 0, b: 0 },
      lineWidth: 1,
      lineCap: 0,
      lineJoin: 0,
      // 虚线状态：PDF 的 setDash(args=[dashArray, dashPhase])。OFD 用 PathObject 的
      // DashPattern 属性（对齐数科产物：`<ofd:PathObject ... DashPattern="4 4">`），
      // 不是子元素 —— 写成子元素引擎会忽略，虚线椭圆就退化成实线。
      dashArray: null,
      dashPhase: 0,
      // Tl 属于图形状态（q/Q 会保存与恢复），tm/tlm/font 不属于。
      leading: 0,
    },
    ts: {
      tm: [1, 0, 0, 1, 0, 0],
      tlm: [1, 0, 0, 1, 0, 0],
      fontName: null,
      fontSize: 0,
    },
    sink: {
      out: [],
      // 各级裁剪区的轴对齐包围盒，用于剔除裁剪区外的图元
      clipBoxes: [],
      // endPath 定义的路径（绝对 mm 坐标），供 clip / shadingFill 取用
      pendingPath: null,
      // pdf.js 的 clip/clipEO 只是「置位」pendingClip，真正建立裁剪区是在**下一个**
      // constructPath 被 consumePath() 消费时（pdf.mjs 19189-19208）。
      // 因此这里也延迟一位：clip 只置位，随后那条 constructPath 才拿来当裁剪区。
      // 旧实现相反 —— clip 到达时立刻消费 pendingPath，那是**上一条**已用掉的陈旧路径，
      // 于是裁剪区整体错位，把图例色块之类的小图元误剔
      // （第 10/13 页图表标签前的颜色标识就是这样消失的：色块实际在 clip 区外侧 ~1mm，
      //  错位的 clip 区把它判成不可见）。
      pendingClipMode: 0, // 1 = clip，2 = eoClip
    },
    stack: [],
    gradDbg: 0,
  };
}

export function saveState(st) {
  st.stack.push({ gs: { ...st.gs }, clipBoxes: st.sink.clipBoxes });
  st.gs.ctm = st.gs.ctm.slice();
  st.sink.clipBoxes = st.sink.clipBoxes.slice();
}

export function restoreState(st) {
  const s = st.stack.pop();
  if (s) {
    Object.assign(st.gs, s.gs);
    st.sink.clipBoxes = s.clipBoxes;
  }
}

export function emit(st, xml) {
  if (xml) st.sink.out.push(xml);
}
