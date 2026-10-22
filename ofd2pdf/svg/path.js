// SVG 路径 → PDF 路径：Q 转三次贝塞尔、A 弧拆分、可选矩阵变换。
import { fmtNum } from "../core/util.js";

/* ------------------------- SVG 路径 → PDF ------------------------- */
// SVG 弧（端点参数化）→ 若干三次贝塞尔段
function arcToCubics(x0, y0, rx, ry, rotDeg, laf, sf, x1, y1) {
  const segs = [];
  if (x0 === x1 && y0 === y1) return segs;
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (rx === 0 || ry === 0) { segs.push({ c1: [x1, y1], c2: [x1, y1], p: [x1, y1] }); return segs; }
  const phi = rotDeg * Math.PI / 180;
  const cosP = Math.cos(phi), sinP = Math.sin(phi);
  const dx = (x0 - x1) / 2, dy = (y0 - y1) / 2;
  const x1p = cosP * dx + sinP * dy;
  const y1p = -sinP * dx + cosP * dy;
  let rx2 = rx * rx, ry2 = ry * ry;
  const lam = x1p * x1p / rx2 + y1p * y1p / ry2;
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); rx2 = rx * rx; ry2 = ry * ry; }
  const num = rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p;
  const den = rx2 * y1p * y1p + ry2 * x1p * x1p;
  let rad = den ? Math.sqrt(Math.max(0, num / den)) : 0;
  if (laf === sf) rad = -rad;
  const cxp = rad * rx * y1p / ry;
  const cyp = -rad * ry * x1p / rx;
  const cx = cosP * cxp - sinP * cyp + (x0 + x1) / 2;
  const cy = sinP * cxp + cosP * cyp + (y0 + y1) / 2;
  const ang = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const l = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy)) || 1;
    let a = Math.acos(Math.max(-1, Math.min(1, dot / l)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const theta1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dtheta = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sf && dtheta > 0) dtheta -= 2 * Math.PI;
  else if (sf && dtheta < 0) dtheta += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dtheta) / (Math.PI / 2)));
  const dth = dtheta / n;
  const pt = t => [
    cx + rx * Math.cos(t) * cosP - ry * Math.sin(t) * sinP,
    cy + rx * Math.cos(t) * sinP + ry * Math.sin(t) * cosP
  ];
  let a0 = theta1;
  for (let k = 0; k < n; k++) {
    const a1 = a0 + dth;
    const p1 = pt(a0 + dth / 3);
    const p2 = pt(a0 + 2 * dth / 3);
    const p3 = pt(a1);
    segs.push({ c1: [p1[0], p1[1]], c2: [p2[0], p2[1]], p: [p3[0], p3[1]] });
    a0 = a1;
  }
  return segs;
}
// 椭圆 → 4 段三次贝塞尔（k = 4/3·(tan(π/8))）
// 顺时针：右顶点 → 底部 → 左顶点 → 顶部 → 回到起点
export function ellipseToCubics(cx, cy, rx, ry) {
  const k = 0.5522847498307936;
  const kx = rx * k, ky = ry * k;
  return [
    { c1: [cx + rx, cy + ky], c2: [cx + kx, cy + ry], p: [cx, cy + ry] },
    { c1: [cx - kx, cy + ry], c2: [cx - rx, cy + ky], p: [cx - rx, cy] },
    { c1: [cx - rx, cy - ky], c2: [cx - kx, cy - ry], p: [cx, cy - ry] },
    { c1: [cx + kx, cy - ry], c2: [cx + rx, cy - ky], p: [cx + rx, cy] }
  ];
}
// SVG path d（M/L/C/Q/A/Z，支持命令简写续接）→ PDF 路径指令
// tm：可选 2D 变换矩阵 [a,b,c,d,e,f]，对每个坐标点应用（SVG transform 语义：
// x' = a·x + c·y + e, y' = b·x + d·y + f）。弧段只变换终点，rx/ry/旋转角不变（纯平移场景足够）
export function pathToPdf(d, tm) {
  const re = /[MLCQAZ]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
  const toks = String(d).match(re) || [];
  const out = [];
  let i = 0;
  let curX = 0, curY = 0, subX = 0, subY = 0;
  let prevCmd = '';
  const read = () => parseFloat(toks[i++]);
  const isLetter = t => /^[MLCQAZ]$/.test(t);
  const xf = (x, y) => tm
    ? [tm[0] * x + tm[2] * y + tm[4], tm[1] * x + tm[3] * y + tm[5]]
    : [x, y];
  while (i < toks.length) {
    let cmd = toks[i];
    if (isLetter(cmd)) { i++; prevCmd = cmd; }
    else { cmd = prevCmd === 'M' ? 'L' : (prevCmd || 'L'); }
    if (cmd === 'Z') {
      out.push('h');
      curX = subX; curY = subY;
      continue;
    }
    const arity = cmd === 'C' ? 6 : cmd === 'Q' ? 4 : cmd === 'A' ? 7 : 2;
    do {
      if (i >= toks.length || isLetter(toks[i])) break;
      const p = [];
      for (let k = 0; k < arity; k++) p.push(read());
      // 参数不足（非法/截断路径）：丢弃整条命令，避免 NaN 污染后续坐标
      if (p.some(v => !isFinite(v))) break;
      if (cmd === 'M') {
        const q = xf(p[0], p[1]);
        curX = q[0]; curY = q[1];
        out.push(fmtNum(curX) + ' ' + fmtNum(curY) + ' m');
        subX = curX; subY = curY;
        prevCmd = 'L'; // M 之后的隐式续接为直线
      } else if (cmd === 'L') {
        const q = xf(p[0], p[1]);
        curX = q[0]; curY = q[1];
        out.push(fmtNum(curX) + ' ' + fmtNum(curY) + ' l');
      } else if (cmd === 'C') {
        const q1 = xf(p[0], p[1]), q2 = xf(p[2], p[3]), q3 = xf(p[4], p[5]);
        curX = q3[0]; curY = q3[1];
        out.push(fmtNum(q1[0]) + ' ' + fmtNum(q1[1]) + ' ' + fmtNum(q2[0]) + ' ' + fmtNum(q2[1]) +
          ' ' + fmtNum(curX) + ' ' + fmtNum(curY) + ' c');
      } else if (cmd === 'Q') {
        // 二次贝塞尔 → 三次贝塞尔
        const q1 = xf(p[0], p[1]), q2 = xf(p[2], p[3]);
        const c1x = curX + (q1[0] - curX) * 2 / 3;
        const c1y = curY + (q1[1] - curY) * 2 / 3;
        const c2x = q2[0] + (q1[0] - q2[0]) * 2 / 3;
        const c2y = q2[1] + (q1[1] - q2[1]) * 2 / 3;
        curX = q2[0]; curY = q2[1];
        out.push(fmtNum(c1x) + ' ' + fmtNum(c1y) + ' ' + fmtNum(c2x) + ' ' + fmtNum(c2y) +
          ' ' + fmtNum(curX) + ' ' + fmtNum(curY) + ' c');
      } else { // A：拆分为三次贝塞尔
        const q = xf(p[5], p[6]);
        const segs = arcToCubics(curX, curY, p[0], p[1], p[2], p[3], p[4], q[0], q[1]);
        for (const s of segs) {
          out.push(fmtNum(s.c1[0]) + ' ' + fmtNum(s.c1[1]) + ' ' + fmtNum(s.c2[0]) + ' ' + fmtNum(s.c2[1]) +
            ' ' + fmtNum(s.p[0]) + ' ' + fmtNum(s.p[1]) + ' c');
        }
        curX = q[0]; curY = q[1];
      }
    } while (i < toks.length && !isLetter(toks[i]));
  }
  return out.join(' ');
}
