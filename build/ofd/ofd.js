/*!
 * ofd.js v1.0.0 — OFD 纯前端解析与 SVG 渲染引擎
 * 零依赖，ZIP 解压使用浏览器原生 DecompressionStream
 */
(function () {
  "use strict";

(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/jsbn/index.js
  var require_jsbn = __commonJS({
    "node_modules/jsbn/index.js"(exports, module) {
      (function() {
        var dbits;
        var canary = 244837814094590;
        var j_lm = (canary & 16777215) == 15715070;
        function BigInteger(a, b, c) {
          if (a != null)
            if ("number" == typeof a) this.fromNumber(a, b, c);
            else if (b == null && "string" != typeof a) this.fromString(a, 256);
            else this.fromString(a, b);
        }
        function nbi() {
          return new BigInteger(null);
        }
        function am1(i, x, w, j, c, n) {
          while (--n >= 0) {
            var v = x * this[i++] + w[j] + c;
            c = Math.floor(v / 67108864);
            w[j++] = v & 67108863;
          }
          return c;
        }
        function am2(i, x, w, j, c, n) {
          var xl = x & 32767, xh = x >> 15;
          while (--n >= 0) {
            var l = this[i] & 32767;
            var h = this[i++] >> 15;
            var m = xh * l + h * xl;
            l = xl * l + ((m & 32767) << 15) + w[j] + (c & 1073741823);
            c = (l >>> 30) + (m >>> 15) + xh * h + (c >>> 30);
            w[j++] = l & 1073741823;
          }
          return c;
        }
        function am3(i, x, w, j, c, n) {
          var xl = x & 16383, xh = x >> 14;
          while (--n >= 0) {
            var l = this[i] & 16383;
            var h = this[i++] >> 14;
            var m = xh * l + h * xl;
            l = xl * l + ((m & 16383) << 14) + w[j] + c;
            c = (l >> 28) + (m >> 14) + xh * h;
            w[j++] = l & 268435455;
          }
          return c;
        }
        var inBrowser = typeof navigator !== "undefined";
        if (inBrowser && j_lm && navigator.appName == "Microsoft Internet Explorer") {
          BigInteger.prototype.am = am2;
          dbits = 30;
        } else if (inBrowser && j_lm && navigator.appName != "Netscape") {
          BigInteger.prototype.am = am1;
          dbits = 26;
        } else {
          BigInteger.prototype.am = am3;
          dbits = 28;
        }
        BigInteger.prototype.DB = dbits;
        BigInteger.prototype.DM = (1 << dbits) - 1;
        BigInteger.prototype.DV = 1 << dbits;
        var BI_FP = 52;
        BigInteger.prototype.FV = Math.pow(2, BI_FP);
        BigInteger.prototype.F1 = BI_FP - dbits;
        BigInteger.prototype.F2 = 2 * dbits - BI_FP;
        var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
        var BI_RC = new Array();
        var rr, vv;
        rr = "0".charCodeAt(0);
        for (vv = 0; vv <= 9; ++vv) BI_RC[rr++] = vv;
        rr = "a".charCodeAt(0);
        for (vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
        rr = "A".charCodeAt(0);
        for (vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
        function int2char(n) {
          return BI_RM.charAt(n);
        }
        function intAt(s, i) {
          var c = BI_RC[s.charCodeAt(i)];
          return c == null ? -1 : c;
        }
        function bnpCopyTo(r) {
          for (var i = this.t - 1; i >= 0; --i) r[i] = this[i];
          r.t = this.t;
          r.s = this.s;
        }
        function bnpFromInt(x) {
          this.t = 1;
          this.s = x < 0 ? -1 : 0;
          if (x > 0) this[0] = x;
          else if (x < -1) this[0] = x + this.DV;
          else this.t = 0;
        }
        function nbv(i) {
          var r = nbi();
          r.fromInt(i);
          return r;
        }
        function bnpFromString(s, b) {
          var k;
          if (b == 16) k = 4;
          else if (b == 8) k = 3;
          else if (b == 256) k = 8;
          else if (b == 2) k = 1;
          else if (b == 32) k = 5;
          else if (b == 4) k = 2;
          else {
            this.fromRadix(s, b);
            return;
          }
          this.t = 0;
          this.s = 0;
          var i = s.length, mi = false, sh = 0;
          while (--i >= 0) {
            var x = k == 8 ? s[i] & 255 : intAt(s, i);
            if (x < 0) {
              if (s.charAt(i) == "-") mi = true;
              continue;
            }
            mi = false;
            if (sh == 0)
              this[this.t++] = x;
            else if (sh + k > this.DB) {
              this[this.t - 1] |= (x & (1 << this.DB - sh) - 1) << sh;
              this[this.t++] = x >> this.DB - sh;
            } else
              this[this.t - 1] |= x << sh;
            sh += k;
            if (sh >= this.DB) sh -= this.DB;
          }
          if (k == 8 && (s[0] & 128) != 0) {
            this.s = -1;
            if (sh > 0) this[this.t - 1] |= (1 << this.DB - sh) - 1 << sh;
          }
          this.clamp();
          if (mi) BigInteger.ZERO.subTo(this, this);
        }
        function bnpClamp() {
          var c = this.s & this.DM;
          while (this.t > 0 && this[this.t - 1] == c) --this.t;
        }
        function bnToString(b) {
          if (this.s < 0) return "-" + this.negate().toString(b);
          var k;
          if (b == 16) k = 4;
          else if (b == 8) k = 3;
          else if (b == 2) k = 1;
          else if (b == 32) k = 5;
          else if (b == 4) k = 2;
          else return this.toRadix(b);
          var km = (1 << k) - 1, d, m = false, r = "", i = this.t;
          var p = this.DB - i * this.DB % k;
          if (i-- > 0) {
            if (p < this.DB && (d = this[i] >> p) > 0) {
              m = true;
              r = int2char(d);
            }
            while (i >= 0) {
              if (p < k) {
                d = (this[i] & (1 << p) - 1) << k - p;
                d |= this[--i] >> (p += this.DB - k);
              } else {
                d = this[i] >> (p -= k) & km;
                if (p <= 0) {
                  p += this.DB;
                  --i;
                }
              }
              if (d > 0) m = true;
              if (m) r += int2char(d);
            }
          }
          return m ? r : "0";
        }
        function bnNegate() {
          var r = nbi();
          BigInteger.ZERO.subTo(this, r);
          return r;
        }
        function bnAbs() {
          return this.s < 0 ? this.negate() : this;
        }
        function bnCompareTo(a) {
          var r = this.s - a.s;
          if (r != 0) return r;
          var i = this.t;
          r = i - a.t;
          if (r != 0) return this.s < 0 ? -r : r;
          while (--i >= 0) if ((r = this[i] - a[i]) != 0) return r;
          return 0;
        }
        function nbits(x) {
          var r = 1, t2;
          if ((t2 = x >>> 16) != 0) {
            x = t2;
            r += 16;
          }
          if ((t2 = x >> 8) != 0) {
            x = t2;
            r += 8;
          }
          if ((t2 = x >> 4) != 0) {
            x = t2;
            r += 4;
          }
          if ((t2 = x >> 2) != 0) {
            x = t2;
            r += 2;
          }
          if ((t2 = x >> 1) != 0) {
            x = t2;
            r += 1;
          }
          return r;
        }
        function bnBitLength() {
          if (this.t <= 0) return 0;
          return this.DB * (this.t - 1) + nbits(this[this.t - 1] ^ this.s & this.DM);
        }
        function bnpDLShiftTo(n, r) {
          var i;
          for (i = this.t - 1; i >= 0; --i) r[i + n] = this[i];
          for (i = n - 1; i >= 0; --i) r[i] = 0;
          r.t = this.t + n;
          r.s = this.s;
        }
        function bnpDRShiftTo(n, r) {
          for (var i = n; i < this.t; ++i) r[i - n] = this[i];
          r.t = Math.max(this.t - n, 0);
          r.s = this.s;
        }
        function bnpLShiftTo(n, r) {
          var bs = n % this.DB;
          var cbs = this.DB - bs;
          var bm = (1 << cbs) - 1;
          var ds = Math.floor(n / this.DB), c = this.s << bs & this.DM, i;
          for (i = this.t - 1; i >= 0; --i) {
            r[i + ds + 1] = this[i] >> cbs | c;
            c = (this[i] & bm) << bs;
          }
          for (i = ds - 1; i >= 0; --i) r[i] = 0;
          r[ds] = c;
          r.t = this.t + ds + 1;
          r.s = this.s;
          r.clamp();
        }
        function bnpRShiftTo(n, r) {
          r.s = this.s;
          var ds = Math.floor(n / this.DB);
          if (ds >= this.t) {
            r.t = 0;
            return;
          }
          var bs = n % this.DB;
          var cbs = this.DB - bs;
          var bm = (1 << bs) - 1;
          r[0] = this[ds] >> bs;
          for (var i = ds + 1; i < this.t; ++i) {
            r[i - ds - 1] |= (this[i] & bm) << cbs;
            r[i - ds] = this[i] >> bs;
          }
          if (bs > 0) r[this.t - ds - 1] |= (this.s & bm) << cbs;
          r.t = this.t - ds;
          r.clamp();
        }
        function bnpSubTo(a, r) {
          var i = 0, c = 0, m = Math.min(a.t, this.t);
          while (i < m) {
            c += this[i] - a[i];
            r[i++] = c & this.DM;
            c >>= this.DB;
          }
          if (a.t < this.t) {
            c -= a.s;
            while (i < this.t) {
              c += this[i];
              r[i++] = c & this.DM;
              c >>= this.DB;
            }
            c += this.s;
          } else {
            c += this.s;
            while (i < a.t) {
              c -= a[i];
              r[i++] = c & this.DM;
              c >>= this.DB;
            }
            c -= a.s;
          }
          r.s = c < 0 ? -1 : 0;
          if (c < -1) r[i++] = this.DV + c;
          else if (c > 0) r[i++] = c;
          r.t = i;
          r.clamp();
        }
        function bnpMultiplyTo(a, r) {
          var x = this.abs(), y = a.abs();
          var i = x.t;
          r.t = i + y.t;
          while (--i >= 0) r[i] = 0;
          for (i = 0; i < y.t; ++i) r[i + x.t] = x.am(0, y[i], r, i, 0, x.t);
          r.s = 0;
          r.clamp();
          if (this.s != a.s) BigInteger.ZERO.subTo(r, r);
        }
        function bnpSquareTo(r) {
          var x = this.abs();
          var i = r.t = 2 * x.t;
          while (--i >= 0) r[i] = 0;
          for (i = 0; i < x.t - 1; ++i) {
            var c = x.am(i, x[i], r, 2 * i, 0, 1);
            if ((r[i + x.t] += x.am(i + 1, 2 * x[i], r, 2 * i + 1, c, x.t - i - 1)) >= x.DV) {
              r[i + x.t] -= x.DV;
              r[i + x.t + 1] = 1;
            }
          }
          if (r.t > 0) r[r.t - 1] += x.am(i, x[i], r, 2 * i, 0, 1);
          r.s = 0;
          r.clamp();
        }
        function bnpDivRemTo(m, q, r) {
          var pm = m.abs();
          if (pm.t <= 0) return;
          var pt = this.abs();
          if (pt.t < pm.t) {
            if (q != null) q.fromInt(0);
            if (r != null) this.copyTo(r);
            return;
          }
          if (r == null) r = nbi();
          var y = nbi(), ts = this.s, ms = m.s;
          var nsh = this.DB - nbits(pm[pm.t - 1]);
          if (nsh > 0) {
            pm.lShiftTo(nsh, y);
            pt.lShiftTo(nsh, r);
          } else {
            pm.copyTo(y);
            pt.copyTo(r);
          }
          var ys = y.t;
          var y0 = y[ys - 1];
          if (y0 == 0) return;
          var yt = y0 * (1 << this.F1) + (ys > 1 ? y[ys - 2] >> this.F2 : 0);
          var d1 = this.FV / yt, d2 = (1 << this.F1) / yt, e = 1 << this.F2;
          var i = r.t, j = i - ys, t2 = q == null ? nbi() : q;
          y.dlShiftTo(j, t2);
          if (r.compareTo(t2) >= 0) {
            r[r.t++] = 1;
            r.subTo(t2, r);
          }
          BigInteger.ONE.dlShiftTo(ys, t2);
          t2.subTo(y, y);
          while (y.t < ys) y[y.t++] = 0;
          while (--j >= 0) {
            var qd = r[--i] == y0 ? this.DM : Math.floor(r[i] * d1 + (r[i - 1] + e) * d2);
            if ((r[i] += y.am(0, qd, r, j, 0, ys)) < qd) {
              y.dlShiftTo(j, t2);
              r.subTo(t2, r);
              while (r[i] < --qd) r.subTo(t2, r);
            }
          }
          if (q != null) {
            r.drShiftTo(ys, q);
            if (ts != ms) BigInteger.ZERO.subTo(q, q);
          }
          r.t = ys;
          r.clamp();
          if (nsh > 0) r.rShiftTo(nsh, r);
          if (ts < 0) BigInteger.ZERO.subTo(r, r);
        }
        function bnMod(a) {
          var r = nbi();
          this.abs().divRemTo(a, null, r);
          if (this.s < 0 && r.compareTo(BigInteger.ZERO) > 0) a.subTo(r, r);
          return r;
        }
        function Classic(m) {
          this.m = m;
        }
        function cConvert(x) {
          if (x.s < 0 || x.compareTo(this.m) >= 0) return x.mod(this.m);
          else return x;
        }
        function cRevert(x) {
          return x;
        }
        function cReduce(x) {
          x.divRemTo(this.m, null, x);
        }
        function cMulTo(x, y, r) {
          x.multiplyTo(y, r);
          this.reduce(r);
        }
        function cSqrTo(x, r) {
          x.squareTo(r);
          this.reduce(r);
        }
        Classic.prototype.convert = cConvert;
        Classic.prototype.revert = cRevert;
        Classic.prototype.reduce = cReduce;
        Classic.prototype.mulTo = cMulTo;
        Classic.prototype.sqrTo = cSqrTo;
        function bnpInvDigit() {
          if (this.t < 1) return 0;
          var x = this[0];
          if ((x & 1) == 0) return 0;
          var y = x & 3;
          y = y * (2 - (x & 15) * y) & 15;
          y = y * (2 - (x & 255) * y) & 255;
          y = y * (2 - ((x & 65535) * y & 65535)) & 65535;
          y = y * (2 - x * y % this.DV) % this.DV;
          return y > 0 ? this.DV - y : -y;
        }
        function Montgomery(m) {
          this.m = m;
          this.mp = m.invDigit();
          this.mpl = this.mp & 32767;
          this.mph = this.mp >> 15;
          this.um = (1 << m.DB - 15) - 1;
          this.mt2 = 2 * m.t;
        }
        function montConvert(x) {
          var r = nbi();
          x.abs().dlShiftTo(this.m.t, r);
          r.divRemTo(this.m, null, r);
          if (x.s < 0 && r.compareTo(BigInteger.ZERO) > 0) this.m.subTo(r, r);
          return r;
        }
        function montRevert(x) {
          var r = nbi();
          x.copyTo(r);
          this.reduce(r);
          return r;
        }
        function montReduce(x) {
          while (x.t <= this.mt2)
            x[x.t++] = 0;
          for (var i = 0; i < this.m.t; ++i) {
            var j = x[i] & 32767;
            var u0 = j * this.mpl + ((j * this.mph + (x[i] >> 15) * this.mpl & this.um) << 15) & x.DM;
            j = i + this.m.t;
            x[j] += this.m.am(0, u0, x, i, 0, this.m.t);
            while (x[j] >= x.DV) {
              x[j] -= x.DV;
              x[++j]++;
            }
          }
          x.clamp();
          x.drShiftTo(this.m.t, x);
          if (x.compareTo(this.m) >= 0) x.subTo(this.m, x);
        }
        function montSqrTo(x, r) {
          x.squareTo(r);
          this.reduce(r);
        }
        function montMulTo(x, y, r) {
          x.multiplyTo(y, r);
          this.reduce(r);
        }
        Montgomery.prototype.convert = montConvert;
        Montgomery.prototype.revert = montRevert;
        Montgomery.prototype.reduce = montReduce;
        Montgomery.prototype.mulTo = montMulTo;
        Montgomery.prototype.sqrTo = montSqrTo;
        function bnpIsEven() {
          return (this.t > 0 ? this[0] & 1 : this.s) == 0;
        }
        function bnpExp(e, z2) {
          if (e > 4294967295 || e < 1) return BigInteger.ONE;
          var r = nbi(), r2 = nbi(), g = z2.convert(this), i = nbits(e) - 1;
          g.copyTo(r);
          while (--i >= 0) {
            z2.sqrTo(r, r2);
            if ((e & 1 << i) > 0) z2.mulTo(r2, g, r);
            else {
              var t2 = r;
              r = r2;
              r2 = t2;
            }
          }
          return z2.revert(r);
        }
        function bnModPowInt(e, m) {
          var z2;
          if (e < 256 || m.isEven()) z2 = new Classic(m);
          else z2 = new Montgomery(m);
          return this.exp(e, z2);
        }
        BigInteger.prototype.copyTo = bnpCopyTo;
        BigInteger.prototype.fromInt = bnpFromInt;
        BigInteger.prototype.fromString = bnpFromString;
        BigInteger.prototype.clamp = bnpClamp;
        BigInteger.prototype.dlShiftTo = bnpDLShiftTo;
        BigInteger.prototype.drShiftTo = bnpDRShiftTo;
        BigInteger.prototype.lShiftTo = bnpLShiftTo;
        BigInteger.prototype.rShiftTo = bnpRShiftTo;
        BigInteger.prototype.subTo = bnpSubTo;
        BigInteger.prototype.multiplyTo = bnpMultiplyTo;
        BigInteger.prototype.squareTo = bnpSquareTo;
        BigInteger.prototype.divRemTo = bnpDivRemTo;
        BigInteger.prototype.invDigit = bnpInvDigit;
        BigInteger.prototype.isEven = bnpIsEven;
        BigInteger.prototype.exp = bnpExp;
        BigInteger.prototype.toString = bnToString;
        BigInteger.prototype.negate = bnNegate;
        BigInteger.prototype.abs = bnAbs;
        BigInteger.prototype.compareTo = bnCompareTo;
        BigInteger.prototype.bitLength = bnBitLength;
        BigInteger.prototype.mod = bnMod;
        BigInteger.prototype.modPowInt = bnModPowInt;
        BigInteger.ZERO = nbv(0);
        BigInteger.ONE = nbv(1);
        function bnClone() {
          var r = nbi();
          this.copyTo(r);
          return r;
        }
        function bnIntValue() {
          if (this.s < 0) {
            if (this.t == 1) return this[0] - this.DV;
            else if (this.t == 0) return -1;
          } else if (this.t == 1) return this[0];
          else if (this.t == 0) return 0;
          return (this[1] & (1 << 32 - this.DB) - 1) << this.DB | this[0];
        }
        function bnByteValue() {
          return this.t == 0 ? this.s : this[0] << 24 >> 24;
        }
        function bnShortValue() {
          return this.t == 0 ? this.s : this[0] << 16 >> 16;
        }
        function bnpChunkSize(r) {
          return Math.floor(Math.LN2 * this.DB / Math.log(r));
        }
        function bnSigNum() {
          if (this.s < 0) return -1;
          else if (this.t <= 0 || this.t == 1 && this[0] <= 0) return 0;
          else return 1;
        }
        function bnpToRadix(b) {
          if (b == null) b = 10;
          if (this.signum() == 0 || b < 2 || b > 36) return "0";
          var cs = this.chunkSize(b);
          var a = Math.pow(b, cs);
          var d = nbv(a), y = nbi(), z2 = nbi(), r = "";
          this.divRemTo(d, y, z2);
          while (y.signum() > 0) {
            r = (a + z2.intValue()).toString(b).substr(1) + r;
            y.divRemTo(d, y, z2);
          }
          return z2.intValue().toString(b) + r;
        }
        function bnpFromRadix(s, b) {
          this.fromInt(0);
          if (b == null) b = 10;
          var cs = this.chunkSize(b);
          var d = Math.pow(b, cs), mi = false, j = 0, w = 0;
          for (var i = 0; i < s.length; ++i) {
            var x = intAt(s, i);
            if (x < 0) {
              if (s.charAt(i) == "-" && this.signum() == 0) mi = true;
              continue;
            }
            w = b * w + x;
            if (++j >= cs) {
              this.dMultiply(d);
              this.dAddOffset(w, 0);
              j = 0;
              w = 0;
            }
          }
          if (j > 0) {
            this.dMultiply(Math.pow(b, j));
            this.dAddOffset(w, 0);
          }
          if (mi) BigInteger.ZERO.subTo(this, this);
        }
        function bnpFromNumber(a, b, c) {
          if ("number" == typeof b) {
            if (a < 2) this.fromInt(1);
            else {
              this.fromNumber(a, c);
              if (!this.testBit(a - 1))
                this.bitwiseTo(BigInteger.ONE.shiftLeft(a - 1), op_or, this);
              if (this.isEven()) this.dAddOffset(1, 0);
              while (!this.isProbablePrime(b)) {
                this.dAddOffset(2, 0);
                if (this.bitLength() > a) this.subTo(BigInteger.ONE.shiftLeft(a - 1), this);
              }
            }
          } else {
            var x = new Array(), t2 = a & 7;
            x.length = (a >> 3) + 1;
            b.nextBytes(x);
            if (t2 > 0) x[0] &= (1 << t2) - 1;
            else x[0] = 0;
            this.fromString(x, 256);
          }
        }
        function bnToByteArray() {
          var i = this.t, r = new Array();
          r[0] = this.s;
          var p = this.DB - i * this.DB % 8, d, k = 0;
          if (i-- > 0) {
            if (p < this.DB && (d = this[i] >> p) != (this.s & this.DM) >> p)
              r[k++] = d | this.s << this.DB - p;
            while (i >= 0) {
              if (p < 8) {
                d = (this[i] & (1 << p) - 1) << 8 - p;
                d |= this[--i] >> (p += this.DB - 8);
              } else {
                d = this[i] >> (p -= 8) & 255;
                if (p <= 0) {
                  p += this.DB;
                  --i;
                }
              }
              if ((d & 128) != 0) d |= -256;
              if (k == 0 && (this.s & 128) != (d & 128)) ++k;
              if (k > 0 || d != this.s) r[k++] = d;
            }
          }
          return r;
        }
        function bnEquals(a) {
          return this.compareTo(a) == 0;
        }
        function bnMin(a) {
          return this.compareTo(a) < 0 ? this : a;
        }
        function bnMax(a) {
          return this.compareTo(a) > 0 ? this : a;
        }
        function bnpBitwiseTo(a, op, r) {
          var i, f, m = Math.min(a.t, this.t);
          for (i = 0; i < m; ++i) r[i] = op(this[i], a[i]);
          if (a.t < this.t) {
            f = a.s & this.DM;
            for (i = m; i < this.t; ++i) r[i] = op(this[i], f);
            r.t = this.t;
          } else {
            f = this.s & this.DM;
            for (i = m; i < a.t; ++i) r[i] = op(f, a[i]);
            r.t = a.t;
          }
          r.s = op(this.s, a.s);
          r.clamp();
        }
        function op_and(x, y) {
          return x & y;
        }
        function bnAnd(a) {
          var r = nbi();
          this.bitwiseTo(a, op_and, r);
          return r;
        }
        function op_or(x, y) {
          return x | y;
        }
        function bnOr(a) {
          var r = nbi();
          this.bitwiseTo(a, op_or, r);
          return r;
        }
        function op_xor(x, y) {
          return x ^ y;
        }
        function bnXor(a) {
          var r = nbi();
          this.bitwiseTo(a, op_xor, r);
          return r;
        }
        function op_andnot(x, y) {
          return x & ~y;
        }
        function bnAndNot(a) {
          var r = nbi();
          this.bitwiseTo(a, op_andnot, r);
          return r;
        }
        function bnNot() {
          var r = nbi();
          for (var i = 0; i < this.t; ++i) r[i] = this.DM & ~this[i];
          r.t = this.t;
          r.s = ~this.s;
          return r;
        }
        function bnShiftLeft(n) {
          var r = nbi();
          if (n < 0) this.rShiftTo(-n, r);
          else this.lShiftTo(n, r);
          return r;
        }
        function bnShiftRight(n) {
          var r = nbi();
          if (n < 0) this.lShiftTo(-n, r);
          else this.rShiftTo(n, r);
          return r;
        }
        function lbit(x) {
          if (x == 0) return -1;
          var r = 0;
          if ((x & 65535) == 0) {
            x >>= 16;
            r += 16;
          }
          if ((x & 255) == 0) {
            x >>= 8;
            r += 8;
          }
          if ((x & 15) == 0) {
            x >>= 4;
            r += 4;
          }
          if ((x & 3) == 0) {
            x >>= 2;
            r += 2;
          }
          if ((x & 1) == 0) ++r;
          return r;
        }
        function bnGetLowestSetBit() {
          for (var i = 0; i < this.t; ++i)
            if (this[i] != 0) return i * this.DB + lbit(this[i]);
          if (this.s < 0) return this.t * this.DB;
          return -1;
        }
        function cbit(x) {
          var r = 0;
          while (x != 0) {
            x &= x - 1;
            ++r;
          }
          return r;
        }
        function bnBitCount() {
          var r = 0, x = this.s & this.DM;
          for (var i = 0; i < this.t; ++i) r += cbit(this[i] ^ x);
          return r;
        }
        function bnTestBit(n) {
          var j = Math.floor(n / this.DB);
          if (j >= this.t) return this.s != 0;
          return (this[j] & 1 << n % this.DB) != 0;
        }
        function bnpChangeBit(n, op) {
          var r = BigInteger.ONE.shiftLeft(n);
          this.bitwiseTo(r, op, r);
          return r;
        }
        function bnSetBit(n) {
          return this.changeBit(n, op_or);
        }
        function bnClearBit(n) {
          return this.changeBit(n, op_andnot);
        }
        function bnFlipBit(n) {
          return this.changeBit(n, op_xor);
        }
        function bnpAddTo(a, r) {
          var i = 0, c = 0, m = Math.min(a.t, this.t);
          while (i < m) {
            c += this[i] + a[i];
            r[i++] = c & this.DM;
            c >>= this.DB;
          }
          if (a.t < this.t) {
            c += a.s;
            while (i < this.t) {
              c += this[i];
              r[i++] = c & this.DM;
              c >>= this.DB;
            }
            c += this.s;
          } else {
            c += this.s;
            while (i < a.t) {
              c += a[i];
              r[i++] = c & this.DM;
              c >>= this.DB;
            }
            c += a.s;
          }
          r.s = c < 0 ? -1 : 0;
          if (c > 0) r[i++] = c;
          else if (c < -1) r[i++] = this.DV + c;
          r.t = i;
          r.clamp();
        }
        function bnAdd(a) {
          var r = nbi();
          this.addTo(a, r);
          return r;
        }
        function bnSubtract(a) {
          var r = nbi();
          this.subTo(a, r);
          return r;
        }
        function bnMultiply(a) {
          var r = nbi();
          this.multiplyTo(a, r);
          return r;
        }
        function bnSquare() {
          var r = nbi();
          this.squareTo(r);
          return r;
        }
        function bnDivide(a) {
          var r = nbi();
          this.divRemTo(a, r, null);
          return r;
        }
        function bnRemainder(a) {
          var r = nbi();
          this.divRemTo(a, null, r);
          return r;
        }
        function bnDivideAndRemainder(a) {
          var q = nbi(), r = nbi();
          this.divRemTo(a, q, r);
          return new Array(q, r);
        }
        function bnpDMultiply(n) {
          this[this.t] = this.am(0, n - 1, this, 0, 0, this.t);
          ++this.t;
          this.clamp();
        }
        function bnpDAddOffset(n, w) {
          if (n == 0) return;
          while (this.t <= w) this[this.t++] = 0;
          this[w] += n;
          while (this[w] >= this.DV) {
            this[w] -= this.DV;
            if (++w >= this.t) this[this.t++] = 0;
            ++this[w];
          }
        }
        function NullExp() {
        }
        function nNop(x) {
          return x;
        }
        function nMulTo(x, y, r) {
          x.multiplyTo(y, r);
        }
        function nSqrTo(x, r) {
          x.squareTo(r);
        }
        NullExp.prototype.convert = nNop;
        NullExp.prototype.revert = nNop;
        NullExp.prototype.mulTo = nMulTo;
        NullExp.prototype.sqrTo = nSqrTo;
        function bnPow(e) {
          return this.exp(e, new NullExp());
        }
        function bnpMultiplyLowerTo(a, n, r) {
          var i = Math.min(this.t + a.t, n);
          r.s = 0;
          r.t = i;
          while (i > 0) r[--i] = 0;
          var j;
          for (j = r.t - this.t; i < j; ++i) r[i + this.t] = this.am(0, a[i], r, i, 0, this.t);
          for (j = Math.min(a.t, n); i < j; ++i) this.am(0, a[i], r, i, 0, n - i);
          r.clamp();
        }
        function bnpMultiplyUpperTo(a, n, r) {
          --n;
          var i = r.t = this.t + a.t - n;
          r.s = 0;
          while (--i >= 0) r[i] = 0;
          for (i = Math.max(n - this.t, 0); i < a.t; ++i)
            r[this.t + i - n] = this.am(n - i, a[i], r, 0, 0, this.t + i - n);
          r.clamp();
          r.drShiftTo(1, r);
        }
        function Barrett(m) {
          this.r2 = nbi();
          this.q3 = nbi();
          BigInteger.ONE.dlShiftTo(2 * m.t, this.r2);
          this.mu = this.r2.divide(m);
          this.m = m;
        }
        function barrettConvert(x) {
          if (x.s < 0 || x.t > 2 * this.m.t) return x.mod(this.m);
          else if (x.compareTo(this.m) < 0) return x;
          else {
            var r = nbi();
            x.copyTo(r);
            this.reduce(r);
            return r;
          }
        }
        function barrettRevert(x) {
          return x;
        }
        function barrettReduce(x) {
          x.drShiftTo(this.m.t - 1, this.r2);
          if (x.t > this.m.t + 1) {
            x.t = this.m.t + 1;
            x.clamp();
          }
          this.mu.multiplyUpperTo(this.r2, this.m.t + 1, this.q3);
          this.m.multiplyLowerTo(this.q3, this.m.t + 1, this.r2);
          while (x.compareTo(this.r2) < 0) x.dAddOffset(1, this.m.t + 1);
          x.subTo(this.r2, x);
          while (x.compareTo(this.m) >= 0) x.subTo(this.m, x);
        }
        function barrettSqrTo(x, r) {
          x.squareTo(r);
          this.reduce(r);
        }
        function barrettMulTo(x, y, r) {
          x.multiplyTo(y, r);
          this.reduce(r);
        }
        Barrett.prototype.convert = barrettConvert;
        Barrett.prototype.revert = barrettRevert;
        Barrett.prototype.reduce = barrettReduce;
        Barrett.prototype.mulTo = barrettMulTo;
        Barrett.prototype.sqrTo = barrettSqrTo;
        function bnModPow(e, m) {
          var i = e.bitLength(), k, r = nbv(1), z2;
          if (i <= 0) return r;
          else if (i < 18) k = 1;
          else if (i < 48) k = 3;
          else if (i < 144) k = 4;
          else if (i < 768) k = 5;
          else k = 6;
          if (i < 8)
            z2 = new Classic(m);
          else if (m.isEven())
            z2 = new Barrett(m);
          else
            z2 = new Montgomery(m);
          var g = new Array(), n = 3, k1 = k - 1, km = (1 << k) - 1;
          g[1] = z2.convert(this);
          if (k > 1) {
            var g2 = nbi();
            z2.sqrTo(g[1], g2);
            while (n <= km) {
              g[n] = nbi();
              z2.mulTo(g2, g[n - 2], g[n]);
              n += 2;
            }
          }
          var j = e.t - 1, w, is1 = true, r2 = nbi(), t2;
          i = nbits(e[j]) - 1;
          while (j >= 0) {
            if (i >= k1) w = e[j] >> i - k1 & km;
            else {
              w = (e[j] & (1 << i + 1) - 1) << k1 - i;
              if (j > 0) w |= e[j - 1] >> this.DB + i - k1;
            }
            n = k;
            while ((w & 1) == 0) {
              w >>= 1;
              --n;
            }
            if ((i -= n) < 0) {
              i += this.DB;
              --j;
            }
            if (is1) {
              g[w].copyTo(r);
              is1 = false;
            } else {
              while (n > 1) {
                z2.sqrTo(r, r2);
                z2.sqrTo(r2, r);
                n -= 2;
              }
              if (n > 0) z2.sqrTo(r, r2);
              else {
                t2 = r;
                r = r2;
                r2 = t2;
              }
              z2.mulTo(r2, g[w], r);
            }
            while (j >= 0 && (e[j] & 1 << i) == 0) {
              z2.sqrTo(r, r2);
              t2 = r;
              r = r2;
              r2 = t2;
              if (--i < 0) {
                i = this.DB - 1;
                --j;
              }
            }
          }
          return z2.revert(r);
        }
        function bnGCD(a) {
          var x = this.s < 0 ? this.negate() : this.clone();
          var y = a.s < 0 ? a.negate() : a.clone();
          if (x.compareTo(y) < 0) {
            var t2 = x;
            x = y;
            y = t2;
          }
          var i = x.getLowestSetBit(), g = y.getLowestSetBit();
          if (g < 0) return x;
          if (i < g) g = i;
          if (g > 0) {
            x.rShiftTo(g, x);
            y.rShiftTo(g, y);
          }
          while (x.signum() > 0) {
            if ((i = x.getLowestSetBit()) > 0) x.rShiftTo(i, x);
            if ((i = y.getLowestSetBit()) > 0) y.rShiftTo(i, y);
            if (x.compareTo(y) >= 0) {
              x.subTo(y, x);
              x.rShiftTo(1, x);
            } else {
              y.subTo(x, y);
              y.rShiftTo(1, y);
            }
          }
          if (g > 0) y.lShiftTo(g, y);
          return y;
        }
        function bnpModInt(n) {
          if (n <= 0) return 0;
          var d = this.DV % n, r = this.s < 0 ? n - 1 : 0;
          if (this.t > 0)
            if (d == 0) r = this[0] % n;
            else for (var i = this.t - 1; i >= 0; --i) r = (d * r + this[i]) % n;
          return r;
        }
        function bnModInverse(m) {
          var ac = m.isEven();
          if (this.isEven() && ac || m.signum() == 0) return BigInteger.ZERO;
          var u = m.clone(), v = this.clone();
          var a = nbv(1), b = nbv(0), c = nbv(0), d = nbv(1);
          while (u.signum() != 0) {
            while (u.isEven()) {
              u.rShiftTo(1, u);
              if (ac) {
                if (!a.isEven() || !b.isEven()) {
                  a.addTo(this, a);
                  b.subTo(m, b);
                }
                a.rShiftTo(1, a);
              } else if (!b.isEven()) b.subTo(m, b);
              b.rShiftTo(1, b);
            }
            while (v.isEven()) {
              v.rShiftTo(1, v);
              if (ac) {
                if (!c.isEven() || !d.isEven()) {
                  c.addTo(this, c);
                  d.subTo(m, d);
                }
                c.rShiftTo(1, c);
              } else if (!d.isEven()) d.subTo(m, d);
              d.rShiftTo(1, d);
            }
            if (u.compareTo(v) >= 0) {
              u.subTo(v, u);
              if (ac) a.subTo(c, a);
              b.subTo(d, b);
            } else {
              v.subTo(u, v);
              if (ac) c.subTo(a, c);
              d.subTo(b, d);
            }
          }
          if (v.compareTo(BigInteger.ONE) != 0) return BigInteger.ZERO;
          if (d.compareTo(m) >= 0) return d.subtract(m);
          if (d.signum() < 0) d.addTo(m, d);
          else return d;
          if (d.signum() < 0) return d.add(m);
          else return d;
        }
        var lowprimes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541, 547, 557, 563, 569, 571, 577, 587, 593, 599, 601, 607, 613, 617, 619, 631, 641, 643, 647, 653, 659, 661, 673, 677, 683, 691, 701, 709, 719, 727, 733, 739, 743, 751, 757, 761, 769, 773, 787, 797, 809, 811, 821, 823, 827, 829, 839, 853, 857, 859, 863, 877, 881, 883, 887, 907, 911, 919, 929, 937, 941, 947, 953, 967, 971, 977, 983, 991, 997];
        var lplim = (1 << 26) / lowprimes[lowprimes.length - 1];
        function bnIsProbablePrime(t2) {
          var i, x = this.abs();
          if (x.t == 1 && x[0] <= lowprimes[lowprimes.length - 1]) {
            for (i = 0; i < lowprimes.length; ++i)
              if (x[0] == lowprimes[i]) return true;
            return false;
          }
          if (x.isEven()) return false;
          i = 1;
          while (i < lowprimes.length) {
            var m = lowprimes[i], j = i + 1;
            while (j < lowprimes.length && m < lplim) m *= lowprimes[j++];
            m = x.modInt(m);
            while (i < j) if (m % lowprimes[i++] == 0) return false;
          }
          return x.millerRabin(t2);
        }
        function bnpMillerRabin(t2) {
          var n1 = this.subtract(BigInteger.ONE);
          var k = n1.getLowestSetBit();
          if (k <= 0) return false;
          var r = n1.shiftRight(k);
          t2 = t2 + 1 >> 1;
          if (t2 > lowprimes.length) t2 = lowprimes.length;
          var a = nbi();
          for (var i = 0; i < t2; ++i) {
            a.fromInt(lowprimes[Math.floor(Math.random() * lowprimes.length)]);
            var y = a.modPow(r, this);
            if (y.compareTo(BigInteger.ONE) != 0 && y.compareTo(n1) != 0) {
              var j = 1;
              while (j++ < k && y.compareTo(n1) != 0) {
                y = y.modPowInt(2, this);
                if (y.compareTo(BigInteger.ONE) == 0) return false;
              }
              if (y.compareTo(n1) != 0) return false;
            }
          }
          return true;
        }
        BigInteger.prototype.chunkSize = bnpChunkSize;
        BigInteger.prototype.toRadix = bnpToRadix;
        BigInteger.prototype.fromRadix = bnpFromRadix;
        BigInteger.prototype.fromNumber = bnpFromNumber;
        BigInteger.prototype.bitwiseTo = bnpBitwiseTo;
        BigInteger.prototype.changeBit = bnpChangeBit;
        BigInteger.prototype.addTo = bnpAddTo;
        BigInteger.prototype.dMultiply = bnpDMultiply;
        BigInteger.prototype.dAddOffset = bnpDAddOffset;
        BigInteger.prototype.multiplyLowerTo = bnpMultiplyLowerTo;
        BigInteger.prototype.multiplyUpperTo = bnpMultiplyUpperTo;
        BigInteger.prototype.modInt = bnpModInt;
        BigInteger.prototype.millerRabin = bnpMillerRabin;
        BigInteger.prototype.clone = bnClone;
        BigInteger.prototype.intValue = bnIntValue;
        BigInteger.prototype.byteValue = bnByteValue;
        BigInteger.prototype.shortValue = bnShortValue;
        BigInteger.prototype.signum = bnSigNum;
        BigInteger.prototype.toByteArray = bnToByteArray;
        BigInteger.prototype.equals = bnEquals;
        BigInteger.prototype.min = bnMin;
        BigInteger.prototype.max = bnMax;
        BigInteger.prototype.and = bnAnd;
        BigInteger.prototype.or = bnOr;
        BigInteger.prototype.xor = bnXor;
        BigInteger.prototype.andNot = bnAndNot;
        BigInteger.prototype.not = bnNot;
        BigInteger.prototype.shiftLeft = bnShiftLeft;
        BigInteger.prototype.shiftRight = bnShiftRight;
        BigInteger.prototype.getLowestSetBit = bnGetLowestSetBit;
        BigInteger.prototype.bitCount = bnBitCount;
        BigInteger.prototype.testBit = bnTestBit;
        BigInteger.prototype.setBit = bnSetBit;
        BigInteger.prototype.clearBit = bnClearBit;
        BigInteger.prototype.flipBit = bnFlipBit;
        BigInteger.prototype.add = bnAdd;
        BigInteger.prototype.subtract = bnSubtract;
        BigInteger.prototype.multiply = bnMultiply;
        BigInteger.prototype.divide = bnDivide;
        BigInteger.prototype.remainder = bnRemainder;
        BigInteger.prototype.divideAndRemainder = bnDivideAndRemainder;
        BigInteger.prototype.modPow = bnModPow;
        BigInteger.prototype.modInverse = bnModInverse;
        BigInteger.prototype.pow = bnPow;
        BigInteger.prototype.gcd = bnGCD;
        BigInteger.prototype.isProbablePrime = bnIsProbablePrime;
        BigInteger.prototype.square = bnSquare;
        BigInteger.prototype.Barrett = Barrett;
        var rng_state;
        var rng_pool;
        var rng_pptr;
        function rng_seed_int(x) {
          rng_pool[rng_pptr++] ^= x & 255;
          rng_pool[rng_pptr++] ^= x >> 8 & 255;
          rng_pool[rng_pptr++] ^= x >> 16 & 255;
          rng_pool[rng_pptr++] ^= x >> 24 & 255;
          if (rng_pptr >= rng_psize) rng_pptr -= rng_psize;
        }
        function rng_seed_time() {
          rng_seed_int((/* @__PURE__ */ new Date()).getTime());
        }
        if (rng_pool == null) {
          rng_pool = new Array();
          rng_pptr = 0;
          var t;
          if (typeof window !== "undefined" && window.crypto) {
            if (window.crypto.getRandomValues) {
              var ua = new Uint8Array(32);
              window.crypto.getRandomValues(ua);
              for (t = 0; t < 32; ++t)
                rng_pool[rng_pptr++] = ua[t];
            } else if (navigator.appName == "Netscape" && navigator.appVersion < "5") {
              var z = window.crypto.random(32);
              for (t = 0; t < z.length; ++t)
                rng_pool[rng_pptr++] = z.charCodeAt(t) & 255;
            }
          }
          while (rng_pptr < rng_psize) {
            t = Math.floor(65536 * Math.random());
            rng_pool[rng_pptr++] = t >>> 8;
            rng_pool[rng_pptr++] = t & 255;
          }
          rng_pptr = 0;
          rng_seed_time();
        }
        function rng_get_byte() {
          if (rng_state == null) {
            rng_seed_time();
            rng_state = prng_newstate();
            rng_state.init(rng_pool);
            for (rng_pptr = 0; rng_pptr < rng_pool.length; ++rng_pptr)
              rng_pool[rng_pptr] = 0;
            rng_pptr = 0;
          }
          return rng_state.next();
        }
        function rng_get_bytes(ba) {
          var i;
          for (i = 0; i < ba.length; ++i) ba[i] = rng_get_byte();
        }
        function SecureRandom() {
        }
        SecureRandom.prototype.nextBytes = rng_get_bytes;
        function Arcfour() {
          this.i = 0;
          this.j = 0;
          this.S = new Array();
        }
        function ARC4init(key) {
          var i, j, t2;
          for (i = 0; i < 256; ++i)
            this.S[i] = i;
          j = 0;
          for (i = 0; i < 256; ++i) {
            j = j + this.S[i] + key[i % key.length] & 255;
            t2 = this.S[i];
            this.S[i] = this.S[j];
            this.S[j] = t2;
          }
          this.i = 0;
          this.j = 0;
        }
        function ARC4next() {
          var t2;
          this.i = this.i + 1 & 255;
          this.j = this.j + this.S[this.i] & 255;
          t2 = this.S[this.i];
          this.S[this.i] = this.S[this.j];
          this.S[this.j] = t2;
          return this.S[t2 + this.S[this.i] & 255];
        }
        Arcfour.prototype.init = ARC4init;
        Arcfour.prototype.next = ARC4next;
        function prng_newstate() {
          return new Arcfour();
        }
        var rng_psize = 256;
        if (typeof exports !== "undefined") {
          exports = module.exports = {
            default: BigInteger,
            BigInteger,
            SecureRandom
          };
        } else {
          this.jsbn = {
            BigInteger,
            SecureRandom
          };
        }
      }).call(exports);
    }
  });

  // node_modules/sm-crypto/src/sm2/asn1.js
  var require_asn1 = __commonJS({
    "node_modules/sm-crypto/src/sm2/asn1.js"(exports, module) {
      var { BigInteger } = require_jsbn();
      function bigintToValue(bigint) {
        let h = bigint.toString(16);
        if (h[0] !== "-") {
          if (h.length % 2 === 1) h = "0" + h;
          else if (!h.match(/^[0-7]/)) h = "00" + h;
        } else {
          h = h.substr(1);
          let len = h.length;
          if (len % 2 === 1) len += 1;
          else if (!h.match(/^[0-7]/)) len += 2;
          let mask = "";
          for (let i = 0; i < len; i++) mask += "f";
          mask = new BigInteger(mask, 16);
          h = mask.xor(bigint).add(BigInteger.ONE);
          h = h.toString(16).replace(/^-/, "");
        }
        return h;
      }
      var ASN1Object = class {
        constructor() {
          this.tlv = null;
          this.t = "00";
          this.l = "00";
          this.v = "";
        }
        /**
         * 获取 der 编码比特流16进制串
         */
        getEncodedHex() {
          if (!this.tlv) {
            this.v = this.getValue();
            this.l = this.getLength();
            this.tlv = this.t + this.l + this.v;
          }
          return this.tlv;
        }
        getLength() {
          const n = this.v.length / 2;
          let nHex = n.toString(16);
          if (nHex.length % 2 === 1) nHex = "0" + nHex;
          if (n < 128) {
            return nHex;
          } else {
            const head = 128 + nHex.length / 2;
            return head.toString(16) + nHex;
          }
        }
        getValue() {
          return "";
        }
      };
      var DERInteger = class extends ASN1Object {
        constructor(bigint) {
          super();
          this.t = "02";
          if (bigint) this.v = bigintToValue(bigint);
        }
        getValue() {
          return this.v;
        }
      };
      var DERSequence = class extends ASN1Object {
        constructor(asn1Array) {
          super();
          this.t = "30";
          this.asn1Array = asn1Array;
        }
        getValue() {
          this.v = this.asn1Array.map((asn1Object) => asn1Object.getEncodedHex()).join("");
          return this.v;
        }
      };
      function parseLength(str, start) {
        if (start + 2 > str.length) throw new Error("invalid DER: length field truncated");
        const first = parseInt(str.substring(start, start + 2), 16);
        if (first < 128) {
          return { len: first, lenOfL: 1 };
        }
        const numBytes = first & 127;
        if (numBytes === 0) throw new Error("invalid DER: indefinite length not allowed");
        if (numBytes > 4) throw new Error("invalid DER: length too large");
        if (start + 2 + numBytes * 2 > str.length) throw new Error("invalid DER: length field truncated");
        const lenHex = str.substring(start + 2, start + 2 + numBytes * 2);
        const len = parseInt(lenHex, 16);
        if (len < 128) throw new Error("invalid DER: length not minimally encoded (should use short form)");
        if (lenHex.substring(0, 2) === "00") throw new Error("invalid DER: length has leading zero byte");
        return { len, lenOfL: 1 + numBytes };
      }
      function parseTLV(str, start) {
        if (start + 2 > str.length) throw new Error("invalid DER: tag field truncated");
        const tag = str.substring(start, start + 2);
        const { len, lenOfL } = parseLength(str, start + 2);
        const valueStart = start + 2 + lenOfL * 2;
        const valueEnd = valueStart + len * 2;
        if (valueEnd > str.length) throw new Error("invalid DER: value truncated");
        return {
          tag,
          valueHex: str.substring(valueStart, valueEnd),
          nextStart: valueEnd
        };
      }
      function assertMinimalInteger(valueHex) {
        if (valueHex.length === 0) throw new Error("invalid DER: INTEGER is empty");
        const firstByte = parseInt(valueHex.substring(0, 2), 16);
        if (firstByte & 128) throw new Error("invalid DER: INTEGER is negative");
        if (firstByte === 0) {
          if (valueHex.length === 2) {
            return;
          }
          const secondByte = parseInt(valueHex.substring(2, 4), 16);
          if (!(secondByte & 128)) throw new Error("invalid DER: INTEGER has non-minimal leading zero");
        }
      }
      module.exports = {
        /**
         * ASN.1 der 编码，针对 sm2 签名
         */
        encodeDer(r, s) {
          const derR = new DERInteger(r);
          const derS = new DERInteger(s);
          const derSeq = new DERSequence([derR, derS]);
          return derSeq.getEncodedHex();
        },
        /**
         * 解析 ASN.1 der，针对 sm2 验签
         * 严格校验规范 DER 编码，拒绝任何非规范编码（例如：
         * INTEGER 前导 00 填充、外层 SEQUENCE 长度与实际不符、错误的 tag 等），
         * 以避免签名可延展性（signature malleability）问题。
         */
        decodeDer(input) {
          if (typeof input !== "string" || input.length % 2 !== 0) {
            throw new Error("invalid DER: input must be a hex string of even length");
          }
          if (input.substring(0, 2) !== "30") throw new Error("invalid DER: expected SEQUENCE (0x30)");
          const seqLenInfo = parseLength(input, 2);
          const seqValueOffset = 2 + seqLenInfo.lenOfL * 2;
          if (seqValueOffset + seqLenInfo.len * 2 !== input.length) {
            throw new Error("invalid DER: SEQUENCE length does not match input length");
          }
          const rParsed = parseTLV(input, seqValueOffset);
          if (rParsed.tag !== "02") throw new Error("invalid DER: expected INTEGER (0x02) for R");
          assertMinimalInteger(rParsed.valueHex);
          const sParsed = parseTLV(input, rParsed.nextStart);
          if (sParsed.tag !== "02") throw new Error("invalid DER: expected INTEGER (0x02) for S");
          assertMinimalInteger(sParsed.valueHex);
          if (sParsed.nextStart !== input.length) throw new Error("invalid DER: trailing bytes inside SEQUENCE");
          const r = new BigInteger(rParsed.valueHex, 16);
          const s = new BigInteger(sParsed.valueHex, 16);
          return { r, s };
        }
      };
    }
  });

  // node_modules/sm-crypto/src/sm2/ec.js
  var require_ec = __commonJS({
    "node_modules/sm-crypto/src/sm2/ec.js"(exports, module) {
      var { BigInteger } = require_jsbn();
      var TWO = new BigInteger("2");
      var THREE = new BigInteger("3");
      var ECFieldElementFp = class _ECFieldElementFp {
        constructor(q, x) {
          this.x = x;
          this.q = q;
        }
        /**
         * 判断相等
         */
        equals(other) {
          if (other === this) return true;
          return this.q.equals(other.q) && this.x.equals(other.x);
        }
        /**
         * 返回具体数值
         */
        toBigInteger() {
          return this.x;
        }
        /**
         * 取反
         */
        negate() {
          return new _ECFieldElementFp(this.q, this.x.negate().mod(this.q));
        }
        /**
         * 相加
         */
        add(b) {
          return new _ECFieldElementFp(this.q, this.x.add(b.toBigInteger()).mod(this.q));
        }
        /**
         * 相减
         */
        subtract(b) {
          return new _ECFieldElementFp(this.q, this.x.subtract(b.toBigInteger()).mod(this.q));
        }
        /**
         * 相乘
         */
        multiply(b) {
          return new _ECFieldElementFp(this.q, this.x.multiply(b.toBigInteger()).mod(this.q));
        }
        /**
         * 相除
         */
        divide(b) {
          return new _ECFieldElementFp(this.q, this.x.multiply(b.toBigInteger().modInverse(this.q)).mod(this.q));
        }
        /**
         * 平方
         */
        square() {
          return new _ECFieldElementFp(this.q, this.x.square().mod(this.q));
        }
      };
      var ECPointFp = class _ECPointFp {
        constructor(curve, x, y, z) {
          this.curve = curve;
          this.x = x;
          this.y = y;
          this.z = z == null ? BigInteger.ONE : z;
          this.zinv = null;
        }
        getX() {
          if (this.zinv === null) this.zinv = this.z.modInverse(this.curve.q);
          return this.curve.fromBigInteger(this.x.toBigInteger().multiply(this.zinv).mod(this.curve.q));
        }
        getY() {
          if (this.zinv === null) this.zinv = this.z.modInverse(this.curve.q);
          return this.curve.fromBigInteger(this.y.toBigInteger().multiply(this.zinv).mod(this.curve.q));
        }
        /**
         * 判断相等
         */
        equals(other) {
          if (other === this) return true;
          if (this.isInfinity()) return other.isInfinity();
          if (other.isInfinity()) return this.isInfinity();
          const u = other.y.toBigInteger().multiply(this.z).subtract(this.y.toBigInteger().multiply(other.z)).mod(this.curve.q);
          if (!u.equals(BigInteger.ZERO)) return false;
          const v = other.x.toBigInteger().multiply(this.z).subtract(this.x.toBigInteger().multiply(other.z)).mod(this.curve.q);
          return v.equals(BigInteger.ZERO);
        }
        /**
         * 是否是无穷远点
         */
        isInfinity() {
          if (this.x === null && this.y === null) return true;
          return this.z.equals(BigInteger.ZERO) && !this.y.toBigInteger().equals(BigInteger.ZERO);
        }
        /**
         * 取反，x 轴对称点
         */
        negate() {
          return new _ECPointFp(this.curve, this.x, this.y.negate(), this.z);
        }
        /**
         * 相加
         *
         * 标准射影坐标系：
         *
         * λ1 = x1 * z2
         * λ2 = x2 * z1
         * λ3 = λ1 − λ2
         * λ4 = y1 * z2
         * λ5 = y2 * z1
         * λ6 = λ4 − λ5
         * λ7 = λ1 + λ2
         * λ8 = z1 * z2
         * λ9 = λ3^2
         * λ10 = λ3 * λ9
         * λ11 = λ8 * λ6^2 − λ7 * λ9
         * x3 = λ3 * λ11
         * y3 = λ6 * (λ9 * λ1 − λ11) − λ4 * λ10
         * z3 = λ10 * λ8
         */
        add(b) {
          if (this.isInfinity()) return b;
          if (b.isInfinity()) return this;
          const x1 = this.x.toBigInteger();
          const y1 = this.y.toBigInteger();
          const z1 = this.z;
          const x2 = b.x.toBigInteger();
          const y2 = b.y.toBigInteger();
          const z2 = b.z;
          const q = this.curve.q;
          const w1 = x1.multiply(z2).mod(q);
          const w2 = x2.multiply(z1).mod(q);
          const w3 = w1.subtract(w2);
          const w4 = y1.multiply(z2).mod(q);
          const w5 = y2.multiply(z1).mod(q);
          const w6 = w4.subtract(w5);
          if (BigInteger.ZERO.equals(w3)) {
            if (BigInteger.ZERO.equals(w6)) {
              return this.twice();
            }
            return this.curve.infinity;
          }
          const w7 = w1.add(w2);
          const w8 = z1.multiply(z2).mod(q);
          const w9 = w3.square().mod(q);
          const w10 = w3.multiply(w9).mod(q);
          const w11 = w8.multiply(w6.square()).subtract(w7.multiply(w9)).mod(q);
          const x3 = w3.multiply(w11).mod(q);
          const y3 = w6.multiply(w9.multiply(w1).subtract(w11)).subtract(w4.multiply(w10)).mod(q);
          const z3 = w10.multiply(w8).mod(q);
          return new _ECPointFp(this.curve, this.curve.fromBigInteger(x3), this.curve.fromBigInteger(y3), z3);
        }
        /**
         * 自加
         *
         * 标准射影坐标系：
         *
         * λ1 = 3 * x1^2 + a * z1^2
         * λ2 = 2 * y1 * z1
         * λ3 = y1^2
         * λ4 = λ3 * x1 * z1
         * λ5 = λ2^2
         * λ6 = λ1^2 − 8 * λ4
         * x3 = λ2 * λ6
         * y3 = λ1 * (4 * λ4 − λ6) − 2 * λ5 * λ3
         * z3 = λ2 * λ5
         */
        twice() {
          if (this.isInfinity()) return this;
          if (!this.y.toBigInteger().signum()) return this.curve.infinity;
          const x1 = this.x.toBigInteger();
          const y1 = this.y.toBigInteger();
          const z1 = this.z;
          const q = this.curve.q;
          const a = this.curve.a.toBigInteger();
          const w1 = x1.square().multiply(THREE).add(a.multiply(z1.square())).mod(q);
          const w2 = y1.shiftLeft(1).multiply(z1).mod(q);
          const w3 = y1.square().mod(q);
          const w4 = w3.multiply(x1).multiply(z1).mod(q);
          const w5 = w2.square().mod(q);
          const w6 = w1.square().subtract(w4.shiftLeft(3)).mod(q);
          const x3 = w2.multiply(w6).mod(q);
          const y3 = w1.multiply(w4.shiftLeft(2).subtract(w6)).subtract(w5.shiftLeft(1).multiply(w3)).mod(q);
          const z3 = w2.multiply(w5).mod(q);
          return new _ECPointFp(this.curve, this.curve.fromBigInteger(x3), this.curve.fromBigInteger(y3), z3);
        }
        /**
         * 倍点计算
         */
        multiply(k) {
          if (this.isInfinity()) return this;
          if (!k.signum()) return this.curve.infinity;
          const k3 = k.multiply(THREE);
          const neg = this.negate();
          let Q = this;
          for (let i = k3.bitLength() - 2; i > 0; i--) {
            Q = Q.twice();
            const k3Bit = k3.testBit(i);
            const kBit = k.testBit(i);
            if (k3Bit !== kBit) {
              Q = Q.add(k3Bit ? this : neg);
            }
          }
          return Q;
        }
      };
      var ECCurveFp = class {
        constructor(q, a, b) {
          this.q = q;
          this.a = this.fromBigInteger(a);
          this.b = this.fromBigInteger(b);
          this.infinity = new ECPointFp(this, null, null);
        }
        /**
         * 判断两个椭圆曲线是否相等
         */
        equals(other) {
          if (other === this) return true;
          return this.q.equals(other.q) && this.a.equals(other.a) && this.b.equals(other.b);
        }
        /**
         * 生成椭圆曲线域元素
         */
        fromBigInteger(x) {
          return new ECFieldElementFp(this.q, x);
        }
        /**
         * 解析 16 进制串为椭圆曲线点
         */
        decodePointHex(s) {
          if (typeof s !== "string" || s.length < 2 || s.length % 2 !== 0) return null;
          switch (parseInt(s.substr(0, 2), 16)) {
            // 第一个字节
            case 0:
              if (s.length !== 2) return null;
              return this.infinity;
            case 2:
            case 3:
              if (s.length !== 2 + 64) return null;
              const x = this.fromBigInteger(new BigInteger(s.substr(2), 16));
              let y = this.fromBigInteger(x.multiply(x.square()).add(
                x.multiply(this.a)
              ).add(this.b).toBigInteger().modPow(
                this.q.divide(new BigInteger("4")).add(BigInteger.ONE),
                this.q
              ));
              if (!y.toBigInteger().mod(TWO).equals(new BigInteger(s.substr(0, 2), 16).subtract(TWO))) {
                y = y.negate();
              }
              return new ECPointFp(this, x, y);
            case 4:
            case 6:
            case 7:
              if (s.length !== 2 + 128) return null;
              const len = (s.length - 2) / 2;
              const xHex = s.substr(2, len);
              const yHex = s.substr(len + 2, len);
              return new ECPointFp(this, this.fromBigInteger(new BigInteger(xHex, 16)), this.fromBigInteger(new BigInteger(yHex, 16)));
            default:
              return null;
          }
        }
      };
      module.exports = {
        ECPointFp,
        ECCurveFp
      };
    }
  });

  // node_modules/sm-crypto/src/sm2/rng.js
  var require_rng = __commonJS({
    "node_modules/sm-crypto/src/sm2/rng.js"(exports, module) {
      var rngState;
      var rngPool;
      var rngPptr;
      var rngPsize = 256;
      var Arcfour = class {
        constructor() {
          this.i = 0;
          this.j = 0;
          this.S = [];
        }
        // Initialize arcfour context from key, an array of ints, each from [0..255]
        init(key) {
          let i;
          let j;
          let t;
          for (i = 0; i < 256; ++i) this.S[i] = i;
          j = 0;
          for (i = 0; i < 256; ++i) {
            j = j + this.S[i] + key[i % key.length] & 255;
            t = this.S[i];
            this.S[i] = this.S[j];
            this.S[j] = t;
          }
          this.i = 0;
          this.j = 0;
        }
        next() {
          this.i = this.i + 1 & 255;
          this.j = this.j + this.S[this.i] & 255;
          const t = this.S[this.i];
          this.S[this.i] = this.S[this.j];
          this.S[this.j] = t;
          return this.S[t + this.S[this.i] & 255];
        }
      };
      function rngSeedInt(x) {
        rngPool[rngPptr++] ^= x & 255;
        rngPool[rngPptr++] ^= x >> 8 & 255;
        rngPool[rngPptr++] ^= x >> 16 & 255;
        rngPool[rngPptr++] ^= x >> 24 & 255;
        if (rngPptr >= rngPsize) rngPptr -= rngPsize;
      }
      function rngSeedTime() {
        rngSeedInt((/* @__PURE__ */ new Date()).getTime());
      }
      if (rngPool == null) {
        rngPool = [];
        rngPptr = 0;
        let t;
        const ua = new Uint8Array(32);
        if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
          window.crypto.getRandomValues(ua);
          for (t = 0; t < 32; ++t) rngPool[rngPptr++] = ua[t];
        } else {
          const nodeRequire = typeof module !== "undefined" && typeof module.require === "function" ? module.require.bind(module) : null;
          const nodeCrypto = nodeRequire ? nodeRequire("crypto") : null;
          if (nodeCrypto) nodeCrypto.getRandomValues(ua);
          else if (globalThis.crypto) globalThis.crypto.getRandomValues(ua);
          else throw new Error("当前环境不支持 crypto.getRandomValues！");
          for (t = 0; t < 32; ++t) rngPool[rngPptr++] = ua[t];
        }
        rngPptr = 0;
        rngSeedTime();
      }
      function rngGetByte() {
        if (rngState == null) {
          rngSeedTime();
          rngState = new Arcfour();
          rngState.init(rngPool);
          for (rngPptr = 0; rngPptr < rngPool.length; ++rngPptr) rngPool[rngPptr] = 0;
          rngPptr = 0;
        }
        return rngState.next();
      }
      var SecureRandom = class {
        // eslint-disable-next-line class-methods-use-this
        nextBytes(ba) {
          for (let i = 0; i < ba.length; ++i) ba[i] = rngGetByte();
        }
      };
      module.exports = {
        SecureRandom
      };
    }
  });

  // node_modules/sm-crypto/src/sm2/utils.js
  var require_utils = __commonJS({
    "node_modules/sm-crypto/src/sm2/utils.js"(exports, module) {
      var { BigInteger } = require_jsbn();
      var { ECCurveFp } = require_ec();
      var { SecureRandom } = require_rng();
      var rng = new SecureRandom();
      var { curve, G, n } = generateEcparam();
      function getGlobalCurve() {
        return curve;
      }
      function generateEcparam() {
        const p = new BigInteger("FFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFF", 16);
        const a = new BigInteger("FFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFC", 16);
        const b = new BigInteger("28E9FA9E9D9F5E344D5A9E4BCF6509A7F39789F515AB8F92DDBCBD414D940E93", 16);
        const curve2 = new ECCurveFp(p, a, b);
        const gxHex = "32C4AE2C1F1981195F9904466A39C9948FE30BBFF2660BE1715A4589334C74C7";
        const gyHex = "BC3736A2F4F6779C59BDCEE36B692153D0A9877CC62A474002DF32E52139F0A0";
        const G2 = curve2.decodePointHex("04" + gxHex + gyHex);
        const n2 = new BigInteger("FFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFF7203DF6B21C6052B53BBF40939D54123", 16);
        return { curve: curve2, G: G2, n: n2 };
      }
      function generateKeyPairHex(a, b, c) {
        const random = a ? new BigInteger(a, b, c) : new BigInteger(n.bitLength(), rng);
        const d = random.mod(n.subtract(BigInteger.ONE)).add(BigInteger.ONE);
        const privateKey = leftPad(d.toString(16), 64);
        const P = G.multiply(d);
        const Px = leftPad(P.getX().toBigInteger().toString(16), 64);
        const Py = leftPad(P.getY().toBigInteger().toString(16), 64);
        const publicKey = "04" + Px + Py;
        return { privateKey, publicKey };
      }
      function compressPublicKeyHex(s) {
        if (s.length !== 130) throw new Error("Invalid public key to compress");
        const len = (s.length - 2) / 2;
        const xHex = s.substr(2, len);
        const y = new BigInteger(s.substr(len + 2, len), 16);
        let prefix = "03";
        if (y.mod(new BigInteger("2")).equals(BigInteger.ZERO)) prefix = "02";
        return prefix + xHex;
      }
      function utf8ToHex(input) {
        input = unescape(encodeURIComponent(input));
        const length = input.length;
        const words = [];
        for (let i = 0; i < length; i++) {
          words[i >>> 2] |= (input.charCodeAt(i) & 255) << 24 - i % 4 * 8;
        }
        const hexChars = [];
        for (let i = 0; i < length; i++) {
          const bite = words[i >>> 2] >>> 24 - i % 4 * 8 & 255;
          hexChars.push((bite >>> 4).toString(16));
          hexChars.push((bite & 15).toString(16));
        }
        return hexChars.join("");
      }
      function leftPad(input, num2) {
        if (input.length >= num2) return input;
        return new Array(num2 - input.length + 1).join("0") + input;
      }
      function arrayToHex(arr) {
        const hexChars = [];
        for (let i = 0; i < arr.length; i++) {
          const byte = arr[i] & 255;
          hexChars.push((byte >>> 4).toString(16));
          hexChars.push((byte & 15).toString(16));
        }
        return hexChars.join("");
      }
      function arrayToUtf8(arr) {
        const words = [];
        let j = 0;
        for (let i = 0; i < arr.length * 2; i += 2) {
          words[i >>> 3] |= parseInt(arr[j], 10) << 24 - i % 8 * 4;
          j++;
        }
        try {
          const latin1Chars = [];
          for (let i = 0; i < arr.length; i++) {
            const bite = words[i >>> 2] >>> 24 - i % 4 * 8 & 255;
            latin1Chars.push(String.fromCharCode(bite));
          }
          return decodeURIComponent(escape(latin1Chars.join("")));
        } catch (e) {
          throw new Error("Malformed UTF-8 data");
        }
      }
      function hexToArray(hexStr) {
        const words = [];
        let hexStrLength = hexStr.length;
        if (hexStrLength % 2 !== 0) {
          hexStr = leftPad(hexStr, hexStrLength + 1);
        }
        hexStrLength = hexStr.length;
        for (let i = 0; i < hexStrLength; i += 2) {
          words.push(parseInt(hexStr.substr(i, 2), 16));
        }
        return words;
      }
      function verifyPublicKey(publicKey) {
        if (typeof publicKey !== "string" || !publicKey) return false;
        let point;
        try {
          point = curve.decodePointHex(publicKey);
        } catch (e) {
          return false;
        }
        if (!point || point.isInfinity()) return false;
        const x = point.getX();
        const y = point.getY();
        return y.square().equals(x.multiply(x.square()).add(x.multiply(curve.a)).add(curve.b));
      }
      function comparePublicKeyHex(publicKey1, publicKey2) {
        if (!verifyPublicKey(publicKey1) || !verifyPublicKey(publicKey2)) return false;
        const point1 = curve.decodePointHex(publicKey1);
        const point2 = curve.decodePointHex(publicKey2);
        return point1.equals(point2);
      }
      module.exports = {
        getGlobalCurve,
        generateEcparam,
        generateKeyPairHex,
        compressPublicKeyHex,
        utf8ToHex,
        leftPad,
        arrayToHex,
        arrayToUtf8,
        hexToArray,
        verifyPublicKey,
        comparePublicKeyHex
      };
    }
  });

  // node_modules/sm-crypto/src/sm2/sm3.js
  var require_sm3 = __commonJS({
    "node_modules/sm-crypto/src/sm2/sm3.js"(exports, module) {
      var W = new Uint32Array(68);
      var M = new Uint32Array(64);
      function rotl(x, n) {
        const s = n & 31;
        return x << s | x >>> 32 - s;
      }
      function xor(x, y) {
        const result = [];
        for (let i = x.length - 1; i >= 0; i--) result[i] = (x[i] ^ y[i]) & 255;
        return result;
      }
      function P0(X) {
        return X ^ rotl(X, 9) ^ rotl(X, 17);
      }
      function P1(X) {
        return X ^ rotl(X, 15) ^ rotl(X, 23);
      }
      function sm3(array) {
        let len = array.length * 8;
        let k = len % 512;
        k = k >= 448 ? 512 - k % 448 - 1 : 448 - k - 1;
        const kArr = new Array((k - 7) / 8);
        const lenArr = new Array(8);
        for (let i = 0, len2 = kArr.length; i < len2; i++) kArr[i] = 0;
        for (let i = 0, len2 = lenArr.length; i < len2; i++) lenArr[i] = 0;
        len = len.toString(2);
        for (let i = 7; i >= 0; i--) {
          if (len.length > 8) {
            const start = len.length - 8;
            lenArr[i] = parseInt(len.substr(start), 2);
            len = len.substr(0, start);
          } else if (len.length > 0) {
            lenArr[i] = parseInt(len, 2);
            len = "";
          }
        }
        const m = new Uint8Array([...array, 128, ...kArr, ...lenArr]);
        const dataView = new DataView(m.buffer, 0);
        const n = m.length / 64;
        const V = new Uint32Array([1937774191, 1226093241, 388252375, 3666478592, 2842636476, 372324522, 3817729613, 2969243214]);
        for (let i = 0; i < n; i++) {
          W.fill(0);
          M.fill(0);
          const start = 16 * i;
          for (let j = 0; j < 16; j++) {
            W[j] = dataView.getUint32((start + j) * 4, false);
          }
          for (let j = 16; j < 68; j++) {
            W[j] = P1(W[j - 16] ^ W[j - 9] ^ rotl(W[j - 3], 15)) ^ rotl(W[j - 13], 7) ^ W[j - 6];
          }
          for (let j = 0; j < 64; j++) {
            M[j] = W[j] ^ W[j + 4];
          }
          const T1 = 2043430169;
          const T2 = 2055708042;
          let A = V[0];
          let B = V[1];
          let C = V[2];
          let D = V[3];
          let E = V[4];
          let F = V[5];
          let G = V[6];
          let H = V[7];
          let SS1;
          let SS2;
          let TT1;
          let TT2;
          let T;
          for (let j = 0; j < 64; j++) {
            T = j >= 0 && j <= 15 ? T1 : T2;
            SS1 = rotl(rotl(A, 12) + E + rotl(T, j), 7);
            SS2 = SS1 ^ rotl(A, 12);
            TT1 = (j >= 0 && j <= 15 ? A ^ B ^ C : A & B | A & C | B & C) + D + SS2 + M[j];
            TT2 = (j >= 0 && j <= 15 ? E ^ F ^ G : E & F | ~E & G) + H + SS1 + W[j];
            D = C;
            C = rotl(B, 9);
            B = A;
            A = TT1;
            H = G;
            G = rotl(F, 19);
            F = E;
            E = P0(TT2);
          }
          V[0] ^= A;
          V[1] ^= B;
          V[2] ^= C;
          V[3] ^= D;
          V[4] ^= E;
          V[5] ^= F;
          V[6] ^= G;
          V[7] ^= H;
        }
        const result = [];
        for (let i = 0, len2 = V.length; i < len2; i++) {
          const word = V[i];
          result.push((word & 4278190080) >>> 24, (word & 16711680) >>> 16, (word & 65280) >>> 8, word & 255);
        }
        return result;
      }
      var blockLen = 64;
      var iPad = new Uint8Array(blockLen);
      var oPad = new Uint8Array(blockLen);
      for (let i = 0; i < blockLen; i++) {
        iPad[i] = 54;
        oPad[i] = 92;
      }
      function hmac(input, key) {
        if (key.length > blockLen) key = sm3(key);
        while (key.length < blockLen) key.push(0);
        const iPadKey = xor(key, iPad);
        const oPadKey = xor(key, oPad);
        const hash = sm3([...iPadKey, ...input]);
        return sm3([...oPadKey, ...hash]);
      }
      module.exports = {
        sm3,
        hmac
      };
    }
  });

  // node_modules/sm-crypto/src/sm2/index.js
  var require_sm2 = __commonJS({
    "node_modules/sm-crypto/src/sm2/index.js"(exports, module) {
      var { BigInteger } = require_jsbn();
      var { encodeDer, decodeDer } = require_asn1();
      var _ = require_utils();
      var sm3 = require_sm3().sm3;
      var { G, curve, n } = _.generateEcparam();
      var C1C2C3 = 0;
      function doEncrypt(msg, publicKey, cipherMode = 1) {
        if (!_.verifyPublicKey(publicKey)) throw new Error("Invalid public key");
        msg = typeof msg === "string" ? _.hexToArray(_.utf8ToHex(msg)) : Array.prototype.slice.call(msg);
        publicKey = _.getGlobalCurve().decodePointHex(publicKey);
        const keypair = _.generateKeyPairHex();
        const k = new BigInteger(keypair.privateKey, 16);
        let c1 = keypair.publicKey;
        if (c1.length > 128) c1 = c1.substr(c1.length - 128);
        const p = publicKey.multiply(k);
        const x2 = _.hexToArray(_.leftPad(p.getX().toBigInteger().toRadix(16), 64));
        const y2 = _.hexToArray(_.leftPad(p.getY().toBigInteger().toRadix(16), 64));
        const c3 = _.arrayToHex(sm3([].concat(x2, msg, y2)));
        let ct = 1;
        let offset = 0;
        let t = [];
        const z = [].concat(x2, y2);
        const nextT = () => {
          t = sm3([...z, ct >> 24 & 255, ct >> 16 & 255, ct >> 8 & 255, ct & 255]);
          ct++;
          offset = 0;
        };
        nextT();
        for (let i = 0, len = msg.length; i < len; i++) {
          if (offset === t.length) nextT();
          msg[i] ^= t[offset++] & 255;
        }
        const c2 = _.arrayToHex(msg);
        return cipherMode === C1C2C3 ? c1 + c2 + c3 : c1 + c3 + c2;
      }
      function doDecrypt(encryptData, privateKey, cipherMode = 1, {
        output = "string"
      } = {}) {
        privateKey = new BigInteger(privateKey, 16);
        let c3 = encryptData.substr(128, 64);
        let c2 = encryptData.substr(128 + 64);
        if (cipherMode === C1C2C3) {
          c3 = encryptData.substr(encryptData.length - 64);
          c2 = encryptData.substr(128, encryptData.length - 128 - 64);
        }
        const msg = _.hexToArray(c2);
        const c1 = _.getGlobalCurve().decodePointHex("04" + encryptData.substr(0, 128));
        if (!c1 || !_.verifyPublicKey("04" + encryptData.substr(0, 128))) {
          return output === "array" ? [] : "";
        }
        const p = c1.multiply(privateKey);
        const x2 = _.hexToArray(_.leftPad(p.getX().toBigInteger().toRadix(16), 64));
        const y2 = _.hexToArray(_.leftPad(p.getY().toBigInteger().toRadix(16), 64));
        let ct = 1;
        let offset = 0;
        let t = [];
        const z = [].concat(x2, y2);
        const nextT = () => {
          t = sm3([...z, ct >> 24 & 255, ct >> 16 & 255, ct >> 8 & 255, ct & 255]);
          ct++;
          offset = 0;
        };
        nextT();
        for (let i = 0, len = msg.length; i < len; i++) {
          if (offset === t.length) nextT();
          msg[i] ^= t[offset++] & 255;
        }
        const checkC3 = _.arrayToHex(sm3([].concat(x2, msg, y2)));
        if (checkC3 === c3.toLowerCase()) {
          return output === "array" ? msg : _.arrayToUtf8(msg);
        } else {
          return output === "array" ? [] : "";
        }
      }
      function doSignature(msg, privateKey, {
        pointPool,
        der,
        hash = true,
        publicKey,
        userId
      } = {}) {
        let hashHex = typeof msg === "string" ? _.utf8ToHex(msg) : _.arrayToHex(Array.prototype.slice.call(msg));
        if (hash) {
          publicKey = publicKey || getPublicKeyFromPrivateKey(privateKey);
          hashHex = getHash(hashHex, publicKey, userId);
        }
        const dA = new BigInteger(privateKey, 16);
        const e = new BigInteger(hashHex, 16);
        let k = null;
        let r = null;
        let s = null;
        do {
          do {
            let point;
            if (pointPool && pointPool.length) {
              point = pointPool.pop();
            } else {
              point = getPoint();
            }
            k = point.k;
            r = e.add(point.x1).mod(n);
          } while (r.equals(BigInteger.ZERO) || r.add(k).equals(n));
          s = dA.add(BigInteger.ONE).modInverse(n).multiply(k.subtract(r.multiply(dA))).mod(n);
        } while (s.equals(BigInteger.ZERO));
        if (der) return encodeDer(r, s);
        return _.leftPad(r.toString(16), 64) + _.leftPad(s.toString(16), 64);
      }
      function doVerifySignature(msg, signHex, publicKey, { der, hash = true, userId } = {}) {
        if (!_.verifyPublicKey(publicKey)) return false;
        let hashHex = typeof msg === "string" ? _.utf8ToHex(msg) : _.arrayToHex(Array.prototype.slice.call(msg));
        if (hash) {
          hashHex = getHash(hashHex, publicKey, userId);
        }
        let r;
        let s;
        if (der) {
          try {
            const decodeDerObj = decodeDer(signHex);
            r = decodeDerObj.r;
            s = decodeDerObj.s;
          } catch (err) {
            return false;
          }
        } else {
          r = new BigInteger(signHex.substring(0, 64), 16);
          s = new BigInteger(signHex.substring(64), 16);
        }
        const nSubOne = n.subtract(BigInteger.ONE);
        if (r.compareTo(BigInteger.ONE) < 0 || r.compareTo(nSubOne) > 0) return false;
        if (s.compareTo(BigInteger.ONE) < 0 || s.compareTo(nSubOne) > 0) return false;
        const PA = curve.decodePointHex(publicKey);
        if (!PA) return false;
        const e = new BigInteger(hashHex, 16);
        const t = r.add(s).mod(n);
        if (t.equals(BigInteger.ZERO)) return false;
        const x1y1 = G.multiply(s).add(PA.multiply(t));
        const R = e.add(x1y1.getX().toBigInteger()).mod(n);
        return r.equals(R);
      }
      function getHash(hashHex, publicKey, userId = "1234567812345678") {
        userId = _.utf8ToHex(userId);
        const a = _.leftPad(G.curve.a.toBigInteger().toRadix(16), 64);
        const b = _.leftPad(G.curve.b.toBigInteger().toRadix(16), 64);
        const gx = _.leftPad(G.getX().toBigInteger().toRadix(16), 64);
        const gy = _.leftPad(G.getY().toBigInteger().toRadix(16), 64);
        let px;
        let py;
        if (publicKey.length === 128) {
          px = publicKey.substr(0, 64);
          py = publicKey.substr(64, 64);
        } else {
          const point = G.curve.decodePointHex(publicKey);
          px = _.leftPad(point.getX().toBigInteger().toRadix(16), 64);
          py = _.leftPad(point.getY().toBigInteger().toRadix(16), 64);
        }
        const data = _.hexToArray(userId + a + b + gx + gy + px + py);
        const entl = userId.length * 4;
        data.unshift(entl & 255);
        data.unshift(entl >> 8 & 255);
        const z = sm3(data);
        return _.arrayToHex(sm3(z.concat(_.hexToArray(hashHex))));
      }
      function getPublicKeyFromPrivateKey(privateKey) {
        const PA = G.multiply(new BigInteger(privateKey, 16));
        const x = _.leftPad(PA.getX().toBigInteger().toString(16), 64);
        const y = _.leftPad(PA.getY().toBigInteger().toString(16), 64);
        return "04" + x + y;
      }
      function getPoint() {
        const keypair = _.generateKeyPairHex();
        const PA = curve.decodePointHex(keypair.publicKey);
        keypair.k = new BigInteger(keypair.privateKey, 16);
        keypair.x1 = PA.getX().toBigInteger();
        return keypair;
      }
      module.exports = {
        generateKeyPairHex: _.generateKeyPairHex,
        compressPublicKeyHex: _.compressPublicKeyHex,
        comparePublicKeyHex: _.comparePublicKeyHex,
        doEncrypt,
        doDecrypt,
        doSignature,
        doVerifySignature,
        getPublicKeyFromPrivateKey,
        getPoint,
        verifyPublicKey: _.verifyPublicKey
      };
    }
  });

  // node_modules/sm-crypto/src/sm3/index.js
  var require_sm32 = __commonJS({
    "node_modules/sm-crypto/src/sm3/index.js"(exports, module) {
      var { sm3, hmac } = require_sm3();
      function leftPad(input, num2) {
        if (input.length >= num2) return input;
        return new Array(num2 - input.length + 1).join("0") + input;
      }
      function ArrayToHex(arr) {
        return arr.map((item) => {
          item = item.toString(16);
          return item.length === 1 ? "0" + item : item;
        }).join("");
      }
      function hexToArray(hexStr) {
        const words = [];
        let hexStrLength = hexStr.length;
        if (hexStrLength % 2 !== 0) {
          hexStr = leftPad(hexStr, hexStrLength + 1);
        }
        hexStrLength = hexStr.length;
        for (let i = 0; i < hexStrLength; i += 2) {
          words.push(parseInt(hexStr.substr(i, 2), 16));
        }
        return words;
      }
      function utf8ToArray(str) {
        const arr = [];
        for (let i = 0, len = str.length; i < len; i++) {
          const point = str.codePointAt(i);
          if (point <= 127) {
            arr.push(point);
          } else if (point <= 2047) {
            arr.push(192 | point >>> 6);
            arr.push(128 | point & 63);
          } else if (point <= 55295 || point >= 57344 && point <= 65535) {
            arr.push(224 | point >>> 12);
            arr.push(128 | point >>> 6 & 63);
            arr.push(128 | point & 63);
          } else if (point >= 65536 && point <= 1114111) {
            i++;
            arr.push(240 | point >>> 18 & 28);
            arr.push(128 | point >>> 12 & 63);
            arr.push(128 | point >>> 6 & 63);
            arr.push(128 | point & 63);
          } else {
            arr.push(point);
            throw new Error("input is not supported");
          }
        }
        return arr;
      }
      module.exports = function(input, options) {
        input = typeof input === "string" ? utf8ToArray(input) : Array.prototype.slice.call(input);
        if (options) {
          const mode = options.mode || "hmac";
          if (mode !== "hmac") throw new Error("invalid mode");
          let key = options.key;
          if (!key) throw new Error("invalid key");
          key = typeof key === "string" ? hexToArray(key) : Array.prototype.slice.call(key);
          return ArrayToHex(hmac(input, key));
        }
        return ArrayToHex(sm3(input));
      };
    }
  });

  // node_modules/sm-crypto/src/sm4/index.js
  var require_sm4 = __commonJS({
    "node_modules/sm-crypto/src/sm4/index.js"(exports, module) {
      var DECRYPT = 0;
      var ROUND = 32;
      var BLOCK = 16;
      var Sbox = [
        214,
        144,
        233,
        254,
        204,
        225,
        61,
        183,
        22,
        182,
        20,
        194,
        40,
        251,
        44,
        5,
        43,
        103,
        154,
        118,
        42,
        190,
        4,
        195,
        170,
        68,
        19,
        38,
        73,
        134,
        6,
        153,
        156,
        66,
        80,
        244,
        145,
        239,
        152,
        122,
        51,
        84,
        11,
        67,
        237,
        207,
        172,
        98,
        228,
        179,
        28,
        169,
        201,
        8,
        232,
        149,
        128,
        223,
        148,
        250,
        117,
        143,
        63,
        166,
        71,
        7,
        167,
        252,
        243,
        115,
        23,
        186,
        131,
        89,
        60,
        25,
        230,
        133,
        79,
        168,
        104,
        107,
        129,
        178,
        113,
        100,
        218,
        139,
        248,
        235,
        15,
        75,
        112,
        86,
        157,
        53,
        30,
        36,
        14,
        94,
        99,
        88,
        209,
        162,
        37,
        34,
        124,
        59,
        1,
        33,
        120,
        135,
        212,
        0,
        70,
        87,
        159,
        211,
        39,
        82,
        76,
        54,
        2,
        231,
        160,
        196,
        200,
        158,
        234,
        191,
        138,
        210,
        64,
        199,
        56,
        181,
        163,
        247,
        242,
        206,
        249,
        97,
        21,
        161,
        224,
        174,
        93,
        164,
        155,
        52,
        26,
        85,
        173,
        147,
        50,
        48,
        245,
        140,
        177,
        227,
        29,
        246,
        226,
        46,
        130,
        102,
        202,
        96,
        192,
        41,
        35,
        171,
        13,
        83,
        78,
        111,
        213,
        219,
        55,
        69,
        222,
        253,
        142,
        47,
        3,
        255,
        106,
        114,
        109,
        108,
        91,
        81,
        141,
        27,
        175,
        146,
        187,
        221,
        188,
        127,
        17,
        217,
        92,
        65,
        31,
        16,
        90,
        216,
        10,
        193,
        49,
        136,
        165,
        205,
        123,
        189,
        45,
        116,
        208,
        18,
        184,
        229,
        180,
        176,
        137,
        105,
        151,
        74,
        12,
        150,
        119,
        126,
        101,
        185,
        241,
        9,
        197,
        110,
        198,
        132,
        24,
        240,
        125,
        236,
        58,
        220,
        77,
        32,
        121,
        238,
        95,
        62,
        215,
        203,
        57,
        72
      ];
      var CK = [
        462357,
        472066609,
        943670861,
        1415275113,
        1886879365,
        2358483617,
        2830087869,
        3301692121,
        3773296373,
        4228057617,
        404694573,
        876298825,
        1347903077,
        1819507329,
        2291111581,
        2762715833,
        3234320085,
        3705924337,
        4177462797,
        337322537,
        808926789,
        1280531041,
        1752135293,
        2223739545,
        2695343797,
        3166948049,
        3638552301,
        4110090761,
        269950501,
        741554753,
        1213159005,
        1684763257
      ];
      function hexToArray(str) {
        const arr = [];
        for (let i = 0, len = str.length; i < len; i += 2) {
          arr.push(parseInt(str.substr(i, 2), 16));
        }
        return arr;
      }
      function ArrayToHex(arr) {
        return arr.map((item) => {
          item = item.toString(16);
          return item.length === 1 ? "0" + item : item;
        }).join("");
      }
      function utf8ToArray(str) {
        const arr = [];
        for (let i = 0, len = str.length; i < len; i++) {
          const point = str.codePointAt(i);
          if (point <= 127) {
            arr.push(point);
          } else if (point <= 2047) {
            arr.push(192 | point >>> 6);
            arr.push(128 | point & 63);
          } else if (point <= 55295 || point >= 57344 && point <= 65535) {
            arr.push(224 | point >>> 12);
            arr.push(128 | point >>> 6 & 63);
            arr.push(128 | point & 63);
          } else if (point >= 65536 && point <= 1114111) {
            i++;
            arr.push(240 | point >>> 18 & 28);
            arr.push(128 | point >>> 12 & 63);
            arr.push(128 | point >>> 6 & 63);
            arr.push(128 | point & 63);
          } else {
            arr.push(point);
            throw new Error("input is not supported");
          }
        }
        return arr;
      }
      function arrayToUtf8(arr) {
        const str = [];
        for (let i = 0, len = arr.length; i < len; i++) {
          if (arr[i] >= 240 && arr[i] <= 247) {
            str.push(String.fromCodePoint(((arr[i] & 7) << 18) + ((arr[i + 1] & 63) << 12) + ((arr[i + 2] & 63) << 6) + (arr[i + 3] & 63)));
            i += 3;
          } else if (arr[i] >= 224 && arr[i] <= 239) {
            str.push(String.fromCodePoint(((arr[i] & 15) << 12) + ((arr[i + 1] & 63) << 6) + (arr[i + 2] & 63)));
            i += 2;
          } else if (arr[i] >= 192 && arr[i] <= 223) {
            str.push(String.fromCodePoint(((arr[i] & 31) << 6) + (arr[i + 1] & 63)));
            i++;
          } else {
            str.push(String.fromCodePoint(arr[i]));
          }
        }
        return str.join("");
      }
      function rotl(x, n) {
        const s = n & 31;
        return x << s | x >>> 32 - s;
      }
      function byteSub(a) {
        return (Sbox[a >>> 24 & 255] & 255) << 24 | (Sbox[a >>> 16 & 255] & 255) << 16 | (Sbox[a >>> 8 & 255] & 255) << 8 | Sbox[a & 255] & 255;
      }
      function l1(b) {
        return b ^ rotl(b, 2) ^ rotl(b, 10) ^ rotl(b, 18) ^ rotl(b, 24);
      }
      function l2(b) {
        return b ^ rotl(b, 13) ^ rotl(b, 23);
      }
      function sms4Crypt(input, output, roundKey) {
        const x = new Array(4);
        const tmp = new Array(4);
        for (let i = 0; i < 4; i++) {
          tmp[0] = input[4 * i] & 255;
          tmp[1] = input[4 * i + 1] & 255;
          tmp[2] = input[4 * i + 2] & 255;
          tmp[3] = input[4 * i + 3] & 255;
          x[i] = tmp[0] << 24 | tmp[1] << 16 | tmp[2] << 8 | tmp[3];
        }
        for (let r = 0, mid; r < 32; r += 4) {
          mid = x[1] ^ x[2] ^ x[3] ^ roundKey[r + 0];
          x[0] ^= l1(byteSub(mid));
          mid = x[2] ^ x[3] ^ x[0] ^ roundKey[r + 1];
          x[1] ^= l1(byteSub(mid));
          mid = x[3] ^ x[0] ^ x[1] ^ roundKey[r + 2];
          x[2] ^= l1(byteSub(mid));
          mid = x[0] ^ x[1] ^ x[2] ^ roundKey[r + 3];
          x[3] ^= l1(byteSub(mid));
        }
        for (let j = 0; j < 16; j += 4) {
          output[j] = x[3 - j / 4] >>> 24 & 255;
          output[j + 1] = x[3 - j / 4] >>> 16 & 255;
          output[j + 2] = x[3 - j / 4] >>> 8 & 255;
          output[j + 3] = x[3 - j / 4] & 255;
        }
      }
      function sms4KeyExt(key, roundKey, cryptFlag) {
        const x = new Array(4);
        const tmp = new Array(4);
        for (let i = 0; i < 4; i++) {
          tmp[0] = key[0 + 4 * i] & 255;
          tmp[1] = key[1 + 4 * i] & 255;
          tmp[2] = key[2 + 4 * i] & 255;
          tmp[3] = key[3 + 4 * i] & 255;
          x[i] = tmp[0] << 24 | tmp[1] << 16 | tmp[2] << 8 | tmp[3];
        }
        x[0] ^= 2746333894;
        x[1] ^= 1453994832;
        x[2] ^= 1736282519;
        x[3] ^= 2993693404;
        for (let r = 0, mid; r < 32; r += 4) {
          mid = x[1] ^ x[2] ^ x[3] ^ CK[r + 0];
          roundKey[r + 0] = x[0] ^= l2(byteSub(mid));
          mid = x[2] ^ x[3] ^ x[0] ^ CK[r + 1];
          roundKey[r + 1] = x[1] ^= l2(byteSub(mid));
          mid = x[3] ^ x[0] ^ x[1] ^ CK[r + 2];
          roundKey[r + 2] = x[2] ^= l2(byteSub(mid));
          mid = x[0] ^ x[1] ^ x[2] ^ CK[r + 3];
          roundKey[r + 3] = x[3] ^= l2(byteSub(mid));
        }
        if (cryptFlag === DECRYPT) {
          for (let r = 0, mid; r < 16; r++) {
            mid = roundKey[r];
            roundKey[r] = roundKey[31 - r];
            roundKey[31 - r] = mid;
          }
        }
      }
      function sm4(inArray, key, cryptFlag, {
        padding = "pkcs#7",
        mode,
        iv = [],
        output = "string"
      } = {}) {
        if (mode === "cbc") {
          if (typeof iv === "string") iv = hexToArray(iv);
          if (iv.length !== 128 / 8) {
            throw new Error("iv is invalid");
          }
        }
        if (typeof key === "string") key = hexToArray(key);
        if (key.length !== 128 / 8) {
          throw new Error("key is invalid");
        }
        if (typeof inArray === "string") {
          if (cryptFlag !== DECRYPT) {
            inArray = utf8ToArray(inArray);
          } else {
            inArray = hexToArray(inArray);
          }
        } else {
          inArray = [...inArray];
        }
        if ((padding === "pkcs#5" || padding === "pkcs#7") && cryptFlag !== DECRYPT) {
          const paddingCount = BLOCK - inArray.length % BLOCK;
          for (let i = 0; i < paddingCount; i++) inArray.push(paddingCount);
        }
        const roundKey = new Array(ROUND);
        sms4KeyExt(key, roundKey, cryptFlag);
        const outArray = [];
        let lastVector = iv;
        let restLen = inArray.length;
        let point = 0;
        while (restLen >= BLOCK) {
          const input = inArray.slice(point, point + 16);
          const output2 = new Array(16);
          if (mode === "cbc") {
            for (let i = 0; i < BLOCK; i++) {
              if (cryptFlag !== DECRYPT) {
                input[i] ^= lastVector[i];
              }
            }
          }
          sms4Crypt(input, output2, roundKey);
          for (let i = 0; i < BLOCK; i++) {
            if (mode === "cbc") {
              if (cryptFlag === DECRYPT) {
                output2[i] ^= lastVector[i];
              }
            }
            outArray[point + i] = output2[i];
          }
          if (mode === "cbc") {
            if (cryptFlag !== DECRYPT) {
              lastVector = output2;
            } else {
              lastVector = input;
            }
          }
          restLen -= BLOCK;
          point += BLOCK;
        }
        if ((padding === "pkcs#5" || padding === "pkcs#7") && cryptFlag === DECRYPT) {
          const len = outArray.length;
          const paddingCount = outArray[len - 1];
          for (let i = 1; i <= paddingCount; i++) {
            if (outArray[len - i] !== paddingCount) throw new Error("padding is invalid");
          }
          outArray.splice(len - paddingCount, paddingCount);
        }
        if (output !== "array") {
          if (cryptFlag !== DECRYPT) {
            return ArrayToHex(outArray);
          } else {
            return arrayToUtf8(outArray);
          }
        } else {
          return outArray;
        }
      }
      module.exports = {
        encrypt(inArray, key, options) {
          return sm4(inArray, key, 1, options);
        },
        decrypt(inArray, key, options) {
          return sm4(inArray, key, 0, options);
        }
      };
    }
  });

  // node_modules/sm-crypto/src/index.js
  var require_src = __commonJS({
    "node_modules/sm-crypto/src/index.js"(exports, module) {
      module.exports = {
        sm2: require_sm2(),
        sm3: require_sm32(),
        sm4: require_sm4()
      };
    }
  });

  // ofd/core/md.js
  var SM3_IV = new Uint32Array([
    1937774191,
    1226093241,
    388252375,
    3666478592,
    2842636476,
    372324522,
    3817729613,
    2969243214
  ]);
  function sm3Rotl(x, n) {
    return (x << n | x >>> 32 - n) >>> 0;
  }
  function sm3P0(x) {
    return (x ^ sm3Rotl(x, 9) ^ sm3Rotl(x, 17)) >>> 0;
  }
  function sm3P1(x) {
    return (x ^ sm3Rotl(x, 15) ^ sm3Rotl(x, 23)) >>> 0;
  }
  function sm3FF(x, y, z, j) {
    return j < 16 ? (x ^ y ^ z) >>> 0 : (x & y | x & z | y & z) >>> 0;
  }
  function sm3GG(x, y, z, j) {
    return j < 16 ? (x ^ y ^ z) >>> 0 : (x & y | ~x & z) >>> 0;
  }
  function sm3Hash(data) {
    const msg = data instanceof Uint8Array ? data : new Uint8Array(data);
    const bitLen = msg.length * 8;
    const rem = msg.length % 64;
    const padLen = rem >= 56 ? 128 - rem : 64 - rem;
    const padded = new Uint8Array(msg.length + padLen);
    padded.set(msg);
    padded[msg.length] = 128;
    const pv = new DataView(padded.buffer);
    pv.setUint32(padded.length - 8, 0, false);
    pv.setUint32(padded.length - 4, bitLen >>> 0, false);
    const V = SM3_IV.slice();
    const W = new Uint32Array(68);
    const Wp = new Uint32Array(64);
    for (let off = 0; off < padded.length; off += 64) {
      for (let t = 0; t < 16; t++) {
        const i = off + t * 4;
        W[t] = (padded[i] << 24 | padded[i + 1] << 16 | padded[i + 2] << 8 | padded[i + 3]) >>> 0;
      }
      for (let t = 16; t < 68; t++) {
        W[t] = (sm3P1(W[t - 16] ^ W[t - 9] ^ sm3Rotl(W[t - 3], 15)) ^ sm3Rotl(W[t - 13], 7) ^ W[t - 6]) >>> 0;
      }
      for (let t = 0; t < 64; t++) Wp[t] = (W[t] ^ W[t + 4]) >>> 0;
      let a = V[0], b = V[1], c = V[2], d = V[3];
      let e = V[4], f = V[5], g = V[6], h = V[7];
      for (let t = 0; t < 64; t++) {
        const T = t < 16 ? 2043430169 : 2055708042;
        const ss1 = sm3Rotl(sm3Rotl(a, 12) + e + sm3Rotl(T, t) >>> 0, 7);
        const ss2 = (ss1 ^ sm3Rotl(a, 12)) >>> 0;
        const tt1 = sm3FF(a, b, c, t) + d + ss2 + Wp[t] >>> 0;
        const tt2 = sm3GG(e, f, g, t) + h + ss1 + W[t] >>> 0;
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
  async function hashBytes(data, checkMethod) {
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

  // ofd/shared/xml.js
  function stripNs(tag) {
    const c = tag.indexOf(":");
    return c >= 0 ? tag.slice(c + 1) : tag;
  }
  function child(parent, name) {
    if (!parent || !parent.children) return null;
    for (const c of parent.children) {
      if (stripNs(c.tag) === name) return c;
    }
    return null;
  }
  function children(parent, name) {
    const out = [];
    if (!parent || !parent.children) return out;
    for (const c of parent.children) {
      if (stripNs(c.tag) === name) out.push(c);
    }
    return out;
  }
  function text(node) {
    return node ? (node.text || "").trim() : "";
  }
  function attr(el, name) {
    return el && el.attrs[name] != null ? el.attrs[name] : null;
  }
  function num(el, name, dflt) {
    const v = attr(el, name);
    if (v === null || v === "") return dflt;
    const n = parseFloat(v);
    return isFinite(n) ? n : dflt;
  }
  function bool(el, name, dflt) {
    const v = attr(el, name);
    if (v === null || v === "") return dflt;
    return v === "true" || v === "1";
  }
  function parseBox(str) {
    if (!str) return { x: 0, y: 0, w: 0, h: 0 };
    const p = str.trim().split(/\s+/).map(Number);
    return { x: p[0] || 0, y: p[1] || 0, w: p[2] || 0, h: p[3] || 0 };
  }
  function parseMatrix(str) {
    if (!str) return null;
    const p = str.trim().split(/\s+/).map(Number);
    return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] || 0, p[4] || 0, p[5] || 0];
  }

  // ofd/core/parser.js
  function parseXml(str) {
    const root = { tag: "#root", attrs: {}, children: [], text: "" };
    const stack = [root];
    let i = 0;
    const n = str.length;
    while (i < n) {
      const lt = str.indexOf("<", i);
      const cur = stack[stack.length - 1];
      if (lt < 0) {
        cur.text += decodeEntities(str.slice(i));
        break;
      }
      if (lt > i) cur.text += decodeEntities(str.slice(i, lt));
      if (str[lt + 1] === "!" && str.startsWith("<![CDATA[", lt)) {
        const end = str.indexOf("]]>", lt + 9);
        cur.text += str.slice(lt + 9, end < 0 ? n : end);
        i = end < 0 ? n : end + 3;
        continue;
      }
      if (str[lt + 1] === "?" || str[lt + 1] === "!" && str[lt + 2] !== "[") {
        const close = str.startsWith("<!--", lt) ? "-->" : ">";
        const end = str.indexOf(close, lt + 2);
        i = end < 0 ? n : end + close.length;
        continue;
      }
      if (str[lt + 1] === "/") {
        const gt = str.indexOf(">", lt);
        const name = str.slice(lt + 2, gt < 0 ? n : gt).trim();
        const top = stack[stack.length - 1];
        if (stack.length > 1 && name && stripNs(top.tag) !== stripNs(name)) {
          throw new Error(
            "XML 解析错误: 标签不匹配 <" + top.tag + "> 与 </" + name + ">（位置 " + lt + "）"
          );
        }
        stack.pop();
        i = gt < 0 ? n : gt + 1;
        continue;
      }
      const r = parseStartTag(str, lt);
      const node = { tag: r.name, attrs: r.attrs, children: [], text: "" };
      stack[stack.length - 1].children.push(node);
      if (!r.selfClosing) stack.push(node);
      i = r.end;
    }
    const el = root.children[0];
    if (!el) throw new Error("XML 解析错误: 无根元素");
    return { documentElement: el };
  }
  function _isSpace(c) {
    const cc = c.charCodeAt(0);
    return cc === 32 || cc === 9 || cc === 10 || cc === 13;
  }
  function _isNameEnd(c) {
    return c === ">" || c === "/" || _isSpace(c);
  }
  function _isAttrEnd(c) {
    return c === "=" || c === ">" || c === "/" || _isSpace(c);
  }
  function _isValEnd(c) {
    return c === ">" || _isSpace(c);
  }
  function parseStartTag(str, start) {
    const n = str.length;
    let i = start + 1;
    let name = "";
    while (i < n && !_isNameEnd(str[i])) {
      name += str[i];
      i++;
    }
    const attrs = {};
    let selfClosing = false;
    while (i < n) {
      while (i < n && _isSpace(str[i])) i++;
      if (i >= n) break;
      const ch = str[i];
      if (ch === ">") {
        i++;
        break;
      }
      if (ch === "/") {
        selfClosing = true;
        i++;
        if (str[i] === ">") i++;
        break;
      }
      let an = "";
      while (i < n && !_isAttrEnd(str[i])) {
        an += str[i];
        i++;
      }
      while (i < n && _isSpace(str[i])) i++;
      if (i < n && str[i] === "=") {
        i++;
        while (i < n && _isSpace(str[i])) i++;
        if (i < n && (str[i] === '"' || str[i] === "'")) {
          const q = str[i];
          const qe = str.indexOf(q, i + 1);
          attrs[an] = decodeEntities(str.slice(i + 1, qe < 0 ? n : qe));
          i = qe < 0 ? n : qe + 1;
        } else {
          let v = "";
          while (i < n && !_isValEnd(str[i])) {
            v += str[i];
            i++;
          }
          attrs[an] = decodeEntities(v);
        }
      } else if (an) {
        attrs[an] = "";
      }
    }
    return { name, attrs, selfClosing, end: i };
  }
  function decodeEntities(s) {
    if (s.indexOf("&") < 0) return s;
    return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, e) => {
      switch (e) {
        case "amp":
          return "&";
        case "lt":
          return "<";
        case "gt":
          return ">";
        case "quot":
          return '"';
        case "apos":
          return "'";
        default: {
          const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
          if (!isFinite(cp) || cp < 0 || cp > 1114111 || cp >= 55296 && cp <= 57343)
            return "�";
          return String.fromCodePoint(cp);
        }
      }
    });
  }
  var _xmlEscapeMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  };
  function escapeXml(s) {
    return String(s).replace(/[&<>"']/g, (c) => _xmlEscapeMap[c]);
  }
  function expandDelta(str) {
    if (!str) return [];
    const tokens = str.trim().split(/\s+/);
    const result = [];
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === "g" || t === "G") {
        const n = parseInt(tokens[i + 1], 10);
        const v = parseFloat(tokens[i + 2]);
        for (let j = 0; j < n; j++) result.push(v);
        i += 3;
      } else {
        result.push(parseFloat(t));
        i += 1;
      }
    }
    return result;
  }

  // ofd/shared/lru.js
  var LRUCache = class {
    constructor(max) {
      this._max = max;
      this._map = /* @__PURE__ */ new Map();
    }
    get(key) {
      const v = this._map.get(key);
      if (v !== void 0) {
        this._map.delete(key);
        this._map.set(key, v);
      }
      return v;
    }
    set(key, val) {
      if (this._map.has(key)) this._map.delete(key);
      this._map.set(key, val);
      if (this._map.size > this._max) {
        const first = this._map.keys().next().value;
        this._map.delete(first);
      }
    }
    has(key) {
      return this._map.has(key);
    }
  };

  // ofd/core/zip.js
  var _utf8Decoder = new TextDecoder("utf-8");
  var MAX_UNCOMPRESSED_SIZE = 256 * 1024 * 1024;
  var ZIP_ENTRY_CACHE_MAX = 64;
  async function readZip(data) {
    if (!(data instanceof Uint8Array)) data = new Uint8Array(data);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const len = data.byteLength;
    let eocd = -1;
    for (let i = len - 22; i >= 0 && i >= len - 22 - 65535; i--) {
      if (view.getUint32(i, true) === 101010256) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("无效的 OFD/ZIP 文件：未找到 EOCD");
    if (view.getUint32(eocd + 16, true) === 4294967295) {
      throw new Error("暂不支持 ZIP64 格式的 OFD 文件");
    }
    const cdEntries = view.getUint16(eocd + 10, true);
    const cdOffset = view.getUint32(eocd + 16, true);
    const entries = /* @__PURE__ */ Object.create(null);
    let off = cdOffset;
    for (let i = 0; i < cdEntries; i++) {
      if (view.getUint32(off, true) !== 33639248) break;
      const compMethod = view.getUint16(off + 10, true);
      const compSize = view.getUint32(off + 20, true);
      const uncompSize = view.getUint32(off + 24, true);
      const nameLen = view.getUint16(off + 28, true);
      const extraLen = view.getUint16(off + 30, true);
      const commentLen = view.getUint16(off + 32, true);
      const localOff = view.getUint32(off + 42, true);
      const nameBytes = data.subarray(off + 46, off + 46 + nameLen);
      const name = _utf8Decoder.decode(nameBytes);
      entries[name] = { compMethod, compSize, uncompSize, localOff };
      off += 46 + nameLen + extraLen + commentLen;
    }
    return { data, view, entries, cache: new LRUCache(ZIP_ENTRY_CACHE_MAX) };
  }
  async function readEntry(zip, name) {
    if (!zip) return null;
    if (zip.cache && zip.cache.has(name)) return zip.cache.get(name);
    const e = zip.entries[name];
    if (!e) return null;
    const lOff = e.localOff;
    const nameLen = zip.view.getUint16(lOff + 26, true);
    const extraLen = zip.view.getUint16(lOff + 28, true);
    const dataStart = lOff + 30 + nameLen + extraLen;
    const compressed = zip.data.subarray(dataStart, dataStart + e.compSize);
    let result = null;
    if (e.compMethod === 0) {
      result = compressed;
    } else if (e.compMethod === 8) {
      if (e.uncompSize > MAX_UNCOMPRESSED_SIZE) {
        throw new Error(
          "ZIP 条目声明解压体积过大（" + e.uncompSize + " 字节），已中止以防解压炸弹"
        );
      }
      const ds = new DecompressionStream("deflate-raw");
      const rs = new ReadableStream({
        start(c) {
          c.enqueue(compressed);
          c.close();
        }
      });
      const buf = await new Response(rs.pipeThrough(ds)).arrayBuffer();
      if (buf.byteLength > MAX_UNCOMPRESSED_SIZE) {
        throw new Error(
          "ZIP 条目解压后体积超过上限（" + buf.byteLength + " 字节），已中止以防解压炸弹"
        );
      }
      result = new Uint8Array(buf);
    } else {
      throw new Error("不支持的压缩方法: " + e.compMethod);
    }
    if (zip.cache) zip.cache.set(name, result);
    return result;
  }
  async function readEntryText(zip, name) {
    const bytes = await readEntry(zip, name);
    if (!bytes) return null;
    return _utf8Decoder.decode(bytes);
  }
  function bytesToBase64(bytes) {
    let s = "";
    const chunk = 32768;
    for (let i = 0; i < bytes.length; i += chunk) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(s);
  }
  function base64ToBytes(b64) {
    let s = String(b64).replace(/[\s\x00]/g, "").replace(/-/g, "+").replace(/_/g, "/");
    const pad = s.length % 4;
    if (pad === 2) s += "==";
    else if (pad === 3) s += "=";
    else if (pad === 1) throw new Error("base64 长度非法");
    let bin;
    if (typeof atob === "function") {
      bin = atob(s);
    } else {
      const table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      const eq = "=".charCodeAt(0);
      bin = "";
      for (let i = 0; i < s.length; i += 4) {
        const c = [s[i], s[i + 1], s[i + 2], s[i + 3]].map(
          (ch) => ch === "=" ? eq : table.indexOf(ch)
        );
        const n = c[0] << 18 | c[1] << 12 | c[2] << 6 | c[3];
        bin += String.fromCharCode(n >> 16 & 255, n >> 8 & 255, n & 255);
      }
      const eqs = /\=*$/.exec(s)[0].length;
      if (eqs) bin = bin.slice(0, 3 - eqs);
    }
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  function digestMatches(digest, expected) {
    if (bytesEqual(digest, expected)) return true;
    if (expected.length <= digest.length) return false;
    for (let i = digest.length; i < expected.length; i++)
      if (expected[i] !== 0) return false;
    return bytesEqual(digest, expected.subarray(0, digest.length));
  }

  // ofd/shared/color.js
  function parseColorComponents(str) {
    const parts = String(str || "").trim().split(/\s+/).filter(Boolean);
    const out = [];
    for (const s of parts) {
      if (s.startsWith("#")) {
        const v = parseInt(s.slice(1), 16);
        out.push(isNaN(v) ? 0 : v);
      } else {
        const v = parseFloat(s);
        out.push(isNaN(v) ? 0 : v);
      }
    }
    return out;
  }
  function colorFromComponents(vals, cs, a) {
    const type = (cs && cs.type || "RGB").toUpperCase();
    const bits = cs && +cs.bits > 0 ? +cs.bits : 8;
    const max = Math.pow(2, bits) - 1;
    const ch = vals.map((v) => {
      const n = Math.max(0, Math.min(max, v));
      return Math.round(n * 255 / max);
    });
    if (type === "GRAY") {
      const g = ch.length ? ch[0] : 0;
      return { r: g, g, b: g, a };
    }
    if (type === "CMYK") {
      const c = ch.length > 0 ? ch[0] : 0;
      const m = ch.length > 1 ? ch[1] : 0;
      const y = ch.length > 2 ? ch[2] : 0;
      const k = ch.length > 3 ? ch[3] : 0;
      return {
        r: Math.round(255 * (1 - c / 255) * (1 - k / 255)),
        g: Math.round(255 * (1 - m / 255) * (1 - k / 255)),
        b: Math.round(255 * (1 - y / 255) * (1 - k / 255)),
        a
      };
    }
    return {
      r: ch.length > 0 ? ch[0] : 0,
      g: ch.length > 1 ? ch[1] : 0,
      b: ch.length > 2 ? ch[2] : 0,
      a
    };
  }
  function parseColor(el, res, defaultCs) {
    if (!el) return null;
    const alpha = attr(el, "Alpha");
    let a = 1;
    if (alpha !== null && alpha !== "")
      a = Math.max(0, Math.min(1, parseFloat(alpha) / 255));
    const csId = attr(el, "ColorSpace") || defaultCs || "";
    const cs = res && res.colorSpaces && csId != null ? res.colorSpaces[csId] : null;
    const index = attr(el, "Index");
    if (index !== null && index !== "" && cs && cs.palette) {
      const entry = cs.palette[parseInt(index, 10)];
      if (entry) return colorFromComponents(entry, cs, a);
    }
    const val = attr(el, "Value");
    if (!val) return { r: 0, g: 0, b: 0, a };
    return colorFromComponents(parseColorComponents(val), cs, a);
  }
  var _colorCache = /* @__PURE__ */ new Map();
  function colorToCss(c) {
    if (!c) return "#000";
    const key = c.r + "," + c.g + "," + c.b + "," + c.a;
    let css = _colorCache.get(key);
    if (css !== void 0) return css;
    css = c.a < 1 ? `rgba(${c.r},${c.g},${c.b},${c.a})` : `rgb(${c.r},${c.g},${c.b})`;
    if (_colorCache.size >= 256) _colorCache.clear();
    _colorCache.set(key, css);
    return css;
  }

  // ofd/shared/path.js
  function dirOf(path) {
    const i = path.lastIndexOf("/");
    return i >= 0 ? path.slice(0, i) : "";
  }
  function resolvePath(base, rel) {
    if (!rel) return rel;
    if (/^[a-zA-Z]+:\/\//.test(rel) || rel.startsWith("/"))
      return rel.replace(/^\//, "");
    const parts = (dirOf(base) ? dirOf(base) + "/" : "") + rel;
    const segs = parts.split("/");
    const out = [];
    for (const s of segs) {
      if (s === "." || s === "") continue;
      if (s === "..") out.pop();
      else out.push(s);
    }
    return out.join("/");
  }

  // ofd/core/res.js
  function mergeRes(target, src) {
    Object.assign(target.fonts, src.fonts);
    Object.assign(target.colorSpaces, src.colorSpaces);
    Object.assign(target.multiMedias, src.multiMedias);
    Object.assign(target.drawParams, src.drawParams);
    Object.assign(target.compositeUnits, src.compositeUnits);
  }
  async function parseRes(resPath, zip, defaultCs) {
    const res = {
      fonts: {},
      colorSpaces: {},
      multiMedias: {},
      drawParams: {},
      compositeUnits: {}
    };
    const xmlText = await readEntryText(zip, resPath);
    if (!xmlText) return res;
    const root = parseXml(xmlText).documentElement;
    const baseLoc = attr(root, "BaseLoc") || "";
    const baseDir = baseLoc ? resolvePath(resPath, baseLoc) : dirOf(resPath);
    const csEl = child(root, "ColorSpaces");
    if (csEl)
      for (const c of children(csEl, "ColorSpace")) {
        const palEl = child(c, "Palette");
        res.colorSpaces[attr(c, "ID")] = {
          type: attr(c, "Type"),
          bits: attr(c, "BitsPerComponent"),
          palette: palEl ? children(palEl, "CV").map((cv) => parseColorComponents(text(cv))) : null
        };
      }
    const fontsEl = child(root, "Fonts");
    if (fontsEl)
      for (const f of children(fontsEl, "Font")) {
        const fontFileEl = child(f, "FontFile");
        res.fonts[attr(f, "ID")] = {
          fontName: attr(f, "FontName"),
          familyName: attr(f, "FamilyName"),
          fontFile: fontFileEl ? text(fontFileEl) : null,
          fontBaseDir: baseDir,
          _zip: zip
        };
      }
    const mmEl = child(root, "MultiMedias");
    if (mmEl)
      for (const m of children(mmEl, "MultiMedia")) {
        const mf = child(m, "MediaFile");
        res.multiMedias[attr(m, "ID")] = {
          type: attr(m, "Type"),
          format: attr(m, "Format"),
          mediaFile: mf ? text(mf) : null,
          baseDir,
          _zip: zip
        };
      }
    const dpEl = child(root, "DrawParams");
    if (dpEl)
      for (const d of children(dpEl, "DrawParam")) {
        const dp = {
          id: attr(d, "ID"),
          lineWidth: num(d, "LineWidth", null),
          dashPattern: attr(d, "DashPattern") || null,
          cap: attr(d, "Cap"),
          join: attr(d, "Join"),
          miterLimit: num(d, "MiterLimit", null),
          dashOffset: num(d, "DashOffset", null)
        };
        const sc = child(d, "StrokeColor");
        if (sc) {
          const g = parseGradient(sc);
          if (g) dp.strokeGradient = g;
          else dp.strokeColor = parseColor(sc, res, defaultCs);
        }
        const fc = child(d, "FillColor");
        if (fc) {
          const g = parseGradient(fc);
          if (g) dp.fillGradient = g;
          else dp.fillColor = parseColor(fc, res, defaultCs);
        }
        res.drawParams[attr(d, "ID")] = dp;
      }
    return res;
  }

  // ofd/core/page.js
  function normalizeCtx(ctx) {
    return ctx || {};
  }
  function parseClips(el, ctx) {
    const clipsEl = child(el, "Clips");
    if (!clipsEl) return null;
    const tfAttr = attr(clipsEl, "TransFlag");
    let transFlag;
    if (tfAttr !== null && tfAttr !== "") {
      transFlag = /^(true|1)$/i.test(tfAttr);
    } else {
      const ver = parseFloat(ctx && ctx.version);
      transFlag = isFinite(ver) ? ver < 1.2 : true;
    }
    const clips = [];
    for (const clipEl of children(clipsEl, "Clip")) {
      const areas = [];
      for (const areaEl of children(clipEl, "Area")) {
        const ctm = parseMatrix(attr(areaEl, "CTM"));
        const paths = children(areaEl, "Path").map((p) => ({
          boundary: parseBox(attr(p, "Boundary")),
          ctm: parseMatrix(attr(p, "CTM")),
          abbr: text(child(p, "AbbreviatedData")),
          rule: attr(p, "Rule")
        }));
        const texts = children(areaEl, "Text").map(
          (t) => parseTextObject(t, void 0, ctx)
        );
        if (paths.length || texts.length) areas.push({ ctm, paths, texts });
      }
      if (areas.length) clips.push({ transFlag, areas });
    }
    return clips.length ? clips : null;
  }
  function parseObjectEl(c, layerDp, ctx) {
    const name = stripNs(c.tag);
    if (name === "PathObject") return parsePathObject(c, layerDp, ctx);
    if (name === "TextObject") return parseTextObject(c, layerDp, ctx);
    if (name === "ImageObject") return parseImageObject(c, ctx);
    if (name === "CompositeObject")
      return {
        type: "composite",
        resourceId: attr(c, "ResourceID"),
        ctm: parseMatrix(attr(c, "CTM")),
        boundary: parseBox(attr(c, "Boundary")),
        drawParam: attr(c, "DrawParam") || layerDp,
        clips: parseClips(c, ctx)
      };
    return null;
  }
  function parseLayer(layerEl, layerDp, ctx) {
    const drawParam = attr(layerEl, "DrawParam") || layerDp;
    const objects = [];
    for (const c of layerEl.children) {
      const obj = parseObjectEl(c, drawParam, ctx);
      if (obj) objects.push(obj);
    }
    return { drawParam, objects };
  }
  async function parseCompositeUnits(resPath, zip, ctx) {
    ctx = normalizeCtx(ctx);
    const units = {};
    const xmlText = await readEntryText(zip, resPath);
    if (!xmlText) return units;
    const root = parseXml(xmlText).documentElement;
    const list = child(root, "CompositeGraphicUnits");
    if (!list) return units;
    for (const u of children(list, "CompositeGraphicUnit")) {
      const layers = [];
      for (const content of children(u, "Content")) {
        const layerEls = children(content, "Layer");
        if (layerEls.length) {
          for (const l of layerEls) layers.push(parseLayer(l, void 0, ctx));
          const direct = parseLayer(content, void 0, ctx);
          if (direct.objects.length) layers.push(direct);
        } else {
          layers.push(parseLayer(content, void 0, ctx));
        }
      }
      const boundary = attr(u, "Boundary") ? parseBox(attr(u, "Boundary")) : { x: 0, y: 0, w: num(u, "Width", 0), h: num(u, "Height", 0) };
      units[attr(u, "ID")] = { boundary, layers };
    }
    return units;
  }
  function parseGradient(el, res, defaultCs) {
    if (!el) return null;
    const ax = child(el, "AxialShd");
    const rad = child(el, "RadialShd");
    const g = ax || rad;
    if (!g) return null;
    const nums = (s) => (s || "").trim().split(/\s+/).map(parseFloat).filter((n) => !isNaN(n));
    const readStops = (name) => children(g, name).map((seg) => {
      let pos = parseFloat(
        attr(seg, "Position") != null ? attr(seg, "Position") : attr(seg, "Offset")
      );
      if (isNaN(pos)) pos = null;
      const colorEl = child(seg, "Color") || seg;
      return { pos, color: parseColor(colorEl, res, defaultCs) };
    });
    let stops = readStops("Segment");
    if (!stops.length) stops = readStops("Stop");
    if (stops.some((s) => s.pos === null)) {
      const n = stops.length || 1;
      stops = stops.map((s, i) => ({ pos: s.pos === null ? i / (n - 1 || 1) : s.pos, color: s.color }));
    }
    return {
      kind: ax ? "axial" : "radial",
      extend: attr(g, "Extend") || "",
      start: nums(attr(g, "StartPoint")),
      end: nums(attr(g, "EndPoint")),
      stops
    };
  }
  function parsePathObject(el, layerDp, ctx) {
    ctx = normalizeCtx(ctx);
    const fillEl = child(el, "FillColor");
    const strokeEl = child(el, "StrokeColor");
    const abbr = child(el, "AbbreviatedData");
    const fillGrad = parseGradient(fillEl, ctx.res, ctx.defaultCs);
    const strokeGrad = parseGradient(strokeEl, ctx.res, ctx.defaultCs);
    return {
      type: "path",
      id: attr(el, "ID"),
      boundary: parseBox(attr(el, "Boundary")),
      ctm: parseMatrix(attr(el, "CTM")),
      lineWidth: num(el, "LineWidth", null),
      dash: attr(el, "DashPattern") || null,
      stroke: bool(el, "Stroke", true),
      fill: bool(el, "Fill", false),
      fillColor: fillGrad ? null : fillEl ? parseColor(fillEl, ctx.res, ctx.defaultCs) : null,
      fillGradient: fillGrad,
      strokeColor: strokeGrad ? null : strokeEl ? parseColor(strokeEl, ctx.res, ctx.defaultCs) : null,
      strokeGradient: strokeGrad,
      abbreviatedData: abbr ? text(abbr) : "",
      rule: attr(el, "Rule"),
      drawParam: attr(el, "DrawParam") || layerDp,
      clips: parseClips(el, ctx)
    };
  }
  function parseGlyphMap(el) {
    const segments = [];
    for (const cg of children(el, "CGTransform")) {
      const g = child(cg, "Glyphs");
      if (!g) continue;
      const raw = (g.text || "").trim();
      if (!raw) continue;
      const gids = raw.split(/\s+/).map(Number);
      if (!gids.length || gids.some((n) => !Number.isFinite(n))) continue;
      const cp = +attr(cg, "CodePosition");
      const cc = +attr(cg, "CodeCount");
      segments.push({
        codePosition: Number.isFinite(cp) && cp >= 0 ? cp : 0,
        codeCount: Number.isFinite(cc) && cc > 0 ? Math.min(cc, 1e6) : gids.length,
        glyphs: gids
      });
    }
    if (!segments.length) return null;
    const map = [];
    for (const seg of segments) {
      for (let j = 0; j < seg.codeCount; j++) {
        const gid = seg.glyphs[Math.min(j, seg.glyphs.length - 1)];
        map[seg.codePosition + j] = gid;
      }
    }
    return map;
  }
  function parseTextObject(el, layerDp, ctx) {
    ctx = normalizeCtx(ctx);
    const fillEl = child(el, "FillColor");
    const strokeEl = child(el, "StrokeColor");
    const textCodes = children(el, "TextCode").map((tc) => ({
      x: num(tc, "X", 0),
      y: num(tc, "Y", 0),
      deltaX: attr(tc, "DeltaX"),
      deltaY: attr(tc, "DeltaY"),
      // 仅剥离 XML 缩进产生的换行空白；保留行内首尾空格字形（它们按 DeltaX 占位，
      // 若误删会导致后续字符合并到窄间距重叠，整段文字挤成一团）
      text: (tc.text || "").replace(/^\s*\n[\s ]*/, "").replace(/[\s ]*\n\s*$/, "")
    }));
    let codeOffset = 0;
    for (const tc of textCodes) {
      tc.codeStart = codeOffset;
      codeOffset += Array.from(tc.text).length;
    }
    const glyphMap = parseGlyphMap(el);
    return {
      type: "text",
      id: attr(el, "ID"),
      boundary: parseBox(attr(el, "Boundary")),
      ctm: parseMatrix(attr(el, "CTM")),
      fontId: attr(el, "Font"),
      size: num(el, "Size", null),
      readDirection: num(el, "ReadDirection", 0),
      charDirection: num(el, "CharDirection", 0),
      hScale: num(el, "HScale", 1),
      lineWidth: num(el, "LineWidth", null),
      weight: num(el, "Weight", 400),
      italic: bool(el, "Italic", false),
      stroke: bool(el, "Stroke", false),
      fill: bool(el, "Fill", true),
      fillColor: fillEl ? parseColor(fillEl, ctx.res, ctx.defaultCs) : { r: 0, g: 0, b: 0, a: 1 },
      strokeColor: strokeEl ? parseColor(strokeEl, ctx.res, ctx.defaultCs) : null,
      textCodes,
      // 全文逐字字形索引；null 表示未提供 Glyphs
      glyphMap,
      drawParam: attr(el, "DrawParam") || layerDp,
      clips: parseClips(el, ctx)
    };
  }
  function parseImageObject(el, ctx) {
    return {
      type: "image",
      boundary: parseBox(attr(el, "Boundary")),
      ctm: parseMatrix(attr(el, "CTM")),
      resourceId: attr(el, "ResourceID"),
      clips: parseClips(el, ctx)
    };
  }
  async function parsePage(pagePath, zip, ctx) {
    ctx = normalizeCtx(ctx);
    const xmlText = await readEntryText(zip, pagePath);
    if (!xmlText) return { pagePath, pageBox: null, templates: [], layers: [] };
    const root = parseXml(xmlText).documentElement;
    const area = child(root, "Area");
    let pageBox = null;
    if (area) {
      const box = child(area, "PhysicalBox");
      if (box) pageBox = parseBox(text(box));
    }
    const templates = children(root, "Template").map((t) => ({
      templateId: attr(t, "TemplateID"),
      zOrder: attr(t, "ZOrder") || "Background"
    }));
    const content = child(root, "Content");
    const layers = content ? children(content, "Layer").map((l) => parseLayer(l, void 0, ctx)) : [];
    return { pagePath, pageBox, templates, layers };
  }
  async function parseSealOfd(sealZipBytes) {
    try {
      const sealZip = await readZip(sealZipBytes);
      const ofdXmlText = await readEntryText(sealZip, "OFD.xml");
      if (!ofdXmlText) return null;
      const ofdRoot = parseXml(ofdXmlText).documentElement;
      const version = attr(ofdRoot, "Version") || "";
      const docBody = child(ofdRoot, "DocBody");
      if (!docBody) return null;
      const docEle = child(docBody, "DocRoot");
      if (!docEle) return null;
      const docPath = text(docEle);
      const docXmlText = await readEntryText(sealZip, docPath);
      if (!docXmlText) return null;
      const docRoot = parseXml(docXmlText).documentElement;
      let res = {
        fonts: {},
        colorSpaces: {},
        multiMedias: {},
        drawParams: {},
        compositeUnits: {}
      };
      const commonDataEl = child(docRoot, "CommonData");
      const defaultCs = commonDataEl ? text(child(commonDataEl, "DefaultCS")) : "";
      if (commonDataEl) {
        const publicResEl = child(commonDataEl, "PublicRes");
        if (publicResEl) {
          const publicResPath = resolvePath(docPath, text(publicResEl));
          res = await parseRes(publicResPath, sealZip, defaultCs);
        }
      }
      const pagesEl = child(docRoot, "Pages");
      if (!pagesEl) return null;
      const pageEl = child(pagesEl, "Page");
      if (!pageEl) return null;
      const pageBaseLoc = attr(pageEl, "BaseLoc");
      if (!pageBaseLoc) return null;
      const pagePath = resolvePath(docPath, pageBaseLoc);
      const page = await parsePage(pagePath, sealZip, {
        version,
        res,
        defaultCs: null
      });
      return { page, res, pagePath };
    } catch (e) {
      console.warn("parseSealOfd error:", e);
      return null;
    }
  }

  // ofd/core/verify.js
  var import_sm_crypto = __toESM(require_src());

  // ofd/core/seal.js
  function extractSealPicture(bytes) {
    if (!bytes || bytes.length < 10) return null;
    const targets = [
      { type: "ofd", bytes: [111, 102, 100] },
      // "ofd"
      { type: "png", bytes: [112, 110, 103] }
      // "png"
    ];
    for (const target of targets) {
      for (let i = 0; i < bytes.length - target.bytes.length; i++) {
        let match = true;
        for (let j = 0; j < target.bytes.length; j++) {
          if (bytes[i + j] !== target.bytes[j]) {
            match = false;
            break;
          }
        }
        if (!match) continue;
        let strTagOffset = -1;
        let strContentStart = -1;
        let strContentLen = -1;
        if (i >= 2 && (bytes[i - 2] === 12 || bytes[i - 2] === 22) && bytes[i - 1] === target.bytes.length) {
          strTagOffset = i - 2;
          strContentStart = i;
          strContentLen = target.bytes.length;
        }
        if (strTagOffset < 0 && i >= 4 && (bytes[i - 4] === 12 || bytes[i - 4] === 22) && bytes[i - 3] === 130) {
          const len = bytes[i - 2] << 8 | bytes[i - 1];
          if (len === target.bytes.length) {
            strTagOffset = i - 4;
            strContentStart = i;
            strContentLen = target.bytes.length;
          }
        }
        if (strTagOffset < 0) continue;
        let octOffset = strContentStart + strContentLen;
        while (octOffset < bytes.length && bytes[octOffset] !== 4)
          octOffset++;
        if (octOffset >= bytes.length) continue;
        octOffset++;
        let octLen, octHeaderLen;
        if (bytes[octOffset] < 128) {
          octLen = bytes[octOffset];
          octHeaderLen = 1;
        } else {
          const numBytes = bytes[octOffset] & 127;
          if (numBytes < 1 || numBytes > 4) continue;
          octLen = 0;
          for (let j = 1; j <= numBytes; j++) {
            octLen = octLen << 8 | bytes[octOffset + j];
          }
          octHeaderLen = 1 + numBytes;
        }
        const octDataStart = octOffset + octHeaderLen;
        if (octDataStart + octLen > bytes.length) continue;
        const octData = bytes.subarray(octDataStart, octDataStart + octLen);
        if (target.type === "ofd") {
          if (octData[0] === 80 && octData[1] === 75) {
            return { type: "ofd", data: octData };
          }
        } else if (target.type === "png") {
          if (octData[0] === 137 && octData[1] === 80) {
            return { type: "png", data: octData };
          }
        }
      }
    }
    return extractSealImageFallback(bytes);
  }
  function extractSealImageFallback(bytes) {
    if (!bytes || bytes.length < 8) return null;
    for (let i = 0; i <= bytes.length - 8; i++) {
      if (bytes[i] === 137 && bytes[i + 1] === 80 && bytes[i + 2] === 78 && bytes[i + 3] === 71) {
        for (let j = bytes.length - 8; j >= i + 4; j--) {
          if (bytes[j] === 73 && bytes[j + 1] === 69 && bytes[j + 2] === 78 && bytes[j + 3] === 68) {
            return { type: "png", data: bytes.subarray(i, j + 8) };
          }
        }
      }
    }
    for (let i = 0; i <= bytes.length - 4; i++) {
      if (bytes[i] === 255 && bytes[i + 1] === 216 && bytes[i + 2] === 255) {
        for (let j = bytes.length - 2; j >= i + 3; j--) {
          if (bytes[j] === 255 && bytes[j + 1] === 217) {
            return { type: "jpeg", data: bytes.subarray(i, j + 2) };
          }
        }
      }
    }
    return null;
  }
  function extractSealName(bytes) {
    if (!bytes || bytes.length < 10) return null;
    let bestStr = null;
    let bestLen = 0;
    for (let i = 0; i < bytes.length - 3; i++) {
      if (bytes[i] !== 12) continue;
      let lenByte = bytes[i + 1];
      let contentLen, headerLen;
      if (lenByte < 128) {
        contentLen = lenByte;
        headerLen = 1;
      } else {
        const numBytes = lenByte & 127;
        if (numBytes < 1 || numBytes > 4) continue;
        contentLen = 0;
        for (let j = 1; j <= numBytes; j++) {
          contentLen = contentLen << 8 | bytes[i + 1 + j];
        }
        headerLen = 1 + numBytes;
      }
      if (contentLen < 4 || contentLen > 500) continue;
      const contentStart = i + 1 + headerLen;
      if (contentStart + contentLen > bytes.length) continue;
      const strBytes = bytes.subarray(contentStart, contentStart + contentLen);
      try {
        const str = new TextDecoder("utf-8", { fatal: true }).decode(strBytes);
        if (/[\u4e00-\u9fff]/.test(str) && str.length > bestLen) {
          bestStr = str;
          bestLen = str.length;
        }
      } catch (e) {
      }
    }
    return bestStr;
  }
  function asn1LenAt(bytes, p) {
    const lb = bytes[p];
    if (lb < 128) return { len: lb, next: p + 1 };
    const n = lb & 127;
    let len = 0;
    for (let k = 1; k <= n; k++) len = len << 8 | bytes[p + k];
    return { len, next: p + 1 + n };
  }
  function oidDotStr(raw) {
    if (!raw || !raw.length) return "";
    const first = raw[0];
    const parts = [String(Math.floor(first / 40)), String(first % 40)];
    let val = 0;
    for (let k = 1; k < raw.length; k++) {
      val = val << 7 | raw[k] & 127;
      if (!(raw[k] & 128)) {
        parts.push(String(val));
        val = 0;
      }
    }
    return parts.join(".");
  }
  function decodeAscii(n) {
    try {
      return new TextDecoder("ascii").decode(n.content);
    } catch (e) {
      return "";
    }
  }
  function dirStrAt(bytes, p) {
    const tag = bytes[p];
    let t = asn1LenAt(bytes, p + 1);
    const raw = bytes.subarray(t.next, t.next + t.len);
    try {
      if (tag === 12) return new TextDecoder("utf-8").decode(raw);
      if (tag === 19) return new TextDecoder("ascii").decode(raw);
      if (tag === 20) return new TextDecoder("latin1").decode(raw);
      if (tag === 30) return new TextDecoder("utf-16be").decode(raw);
    } catch (e) {
      console.warn("[OFD] ASN.1 目录字符串解码失败", e);
    }
    return null;
  }
  function certSubjectAttrs(cert) {
    let p = 1;
    let t = asn1LenAt(cert, p);
    if (cert[t.next] === 48) {
      t = asn1LenAt(cert, t.next + 1);
    }
    p = t.next;
    if ((cert[p] & 224) === 160) {
      t = asn1LenAt(cert, p + 1);
      p = t.next + t.len;
    }
    if (cert[p] === 2) {
      t = asn1LenAt(cert, p + 1);
      p = t.next + t.len;
    }
    if (cert[p] === 48 || cert[p] === 6) {
      t = asn1LenAt(cert, p + 1);
      p = t.next + t.len;
    }
    if (cert[p] === 48) {
      t = asn1LenAt(cert, p + 1);
      p = t.next + t.len;
    }
    if (cert[p] === 48) {
      t = asn1LenAt(cert, p + 1);
      p = t.next + t.len;
    }
    if (cert[p] !== 48) return null;
    t = asn1LenAt(cert, p + 1);
    const end = t.next + t.len;
    let q = t.next;
    const attrs = [];
    while (q < end) {
      if (cert[q] !== 49) {
        q++;
        continue;
      }
      const s = asn1LenAt(cert, q + 1);
      let r = s.next;
      const sEnd = s.next + s.len;
      while (r < sEnd) {
        if (cert[r] === 48) {
          const a = asn1LenAt(cert, r + 1);
          const aEnd = a.next + a.len;
          let m = a.next;
          if (cert[m] === 6) {
            const o = asn1LenAt(cert, m + 1);
            const oid = oidDotStr(cert.subarray(o.next, o.next + o.len));
            const v = dirStrAt(cert, o.next + o.len);
            if (v) attrs.push({ oid, value: v });
          }
          r = aEnd;
        } else r++;
      }
      q = sEnd;
    }
    return attrs;
  }
  function collectCerts(bytes) {
    const certs = [];
    const scan = (buf) => {
      let i = 0;
      const n = buf.length;
      while (i < n - 4) {
        if (buf[i] !== 48) {
          i++;
          continue;
        }
        const lb = buf[i + 1];
        let len, h;
        if (lb < 128) {
          len = lb;
          h = 2;
        } else if (lb === 129) {
          len = buf[i + 2];
          h = 3;
        } else if (lb === 130) {
          len = buf[i + 2] << 8 | buf[i + 3];
          h = 4;
        } else {
          i++;
          continue;
        }
        if (len > 200 && len < 2e4 && i + h + len <= n && buf[i + h] === 48) {
          certs.push(buf.subarray(i, i + h + len));
          i = i + h + len;
          continue;
        }
        i++;
      }
    };
    (function walkTLV(buf) {
      let i = 0;
      const n = buf.length;
      while (i < n) {
        const tag = buf[i];
        const t = asn1LenAt(buf, i + 1);
        if (!t.len && t.next <= i + 1) {
          i++;
          continue;
        }
        const start = t.next;
        const seg = buf.subarray(start, start + t.len);
        if (tag === 48 || tag === 49 || (tag & 224) === 160) walkTLV(seg);
        else if (tag === 4) scan(seg);
        i = start + t.len;
      }
    })(bytes);
    return certs;
  }

  // ofd/core/asn1.js
  function extractSignerName(bytes, sealName) {
    if (!bytes || bytes.length < 20) return null;
    let certs;
    try {
      certs = collectCerts(bytes);
    } catch (e) {
      return null;
    }
    const CN_OID = "2.5.4.3", O_OID = "2.5.4.10";
    for (const cert of certs) {
      let attrs;
      try {
        attrs = certSubjectAttrs(cert);
      } catch (e) {
        continue;
      }
      if (!attrs || !attrs.length) continue;
      const cn = attrs.find((a) => a.oid === CN_OID);
      const o = attrs.find((a) => a.oid === O_OID);
      const s = cn && cn.value || o && o.value || "";
      if (!s) continue;
      if (sealName && (s === sealName || s.indexOf(sealName) >= 0 || sealName.indexOf(s) >= 0))
        continue;
      if (/监制章/.test(s)) continue;
      return s;
    }
    return null;
  }
  function extractSignatureValue(bytes) {
    if (!bytes || bytes.length < 70) return "";
    for (let i = 0; i < bytes.length - 69; i++) {
      if (bytes[i] !== 48) continue;
      const len = bytes[i + 1];
      if (len < 64 || len > 72) continue;
      if (bytes[i + 2] !== 2 || bytes[i + 3] !== 32) continue;
      if (bytes[i + 36] !== 2 || bytes[i + 37] !== 32) continue;
      const total = 2 + len;
      if (i + total > bytes.length) continue;
      let hex = "";
      for (let j = i; j < i + total; j++)
        hex += ("0" + bytes[j].toString(16)).slice(-2);
      return hex.toUpperCase();
    }
    return "";
  }
  function parseTlvTree(data) {
    let pos = 0;
    function readLen() {
      const lb = data[pos++];
      if (lb < 128) return lb;
      const n = lb & 127;
      if (n < 1 || n > 4) return 0;
      let l = 0;
      for (let i = 0; i < n; i++) l = l << 8 | data[pos++];
      return l;
    }
    function readNode() {
      if (pos >= data.length) return null;
      const nodeOff = pos;
      const tag = data[pos++];
      const len = readLen();
      const start = pos;
      const content = data.subarray(start, start + len);
      const node = {
        tag,
        len,
        content,
        children: [],
        parent: null,
        off: nodeOff,
        derLen: start - nodeOff + len
      };
      const isContainer = tag === 48 || tag === 49 || (tag & 224) === 160;
      if (isContainer) {
        pos = start;
        const childEnd = start + len;
        while (pos < childEnd) {
          const child2 = readNode();
          if (!child2) break;
          child2.parent = node;
          node.children.push(child2);
        }
        pos = childEnd;
      } else {
        pos = start + len;
      }
      return node;
    }
    return readNode();
  }
  function extractCertValidity(derBytes) {
    let found = null;
    (function walk(node) {
      if (!node || found) return;
      if (node.tag === 48 && node.children.length === 2 && node.children.every((c) => c.tag === 23 || c.tag === 24)) {
        found = node.children.map(decodeAscii);
        return;
      }
      for (const c of node.children) walk(c);
    })(parseTlvTree(derBytes));
    return found ? { notBefore: found[0], notAfter: found[1] } : null;
  }
  function parseSesSignBlocks(data) {
    const out = [];
    (function walk(node) {
      if (!node) return;
      const ch = node.children;
      for (let k = 2; k < ch.length - 1; k++) {
        if (ch[k].tag === 6 && ch[k + 1].tag === 3 && ch[k - 1].tag === 4 && (ch[k - 2].tag === 48 || ch[k - 2].tag === 49)) {
          out.push({ tbs: ch[k - 2], cert: ch[k - 1], alg: ch[k], sig: ch[k + 1] });
        }
      }
      for (const c of ch) walk(c);
    })(parseTlvTree(data));
    return out;
  }
  function extractCertPublicKey(derBytes) {
    const root = parseTlvTree(derBytes);
    const tbs = root && root.children[0];
    if (!tbs) return "";
    for (const c of tbs.children) {
      if (c.tag !== 48 || c.children.length < 2) continue;
      const algId = c.children[0];
      const bits = c.children[1];
      if (algId.tag !== 48 || bits.tag !== 3) continue;
      if (bits.len !== 66 && bits.len !== 65) continue;
      const skip = bits.len === 66 ? 1 : 0;
      const pt = bits.content.subarray(skip, skip + 65);
      if (pt.length === 65 && pt[0] === 4) {
        let hex = "";
        for (let i = 0; i < pt.length; i++) hex += ("0" + pt[i].toString(16)).slice(-2);
        return hex;
      }
    }
    return "";
  }
  function asn1TimeToMs(str) {
    const d = String(str || "").replace(/[^0-9]/g, "");
    if (d.length < 10) return NaN;
    const short = d.length <= 12;
    const yy = Number(d.slice(0, short ? 2 : 4));
    const year = short ? yy < 50 ? 2e3 + yy : 1900 + yy : yy;
    const off = short ? 2 : 4;
    const month = Number(d.slice(off, off + 2)) - 1;
    const day = Number(d.slice(off + 2, off + 4));
    const hour = Number(d.slice(off + 4, off + 6));
    const min = Number(d.slice(off + 6, off + 8));
    const sec = Number(d.slice(off + 8, off + 10)) || 0;
    if ([month, day, hour, min].some((v) => !isFinite(v))) return NaN;
    return Date.UTC(year, month, day, hour, min, sec);
  }
  function asn1IntToStr(content) {
    if (!content || !content.length) return "";
    let hex = "";
    for (let i = 0; i < content.length; i++)
      hex += ("0" + content[i].toString(16)).slice(-2);
    return BigInt("0x" + hex).toString();
  }
  function extractSealAttrs(bytes) {
    if (!bytes || bytes.length < 10) return null;
    let root = null;
    try {
      root = parseTlvTree(bytes);
    } catch (e) {
      return null;
    }
    if (!root) return null;
    let sealInfoSeq = null, sealSeqRef = null;
    const fallbackInts = [], fallbackGtimes = [];
    let fallbackNameNode = null, fallbackNameLen = 0;
    function isIa5(n, val) {
      return n && (n.tag === 22 || n.tag === 19) && n.content && (() => {
        try {
          return new TextDecoder("ascii").decode(n.content) === val;
        } catch (e) {
          return false;
        }
      })();
    }
    function decodeUtf8(n) {
      try {
        return new TextDecoder("utf-8").decode(n.content);
      } catch (e) {
        return "";
      }
    }
    (function walk(node) {
      if (sealInfoSeq && fallbackInts.length && fallbackGtimes.length && fallbackNameNode)
        return;
      if (!node.children) {
        if (node.tag === 2) fallbackInts.push(node);
        else if (node.tag === 24 || node.tag === 23) {
          const s = decodeAscii(node);
          if (s) fallbackGtimes.push(s);
        } else if (node.tag === 12) {
          const s = decodeUtf8(node);
          if (s && /[\u4e00-\u9fff]/.test(s) && s.length > fallbackNameLen) {
            fallbackNameNode = node;
            fallbackNameLen = s.length;
          }
        }
        return;
      }
      if (node.tag === 48 && node.children.length >= 3 && isIa5(node.children[0], "ES") && node.children[1].tag === 2) {
        const sealSeq = node.parent;
        if (sealSeq && sealSeq.tag === 48 && sealSeq.children.length >= 3) {
          const candidate = sealSeq.children[2];
          if (candidate && candidate.tag === 48 && candidate.children && candidate.children.length >= 2) {
            sealInfoSeq = candidate;
            sealSeqRef = sealSeq;
          }
        }
      }
      for (const c of node.children) walk(c);
      if (!sealInfoSeq && node.tag === 4 && node.content && node.content.length > 10) {
        try {
          const t = parseTlvTree(node.content);
          if (t) walk(t);
        } catch (e) {
          console.warn("[OFD] 电子印章 OCTET_STRING 嵌套解析失败", e);
        }
      }
    })(root);
    const attrs = {};
    if (sealInfoSeq) {
      if (sealSeqRef && sealSeqRef.children.length >= 2) {
        const idNode = sealSeqRef.children[1];
        if (idNode && (idNode.tag === 22 || idNode.tag === 19))
          attrs.id = decodeAscii(idNode);
      }
      const ic = sealInfoSeq.children;
      if (ic.length >= 2) {
        if (ic[0].tag === 2) attrs.type = asn1IntToStr(ic[0].content);
        if (ic[1].tag === 12) attrs.name = decodeUtf8(ic[1]);
      }
      const gtimes = ic.filter((c) => c.tag === 24).map(decodeAscii);
      if (gtimes.length) attrs.createTime = gtimes[0];
      if (gtimes.length > 1) attrs.notBefore = gtimes[1];
      if (gtimes.length > 2) attrs.notAfter = gtimes[2];
    }
    if (!attrs.id && fallbackInts.length)
      attrs.id = asn1IntToStr(fallbackInts[0].content);
    if (!attrs.name && fallbackNameNode) {
      attrs.name = decodeUtf8(fallbackNameNode);
      if (!attrs.type) {
        const container = fallbackNameNode.parent;
        if (container) {
          const intChild = container.children.find((c) => c.tag === 2);
          if (intChild) attrs.type = asn1IntToStr(intChild.content);
        }
      }
    }
    if (!attrs.createTime && fallbackGtimes.length)
      attrs.createTime = fallbackGtimes[0];
    if (!attrs.notBefore && fallbackGtimes.length > 1)
      attrs.notBefore = fallbackGtimes[1];
    if (!attrs.notAfter && fallbackGtimes.length > 2)
      attrs.notAfter = fallbackGtimes[2];
    return attrs;
  }
  function oidName(oid) {
    const map = {
      "1.2.156.10197.1.401": "SM3",
      "1.2.156.10197.1.501": "SM2-SM3（签名）",
      "1.2.156.10197.1.301": "SM2（公钥）",
      "1.2.156.10197.1.302": "SM2-SM3（签名）",
      "1.2.840.113549.1.1.1": "RSA",
      "1.2.840.113549.1.1.11": "SHA256-RSA",
      "1.2.840.113549.1.1.13": "SHA512-RSA",
      "2.16.840.1.101.3.4.2.1": "SHA-256",
      "1.3.14.3.2.26": "SHA-1"
    };
    return map[oid] || oid;
  }

  // ofd/core/verify.js
  function checkPeriods(sig) {
    const out = { sealPeriod: "unknown", certPeriod: "unknown" };
    const t = asn1TimeToMs(sig.signTime);
    if (!isFinite(t)) return out;
    const a = sig.sealAttrs;
    if (a && (a.notBefore || a.notAfter)) {
      const nb = a.notBefore ? asn1TimeToMs(a.notBefore) : -Infinity;
      const na = a.notAfter ? asn1TimeToMs(a.notAfter) : Infinity;
      out.sealPeriod = t >= nb && t <= na ? "pass" : "fail";
    }
    const certs = sig.certValidity || [];
    if (certs.length) {
      const covered = certs.every((c) => {
        const nb = c.notBefore ? asn1TimeToMs(c.notBefore) : -Infinity;
        const na = c.notAfter ? asn1TimeToMs(c.notAfter) : Infinity;
        return t >= nb && t <= na;
      });
      out.certPeriod = covered ? "pass" : "fail";
    }
    return out;
  }
  async function verifySigValue(ofd, sig) {
    if (!sig.signedValuePath)
      return { state: "unknown", message: "缺少签名值路径" };
    const svPath = resolvePath(
      String(sig.signaturePath || "").replace(/^\//, ""),
      sig.signedValuePath
    );
    const raw = await readEntry(ofd.zip, svPath);
    if (!raw) return { state: "unknown", message: "签名值文件缺失" };
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    const blocks = parseSesSignBlocks(bytes);
    if (!blocks.length)
      return { state: "unknown", message: "未找到 SES 签名块（非 GB/T 38540 结构）" };
    let tried = 0;
    for (const b of blocks) {
      const algOid = oidDotStr(b.alg.content);
      if (algOid !== "1.2.156.10197.1.501")
        return { state: "unknown", message: "签名算法暂不支持：" + algOid };
      const pub = extractCertPublicKey(b.cert.content);
      if (!pub) continue;
      const sigBytes = b.sig.content.subarray(1);
      let hex = "";
      for (let i = 0; i < sigBytes.length; i++)
        hex += ("0" + sigBytes[i].toString(16)).slice(-2);
      const tbs = bytes.subarray(b.tbs.off, b.tbs.off + b.tbs.derLen);
      tried++;
      try {
        if (import_sm_crypto.sm2.doVerifySignature(tbs, hex, pub, {
          der: true,
          input: "array"
        }))
          return { state: "pass", message: "签名值验证通过" };
      } catch (e) {
        return { state: "unknown", message: "SM2 验签异常：" + e.message };
      }
    }
    if (!tried) return { state: "unknown", message: "签名数据中未取得可用公钥" };
    return { state: "fail", message: "签名值验证失败（签章数据可能被篡改）" };
  }
  async function verifySignature(ofd, index) {
    const doc = ofd.document;
    const sig = doc.signatures && doc.signatures[index];
    if (!sig)
      return { valid: false, status: "unknown", message: "未找到该签名" };
    if (!sig.references || sig.references.length === 0) {
      return {
        valid: false,
        status: "unknown",
        message: "签名未包含摘要引用（References）数据，无法验证"
      };
    }
    const checked = [];
    const failed = [];
    for (const ref of sig.references) {
      if (!ref.fileRef || !ref.checkValue) continue;
      const data = await readEntry(ofd.zip, ref.fileRef.replace(/^\//, ""));
      if (!data) {
        failed.push(ref.fileRef + "（文件缺失）");
        continue;
      }
      let digest;
      try {
        digest = await hashBytes(data, sig.checkMethod);
      } catch (e) {
        return {
          valid: false,
          status: "unknown",
          message: "摘要算法暂不支持：" + (sig.checkMethod || "未知") + "，无法验证"
        };
      }
      const expected = base64ToBytes(ref.checkValue);
      if (digestMatches(digest, expected)) checked.push(ref.fileRef);
      else failed.push(ref.fileRef + "（摘要不一致）");
    }
    const sv = await verifySigValue(ofd, sig);
    const periods = checkPeriods(sig);
    const checks = {
      digest: failed.length ? "fail" : checked.length ? "pass" : "unknown",
      sigValue: sv.state,
      sealPeriod: periods.sealPeriod,
      certPeriod: periods.certPeriod
    };
    const rejected = [];
    if (sv.state === "fail") rejected.push(sv.message);
    if (periods.sealPeriod === "fail")
      rejected.push("印章有效期不覆盖签名时间");
    if (periods.certPeriod === "fail")
      rejected.push("证书有效期不覆盖签名时间");
    if (failed.length) {
      return {
        valid: false,
        status: "invalid",
        message: "验证失败：" + failed.join("；"),
        digestValid: false,
        checked,
        failed,
        checks
      };
    }
    if (!checked.length) {
      return {
        valid: false,
        status: "unknown",
        message: "没有可验证的摘要数据",
        digestValid: false,
        checked,
        failed,
        checks
      };
    }
    if (rejected.length) {
      return {
        valid: false,
        status: "invalid",
        message: "摘要一致，但" + rejected.join("、") + "（" + checked.length + " 个文件摘要校验一致）",
        digestValid: true,
        checked,
        failed,
        checks
      };
    }
    if (sv.state !== "pass") {
      return {
        valid: false,
        status: "partial",
        message: "摘要校验通过（" + checked.length + " 个文件），但签名值未验证：" + (sv.message || "无可用签名值数据"),
        digestValid: true,
        checked,
        failed,
        checks
      };
    }
    const skipped = [];
    if (periods.sealPeriod === "unknown") skipped.push("印章有效期");
    if (periods.certPeriod === "unknown") skipped.push("证书有效期");
    return {
      valid: true,
      status: "valid",
      message: "验证通过：" + checked.length + " 个文件摘要校验一致" + (skipped.length ? "；" + skipped.join("、") + "无数据，未校验" : ""),
      digestValid: true,
      checked,
      failed,
      checks
    };
  }

  // ofd/core/annotation.js
  function parseAppearance(appearance, ctx) {
    const boundary = parseBox(attr(appearance, "Boundary"));
    const dp = attr(appearance, "DrawParam") || null;
    const objects = [];
    const walk = (el) => {
      for (const c of el.children) {
        const name = stripNs(c.tag);
        if (name === "Layer" || name === "Content") {
          walk(c);
          continue;
        }
        const obj = parseObjectEl(c, dp, ctx);
        if (obj) objects.push(obj);
      }
    };
    walk(appearance);
    return {
      boundary,
      objects,
      blendMode: attr(appearance, "BlendMode") || "Normal"
    };
  }
  async function parseAnnotations(annotationsPath, zip, ctx) {
    ctx = ctx || {};
    const stamps = [];
    const annotsXmlText = await readEntryText(zip, annotationsPath);
    if (!annotsXmlText) return stamps;
    const annotsRoot = parseXml(annotsXmlText).documentElement;
    for (const pa of children(annotsRoot, "Page")) {
      const pageId = attr(pa, "PageID");
      const fileLocEl = child(pa, "FileLoc");
      const fileLoc = fileLocEl ? text(fileLocEl) : attr(pa, "FileLoc");
      if (!fileLoc) continue;
      const annotPath = resolvePath(annotationsPath, fileLoc);
      const annotXmlText = await readEntryText(zip, annotPath);
      if (!annotXmlText) continue;
      const annotRoot = parseXml(annotXmlText).documentElement;
      for (const annot of children(annotRoot, "Annot")) {
        if (!bool(annot, "Visible", true)) continue;
        const type = attr(annot, "Type");
        const subtype = attr(annot, "Subtype") || type;
        const appearance = child(annot, "Appearance");
        const app = appearance ? parseAppearance(appearance, ctx) : null;
        if (type === "Stamp") {
          if (subtype === "SignatureInFile") continue;
          if (app && app.objects.length) {
            stamps.push({
              pageRef: pageId,
              boundary: app.boundary,
              annotType: subtype,
              objects: app.objects,
              blendMode: app.blendMode,
              isAnnot: true
            });
          } else if (appearance) {
            stamps.push({
              pageRef: pageId,
              boundary: app.boundary,
              clip: null,
              sealDataUrl: null,
              isPlaceholder: true
            });
          }
          continue;
        }
        const params = {};
        const paramsEl = child(annot, "Parameters");
        if (paramsEl)
          for (const p of children(paramsEl, "Parameter")) {
            const name = attr(p, "Name");
            if (name) params[name] = text(p);
          }
        if (type === "Link") {
          let url = "";
          for (const k in params)
            if (k.toLowerCase() === "url" && params[k]) url = params[k];
          if (app && (app.objects.length || url)) {
            stamps.push({
              pageRef: pageId,
              boundary: app.boundary,
              annotType: "Link",
              objects: app.objects,
              blendMode: app.blendMode,
              linkUrl: url,
              isAnnot: true
            });
          }
          continue;
        }
        if (app && app.objects.length) {
          stamps.push({
            pageRef: pageId,
            boundary: app.boundary,
            annotType: subtype,
            objects: app.objects,
            blendMode: app.blendMode,
            isAnnot: true
          });
        }
      }
    }
    return stamps;
  }

  // ofd/core/outline.js
  function parseOutline(outlinesEl, pages) {
    if (!outlinesEl) return [];
    function collectChildItems(parent) {
      let items = children(parent, "OutlineElem");
      if (items.length) return items;
      return children(parent, "OutlineItem");
    }
    const pageMap = /* @__PURE__ */ new Map();
    pages.forEach((p, idx) => {
      pageMap.set(String(p.id || ""), idx);
    });
    function resolvePageIndex(id) {
      if (id == null || id === "") return null;
      const s = String(id);
      if (pageMap.has(s)) return pageMap.get(s);
      const n = Number(s);
      if (isFinite(n) && n >= 1 && n <= pages.length) return Math.floor(n) - 1;
      for (const [k, v] of pageMap) {
        if (k.toLowerCase() === s.toLowerCase()) return v;
      }
      return null;
    }
    function extractDest(item) {
      let pageId = attr(item, "PageID") || attr(item, "BookmarkPageID") || attr(item, "PageRef") || attr(item, "DestPage");
      let x = null, y = null;
      const actions = child(item, "Actions");
      if (actions) {
        for (const action of children(actions, "Action")) {
          const goto = child(action, "Goto");
          if (!goto) continue;
          const dest = child(goto, "Dest");
          if (dest) {
            const pid = attr(dest, "PageID");
            if (pid) pageId = pid;
            const dx = attr(dest, "Left");
            const dy = attr(dest, "Top");
            if (dx != null && dx !== "") x = parseFloat(dx);
            if (dy != null && dy !== "") y = parseFloat(dy);
          }
        }
      }
      return { pageId, x, y };
    }
    function extractItems(items) {
      const result = [];
      for (const item of items) {
        let title = attr(item, "Title");
        if (title == null || title === "") title = text(child(item, "Title"));
        if (!title) title = attr(item, "Name") || "(无标题)";
        const { pageId, x, y } = extractDest(item);
        const pageIndex = resolvePageIndex(pageId);
        const out = {
          title,
          page: pageIndex,
          dest: x != null && y != null ? { x, y } : null,
          children: []
        };
        const subItems = collectChildItems(item);
        if (subItems.length) {
          out.children = extractItems(subItems);
        }
        result.push(out);
      }
      return result;
    }
    return extractItems(collectChildItems(outlinesEl));
  }
  function parseOutlineFromXml(xmlText, pages) {
    const root = parseXml(xmlText).documentElement;
    const outlinesEl = child(root, "Outlines");
    return parseOutline(outlinesEl || root, pages);
  }

  // ofd/core/signature.js
  async function parseSignatures(signaturesPath, zip) {
    const stamps = [];
    const signatures = [];
    const sigsXmlText = await readEntryText(zip, signaturesPath);
    if (!sigsXmlText) return { stamps, signatures };
    const sigsRoot = parseXml(sigsXmlText).documentElement;
    for (const sig of children(sigsRoot, "Signature")) {
      const sigBaseLoc = attr(sig, "BaseLoc");
      if (!sigBaseLoc) continue;
      const sigPath = resolvePath(signaturesPath, sigBaseLoc);
      const sigXmlText = await readEntryText(zip, sigPath);
      if (!sigXmlText) continue;
      const sigRoot = parseXml(sigXmlText).documentElement;
      const signedInfo = child(sigRoot, "SignedInfo");
      let provider = "";
      let providerVersion = "";
      let signTime = "";
      let checkMethod = "";
      let signatureMethod = "";
      const references = [];
      if (signedInfo) {
        const providerEl = child(signedInfo, "Provider");
        if (providerEl) {
          provider = attr(providerEl, "ProviderName") || text(child(providerEl, "ProviderName")) || attr(providerEl, "Company") || "";
          providerVersion = attr(providerEl, "Version") || "";
        }
        signatureMethod = text(child(signedInfo, "SignatureMethod")) || "";
        signTime = text(child(signedInfo, "SignatureDateTime")) || "";
        const refsEl = child(signedInfo, "References");
        if (refsEl) {
          checkMethod = attr(refsEl, "CheckMethod") || "";
          for (const ref of children(refsEl, "Reference")) {
            references.push({
              fileRef: attr(ref, "FileRef") || "",
              checkValue: text(child(ref, "CheckValue")) || ""
            });
          }
        }
      }
      let signatureDigest = "";
      const sigRaw = await readEntry(zip, sigPath);
      if (sigRaw) {
        try {
          const d = await hashBytes(sigRaw, "SM3");
          let hex = "";
          for (let i = 0; i < d.length; i++)
            hex += ("0" + d[i].toString(16)).slice(-2);
          signatureDigest = hex;
        } catch (e) {
          signatureDigest = "";
        }
      }
      let sealDataUrl = null;
      let sealOfd = null;
      const sealEl = signedInfo ? child(signedInfo, "Seal") : null;
      if (sealEl) {
        const sealBaseLoc = text(child(sealEl, "BaseLoc"));
        if (sealBaseLoc) {
          const sealPath = resolvePath(sigPath, sealBaseLoc);
          const sealBytes = await readEntry(zip, sealPath);
          if (sealBytes) {
            const pic = extractSealPicture(sealBytes);
            if (pic) {
              if (pic.type === "png") {
                sealDataUrl = "data:image/png;base64," + bytesToBase64(pic.data);
              } else if (pic.type === "jpeg") {
                sealDataUrl = "data:image/jpeg;base64," + bytesToBase64(pic.data);
              } else if (pic.type === "ofd") {
                sealOfd = await parseSealOfd(pic.data);
              }
            }
          }
        }
      }
      let signedValuePath = "";
      let svBytes = null;
      const signedValue = child(sigRoot, "SignedValue");
      if (signedValue) {
        signedValuePath = text(signedValue);
        if (signedValuePath)
          svBytes = await readEntry(zip, resolvePath(sigPath, signedValuePath));
      }
      if (!sealDataUrl && !sealOfd && svBytes) {
        const pic = extractSealPicture(svBytes);
        if (pic) {
          if (pic.type === "png") {
            sealDataUrl = "data:image/png;base64," + bytesToBase64(pic.data);
          } else if (pic.type === "jpeg") {
            sealDataUrl = "data:image/jpeg;base64," + bytesToBase64(pic.data);
          } else if (pic.type === "ofd") {
            sealOfd = await parseSealOfd(pic.data);
          }
        }
      }
      let sealName = null;
      let signerName = null;
      if (svBytes) {
        sealName = extractSealName(svBytes);
        signerName = extractSignerName(svBytes, sealName);
      }
      const signatureValueHex = svBytes ? extractSignatureValue(svBytes) : "";
      if ((!signTime || !signatureMethod) && svBytes) {
        try {
          const svTree = parseTlvTree(svBytes);
          const tsRe = /^\d{14}Z$/;
          const signAlgRe = /^(1\.2\.156\.10197\.1\.501|1\.2\.840\.113549\.1\.1\.\d+|1\.2\.840\.10045\.4\.3)$/;
          (function find2(node) {
            if ((!signTime || !signatureMethod) && node.children) {
              for (const c of node.children) find2(c);
            }
            if (!signTime && (node.tag === 23 || node.tag === 24)) {
              const s = decodeAscii(node);
              if (tsRe.test(s)) signTime = s;
            }
            if (!signTime && node.tag === 4 && node.content && node.content.length >= 14 && node.content.length <= 20) {
              const s = decodeAscii(node);
              if (tsRe.test(s.trim())) signTime = s.trim();
            }
            if (!signatureMethod && node.tag === 6) {
              const oid = oidDotStr(node.content);
              if (signAlgRe.test(oid)) signatureMethod = oid;
            }
          })(svTree);
          if (!signTime || !signatureMethod) {
            (function findInOctets(node) {
              if ((!signTime || !signatureMethod) && node.children) {
                for (const c of node.children) findInOctets(c);
              }
              if (node.tag === 4 && node.content && node.content.length > 10) {
                try {
                  const inner = parseTlvTree(node.content);
                  if (inner) find(inner);
                } catch (e) {
                  console.warn("[OFD] 签名 SignedValue 嵌套解析失败", e);
                }
              }
            })(svTree);
          }
        } catch (e) {
        }
      }
      const pageRefs = [];
      const positions = [];
      if (signedInfo) {
        for (const sa of children(signedInfo, "StampAnnot")) {
          const pageRef = attr(sa, "PageRef");
          const boundary = parseBox(attr(sa, "Boundary"));
          const clip = attr(sa, "Clip") ? parseBox(attr(sa, "Clip")) : null;
          stamps.push({
            pageRef,
            boundary,
            clip,
            sealDataUrl,
            sealName,
            sealOfd
          });
          if (pageRef && pageRefs.indexOf(pageRef) < 0) pageRefs.push(pageRef);
          if (pageRef && boundary) positions.push({ pageRef, boundary });
        }
      }
      const sealAttrs = svBytes ? extractSealAttrs(svBytes) : null;
      const certValidity = svBytes ? collectCerts(svBytes).map(extractCertValidity).filter(Boolean) : [];
      signatures.push({
        id: attr(sig, "ID") || "",
        signer: signerName || sealName || provider || "",
        signTime,
        provider,
        providerVersion,
        checkMethod,
        signatureMethod,
        sealDataUrl,
        sealOfd,
        pages: pageRefs,
        positions,
        references,
        signedValuePath,
        signedValueSize: svBytes ? svBytes.length : 0,
        signaturePath: "/" + sigPath,
        signatureDigest,
        signatureValueHex,
        sealAttrs,
        certValidity,
        hasSignedValue: !!(svBytes && svBytes.length)
      });
    }
    return { stamps, signatures };
  }

  // ofd/display/font.js
  var FONT_VARIANT_SUFFIX = [
    "BoldItalic",
    "Bold",
    "Italic",
    "Black",
    "Heavy",
    "ExtraBold",
    "SemiBold",
    "DemiBold",
    "Medium",
    "Regular",
    "Book",
    "Light"
  ];
  var FONT_VARIANT_RE = new RegExp(
    "^(.*?)[-\\s]+(" + FONT_VARIANT_SUFFIX.join("|") + ")$",
    "i"
  );
  var FONT_WEIGHT_MAP = {
    bold: "700",
    black: "900",
    heavy: "900",
    extrabold: "800",
    semibold: "600",
    demibold: "600",
    medium: "500",
    light: "300",
    regular: "normal",
    book: "normal"
  };
  function splitFontVariant(fontName) {
    if (!fontName) return { base: fontName, weight: "", style: "" };
    const m = fontName.match(FONT_VARIANT_RE);
    if (!m) return { base: fontName, weight: "", style: "" };
    const suf = m[2].toLowerCase();
    return {
      base: m[1],
      weight: FONT_WEIGHT_MAP[suf] || "",
      style: suf === "italic" || suf === "bolditalic" ? "italic" : "normal"
    };
  }
  function cssFontName(name) {
    return String(name).replace(/["\\]/g, "");
  }
  var BUILTIN_FONT_EXACT = [
    [/dengxian|等线/, '"DengXian","等线",sans-serif'],
    [/yahei|微软雅黑/, '"Microsoft YaHei","微软雅黑",sans-serif'],
    [/pingfang|苹方/, '"PingFang SC","苹方",sans-serif'],
    [
      /source han sans|sourcehansans|noto sans|notosans|思源黑体|鸿蒙|harmonyos/,
      '"Source Han Sans SC","Noto Sans CJK SC","HarmonyOS Sans SC","思源黑体",sans-serif'
    ],
    [
      /source han serif|sourcehanserif|noto serif|notoserif|思源宋体/,
      '"Source Han Serif SC","Noto Serif CJK SC","思源宋体",serif'
    ]
  ];
  function builtinFontStack(fontName) {
    if (!fontName) return "sans-serif";
    const n = fontName.toLowerCase();
    for (let i = 0; i < BUILTIN_FONT_EXACT.length; i++) {
      if (BUILTIN_FONT_EXACT[i][0].test(n)) return BUILTIN_FONT_EXACT[i][1];
    }
    if (fontName.includes("仿") || n === "fangsong" || n.includes("fang"))
      return '"仿宋",FangSong,"STFangsong",serif';
    if (fontName.includes("宋") || n === "simsun" || n.includes("song"))
      return '"宋体",SimSun,"Songti SC",serif';
    if (fontName.includes("楷") || n === "kaiti" || n.includes("kai"))
      return '"楷体",KaiTi,"STKaiti",serif';
    if (fontName.includes("黑") || n === "simhei" || n.includes("hei"))
      return '"黑体",SimHei,"Heiti SC",sans-serif';
    if (fontName.includes("隶")) return '"隶书","LiSu",serif';
    if (fontName.includes("行")) return '"行楷","Xingkai SC",cursive';
    if (n.includes("courier")) return '"Courier New",Courier,monospace';
    if (n.includes("times")) return '"Times New Roman",serif';
    if (n.includes("arial") || n.includes("helvetica"))
      return "Arial,Helvetica,sans-serif";
    return null;
  }
  var localFontCache = /* @__PURE__ */ new Map();
  function localFontAvailable(fontName) {
    if (!fontName || typeof document === "undefined" || !document.fonts || !document.fonts.check)
      return false;
    if (localFontCache.has(fontName)) return localFontCache.get(fontName);
    let ok = false;
    try {
      ok = document.fonts.check('16px "' + cssFontName(fontName) + '"');
    } catch (e) {
      console.warn("[OFD] 检查本地字体可用性失败", e);
    }
    localFontCache.set(fontName, ok);
    return ok;
  }
  function hasEmbeddedFont(fontName, fontId) {
    if (!fontName || !embeddedFontMap.size) return false;
    const base = splitFontVariant(fontName).base || fontName;
    if (fontId) {
      if (embeddedFontMap.has("ofdf_" + fontId + "_" + base)) return true;
      if (embeddedFontMap.has("ofdf_" + fontId + "_" + fontName)) return true;
    }
    if (embeddedFontMap.has(base)) return true;
    if (embeddedFontMap.has(fontName)) return true;
    const lower = base.toLowerCase();
    for (const k of embeddedFontMap.keys()) {
      const kl = k.toLowerCase();
      if (kl === lower || kl.startsWith(lower + "-") || lower.startsWith(kl + "-")) return true;
    }
    return false;
  }
  function mapFontFamily(fontName, fontId) {
    const v = splitFontVariant(fontName);
    const base = v.base || fontName;
    const familyName = uniqueFamily(fontId, base);
    if ((hasEmbeddedFont(fontName, fontId) || hasEmbeddedFont(base, fontId)) && embeddedLoaded.has(familyName)) {
      return { family: '"' + cssFontName(familyName) + '",sans-serif', weight: v.weight, style: v.style, embedded: true, key: familyName };
    }
    let family = builtinFontStack(base) || builtinFontStack(fontName);
    if (!family && localFontAvailable(base))
      family = '"' + cssFontName(base) + '",sans-serif';
    if (!family) {
      ensureFontLoaded(familyName, fontId);
      family = '"' + cssFontName(familyName) + '",sans-serif';
    }
    return { family, weight: v.weight, style: v.style, embedded: false, key: familyName };
  }
  var fontBase = "";
  var FONT_EXTS = ["ttf", "otf", "woff2"];
  var fontLoadCache = /* @__PURE__ */ new Map();
  var embeddedFontMap = /* @__PURE__ */ new Map();
  var embeddedLoaded = /* @__PURE__ */ new Set();
  function uniqueFamily(fontId, fontName) {
    return fontId ? "ofdf_" + fontId + "_" + (fontName || "unknown") : fontName;
  }
  function resolveFontBase() {
    if (fontBase) return fontBase;
    if (typeof document === "undefined") return "font/";
    const scripts = document.getElementsByTagName("script");
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src || "";
      if (/\/ofd(\.min)?\.js(\?|#|$)/.test(src)) {
        const dir = src.slice(0, src.lastIndexOf("/") + 1);
        const m = /^(.*\/)?build\/(?:ofd\/)?$/.exec(dir);
        fontBase = (m ? m[1] || "" : dir.replace(/[^/]*\/$/, "")) + "font/";
        return fontBase;
      }
    }
    return "font/";
  }
  function ensureFontLoaded(familyName, fontId) {
    if (!familyName) return Promise.resolve(false);
    if (fontLoadCache.has(familyName)) return fontLoadCache.get(familyName);
    const p = loadFontFace(familyName, fontId).then(
      (ok) => {
        if (ok) embeddedLoaded.add(familyName);
        return ok;
      },
      () => false
    );
    fontLoadCache.set(familyName, p);
    return p;
  }
  var fontCmapCache = /* @__PURE__ */ new Map();
  function parseSfntCmap(buf) {
    const map = /* @__PURE__ */ new Map();
    try {
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      if (dv.byteLength < 12) return map;
      const numTables = dv.getUint16(4);
      let cmapOff = -1, cmapLen = 0;
      for (let i = 0; i < numTables; i++) {
        const o = 12 + i * 16;
        const tag = String.fromCharCode(
          dv.getUint8(o),
          dv.getUint8(o + 1),
          dv.getUint8(o + 2),
          dv.getUint8(o + 3)
        );
        if (tag === "cmap") {
          cmapOff = dv.getUint32(o + 8);
          cmapLen = dv.getUint32(o + 12);
          break;
        }
      }
      if (cmapOff < 0 || cmapLen < 4) return map;
      const n = dv.getUint16(cmapOff + 2);
      let best = -1, bestScore = -1;
      for (let i = 0; i < n; i++) {
        const r = cmapOff + 4 + i * 8;
        const pid = dv.getUint16(r), eid = dv.getUint16(r + 2);
        const off = dv.getUint32(r + 4);
        let score = 0;
        if (pid === 3 && eid === 10) score = 5;
        else if (pid === 3 && eid === 1) score = 4;
        else if (pid === 0) score = 3;
        else if (pid === 3 && eid === 0) score = 1;
        if (score > bestScore) {
          bestScore = score;
          best = cmapOff + off;
        }
      }
      if (best < 0) return map;
      const fmt = dv.getUint16(best);
      if (fmt === 4) {
        const segX2 = dv.getUint16(best + 6), seg = segX2 >> 1;
        const endO = best + 14, startO = endO + segX2 + 2;
        const deltaO = startO + segX2, rangeO = deltaO + segX2;
        for (let s = 0; s < seg; s++) {
          const end = dv.getUint16(endO + s * 2);
          const start = dv.getUint16(startO + s * 2);
          const delta = dv.getInt16(deltaO + s * 2);
          const ro = dv.getUint16(rangeO + s * 2);
          if (start === 65535) continue;
          for (let c = start; c <= end && c !== 65536; c++) {
            let g;
            if (ro === 0) g = c + delta & 65535;
            else {
              const gi = rangeO + s * 2 + ro + (c - start) * 2;
              if (gi + 1 >= dv.byteLength) continue;
              g = dv.getUint16(gi);
              if (g !== 0) g = g + delta & 65535;
            }
            if (g) map.set(c, g);
          }
        }
      } else if (fmt === 12) {
        const nGroups = dv.getUint32(best + 12);
        for (let i = 0; i < nGroups; i++) {
          const o = best + 16 + i * 12;
          const sc = dv.getUint32(o), ec = dv.getUint32(o + 4), sg = dv.getUint32(o + 8);
          for (let c = sc; c <= ec; c++) map.set(c, sg + (c - sc));
        }
      }
    } catch (e) {
    }
    return map;
  }
  function cacheFontCmap(fontName, bytes) {
    if (!fontName || !bytes || fontCmapCache.has(fontName)) return;
    try {
      fontCmapCache.set(fontName, parseSfntCmap(bytes));
    } catch (e) {
      fontCmapCache.set(fontName, /* @__PURE__ */ new Map());
    }
  }
  function hasGlyphFor(fontName, codePoint) {
    const cm = fontCmapCache.get(fontName);
    if (!cm) return true;
    if (!cm.size) return true;
    return cm.has(codePoint);
  }
  async function loadFontFace(familyName, fontId) {
    if (typeof FontFace === "undefined" || typeof document === "undefined" || !document.fonts)
      return false;
    let emb = null;
    if (fontId && familyName) {
      const m = /^ofdf_[^_]+_(.+)$/.exec(familyName);
      const rawName = m ? m[1] : familyName;
      emb = embeddedFontMap.get(familyName) || embeddedFontMap.get(rawName) || null;
    }
    if (!emb && familyName) {
      const m = /^ofdf_[^_]+_(.+)$/.exec(familyName);
      const rawName = m ? m[1] : familyName;
      emb = embeddedFontMap.get(familyName) || embeddedFontMap.get(rawName) || null;
      if (!emb) {
        const lower = rawName.toLowerCase();
        for (const [k, v] of embeddedFontMap) {
          const kl = k.toLowerCase();
          if (kl === lower || kl.startsWith(lower + "-") || lower.startsWith(kl + "-")) {
            emb = v;
            break;
          }
        }
      }
    }
    if (emb && emb._zip && emb.fontFile) {
      try {
        const fontPath = resolvePath(emb.baseDir + "/_.x", emb.fontFile);
        const bytes = await readEntry(emb._zip, fontPath);
        if (bytes) {
          const face = new FontFace(familyName, bytes);
          await face.load();
          document.fonts.add(face);
          cacheFontCmap(familyName, bytes);
          return true;
        }
      } catch (e) {
        console.warn("[OFD] 加载内嵌字体失败：" + familyName, e);
      }
    }
    const index = await fetchFontIndex();
    let loaded = false;
    if (index) {
      const rawName = /^ofdf_[^_]+_(.+)$/.exec(familyName);
      const lookupName = rawName ? rawName[1] : familyName;
      for (const ext of FONT_EXTS) {
        const file = lookupName + "." + ext;
        if (index.indexOf(file) === -1) continue;
        const url = resolveFontBase() + encodeURIComponent(lookupName) + "." + ext;
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const ab = await res.arrayBuffer();
          const face = new FontFace(familyName, ab);
          await face.load();
          document.fonts.add(face);
          cacheFontCmap(familyName, new Uint8Array(ab));
          loaded = true;
          break;
        } catch (e) {
          console.warn("[OFD] 加载字体文件失败：" + url, e);
        }
      }
    }
    if (!loaded) {
      const m = /^ofdf_[^_]+_(.+)$/.exec(familyName);
      const base = m ? m[1] : familyName;
      if (!(builtinFontStack(base) || builtinFontStack(familyName) || localFontAvailable(base))) {
        console.warn('[OFD] 未找到字体 "' + familyName + '"，且无系统映射，回退 sans-serif');
      }
    }
    return loaded;
  }
  var fontIndexCache = null;
  function resetFontCaches() {
    embeddedFontMap.clear();
    embeddedLoaded.clear();
    fontLoadCache.clear();
    fontCmapCache.clear();
    fontIndexCache = null;
    if (typeof document !== "undefined" && document.fonts) {
      try {
        const stale = [];
        document.fonts.forEach((face) => {
          if (face && face.family && /^ofdf_/.test(face.family))
            stale.push(face);
        });
        for (const face of stale) document.fonts.delete(face);
      } catch (e) {
      }
    }
  }
  function fetchFontIndex() {
    if (fontIndexCache) return fontIndexCache;
    fontIndexCache = fetch(resolveFontBase()).then((res) => {
      if (!res.ok) return null;
      return res.text();
    }).then((html) => {
      if (!html) return null;
      const names = [];
      const re = /href="([^"]+)"/g;
      let m;
      while (m = re.exec(html))
        names.push(decodeURIComponent(m[1].split(/[?#]/)[0]));
      return names;
    }).catch(() => null);
    return fontIndexCache;
  }
  function registerEmbeddedFonts(fonts) {
    if (!fonts) return;
    for (const key in fonts) {
      const f = fonts[key];
      if (!f || !f.fontFile || !f._zip) continue;
      const name = f.fontName || f.familyName;
      if (!name) continue;
      const entry = {
        fontFile: f.fontFile,
        baseDir: f.fontBaseDir || "",
        _zip: f._zip
      };
      const base = splitFontVariant(name).base || name;
      const uniqBase = uniqueFamily(key, base);
      if (!embeddedFontMap.has(uniqBase)) embeddedFontMap.set(uniqBase, entry);
      const uniqRaw = uniqueFamily(key, name);
      if (!embeddedFontMap.has(uniqRaw)) embeddedFontMap.set(uniqRaw, entry);
      if (!embeddedFontMap.has(base)) embeddedFontMap.set(base, entry);
      if (!embeddedFontMap.has(name)) embeddedFontMap.set(name, entry);
    }
  }
  function setFontBase(base) {
    fontBase = base || "";
  }

  // ofd/shared/util.js
  var _profiling = false;
  var _marks = [];
  var _lastProfile = null;
  function mark(label, tag) {
    if (!_profiling) return;
    _marks.push({ label, tag: tag || "", t: performance.now() });
  }
  function flushProfile(title, tag) {
    const tagFilter = tag || "";
    const my = tagFilter ? _marks.filter((m) => m.tag === tagFilter) : _marks;
    const rows = [];
    for (let i = 0; i < my.length; i++) {
      const cur = my[i];
      const prev = i > 0 ? my[i - 1] : null;
      rows.push({
        阶段: cur.label,
        增量ms: +(cur.t - (prev ? prev.t : cur.t)).toFixed(1),
        累计ms: +(cur.t - my[0].t).toFixed(1)
      });
    }
    const name = title ? "[" + title + "] " : "";
    if (typeof console !== "undefined" && console.table) {
      console.log("%c" + name + "耗时打点", "color:#4B3FE3;font-weight:bold");
      console.table(rows);
    }
    _lastProfile = { title: title || "", rows };
    if (tagFilter) _marks = _marks.filter((m) => m.tag !== tagFilter);
    else _marks = [];
    return rows;
  }
  function setProfiling(on) {
    _profiling = !!on;
    _marks = [];
    if (!on) _lastProfile = null;
  }
  function getLastProfile() {
    return _lastProfile;
  }

  // ofd/core/document.js
  async function parseDocument(zip) {
    mark("解析 OFD.xml", "load");
    const ofdXmlText = await readEntryText(zip, "OFD.xml");
    if (!ofdXmlText) throw new Error("OFD.xml 不存在");
    const ofdRoot = parseXml(ofdXmlText).documentElement;
    const version = attr(ofdRoot, "Version") || "";
    const docBody = child(ofdRoot, "DocBody");
    const docInfo = child(docBody, "DocInfo");
    const info = {
      docId: "",
      author: "",
      title: "",
      subject: "",
      creator: "",
      producer: "",
      creationDate: "",
      modDate: "",
      customDatas: {}
    };
    if (docInfo) {
      info.docId = text(child(docInfo, "DocID"));
      info.author = text(child(docInfo, "Author"));
      info.title = text(child(docInfo, "Title"));
      info.subject = text(child(docInfo, "Subject"));
      info.creator = text(child(docInfo, "Creator"));
      info.creationDate = text(child(docInfo, "CreationDate"));
      info.modDate = text(child(docInfo, "ModDate"));
      const cd = child(docInfo, "CustomDatas");
      if (cd)
        for (const c of children(cd, "CustomData")) {
          info.customDatas[attr(c, "Name") || (c.text || "").trim()] = (c.text || "").trim();
        }
    }
    const docRootEl = child(docBody, "DocRoot");
    const docPath = resolvePath("OFD.xml", text(docRootEl));
    const docXmlText = await readEntryText(zip, docPath);
    if (!docXmlText) throw new Error("Document.xml 不存在: " + docPath);
    const docRoot = parseXml(docXmlText).documentElement;
    mark("解析 Document.xml", "load");
    const common = child(docRoot, "CommonData");
    const pageArea = child(common, "PageArea");
    const physBox = child(pageArea, "PhysicalBox");
    const pageBox = parseBox(text(physBox));
    const defaultCs = common ? text(child(common, "DefaultCS")) : "";
    const templates = children(common, "TemplatePage").map((tp) => ({
      id: attr(tp, "ID"),
      baseLoc: resolvePath(docPath, attr(tp, "BaseLoc")),
      _parsed: null
    }));
    const templateById = new Map(templates.map((t) => [t.id, t]));
    const res = {
      fonts: {},
      colorSpaces: {},
      multiMedias: {},
      drawParams: {},
      compositeUnits: {}
    };
    const publicRes = child(common, "PublicRes");
    const documentRes = child(common, "DocumentRes");
    let pubResPath = null;
    let docResPath = null;
    if (publicRes) {
      pubResPath = resolvePath(docPath, text(publicRes));
      mergeRes(res, await parseRes(pubResPath, zip, defaultCs));
    }
    if (documentRes) {
      docResPath = resolvePath(docPath, text(documentRes));
      mergeRes(res, await parseRes(docResPath, zip, defaultCs));
    }
    const allCompositeUnits = {};
    const parseCtx = { version, res, defaultCs };
    if (pubResPath)
      Object.assign(
        allCompositeUnits,
        await parseCompositeUnits(pubResPath, zip, parseCtx)
      );
    if (docResPath)
      Object.assign(
        allCompositeUnits,
        await parseCompositeUnits(docResPath, zip, parseCtx)
      );
    res.compositeUnits = allCompositeUnits;
    resetFontCaches();
    for (const id in res.fonts) {
      const f = res.fonts[id];
      if (f.fontFile && f.fontName && !embeddedFontMap.has(f.fontName)) {
        embeddedFontMap.set(f.fontName, {
          fontFile: f.fontFile,
          baseDir: f.fontBaseDir,
          _zip: f._zip
        });
      }
    }
    mark("解析资源/预载图像", "load");
    const pagesEl = child(docRoot, "Pages");
    const pages = pagesEl ? children(pagesEl, "Page").map((p) => ({
      id: attr(p, "ID"),
      baseLoc: resolvePath(docPath, attr(p, "BaseLoc")),
      _parsed: null
    })) : [];
    let stamps = [];
    let signatures = [];
    const signaturesEl = child(docBody, "Signatures");
    if (signaturesEl) {
      const signaturesPath = resolvePath("OFD.xml", text(signaturesEl));
      try {
        const sr = await parseSignatures(signaturesPath, zip);
        stamps.push(...sr.stamps);
        signatures.push(...sr.signatures);
      } catch (e) {
        console.warn("[OFD] 解析签名文件失败：" + signaturesPath, e);
      }
    }
    const annotationsEl = child(docRoot, "Annotations");
    if (annotationsEl) {
      const annotationsPath = resolvePath(docPath, text(annotationsEl));
      try {
        stamps.push(
          ...await parseAnnotations(annotationsPath, zip, {
            version,
            res,
            defaultCs
          })
        );
      } catch (e) {
        console.warn("[OFD] 解析批注文件失败：" + annotationsPath, e);
      }
    }
    let outlines = [];
    const embeddedOutlinesEl = child(docRoot, "Outlines");
    if (embeddedOutlinesEl) {
      outlines = parseOutline(embeddedOutlinesEl, pages);
    } else {
      const outlinePath = resolvePath(docPath, "Document_Structure.xml");
      try {
        const outlineText = await readEntryText(zip, outlinePath);
        if (outlineText) outlines = parseOutlineFromXml(outlineText, pages);
      } catch (e) {
        console.warn("[OFD] 解析目录大纲失败：" + outlinePath, e);
      }
    }
    mark("解析签名/印章/目录", "load");
    if (_profiling) flushProfile("OFD 加载", "load");
    return {
      info,
      document: {
        docPath,
        version,
        defaultCs,
        pageBox,
        templates,
        templateById,
        pages,
        res,
        stamps,
        signatures,
        outlines
      },
      zip
    };
  }
  async function parseOFD(zip) {
    return parseDocument(zip);
  }

  // ofd/core/image.js
  var TIFF_TYPE_SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];
  var TIFF_MAX_PIXELS = 32 * 1e3 * 1e3;
  var TIFF_MAX_BMP_BYTES = 160 * 1024 * 1024;
  function parseTiffTags(bytes) {
    const le = bytes[0] === 73 && bytes[1] === 73;
    const u16 = (o) => le ? bytes[o] | bytes[o + 1] << 8 : bytes[o] << 8 | bytes[o + 1];
    const u32 = (o) => le ? bytes[o] | bytes[o + 1] << 8 | bytes[o + 2] << 16 | bytes[o + 3] << 24 : bytes[o] << 24 | bytes[o + 1] << 16 | bytes[o + 2] << 8 | bytes[o + 3];
    if (bytes.length < 8 || u16(2) !== 42) return null;
    const ifd = u32(4);
    if (ifd + 2 > bytes.length) return null;
    const cnt = u16(ifd);
    const tags = {};
    for (let i = 0; i < cnt; i++) {
      const eo = ifd + 2 + i * 12;
      if (eo + 12 > bytes.length) break;
      const tag = u16(eo), type = u16(eo + 2), c = u32(eo + 4);
      const tsz = TIFF_TYPE_SIZE[type] || 1;
      const off = tsz * c <= 4 ? eo + 8 : u32(eo + 8);
      const vals = [];
      if (type === 1 || type === 7) {
        for (let j = 0; j < c && off + j < bytes.length; j++)
          vals.push(bytes[off + j]);
      } else if (type === 3) {
        for (let j = 0; j < c && off + j * 2 + 1 < bytes.length; j++)
          vals.push(u16(off + j * 2));
      } else if (type === 4) {
        for (let j = 0; j < c && off + j * 4 + 3 < bytes.length; j++)
          vals.push(u32(off + j * 4));
      }
      tags[tag] = { vals, count: c };
    }
    return tags;
  }
  function tiffLzwDecode(data, maxOut) {
    const out = [];
    const dict = new Array(4096);
    let bitPos = 0, codeWidth = 9, next = 258, prev = null;
    for (; ; ) {
      if (bitPos + codeWidth > data.length * 8) break;
      let code = 0;
      for (let i = 0; i < codeWidth; i++) {
        code = code << 1 | data[bitPos + i >> 3] >> 7 - (bitPos + i & 7) & 1;
      }
      bitPos += codeWidth;
      if (code === 256) {
        next = 258;
        codeWidth = 9;
        prev = null;
        continue;
      }
      if (code === 257) break;
      let entry;
      if (code <= 255) entry = [code];
      else if (code < next) entry = dict[code];
      else if (code === next && prev) entry = prev.concat(prev[0]);
      else break;
      for (let j = 0; j < entry.length; j++) {
        if (maxOut && out.length >= maxOut) return null;
        out.push(entry[j]);
      }
      if (prev) {
        dict[next++] = prev.concat(entry[0]);
        if (codeWidth === 9 && next >= 511) codeWidth = 10;
        else if (codeWidth === 10 && next >= 1023) codeWidth = 11;
        else if (codeWidth === 11 && next >= 2047) codeWidth = 12;
      }
      prev = entry;
    }
    return out;
  }
  function tiffToBmpDataUrl(bytes) {
    const tags = parseTiffTags(bytes);
    if (!tags) return null;
    const w = Math.floor(tags[256] ? tags[256].vals[0] : 0);
    const h = Math.floor(tags[257] ? tags[257].vals[0] : 0);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0)
      return null;
    if (w * h > TIFF_MAX_PIXELS) {
      console.warn(
        "[OFD] TIFF 尺寸过大，已跳过解码：" + w + "x" + h + " 像素"
      );
      return null;
    }
    const bps = tags[258] ? tags[258].vals : [8];
    if (bps.some((b) => b !== 8)) return null;
    const spp = Math.floor(tags[277] ? tags[277].vals[0] : bps.length);
    if (!Number.isInteger(spp) || spp < 1 || spp > 4) return null;
    const comp = tags[259] ? tags[259].vals[0] : 1;
    if (comp !== 1 && comp !== 5) return null;
    const photo = tags[262] ? tags[262].vals[0] : 1;
    const planar = tags[284] ? tags[284].vals[0] : 1;
    if (planar !== 1) return null;
    let rowsPerStrip = Math.floor(
      tags[278] ? tags[278].vals[0] : h
    );
    if (!Number.isInteger(rowsPerStrip) || rowsPerStrip <= 0)
      rowsPerStrip = h;
    const offsets = tags[273] ? tags[273].vals : [];
    const counts = tags[279] ? tags[279].vals : [];
    if (!offsets.length || !counts.length) return null;
    const predictor = tags[317] ? tags[317].vals[0] : 1;
    const cmap = photo === 3 && tags[320] && tags[320].vals.length >= 768 ? tags[320].vals : null;
    const rowBytes = w * spp;
    const rowSize = Math.floor((w * 24 + 31) / 32) * 4;
    const dataSize = rowSize * h;
    if (54 + dataSize > TIFF_MAX_BMP_BYTES) {
      console.warn(
        "[OFD] TIFF 解码后体积过大，已跳过：" + (54 + dataSize) + " 字节"
      );
      return null;
    }
    const rgb = new Uint8Array(w * h * 3);
    const stripCount = Math.min(offsets.length, counts.length);
    for (let s = 0; s < stripCount; s++) {
      const rowsThis = Math.min(rowsPerStrip, h - s * rowsPerStrip);
      if (rowsThis <= 0) break;
      const off = offsets[s];
      const cnt = counts[s];
      if (off < 0 || cnt <= 0 || off + cnt > bytes.length) continue;
      const raw = bytes.subarray(off, off + cnt);
      const maxOut = rowBytes * rowsThis;
      const px = comp === 5 ? tiffLzwDecode(raw, maxOut) : Array.prototype.slice.call(raw);
      if (!px || px.length < maxOut) continue;
      if (predictor === 2) {
        for (let r = 0; r < rowsThis; r++) {
          const base = r * rowBytes;
          for (let x = 1; x < w; x++) {
            const cur = base + x * spp, prv = base + (x - 1) * spp;
            for (let c = 0; c < spp; c++)
              px[cur + c] = px[cur + c] + px[prv + c] & 255;
          }
        }
      }
      for (let r = 0; r < rowsThis; r++) {
        const y = s * rowsPerStrip + r;
        const srcOff = r * rowBytes, dstOff = y * w * 3;
        for (let x = 0; x < w; x++) {
          const p = srcOff + x * spp, d = dstOff + x * 3;
          let cr, cg, cb;
          if (photo === 2) {
            cr = px[p];
            cg = px[p + 1];
            cb = px[p + 2];
          } else if (cmap) {
            const idx = px[p];
            cr = cmap[idx];
            cg = cmap[256 + idx];
            cb = cmap[512 + idx];
          } else {
            const g = px[p];
            cr = cg = cb = g;
          }
          if (spp >= 4 && px[p + 3] < 255) {
            const a = px[p + 3] / 255;
            cr = cr * a + 255 * (1 - a);
            cg = cg * a + 255 * (1 - a);
            cb = cb * a + 255 * (1 - a);
          }
          rgb[d] = cr;
          rgb[d + 1] = cg;
          rgb[d + 2] = cb;
        }
      }
    }
    const buf = new Uint8Array(54 + dataSize);
    buf[0] = 66;
    buf[1] = 77;
    const dv = new DataView(buf.buffer);
    dv.setUint32(2, buf.length, true);
    dv.setUint32(10, 54, true);
    dv.setUint32(14, 40, true);
    dv.setInt32(18, w, true);
    dv.setInt32(22, h, true);
    dv.setUint16(26, 1, true);
    dv.setUint16(28, 24, true);
    dv.setUint32(34, dataSize, true);
    let o = 54;
    for (let y = h - 1; y >= 0; y--) {
      const srcOff = y * w * 3;
      for (let x = 0; x < w; x++) {
        buf[o++] = rgb[srcOff + x * 3 + 2];
        buf[o++] = rgb[srcOff + x * 3 + 1];
        buf[o++] = rgb[srcOff + x * 3];
      }
      o += rowSize - w * 3;
    }
    return "data:image/bmp;base64," + bytesToBase64(buf);
  }
  async function ensureImageDataUrl(mm) {
    if (!mm || !mm.mediaFile || mm.dataUrl) return mm && mm.dataUrl;
    const zip = mm._zip;
    if (!zip) return null;
    try {
      const imgPath = resolvePath(mm.baseDir + "/_.x", mm.mediaFile);
      const bytes = await readEntry(zip, imgPath);
      if (bytes) {
        const ext = (mm.mediaFile.match(/\.[^./]+$/) || [""])[0].slice(1);
        const fmt = (mm.format || ext || "").toUpperCase();
        if (fmt === "TIF" || fmt === "TIFF") {
          mm.dataUrl = tiffToBmpDataUrl(bytes);
        } else {
          const mime = fmt === "JPEG" || fmt === "JPG" ? "image/jpeg" : fmt === "BMP" ? "image/bmp" : fmt === "GIF" ? "image/gif" : "image/png";
          mm.dataUrl = "data:" + mime + ";base64," + bytesToBase64(bytes);
        }
      }
    } catch (e) {
      console.warn("[OFD] 图像资源 " + (mm.mediaFile || "") + " 解码失败", e);
    }
    return mm.dataUrl;
  }

  // ofd/display/svg.js
  var ABBR_PATH_CACHE_MAX = 4096;
  var abbrPathCache = new LRUCache(ABBR_PATH_CACHE_MAX);
  function abbreviatedToSvgPath(abbr) {
    if (!abbr) return "";
    if (abbrPathCache.has(abbr)) return abbrPathCache.get(abbr);
    const tokens = abbr.trim().split(/\s+/);
    const numRe = /^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?$/;
    let d = "";
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (!t) {
        i++;
        continue;
      }
      const cmd = t[0];
      if (cmd === "C" && t.length === 1) {
        d += "Z ";
        i++;
        continue;
      }
      if ("MLQBAS".indexOf(cmd) >= 0) {
        const svgCmd = cmd === "B" ? "C" : cmd === "S" ? "M" : cmd;
        d += svgCmd;
        i++;
        while (i < tokens.length && numRe.test(tokens[i])) {
          d += " " + tokens[i];
          i++;
        }
        d += " ";
      } else if (numRe.test(t)) {
        i++;
      } else {
        i++;
      }
    }
    d = d.trim();
    abbrPathCache.set(abbr, d);
    return d;
  }
  var DASH_TOKEN_RE = /^[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?$/;
  function safeDashPattern(value) {
    const tokens = String(value || "").trim().split(/[\s,]+/);
    if (!tokens.length || !tokens[0]) return "";
    for (const t of tokens) if (!DASH_TOKEN_RE.test(t)) return "";
    return tokens.join(" ");
  }
  var _gradSeq = 0;
  function buildGradient(gradient) {
    if (!gradient || !gradient.stops || !gradient.stops.length) return null;
    const id = "ofd-grad-" + ++_gradSeq;
    const clamp01 = (v) => v == null || isNaN(v) ? 0 : Math.max(0, Math.min(1, v));
    const stops = gradient.stops.map((s) => {
      const c = s.color || { r: 0, g: 0, b: 0, a: 1 };
      const op = c.a != null ? c.a : 1;
      return `<stop offset="${clamp01(s.pos)}" stop-color="${colorToCss({ r: c.r, g: c.g, b: c.b, a: 1 })}"${op < 1 ? ` stop-opacity="${op}"` : ""}/>`;
    }).join("");
    const spread = /repeat/i.test(gradient.extend) ? "repeat" : /reflect/i.test(gradient.extend) ? "reflect" : "pad";
    let def;
    if (gradient.kind === "axial") {
      const s = gradient.start || [], e = gradient.end || [];
      def = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${s[0] || 0}" y1="${s[1] || 0}" x2="${e[0] || 0}" y2="${e[1] || 0}" spreadMethod="${spread}">${stops}</linearGradient>`;
    } else {
      const e = gradient.end && gradient.end.length >= 3 ? gradient.end : gradient.start || [];
      def = `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${e[0] || 0}" cy="${e[1] || 0}" r="${e[2] || 0}" spreadMethod="${spread}">${stops}</radialGradient>`;
    }
    return { id, def };
  }
  var _clipSeq = 0;
  function areaToClipSvg(area, outerTransform, res) {
    const parts = [];
    const areaTf = area.ctm ? `matrix(${area.ctm.join(" ")}) ` : "";
    for (const p of area.paths || []) {
      const d = abbreviatedToSvgPath(p.abbr);
      if (!d) continue;
      let tf = outerTransform + areaTf;
      if (p.boundary && (p.boundary.x || p.boundary.y))
        tf += `translate(${p.boundary.x} ${p.boundary.y}) `;
      if (p.ctm) tf += `matrix(${p.ctm.join(" ")}) `;
      const rule = p.rule === "Even-Odd" ? ' clip-rule="evenodd"' : "";
      parts.push(
        `<path d="${d}"${rule}${tf.trim() ? ` transform="${tf.trim()}"` : ""}/>`
      );
    }
    for (const t of area.texts || []) {
      const built = buildTextObject(t, res);
      if (!built) continue;
      parts.push(
        `<g transform="${outerTransform}${areaTf}"><g transform="${built.transform}">${built.inner}</g></g>`
      );
    }
    return parts.join("");
  }
  function applyClips(inner, transform, clips, boundary, res) {
    const placed = `<g transform="${transform}">${inner}</g>`;
    if (!clips || !clips.length) return placed;
    const defs = [];
    const inside = [];
    const outside = [];
    for (const clip of clips) {
      const id = "ofd-clip-" + ++_clipSeq;
      const outer = clip.transFlag ? "" : `translate(${boundary.x} ${boundary.y}) `;
      const paths = clip.areas.map((a) => areaToClipSvg(a, outer, res)).join("");
      if (!paths) continue;
      defs.push(
        `<clipPath id="${id}" clipPathUnits="userSpaceOnUse">${paths}</clipPath>`
      );
      (clip.transFlag ? inside : outside).push(id);
    }
    if (!defs.length) return placed;
    let local = inner;
    for (const id of inside) local = `<g clip-path="url(#${id})">${local}</g>`;
    let out = `<g transform="${transform}">${local}</g>`;
    for (const id of outside) out = `<g clip-path="url(#${id})">${out}</g>`;
    return `<defs>${defs.join("")}</defs>${out}`;
  }
  var LINE_CAPS = ["butt", "round", "square"];
  var LINE_JOINS = ["miter", "round", "bevel"];
  function buildPathObject(obj, res) {
    const d = abbreviatedToSvgPath(obj.abbreviatedData);
    if (!d) return null;
    const b = obj.boundary;
    let transform = `translate(${b.x} ${b.y})`;
    if (obj.ctm) transform += ` matrix(${obj.ctm.join(" ")})`;
    const dp = obj.drawParam ? res.drawParams[obj.drawParam] : null;
    let lineWidth = obj.lineWidth != null ? obj.lineWidth : dp && dp.lineWidth != null ? dp.lineWidth : 0.7;
    if (!isFinite(lineWidth) || lineWidth < 0) lineWidth = 0.7;
    const strokeColor = obj.strokeColor || dp && dp.strokeColor || null;
    const fillColor = obj.fillColor || dp && dp.fillColor || null;
    const fillGrad = obj.fillGradient || dp && dp.fillGradient || null;
    const strokeGrad = obj.strokeGradient || dp && dp.strokeGradient || null;
    const defs = [];
    let attrs = "";
    if (obj.fill) {
      if (fillGrad) {
        const g = buildGradient(fillGrad);
        if (g) {
          attrs += ` fill="url(#${g.id})"`;
          defs.push(g.def);
        } else attrs += ' fill="none"';
      } else if (fillColor) attrs += ` fill="${colorToCss(fillColor)}"`;
      else attrs += ' fill="none"';
    } else attrs += ' fill="none"';
    if (obj.rule === "Even-Odd") attrs += ' fill-rule="evenodd"';
    if (obj.stroke) {
      if (strokeGrad) {
        const g = buildGradient(strokeGrad);
        if (g) {
          attrs += ` stroke="url(#${g.id})"`;
          defs.push(g.def);
        } else {
          attrs += ` stroke="${colorToCss(strokeColor || fillColor || { r: 0, g: 0, b: 0, a: 1 })}"`;
        }
      } else {
        attrs += ` stroke="${colorToCss(strokeColor || fillColor || { r: 0, g: 0, b: 0, a: 1 })}"`;
      }
      attrs += ` stroke-width="${lineWidth}"`;
      const dash = safeDashPattern(
        obj.dash != null && obj.dash !== "" ? obj.dash : dp && dp.dashPattern
      );
      if (dash) attrs += ` stroke-dasharray="${dash}"`;
      if (dp) {
        const cap = LINE_CAPS[+dp.cap];
        if (cap) attrs += ` stroke-linecap="${cap}"`;
        const join = LINE_JOINS[+dp.join];
        if (join) attrs += ` stroke-linejoin="${join}"`;
        if (dp.dashOffset != null && isFinite(dp.dashOffset))
          attrs += ` stroke-dashoffset="${dp.dashOffset}"`;
      }
      const miter = dp && dp.miterLimit != null && isFinite(dp.miterLimit) ? dp.miterLimit : !dp || dp.join == null || +dp.join === 0 ? 3.528 : null;
      if (miter != null) attrs += ` stroke-miterlimit="${miter}"`;
    }
    return {
      transform,
      inner: `${defs.length ? `<defs>${defs.join("")}</defs>` : ""}<path d="${d}"${attrs}/>`
    };
  }
  function buildTextObject(obj, res) {
    const font = res.fonts[obj.fontId] || {};
    const fv = mapFontFamily(font.fontName, obj.fontId);
    let hScale = obj.hScale != null ? obj.hScale : 1;
    if (!isFinite(hScale) || hScale === 0) hScale = 1;
    const bx = obj.boundary.x, by = obj.boundary.y;
    const fill = obj.fill ? colorToCss(obj.fillColor || { r: 0, g: 0, b: 0, a: 1 }) : "none";
    const weight = fv.weight || (obj.weight >= 700 ? "bold" : "normal");
    const fontStyle = fv.style || (obj.italic ? "italic" : "normal");
    const dp = obj.drawParam ? res.drawParams[obj.drawParam] : null;
    function buildTextCodeParts(tc, ox0, oy0, hScale2, readDirection, charDirection, fontName, glyphMap) {
      const txt = tc.text;
      if (!txt) return "";
      const chars = Array.from(txt);
      const dxArr = expandDelta(tc.deltaX);
      const dyArr = expandDelta(tc.deltaY);
      const codeStart = tc.codeStart || 0;
      const draw = [];
      let anySkip = false;
      for (let i = 0; i < chars.length; i++) {
        const cp = chars[i].codePointAt(0);
        let ok = true;
        if (!hasGlyphFor(fontName, cp)) {
          const gid = glyphMap ? glyphMap[codeStart + i] : void 0;
          const isPlaceholder = gid === void 0 || gid === 1;
          ok = !isPlaceholder;
        }
        draw.push(ok);
        if (!ok) anySkip = true;
      }
      const step = (i) => i < dxArr.length ? dxArr[i] : 0;
      const stepY = (i) => i < dyArr.length ? dyArr[i] : 0;
      const adj = (x) => hScale2 !== 1 ? x / hScale2 : x;
      const vertical = readDirection === 90 || readDirection === 270;
      const rot = charDirection && charDirection % 360 ? charDirection : vertical ? readDirection : 0;
      if (vertical) {
        let ox2 = ox0, oy2 = oy0;
        let s2 = "";
        for (let i = 0; i < chars.length; i++) {
          const x = adj(ox2);
          if (draw[i])
            s2 += `<tspan x="${x.toFixed(4)}" y="${oy2.toFixed(4)}"${rot ? ` transform="rotate(${rot} ${x.toFixed(4)} ${oy2.toFixed(4)})"` : ""}>${escapeXml(chars[i])}</tspan>`;
          ox2 += step(i);
          oy2 += stepY(i);
        }
        return s2;
      }
      let rtlPos = null;
      if (readDirection === 180) {
        let total = 0;
        for (let i = 0; i < chars.length; i++) total += step(i);
        rtlPos = [];
        let prefix = 0;
        for (let i = 0; i < chars.length; i++) {
          prefix += step(i);
          rtlPos.push(ox0 + total - prefix);
        }
      }
      if (!anySkip && !rot) {
        let xs = "", ys = "", ox2 = ox0, oy2 = oy0;
        for (let i = 0; i < chars.length; i++) {
          const x = rtlPos ? rtlPos[i] : ox2;
          xs += (i ? " " : "") + adj(x).toFixed(4);
          ys += (i ? " " : "") + oy2.toFixed(4);
          ox2 += step(i);
          oy2 += stepY(i);
        }
        return `<tspan x="${xs}" y="${ys}">${escapeXml(txt)}</tspan>`;
      }
      let s = "";
      let ox = ox0, oy = oy0;
      for (let i = 0; i < chars.length; i++) {
        const x = rtlPos ? rtlPos[i] : ox;
        const adjX = adj(x);
        const body = draw[i] ? escapeXml(chars[i]) : "";
        const tr = rot ? ` transform="rotate(${rot} ${adjX.toFixed(4)} ${oy.toFixed(4)})"` : "";
        s += `<tspan x="${adjX.toFixed(4)}" y="${oy.toFixed(4)}"${tr}>${body}</tspan>`;
        ox += step(i);
        oy += stepY(i);
      }
      return s;
    }
    const fontSize = obj.size != null && isFinite(obj.size) && obj.size > 0 ? obj.size : 3;
    const parts = [];
    for (const tc of obj.textCodes) {
      parts.push(
        buildTextCodeParts(
          tc,
          tc.x,
          tc.y,
          hScale,
          obj.readDirection,
          obj.charDirection,
          fv.key || font.fontName,
          obj.glyphMap
        )
      );
    }
    let attrs = ` font-family="${escapeXml(fv.family)}" font-size="${fontSize}" font-weight="${weight}" font-style="${fontStyle}" fill="${fill}"`;
    if (obj.stroke) {
      let sw = obj.lineWidth != null ? obj.lineWidth : dp && dp.lineWidth != null ? dp.lineWidth : 0.7;
      if (!isFinite(sw) || sw < 0) sw = 0.7;
      const sc = obj.strokeColor || dp && dp.strokeColor || { r: 0, g: 0, b: 0, a: 1 };
      attrs += ` stroke="${colorToCss(sc)}" stroke-width="${sw}"`;
    }
    if (hScale !== 1) attrs += ` transform="scale(${hScale} 1)"`;
    let transform = `translate(${bx} ${by})`;
    if (obj.ctm)
      transform += ` matrix(${obj.ctm[0]} ${obj.ctm[1]} ${obj.ctm[2]} ${obj.ctm[3]} ${obj.ctm[4]} ${obj.ctm[5]})`;
    return {
      transform,
      inner: `<text${attrs} xml:space="preserve" text-rendering="geometricPrecision">${parts.join("")}</text>`
    };
  }
  async function buildImageObject(obj, res) {
    const mm = res.multiMedias[obj.resourceId];
    if (!mm) return null;
    if (!mm.dataUrl) await ensureImageDataUrl(mm);
    if (!mm.dataUrl) return null;
    const b = obj.boundary;
    if (obj.ctm) {
      return {
        transform: `translate(${b.x} ${b.y}) matrix(${obj.ctm.join(" ")})`,
        inner: `<image x="0" y="0" width="1" height="1" href="${escapeXml(mm.dataUrl)}" preserveAspectRatio="none"/>`
      };
    }
    return {
      transform: `translate(${b.x} ${b.y})`,
      inner: `<image x="0" y="0" width="${b.w}" height="${b.h}" href="${escapeXml(mm.dataUrl)}" preserveAspectRatio="none"/>`
    };
  }
  async function buildObjectSvg(obj, res, depth) {
    switch (obj.type) {
      case "path":
        return buildPathObject(obj, res);
      case "text":
        return buildTextObject(obj, res);
      case "image":
        return await buildImageObject(obj, res);
      case "composite":
        return await buildCompositeObject(obj, res, depth);
    }
    return null;
  }
  async function renderObject(obj, res, depth = 0) {
    const built = await buildObjectSvg(obj, res, depth);
    if (!built || !built.inner) return "";
    return applyClips(
      built.inner,
      built.transform,
      obj.clips,
      obj.boundary || { x: 0, y: 0, w: 0, h: 0 },
      res
    );
  }
  function collectObjectResources(obj, res, imgIds, fontIds, seenUnits) {
    if (!obj) return;
    if (obj.clips) {
      for (const clip of obj.clips)
        for (const area of clip.areas)
          for (const t of area.texts || [])
            if (t.fontId != null) fontIds.add(t.fontId);
    }
    if (obj.type === "image") {
      imgIds.add(obj.resourceId);
      return;
    }
    if (obj.type === "text" && obj.fontId != null) {
      fontIds.add(obj.fontId);
      return;
    }
    if (obj.type !== "composite") return;
    const unit = res.compositeUnits && res.compositeUnits[obj.resourceId];
    if (!unit || !unit.layers || seenUnits.has(obj.resourceId)) return;
    seenUnits.add(obj.resourceId);
    for (const layer of unit.layers) {
      for (const child2 of layer.objects || [])
        collectObjectResources(child2, res, imgIds, fontIds, seenUnits);
    }
  }
  async function buildCompositeObject(obj, res, depth = 0) {
    if (depth > 64) return null;
    const unit = res.compositeUnits && res.compositeUnits[obj.resourceId];
    if (!unit || !unit.layers) return null;
    const b = obj.boundary;
    const ub = unit.boundary;
    const m = obj.ctm;
    let tf = `translate(${b.x} ${b.y})`;
    if (m) tf += ` matrix(${m.join(" ")})`;
    if (ub && (ub.x !== 0 || ub.y !== 0)) tf += ` translate(${-ub.x} ${-ub.y})`;
    const parts = [];
    for (const layer of unit.layers) {
      for (const o of layer.objects || [])
        parts.push(await renderObject(o, res, depth + 1));
    }
    const inner = parts.join("");
    if (!inner) return null;
    return { transform: tf, inner };
  }
  function parseCtxOf(ofd) {
    const doc = ofd.document;
    return {
      version: doc.version || "",
      res: doc.res,
      defaultCs: doc.defaultCs || ""
    };
  }
  async function getTemplateLayers(tpl, ofd) {
    if (!tpl._parsed)
      tpl._parsed = await parsePage(tpl.baseLoc, ofd.zip, parseCtxOf(ofd));
    return tpl._parsed.layers;
  }
  async function ensurePageParsed(ofd, pageIndex) {
    const doc = ofd.document;
    const p = doc.pages[pageIndex];
    if (!p) throw new Error("页码越界: " + pageIndex);
    if (!p._parsed)
      p._parsed = await parsePage(p.baseLoc, ofd.zip, parseCtxOf(ofd));
    return p._parsed;
  }
  var SEAL_OPACITY = 0.8;
  var BLEND_MODES = /* @__PURE__ */ new Set([
    "normal",
    "multiply",
    "screen",
    "overlay",
    "darken",
    "lighten",
    "color-dodge",
    "color-burn",
    "hard-light",
    "soft-light",
    "difference",
    "exclusion",
    "hue",
    "saturation",
    "color",
    "luminosity"
  ]);
  var _stampClipSeq = 0;
  async function renderStamp(stamp, stampIdx) {
    const b = stamp.boundary;
    const x = b.x, y = b.y, w = b.w, h = b.h;
    const dataAttr = ' data-stamp-idx="' + stampIdx + '"';
    if (stamp.sealOfd) {
      const sealPage = stamp.sealOfd.page;
      const sealRes = stamp.sealOfd.res;
      const sealPageBox = sealPage.pageBox || { w, h };
      const sealW = sealPageBox.w;
      const sealH = sealPageBox.h;
      const pathParts = [], textParts = [];
      for (const layer of sealPage.layers) {
        for (const obj of layer.objects) {
          if (obj.type === "text") {
            textParts.push(await renderObject(obj, sealRes));
          } else {
            pathParts.push(await renderObject(obj, sealRes));
          }
        }
      }
      const sealSvg = pathParts.join("") + textParts.join("");
      const scaleX = w / sealW;
      const scaleY = h / sealH;
      const clip = stamp.clip;
      if (clip && clip.w > 0 && clip.h > 0 && (clip.x > 0 || clip.y > 0 || clip.w < w || clip.h < h)) {
        const clipId = "stampClip_" + ++_stampClipSeq;
        const clipSvgX = x + clip.x;
        const clipSvgY = y + clip.y;
        return `<clipPath id="${clipId}"><rect x="${clipSvgX}" y="${clipSvgY}" width="${clip.w}" height="${clip.h}"/></clipPath><g transform="translate(${x} ${y}) scale(${scaleX} ${scaleY})" clip-path="url(#${clipId})" opacity="${SEAL_OPACITY}"${dataAttr}>${sealSvg}</g>`;
      }
      return `<g transform="translate(${x} ${y}) scale(${scaleX} ${scaleY})" opacity="${SEAL_OPACITY}"${dataAttr}>${sealSvg}</g>`;
    }
    if (stamp.sealDataUrl) {
      const clip = stamp.clip;
      if (clip && clip.w > 0 && clip.h > 0 && (clip.x > 0 || clip.y > 0 || clip.w < w || clip.h < h)) {
        const clipId = "stampClip_" + ++_stampClipSeq;
        const clipSvgX = x + clip.x;
        const clipSvgY = y + clip.y;
        return `<clipPath id="${clipId}"><rect x="${clipSvgX}" y="${clipSvgY}" width="${clip.w}" height="${clip.h}"/></clipPath><image x="${x}" y="${y}" width="${w}" height="${h}" href="${escapeXml(stamp.sealDataUrl)}" preserveAspectRatio="none" clip-path="url(#${clipId})" opacity="${SEAL_OPACITY}"${dataAttr}/>`;
      }
      return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${escapeXml(stamp.sealDataUrl)}" preserveAspectRatio="none" opacity="${SEAL_OPACITY}"${dataAttr}/>`;
    }
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    const strokeWidth = Math.max(0.4, Math.min(rx, ry) * 0.06);
    return `<g opacity="${SEAL_OPACITY}"${dataAttr}><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="red" stroke-width="${strokeWidth}" stroke-dasharray="2 1"/></g>`;
  }
  async function renderAnnot(annot, res) {
    const b = annot.boundary || { x: 0, y: 0, w: 0, h: 0 };
    const rawBlend = String(annot.blendMode || "Normal").toLowerCase();
    const blend = BLEND_MODES.has(rawBlend) ? rawBlend : "normal";
    const style = blend === "normal" ? "" : ` style="mix-blend-mode:${blend}"`;
    const parts = [];
    for (const o of annot.objects || []) parts.push(await renderObject(o, res));
    let out = parts.join("");
    if (out) out = `<g transform="translate(${b.x} ${b.y})"${style}>${out}</g>`;
    if (annot.linkUrl && b.w > 0 && b.h > 0 && /^https?:\/\//i.test(annot.linkUrl)) {
      out += `<rect class="ofd-link" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" pointer-events="all" data-link-url="${escapeXml(annot.linkUrl)}"/>`;
    }
    return out;
  }
  async function sealToSvgString(sealOfd, widthPx) {
    const page = sealOfd.page;
    const res = sealOfd.res;
    const box = page.pageBox || { w: 1, h: 1 };
    let body = "";
    for (const layer of page.layers) {
      for (const obj of layer.objects) body += await renderObject(obj, res);
    }
    const w = widthPx || 100;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.w} ${box.h}" width="${w}" preserveAspectRatio="xMidYMid meet" style="display:block">${body}</svg>`;
  }

  // ofd/display/api.js
  var SVG_CACHE_MAX = 256;
  function svgCacheKey(pageIndex) {
    return String(pageIndex);
  }
  function svgWidthAttr(opts) {
    const width = Number(opts && opts.width);
    return Number.isFinite(width) && width > 0 ? ` width="${width}"` : "";
  }
  async function renderPageToString(ofd, pageIndex, opts) {
    opts = opts || {};
    if (!ofd._svgCache) ofd._svgCache = new LRUCache(SVG_CACHE_MAX);
    const cacheKey = svgCacheKey(pageIndex);
    const widthAttr = svgWidthAttr(opts);
    const cached = ofd._svgCache.get(cacheKey);
    if (cached !== void 0)
      return cached.head + widthAttr + cached.mid + ">" + cached.body;
    const doc = ofd.document;
    const pgTag = _profiling ? "page-" + pageIndex : "";
    if (_profiling)
      mark("页面 " + (pageIndex + 1) + "：解析页面 XML", pgTag);
    const page = await ensurePageParsed(ofd, pageIndex);
    const pageBox = page.pageBox || doc.pageBox;
    const pageW = pageBox.w, pageH = pageBox.h;
    const layers = [];
    for (const t of page.templates) {
      if (t.zOrder !== "Foreground") {
        const tpl = doc.templateById.get(t.templateId);
        if (tpl) layers.push(...await getTemplateLayers(tpl, ofd));
      }
    }
    layers.push(...page.layers);
    for (const t of page.templates) {
      if (t.zOrder === "Foreground") {
        const tpl = doc.templateById.get(t.templateId);
        if (tpl) layers.push(...await getTemplateLayers(tpl, ofd));
      }
    }
    if (_profiling)
      mark("页面 " + (pageIndex + 1) + "：加载模板/图层", pgTag);
    registerEmbeddedFonts(doc.res.fonts);
    const imgIds = /* @__PURE__ */ new Set();
    const fontIds = /* @__PURE__ */ new Set();
    const seenComposite = /* @__PURE__ */ new Set();
    for (const layer of layers) {
      for (const obj of layer.objects)
        collectObjectResources(obj, doc.res, imgIds, fontIds, seenComposite);
    }
    const pageId = doc.pages[pageIndex] ? doc.pages[pageIndex].id : null;
    if (doc.stamps && pageId)
      for (const stamp of doc.stamps) {
        if (stamp.pageRef !== pageId) continue;
        for (const obj of stamp.objects || [])
          collectObjectResources(obj, doc.res, imgIds, fontIds, seenComposite);
      }
    const prefetchTasks = [];
    for (const id of imgIds) {
      const mm = doc.res.multiMedias[id];
      if (mm && !mm.dataUrl) prefetchTasks.push(ensureImageDataUrl(mm));
    }
    let needFontIndex = false;
    for (const fid of fontIds) {
      const f = doc.res.fonts[fid];
      const name = f && f.fontName;
      if (!name) continue;
      const v = splitFontVariant(name);
      const family = uniqueFamily(fid, v.base || name);
      if (hasEmbeddedFont(name, fid) || hasEmbeddedFont(v.base, fid)) {
        prefetchTasks.push(ensureFontLoaded(family, fid));
        continue;
      }
      if (!builtinFontStack(v.base) && !builtinFontStack(name) && !localFontAvailable(v.base)) {
        needFontIndex = true;
        prefetchTasks.push(ensureFontLoaded(family, fid));
      }
    }
    if (needFontIndex) prefetchTasks.push(fetchFontIndex());
    if (prefetchTasks.length) await Promise.allSettled(prefetchTasks);
    if (_profiling) mark("页面 " + (pageIndex + 1) + "：预取", pgTag);
    const bodyParts = [
      `<rect x="0" y="0" width="${pageW}" height="${pageH}" fill="#ffffff"/>`
    ];
    for (const layer of layers) {
      for (const obj of layer.objects)
        bodyParts.push(await renderObject(obj, doc.res));
    }
    if (doc.stamps && pageId) {
      let stampIdx = 0;
      for (const stamp of doc.stamps) {
        if (stamp.pageRef === pageId) {
          if (stamp.isAnnot) {
            bodyParts.push(await renderAnnot(stamp, doc.res));
          } else {
            bodyParts.push(await renderStamp(stamp, stampIdx++));
          }
        }
      }
    }
    if (_profiling) mark("页面 " + (pageIndex + 1) + "：SVG 构建", pgTag);
    const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageW} ${pageH}"`;
    const mid = ` preserveAspectRatio="xMidYMin meet" class="ofd-page-svg"`;
    const body = `${bodyParts.join("")}</svg>`;
    const svg = head + widthAttr + mid + ">" + body;
    ofd._svgCache.set(cacheKey, { head, mid, body });
    if (_profiling) mark("页面 " + (pageIndex + 1) + "：渲染完成", pgTag);
    if (_profiling) flushProfile("渲染 第 " + (pageIndex + 1) + " 页", pgTag);
    return svg;
  }
  function svgStringToElement(svgString) {
    if (typeof document === "undefined") return svgString;
    const container = document.createElement("div");
    container.innerHTML = svgString;
    return container.firstElementChild;
  }
  async function load(source) {
    mark("读取文件数据", "load");
    let data;
    if (typeof source === "string") {
      if (/^(javascript|file|data):/i.test(source))
        throw new Error("不安全的 URL 协议");
      const res = await fetch(source);
      if (!res.ok)
        throw new Error("加载 OFD 失败: " + res.status + " " + res.statusText);
      data = new Uint8Array(await res.arrayBuffer());
    } else if (typeof Blob !== "undefined" && source instanceof Blob) {
      data = new Uint8Array(await source.arrayBuffer());
    } else if (source instanceof ArrayBuffer) {
      data = new Uint8Array(source);
    } else if (source instanceof Uint8Array) {
      data = source;
    } else if (source && source.byteLength !== void 0) {
      data = new Uint8Array(source.buffer ? source.buffer : source);
    } else {
      throw new Error("不支持的 source 类型");
    }
    const zip = await readZip(data);
    mark("ZIP 解压", "load");
    return await parseOFD(zip);
  }
  async function renderPage(ofd, pageIndex, opts) {
    return svgStringToElement(await renderPageToString(ofd, pageIndex, opts));
  }
  async function renderAll(ofd, opts) {
    const count = ofd.document.pages.length;
    const els = [];
    for (let i = 0; i < count; i++) els.push(await renderPage(ofd, i, opts));
    return els;
  }
  function getPageCount(ofd) {
    return ofd.document.pages.length;
  }
  async function getPageDimensions(ofd, pageIndex) {
    if (pageIndex == null) pageIndex = 0;
    const page = await ensurePageParsed(ofd, pageIndex);
    const box = page.pageBox || ofd.document.pageBox;
    return { width: box.w, height: box.h, unit: "mm" };
  }
  function getDocumentInfo(ofd) {
    return Object.assign({ pageCount: ofd.document.pages.length }, ofd.info);
  }
  function formatSignTime(t) {
    if (!t) return "";
    const s = String(t).trim();
    let m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z?$/);
    if (m)
      return m[1] + "-" + m[2] + "-" + m[3] + " " + m[4] + ":" + m[5] + ":" + m[6];
    m = s.match(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/);
    if (m) return s.replace("T", " ");
    return s;
  }
  function formatAsn1Time(s) {
    const ms = asn1TimeToMs(s);
    if (!isFinite(ms)) return s || "";
    const d = new Date(ms);
    const p = (v) => v < 10 ? "0" + v : "" + v;
    return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()) + " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds());
  }
  async function getSignatures(ofd) {
    const doc = ofd.document;
    const sigs = doc.signatures || [];
    const pageIndex = /* @__PURE__ */ new Map();
    for (let i = 0; i < doc.pages.length; i++) {
      const id = doc.pages[i].id;
      if (!pageIndex.has(id)) pageIndex.set(id, i);
    }
    return Promise.all(
      sigs.map(async (s, i) => {
        const pageNums = [];
        for (const ref of s.pages) {
          const idx = pageIndex.get(ref);
          if (idx !== void 0) pageNums.push(idx + 1);
        }
        const positions = (s.positions || []).map((pos) => {
          const idx = pageIndex.get(pos.pageRef);
          return idx !== void 0 ? { page: idx + 1, boundary: pos.boundary } : null;
        }).filter(Boolean);
        let sealImage = null;
        if (s.sealDataUrl) sealImage = { type: "image", data: s.sealDataUrl };
        else if (s.sealOfd)
          sealImage = {
            type: "svg",
            data: await sealToSvgString(s.sealOfd, 100)
          };
        let sealAttrs = null;
        if (s.sealAttrs) {
          sealAttrs = {
            id: s.sealAttrs.id || "",
            name: s.sealAttrs.name || "",
            type: s.sealAttrs.type || "",
            createTime: formatSignTime(s.sealAttrs.createTime),
            notBefore: formatSignTime(s.sealAttrs.notBefore),
            notAfter: formatSignTime(s.sealAttrs.notAfter)
          };
        }
        return {
          index: i,
          id: s.id,
          signer: s.signer || "",
          signTime: formatSignTime(s.signTime),
          provider: s.provider || "",
          providerVersion: s.providerVersion || "",
          checkMethod: s.checkMethod || "",
          signatureMethod: oidName(s.signatureMethod),
          digestMethod: oidName(s.checkMethod),
          references: (s.references || []).map((r) => ({
            fileRef: r.fileRef,
            checkValue: r.checkValue
          })),
          signedValuePath: s.signedValuePath || "",
          signedValueSize: s.signedValueSize || 0,
          signaturePath: s.signaturePath || "",
          signatureDigest: s.signatureDigest || "",
          signatureValueHex: s.signatureValueHex || "",
          sealAttrs,
          certValidity: (s.certValidity || []).map((c) => ({
            notBefore: formatAsn1Time(c.notBefore),
            notAfter: formatAsn1Time(c.notAfter)
          })),
          pages: pageNums,
          positions,
          sealImage
        };
      })
    );
  }

  // ofd/index.js
  var OFD = {
    load,
    renderPage,
    renderPageToString,
    renderAll,
    getPageCount,
    getPageDimensions,
    getDocumentInfo,
    expandDelta,
    getSignatures,
    verifySignature,
    setProfiling,
    getLastProfile,
    setFontBase,
    // 非稳定接口，仅为外部实际取用处保留（公共 API 见上方命名导出）：
    //   build/ofd2pdf/ofd2pdf.js → base64ToBytes, decodeEntities
    //   test/benchmark.html  → parsePage, readEntry, readEntryText, resolvePath,
    //                          parseXml, hashBytes
    // 需要调试其它内部函数时，请直接在源码中断点。
    _internals: {
      parsePage,
      readEntry,
      readEntryText,
      resolvePath,
      parseXml,
      hashBytes,
      base64ToBytes,
      decodeEntities
    }
  };
  OFD.version = "1.0.0";
  globalThis.OFD = OFD;
})();

  // Node 侧 require('./build/ofd/ofd.js') 走这条桥接；浏览器里 module 不存在，直接跳过。
  if (typeof module !== "undefined" && module.exports) module.exports = globalThis.OFD;
})();
