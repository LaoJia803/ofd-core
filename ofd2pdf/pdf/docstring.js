// PDF 字符串与文档信息字典。
/* ------------------------- 文本编码 ------------------------- */
// 单个码点 → UTF-16BE 十六进制（UniGB-UCS2-H 的 Tj 字符串）
export function utf16beHex(ch) {
  let code = ch.codePointAt(0);
  if (code > 0xFFFF) {
    code -= 0x10000;
    const hi = 0xD800 + (code >> 10);
    const lo = 0xDC00 + (code & 0x3FF);
    return hi.toString(16).padStart(4, '0') + lo.toString(16).padStart(4, '0');
  }
  return code.toString(16).padStart(4, '0');
}

/* ------------------------- PDF 组装 ------------------------- */
// PDF 文本字符串：纯 ASCII 用 literal，含非 ASCII 转 UTF-16BE+BOM 的 hex（避免阅读器乱码）
export function pdfTextString(s) {
  s = String(s);
  if (/^[\x20-\x7E]*$/.test(s)) {
    return '(' + s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + ')';
  }
  let hex = 'FEFF';
  for (let i = 0; i < s.length; i++) {
    let cp = s.codePointAt(i);
    if (cp > 0xFFFF) {
      const v = cp - 0x10000;
      cp = ((v >> 10) + 0xD800) << 16 | (((v & 0x3FF) + 0xDC00) & 0xFFFF);
      hex += (cp >>> 16).toString(16).padStart(4, '0');
      i++;
    }
    hex += cp.toString(16).padStart(4, '0');
  }
  return '<' + hex + '>';
}
export function buildInfo(opts) {
  const info = {
    Producer: 'OFD-Viewer ofd2pdf.js',
    Creator: 'OFD-Viewer',
    // PDF 标准日期格式：D:YYYYMMDDHHmmSS+hh'mm'（去 ISO 的 T 与毫秒）
    CreationDate: 'D:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z/, 'Z').replace('T', '')
  };
  if (opts.title) info.Title = opts.title;
  if (opts.author) info.Author = opts.author;
  if (opts.subject) info.Subject = opts.subject;
  return '<< ' + Object.keys(info).map(k => '/' + k + ' ' + pdfTextString(info[k])).join('\n') + ' >>';
}
