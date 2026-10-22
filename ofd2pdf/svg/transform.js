// SVG transform / tspan rotate / clip-path url() 的解析。
// 解析 SVG transform 属性 → 合并矩阵 [a,b,c,d,e,f]
// SVG 变换按书写顺序作用（左侧先作用于坐标），即最终矩阵 = 各变换的矩阵乘积
export function parseTransform(str) {
  let m = [1, 0, 0, 1, 0, 0];
  const re = /(translate|matrix|scale|rotate)\(([^)]*)\)/g;
  let mm;
  while ((mm = re.exec(str || ''))) {
    const args = mm[2].trim().split(/[\s,]+/).map(Number);
    let t;
    if (mm[1] === 'translate') {
      t = [1, 0, 0, 1, args[0] || 0, args[1] || 0];
    } else if (mm[1] === 'matrix') {
      t = args;
    } else if (mm[1] === 'scale') {
      const sx = args[0] || 1;
      t = [sx, 0, 0, args[1] != null ? args[1] : sx, 0, 0];
    } else { // rotate
      const ang = (args[0] || 0) * Math.PI / 180;
      const c = Math.cos(ang), s = Math.sin(ang);
      const cx = args[1] || 0, cy = args[2] || 0;
      t = [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
    }
    // 新变换 t 叠加在已有 m 之后：m = m · t（SVG transform 列表按书写顺序，
    // 先出现的变换作用于更外层，矩阵乘法左乘）
    m = [
      m[0] * t[0] + m[2] * t[1],
      m[1] * t[0] + m[3] * t[1],
      m[0] * t[2] + m[2] * t[3],
      m[1] * t[2] + m[3] * t[3],
      m[0] * t[4] + m[2] * t[5] + m[4],
      m[1] * t[4] + m[3] * t[5] + m[5]
    ];
  }
  return m;
}
// 解析 tspan 的 rotate(ang cx cy)
export function parseRotate(str) {
  const m = /rotate\(\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)\s*\)/.exec(str || '');
  if (!m) return null;
  return { ang: parseFloat(m[1]) * Math.PI / 180, cx: parseFloat(m[2]), cy: parseFloat(m[3]) };
}
export function parseClipRef(str) {
  const m = /url\(\s*#([^)\s]+)\s*\)/.exec(str || '');
  return m ? m[1] : null;
}
