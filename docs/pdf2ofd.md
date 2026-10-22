# pdf2ofd — PDF → OFD Converter

> **Maturity notice (beta)**: this module is in beta. Converted output is fine for preview and general circulation — layout, text, embedded fonts, images, gradients and stroke styles are all aligned — but it is **not guaranteed to be pixel-identical to the source PDF**, and form fields, annotations and Type3 fonts are not supported. The API and behavior may change as it evolves. Before using it for formal archiving, contracts, invoices, or similar scenarios, manually verify the output file.

## Overview

Converts a PDF into an OFD package conforming to **GB/T 33190** (electronic document storage and exchange — layout documents), preserving searchable text, embedded subset fonts and bitmaps, with charts expressed as vector paths, gradient fills and dashed strokes.

- **Parse**: pdf.js (the ESM build from `pdfjs-dist`) reads the PDF and exposes per-page drawing operators plus the text layer
- **Map**: vector paths → `PathObject`, text → `TextObject`, images → `ImageObject` + PNG resources, Form XObjects → **inlined** as page-level graphics
- **Package**: emits `OFD.xml` / `Document.xml` / `PublicRes.xml` / `DocumentRes.xml` / per-page `Content.xml` and zips them (deflate)

The result is re-readable by `ofd.js` and opens in WPS and other third-party OFD viewers.

## Two ways to use it

### 1. The npm package (recommended)

```bash
npm install pdf2ofd pdfjs-dist
```

`pdfjs-dist` is a **peerDependency** (≥ 4) and must be installed separately — it does the PDF parsing, this package only emits OFD. The package itself has zero runtime dependencies.

To assemble it from this repository:

```bash
npm run build:pdf2ofd        # output lands in dist/pdf2ofd/
```

### 2. Run from the source tree

```bash
node build/pdf2ofd.js input.pdf# writes input.ofd
node build/pdf2ofd.js input.pdf output.ofd     # explicit output path
```

## CLI

The `pdf2ofd` command shipped with the npm package:

```bash
pdf2ofd input.pdf                # writes input.ofd
pdf2ofd input.pdf out/result.ofd # explicit output
pdf2ofd -q input.pdf out.ofd     # quiet
pdf2ofd --help
```

Progress and statistics go to stderr:

```
  已处理 14/14 页
完成：out/result.ofd（14 页，24 字体，90 图像，875598 字节）
```

## From code

```js
const { convert } = require('pdf2ofd');

const stats = await convert('input.pdf', 'output.ofd', {
  onProgress: (done, total) => console.log(`${done}/${total}`),
  quiet: true,          // suppress progress and summary output
});
// stats = { pages, fonts, images, bytes }
```

`ofdPath` may be omitted, in which case it matches the input name (`.pdf` → `.ofd`).

Batch conversion:

```js
const { convertMany } = require('pdf2ofd');

// Sequential, so large files don't blow up memory by running concurrently
await convertMany(['a.pdf', 'b.pdf'], { quiet: true });

// Per-item output path and options are also supported
await convertMany([
  { from: 'a.pdf', to: 'out/a.ofd' },
  { from: 'b.pdf', options: { quiet: true } },
]);
```

## Exports

| Member | Description |
| --- | --- |
| `convert(pdfPath, ofdPath?, options?)` | Main entry, returns the stats object |
| `convertMany(list, options?)` | Batch conversion, sequential, returns an array of stats objects |
| `ZipWriter` | Minimal ZIP writer (deflate): `add(name, data)` + `build()` |
| `encodePng(width, height, rgba)` | RGBA → PNG bytes |
| `PT_TO_MM` | Point-to-millimetre factor `25.4/72` |
| `version` | Package version |

`options` accepts exactly two fields: `onProgress(done, total)` and `quiet`. There are **no** `cMapUrl` / `maxPages` / `imageWaitMs` / `defaultFont` parameters — pdf.js resource paths are resolved by the package itself via `require.resolve('pdfjs-dist/…')`, so callers never pass paths.

## Requirements

- **Node.js 18+** (uses `fs`, `zlib`, and dynamic ESM `import()`)
- **pdfjs-dist ≥ 4** (already in `devDependencies` in the source tree; a peerDependency for the npm package)

This module runs in **Node only**. An earlier version supported browsers too (a `rt` runtime adapter layer plus a Buffer polyfill), but that was removed: without `zlib` the browser path degrades PNG IDAT to zlib stored blocks — roughly 11× larger — and the maintenance cost outweighed the benefit.

## Output layout

```
OFD.xml                              document root (DocID / dates / DocRoot)
Doc_0/Document.xml                   page list + PublicRes / DocumentRes references
Doc_0/PublicRes.xml                  font declarations (ofd:Font → FontFile)
Doc_0/DocumentRes.xml                image declarations (ofd:MultiMedia)
Doc_0/Res/font_<id>_<id>.otf|ttf     embedded font binaries
Doc_0/Res/image_<id>.png             image resources
Doc_0/Pages/Page_<n>/Content.xml     per-page graphics
```

There is **no** `CompositeGraphicUnits` in `DocumentRes.xml` — see "Composite graphic units" below.

## Implementation notes

These are decisions made after hitting real problems. Read the in-file comments before changing any of them.

### Coordinates and units

`1pt = 25.4/72 mm`; PDF's Y axis points up, OFD's points down.

Graphic coordinates **keep the original PDF user-space values**. The combined "CTM + pt→mm + Y flip" is expressed through OFD's CTM attribute rather than baked into path points — otherwise rotation, skew and mirroring are lost, because baked coordinates can only express translation plus scale.

Renderers position things as "Boundary origin + CTM(coords)", so coordinates must be normalised first: with `(dx,dy) = L⁻¹·(T − B0)`, emitting `(x+dx, y+dy)` makes the landing point exactly `L(x,y)+T` for any affine transform.

### Line width and dashes: never pre-multiply by the CTM

OFD's `LineWidth` and `DashPattern` live in the **same coordinate space** as `AbbreviatedData` and get scaled by the CTM again at render time.

So both attributes must carry the **original PDF user-space value** (e.g. `1` / `2` / `3` / `5`) and must **not** be pre-multiplied by the CTM's mm scale. The old implementation did pre-multiply, shrinking line widths by nearly 3× (a `0.3528` factor times the `0.35~0.47` CTM inside charts) so every line collapsed to the same thin stroke — exactly the "some connections are thick, some thin, now they're all the same" symptom.

In the OFD spec `DashPattern` is a **PathObject attribute** (`DashPattern="4 4"`), **not** a child element. Writing it as a child makes engines ignore it, and every dashed ellipse degrades to a solid one.

The one exception: when coordinates were multiplied by `k` via `absorbScale()`, line width and dash lengths in that same space must be multiplied by `k` too.

### Tiny CTMs: absorb the scale into the coordinates

`fmt()` keeps only 4 decimal places, and tiny CTM scales are common in charts — the page 11 axes have a CTM scale of just `7.638e-5` (the PDF uses a transform to blow the line-box coordinates up by thirteen thousand×). That gets written as `0`, the CTM comes out as `0 0 0 0 0 0`, every path collapses to a point and the whole axis system disappears.

The fix (matching the reference output): when the scale is too small, stop expressing it through the CTM and instead **absorb the scale into the graphic coordinates**, letting the CTM degenerate to the identity. Coordinates then go from `322739` to `~24.6` and the CTM from `0` to `0.3528` — numbers that land inside `fmt()`'s effective precision.

The threshold is `CTM_TINY = 0.05`. Note that `geom()` must receive the **already-scaled** points, or Boundary comes out astronomically large (`6446519`) and the CTM degenerates back to `1 0 0 1`.

### Clipping: pdf.js consumes clip one step late

pdf.js's `clip()` / `eoClip()` only **set a flag** on `pendingClip`; the clipping region is actually established when the **next** `constructPath` is consumed by `consumePath()`.

So the converter delays by one too: `clip` only sets `pendingClipMode`, and the following `constructPath(endPath)` is what registers the clip box. The old implementation did the opposite — on `clip` it immediately consumed `pendingPath`, which is the **previous**, already-used stale path. The clip regions ended up shifted wholesale, wrongly culling small elements such as legend colour swatches (this is how the colour markers before the chart labels on pages 10/13 disappeared: the swatches sit roughly 1mm outside the clip region).

One more rule that is **not** either/or: a single `endPath` may be **both** a clip region **and** a fill region. `W n` followed by `sh f` is common in PDFs (clip first, then fill the same shape with a gradient). So the clip branch may only do `clipBoxes.push()` and must **never** clear `pendingPath` — doing so makes the immediately following `shadingFill` find no region and silently drop all 81 gradient bars.

### Gradients: you must await the prefetch

Gradients are expressed as OFD axial shades:

```xml
<ofd:FillColor>
  <ofd:AxialShd Extend="3" StartPoint="x0 y0" EndPoint="x1 y1">
    <ofd:Segment Position="0"><ofd:Color Value="155 193 255"/></ofd:Segment>
    <ofd:Segment Position="1"><ofd:Color Value="63 128 205"/></ofd:Segment>
  </ofd:AxialShd>
</ofd:FillColor>
```

`page.objs.get(id)` returns a **Promise** for objects that aren't resolved yet, so it cannot be used synchronously. Any id-keyed lookup (gradients, patterns) must `await` the prefetch first.

`prefetchGradients()` scans `fnArray` before entering the operator loop, collects every pattern id referenced by `shadingFill`, awaits them all and stores the result in a `gradShades` cache. The old implementation called `objs.get(patId)` synchronously inside `shadingFill`; the throw landed in the catch and returned a fallback colour of `0.5`, which showed up as `FillColor` defaulting to pure black `0 0 0`.

Radial gradients are approximated as axial (OFD has a corresponding spec but compatibility is unverified).

### Tiling patterns: average colour, no texture

`setFillColorN` / `setStrokeColorN` are not plain colours — page 13's grey halftone screen is a `TilingPattern`. `patternImageId()` digs the pattern's inline image object id out of the `[ 'TilingPattern', backdrop, { fnArray, argsArray }, matrix, bbox ]` array, and `prefetchPatternColors()` — run alongside `prefetchGradients()` before the operator loop, for the same `page.objs.get()` async reason — decodes each such image once and stores its **average RGB** in `patternColors`. The fill/stroke colour is then replaced by that average, so the region renders in the right tone.

Only the average tone is kept: pattern tiling itself is not expressed (OFD has no direct equivalent that WPS renders reliably). Other `...ColorN` colour spaces (Indexed / CMYK / Lab) stay unsupported — they keep the previous colour instead of collapsing to black.

### Composite graphic units: not emitted

Form XObjects are **always inlined** as page-level `PathObject` / `ImageObject` (semantically equivalent to `save + concat(matrix) … restore`). They are **not** collected into `<ofd:CompositeGraphicUnit>` in `DocumentRes`, and the page does **not** reference them via `<ofd:CompositeObject>`.

Reason: when the engine fails to recognise `CompositeObject`, the entire chart vanishes (observed on page 6). In the reference output `CompositeObject` is only used for occasional grouping — the page `Content.xml` directly contains hundreds of `PathObject` / `ImageObject`. For the same reason this project (after WPS once clipped content away) takes the "don't introduce it" approach.

Measured on the output: 0 `CompositeGraphicUnits`, 0 `CompositeObject`. Do not work from older documentation that claims otherwise.

Form internals often contain background blocks far larger than the Form itself (e.g. a full-page 1152×2199 white canvas). PDF semantics constrain them to the Form's BBox, so `paintFormXObjectBegin` registers the BBox in `clipBoxes` for culling and dropping — but emits **no** `<ofd:Clips>` (see below).

### No page-level `<ofd:Clips>`

Two separate experiments proved that emitting `Clips` at page level makes WPS clip content away wholesale (disabling it on 2026-10-13 restored charts on pages 10/11/13; re-enabling it the same day made charts on pages 9/10/12 vanish again).

Hence the conservative "**cull, don't express**" strategy:

- `clipBoxes` bounding boxes cull graphics outside the clip regions
- `isOversizedRect()` drops pure-rectangle fills more than 1.8× the visible area

Clamping an oversized block down to the visible rectangle was rejected: that leaves a small colour patch sitting on top of the figure caption and covers it anyway — which is exactly how page 6 broke. The cost of dropping is merely the background, which is white anyway and carries no information. `isOversizedRect()` applies to **pure rectangles only**, so curves and polylines pass through untouched.

### Two visibility modes

`visible(box, mode)`'s `mode` selects which visible region applies:

- `'page'` (text / stroked lines) → page bounds only, **entirely unaffected by `clipBoxes`**
- `'clip'` (fill blocks) → intersected with the clip regions, which is what PDF semantics require

Stroked lines are also exempt from clip regions because table borders span entire rows or columns and are often emitted before the cell clip region exists, or across several of them. On one signature-pad document, 10 of 12 table border lines on page 2 (`box=[29.8, 25.5, 150.5, 0]`, spanning the full 150mm row width) were culled by cell `eoClip`. The tolerance is `CLIP_EPS = 0.6`: borders and captions hugging the clip boundary survive, while garbage paths thousands of millimetres outside the page are still cleared.

### Font embedding

Font bytes are intercepted from the worker message layer (`doc._transport.messageHandler.comObj`) after pdf.js compiles the subsets, then embedded into `PublicRes`.

Three things that must not be broken:

1. **Non-embedded fonts must still be declared in `PublicRes`.** The 14 standard fonts (Helvetica etc.) arrive with `mimetype=null` and no `data`; an `if (!f) continue` guard used to skip them, leaving 1064 text objects but zero font declarations — strict renderers then misbehave.
2. **Same name, different Font ID must register independently.** One PDF can carry three `Calibri` Font IDs with different subsets and different cmap sizes. The viewer generates families as `ofdf_<id>_<name>`; keying on fontName alone registers only the first and silently falls back to system fonts for the rest.
3. **`ensureMacCmap()` adds a Mac (platform 1/0) cmap subtable.** pdf.js subsets often ship only a Windows (3/1) format-4 cmap; some viewers read the Mac table preferentially, so it is added for broader compatibility. Note: this alone does **not** fully fix WPS chart-label garbling — labels drawn with subset fonts that lack a ToUnicode CMap carry private-use codes (`0x21`…) that no cmap subtable can recover; those need the label text itself to be remapped.

### Images

`page.objs` only exposes `get`/`has`; image data arrives asynchronously after `getOperatorList()`. So `waitImages()` first scans the ops for objIds referenced by `paintImageXObject`, then polls every 20 ms with an **8-second ceiling**.

`imageToRgba()` dispatches on `img.kind`: 1=grayscale, 2=RGB, 3=RGBA (the old implementation only handled 3, dropping RGB and grayscale images wholesale), normalising everything to RGBA before `encodePng()`.

> Row copying uses `raw.set(rgba.subarray(...))`. Do **not** revert to `Buffer.from(buffer, off, len).copy()` — that three-argument overload once made every row replicate row 0, while PNG signature, dimensions and CRC all still validated. Nearly impossible to spot.

### Text

Text comes from the `showText` glyphs in the operator list (each carries its own Unicode and width) — not from `getTextContent()`. Fill colour and font size are taken from the graphics/text state at the `showText` position.

`TextCode` coordinates, `DeltaX` and `Size` all work in **font-size space** (1 unit = 1/Size em); glyph bounding boxes likewise.

The `Glyphs` array length must equal `DeltaX` count + 1 exactly (matching the reference implementation — verified across 2175 TextObjects with no exceptions): the final glyph is real but its `DeltaX` is not given separately, and the renderer advances it. `codeList` stays strictly 1:1 with `Glyphs`.

### PNG encoding

Hand-written in pure JS (IHDR / IDAT / IEND + CRC32) over Node's `zlib.deflateSync({level:9})`.

## Measured results

Using the 14-page academic-paper PDF kept in `test/` as the baseline (US Letter, mixed text/vector figures, 9 subset fonts):

```bash
node build/pdf2ofd.js test/<your-sample>.pdf
#   已处理 14/14 页
# 完成：test/<your-sample>.ofd（14 页，24 字体，90 图像，875598 字节）
```

Alignment against the commercial converter's output for the same PDF:

| Check | Reference | This converter |
| --- | --- | --- |
| Page 2 dashed paths | 5 | 7 (same source, 2 extra duplicates) |
| Page 6 line-width tiers | 1 / 2 / 3 / 5 | 1 / 2 / 3 / 5 ✓ |
| Page 7 line-width tiers | 1 / 2 / 3 / 5 / 8 | 1 / 2 / 3 / 4 / 5 / 8 ✓ |
| Page 10 legend swatches | present | grey / dark grey, 2 colours ✓ |
| Page 11 all-zero CTM paths | 0 | 0 ✓ |
| Page 11 AxialShd | 162 | 162 ✓ |
| Page 11 gradient bars | 81 | 81 ✓ |
| Page 13 halftone screen | tiled `TilingPattern` texture | flat grey — only the pattern's average colour is kept |

**Known unaligned items**: the reference splits each graphic into its own `CompositeGraphicUnit` (226 units, 96 of them empty) isolated by clipping; this converter flattens everything at page level with no clipping, so curves overflow into neighbouring graphics. The reference also keeps only 22 skeleton lines document-wide (widths clustered at 0.75 / 2 / 3), discarding the PDF's 190 strokes. Both points have been confirmed as out of scope.

## Resource and security notes

This converter parses external PDF files.

- **Memory**: per-page operator lists, decoded images and gradient prefetch tables all live in memory. High-resolution scans of hundreds of pages can use substantial memory (a 14-page paper sample peaked around 200 MB).
- **8-second image wait ceiling**: `waitImages()` polls pdf.js for asynchronously delivered image data and treats anything past 8 seconds as ready (missing images are skipped without an error). In extreme cases images can be silently absent.
- **PDF signatures are not verified.** If the input PDF carries a digital signature, this tool **does not** validate it — it only converts content.
- **Parser hardening is pdf.js's job.** This converter adds no extra sandboxing. Run it in a constrained environment (container / low-privilege process) for PDFs from untrusted sources.

## Known limitations

1. **Not supported**: form fields, annotations, Type3 fonts
2. **Radial gradients are approximated as axial**; strict visual parity is unverified
3. **Tiling patterns keep only their average colour** — the halftone texture itself is not reproduced; `...ColorN` spaces other than pattern images (Indexed / CMYK / Lab) fall back to the previous colour
4. **Image-heavy PDFs grow**: pdf.js hands over decoded pixels, so re-encoded PNGs are usually larger than the source JPEGs — scans especially so
5. **Text spacing is approximated**: per-glyph `DeltaX` splits the total width evenly; long Latin runs may drift slightly (CJK is accurate since it is monospaced)
6. **CropBox offsets are not specially handled**; page size comes from `page.view`
7. **Beta**: this module is in beta; its API and behavior may change as it evolves. Not all PDF features are covered — manually verify the output before formal archiving, contracts, invoices or similar use

## Maintainer notes

The following are **not** synced automatically — handle them manually before publishing:

| Item | Location | Notes |
| --- | --- | --- |
| npm package version | `PKG.version` in `build/build-pdf2ofd.js` | **Hardcoded**, not read from `package.json`'s `version`. Must be bumped manually or npm will reject the duplicate version |
| npm package name | `PKG.name` in `build/build-pdf2ofd.js` | Same. Change it if `pdf2ofd` is taken on npmjs |
| Release-package file stripping | `distTransform()` in `build/build.js` | After changing the structure of `web/viewer.html` / `web/viewer.js` (selectors, events, the test-file default), the regexes stop matching. Assertions now make the build fail loudly instead of silently shipping a broken package |

`npm run build:pdf2ofd` only reassembles `dist/pdf2ofd/`; it does not publish. Publishing is a separate step:

```bash
cd dist/pdf2ofd
npm publish --access public
```

## Troubleshooting

After changing the converter, run the baseline sample and check the reported counts (should be 14 pages / 24 fonts / 90 images):

```bash
node build/pdf2ofd.js test/<your-sample>.pdf /tmp/chk.ofd
```

For deeper product verification (ZIP entries inflate and match their CRC32, PNG chunk CRCs, MultiMedia declarations == image entries == per-page ImageObject total) write a throwaway script — but mind three traps:

- **ZIP headers are little-endian; PNG chunk headers are big-endian.** Mixing them yields a bogus "0 entries" reading.
- **Structural validation passing ≠ content being correct.** Signature, dimensions, CRC and inflate can all pass while the pixels are entirely wrong. Any image-encoding change needs a byte-for-byte pixel comparison.
- **"No all-zero CTMs" is not a sufficient check.** When page 11 lost its colours, all-zero CTM paths were 0 and stroked paths were 8 — both healthy — yet 81 gradient bars had been silently dropped. You have to **count by graphic type** (AxialShd count, ImageObject count, TextObject count) to localise such failures.

When diagnosing display problems, reuse the project's existing `src/core/zip.js` instead of hand-rolling another ZIP reader.

## Six general rules

These were re-verified repeatedly while building this converter. Check every one of them before changing the code:

1. `LineWidth` / `DashPattern` share the coordinate space of `AbbreviatedData` — **never** pre-multiply by the CTM
2. `DashPattern` is a PathObject **attribute**, not a child element
3. pdf.js consumes clip one step late; `clip` itself carries no path
4. `fmt()`'s 4 decimal places are fatal for tiny CTMs — absorb the scale into the coordinates instead
5. Any `page.objs.get()` id lookup must be preceded by an `await` prefetch
6. One `endPath` can be both a clip region and a fill region — you cannot have just one
