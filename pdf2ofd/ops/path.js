// 路径：pdf.js 路径缓冲 → AbbreviatedData / PathObject，并登记裁剪区与待填充路径。
import { matMul } from "../core/util.js";
import { fmt } from "../ofd/xml.js";
import { capJoinName, rgbVal } from "../res/color.js";
import { absorbScale, boxAttr, ctmAttr, geom, px, splitCtm } from "./geom.js";
import { clipXml, isOversizedRect, visible } from "./clip.js";

// ---- 矢量输出 ----
export function emitPath(st, ctx, rev, args) {
  const paintOp = rev[args[0]] || args[0];
  const buf = args[1] && args[1][0];
  if (!buf || !buf.length) return '';
  const { gs, sink } = st;
  const { ctm, lineWidth, lineCap, lineJoin, dashArray, fillColor, strokeColor } = gs;
  const { nextId } = ctx;

  // pdf.js 路径缓冲命令码（pdfjs-dist 5.7 实测）：
  //   0=moveTo(2)  1=lineTo(2)  2=curveTo(6)  3=rectangle(4: x y w h)  4=closePath(0)
  // 该映射经全文档 997 条路径遍历校验：只有 {3→4 参数, 4→0 参数} 能恰好耗尽每个 buffer。
  // 多数 `re` 已被 pdf.js 展开成 moveTo/lineTo/close，但若遇到 3 必须按矩形处理，
  // 否则会把 (x,y,w,h) 当成二次贝塞尔的控制点，画出完全变形的图形。
  const cmds = [];
  let k = 0;
  while (k < buf.length) {
    const op = buf[k++];
    if (op === 0) cmds.push({ op: 'M', pts: [[buf[k++], buf[k++]]] });
    else if (op === 1) cmds.push({ op: 'L', pts: [[buf[k++], buf[k++]]] });
    else if (op === 2)
      cmds.push({
        op: 'B',
        pts: [
          [buf[k++], buf[k++]],
          [buf[k++], buf[k++]],
          [buf[k++], buf[k++]],
        ],
      });
    else if (op === 3) {
      const rx = buf[k++],
        ry = buf[k++],
        rw = buf[k++],
        rh = buf[k++];
      cmds.push({ op: 'M', pts: [[rx, ry]] });
      cmds.push({ op: 'L', pts: [[rx + rw, ry]] });
      cmds.push({ op: 'L', pts: [[rx + rw, ry + rh]] });
      cmds.push({ op: 'L', pts: [[rx, ry + rh]] });
      cmds.push({ op: 'C', pts: [] });
    } else if (op === 4) cmds.push({ op: 'C', pts: [] });
    else break; // 未知命令：停止，避免后续数据整体错位
  }
  if (!cmds.length) return '';

  const all = [];
  for (const c of cmds) for (const p of c.pts) all.push(p);
  if (!all.length) return '';

  // CTM 缩放过小时把缩放吸进坐标（见 absorbScale 注释），
  // 否则 7.6e-5 这类缩放会被 fmt 的 4 位小数抹成 0，整条路径塌缩消失。
  // 注意 geom 要收**缩放后**的点：它算出的 Boundary/dx/dy 都属于新坐标空间。
  const [effCtm, kScale] = absorbScale(ctm, splitCtm(st, ctm).L);
  const g = geom(st, effCtm, kScale === 1 ? all : all.map((p) => [p[0] * kScale, p[1] * kScale]));
  // 序列化命令流。conv 决定坐标落在哪个坐标系：
  //   绘制用图元 → 归一化偏移（保留 PDF 原值，靠 CTM 换算）
  //   裁剪区/渐变区 → 绝对页面 mm（这些 Path 不带 CTM，只能用绝对坐标）
  function serialize(conv) {
    let s = '';
    for (const c of cmds) {
      if (c.op === 'C') {
        s += 'C ';
        continue;
      }
      s += c.op;
      for (const p of c.pts) {
        const q = conv(p[0], p[1]);
        s += ` ${fmt(q[0])} ${fmt(q[1])}`;
      }
      s += ' ';
    }
    return s.trim();
  }
  const d = serialize((x, y) => [x * kScale + g.dx, y * kScale + g.dy]);
  if (!d) return '';

  if (paintOp === 'endPath') {
    // 路径已定义但暂不绘制 —— 留给随后的 shadingFill 取用。
    //
    // 若前面有 clip / eoClip 置位，这条路径**既是**裁剪区**又是**（可能的）填充区：
    // PDF 里 `W n` 之后紧跟 `sh f` 是常见写法（先裁剪、再用同一形状填渐变），
    // pdf.js 也是先 clip 再对同一路径填色。所以这里只登记裁剪区，
    // **不能清掉 pendingPath** —— 否则紧随其后的 shadingFill 会因拿不到区域而静默丢弃，
    // 表现为整片渐变柱凭空消失（第 11 页 81 处AxialShd 全丢）。
    if (sink.pendingClipMode) {
      sink.clipBoxes.push(g.box);
      sink.pendingClipMode = 0;
    }
    const abs = serialize((x, y) => {
      const dm = matMul(effCtm, [1, 0, 0, 1, x * kScale, y * kScale]);
      return px(st, dm[4], dm[5]);
    });
    sink.pendingPath = { d: abs, bounds: g.box };
    return '';
  }

  // pdf.js 的 paintOp 是驼峰命名：fill / eoFill / stroke / fillStroke / eoFillStroke /
  // closeStroke / closeFillStroke / closeEOFillStroke。旧实现用小写 'stroke' 匹配，
  // 而 'fillStroke'/'closeStroke' 里是大写 S，被判成「只填充不描边」——
  // 表格框线、下划线、连线整片消失。统一忽略大小写判定。
  const opName = String(paintOp);
  const fill = /fill/i.test(opName);
  const stroke = /stroke/i.test(opName);
  const evenOdd = /eoFill/i.test(opName);

  // 描边线（表格框线/分隔线/下划线）豁免裁剪区，只有纯填充块按裁剪区剔。
  // 见visible() 上方注释：框线常横跨多个单元格裁剪区，按裁剪区剔会只剩零星几段。
  if (!visible(st, g.box, stroke ? 'page' : 'clip')) return '';

  // Form 画布底色类的巨大纯色矩形直接丢弃（见 isOversizedRect 注释）。
  // 不能「收敛成可见区域大小」—— 那会在正文之后留下一小块底色板照样盖住图注。
  if (fill && !stroke && isOversizedRect(st, d, g.box)) return '';

  const dOut = d;
  const boxOut = g.box;

  let s = `<ofd:PathObject ID="${nextId()}" CTM="${ctmAttr(g.L)}" Boundary="${boxAttr(boxOut)}"`;
  s += ` Fill="${fill}" Stroke="${stroke}"`;
  if (evenOdd) s += ' Rule="Even-Odd"';
  // 线宽：OFD 的 LineWidth 与 AbbreviatedData 同处一个坐标空间（会被 CTM 再缩放），
  // 因此必须写该空间下的值 —— PDF 用户空间原值（如 1/2/3/5），**不能**预先乘 CTM。
  // 旧实现乘了 CTM 的 mm 缩放系数，等于把线宽缩小了近 3 倍（0.3528 因子 × 图表内
  // 0.35~0.47 的 CTM），所有线都细成同一条 —— 正是「连线有些粗有些细、现在一样细」
  // 的根因。数科产物实测：第 6/7 页 LineWidth 为 1/2/3/5/8，与 PDF setLineWidth 一致。
  //
  // 但坐标被 absorbScale 乘过 k 时，同一空间的线宽也要跟着乘 k
  // （否则第 11 页 9525 会变成 9525×0.3528 的巨粗线；数科该页是 0.75）。
  const lw = Math.max(Math.abs(lineWidth) * kScale, 0.02);
  s += ` LineWidth="${fmt(lw)}"`;
  if (lineCap) s += ` Cap="${capJoinName(lineCap, 'Cap')}"`;
  if (lineJoin) s += ` Join="${capJoinName(lineJoin, 'Join')}"`;
  // 虚线：OFD 规范里 DashPattern 是 PathObject 的**属性**（不是子元素），
  // 值为「实线段 长 空格段 长 …」，与 AbbreviatedData 同坐标空间，故写 PDF 原值。
  // 漏掉它，第 2 页那些 4 4 虚线椭圆就会全部退化成实线边框。
  if (dashArray && dashArray.length && (dashArray.some((v) => v > 0) || dashArray.length % 2 === 0))
    s += ` DashPattern="${dashArray.map((v) => fmt(Math.abs(v) * kScale)).join(' ')}"`;
  s += '>';
  if (fill) s += `<ofd:FillColor Value="${rgbVal(fillColor)}"/>`;
  if (stroke) s += `<ofd:StrokeColor Value="${rgbVal(strokeColor)}"/>`;
  s += clipXml();
  s += `<ofd:AbbreviatedData>${dOut}</ofd:AbbreviatedData>`;
  s += '</ofd:PathObject>';
  return s;
}
