# toPdf.js — OFD → PDF Front-end Conversion Module

> **Maturity notice (beta / demo-grade)**: this module is in beta, and its source header self-describes it as "demo-grade" — converted output is fine for preview and general circulation, but it is **not guaranteed to be pixel-identical to the original OFD**. The API and behavior may change as it evolves. Before using it for formal archiving, contracts, invoices, or similar scenarios, manually verify the output file.

## Overview

`build/toPdf.js` is a pure front-end OFD → PDF conversion module (beta). It reuses the public API of `ofd.js`:

- Calls `OFD.renderPageToString()` page by page to obtain millimeter-coordinate SVG strings
- Maps the SVG content into PDF page content streams
- Assembles a complete PDF byte array (`Uint8Array`), with no backend service involved

The module is bundled as an IIFE. In browsers it is exposed as the global `TOPDF` object; it also supports CommonJS (`module.exports`).

## Design Philosophy

### Reusing the Core Rendering Pipeline

It does not re-parse OFD itself; it relies on `renderPageToString` / `getPageDimensions` / `getPageCount` from `ofd.js`. Therefore vectors, text, images, seals and **annotations (highlight / underline, etc.)** on pages are converted along with the SVG, matching the viewer's rendering.

### SVG → PDF Content Stream Mapping

| SVG element | PDF mapping |
| --- | --- |
| `<path>` | `M/L/C/Q/A/Z` converted directly to PDF paths (quadratic `Q` becomes cubic, arcs `A` are split into cubic beziers) |
| `<rect>` / `<ellipse>` | converted to the corresponding PDF drawing operations |
| `<text>` | Type0 font (`/STSong-Light` + `/UniGB-UCS2-H`, relying on the reader's built-in Chinese fonts, no font embedding) |
| `<image>` | JPEG embedded directly (`DCTDecode`); PNG / BMP (1/4/8/24/32-bit, RLE8/RLE4) / GIF (transparency, LZW, interlaced) decoded to RGBA then Flate-compressed, transparency preserved via `SMask` |
| `<g>` | wrapped in `q`/`Q`, `transform` mapped to PDF `cm` |
| `clipPath` | only clip paths made of `<rect>` children are supported, mapped to `re W n`; other shapes are silently ignored |

Unit conversion: 1 mm = 72/25.4 pt; page size comes from `getPageDimensions`.

### Image Deduplication & Sharing

During conversion the module keeps `imageReg` / `alphaReg` registries. Each image and each alpha value is registered once and reused across pages (`Im0`, `GS0`…), keeping the PDF size in check.

### Image Decoding Paths

Image decoding follows two paths, both producing RGBA:

- **Browser**: JPEG is embedded directly (`/DCTDecode`, no decoding); PNG/BMP/GIF are decoded by `canvas` (Blob → Image → `getImageData`), so anything the browser can display works (interlaced PNG, RLE, animated GIF — first frame only); alpha is parsed natively by the browser
- **Node**: falls back to the built-in pure-JS decoders (`decodePng` / `decodeBmp` / `decodeGif`) supporting PNG (8/16-bit, gray/truecolor/palette/RGBA), BMP (1/4/8/24/32-bit, RLE8/RLE4), GIF (87a/89a, transparency, interlacing); **interlaced PNG is not supported** — such an image is skipped with a `console.warn`

RGBA data is deflate-compressed into the PDF; when semi-transparent pixels exist, an extra DeviceGray image is emitted as the `SMask` to express alpha.

## Loading

Browser (**ofd.js must be loaded first**):

```html
<script src="build/ofd.js"></script>
<script src="build/toPdf.js"></script>
<script>
  // The TOPDF global object is available
</script>
```

CommonJS (Node):

```js
const OFD   = require('./build/ofd.js');
const TOPDF = require('./build/toPdf.js');
```

Internally `toPdf.js` resolves its dependency lazily via `getCore()`: it uses `window.OFD` in browsers and `require('./ofd.js')` in Node.

## Public API

### TOPDF.ofdToPdf(ofd, opts)

Converts an OFD document into PDF bytes.

| Parameter | Type | Description |
| --- | --- | --- |
| ofd | object | the object returned by `OFD.load()` |
| opts.title | string | PDF title, optional |
| opts.author | string | PDF author, optional |
| opts.subject | string | PDF subject, optional |
| opts.renderOpts | object | render options passed through to `renderPageToString` (e.g. `width`), optional |
| opts.onProgress | function | progress callback `(done, total)` invoked after each page, optional |

Returns: `Promise<Uint8Array>` — the PDF file bytes.

```js
const pdf = await TOPDF.ofdToPdf(ofd, {
  title: 'invoice',
  onProgress: (done, total) => console.log(`${done}/${total}`)
});
```

### TOPDF.svgToPdf(svgString, pageWmm, pageHmm, opts)

Converts a single-page SVG string into PDF bytes (handy for debugging one page).

| Parameter | Type | Description |
| --- | --- | --- |
| svgString | string | an SVG string produced by `renderPageToString` |
| pageWmm | number | page width in millimeters |
| pageHmm | number | page height in millimeters |
| opts | object | the same metadata options as `ofdToPdf` |

Returns: `Promise<Uint8Array>`.

### TOPDF._internals

Exposes internal functions for extension/debugging:

```js
const {
  svgToContentStream,  // (svgStr, pageWmm, pageHmm, ctx) => Promise<string>
  parseSvgXml,         // (str) => bare node {tag, attrs, children, text}
  pathToPdf,           // (svgD) => PDF path operator string
  parseTransform,      // (str) => transform matrix
  assemblePdf          // (pages, imageReg, alphaReg, opts) => Uint8Array
} = TOPDF._internals;
```

`parseXml` is kept as an alias of `parseSvgXml`; prefer `parseSvgXml` in new code.

> **Do not mix these up with the same-named APIs in ofd.js — they return different shapes:**
>
> | Function | Input | Returns |
> | --- | --- | --- |
> | `TOPDF._internals.parseSvgXml(str)` | SVG produced by ofd.js (trusted, known shape) | bare node, lenient parsing |
> | `OFD._internals.parseXml(str)` | untrusted OFD input | `{ documentElement }`, explicit stack + strict tag-match checks |
>
> Likewise `parseCssColor(str)` (parses a CSS color string) is not the same as
> `OFD._internals.parseColor(el)` (reads the `Value`/`Alpha` attributes of an OFD element).

## Complete Examples

### Browser: convert and download

```js
// Load ofd.js and toPdf.js first
const file = document.getElementById('file').files[0];
const ofd  = await OFD.load(await file.arrayBuffer());
const pdf  = await TOPDF.ofdToPdf(ofd, { title: 'invoice.pdf' });
const blob = new Blob([pdf], { type: 'application/pdf' });
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'invoice.pdf';
a.click();
```

### Node: convert and write to a file

```js
const fs  = require('fs');
const OFD   = require('./build/ofd.js');
const TOPDF = require('./build/toPdf.js');

(async () => {
  const data = new Uint8Array(fs.readFileSync('a.ofd'));
  const ofd  = await OFD.load(data);
  const pdf  = await TOPDF.ofdToPdf(ofd, { title: 'a.ofd' });
  fs.writeFileSync('a.pdf', Buffer.from(pdf));
})();
```

## Notes

- **Load order**: `toPdf.js` must be loaded after `ofd.js`; otherwise `ofdToPdf` throws "toPdf.js 需要先加载 ofd.js"
- **Compression**: browsers rely on `CompressionStream` (Chrome 80+); Node relies on the built-in `zlib`; deflate fails if neither is available
- **Chinese fonts**: text uses `/STSong-Light` + `/UniGB-UCS2-H`, relying on the reader's built-in Chinese fonts; no font files are embedded. KaiTi, HeiTi, etc. will render as SongTi
- **Image formats**: JPEG (embedded directly), PNG, BMP (1/4/8/24/32-bit, incl. RLE compression) and GIF (87a/89a, incl. transparency and interlacing) are supported; TIFF is pre-converted by `ofd.js` into a BMP data source and thereby also supported; unsupported formats or decode failures emit a `console.warn` and the image is skipped (the rest of the page is unaffected)
- **Transparency**: PNG/BMP/GIF are decoded to RGBA — via `canvas` in browsers, via pure JS in Node — preserving alpha through an `SMask`; interlaced PNG is not supported on the Node path, and only the first frame of an animated GIF is taken
- **Beta / demo-grade limitation**: this module is in beta (its source header describes it as "demo-grade") and does not cover the full PDF feature set (forms, hyperlinks, encryption, etc.); evaluate compatibility before use. Known differences from the original may include: Chinese fonts are uniformly rendered as SongTi (no font files embedded), annotations and seals may be displayed incompletely, and the Node path does not support interlaced PNG

