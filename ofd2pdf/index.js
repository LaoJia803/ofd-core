// 公共 API 入口。
import { getCore } from "./core/platform.js";
import { assemblePdf } from "./pdf/writer.js";
import { svgToContentStream } from "./pdf/render.js";
import { parseSvgXml } from "./svg/parse.js";
import { pathToPdf } from "./svg/path.js";
import { parseTransform } from "./svg/transform.js";

/* ------------------------- 公共 API ------------------------- */
// ofdToPdf(ofd, opts) → Promise<Uint8Array>
// opts: { title, author, subject, renderOpts, onProgress }
async function ofdToPdf(ofd, opts) {
  const coreFn = getCore();
  if (!coreFn || typeof coreFn.renderPageToString !== 'function') {
    throw new Error('ofd2pdf.js 需要先加载 ofd.js');
  }
  opts = opts || {};
  const imageReg = new Map();
  const alphaReg = new Map();
  const pages = [];
  const count = coreFn.getPageCount(ofd);
  for (let i = 0; i < count; i++) {
    const svg = await coreFn.renderPageToString(ofd, i, opts.renderOpts);
    const dims = await coreFn.getPageDimensions(ofd, i);
    const ctx = { imageReg, alphaReg, images: new Set(), alphas: new Set(), clips: new Map() };
    const content = await svgToContentStream(svg, dims.width, dims.height, ctx);
    pages.push({
      w: dims.width, h: dims.height, content,
      images: Array.from(ctx.images), alphas: Array.from(ctx.alphas)
    });
    if (opts.onProgress) opts.onProgress(i + 1, count);
  }
  return assemblePdf(pages, imageReg, alphaReg, opts);
}
// svgToPdf(svgString, pageWmm, pageHmm, opts) → Promise<Uint8Array>（单页，便于调试）
async function svgToPdf(svgString, pageWmm, pageHmm, opts) {
  const imageReg = new Map();
  const alphaReg = new Map();
  const ctx = { imageReg, alphaReg, images: new Set(), alphas: new Set(), clips: new Map() };
  const content = await svgToContentStream(svgString, pageWmm, pageHmm, ctx);
  const pages = [{
    w: pageWmm, h: pageHmm, content,
    images: Array.from(ctx.images), alphas: Array.from(ctx.alphas)
  }];
  return assemblePdf(pages, imageReg, alphaReg, opts);
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
