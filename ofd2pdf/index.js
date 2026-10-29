// 公共 API 入口。
import { getCore } from "./core/platform.js";
import { assemblePdf } from "./pdf/writer.js";
import { svgToContentStream } from "./pdf/render.js";
import { parseSvgXml } from "./svg/parse.js";
import { pathToPdf } from "./svg/path.js";
import { parseTransform } from "./svg/transform.js";

/* ------------------------- 公共 API ------------------------- */
// 每页独立的上下文：图元/裁剪/渐变定义都是页面级（id 会重复），
// 而图像、字体、ExtGState、着色对象是全文共享的，靠各自的 Reg 去重。
function pageContext(regs) {
  return {
    imageReg: regs.imageReg, alphaReg: regs.alphaReg,
    shadingReg: regs.shadingReg, fontReg: regs.fontReg
  };
}
function pdfRegs() {
  return { imageReg: new Map(), alphaReg: new Map(), shadingReg: new Map(), fontReg: new Map() };
}
function pageEntry(ctx, dims, content) {
  return {
    w: dims.width, h: dims.height, content,
    images: Array.from(ctx.images), alphas: Array.from(ctx.alphas),
    shadings: Array.from(ctx.shadings), fonts: Array.from(ctx.fonts)
  };
}
// ofdToPdf(ofd, opts) → Promise<Uint8Array>
// opts: { title, author, subject, renderOpts, onProgress }
async function ofdToPdf(ofd, opts) {
  const coreFn = getCore();
  if (!coreFn || typeof coreFn.renderPageToString !== 'function') {
    throw new Error('ofd2pdf.js 需要先加载 ofd.js');
  }
  opts = opts || {};
  const regs = pdfRegs();
  const pages = [];
  const count = coreFn.getPageCount(ofd);
  for (let i = 0; i < count; i++) {
    const svg = await coreFn.renderPageToString(ofd, i, opts.renderOpts);
    const dims = await coreFn.getPageDimensions(ofd, i);
    const ctx = pageContext(regs);
    const content = await svgToContentStream(svg, dims.width, dims.height, ctx);
    pages.push(pageEntry(ctx, dims, content));
    if (opts.onProgress) opts.onProgress(i + 1, count);
  }
  return assemblePdf(pages, regs, opts);
}
// svgToPdf(svgString, pageWmm, pageHmm, opts) → Promise<Uint8Array>（单页，便于调试）
async function svgToPdf(svgString, pageWmm, pageHmm, opts) {
  const regs = pdfRegs();
  const ctx = pageContext(regs);
  const content = await svgToContentStream(svgString, pageWmm, pageHmm, ctx);
  const pages = [pageEntry(ctx, { width: pageWmm, height: pageHmm }, content)];
  return assemblePdf(pages, regs, opts);
}

const TOPDF = {
  ofdToPdf,
  svgToPdf,
  // 非稳定接口，供调试/扩展使用。
  // parseXml 是 parseSvgXml 的旧名，保留为别名以免打断既有脚本，新代码请用 parseSvgXml。
  _internals: {
    svgToContentStream, parseSvgXml, pathToPdf, parseTransform, assemblePdf,
    parseXml: parseSvgXml
  }
};

// 浏览器挂 globalThis.TOPDF，Node 的 module.exports 由 build.js 的 TOPDF_TAIL 桥接。
globalThis.TOPDF = TOPDF;
