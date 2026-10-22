// 坐标几何：PDF(pt, y-up) → OFD(mm, y-down) 的 CTM、Boundary 与归一化偏移。
import { fmt } from "../ofd/xml.js";

// 设备(pt, y-up) → OFD(mm, y-down)
export function px(st, x, y) {
  return [x * st.scale, st.Hmm - y * st.scale];
}

// PDF 的 CTM 拆成 OFD 需要的「线性部分 L」与「平移 T」：
//   x_ofd = a*s*x + c*s*y + e*s
//   y_ofd = Hmm − (b*x + d*y + f)*s = (−b*s)*x + (−d*s)*y + (Hmm − f*s)
export function splitCtm(st, m) {
  return {
    L: [m[0] * st.scale, -m[1] * st.scale, m[2] * st.scale, -m[3] * st.scale],
    T: [m[4] * st.scale, st.Hmm - m[5] * st.scale],
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
export const CTM_TINY = 0.05;
// 抽出 CTM 的线性缩放（两轴几何平均），供 absorbScale 使用
export function ctmScaleOf(L) {
  return Math.sqrt(Math.abs(L[0] * L[3] - L[1] * L[2])) || 1;
}
// 把 m 的线性缩放整体吸进坐标：返回 [新矩阵, 缩放系数 k]，
// 使得 新矩阵·(p·k) === 原矩阵·p（对任意仿射成立）。
// k 取两轴几何平均，正数；符号信息保留在矩阵里。
export function absorbScale(m, L) {
  const k = ctmScaleOf(L);
  if (k >= CTM_TINY) return [m, 1];
  // 线性部分整体除以 k，等价于坐标整体乘以 k
  return [
    [m[0] / k, m[1] / k, m[2] / k, m[3] / k, m[4], m[5]],
    k,
  ];
}

// 依据 CTM 与 PDF 点集，算出 OFD 的 CTM 线性部分、Boundary、以及坐标归一化偏移。
export function geom(st, m, pts) {
  const { L, T } = splitCtm(st, m);
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
  const [bx, by] = px(st, dminX, dmaxY);
  const box = [bx, by, (dmaxX - dminX) * st.scale, (dmaxY - dminY) * st.scale];
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

export function boxAttr(box) {
  return `${fmt(box[0])} ${fmt(box[1])} ${fmt(box[2])} ${fmt(box[3])}`;
}
export function ctmAttr(L) {
  return `${fmt(L[0])} ${fmt(L[1])} ${fmt(L[2])} ${fmt(L[3])} 0 0`;
}
