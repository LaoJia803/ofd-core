// 文本：文本矩阵推进与 TextObject 输出。
import { matMul } from "../core/util.js";
import { esc, fmt } from "../ofd/xml.js";
import { rgbVal } from "../res/color.js";
import { boxAttr, ctmAttr, px } from "./geom.js";
import { clipXml, visible } from "./clip.js";

// 文本行矩阵推进 ----
//
// 关键：Td/TD/T* 的位移量是**文本空间**单位，必须在 tlm 的**右侧**相乘（后乘）。
// 写成 matMul(trans, tlm)（左乘）会把位移施加到行起点之前，导致逐字 x 累加过快
//（实测某份 3 页表单文档每字 155mm 一步，整行被推出页面，visible() 全部误剔）。
export function advanceLine(st, x, y) {
  const ts = st.ts;
  ts.tlm = matMul(ts.tlm, [1, 0, 0, 1, x, y]);
  ts.tm = ts.tlm.slice();
}

export function nextLine(st) {
  advanceLine(st, 0, -st.gs.leading);
}

export function ensureFont(ctx, loadedName) {
  if (!loadedName) return 0;
  if (ctx.fontResMap.has(loadedName)) return ctx.fontResMap.get(loadedName);
  const id = 100 + ctx.fontResMap.size;
  ctx.fontResMap.set(loadedName, id);
  return id;
}

// ---- 文字输出 ----
// 文字与路径的坐标系处理有一个本质区别：字形天生「从基线向上」绘制，
// 因此 CTM 的线性部分绝不能带 Y 翻转（d 取负会把整个字形倒扣过来），
// Y 翻转全部交给平移分量与 Boundary 吸收 —— 数科产物的文字 CTM d 分量恒为正，原因即在此。
// TextCode 坐标 / DeltaX / Size 统一用「字号空间」：1 单位 = 1/Size em（即 em × fontSize）。
export function emitText(st, ctx, glyphArr) {
  if (!glyphArr || !glyphArr.length) return '';
  const { scale, Hmm, gs, ts } = st;
  const { fonts, fontCmap, nextId } = ctx;
  const { ctm } = gs;
  const { tm, fontName, fontSize } = ts;
  const M = matMul(ctm, tm); // 文本空间(em) → 设备(pt, y-up)
  //
  // 两种 PDF 写法都要支持（这决定 Size 与边界盒怎么算）：
  //  a) 常规 PDF：Tm 是单位阵，setFont 的 size 就是磅值（学术论文类样本，size=9.6）
  //  b) 「字号编进 Tm」：setFont size=209 而 Tm=[0.05,0,0,-0.05,...]
  //     （国产 PDF / WPS 导出常见，表单签章类样本即是）—— 真实磅值 = 209×0.05 = 10.45pt。
  //     若直接用 209，字会放大 20 倍，整页文字溢出页面被 visible() 剔光。
  //
  // OFD 的 Size 属性语义是「磅值」，而 CTM 承担其余缩放，所以这里：
  //   Size = fontSize × tmScale（真实磅值）
  //   M取 tm 的**单位化**版本（把 tmScale 除掉），让 CTM 不再重复缩放字号。
  const tmScale = Math.hypot(tm[0], tm[1]) || 1;
  const sizeTs = (fontSize || 1) * tmScale; // 真实磅值，写进 Size 属性
  const tmUnit = tmScale > 1e-6
    ? [tm[0] / tmScale, tm[1] / tmScale, tm[2] / tmScale, tm[3] / tmScale, tm[4], tm[5]]
    : tm;
  const Mdev = matMul(ctm, tmUnit); // 设备变换：CTM × 单位化文本矩阵

  let text = '';
  const adv = []; // 逐字 Advance（字号空间），与 glyph 对齐
  // 已绘宽度（pt，含 TJ 字距）。无 unicode 的字形也要计入 —— 它们同样占据宽度，
  // 漏算会让后续内容整体左移。
  let drawnWidth = 0;
  //
  // **一个 glyph 只产出一个字符**，codeList / text / adv 三者严格等长。
  //
  // 为什么：pdf.js 的 glyph.unicode 可能是多码点序列（ToUnicode 展开的产物，
  // 例如 `"` 会展开成 `"` + `quot` + `;`）。原实现把整个序列塞进 TextCode 文本，
  // 却每个字形只写一个 Glyphs，于是 3 个字形配 8 个字符：
  //   GlyphCount(3) ≠ CodeCount(8)、DeltaX(2) ≠ 字符数-1
  // 渲染器按 Glyphs 逐位取字形、按 TextCode 逐位取字符，两边错位，
  // 末尾被残留字形/文本补齐 —— 视觉表现就是「图表标签多出 # 等杂符号」
  // （实测第 10 页 39 处、第 13 页 30 处、第 2/11 页若干）。
  //
  // 修法：多码点序列只取**首码点**（它才是该字形真正可见的字符，
  // 且与 fontChar 一致），其余展开码位丢弃。这样
  //   Glyphs.length == CodeCount == text.length == DeltaX.length + 1
  // 恒成立，文本内容也更接近 PDF 视觉内容（`!"quot;#` -> `!"#`）。
  const codeList = [];
  for (const g of glyphArr) {
    if (typeof g === 'number') {
      // TJ 字距：与 glyph.width 同单位（1/1000 em），按规范从当前坐标里减去
      const d = (g / 1000) * sizeTs;
      drawnWidth -= d;
      if (adv.length) adv[adv.length - 1] -= d;
      continue;
    }
    const w = (g.width / 1000) * sizeTs;
    drawnWidth += w;
    const u = g.unicode || '';
    if (!u) continue;
    const firstCp = u.codePointAt(0); // 首码点即该字形的可见字符
    // 取码优先级：fontChar（子集字体的原始真码）> unicode 首码点
    const code = g.fontChar ? g.fontChar.codePointAt(0) : firstCp;
    text += String.fromCodePoint(firstCp);
    codeList.push(code);
    adv.push(w);
  }
  // 文本矩阵推进：pdf.js 的 showText / showSpacedText 只交来字形列表，不更新 Tm，
  // 调用方必须按已绘宽度**后乘**平移。旧实现不推进，同一行连续的 Tj/TJ
  // 全部叠印在同一原点（整行文字糊成一团）。tm 的线性部分含 tmScale，
  // 平移量要先折算回文本空间；这里必须在任何提前 return 之前执行 ——
  // 文字被 visible() 剔掉时矩阵照样要往前走。
  if (tmScale > 1e-9 && drawnWidth)
    ts.tm = matMul(ts.tm, [1, 0, 0, 1, drawnWidth / tmScale, 0]);
  if (!text) return '';

  const fid = ensureFont(ctx, fontName);
  const f = fonts.get(fontName);
  const bold = f && f.bold ? ' Bold="true"' : '';
  const italic = f && f.italic ? ' Italic="true"' : '';

  // 逐字字形索引：直接从嵌入字体的 cmap 反查 glyph id，
  // 让查看器不必依赖码位→Unicode 的映射，子集字体的假码也就不会显示成乱码。
  //
  // 长度关系（必须严格成立）：
  //   Glyphs.length == CodeCount == text.length == DeltaX.length + 1
  // 一个 glyph 只产出一个字符（见下方累积循环），多码点序列只取首码点，
  // 因此三者天然等长，不会出现「3 个字形配 8 个字符」导致的渲染错位。
  //
  // glyph 0（.notdef）绝不能写进产物 —— 严格渲染器会画成方框/杂符号。
  //
  // 查不到真字形时**退回 gid 1**，与数科基准一致（实测数科第 10 页
  // `&-./012#3%4%56#` 的 Glyphs 为 41,7,33,6,26,5,8,1,34,40,32,40,29,35,1，
  // `#` 处正是 gid 1，且 CodeCount == Glyphs.length == 15）。
  //
  // 背景：这些字符（如 `#`）在 PDF 里的 isInFont=false —— 原 PDF 本身就没有该字形，
  // Acrobat/WPS 打开原 PDF 同样画不出，pdf.js 也只能给替代字形。
  // 因此这里不是转换缺陷，而是与基准、与原始 PDF 保持一致的正常行为。
  const cmap = fontCmap && fontCmap.get(fontName);
  let cg = '';
  if (cmap && cmap.size && codeList.length === text.length) {
    const gids = [];
    for (const code of codeList) {
      const gid = cmap.get(code);
      gids.push(gid ? gid : 1); // 0/.notdef 不可用，退回 1（对齐数科基准）
    }
    cg =
      `<ofd:CGTransform CodePosition="0" CodeCount="${gids.length}" GlyphCount="${gids.length}">` +
      `<ofd:Glyphs>${gids.join(' ')}</ofd:Glyphs></ofd:CGTransform>`;
  }

  // 字形包围盒：单位是**字号空间**（1 单位 = 1/Size em），与 TextCode / DeltaX 同单位，
  // 渲染器按 Size 属性换算成实际磅值。
  //
  // Mdev 已把 tm 的缩放剥离（字号交给 Size 属性），所以这里用 sizeTs（磅值）
  // 直接乘，与基准样本的原有行为完全一致，不引入回归。
  const emAsc = f && isFinite(f.ascent) ? f.ascent : 0.88;
  const emDesc = f && isFinite(f.descent) ? f.descent : -0.22;
  let total = 0;
  for (const a of adv) total += Math.max(0, a); // adv 已是字号空间
  const totalW = Math.max(total, 0.01);
  const asc = emAsc * sizeTs;
  const desc = emDesc * sizeTs;

  const L = [Mdev[0] * scale, Mdev[1] * scale, Mdev[2] * scale, Mdev[3] * scale]; // 不取负，见函数头注释
  const T = [Mdev[4] * scale, Hmm - Mdev[5] * scale]; // Y 翻转在这里完成
  let dminX = Infinity,
    dmaxX = -Infinity,
    dminY = Infinity,
    dmaxY = -Infinity;
  for (const p of [[0, 0], [totalW, 0], [0, asc], [totalW, asc], [0, desc], [totalW, desc]]) {
    const X = Mdev[0] * p[0] + Mdev[2] * p[1] + Mdev[4];
    const Y = Mdev[1] * p[0] + Mdev[3] * p[1] + Mdev[5];
    if (X < dminX) dminX = X;
    if (X > dmaxX) dmaxX = X;
    if (Y < dminY) dminY = Y;
    if (Y > dmaxY) dmaxY = Y;
  }
  const [bx, by] = px(st, dminX, dmaxY);
  const box = [bx, by, (dmaxX - dminX) * scale, (dmaxY - dminY) * scale];
  // 渲染器算的是 B0 + L·(p + d)，令其等于 L·p + T ⇒ L·d = T − B0
  let ox = 0,
    oy = 0;
  const det = L[0] * L[3] - L[1] * L[2];
  if (Math.abs(det) > 1e-9) {
    const rx = T[0] - bx,
      ry = T[1] - by;
    ox = (L[3] * rx - L[2] * ry) / det;
    oy = (L[0] * ry - L[1] * rx) / det;
  }

  if (!visible(st, box, 'page')) return '';

  // DeltaX 只给「除末字外」的逐字 advance：Glyphs 数组比 DeltaX 多一项（末位真实字形），
  // 末字宽度由渲染器自行推进。写满 N 项会让末尾多出一段空白推进。
  const dx = adv.slice(0, -1).map((a) => fmt(a)).join(' ');
  return (
    `<ofd:TextObject ID="${nextId()}" CTM="${ctmAttr(L)}" Boundary="${boxAttr(box)}" ` +
    `Font="${fid}" Size="${fmt(sizeTs)}"${bold}${italic}>` +
    `<ofd:FillColor Value="${rgbVal(gs.fillColor)}"/>${clipXml()}${cg}` +
    `<ofd:TextCode X="${fmt(ox)}" Y="${fmt(oy)}"${dx ? ` DeltaX="${dx}"` : ''}>${esc(text)}</ofd:TextCode>` +
    `</ofd:TextObject>`
  );
}
