// OFD 包组装：PublicRes/DocumentRes、Document/OFD.xml 与 ZIP 写入。
import fs from "node:fs";
import { ensureMacCmap } from "../font/cmap.js";
import { fontNameOf, fontProps } from "../font/naming.js";
import { PT_TO_MM } from "../core/util.js";
import { esc, fmt, nowOfd, randomId } from "./xml.js";
import { ZipWriter } from "./zip.js";

// 字体资源（PublicRes）：对齐数科 —— 用真实字体名，并补 Bold / Italic / FixedWidth，
// 文件名取 font_<ID>_<ID>.<ext>。字形正确性改由 TextObject 的 CGTransform/Glyphs 保证，
// 不依赖系统字体名匹配，因此这里可以放心用真名。
//
// 关键：**非嵌入字体也必须写进 PublicRes**。
// PDF 允许引用未嵌入的标准字体（中文常见 STSong-Light、STHeiti 等 CID 字体，
// 也包括 PDF 文档未内嵌的 Helvetica/Times）。这类字体 pdf.js 拿不到字节
// （commonobj 里 mimetype=null、无 data），此前在下面被 `if (!f) continue` 跳过，
// 结果页面里的 TextObject 全部引用了一个不存在的 Font ID
//（实测某份 1064 个文字对象的样本：PublicRes 里 0 个字体）—— 严格渲染器会拒绝或显示异常。
// 正确做法：声明字体但不给 FontFile，由渲染器按 FontName 回退到系统字体。
function collectFonts(fontResMap, fonts) {
  const fontEntries = [];
  const fontFiles = [];
  for (const [loadedName, fid] of fontResMap) {
    const f = fonts.get(loadedName);
    const base = fontNameOf(f) || loadedName || 'Unknown';
    if (!f || !f.data || !f.data.length) {
      // 无字体字节：只声明，不给 FontFile
      fontEntries.push(
        `<ofd:Font ID="${fid}" FontName="${esc(base)}"${fontProps(base)}/>`,
      );
      continue;
    }
    const ext = f.mimetype === 'font/opentype' || /\.(otf|otto)$/i.test(base) ? 'otf' : 'ttf';
    fontEntries.push(
      `<ofd:Font ID="${fid}" FontName="${esc(base)}"${fontProps(base)}><ofd:FontFile>font_${fid}_${fid}.${ext}</ofd:FontFile></ofd:Font>`,
    );
    fontFiles.push({ name: `Doc_0/Res/font_${fid}_${fid}.${ext}`, data: ensureMacCmap(Buffer.from(f.data)) });
  }
  return { fontEntries, fontFiles };
}

// 图片资源（DocumentRes）
function collectImages(imageStore) {
  const mmEntries = [];
  const resFiles = [];
  for (const [objId, img] of imageStore) {
    if (!img.ofdId) continue;
    mmEntries.push(
      `<ofd:MultiMedia ID="${img.ofdId}" Type="Image" Format="PNG"><ofd:MediaFile>image_${img.ofdId}.png</ofd:MediaFile></ofd:MultiMedia>`,
    );
    resFiles.push({ name: `Doc_0/Res/image_${img.ofdId}.png`, data: img.png });
  }
  return { mmEntries, resFiles };
}

// 组装整个 OFD 并写盘。
export function buildPackage(outPath, opts) {
  const { pageContents, pageSizes, pageWpt, pageHpt, maxUnitId, fontResMap, fonts, imageStore, compositeUnits } = opts;
  // 逐页尺寸（mm）。CommonData/PageArea 只是默认值，每页 Area/PhysicalBox 才最终生效。
  // 旧实现用循环结束时最后一页的尺寸写死全部页，混合尺寸 PDF 除末页外整体错位。
  const fallback = [pageWpt * PT_TO_MM, pageHpt * PT_TO_MM];
  const pages = pageContents.map((_, i) => {
    const s = pageSizes && pageSizes[i];
    return s ? [s[0] * PT_TO_MM, s[1] * PT_TO_MM] : fallback;
  });
  const [Wmm, Hmm] = pages[0] || fallback;
  const { fontEntries, fontFiles } = collectFonts(fontResMap, fonts);
  const { mmEntries, resFiles } = collectImages(imageStore);
  const { date: today, stamp: nowStamp } = nowOfd();
  const zip = new ZipWriter();
  zip.add(
    'OFD.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<ofd:OFD xmlns:ofd="http://www.ofdspec.org/2016" Version="1.1" DocType="OFD"><ofd:DocBody><ofd:DocInfo><ofd:DocID>${randomId()}</ofd:DocID><ofd:CreationDate>${today}</ofd:CreationDate><ofd:ModDate>${nowStamp}</ofd:ModDate><ofd:Creator>ofd-core</ofd:Creator><ofd:CreatorVersion>1.0.0</ofd:CreatorVersion></ofd:DocInfo><ofd:DocRoot>Doc_0/Document.xml</ofd:DocRoot></ofd:DocBody></ofd:OFD>`,
  );
  const pagesXml = [];
  for (let p = 1; p <= pageContents.length; p++) {
    pagesXml.push(
      `<ofd:Page ID="${p}" BaseLoc="Pages/Page_${p - 1}/Content.xml"/>`,
    );
  }
  zip.add(
    'Doc_0/Document.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<ofd:Document xmlns:ofd="http://www.ofdspec.org/2016"><ofd:CommonData><ofd:MaxUnitID>${maxUnitId + 10}</ofd:MaxUnitID><ofd:PageArea><ofd:PhysicalBox>0 0 ${fmt(Wmm)} ${fmt(Hmm)}</ofd:PhysicalBox></ofd:PageArea><ofd:PublicRes>PublicRes.xml</ofd:PublicRes><ofd:DocumentRes>DocumentRes.xml</ofd:DocumentRes></ofd:CommonData><ofd:Pages>${pagesXml.join('')}</ofd:Pages></ofd:Document>`,
  );
  zip.add(
    'Doc_0/PublicRes.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<ofd:Res xmlns:ofd="http://www.ofdspec.org/2016" BaseLoc="Res"><ofd:Fonts>${fontEntries.join('')}</ofd:Fonts></ofd:Res>`,
  );
  zip.add(
    'Doc_0/DocumentRes.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<ofd:Res xmlns:ofd="http://www.ofdspec.org/2016" BaseLoc="Res"><ofd:MultiMedias>${mmEntries.join('')}</ofd:MultiMedias>${compositeUnits.length ? `<ofd:CompositeGraphicUnits>${compositeUnits.join('')}</ofd:CompositeGraphicUnits>` : ''}</ofd:Res>`,
  );

  // 字体文件与图片资源
  for (const ff of fontFiles) zip.add(ff.name, ff.data);
  for (const rf of resFiles) zip.add(rf.name, rf.data);

  for (let i = 0; i < pageContents.length; i++) {
    const [pw, ph] = pages[i] || fallback;
    zip.add(
      `Doc_0/Pages/Page_${i}/Content.xml`,
      `<?xml version="1.0" encoding="UTF-8"?>\n<ofd:Page xmlns:ofd="http://www.ofdspec.org/2016"><ofd:Area><ofd:PhysicalBox>0 0 ${fmt(pw)} ${fmt(ph)}</ofd:PhysicalBox></ofd:Area><ofd:Content><ofd:Layer ID="1">${pageContents[i]}</ofd:Layer></ofd:Content></ofd:Page>`,
    );
  }

  const outBytes = zip.build();
  fs.writeFileSync(outPath, outBytes);
  return outBytes;
}
