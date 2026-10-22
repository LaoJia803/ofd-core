// PDF 操作符遍历：按 OPS 名分发到状态机与各图元输出模块。
import { matMul } from "../core/util.js";
import { hexToRgb } from "../res/color.js";
import { patternImageId } from "../res/prefetch.js";
import { createState, emit, restoreState, saveState } from "./state.js";
import { advanceLine, emitText } from "./text.js";
import { emitPath } from "./path.js";
import { emitImage } from "./image.js";
import { emitShading } from "./shading.js";

export function walkOperators(tc, OPS, page, ctx) {
  const st = createState(ctx.pageWpt, ctx.pageHpt);
  const { gs, ts, sink } = st;

  const rev = walkOperators._rev || (walkOperators._rev = (() => {
    const r = {};
    for (const k of Object.keys(OPS)) r[OPS[k]] = k;
    return r;
  })());

  // form 的 BBox：pdf.js 的 paintFormXObjectBegin 两个参数分别是 matrix 与 BBox 数组
  // [x0,y0,x1,y1]（第 6 页两个 Form 分别是 [0,0,257,366] 与 [0,0,359,402]）。
  function enterForm(args) {
    saveState(st);
    const m = args[0] || [1, 0, 0, 1, 0, 0];
    gs.ctm = matMul(gs.ctm, m);
    // Form 内部常含「远大于自身」的背景块（如 1152×2199 的整页白底），
    // 按 PDF 语义它被限制在 Form 的 BBox 内。只把 BBox 登记进 clipBoxes，
    // 供 visible() 剔除与 isOversizedRect() 丢弃使用，**不输出 <ofd:Clip>**
    // （页面层发 Clips 会让 WPS 把内容整块裁没，见 clipXml 上方注释）。
    const fb = args[1];
    if (fb && fb.length >= 4 && fb[2] > fb[0] + 1 && fb[3] > fb[1] + 1) {
      const cs = [];
      for (const c of [[fb[0], fb[1]], [fb[2], fb[1]], [fb[2], fb[3]], [fb[0], fb[3]]]) {
        const dm = matMul(gs.ctm, [1, 0, 0, 1, c[0], c[1]]);
        cs.push([dm[4] * st.scale, st.Hmm - dm[5] * st.scale]);
      }
      const xs = cs.map((p) => p[0]),
        ys = cs.map((p) => p[1]);
      const bx = Math.min(...xs),
        by = Math.min(...ys);
      sink.clipBoxes.push([bx, by, Math.max(...xs) - bx, Math.max(...ys) - by]);
    }
  }

  for (let i = 0; i < tc.fnArray.length; i++) {
    const name = rev[tc.fnArray[i]];
    const args = tc.argsArray[i];
    switch (name) {
      case 'save':
        saveState(st);
        break;
      case 'restore':
        restoreState(st);
        break;
      case 'transform':
        gs.ctm = matMul(gs.ctm, args);
        break;
      case 'setFillRGBColor':
        gs.fillColor = hexToRgb(args[0]);
        break;
      case 'setStrokeRGBColor':
        gs.strokeColor = hexToRgb(args[0]);
        break;
      case 'setFillGray':
        gs.fillColor = { r: args[0], g: args[0], b: args[0] };
        break;
      case 'setStrokeGray':
        gs.strokeColor = { r: args[0], g: args[0], b: args[0] };
        break;
      case 'setFillColorN':
      case 'setStrokeColorN': {
        // TilingPattern 填充：用预取好的图案平均色替换当前色。
        // 其它色彩空间（Indexed/CMYK/Lab）暂不支持 → 保持上一个颜色，至少不塌成黑。
        const id = patternImageId(args, OPS);
        const c = id && ctx.patternColors && ctx.patternColors.get(id);
        if (c) {
          if (name === 'setFillColorN') gs.fillColor = c;
          else gs.strokeColor = c;
        }
        break;
      }
      case 'setLineWidth':
        gs.lineWidth = args[0];
        break;
      case 'setLineCap':
        gs.lineCap = args[0];
        break;
      case 'setLineJoin':
        gs.lineJoin = args[0];
        break;
      case 'setDash':
        // 记录虚线数组，输出为 PathObject 的 DashPattern 属性
        gs.dashArray = args[0] && args[0].length ? Array.from(args[0]) : null;
        gs.dashPhase = args[1] || 0;
        break;
      // ---- 文本 ----
      case 'beginText':
        ts.tm = ts.tlm = [1, 0, 0, 1, 0, 0];
        break;
      case 'endText':
        break;
      case 'setFont':
        ts.fontName = args[0];
        ts.fontSize = args[1];
        break;
      case 'setLeading':
        gs.leading = args[0];
        break;
      case 'moveText':
        advanceLine(st, args[0], args[1]);
        break;
      case 'setLeadingMoveText':
        // pdf.js 源码（legacy/build/pdf.mjs ~18275）：
        //   setLeadingMoveText(opIdx, x, y) { setLeading(-y); moveText(x, y); }
        // 参数只有 **两个** [x, y]。旧代码读 args[2]/args[3] 越界 → 平移量 undefined
        //   → tm 变 NaN → 包围盒 NaN → visible() 误剔（1239 个文字只剩 39 个）。
        gs.leading = -args[1];
        advanceLine(st, args[0], args[1]);
        break;
      case 'nextLine':
        advanceLine(st, 0, -gs.leading);
        break;
      case 'setTextMatrix': {
        // pdf.js 的 addOp(fn, [Float32Array]) 把参数包一层：args = [Float32Array(6)]
        // 关键坑：`args[0]` 是 **TypedArray**，不是普通 Array ——
        // `Array.isArray(args[0])` 恒为 false，只能用 length 或 ArrayBuffer 判别。
        // 旧写法判断不了嵌套，把整个外层数组赋给 tm，平移分量取到 undefined，
        // 包围盒算成 NaN，visible() 把 1239 个文字对象里的 1200 个误剔
        //（实测某份 3 页表单文档只剩 39 个文字，中文几乎全丢）。
        let m = args;
        if (m && m.length === 1 && m[0] && typeof m[0].length === 'number' && m[0].length >= 6)
          m = Array.from(m[0]); // TypedArray → 普通数组，避免下游按数组方法取值踩空
        if (!m || m.length < 6) m = [1, 0, 0, 1, 0, 0]; // 结构异常时退化为单位阵
        ts.tm = ts.tlm = m;
        break;
      }
      case 'showText':
      case 'showSpacedText':
        emit(st, emitText(st, ctx, args[0]));
        break;
      case 'nextLineShowText':
        ts.tlm = matMul([1, 0, 0, 1, 0, -gs.leading], ts.tlm);
        ts.tm = ts.tlm.slice();
        emit(st, emitText(st, ctx, args[0]));
        break;
      case 'nextLineSetSpacingShowText':
        // args = [wordSpacing, charSpacing, glyphs]
        ts.tlm = matMul([1, 0, 0, 1, 0, -gs.leading], ts.tlm);
        ts.tm = ts.tlm.slice();
        emit(st, emitText(st, ctx, args[2]));
        break;
      // ---- 矢量 ----
      case 'constructPath':
        emit(st, emitPath(st, ctx, rev, args));
        break;
      case 'clip':
        // 只置位；裁剪区由紧随其后的 constructPath 建立（见 pendingClipMode 注释）
        sink.pendingClipMode = 1;
        break;
      case 'eoClip':
        sink.pendingClipMode = 2;
        break;
      case 'shadingFill':
        emitShading(st, ctx, args);
        break;
      // ---- 图像 ----
      case 'paintImageXObject':
        emit(st, emitImage(st, ctx, page, args[0]));
        break;
      // ---- Form XObject ----
      case 'paintFormXObjectBegin': {
        // Form XObject 语义等价于 save + concat(matrix) ... restore。
        // 与数科一致：内容内联展开为页面级图元 —— 数科产物里页面 Content.xml 直接包含数百个
        // PathObject/ImageObject，CompositeObject 只用于个别分组；若把 Form 收进
        // CompositeGraphicUnit，引擎不识别该元素时整个图表就消失了。
        enterForm(args);
        break;
      }
      case 'paintFormXObjectEnd':
        restoreState(st);
        break;
      // 忽略：setGState / setRenderingIntent / setFlatness / dependency / beginAnnotation 等
    }
  }
  return sink.out.join('');
}
