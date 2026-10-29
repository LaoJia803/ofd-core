# ofd2pdf.js — OFD → PDF Front-end Conversion Module

> **Maturity notice (beta / demo-grade)**: this module is in beta, and its source header self-describes it as "demo-grade" — converted output is fine for preview and general circulation, but it is **not guaranteed to be pixel-identical to the original OFD**. The API and behavior may change as it evolves. Before using it for formal archiving, contracts, invoices, or similar scenarios, manually verify the output file.

## Overview

`build/ofd2pdf/ofd2pdf.js` is a pure front-end OFD → PDF conversion module (beta). It reuses the public API of `ofd.js`:

- Calls `OFD.renderPageToString()` page by page to obtain millimeter-coordinate SVG strings
- Maps the SVG content into PDF page content streams
- Assembles a complete PDF byte array (`Uint8Array`), with no backend service involved

The module is bundled as an IIFE. In browsers it is exposed as the global `TOPDF` object; it also supports CommonJS (`module.exports`).

Two shapes come out of the same build:

| | command | output |
| --- | --- | --- |
| Repository artifact | `npm run build:ofd2pdf` | `build/ofd2pdf/ofd2pdf.js` + `build/ofd2pdf/ofd2pdf.min.js` |
| npm package (`ofd2pdf`) | `npm run build:ofd2pdf-npm` | `dist/<version>/ofd2pdf/` (`lib/ofd2pdf.js` + `lib/ofd2pdf.min.js`, generated `package.json` / `README.md` / `LICENSE`) |

The npm package is dependency-style: it declares `ofd-core` in `dependencies` and does **not** bundle the engine, so install both (`npm install ofd2pdf ofd-core`).

## Design Philosophy

### Reusing the Core Rendering Pipeline

It does not re-parse OFD itself; it relies on `renderPageToString` / `getPageDimensions` / `getPageCount` from `ofd.js`. Therefore vectors, text, images, seals and **annotations (highlight / underline, etc.)** on pages are converted along with the SVG, matching the viewer's rendering.

### SVG → PDF Content Stream Mapping

| SVG element | PDF mapping |
| --- | --- |
| `<path>` | `M/L/C/Q/A/Z` converted directly to PDF paths (quadratic `Q` becomes cubic, arcs `A` are split into cubic beziers) |
| `<rect>` / `<ellipse>` | converted to the corresponding PDF drawing operations |
| `<text>` | ASCII uses the standard 14 fonts (Helvetica / Times / Courier, including bold/italic variants); CJK uses Adobe-GB1 standard CID fonts (SongTi `/STSong-Light`, HeiTi `/STHeiti-*`, KaiTi `/STKaiti`, FangSong `/STFangsong-Light`). No font files are embedded |
| `<image>` | JPEG embedded directly (`DCTDecode`, `DeviceGray`/`DeviceRGB`/`DeviceCMYK` chosen from the SOF component count); PNG / BMP (1/4/8/24/32-bit, RLE8/RLE4) / GIF (transparency, LZW, interlacing) decoded to RGBA then Flate-compressed, transparency preserved via `SMask`; `opacity` is mapped to an ExtGState |
| `<g>` | wrapped in `q`/`Q`, `transform` mapped to PDF `cm`, `opacity` / `mix-blend-mode` mapped to ExtGState, `clip-path` honoured |
| `clipPath` | clip paths made of `<rect>` / `<path>` / `<ellipse>` are supported, mapped to `W n` (`W* n` for evenodd); both `<g clip-path>` and per-element `clip-path` are honoured |
| Gradients (`linearGradient` / `radialGradient`) | mapped to PDF shading dictionaries (`/ShadingType 2` axial, `/ShadingType 3` radial, `/FunctionType 3` stitched function); the path is clipped first and then painted with `sh`. Gradient strokes and gradient text degrade to a flat mid-point colour, stop opacity is approximated by the average alpha |

Unit conversion: 1 mm = 72/25.4 pt; page size comes from `getPageDimensions`.

### Image Deduplication & Sharing

During conversion the module keeps `imageReg` / `alphaReg` registries. Each image and each alpha value is registered once and reused across pages (`Im0`, `GS0`…), keeping the PDF size in check.

### Image Decoding Paths

Image decoding follows two paths, both producing RGBA:

- **Browser**: JPEG is embedded directly (`/DCTDecode`, no decoding); PNG/BMP/GIF are decoded by `canvas` (Blob → Image → `getImageData`), so anything the browser can display works (interlaced PNG, RLE, animated GIF — first frame only); alpha is parsed natively by the browser
- **Node**: falls back to the built-in pure-JS decoders (`decodePng` / `decodeBmp` / `decodeGif`) supporting PNG (8/16-bit, gray/truecolor/palette/RGBA, Adam7 interlacing), BMP (1/4/8/24/32-bit, RLE8/RLE4), GIF (87a/89a, transparency, interlacing)

RGBA data is deflate-compressed into the PDF; when semi-transparent pixels exist, an extra DeviceGray image is emitted as the `SMask` to express alpha.

## Loading

Browser (**ofd.js must be loaded first**):

```html
<script src="build/ofd/ofd.js"></script>
<script src="build/ofd2pdf/ofd2pdf.js"></script>
<script>
  // The TOPDF global object is available
</script>
```

CommonJS (Node):

```js
const OFD   = require('./build/ofd/ofd.js');
const TOPDF = require('./build/ofd2pdf/ofd2pdf.js');
```

Internally `ofd2pdf.js` resolves its dependency lazily via `getCore()`: it uses `window.OFD` in browsers; in Node it tries `./ofd.js` first, then `../ofd/ofd.js` (repository build tree), then the npm dependency `ofd-core`.

Once the npm packages are installed, require by name — no relative paths:

```js
const TOPDF = require('ofd2pdf');   // resolves its ofd-core dependency automatically
```

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
// Load ofd.js and ofd2pdf.js first
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
const OFD   = require('./build/ofd/ofd.js');
const TOPDF = require('./build/ofd2pdf/ofd2pdf.js');

(async () => {
  const data = new Uint8Array(fs.readFileSync('a.ofd'));
  const ofd  = await OFD.load(data);
  const pdf  = await TOPDF.ofdToPdf(ofd, { title: 'a.ofd' });
  fs.writeFileSync('a.pdf', Buffer.from(pdf));
})();
```

## Security and resource limits

`ofd2pdf.js` processes OFD images and text, and converting large documents can consume substantial memory.

### Implemented limits

| Limit | Value | Location |
| --- | --- | --- |
| Per-image decode pixel cap | **100 megapixels** (~400 MB RGBA) | `checkImageSize()` |
| Image dimension sanity | width and height must be > 0, otherwise skip with an error | `checkImageSize()` |
| Decode failure isolation | a single failing image only logs `console.warn` and is skipped; the rest of the page still renders | `svgToContentStream` |
| ZIP decompression cap | 256 MB per entry (provided by the core engine) | `ofd.js` |

The pixel cap is **essential**: image headers declare their own width and height and can be forged, so without a cap a few-KB file can trigger a huge allocation and OOM the process.

### Keep in mind

1. **Conversion is whole-document.** `ofdToPdf` renders page by page and accumulates content streams; peak memory on large documents (hundreds of pages, many images) can reach hundreds of MB. Consider running it in a Worker or processing in batches.
2. **Page-level clipping is not applied.** If the OFD contains oversized background blocks, the converted PDF may include regions that should have been clipped — the core engine uses a "cull but don't express" strategy (see the core engine docs).
3. **No signature verification.** This module only converts formats; it performs no cryptographic verification. The output PDF contains **no digital signature — do not circulate it as a signed document.**
4. **Beta / demo-grade.** It does not cover the full PDF feature set (forms, hyperlinks, encryption); evaluate compatibility before production use.

## Notes

- **Load order**: `ofd2pdf.js` must be loaded after `ofd.js`; otherwise `ofdToPdf` throws "ofd2pdf.js 需要先加载 ofd.js"
- **Compression**: browsers prefer `CompressionStream`, Node uses the built-in `zlib`; deflate fails if neither is available
- **Fonts**: ASCII text uses the standard 14 fonts (Helvetica / Times / Courier, with the matching -Bold / -Italic variants); CJK text uses Adobe-GB1 standard CID fonts (`/STSong-Light`, `/STHeiti-Light` and `/STHeiti-Regular`, `/STKaiti`, `/STFangsong-Light`). No font files are embedded — glyph shapes are up to the reader (synthetic bold is faked by drawing twice for fonts without a bold face)
- **Image formats**: JPEG (embedded directly), PNG, BMP (1/4/8/24/32-bit, incl. RLE compression) and GIF (87a/89a, incl. transparency and interlacing) are supported; TIFF is pre-converted by `ofd.js` into a BMP data source and thereby also supported; unsupported formats or decode failures emit a `console.warn` and the image is skipped (the rest of the page is unaffected)
- **Transparency**: PNG/BMP/GIF are decoded to RGBA — via `canvas` in browsers, via pure JS in Node — preserving alpha through an `SMask`; only the first frame of an animated GIF is taken
- **Known differences from the original**: glyph shapes depend on the reader's built-in fonts (no font files embedded, individual characters may be missing), annotations and seals may be displayed incompletely, and gradient strokes/text can only be approximated with a flat colour

