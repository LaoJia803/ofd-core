# OFD Viewer

A browser-based OFD (GB/T 33190) document viewer rendered with pure SVG. Zero dependencies, no build step.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

## Features

- **SVG vector rendering**: pages scale without loss of quality; text is selectable and searchable

- **Digital signatures**: seal parsing, file-digest comparison (SM3/SHA), certificate info display. **Verification boundary: file-digest comparison only** — no signature-value (RSA/SM2), certificate-chain, or timestamp verification (see [docs/ofd.md](docs/ofd.md))

- **Seal stamping**: third-party seal retrieval, custom seal placement and removal

- **Search**: full-text search across pages with per-character highlight

- **View controls**: zoom (auto / page width / actual size / custom), rotation (90° steps), thumbnail sidebar

- **File loading**: URL, local file, and drag-and-drop

- **Print & download**: print in a new window, download the current document

- **PDF conversion**: pure front-end OFD → PDF conversion with a live progress modal and automatic download (powered by toPdf.js)

- **Cross-platform**: works in modern browsers (Chrome 80+, Firefox 78+, Safari 14+, Edge 80+) and Node.js

- **Lightweight**: zero dependencies, no build step required, just serve static files

## Directory Structure

```
ofd-viewer/
├── build/
│   ├── ofd.js      # Core engine: OFD parsing, SVG rendering, file-digest comparison (SM3, IIFE, exposes global OFD)
│   ├── ofd.min.js  # Minified core engine (generated from ofd.js via terser)
│   └── toPdf.js         # OFD → PDF conversion (pure front-end, see docs/toPdf.md)
├── font/                # Supplemental fonts (auto-loaded for unmapped OFD font names)
├── web/
│   ├── viewer.html      # Viewer page
│   ├── viewer.css       # PDF.js-style styling
│   ├── viewer.js        # Application logic (vanilla JS, no framework)
│   └── images/          # SVG icons
├── docs/
│   ├── ofd.md           # Core engine docs (API, design philosophy, call flows)
│   ├── viewer.md        # Viewer docs (API, integration examples, call flows)
│   ├── toPdf.md         # OFD → PDF conversion docs (API, examples, limitations)
│   ├── ofd.zh-cn.md     # 核心引擎文档（中文）
│   ├── viewer.zh-cn.md   # 预览器文档（中文）
│   └── toPdf.zh-cn.md    # OFD → PDF 转换文档（中文）
└── test/
    ├── example-basic.html           # Core engine open-API demo (load / renderPage / getSignatures / verifySignature ...)
    ├── example-intro.html           # Core engine walkthrough (embedded docs + live demos)
    ├── benchmark.html               # Performance profiling (per-phase timing: load / template / page / signature / render)
    ├── example-topdf.html           # OFD → PDF conversion demo
    ├── example-seal.html            # Seal placement (third-party integration demo)
    └── ofdFile/                     # Sample OFD files (incl. GB/T 33190 conformance samples 6.1.x / 6.2.x, 999.ofd invoice)
```

## Browser Compatibility

| Browser | Minimum Version |
| ------- | --------------- |
| Chrome  | 80+             |
| Firefox | 78+             |
| Safari  | 14+             |
| Edge    | 80+             |

> **Note**: PDF conversion requires `CompressionStream` API (Chrome 80+, Firefox 113+, Safari 16.4+).

## Usage Notes

Before integrating the OFD viewer into your application, consider trimming the following to keep your bundle small:

- **`test/`** **folder**: test pages and sample OFD files, for demo purposes only

- **`docs/`** **folder**: project documentation, not required at runtime

After trimming, the viewer runs with just `build/ofd.js`, `build/toPdf.js`, `web/` and `font/`.

## File Size Reference

| File                | Description              | Size (approx.) |
| ------------------- | ------------------------ | -------------- |
| `build/ofd.js`      | Core engine (unminified) | \~113 KB       |
| `build/ofd.min.js`  | Core engine (minified)   | \~54 KB        |
| `build/toPdf.js`    | PDF conversion module    | \~60 KB        |
| `web/viewer.js`     | Viewer application logic | \~82 KB        |
| `web/viewer.css`    | Viewer styles            | \~42 KB        |

## Quick Start

No build required. Serve with any HTTP server (browsers cannot load OFD files via `file://`):

```bash
cd ofd-viewer
python -m http.server 8090
```

Open:

```
http://127.0.0.1:8090/web/viewer.html
```

### Alternative HTTP Servers

**Node.js (http-server):**

```bash
npx http-server -p 8090
```

**Node.js (serve):**

```bash
npx serve -p 8090
```

**PHP:**

```bash
php -S 127.0.0.1:8090
```

**Ruby:**

```bash
ruby -run -e httpd . -p 8090
```

## Usage

### URL Parameters

| Parameter | Description                                          |
| --------- | ---------------------------------------------------- |
| `file`    | OFD file URL, defaults to `../test/ofdFile/999.ofd`  |
| `page`    | Page to jump to after opening (1-based)              |
| `rotate`  | Initial rotation angle (multiples of 90°, clockwise) |
| `search`  | Open the search bar and run a search automatically   |

```text
http://127.0.0.1:8090/web/viewer.html?file=../test/ofdFile/999.ofd&page=3&rotate=90&search=发票
```

### Integrating into Third-Party Systems

The viewer mounts its extension capabilities on the global `OFD` object:

```js
// Listen to page changes
OFD.onPageChange((page, total) => console.log(page + '/' + total));

// Register a seal-retrieval callback (fires when the user clicks the "Seal" button)
OFD.onGetSeal(async () => {
  OFD.setSeal({ sealImg: await fetchSeal(), width: 40, height: 40 });
});

// Listen to seal changes and submit to the backend
OFD.onSealChange((list, action) => saveSeals(list));
```

## Core Engine API

```js
const ofd = await OFD.load('999.ofd');              // Load and parse
const svg = await OFD.renderPage(ofd, 0);           // Render a page as SVG DOM
const sigs = await OFD.getSignatures(ofd);          // Get digital signatures
const result = await OFD.verifySignature(ofd, 0);   // File-digest comparison (not full verification, see boundary below)
OFD.setFontBase('../assets/font/');                 // Override font/ directory URL
```

> **Verification boundary**: `verifySignature` currently performs **file-digest comparison only** — it compares the `References[].CheckValue` registered in the signature against freshly computed digests to detect whether protected files have been modified or are missing.
> **Not implemented**: signature-value verification (RSA / SM2 public-key verification), certificate-chain verification, timestamp (TSA) verification, and protection-scope / stowaway-file detection.
> `CheckValue` is stored inside the OFD file itself and can be recomputed along with tampered content, so `valid: true` only means the file is self-consistent — it **does not prove the signature is authentic**; seals and signature values are parsed for display only. The full boundary is documented in [docs/ofd.md](docs/ofd.md).

### Common Operations

**Load from different sources:**

```js
// From URL
const ofd = await OFD.load('https://example.com/document.ofd');

// From File input
const file = document.getElementById('fileInput').files[0];
const ofd = await OFD.load(file);

// From ArrayBuffer
const buffer = await fetch('document.ofd').then(r => r.arrayBuffer());
const ofd = await OFD.load(buffer);
```

**Render and display:**

```js
// Render as SVG string
const svgString = await OFD.renderPageToString(ofd, 0);
document.getElementById('container').innerHTML = svgString;

// Render as SVG DOM element
const svgElement = await OFD.renderPage(ofd, 0);
document.getElementById('container').appendChild(svgElement);

// Render all pages
const pages = await OFD.renderAll(ofd);
pages.forEach(page => container.appendChild(page));
```

**Get document information:**

```js
const pageInfo = OFD.getPageCount(ofd);           // Total pages
const dimensions = await OFD.getPageDimensions(ofd, 0); // { width, height, unit: 'mm' }
const docInfo = OFD.getDocumentInfo(ofd);          // Document metadata
```

## Documentation

### English

- [Core engine docs](docs/ofd.md): design philosophy, public API, call flows

- [Viewer docs](docs/viewer.md): design philosophy, extension API, full integration example

- [toPdf docs](docs/toPdf.md): API, examples, beta limitations

### 中文文档

- [核心引擎文档](docs/ofd.zh-cn.md)：设计理念、公开 API、函数调用流程

- [预览器文档](docs/viewer.zh-cn.md)：设计理念、对外接口、完整集成示例

- [OFD → PDF 转换文档](docs/toPdf.zh-cn.md)：API、示例、beta 版本限制

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Acknowledgments

This project draws on the following open-source projects and resources:

- [OFD parsing flow (CSDN blog)](https://blog.csdn.net/u013823545/article/details/108151914): OFD parsing flow reference

- [ofd.js](https://github.com/DLTech21/ofd.js): OFD parsing reference

- [ofdrw](https://github.com/ofdrw/ofdrw): OFD code reference

- [pdf.js](https://github.com/mozilla/pdf.js): viewer UI reference

## License

This project is licensed under the [Apache License 2.0](LICENSE). See the license file for details.

## Repository

- Gitee: <https://gitee.com/LaoJia803/ofd-core>

- GitHub: <https://github.com/LaoJia803/ofd-core>

