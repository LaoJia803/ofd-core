// 图像注册：解码 → RGBA → Flate 压缩 → PDF 图像 XObject（同图去重）。
import { nodeZlib } from "../core/platform.js";
import { base64ToBytes } from "../core/util.js";
import { decodeBmp } from "./bmp.js";
import { canvasImageToRgba } from "./canvas.js";
import { deflate } from "./deflate.js";
import { decodeGif } from "./gif.js";
import { parseJpegDims } from "./jpeg.js";
import { decodePng } from "./png.js";

// 图像解码的统一尺寸上限。文件头里的 w/h 由文件自行声明、可被伪造，
// 不设上限时极小的文件就能触发巨额内存分配（1 亿像素 ≈ 400MB RGBA）。
export const MAX_IMAGE_PIXELS = 100 * 1000 * 1000;
export function checkImageSize(w, h) {
  if (!(w > 0) || !(h > 0)) throw new Error('无效图像尺寸：' + w + '×' + h);
  if (w * h > MAX_IMAGE_PIXELS) {
    throw new Error('图像尺寸过大（' + w + '×' + h + '），已跳过解码以防内存耗尽');
  }
}

// 浏览器交给 canvas 解码（简单可靠），Node 回退纯 JS 解码器；两者都产出 RGBA
// decode 签名 (bytes, zlib) → { rgba, w, h }，zlib 仅供 PNG 解压，BMP/GIF 忽略
async function decodeToXObject(bytes, mime, decode) {
  if (typeof document !== 'undefined' && document.createElement) {
    return rgbaToXObject(await canvasImageToRgba(bytes, mime));
  }
  const zlib = nodeZlib();
  if (!zlib) throw new Error('Node 环境缺少 zlib，无法压缩图像数据');
  return rgbaToXObject(decode(bytes, zlib), zlib);
}
// RGBA 像素 → 颜色数据 + 可选 SMask 数据（全不透明时不生成 SMask）；单遍扫描同时产出两份数据
async function rgbaToXObject(p, zlib) {
  const w = p.w, h = p.h, rgba = p.rgba;
  const n = w * h;
  const color = new Uint8Array(n * 3);
  const alpha = new Uint8Array(n);
  let o = 0, a = 0, hasAlpha = false;
  for (let i = 0; i < rgba.length; i += 4) {
    color[o] = rgba[i]; color[o + 1] = rgba[i + 1]; color[o + 2] = rgba[i + 2]; o += 3;
    alpha[a++] = rgba[i + 3];
    if (rgba[i + 3] < 255) hasAlpha = true;
  }
  const data = await deflate(color, zlib);
  let smask = null;
  if (hasAlpha) smask = { data: await deflate(alpha, zlib), filter: 'FlateDecode' };
  return { w, h, data, filter: 'FlateDecode', smask };
}
// dataUrl → 注册图像 XObject（同图去重），返回资源名（如 Im0）；失败返回 null
export async function addImage(dataUrl, ctx) {
  if (ctx.imageReg.has(dataUrl)) {
    const im = ctx.imageReg.get(dataUrl);
    ctx.images.add(im.name);
    return im.name;
  }
  const m = /^data:([^;,]+)(;[^,]*)?,(.*)$/.exec(dataUrl);
  const mime = m ? m[1] : '';
  const isB64 = !!(m && m[2] && /;base64/i.test(m[2]));
  const body = m ? m[3] : '';
  let bytes;
  try {
    bytes = isB64 ? base64ToBytes(body) : new TextEncoder().encode(decodeURIComponent(body));
  } catch (e) {
    console.warn('[TOPDF] 图像数据解析失败，已跳过');
    return null;
  }
  let im;
  try {
    if (/jpe?g$/i.test(mime)) {
      const d = parseJpegDims(bytes);
      im = { w: d.w, h: d.h, data: bytes, filter: 'DCTDecode' };
    } else if (/png$/i.test(mime)) {
      im = await decodeToXObject(bytes, 'image/png', decodePng);
    } else if (/bmp$/i.test(mime)) {
      im = await decodeToXObject(bytes, 'image/bmp', decodeBmp);
    } else if (/gif$/i.test(mime)) {
      im = await decodeToXObject(bytes, 'image/gif', decodeGif);
    } else {
      console.warn('[TOPDF] 不支持的图像格式: ' + mime);
      return null;
    }
  } catch (e) {
    console.warn('[TOPDF] 图像嵌入失败已跳过: ' + e.message);
    return null;
  }
  im.name = 'Im' + ctx.imageReg.size;
  ctx.imageReg.set(dataUrl, im);
  ctx.images.add(im.name);
  return im.name;
}
