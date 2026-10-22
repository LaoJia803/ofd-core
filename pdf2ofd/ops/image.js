// 图像：pdf.js 图像对象 → PNG → ImageObject。
import { encodePng } from "../ofd/png.js";
import { imageToRgba } from "../core/util.js";
import { boxAttr, ctmAttr, geom } from "./geom.js";
import { visible } from "./clip.js";

export function emitImage(st, ctx, page, objId) {
  const { scale, gs, sink } = st;
  const { ctm } = gs;
  const { imageStore, nextId } = ctx;
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
  // 实测某份表单签章类文档的第 1 页落点变成 y −42.9~68.8（跑到页面外，WPS 直接不显示），
  // 而能显示的第 2 页恰好因为 CTM 的 b/c 分量为 0、翻转只影响 d 才没暴露问题。
  //
  // Y 翻转已由 Boundary（px() 里完成的 `Hmm − Y`）承担，这里只保留 PDF 的真实缩放/旋转。
  const L = [ctm[0] * scale, ctm[1] * scale, ctm[2] * scale, ctm[3] * scale];
  // 绝对落点仍按 geom() 算（含翻转），用于可见性剔除与 Boundary
  const g = geom(st, ctm, [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]);
  if (!visible(st, g.box, 'page')) return '';
  return (
    `<ofd:ImageObject ID="${nextId()}" CTM="${ctmAttr(L)}" Boundary="${boxAttr(g.box)}" ` +
    `ResourceID="${store.ofdId}"/>`
  );
}
