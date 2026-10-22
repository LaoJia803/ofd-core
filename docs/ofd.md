# ofd-core Core Engine — OFD Parsing and SVG Rendering

> Library name **ofd-core**; engine artifact `build/ofd/ofd.js`, global object `OFD`.
> Throughout this document `ofd.js` refers to the file and `OFD` to the global object.

## Overview

`build/ofd/ofd.js` is the core engine of the OFD online reader. It handles:

- **Parsing**: reads OFD (ZIP container) files — OFD.xml / Document.xml / pages / resources / signatures / annotations
- **Rendering**: renders each page as an SVG string or DOM element (text, paths, images, templates, seals)
- **Verification**: signature-value verification (GB/T 38540 SES `toSign` verified with the signer certificate's SM2 public key), file digest comparison (SM3/SHA), seal and certificate validity (checked against the signing time). Not included: certificate chain & trust anchors / revocation lookups / timestamp verification / the seal's own signature

The artifact is bundled from the ES modules in `ofd/` (`node build/build-ofd.js`, or `npm run build:ofd`). It mounts a global `OFD` object in browsers and also exports via CommonJS (`module.exports`).

Two shapes come out of the same build:

| | command | output |
| --- | --- | --- |
| Repository artifact | `npm run build:ofd` | `build/ofd/ofd.js` + `build/ofd/ofd.min.js` |
| npm package (`ofd-core`) | `npm run build:ofd-npm` | `dist/<version>/ofd/` (`lib/ofd.js` + `lib/ofd.min.js`, generated `package.json` / `README.md` / `LICENSE`) |

Rendering regressions are checked with `npm test`, which runs `test/golden.js --check` against both artifacts (20 documents, byte-identical SVG).

## Quick start

```html
<script src="build/ofd/ofd.min.js"></script>
<script>
  const ofd   = await OFD.load('document.ofd');   // URL / File / ArrayBuffer / Uint8Array
  const count = OFD.getPageCount(ofd);             // page count
  const svg   = await OFD.renderPage(ofd, 0);      // page 1 → SVG DOM element
  document.body.appendChild(svg);

  // digital signatures
  const sigs = await OFD.getSignatures(ofd);
  const r    = await OFD.verifySignature(ofd, 0); // { valid, status, message, checks }
</script>
```

Node.js (CommonJS):

```js
const fs  = require('fs');
const OFD = require('./build/ofd/ofd.js');
const ofd = await OFD.load(new Uint8Array(fs.readFileSync('a.ofd')));
const svg = await OFD.renderPageToString(ofd, 0);
```

**Runtime requirement**: `DecompressionStream` (Chrome/Edge 80+, Firefox 113+, Safari 16.4+, Node 18+).

### Algorithm verification

SM3 is a hand-written implementation, validated against the GB/T 32905-2016 standard test vectors:

```
SM3("abc")      = 66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0
SM3("abcd"×16)  = debe9ff92275b8a138604889c18e5a4d6fdb70e5387e5765293dcba39c0c5732
```

SM2 verification uses the `sm-crypto` npm package, bundled into the engine at build time (devDependency only — the artifact still has no runtime dependencies).

## Design

### Single-file IIFE, zero dependencies

The artifact is one IIFE with no runtime third-party dependency. XML parsing, SM3 hashing, ASN.1 parsing and the ZIP container reader are all hand-written; Deflate uses the browser-native `DecompressionStream`; SM2 verification uses `sm-crypto`, bundled at build time from a devDependency. Benefits:

- Small, fast, no dependency conflicts
- The same code runs in browsers and Node.js (`typeof window` to detect the environment)
- Source is maintained in layers as ES modules (`ofd/shared` / `ofd/core` / `ofd/display`) and bundled back into one file at build time with esbuild (see "Source Layout")

### Lazy parsing + caching

`load()` only parses document metadata (OFD.xml / Document.xml), resources, signatures/seals and annotations, and collects the page path list — **page contents are not parsed**. Each page's XML is parsed on first `renderPageToString` via `ensurePageParsed`, cached in the page object's `_parsed` field (templates likewise in `templates[i]._parsed`). This means:

- Large documents (1000+ pages) don't stall during load
- Only rendered pages consume memory
- Re-rendering a page hits the cache

Two more render-result caches sit on top:

- **Page SVG cache** (`ofd._svgCache`, keyed by `pageIndex`, max 256): the cache stores width-independent `head/mid/body`, so all `width` variants share one page body and only splice in the `width` attribute at render time; re-renders (paging, printing, search, PDF export) hit the cache.
- **Abbreviated path cache** (module-level `abbrPathCache`, max 4096): `abbreviatedToSvgPath` memoizes by raw path string.

> Both caches are implemented by the module's `LRUCache` class (`ofd/shared/lru.js`): on hit the key moves to the tail; on overflow **the single oldest entry is evicted** (standard LRU).

### SVG vector rendering

SVG rather than Canvas:

- No distortion when scaling — right for documents
- Text is selectable and searchable
- DOM is interactive; signature regions can carry events
- Coordinate system matches OFD naturally (Y down, millimetre user units)

### Layering

Three source layers, split by "does it touch the DOM?", not by line count:

| Layer | Responsibility | Representative files |
| --- | --- | --- |
| shared | stateless utilities | `util.js` (profiling), `xml.js`, `path.js`, `color.js`, `lru.js` |
| core | binary + structure parsing, no document/window | `zip.js`, `parser.js`, `image.js`, `md.js`, `seal.js`, `asn1.js`, `verify.js`, `res.js`, `page.js`, `signature.js`, `outline.js`, `annotation.js`, `document.js` |
| display | rendering + public API, the only DOM/FontFace layer | `font.js`, `svg.js`, `api.js` |

The parsing layer produces plain data objects; the rendering layer consumes them and emits SVG strings. No reverse dependencies.

### On-demand images

`load()` does not preload images. When rendering a page, `renderPageToString` collects the image IDs it needs and loads them in parallel (`ensureImageDataUrl`, `Promise.allSettled`), caching the result in `mm.dataUrl` for later reuse.

## Call Flow

### Loading

```
OFD.load(source)
  ├─ read file data (fetch / Blob / ArrayBuffer → Uint8Array)
  ├─ readZip(data)                        → zip handle
  └─ parseOFD(zip)
       └─ parseDocument(zip)
            ├─ readEntryText(zip, 'OFD.xml')     → DocInfo + Version
            ├─ readEntryText(zip, docPath)       → Document.xml
            │    ├─ parseBox()                   → page size pageBox
            │    ├─ DefaultCS                    → default colour space
            │    ├─ parseRes(publicRes, zip, defaultCs)   → shared resources
            │    ├─ parseRes(documentRes, zip, defaultCs) → document resources (merged)
            │    ├─ parseCompositeUnits(resPath, zip, ctx) → CompositeGraphicUnit
            │    └─ collect page path list (contents unparsed)
            ├─ parseSignatures(signaturesPath, zip)        → signatures / seals / ASN.1
            ├─ parseAnnotations(annotationsPath, zip, ctx) → annotations (incl. generic Appearance)
            └─ parseOutline / parseOutlineFromXml          → outline tree (embedded Outlines, else Document_Structure.xml)
```

### Rendering

```
OFD.renderPageToString(ofd, pageIndex, opts)
  ├─ return ofd._svgCache hit if present
  ├─ ensurePageParsed(ofd, pageIndex)     → parse page XML (cached in _parsed)
  ├─ assemble layers: background templates → page layers → foreground templates
  ├─ prefetch: images (ensureImageDataUrl), fonts (ensureFontLoaded + fetchFontIndex)
  ├─ renderObject per object
  │    ├─ buildPathObject    path / stroke / fill / gradients
  │    ├─ buildTextObject    text (font mapping + DeltaX/DeltaY + HScale/direction/stroke)
  │    ├─ buildImageObject   image (full CTM)
  │    └─ applyClips         object-level Clips (Path/Text areas)
  ├─ renderStamp / renderAnnot            → seals and annotation overlays
  └─ assemble <svg viewBox="0 0 W H"> and cache
```

### Signature verification (signature value + digest + validity periods)

```
OFD.verifySignature(ofd, index)
  ├─ take doc.signatures[index]
  ├─ read signedValuePath → parseSesSignBlocks locates the SES block
  │    [toSign SEQUENCE, certificate OCTET, algorithm OID, signature BIT STRING]
  ├─ extractCertPublicKey reads the SM2 key from the cert SPKI → `sm2.doVerifySignature` verifies the raw toSign DER
  ├─ for each reference: readEntry(zip, fileRef) → hashBytes(data, checkMethod)
  ├─ compare recomputed digest against base64ToBytes(checkValue)
  ├─ checkPeriods: is signTime inside sealAttrs.notBefore~notAfter?
  │               is signTime inside each certificate's Validity? (collectCerts → extractCertValidity)
  └─ aggregate into { valid, status, checks: { sigValue, digest, sealPeriod, certPeriod } }
       ├─ sigValue 'pass', other items not 'fail' → { valid: true,  status: 'valid' }
       ├─ any digest/period failure               → { valid: false, status: 'invalid' }
       ├─ digest 'pass' but sigValue 'unknown'    → { valid: false, status: 'partial' }
       └─ nothing to check                        → { valid: false, status: 'unknown' }
```

## Usage

Browser:

```html
<script src="build/ofd/ofd.js"></script>
<!-- or the minified build -->
<script src="build/ofd/ofd.min.js"></script>
```

Node.js (ZIP inflation needs `DecompressionStream`, so Node 20+):

```js
const OFD = require('./build/ofd/ofd.js');
```

From the npm package (built by `npm run build:ofd-npm`, published as `ofd-core`):

```js
const OFD = require('ofd-core');
```

## Core Data Structures

The `ofd` object returned by `load()`:

```js
{
  info,                 // document metadata (source of getDocumentInfo)
  document: {
    docPath,            // directory of Document.xml — base for relative paths
    version,            // OFD.xml Version (e.g. "1.1") — drives Clips TransFlag default
    defaultCs,          // CommonData/DefaultCS colour space id
    pageBox,            // default page size { x, y, w, h } (mm)
    templates,          // template pages; lazy parse result cached in each element's _parsed
    templateById,       // Map: template id → template object
    pages,              // page list [ { id, baseLoc, _parsed } ] — parsed lazily, see below
    res,                // resource table, see below
    stamps,             // seal overlays (signatures / annotations)
    signatures,         // raw signature data (source of getSignatures)
    outlines,           // outline tree
  },
  zip,                  // zip handle (for readEntry / readEntryText)
  _svgCache,            // per-instance SVG LRU, created on first render
}
```

Resource table `document.res`:

```js
{
  fonts:        {},     // id → { fontName, fontFile, fontBaseDir, ... }
  colorSpaces:  {},     // id → { type: GRAY|RGB|CMYK, bits, palette: [[...]] }
  multiMedias:  {},     // id → image object (type/format; dataUrl filled at render time)
  drawParams:   {},     // id → drawing params (line width/cap/join/miter/dash + stroke/fill gradients)
  compositeUnits: {},   // id → CompositeGraphicUnit (lazy _templateObj, parsed page-like block)
}
```

Parsed page (cached in `pages[i]._parsed`):

```js
{
  pagePath,
  pageBox,              // page Area/PhysicalBox, falls back to the document pageBox
  templates,            // [ { templateId, zOrder } ], zOrder defaults to 'Background'
  layers: [ { objects: [ ... ] } ],   // objects: path / text / image
}
```

## Public API

### OFD.load(source)

Loads and parses an OFD file, returns the `ofd` object.

| Param | Type | Description |
| --- | --- | --- |
| source | `string` \| `Blob` \| `File` \| `ArrayBuffer` \| `Uint8Array` | strings are treated as URLs (`fetch`; `javascript:`/`file:`/`data:` are rejected); anything else is a binary data source |

```js
// from a URL
const ofd = await OFD.load('sample.ofd');

// from <input type="file">
const file = document.getElementById('fileInput').files[0];
const ofd = await OFD.load(file);

// from an ArrayBuffer
const buf = await fetch('sample.ofd').then(r => r.arrayBuffer());
const ofd = await OFD.load(buf);
```

### OFD.renderPageToString(ofd, pageIndex, opts)

Renders a page to an SVG string.

| Param | Type | Description |
| --- | --- | --- |
| ofd | object | return value of `load()` |
| pageIndex | number | 0-based page index |
| opts.width | number | optional `width` attribute for the `<svg>` (otherwise the container decides) |

```js
const svg = await OFD.renderPageToString(ofd, 0);
document.getElementById('container').innerHTML = svg;
```

### OFD.renderPage(ofd, pageIndex, opts)

Same as `renderPageToString` but returns a **mounted SVG DOM element**. Without a DOM (Node) it falls back to returning the SVG string.

| Param | Type | Description |
| --- | --- | --- |
| ofd | object | return value of `load()` |
| pageIndex | number | 0-based page index |
| opts.width | number | optional `width` attribute (px) |

```js
const svgEl = await OFD.renderPage(ofd, 0);
document.getElementById('container').appendChild(svgEl);
```

### OFD.renderAll(ofd, opts)

Renders every page, returns an array of SVG elements in page order.

```js
const pages = await OFD.renderAll(ofd);
pages.forEach(svg => container.appendChild(svg));
```

### OFD.getPageCount(ofd)

Returns the page count.

```js
const total = OFD.getPageCount(ofd);
```

### OFD.getPageDimensions(ofd, pageIndex)

Returns `{ width, height, unit: 'mm' }`. `pageIndex` defaults to 0.

```js
const dim = await OFD.getPageDimensions(ofd, 0);
```

### OFD.getDocumentInfo(ofd)

Returns `{ pageCount, ...info }` (document metadata merged in).

```js
const info = OFD.getDocumentInfo(ofd);
```

`info` fields: `docId`, `title`, `author`, `subject`, `creator`, `producer`, `creationDate`, `modDate`, `customDatas`. Date fields are raw strings, not formatted.

### OFD.expandDelta(str)

Expands an OFD `DeltaX/DeltaY` delta string (whitespace-separated numbers) into an array, used for per-glyph text placement. Supports the `g N V` repeat syntax (the next N deltas all take V).

```js
OFD.expandDelta('0 5.2 3.1 -2.0');   // [0, 5.2, 3.1, -2]
OFD.expandDelta('g 3 1.5 0.2');      // [1.5, 1.5, 1.5, 0.2]
```

### OFD.getSignatures(ofd)

Returns the signature list (parsed from `Signatures.xml`):

```js
{
  index,               // 0-based
  id,                  // signature id
  signer,              // certificate subject / seal name / provider, by priority
  signTime,            // formatted, e.g. 2020-08-17 11:13:29
  provider,
  providerVersion,
  checkMethod,         // digest algorithm OID
  signatureMethod,     // signature algorithm OID
  digestMethod,        // digest algorithm OID
  references: [        // protected files and their digests
    { fileRef, checkValue }
  ],
  signedValuePath,
  signedValueSize,
  signaturePath,
  signatureDigest,
  signatureValueHex,
  sealAttrs,           // { id, name, type, createTime, notBefore, notAfter }
  certValidity,        // certificate validity periods [{ notBefore, notAfter }] (formatted); [] when absent
  pages: [],           // page numbers carrying the seal (1-based)
  positions: [
    { page, boundary } // page 1-based; boundary in page coordinates
  ],
  sealImage,           // { type: 'image'|'svg', data } or null
}
```

### OFD.verifySignature(ofd, index)

Verifies signature `index`:

```js
{
  valid,        // boolean
  status,       // 'valid' | 'invalid' | 'unknown'
  message,      // human-readable conclusion
  digestValid,  // all digests matched (absent when status is 'unknown')
  checked,      // files that passed
  failed,       // files that failed (with reasons)
  checks: {     // per-item results, each 'pass' | 'fail' | 'unknown'
    sigValue,    // signature-value verification (SM2 over the raw toSign DER)
    digest,      // file digest comparison
    sealPeriod,  // seal validity covers the signing time
    certPeriod,  // certificate validity covers the signing time
  },
}
```

Rule: `valid = no item is 'fail'`. Missing data yields `unknown` — it never fails the signature but is reported in `message` (e.g. "未找到 SES 签名块", "印章有效期无数据，未校验").

**Validity is judged at the signing time**, using `SignedInfo/SignatureDateTime` — not the current date. A certificate or seal that expires today says nothing about a signature made years earlier.

```js
const res = await OFD.verifySignature(ofd, 0);
console.log(res.status, res.checks, res.message);
```

> **Important**: signature-value verification (SM2/SM3), digest comparison and validity periods are implemented. Still missing: **certificate chain and trust anchors, revocation status (CRL/OCSP), timestamp verification and the seal's own signature**. The SM2 library is bundled, so `checks.sigValue` returns `pass`/`fail` whenever the signature is GB/T 38540 SES with a usable public key, and `unknown` otherwise (non-SES structure, missing `SignedValue`, unsupported algorithm OID). Note also that `CheckValue` lives inside the OFD file and can be recomputed after tampering — real trust comes from the signature value plus a valid certificate (see the comment at the top of `ofd/core/verify.js`).

### OFD.setProfiling(on) / OFD.getLastProfile()

Profiling switch and result reader; prints per-stage timings via `console.table`.

```js
OFD.setProfiling(true);
await OFD.renderPageToString(ofd, 0);
const p = OFD.getLastProfile();
// { title: '…', rows: [ { stage, deltaMs, totalMs }, ... ] }
OFD.setProfiling(false);
```

### OFD.setFontBase(base)

Sets the external font directory URL prefix (ending in `/`). Fonts are tried as `encodeURIComponent(name) + '.ttf|otf|woff2'`.

Default is inferred: the engine `<script>` (it matches **both** `ofd.js` and `ofd.min.js`) is used to locate the package root, then `font/` is appended — `build/ofd/ofd.min.js` and the flat `build/ofd.min.js` in the release zip both resolve to `<root>/font/`, while the npm package's `lib/ofd.min.js` resolves to the package-root `font/`. `npm run build` also creates that root `font/` (with a `README.txt` placeholder), so dropping font files there works without calling `setFontBase`.

```js
OFD.setFontBase('assets/font/');   // only needed when the font directory lives elsewhere
```

> **External fonts require a directory listing.** The engine builds its font index by parsing the directory HTML for file `href`s — so the folder must be served with a listing enabled (e.g. nginx `autoindex on`, or `serve` / `http-server`'s default index page). A static server that does not list the directory 404s on the folder fetch, `fetchFontIndex()` returns `null`, and external fonts won't load even when the files are present.
> When the directory is absent or unlistable, rendering degrades silently to OFD-embedded fonts and the built-in system-stack mapping (a declared-but-unloadable embedded font also falls back to the system stack). Only supply external fonts for OFDs whose embedded fonts are missing or incomplete.

### OFD.version

String, e.g. `"1.0.0"`. Injected at build time from `package.json` `version` (also mirrored in the file's banner comment and the `dist` zip name), so it always matches the released version.

### OFD.\_internals

Unstable, kept only for existing consumers:

```js
OFD._internals = {
  parsePage, readEntry, readEntryText, resolvePath,
  parseXml, hashBytes, base64ToBytes, decodeEntities
};
```

- `build/ofd2pdf/ofd2pdf.js` uses `base64ToBytes`, `decodeEntities`
- `test/benchmark.html` uses the other six

Use the public API in new code; for debugging internals, set breakpoints in the source instead.

## Source Layout

```
ofd/                    engine source, module 1 (ES modules; cross-file deps declared with import/export)
├─ shared/              utilities: util.js profiling / xml.js nodes / path.js paths / color.js colors / lru.js LRU
├─ core/                parsing: zip / parser / image / md(SM3) / seal / asn1 / verify
│                       res / page / signature / outline / annotation / document
├─ display/             rendering: font / svg / api
└─ index.js             public API assembly (OFD object + _internals whitelist); esbuild entry point

ofd2pdf/                OFD → PDF library source, module 2 (ES modules; bundled to build/ofd2pdf/ofd2pdf.js)
├─ index.js             public API: ofdToPdf / svgToPdf
├─ core/                constants, CSS colour parsing, platform bridge, basic helpers
├─ pdf/                 render.js (SVG → content stream), writer.js, docstring.js
├─ svg/                 XML parsing, transforms, path conversion
└─ image/               PNG / BMP / GIF / JPEG decoding, XObject emission (xobject.js owns the size guard)

pdf2ofd/                PDF → OFD library source, module 3 (ES modules, Node only; bundled to build/pdf2ofd/pdf2ofd.js)
├─ index.js             convert() orchestration
├─ core/                pdf.js locator, affine matrices / units, pdf.js image → RGBA
├─ ops/                 operator walker: state / geometry / clip / text / path / image / shading
├─ res/                 colour helpers, gradient & pattern colour prefetch
├─ ofd/                 package assembly: package.js / png.js / xml.js / zip.js
└─ font/                compiled-font parsing, cmap rebuilding, naming

build/
├─ common.js            shared build layer: paths/version, esbuild + terser wrappers, ZIP writer, distTransform()
├─ build-ofd.js         esbuild → build/ofd/ofd.js, terser → build/ofd/ofd.min.js
├─ build-ofd2pdf.js     → build/ofd2pdf/ofd2pdf.js / .min.js
├─ build-pdf2ofd.js     → build/pdf2ofd/pdf2ofd.js / .min.js (CommonJS, Node)
├─ build-viewer.js      runs build-ofd + build-ofd2pdf, then zips the viewer → dist/<version>/
├─ build-*-npm.js       the three npm packagers → dist/<version>/<module>/
├─ ofd/                 engine artifacts
├─ ofd2pdf/             OFD → PDF artifacts
└─ pdf2ofd/             PDF → OFD artifacts

font/                   external font drop-in; created by `npm run build`, auto-detected as the external font directory (see `OFD.setFontBase`)
```

> Module evaluation order now follows the `import` graph, so there is no hand-maintained file list.
> Historically the old single `build.js` pinned an order because `class LRUCache` (`ofd/shared/lru.js`) is not
> hoisted while `ofd/display/svg.js` constructs one at top level; `svg.js` now does
> `import { LRUCache }` and ESM guarantees the dependency is evaluated first.
>
> Two conventions still hold:
> - **Never reference `module` / `exports` inside the ESM sources (`ofd/`, `ofd2pdf/`, `pdf2ofd/`).** esbuild then classifies the entry as
>   CommonJS and wraps it in a fake `module` object, so `module.exports = OFD` lands on the inner
>   one and Node's `require()` returns an empty object. The CJS bridges live in each build script's `TAIL`
>   (`build/build-ofd.js` and friends), which is real file scope.
> - **Third-party code is a normal ES import.** `ofd/core/verify.js` does `import { sm2 } from "sm-crypto"`;
>   esbuild inlines it from `node_modules` into the IIFE, so the artifact has no bare globals or runtime
>   `require`. `sm-crypto` stays a devDependency — it is only needed to build.

## Render Pipeline

1. **Layer compositing**: background templates → page Content layers → foreground templates (`zOrder="Foreground"`), concatenated in order
2. **Paths**: OFD abbreviated paths → `abbreviatedToSvgPath` tokenising → SVG `d`; fill/stroke/cap/dash/clip resolved via `drawParams`
3. **Text**: font name → `mapFontFamily` (built-in stack / local font / external font) → `<text>`; per-glyph positions from `expandDelta(DeltaX/DeltaY)`
4. **Images**: `ensureImageDataUrl` converts TIFF/JPEG/BMP to data URLs (TIFF has its own LZW decoder and BMP wrapper) for `<image href>`
5. **Seals & annotations**: signature seals via `renderStamp` (embedded OFD seal → SVG or bitmap), annotations via `renderAnnot`
6. **Output**: `<svg viewBox="0 0 W H" class="ofd-page-svg">`, W/H in millimetres

## Key Internal Mechanisms

- **Relative paths**: `resolvePath(base, rel)` resolves against `docPath`, handling `..` and absolute paths
- **Colours**: `parseColor(el, res, defaultCs)` reads `Value` (space-separated components, each decimal or `#`-prefixed hex, e.g. `"#ee #20 #25"`) plus the `ColorSpace` id (falling back to `DefaultCS`) and `Alpha`; the referenced colour space decides GRAY/RGB/CMYK and component scaling (`BitsPerComponent`), and `Index` picks a `Palette` `CV` entry. `colorToCss` serialises the result and memoises it in `_colorCache` (256 entries)
- **Fonts**: `font.js` loads fonts with `FontFace`, dedupes via `fontLoadCache`, registers OFD-embedded fonts in `embeddedFontMap` (filled by `parseOFD`) and reads the external index via `fetchFontIndex`; `parseDocument` calls `resetFontCaches()` before registering a new document, which clears those caches and removes the `ofdf_*` faces from `document.fonts`, so opening a second document never reuses the first one's fonts
- **ZIP**: `readZip` scans the central directory, `readEntry` caches inflated entries (`LRUCache`), `readEntryText` decodes UTF-8
- **Digests**: `md.js` implements SM3; `hashBytes(data, method)` dispatches by OID (SM3 / SHA family)

## Security and robustness

This engine parses untrusted OFD files. The mitigations below are implemented, but **the code has not undergone professional security auditing**. Evaluate the risk yourself before processing files from external sources.

### Implemented mitigations

| Risk | Countermeasure | Location |
| --- | --- | --- |
| Decompression bomb | Per-entry uncompressed size capped at **256 MB**, checked once against the declared size and again against the actual result | `core/zip.js` `MAX_UNCOMPRESSED_SIZE` |
| Memory growth | ZIP entry cache capped at **64 entries** (LRU); SVG page cache 256; abbreviated-path cache 4096; colour cache flushed at 256 | `core/zip.js`, `display/api.js`, `display/svg.js`, `shared/color.js` |
| Malicious URLs | `javascript:` / `file:` / `data:` protocols rejected | `display/api.js` `load()` |
| Malformed XML entities | Character references are range-checked; surrogates and out-of-range code points yield U+FFFD instead of throwing `RangeError` | `core/parser.js` `decodeEntities` |
| Tag mismatch | A closing tag that doesn't match the stack top raises an explicit error (with tag names and position) rather than silently producing a broken tree | `core/parser.js` `parseXml` |
| One bad element sinking everything | Signature, annotation and outline parsing are individually wrapped in `try/catch`; image decode failures return `null` | `core/document.js`, `core/image.js` |
| ZIP64 | Explicitly detected and reported as unsupported rather than misreading offsets | `core/zip.js` |

### Not covered

- **Anomalous compression ratios**: only absolute size (256 MB) is capped, not the ratio. A high-ratio entry can still consume CPU.
- **Parser complexity attacks**: the XML parser is a single linear pass with no nesting-depth limit. Deeply nested XML can exhaust stack space.
- **Image decoders**: the TIFF/LZW decoder in `core/image.js` is hand-written; TIFF is capped at 32MP, BMP output at 160MB, and LZW output per strip is bounded, but untrusted files should still be handled with care.
- **Verification is not trust**: see below.

## Signature verification boundaries

The most easily misused part of this project. Please read fully.

### Implemented

| Check | Method |
| --- | --- |
| **SM2 signature value** | Parses the GB/T 38540 SES structure and verifies the **original DER bytes** of `toSign` with the signer's SM2 public key |
| **File digests** | Walks `References[]`, recomputes each digest (`CheckMethod`: SM3 / SHA-1 / 256 / 384 / 512) and compares byte-for-byte with `CheckValue` |
| **Validity periods** | Whether the seal's `notBefore`/`notAfter` and **every** embedded certificate's `Validity` covers the **signing time** |

Signature algorithms other than OID `1.2.156.10197.1.501` (SM2withSM3) return `unknown` rather than `fail`.

Validity is judged against the **signing time** (`SignatureDateTime`), not the current time — a certificate that has since expired was still valid when it was used.

### Not implemented

- **Certificate chain and trust-root validation**
- **Revocation status** (CRL / OCSP)
- **Timestamp (TSA) verification**
- **Verification of the seal's own signature**

### Why `valid: true` does not mean "trusted"

The signing certificate is **trusted as-is** — the code extracts it from `SignedValue`, verifies with its public key, and **never builds a chain or consults a trust store**. Anyone can generate a key pair, self-sign a certificate, and pass verification.

Furthermore, `CheckValue` digests live **inside** the OFD file, so an attacker who modifies content can recompute them. "Digest matches" only proves the file is self-consistent; **signature-value verification is the actual basis for identity and integrity**.

### Return shape

```js
const r = await OFD.verifySignature(ofd, 0);
// {
//   valid: false,
//   status: 'invalid' | 'unknown' | 'partial', // 'valid' accompanies valid: true;
//                                  // 'partial' = digest passed, signature value unverified
//   message: '验证失败：Doc_0/xxx.xml（摘要不一致）',
//   digestValid: false,
//   checked: ['Doc_0/a.xml', ...],
//   failed:  ['Doc_0/b.xml（文件缺失）', ...],
//   checks: {
//     digest:     'pass' | 'fail' | 'unknown',
//     sigValue:   'pass' | 'fail' | 'unknown',
//     sealPeriod: 'pass' | 'fail' | 'unknown',
//     certPeriod: 'pass' | 'fail' | 'unknown',
//   },
// }
```

`status: 'unknown'` means **insufficient data to judge**, not "verified". UI must distinguish it from `valid` — never render `unknown` as a pass.

One compatibility detail: some Chinese-vendor SDKs write digests into a fixed-size buffer (128 bytes observed) and pad the tail with zeros, so `CheckValue` can be longer than the digest itself. `digestMatches()` accepts that all-zero-tail form and compares only the first `digest.length` bytes.

## Implementation notes

These are decisions made after hitting real problems. Read the code comments before changing any of them — most are counter-intuitive.

### Embedded font keys must match the generated family names

The keys written by `registerEmbeddedFonts()` must **exactly match** the family names produced by `mapFontFamily()`, or `loadFontFace()` will miss when it looks the embedded font back up.

`mapFontFamily` uses `uniqueFamily(fontId, v.base)`, where `v.base` is the name **after `splitFontVariant()` strips the variant suffix**:

```
res.fonts[1289].fontName = "DengXian-Regular"
                           ↓ strip "-Regular"
mapFontFamily produces   = "ofdf_1289_DengXian"
```

If `registerEmbeddedFonts` registers the **raw** name, the key becomes `ofdf_1289_DengXian-Regular` — a miss.

**The failure chain** (this is exactly what "every font renders as SimHei" looks like):

```
lookup misses → emb = null
  → falls back to fetchFontIndex() against the font/ directory
  → that directory doesn't exist, catch(() => null) returns silently
  → new FontFace() never registered
  → CSS falls through to the last family: sans-serif
  → on Windows, sans-serif resolves to **SimHei**
```

**Symptom**: every font in the document suddenly becomes SimHei/sans-serif even though `res.fonts` clearly has `fontFile` entries.

**Fix**: `registerEmbeddedFonts()` registers four keys — `ofdf_<id>_<base>`, `ofdf_<id>_<rawName>`, bare `<base>`, and bare `<rawName>`. `hasEmbeddedFont()` tries both base and raw forms. `loadFontFace()` must not build a bogus `ofdf_<id>_<id>` key.

### Embedded fonts must be keyed by Font ID

OFD allows the same `FontName` to be declared multiple times with different IDs pointing at different font files. One document had 5 distinct IDs (121–125) all named `Calibri`, each with a completely different cmap and glyph set.

Keying on `fontName` alone means `ensureFontLoaded('Calibri')` loads only the first; the other four never register an `@font-face`. Browsers silently fall back to system fonts, scrambling glyphs and metrics.

**The fix**: family names are made unique as `ofdf_<FontID>_<FontName>` (`uniqueFamily`), and cmaps are cached under that same unique name.

### Font priority: embedded > system stack > local > external directory

The old order preferred system fonts, mapping Helvetica to system Arial and Calibri to system Calibri so embedded fonts never loaded. `mapFontFamily` now prefers embedded fonts.

Committing to an embedded font is gated on it actually loading: `mapFontFamily` locks the `ofdf_<id>_<name>` family only when `loadFontFace()` succeeded (tracked in `embeddedLoaded`). A font that is *declared* embedded but whose file is missing from the package no longer dead-locks on an unregistered `@font-face` — it falls through to the system stack / local font / external `font/` directory, matching what WPS and the PDF original render.

### Register embedded fonts *before* collecting font names

In `renderPageToString`, `registerEmbeddedFonts(doc.res.fonts)` must run **before** font names are collected. `hasEmbeddedFont()` depends on `embeddedFontMap`; reversing the order makes every font look non-embedded.

### Glyphless characters: confirmed by cmap *and* Glyphs

Subset fonts use many **private-use-area pseudo-codes** (U+E000–U+E0FF). In one Calibri-Bold subset, `n/k/h/c/o/A` are absent from the cmap, replaced by an equal number of PUA entries.

The correct test (skip only when both agree):

1. the cmap has no entry for the code point (`hasGlyphFor` is false), **and**
2. the corresponding `Glyphs` slot holds a placeholder gid (`gid === 1`) or there is no Glyphs info

Checking only the cmap kills real body text (117 false positives observed). Checking only `gid === 1` misses cases — a `#` on page 11 of one document had gid 17 and got drawn.

Skipped characters still **advance `DeltaX`**, so following characters keep their absolute positions.

### Combined CTM and coordinate transform

An element's actual position is `Boundary` origin + `CTM·(local coords)`. Rendering always uses:

```
translate(boundary.x boundary.y) matrix(a b c d e f)
```

Expanding a `CompositeObject` additionally cancels the Unit's local origin:

```
translate(obj.boundary) · obj.ctm · translate(-unit.boundary)
```

### Template layer order

Background templates (`zOrder != "Foreground"`) → page Content layers → foreground templates. Reversing this lets foreground templates be painted over.

### Only strip XML indentation from `text`

`TextCode` text must have XML formatting newlines stripped, but **in-line leading/trailing spaces must be kept** — they occupy `DeltaX` slots, and deleting them merges following glyphs at narrow spacing.

### Stroked lines are exempt from clip-region culling

Table borders span whole rows or columns and are often emitted before the cell clip region exists, or span several of them. Culling them by clip region removes large numbers of legitimate borders.

## Troubleshooting

### Fonts

**Symptom: every font renders as SimHei / sans-serif**

Almost always an embedded-font lookup miss. Diagnose:

```js
const ofd = await OFD.load('doc.ofd');
const fonts = ofd.document.res.fonts;
console.log('total fonts', Object.keys(fonts).length);
console.log('with embedded file', Object.values(fonts).filter(f => f.fontFile).length);
```

`fontFile` present yet everything renders as SimHei → check whether the keys written by `registerEmbeddedFonts` match the family names produced by `mapFontFamily` (see "Implementation notes" above).

Rendered `font-family` should read `"ofdf_<FontID>_<BaseName>"`. Bare font names or a stack like `Arial,Helvetica,sans-serif` mean that font didn't match an embedded file.

**Symptom: wrong glyphs / garbled text**

Only the first of several same-named font IDs takes effect — see "Embedded fonts must be keyed by Font ID".

**Symptom: a character renders as a different symbol**

The subset font has no outline for that code point. The engine already drops glyphless characters using a cmap + Glyphs double check, but if the **converter** emitted private-use pseudo-codes as real characters, glyphs will still be wrong — that's a `pdf2ofd.js` (conversion-side) issue, not a rendering one.

### Rendering

**Symptom: an entire page is blank or clipped away**

The engine reads and applies `<ofd:Clips>` on graphic objects (multiple Clips intersect; Areas within one Clip union; `TransFlag` controls whether the object's own CTM affects the clip). The `pdf2ofd` converter, however, does not emit `<ofd:Clips>` (see the PDF→OFD doc). If a whole page is clipped away, first check that the Clip paths and their `Boundary/CTM` are what you expect.

**Symptom: one page fails to render while others are fine**

Per-page parse failures usually degrade to an empty page rather than throwing. Locate it with profiling:

```js
OFD.setProfiling(true);
await OFD.renderPage(ofd, 10);
console.table(OFD.getLastProfile());
```

### Signature verification

**Symptom: `status: 'unknown'`**

That is **not** a pass — it means there wasn't enough data to judge. Common causes: the signature algorithm is not `1.2.156.10197.1.501` (SM2withSM3), `SignedValue` is missing, or the signed file carries no `References` digests. UIs must render it distinctly from `valid`.

**Symptom: I modified the file but the digest check still passes**

`CheckValue` lives **inside** the OFD file and can be recomputed alongside tampered content. "Digest matches" only proves the file is self-consistent; signature-value verification (`checks.sigValue`) is the actual integrity basis.

## Notes

1. Sizes are **millimetres**; `pageIndex` is **0-based** everywhere (except `getSignatures`' `pages` / `positions.page`, which are 1-based)
2. `verifySignature` boundaries — see "Signature verification boundaries" above
3. The external font directory is not shipped — create it and point `setFontBase` at it; absence degrades silently
4. The `ofd` object is an opaque handle — pass it around, don't read its fields
5. The `_internals` allowlist may change; it exists for `ofd2pdf.js` and the benchmark page
6. Node.js requires **18+** (`DecompressionStream`)
7. ZIP64 is not supported and reports so explicitly
