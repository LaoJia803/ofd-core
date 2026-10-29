// 公共 API 入口：convert() 编排 + 导出。CLI 由 build/build-pdf2ofd.js 的 PDF2OFD_TAIL 附加。
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { buildFontCmap } from "./font/cmap.js";
import { parseCompiledFont } from "./font/sfnt.js";
import { cmapsUrl, pdfjsEntry, stdFontsUrl } from "./core/pdfjs.js";
import { encodePng } from "./ofd/png.js";
import { prefetchGradients, prefetchPatternColors, waitImages } from "./res/prefetch.js";
import { PT_TO_MM } from "./core/util.js";
import { walkOperators } from "./ops/walk.js";
import { ZipWriter } from "./ofd/zip.js";
import { buildPackage } from "./ofd/package.js";

// QUIET=true 时不打印进度与完成信息（供脚本调用时静默转换）
let QUIET = false;

// options: { onProgress(processed, total), quiet } —— quiet 为 true 时不打印进度
async function convert(pdfPath, ofdPath, options) {
  const onProgress = (options && options.onProgress) || null;
  const quiet = options && options.quiet != null ? options.quiet : QUIET;
  const pdfjs = await import(pathToFileURL(pdfjsEntry()).href);
  const OPS = pdfjs.OPS;
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({
    data,
    disableFontFace: false, // 关键：保留字体字节
    isEvalSupported: false,
    // 中文/日文等 CID 字体会报「Ensure that the `cMapUrl` API parameter is provided.」，
    // 字体加载随之失败 → 字体表为空 → 整页文字被丢弃（实测中日文混排样本：文字 0、字体 0）。
    // 注意：pdf.js 要求以「正斜杠」结尾，Windows 的 path.sep 是反斜杠，必须手工拼 '/'。
    cMapUrl: cmapsUrl(),
    cMapPacked: true,
    standardFontDataUrl: stdFontsUrl(),
    // 非嵌入的标准字体（Helvetica 等 14 种）需要度量信息做宽度计算
    useSystemFonts: true,
    fontExtraProperties: true,
  }).promise;

  // ---- 从 worker 消息层拦截字体字节（compileFontInfo 编译后的 buffer） ----
  const fonts = new Map(); // loadedName -> {name, mimetype, data(Uint8Array), ascent, descent}
  const fontCmap = new Map(); // loadedName -> Map<字符码, 字形索引>
  const comObj = doc._transport.messageHandler.comObj;
  comObj.addEventListener(
    'message',
    (e) => {
      const m = e.data;
      if (m && m.action === 'commonobj' && m.data && m.data[1] === 'Font') {
        const [id, , payload] = m.data;
        const info = parseCompiledFont(payload.buffer);
        // 元信息无条件登记，字节只在真有时才存。
        // 非嵌入字体（中文 CID 常见）没有 data，但页面上照样有 TextObject 引用它 ——
        // 若连元信息一起跳过，PublicRes 里就没有这个字体，TextObject 的 Font 引用悬空。
        fonts.set(id, {
          name: info && info.name,
          loadedName: info && info.loadedName,
          fallbackName: info && info.fallbackName,
          mimetype: info && info.mimetype,
          data: info && info.data,
          ascent: info && info.ascent,
          descent: info && info.descent,
        });
        if (info && info.data && info.data.length) {
          const raw = Buffer.from(info.data);
          fontCmap.set(id, buildFontCmap(raw));
        }
      }
    },
    true,
  );

  const pageContents = [];
  const pageSizes = []; // 逐页 [w, h]（pt）：混合页尺寸文档不能共用一个值
  const imageStore = new Map(); // objId -> {png, w, h}
  const fontResMap = new Map(); // loadedName -> ofdFontId
  const compositeUnits = []; // Form XObject → CompositeGraphicUnit XML
  let maxUnitId = 1000;
  let pageWpt = 612,
    pageHpt = 792;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    pageWpt = vp.width;
    pageHpt = vp.height;
    pageSizes.push([vp.width, vp.height]);
    const tc = await page.getOperatorList();
    // 等待图像对象异步解码
    await waitImages(page, tc, OPS, imageStore);
    // 渐变 pattern 同样必须**预先 await 解析** —— 运行期 objs.get() 只能拿到未解析的
    // Promise，取不到色标就会退回灰色兜底（表现为图表颜色整片消失）
    const gradShades = await prefetchGradients(page, tc, OPS);
    const patternColors = await prefetchPatternColors(page, tc, OPS);
    const body = walkOperators(tc, OPS, page, {
      pageWpt,
      pageHpt,
      fonts,
      fontResMap,
      imageStore,
      compositeUnits,
      fontCmap,
      gradShades,
      patternColors,
      nextId: () => ++maxUnitId,
    });
    pageContents.push(body);
    if (onProgress) onProgress(p, doc.numPages);
    if (!quiet) console.error(`  已处理 ${p}/${doc.numPages} 页`);
  }

  // ---- 组装 OFD ----
  const outBytes = buildPackage(ofdPath, {
    pageContents,
    pageSizes,
    pageWpt,
    pageHpt,
    maxUnitId,
    fontResMap,
    fonts,
    imageStore,
    compositeUnits,
  });
  const stats = { pages: doc.numPages, fonts: fonts.size, images: imageStore.size, bytes: outBytes.length };
  if (!quiet)
    console.error(`完成：${ofdPath}（${stats.pages} 页，${stats.fonts} 字体，${stats.images} 图像，${stats.bytes} 字节）`);
  return stats;
}

export { convert, ZipWriter, encodePng, PT_TO_MM };
