# ofd.js — OFD Parsing and Rendering Engine

## Overview

`build/ofd.js` is the core engine of the OFD online reader. It handles:

- **Parsing**: reads OFD (ZIP container) files — OFD.xml / Document.xml / pages / resources / signatures / annotations
- **Rendering**: renders each page as an SVG string or DOM element (text, paths, images, templates, seals)
- **Verification**: file digest comparison (SM3/SHA), ASN.1 certificate/signature structure parsing, seal extraction (no signature-value / certificate-chain / timestamp verification)

The artifact is assembled from `src/` fragments (`node build/build.js`). It mounts a global `OFD` object in browsers and also exports via CommonJS (`module.exports`).

## Design

### Single-file IIFE, zero dependencies

The artifact is one IIFE with no runtime third-party dependency. XML parsing, SM3 hashing, ASN.1 parsing and the ZIP container reader are all hand-written; Deflate uses the browser-native `DecompressionStream`. Benefits:

- Small, fast, no dependency conflicts
- The same code runs in browsers and Node.js (`typeof window` to detect the environment)
- Source is maintained in layers (`src/shared` / `src/core` / `src/display`) and concatenated back into one file at build time (see "Source Layout")

### Lazy parsing + caching

`load()` only parses document metadata (OFD.xml / Document.xml), resources, signatures/seals and annotations, and collects the page path list — **page contents are not parsed**. Each page's XML is parsed on first `renderPageToString` via `ensurePageParsed`, cached in the page object's `_parsed` field (templates likewise in `templates[i]._parsed`). This means:

- Large documents (1000+ pages) don't stall during load
- Only rendered pages consume memory
- Re-rendering a page hits the cache

Two more render-result caches sit on top:

- **Page SVG cache** (`ofd._svgCache`, keyed `pageIndex|width`, max 256): final SVG strings hang off the ofd instance, so re-renders (paging, printing, search, PDF export) return in ~0ms.
- **Abbreviated path cache** (module-level `abbrPathCache`, max 4096): `abbreviatedToSvgPath` memoizes by raw path string.

> Both caches are implemented by the module's `LRUCache` class (`src/shared/lru.js`): on hit the key moves to the tail; on overflow **the single oldest entry is evicted** (standard LRU).

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
            ├─ readEntryText(zip, 'OFD.xml')     → document info
            ├─ readEntryText(zip, docPath)       → Document.xml
            │    ├─ parseBox()                   → page size pageBox
            │    ├─ parseRes(publicRes)          → shared resources
            │    ├─ parseRes(documentRes)        → document resources (merged)
            │    └─ collect page path list (contents unparsed)
            ├─ parseSignatures(zip)              → signatures / seals / ASN.1
            ├─ parseOutline(zip)                 → outline tree
            └─ parseAnnotations(zip)             → annotations (stamp overlays)
```

### Rendering

```
OFD.renderPageToString(ofd, pageIndex, opts)
  ├─ return ofd._svgCache hit if present
  ├─ ensurePageParsed(ofd, pageIndex)     → parse page XML (cached in _parsed)
  ├─ assemble layers: background templates → page layers → foreground templates
  ├─ prefetch: images (ensureImageDataUrl), fonts (ensureFontLoaded + fetchFontIndex)
  ├─ renderObject per object
  │    ├─ renderPathObject   path / stroke / fill / clip
  │    ├─ renderTextObject   text (font mapping + DeltaX/DeltaY per-glyph placement)
  │    └─ renderImageObject  image
  ├─ renderStamp / renderAnnot            → seals and annotation overlays
  └─ assemble <svg viewBox="0 0 W H"> and cache
```

### Signature verification (digest comparison only)

```
OFD.verifySignature(ofd, index)
  ├─ take doc.signatures[index]
  ├─ for each reference: readEntry(zip, fileRef) → hashBytes(data, checkMethod)
  └─ compare recomputed digest against base64ToBytes(checkValue)
       ├─ all match      → { valid: true,  status: 'valid',   checked, failed: [] }
       ├─ mismatch       → { valid: false, status: 'invalid', checked, failed }
       └─ nothing to check → { valid: false, status: 'unknown' }
```

## Usage

Browser:

```html
<script src="build/ofd.js"></script>
<!-- or the minified build -->
<script src="build/ofd.min.js"></script>
```

Node.js (ZIP inflation needs `DecompressionStream`, so Node 20+):

```js
const OFD = require('./build/ofd.js');
```

## Core Data Structures

The `ofd` object returned by `load()`:

```js
{
  info,                 // document metadata (source of getDocumentInfo)
  document: {
    docPath,            // directory of Document.xml — base for relative paths
    pageBox,            // default page size { x, y, w, h } (mm)
    templates,          // template pages; lazy parse result cached in each element's _parsed
    templateById,       // Map: template id → template object
    pages,              // page list [ { id, baseLoc, pagePath, ... } ]
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
  colorSpaces:  {},     // id → color space (incl. palettes)
  multiMedias:  {},     // id → image object (type/format; dataUrl filled at render time)
  drawParams:   {},     // id → drawing params (line width/cap/dash…)
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
const ofd = await OFD.load('999.ofd');

// from <input type="file">
const file = document.getElementById('fileInput').files[0];
const ofd = await OFD.load(file);

// from an ArrayBuffer
const buf = await fetch('999.ofd').then(r => r.arrayBuffer());
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
  pages: [],           // page numbers carrying the seal (1-based)
  positions: [
    { page, boundary } // page 1-based; boundary in page coordinates
  ],
  sealImage,           // { type: 'image'|'svg', data } or null
}
```

### OFD.verifySignature(ofd, index)

Digest-comparison verification of signature `index`:

```js
{
  valid,        // boolean
  status,       // 'valid' | 'invalid' | 'unknown'
  message,      // human-readable conclusion
  digestValid,  // all digests matched (absent when status is 'unknown')
  checked,      // files that passed
  failed,       // files that failed (with reasons)
}
```

> **Important**: this is *digest comparison only* — the `CheckValue` entries recorded in the signature are compared byte-by-byte against freshly computed digests, which detects modified content or missing protected files. Signature values, certificate chains and timestamps are not verified. And since `CheckValue` lives inside the OFD file itself, it can be recomputed after tampering — so "valid" only means the file is self-consistent, **not** that the signature is authentic (see the comment at the top of `src/core/verify.js`).

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

Sets the external font directory URL prefix (ending in `/`). Fonts are tried as `encodeURIComponent(name) + '.ttf|otf|woff2'`; the directory listing (e.g. nginx autoindex) is parsed for `href`s to build an index.

Default is inferred: the **parent** of the directory containing `<script src=".../ofd.js">` plus `font/` — so `build/ofd.js` looks for `<root>/font/`.

```js
OFD.setFontBase('external/font/');
```

> This repository keeps fonts in `external/font/`, so pages must call the line above or external fonts won't load (built-in and OFD-embedded fonts are unaffected).

### OFD.\_internals

Unstable, kept only for existing consumers:

```js
OFD._internals = {
  parsePage, readEntry, readEntryText, resolvePath,
  parseXml, hashBytes, base64ToBytes, decodeEntities
};
```

- `build/toPdf.js` uses `base64ToBytes`, `decodeEntities`
- `test/benchmark.html` uses the other six

Use the public API in new code; for debugging internals, set breakpoints in the source instead.

## Source Layout

```
src/                    source (bare fragments, no import/export, concatenated into one IIFE closure)
├─ shared/              utilities: util.js profiling / xml.js nodes / path.js paths / color.js colors / lru.js LRU
├─ core/                parsing: zip / parser / image / md(SM3) / seal / asn1 / verify
│                       res / page / signature / outline / annotation / document
├─ display/             rendering: font / svg / api
└─ index.js             public API assembly (OFD object + _internals whitelist)

build/
├─ build.js             build script: ordered concat → ofd.js, terser → ofd.min.js
├─ ofd.js               artifact (readable)
├─ ofd.min.js           artifact (minified)
└─ toPdf.js             OFD → PDF converter (standalone, not part of the engine)

external/               third-party code and assets (font/ fonts; third-party JS is concatenated first)
```

> The concatenation order lives in `build.js` and is load-bearing: `class LRUCache` (`src/shared/lru.js`) is not hoisted, while `src/display/svg.js` constructs one at top level. Read the comment at the top of `build.js` before reordering.

## Render Pipeline

1. **Layer compositing**: background templates → page Content layers → foreground templates (`zOrder="Foreground"`), concatenated in order
2. **Paths**: OFD abbreviated paths → `abbreviatedToSvgPath` tokenising → SVG `d`; fill/stroke/cap/dash/clip resolved via `drawParams`
3. **Text**: font name → `mapFontFamily` (built-in stack / local font / external font) → `<text>`; per-glyph positions from `expandDelta(DeltaX/DeltaY)`
4. **Images**: `ensureImageDataUrl` converts TIFF/JPEG/BMP to data URLs (TIFF has its own LZW decoder and BMP wrapper) for `<image href>`
5. **Seals & annotations**: signature seals via `renderStamp` (embedded OFD seal → SVG or bitmap), annotations via `renderAnnot`
6. **Output**: `<svg viewBox="0 0 W H" class="ofd-page-svg">`, W/H in millimetres

## Key Internal Mechanisms

- **Relative paths**: `resolvePath(base, rel)` resolves against `docPath`, handling `..` and absolute paths
- **Colours**: `parseColor` understands `"156 82 35"` / `#9C5223` / `"#ee #20 #25"` / grayscale `"255"` plus `Alpha`, cached in `_colorCache`
- **Fonts**: `font.js` loads fonts with `FontFace`, dedupes via `fontLoadCache`, registers OFD-embedded fonts in `embeddedFontMap` (filled by `parseOFD`) and reads the external index via `fetchFontIndex`
- **ZIP**: `readZip` scans the central directory, `readEntry` caches inflated entries (`LRUCache`), `readEntryText` decodes UTF-8
- **Digests**: `md.js` implements SM3; `hashBytes(data, method)` dispatches by OID (SM3 / SHA family)

## Notes

1. Sizes are **millimetres**; `pageIndex` is **0-based** everywhere (except `getSignatures`' `pages` / `positions.page`, which are 1-based)
2. `verifySignature` is digest comparison, **not** an authenticity judgement
3. External fonts need `setFontBase`; this repository uses `external/font/`
4. The `ofd` object is an opaque handle — pass it around, don't read its fields
5. `_internals` may change at any time
6. Node usage requires Node 20+ (`DecompressionStream`)
