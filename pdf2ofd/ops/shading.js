// 渐变填充：pendingPath + type4 渐变 → <ofd:AxialShd>。
import { matMul } from "../core/util.js";
import { fmt } from "../ofd/xml.js";
import { hexToRgb, rgbVal } from "../res/color.js";
import { boxAttr, px } from "./geom.js";
import { clipXml } from "./clip.js";
import { emit } from "./state.js";

export function emitShading(st, ctx, args) {
  const { PageWmm, Hmm, gs, sink } = st;
  const { ctm } = gs;
  const { gradShades, nextId } = ctx;
  const pendingPath = sink.pendingPath;
  if (!pendingPath) return;
  // 渐变填充。老实现只取平均色近似，而且取色方式有 bug（见 patternAvgColor
  // 被替换后的注释）——第 11 页整片蓝色渐变柱因此全变成纯黑。
  //
  // 现在直接表达成 OFD 的轴向渐变 <ofd:AxialShd>，与数科产物同构：
  //   <ofd:FillColor><ofd:AxialShd Extend="3" StartPoint=".." EndPoint="..">
  //     <ofd:Segment Position="0"><ofd:Color Value="170 206 255"/></ofd:Segment>
  //     ...
  // 径向渐变 OFD 有 RadialShd，但两端色差在径向时视觉退化，
  // 统一按轴向表达更接近观感；确实拿不到色标才退回平均色实心填充。
  const grad = gradShades.get(args[0]);
  if (process.env.P2OFD_DEBUG && st.gradDbg++ < 3)
    console.error('[dbg] size', gradShades.size, 'id', args[0], 'hit', !!grad, 'hasPendingPath', !!pendingPath);
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
    let p0 = px(st, a0[4], a0[5]);
    let p1 = px(st, a1[4], a1[5]);
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
    emit(st,
      `<ofd:PathObject ID="${nextId()}" Boundary="${boxAttr(st.PAGE_BOX)}" Fill="true" Stroke="false">` +
        `<ofd:FillColor><ofd:AxialShd Extend="3" StartPoint="${fmt(p0[0], 4)} ${fmt(p0[1], 4)}" ` +
        `EndPoint="${fmt(p1[0], 4)} ${fmt(p1[1], 4)}">${segs}</ofd:AxialShd></ofd:FillColor>` +
        `${clipXml()}<ofd:AbbreviatedData>${pendingPath.d}</ofd:AbbreviatedData></ofd:PathObject>`,
    );
  } else {
    const col = { r: 0.5, g: 0.5, b: 0.5 };
    emit(st,
      `<ofd:PathObject ID="${nextId()}" Boundary="${boxAttr(st.PAGE_BOX)}" Fill="true" Stroke="false">` +
        `<ofd:FillColor Value="${rgbVal(col)}"/>${clipXml()}` +
        `<ofd:AbbreviatedData>${pendingPath.d}</ofd:AbbreviatedData></ofd:PathObject>`,
    );
  }
  sink.pendingPath = null;
}
