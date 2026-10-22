// 字体命名与属性推断。
export function fontNameOf(f) {
  // f 可能为 undefined —— 非嵌入字体没有字节，页面上仍有 TextObject 引用它
  if (!f) return '';
  const raw = f.name || f.loadedName || f.fallbackName || 'Font';
  return String(raw).replace(/^[A-Z]{6}\+/, '');
}

// 从字体名推断字形特征（对齐数科输出的 Bold / Italic / FixedWidth）
export function fontProps(n) {
  let s = '';
  if (/bold|black|heavy|semibold|demibold|medi$/i.test(n)) s += ' Bold="true"';
  if (/italic|oblique|slant/i.test(n)) s += ' Italic="true"';
  if (/mono|courier|cmtt|fixed/i.test(n)) s += ' FixedWidth="true"';
  return s;
}

// 解析 pdf.js 编译后的字体 buffer（布局见 pdf.worker FONT_INFO）
