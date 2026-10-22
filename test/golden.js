// 引擎等价性基线：把 test/ofdFile/ 里每个 OFD 的每一页渲染成 SVG，并跑一遍验签，存成文本。
// 用途是重构前后的对照 —— 逐字节 diff，零差异才算没改坏渲染或验签。
//   node test/golden.js [引擎路径]              生成/覆盖 test/golden/*.txt
//   node test/golden.js [引擎路径] --check      与已有基线比对，有差异退出码 1
// 引擎路径默认 build/ofd/ofd.js；要验证压缩产物就传 build/ofd/ofd.min.js（浏览器实际加载的是它）。
const fs = require('fs');
const path = require('path');
require('./node-deflate-raw-shim')();

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'test', 'ofdFile');
const OUT_DIR = path.join(__dirname, 'golden');
const ENGINE = process.argv[2] && process.argv[2].endsWith('.js') ? process.argv[2] : path.join(ROOT, 'build', 'ofd', 'ofd.js');

const OFD = require(path.resolve(ENGINE));

function listDocs() {
  return fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.ofd')).sort();
}

async function renderOne(name) {
  const parts = [];
  const data = new Uint8Array(fs.readFileSync(path.join(SRC_DIR, name)));
  parts.push('### DOC ' + name);
  let ofd;
  try {
    ofd = await OFD.load(data);
  } catch (e) {
    parts.push('LOAD-ERROR ' + String(e && e.message));
    return parts.join(String.fromCharCode(10));
  }
  const info = OFD.getDocumentInfo(ofd);
  parts.push('### DocInfo ' + JSON.stringify(info));
  const n = OFD.getPageCount(ofd);
  parts.push('### Pages ' + n);
  for (let i = 0; i < n; i++) {
    parts.push('### Page ' + i + ' dims ' + JSON.stringify(await OFD.getPageDimensions(ofd, i)));
    try {
      const svg = await OFD.renderPageToString(ofd, i, { width: 800 });
      parts.push(svg);
    } catch (e) {
      parts.push('RENDER-ERROR ' + String(e && e.message));
    }
  }
  const sigs = await OFD.getSignatures(ofd);
  parts.push('### Signatures ' + JSON.stringify(sigs && sigs.map ? sigs.map((s) => s.SignatureID) : sigs));
  // 验签整条链路要跑进来：SM2 用的是 esbuild 内联进来的 sm-crypto，
  // terser 改名或打包作用域变化只会在这里暴露，光看渲染图是看不出来的。
  for (let i = 0; i < (sigs && sigs.length ? sigs.length : 0); i++) {
    try {
      const r = await OFD.verifySignature(ofd, i);
      parts.push('### Verify#' + i + ' ' + JSON.stringify(r));
    } catch (e) {
      parts.push('### Verify#' + i + ' THROW ' + String(e && e.message));
    }
  }
  return parts.join(String.fromCharCode(10));
}

function outPath(name) {
  return path.join(OUT_DIR, name.replace(/\.ofd$/, '') + '.txt');
}

(async () => {
  const check = process.argv.includes('--check');
  if (!check) fs.mkdirSync(OUT_DIR, { recursive: true });
  const docs = listDocs();
  const diffs = [];
  let totalBytes = 0;
  for (const name of docs) {
    const t0 = Date.now();
    const txt = await renderOne(name);
    totalBytes += txt.length;
    const p = outPath(name);
    if (check) {
      const old = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '<MISSING BASELINE>';
      if (old !== txt) {
        let at = 0;
        while (at < Math.min(old.length, txt.length) && old[at] === txt[at]) at++;
        diffs.push(name + ' @offset ' + at + String.fromCharCode(10) +
          '  base: ' + JSON.stringify(old.slice(at, at + 120)) + String.fromCharCode(10) +
          '  new : ' + JSON.stringify(txt.slice(at, at + 120)));
      }
    } else {
      fs.writeFileSync(p, txt, 'utf8');
    }
    process.stdout.write((check ? 'checked ' : 'wrote ') + name.padEnd(44) + String(txt.length).padStart(9) + 'B  ' + (Date.now() - t0) + 'ms' + String.fromCharCode(10));
  }
  if (check) {
    if (diffs.length) {
      console.log(String.fromCharCode(10) + 'DIFF in ' + diffs.length + ' of ' + docs.length + ' docs:' + String.fromCharCode(10) + diffs.join(String.fromCharCode(10)));
      process.exit(1);
    }
    console.log(String.fromCharCode(10) + 'OK — all ' + docs.length + ' docs byte-identical (' + totalBytes + ' bytes of SVG)');
  }
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
