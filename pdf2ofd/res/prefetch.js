// 预取：渐变/图案取色、等待图像解码完成。
import { avgRgba, extractColorStops } from "./color.js";
import { imageToRgba } from "../core/util.js";

export async function prefetchGradients(page, tc, OPS) {
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
// 有些 PDF（比如论文里第 13 页的 Figure 图注区）把图表色块/图例用「一张 80×80 小图作为
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
export function patternImageId(args, OPS) {
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

export async function prefetchPatternColors(page, tc, OPS) {
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

export async function waitImages(page, tc, OPS, imageStore) {
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
