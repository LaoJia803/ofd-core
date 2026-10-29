# OFD Viewer & Rendering Engine

A browser-based OFD (GB/T 33190, electronic document storage and exchange — layout documents) viewer rendered with **pure SVG vectors, zero runtime dependencies, no build step**.

English | [简体中文](README.zh-cn.md)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

## What this is

OFD is the Chinese national standard format for electronic official documents (similar to PDF, but tailored to Chinese typography and electronic seals). This project provides:

| Capability | Notes |
| --- | --- |
| **OFD preview** | Pure front-end parsing and rendering; vectors scale losslessly, text stays selectable and searchable |
| **Digital signatures** | Signature parsing, SM2 signature-value verification, file digest comparison (SM3/SHA), certificate and seal validity checks |
| **Electronic seals** | Third-party seal-provider callback, custom seal placement and removal |
| **Full-text search** | Cross-page search with precise per-character highlighting |
| **Layout fidelity** | Object-level Clips, CMYK/gray/palette colors, gradient strokes, text stroke and HScale/ReadDirection |
| **OFD → PDF** | Pure front-end conversion, zero dependencies (`build/ofd2pdf/ofd2pdf.js`) |
| **PDF → OFD** | Node CLI script / npm package (`build/pdf2ofd/pdf2ofd.js`, beta) |

## Quick start

### Option 1: just run it (no build)

Clone and serve over any HTTP server:

```bash
git clone https://gitee.com/LaoJia803/ofd-core.git
cd ofd-core
python -m http.server 8090
```

Then open:

```
http://127.0.0.1:8090/web/viewer.html
```

Equivalent commands:

```bash
npx http-server -p 8090# Node
npx serve -p 8090           # Node
php -S 127.0.0.1:8090      # PHP
ruby -run -e httpd . -p 8090  # Ruby
```

> **Why HTTP is required rather than `file://`**: the viewer loads OFD files by URL via `fetch`, which browsers block under `file://`.
> Opening `web/viewer.html` directly still shows the UI, but you must pick a file with the "Open OFD file" toolbar button.

### Option 2: embed in your own app

Include the engine and render in two lines:

```html
<script src="build/ofd/ofd.min.js"></script>
<script>
  const ofd = await OFD.load('document.ofd');
  const svg = await OFD.renderPage(ofd, 0, { width: 800 });
  document.body.appendChild(svg);
</script>
```

Full API reference: [core engine docs](docs/ofd.md).

### Option 3: PDF → OFD from the command line

```bash
npm install
node build/pdf2ofd/pdf2ofd.js input.pdf output.ofd
```

Or as an npm package:

```bash
npm install pdf2ofd pdfjs-dist
pdf2ofd input.pdf output.ofd
```

See the [PDF → OFD docs](docs/pdf2ofd.md).

## Building

The repo is split into four modules:

| Module | Role | Sources |
| --- | --- | --- |
| `ofd/` | OFD parsing / rendering engine (module 1) | ES modules |
| `ofd2pdf/` | OFD → PDF conversion (module 2) | ES modules |
| `pdf2ofd/` | PDF → OFD conversion, Node only (module 3) | ES modules |
| `web/` | viewer UI (module 4) | plain script |

The three libraries are bundled with esbuild into their own subfolders under `build/`, each with a minified variant:

```bash
npm install                # installs esbuild / terser / pdfjs-dist
npm run build              # pdf2ofd + viewer (viewer builds ofd / ofd2pdf first)
npm run build:all          # all four module artifacts in order: ofd, ofd2pdf, pdf2ofd, viewer zip
npm run build:ofd          # → build/ofd/ofd.js, ofd.min.js
npm run build:ofd2pdf      # → build/ofd2pdf/ofd2pdf.js, ofd2pdf.min.js
npm run build:pdf2ofd      # → build/pdf2ofd/pdf2ofd.js, pdf2ofd.min.js
npm run build:viewer       # runs build:ofd + build:ofd2pdf, then zips into dist/<version>/
npm run build:zips         # per-module artifact zips → dist/<version>/ofd.zip, ofd2pdf.zip, pdf2ofd.zip
npm run build:ofd-npm      # → dist/<version>/ofd/ (package name ofd-core)
npm run build:ofd2pdf-npm  # → dist/<version>/ofd2pdf/ (depends on ofd-core)
npm run build:pdf2ofd-npm  # → dist/<version>/pdf2ofd/
npm run build:npm          # build:all first, then all three npm packages above
```

`build/common.js` reads `version` from `package.json` and writes it into each banner, `OFD.version`, the distribution zip name, and the `dist/<version>/` folder, so they always stay in sync.

## Layout

```
ofd-core/
├── build/                    # build outputs + build scripts
│   ├── ofd/                  # core engine: ofd.js (~231 KB) / ofd.min.js (~107 KB)
│   ├── ofd2pdf/              # OFD → PDF: ofd2pdf.js / ofd2pdf.min.js
│   ├── pdf2ofd/              # PDF → OFD: pdf2ofd.js / pdf2ofd.min.js
│   ├── build-ofd.js          # bundles the engine
│   ├── build-ofd2pdf.js      # bundles OFD → PDF
│   ├── build-pdf2ofd.js      # bundles PDF → OFD
│   ├── build-viewer.js       # builds ofd / ofd2pdf first, then the distribution zip
│   ├── build-zips.js         # builds the three modules, then dist/<version>/<module>.zip
│   ├── build-ofd-npm.js      # assembles the ofd-core npm package
│   ├── build-ofd2pdf-npm.js  # assembles the ofd2pdf npm package
│   ├── build-pdf2ofd-npm.js  # assembles the pdf2ofd npm package
│   └── common.js             # paths / esbuild / terser / ZIP / release rewriting
├── ofd/                      # module 1: engine sources (22 files, ES modules)
│   ├── index.js              # public API surface
│   ├── core/                 # parsing: zip / parser / page / res / signature / verify / seal / asn1 / md / image
│   ├── display/              # rendering: api / svg / font
│   └── shared/               # utils: util / xml / color / path / lru
├── ofd2pdf/                  # module 2: OFD → PDF sources (ES modules)
│   ├── index.js              # public API: ofdToPdf / svgToPdf
│   ├── core/                 # constants / CSS colours / platform bridge / basic helpers
│   ├── pdf/                  # PDF objects + content stream: render / writer / docstring
│   ├── svg/                  # XML parsing, transforms, path conversion
│   └── image/                # PNG / BMP / GIF / JPEG decoding + XObject emission (size guard)
├── pdf2ofd/                  # module 3: PDF → OFD sources (ES modules, Node only)
│   ├── index.js              # convert() orchestration
│   ├── core/                 # pdf.js locator, matrices/units, pdf.js image → RGBA
│   ├── ops/                  # operator walker: state / geometry / clip / text / path / image / shading
│   ├── res/                  # colour helpers + gradient/pattern prefetch
│   ├── ofd/                  # package assembly: package / PNG encoder / XML / ZIP
│   └── font/                 # compiled-font parsing, cmap rebuilding, naming
├── web/                      # module 4: viewer (viewer.html / css / js + SVG icons, ~186 KB)
├── font/                     # external font drop-in (created by `npm run build`; needs a directory listing to serve)
├── docs/                     # detailed documentation (bilingual)
├── dist/                     # build output (<version>/: viewer zip, three module zips, three npm packages)
├── test/                     # demo pages and OFD samples
├── LICENSE                   # Apache-2.0
└── 免责声明.md# disclaimer (Chinese)
```

### Minimal deployment

Trim by what you actually need:

| Keep | Size | Why |
| --- | --- | --- |
| `build/ofd/ofd.min.js` | ~107 KB | **required**, the core engine (SM2 verification compiled in) |
| `build/ofd2pdf/ofd2pdf.js` | ~53 KB | only for OFD → PDF |
| `web/` | ~186 KB | only for the full viewer |
| `font/` (repo root) | created by `npm run build` | external-font drop-in for unmapped OFD font names; the served folder must expose a **directory listing** to take effect |

**Safe to delete**: `ofd/`, `ofd2pdf/`, `pdf2ofd/` (sources, build-time only), `docs/`, `test/`, `build/ofd/ofd.js` (unminified), `build/pdf2ofd/` and `build/build*.js` (Node-side).

The absolute minimum for rendering is just `build/ofd/ofd.min.js`. External fonts are optional: `npm run build` creates a `font/` folder at the package root, which the engine auto-detects (from the `ofd.min.js` location; the `build/ofd/`, flat `build/`, and npm `lib/` layouts are all supported) as the external font directory — drop `字体原名.ttf|.otf|.woff2` there and no `OFD.setFontBase()` call is needed. That folder must be served with a **directory listing** (nginx `autoindex`, or `serve`/`http-server`), otherwise the index fetch fails and external fonts won't load; in that case rendering still falls back to OFD-embedded fonts and the built-in system-stack mapping. Call `OFD.setFontBase('your/path/')` only to point somewhere else.

### File sizes

| File | Description | Size |
| --- | --- | --- |
| `build/ofd/ofd.js` | core engine, unminified | ~231 KB |
| `build/ofd/ofd.min.js` | core engine, minified | ~107 KB |
| `build/ofd2pdf/ofd2pdf.js` | OFD → PDF module | ~53 KB |
| `build/ofd2pdf/ofd2pdf.min.js` | OFD → PDF, minified | ~26 KB |
| `build/pdf2ofd/pdf2ofd.js` | PDF → OFD script (Node, beta) | ~50 KB |
| `build/pdf2ofd/pdf2ofd.min.js` | PDF → OFD, minified | ~30 KB |
| `web/viewer.js` | viewer application logic | ~93 KB |
| `web/viewer.css` | viewer styles (icons reference `images/*.svg`; no base64) | ~43 KB |

## Usage

### URL parameters

| Parameter | Description |
| --- | --- |
| `file` | OFD file URL (if omitted, nothing loads automatically — use the toolbar button) |
| `page` | jump to a page on open (1-based) |
| `rotate` | initial rotation in degrees (multiples of 90, clockwise) |
| `search` | open the search bar and run a search automatically |

```
http://127.0.0.1:8090/web/viewer.html?file=../test/ofdFile/<your-sample>.ofd&page=3&rotate=90&search=invoice
```

### Core engine API

```js
const ofd = await OFD.load('sample.ofd');              // load and parse
const svg = await OFD.renderPage(ofd, 0);           // render a page as an SVG element
const sigs = await OFD.getSignatures(ofd);          // list digital signatures
const result = await OFD.verifySignature(ofd, 0);   // SM2 verify + digest compare + validity
OFD.setFontBase('../assets/font/');                 // override the font/ directory URL
```

**Accepted `load` sources**:

```js
await OFD.load('https://example.com/document.ofd');  // URL (javascript:/file:/data: rejected)
await OFD.load(fileInput.files[0]);                  // File / Blob
await OFD.load(arrayBuffer);                         // ArrayBuffer
await OFD.load(uint8Array);                          // Uint8Array
```

**Rendering and queries**:

```js
const svgString  = await OFD.renderPageToString(ofd, 0);  // SVG markup
const svgElement = await OFD.renderPage(ofd, 0);           // SVG DOM element
const pages      = await OFD.renderAll(ofd);                // all pages
OFD.getPageCount(ofd);                                      // page count
await OFD.getPageDimensions(ofd, 0);                        // { width, height, unit: 'mm' }
OFD.getDocumentInfo(ofd);                                   // document metadata
```

**Profiling** (useful when diagnosing performance on large documents):

```js
OFD.setProfiling(true);
await OFD.renderPage(ofd, 0);
console.table(OFD.getLastProfile());  // per-stage timings
```

### Viewer extension API

The viewer attaches extension hooks to the global `OFD` object (see the [viewer docs](docs/viewer.md)):

```js
OFD.onPageChange((page, total) => console.log(page + '/' + total)); // page changes
OFD.goToPage(3);                                                     // navigate to page 3
OFD.onGetSeal(async () => {                // seal provider callback
  OFD.setSeal({ sealImg: await fetchSeal(), width: 40, height: 40 });
});
OFD.onSealChange((list, action) => saveSeals(list));                // seal placed/removed
```

## Signature verification boundaries

Read this before relying on this project's verification results.

**Implemented**:

- **SM2 signature-value verification** — verifies the GB/T 38540 SES `toSign` DER using the signer's certificate public key
- **File digest comparison** — recomputes each `References[].CheckValue` with SM3 / SHA and compares, detecting modified or missing protected files
- **Validity period checks** — whether the seal's and all embedded certificates' `notBefore`/`notAfter` cover the **signing time**

**Not implemented**:

- Certificate chain and trust-root validation
- Revocation status (CRL / OCSP)
- Timestamp (TSA) verification
- Verification of the seal's own signature

> `valid: true` means the signature value is self-consistent, protected files are unmodified, and the validity periods cover the signing time.
> It does **not** mean the signer is a trusted authority. Since certificates are trusted as-is with no chain building, anyone can self-sign a certificate and pass verification.
>
> Also note that digests live inside the OFD file and can be recomputed after tampering, so "digest matches" only proves the file is self-consistent. Signature-value verification is the actual basis for identity and integrity. If digests match but the signature value cannot be verified (non-SES structure or no usable public key), the result is `status: "partial"` with `valid: false`, shown as "Partial" in the viewer.
>
> Legally binding electronic signatures require a compliant CA infrastructure and timestamp service, which this project does not provide.

## Browser support

| Browser | Minimum |
| --- | --- |
| Chrome / Edge | 80+ |
| Firefox | 113+ |
| Safari | 16.4+ |

ZIP decompression relies on the native `DecompressionStream` API.
**Firefox 78–112 and Safari 14–16.3 lack it and cannot decompress OFD.**

`ofd2pdf.js` prefers `CompressionStream` for PDF compression but falls back to `zlib` (Node), so it raises no additional browser requirement.

Node.js 18+ works for PDF → OFD conversion.

## Security

This project parses untrusted OFD files. The following mitigations are in place, but **the code has not undergone professional security auditing**:

- ZIP decompression capped at 256 MB per entry, 64-entry cache (decompression-bomb defense)
- Image decoding capped at 100 megapixels (`ofd2pdf.js`)
- `javascript:` / `file:` / `data:` URL protocols rejected
- XML character references are range-checked; malformed ones yield U+FFFD instead of throwing
- Signature parsing is fully wrapped in `try/catch`; one corrupt signature won't break document loading

Evaluate the risk yourself before processing OFD files from untrusted sources.

## Documentation

### English

| Document | Contents |
| --- | --- |
| [Core engine](docs/ofd.md) | Public API, parsing flow, signature verification scope and limits, profiling, implementation notes |
| [Viewer](docs/viewer.md) | Integration examples, URL parameters, toolbar/seal/navigation APIs, sealing flow, internal state |
| [OFD → PDF](docs/ofd2pdf.md) | Conversion capabilities, font strategy, image support, known losses |
| [PDF → OFD](docs/pdf2ofd.md) | CLI / npm package, conversion principles, alignment with reference output |

Runnable demos live in `test/`: `example-intro.html` (toolchain tour with live demos), `example-basic.html`, `example-seal.html`, `example-ofd2pdf.html`, `benchmark.html`.

### 中文

[核心引擎](docs/ofd.zh-cn.md) · [预览器](docs/viewer.zh-cn.md) · [OFD → PDF](docs/ofd2pdf.zh-cn.md) · [PDF → OFD](docs/pdf2ofd.zh-cn.md) · [中文 README](README.zh-cn.md)

## FAQ

**Q: Every font renders as SimHei / sans-serif**

The embedded fonts aren't being matched. When the OFD's own font files
(`res.fonts[].fontFile`) fail to register as `@font-face`, CSS falls through to the
last family in the stack — `sans-serif` — which Windows resolves to SimHei.

Diagnose first:

```js
const ofd = await OFD.load('doc.ofd');
const fonts = ofd.document.res.fonts;
console.log('total fonts', Object.keys(fonts).length);
console.log('with embedded file', Object.values(fonts).filter(f => f.fontFile).length);
```

If `fontFile` is present yet everything renders as SimHei, that's a bug in this
project — please open an issue with reproduction details. See "Troubleshooting" in
the core engine docs.

**Q: An OFD references a font name I don't have**

Documents without embedded fonts rely on system fonts. Windows ships SimSun, SimHei,
KaiTi and FangSong; macOS/Linux need manual installation or a font directory pointed
at with `OFD.setFontBase()`.

**Q: Can `verifySignature` returning `valid: true` serve as legal evidence?**

No. See "Signature verification boundaries" above — certificates are trusted as-is
with no chain building, so a self-signed certificate passes.

**Q: It won't open in Firefox**

ZIP decompression needs `DecompressionStream`, which requires Firefox 113+.

## Contributing

Issues and PRs are welcome.

Read the "Implementation notes" section of the relevant document under `docs/` before changing anything. It records several **counter-intuitive constraints**, for example:

- `LineWidth` / `DashPattern` must **never** be pre-multiplied by the CTM (it shrinks them nearly 3×)
- Page-level `<ofd:Clips>` must **never** be emitted (it makes WPS clip content away wholesale)
- Embedded fonts must be keyed by Font ID, not font name alone

Skipping these comments is an easy way to introduce regressions.

## Acknowledgements

- [ofd.js](https://github.com/DLTech21/ofd.js) — OFD parsing approach
- [ofdrw](https://github.com/ofdrw/ofdrw) — OFD reference code
- [pdf.js](https://github.com/mozilla/pdf.js) — viewer UI reference
- Qoder CN, plus the Qwen3.8-Flash and Mimo-V2.6-Flash models

## Repositories

- Gitee: <https://gitee.com/LaoJia803/ofd-core>
- GitHub: <https://github.com/LaoJia803/ofd-core>

## License

Apache-2.0 — see [LICENSE](LICENSE). A disclaimer is provided in [免责声明.md](免责声明.md).

This project is not affiliated with any standards body, cryptography authority, or OFD software vendor. The OFD standard itself belongs to its publisher.