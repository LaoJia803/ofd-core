// OFD 的 ZIP 条目是 raw deflate，引擎用 DecompressionStream('deflate-raw') 解压。
// Node 20 有这个 API 但不认 'deflate-raw'（要到 v22），所以测试脚本统一 require 本文件补上。
// 引擎源码不改：浏览器里原生就支持。
const zlib = require('zlib');

module.exports = function installDeflateRawShim() {
  try {
    new DecompressionStream('deflate-raw');
    return false;
  } catch (e) {
    /* 不支持，继续补 */
  }
  const Native = typeof DecompressionStream !== 'undefined' ? DecompressionStream : null;
  globalThis.DecompressionStream = function (format) {
    if (format !== 'deflate-raw') {
      if (Native) return new Native(format);
      throw new Error('shim only covers deflate-raw, got ' + format);
    }
    const dec = zlib.createInflateRaw();
    const chunks = [];
    dec.on('data', (c) => chunks.push(c));
    let ctrl;
    this.readable = new ReadableStream({ start: (c) => { ctrl = c; } });
    this.writable = new WritableStream({
      write: (c) => { dec.write(c); },
      close: () => { dec.end(); },
    });
    dec.once('end', () => { ctrl.enqueue(Buffer.concat(chunks)); ctrl.close(); });
    dec.once('error', (e) => ctrl.error(e));
  };
  return true;
};
