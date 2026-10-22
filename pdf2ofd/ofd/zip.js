// 最小 ZIP 写入器：store/deflate、CRC32、中央目录。
import zlib from "node:zlib";

// ---------------------------------------------------------------------------
// CRC32（ZIP 条目与 PNG 分块共用同一多项式）
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
export function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

// ---------------------------------------------------------------------------
// 最小 ZIP 写入器（deflate）
// ---------------------------------------------------------------------------
// 字符串 -> UTF-8 字节
function toBytes(s) {
  return Buffer.from(s, 'utf8');
}

export class ZipWriter {
  constructor() {
    this.entries = [];
  }
  add(name, data) {
    if (typeof data === 'string') data = toBytes(data);
    else if (typeof Buffer !== 'undefined' && !(data instanceof Buffer) && !(data instanceof Uint8Array))
      data = Buffer.from(data);
    this.entries.push({ name: toBytes(name), data });
  }
  // 组装 ZIP 字节流。
  build() {
    const chunks = [];
    const central = [];
    let offset = 0;
    for (const e of this.entries) {
      const comp = zlib.deflateRawSync(e.data, { level: 9 });
      const crc = crc32(e.data);
      const nameLen = e.name.length;
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4); // version needed
      local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
      local.writeUInt16LE(8, 8); // method: deflate
      local.writeUInt16LE(0, 10); // time
      local.writeUInt16LE(0, 12); // date
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(comp.length, 18);
      local.writeUInt32LE(e.data.length, 22);
      local.writeUInt16LE(nameLen, 26);
      local.writeUInt16LE(0, 28);
      chunks.push(local, e.name, comp);

      const cd = Buffer.alloc(46);
      cd.writeUInt32LE(0x02014b50, 0);
      cd.writeUInt16LE(20, 4);
      cd.writeUInt16LE(20, 6);
      cd.writeUInt16LE(0x0800, 8);
      cd.writeUInt16LE(8, 10);
      cd.writeUInt16LE(0, 12);
      cd.writeUInt16LE(0, 14);
      cd.writeUInt32LE(crc, 16);
      cd.writeUInt32LE(comp.length, 20);
      cd.writeUInt32LE(e.data.length, 24);
      cd.writeUInt16LE(nameLen, 28);
      cd.writeUInt16LE(0, 30);
      cd.writeUInt16LE(0, 32);
      cd.writeUInt16LE(0, 34);
      cd.writeUInt16LE(0, 36);
      cd.writeUInt32LE(0, 38);
      cd.writeUInt32LE(offset, 42);
      central.push(cd, e.name);

      offset += local.length + nameLen + comp.length;
    }
    const cdStart = offset;
    let cdSize = 0;
    for (const c of central) cdSize += c.length;
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(this.entries.length, 8);
    eocd.writeUInt16LE(this.entries.length, 10);
    eocd.writeUInt32LE(cdSize, 12);
    eocd.writeUInt32LE(cdStart, 16);
    eocd.writeUInt16LE(0, 20);
    return Buffer.concat([...chunks, ...central, eocd]);
  }
}
