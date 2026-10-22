// pdf.js 资源定位（动态 import，保持 peerDependency 语义）。
import path from "node:path";

export function pdfjsResUrl(dir) {
  let base;
  try {
    base = path.dirname(require.resolve('pdfjs-dist/package.json'));
  } catch (e) {
    // 兜底：源码树布局 <repo>/build/../node_modules/pdfjs-dist
    base = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist');
  }
  return path.join(base, dir).replace(/\\/g, '/') + '/';
}
// pdf.js 主模块同样是 ESM（.mjs），必须用动态 import；
// 路径同样用 require.resolve 解析，避免依赖调用方的目录层级。
export function pdfjsEntry() {
  try {
    return require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
  } catch (e) {
    return path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs');
  }
}
export const cmapsUrl = () => pdfjsResUrl('cmaps');
export const stdFontsUrl = () => pdfjsResUrl('standard_fonts');
