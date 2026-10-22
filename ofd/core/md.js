// ==================== SM3 哈希 ====================
const SM3_IV = new Uint32Array([
  0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600, 0xa96f30bc, 0x163138aa,
  0xe38dee4d, 0xb0fb0e4e,
]);
function sm3Rotl(x, n) {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}
function sm3P0(x) {
  return (x ^ sm3Rotl(x, 9) ^ sm3Rotl(x, 17)) >>> 0;
}
function sm3P1(x) {
  return (x ^ sm3Rotl(x, 15) ^ sm3Rotl(x, 23)) >>> 0;
}
function sm3FF(x, y, z, j) {
  return j < 16 ? (x ^ y ^ z) >>> 0 : ((x & y) | (x & z) | (y & z)) >>> 0;
}
function sm3GG(x, y, z, j) {
  return j < 16 ? (x ^ y ^ z) >>> 0 : ((x & y) | (~x & z)) >>> 0;
}
function sm3Hash(data) {
  const msg = data instanceof Uint8Array ? data : new Uint8Array(data);
  const bitLen = msg.length * 8;
  const rem = msg.length % 64;
  const padLen = rem >= 56 ? 128 - rem : 64 - rem;
  const padded = new Uint8Array(msg.length + padLen);
  padded.set(msg);
  padded[msg.length] = 0x80;
  const pv = new DataView(padded.buffer);
  pv.setUint32(padded.length - 8, 0, false);
  pv.setUint32(padded.length - 4, bitLen >>> 0, false);

  const V = SM3_IV.slice();
  const W = new Uint32Array(68);
  const Wp = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let t = 0; t < 16; t++) {
      const i = off + t * 4;
      W[t] =
        ((padded[i] << 24) |
          (padded[i + 1] << 16) |
          (padded[i + 2] << 8) |
          padded[i + 3]) >>>
        0;
    }
    for (let t = 16; t < 68; t++) {
      W[t] =
        (sm3P1(W[t - 16] ^ W[t - 9] ^ sm3Rotl(W[t - 3], 15)) ^
          sm3Rotl(W[t - 13], 7) ^
          W[t - 6]) >>>
        0;
    }
    for (let t = 0; t < 64; t++) Wp[t] = (W[t] ^ W[t + 4]) >>> 0;

    let a = V[0],
      b = V[1],
      c = V[2],
      d = V[3];
    let e = V[4],
      f = V[5],
      g = V[6],
      h = V[7];
    for (let t = 0; t < 64; t++) {
      const T = t < 16 ? 0x79cc4519 : 0x7a879d8a;
      const ss1 = sm3Rotl((sm3Rotl(a, 12) + e + sm3Rotl(T, t)) >>> 0, 7);
      const ss2 = (ss1 ^ sm3Rotl(a, 12)) >>> 0;
      const tt1 = (sm3FF(a, b, c, t) + d + ss2 + Wp[t]) >>> 0;
      const tt2 = (sm3GG(e, f, g, t) + h + ss1 + W[t]) >>> 0;
      d = c;
      c = sm3Rotl(b, 9);
      b = a;
      a = tt1;
      h = g;
      g = sm3Rotl(f, 19);
      f = e;
      e = sm3P0(tt2);
    }
    V[0] = (V[0] ^ a) >>> 0;
    V[1] = (V[1] ^ b) >>> 0;
    V[2] = (V[2] ^ c) >>> 0;
    V[3] = (V[3] ^ d) >>> 0;
    V[4] = (V[4] ^ e) >>> 0;
    V[5] = (V[5] ^ f) >>> 0;
    V[6] = (V[6] ^ g) >>> 0;
    V[7] = (V[7] ^ h) >>> 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let t = 0; t < 8; t++) ov.setUint32(t * 4, V[t], false);
  return out;
}

// ==================== 哈希算法 ====================
export async function hashBytes(data, checkMethod) {
  const cm = String(checkMethod || "").toLowerCase();
  if (/sm3|\.401/.test(cm)) return sm3Hash(data);
  let alg = null;
  if (cm.indexOf("sha-256") >= 0 || cm.indexOf("sha256") >= 0)
    alg = "SHA-256";
  else if (cm.indexOf("sha-1") >= 0 || cm.indexOf("sha1") >= 0) alg = "SHA-1";
  else if (cm.indexOf("sha-384") >= 0 || cm.indexOf("sha384") >= 0)
    alg = "SHA-384";
  else if (cm.indexOf("sha-512") >= 0 || cm.indexOf("sha512") >= 0)
    alg = "SHA-512";
  if (!alg) throw new Error("不支持的摘要算法: " + (checkMethod || "未知"));
  const buf = await crypto.subtle.digest(alg, data);
  return new Uint8Array(buf);
}

