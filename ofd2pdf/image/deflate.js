// Flate 压缩：浏览器用 CompressionStream，Node 用 zlib。
// deflate（Flate 压缩）：浏览器用 CompressionStream，Node 用 zlib
export async function deflate(bytes, zlib) {
  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    // 注意：不能先 await write 再读——大数据块会触发背压死锁
    // （writable 端等待 readable 端消费，readable 端等待 write 完成）。
    // 正确顺序：排队 write/close → 立即消费 readable → 最后再 await 写端。
    const writeP = writer.write(bytes);
    const closeP = writer.close();
    const chunks = [];
    let total = 0;
    const reader = cs.readable.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
      }
    } finally {
      reader.releaseLock();
      writer.releaseLock();
      await Promise.allSettled([writeP, closeP]);
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
  }
  if (zlib) return new Uint8Array(zlib.deflateSync(Buffer.from(bytes)));
  throw new Error('当前环境不支持 deflate 压缩');
}
