# viewer.js — OFD Viewer Application Logic

## Overview

`web/viewer.js` is the application layer of the OFD online reader. Together with `viewer.html` / `viewer.css` it provides the full reading experience: lazily rendered pages, zoom/rotate, full-text search, thumbnail / outline / signature sidebars, seal placement, printing, download and PDF export.

It does not reinvent the wheel: parsing and rendering are delegated to `build/ofd/ofd.js`, PDF export to `build/ofd2pdf/ofd2pdf.js`; viewer.js itself owns state, DOM interaction and scheduling.

## Design

### Framework-free vanilla JS

Zero dependencies, zero build step: `viewer.js` is a single IIFE loaded with a plain `<script>`. All DOM work uses native APIs; all styling lives in `viewer.css`.

### State-driven

One global `state` object holds all runtime data (page count, current page, zoom, search results, seal positions…). Interactions mutate `state` first, then render functions sync the DOM — events never poke each other's UI directly.

### Lazy rendering (viewport rendering + off-screen unmounting)

Only the viewport ± `lazyBuffer` (default 2) pages are rendered:

- Pages render on approach; a 1000-page document only paints the visible few on first paint
- Off-screen pages are **unmounted** (their SVG removed) and repainted when scrolled back
- Each page carries a render generation `renderTokens[i]`, bumped on unmount/re-render so in-flight async renders are discarded (`loadToken` guards whole-document loads the same way)

### Layering

| Layer | Responsibility | Owner |
| --- | --- | --- |
| Parsing / rendering | OFD → SVG | `build/ofd/ofd.js` |
| Conversion | SVG → PDF | `build/ofd2pdf/ofd2pdf.js` |
| Application | state, interaction, scheduling | `web/viewer.js` |

### loadToken race protection

Opening files back to back, or starting a new load while one is in flight, must not let stale results overwrite the UI. Each load increments `state.loadToken`; async callbacks compare generations on return and drop mismatches.

## Call Flow

### Startup

```
DOMContentLoaded
  ├─ cache DOM elements (els.*)
  ├─ bind toolbar / sidebar / findbar events
  ├─ read URL param ?file= (default: a bundled test sample under ../test/ofdFile/)
  └─ openFile(url)
```

### Opening a file

```
openFile(source)
  ├─ state.loadToken++ (invalidate previous load)
  ├─ OFD.load(source)                 → ofd
  ├─ OFD.getPageCount / getPageDimensions (cached per page in pageDimensions)
  ├─ render thumbnails (renderPage width:200, lazily)
  ├─ OFD.getSignatures → signature panel + per-page hit areas
  └─ trigger first-screen lazy render
```

### Zoom

```
setScale(value | 'auto')
  ├─ update state.scale / scaleMode
  ├─ resize page containers from pageDimensions × scale
  └─ reflow rendered pages (SVG width follows); unrendered pages stay lazy
```

### Search

```
onSearchInput(query)
  ├─ walk text nodes of rendered pages (state.pageSvgs <text>)
  ├─ collect matches { page, textIdx, start, end, rect }
  ├─ update hit counter; prev/next jump and scroll into view
  └─ highlight matches (overlay rectangles)
```

### Sealing

```
toolbar "Stamp" button
  ├─ onGetSeal registered? → cb() gets the seal, then calls OFD.setSeal()
  ├─ else reuse the last seal (sessionStorage: ofd_last_seal)
  └─ enterStampMode(): click a page to place
       ├─ convert to millimetre coordinates (top-left origin)
       ├─ placeSealVisual draws the seal (.seal-placed, right-click to delete)
       ├─ record { sealImg, width, height, sealId, page, x, y } in state.sealPlaced
       └─ emitSealChange('place', buildSealList()) → onSealChange callback
```

### Paging

```
scroll / prev-next / page input / thumbnail click / goToPage
  ├─ setCurrentPage(idx): update page box, highlight current page
  ├─ lazy render: render newly visible pages, unmount distant ones
  └─ state.pageChangeCb(page, total) (registered via onPageChange)
```

## Layout and Dependencies

```
web/
├─ viewer.html   page skeleton (toolbar / sidebar / findbar / main container)
├─ viewer.js     application logic (this file)
├─ viewer.css    styles (toolbar icons reference images/*.svg; no base64)
└─ images/       standalone SVG icons (referenced directly by viewer.css)

Dependencies:
├─ ../build/ofd/ofd.min.js        parsing and rendering (required; viewer.html loads the minified engine)
├─ ../build/ofd2pdf/ofd2pdf.js   PDF export (optional; the button reports "未加载 ofd2pdf.js" if missing)
└─ external fonts       optional; drop into <root>/font/ (created by `npm run build`, auto-detected from ofd.min.js) — the folder must be served with a directory listing
```

> The release zip (`npm run build:viewer`) keeps the old flat layout `build/ofd.min.js` + `build/ofd2pdf.js`; `build-viewer.js` rewrites the script references in `viewer.html` while packaging.

## Startup and URL Parameters

The UI opens fine from `file://` (icons are external `images/*.svg` files), but loading an OFD **by URL** needs HTTP (`fetch` is blocked on `file://`) — from `file://`, use the toolbar **Open File** button to pick a local `.ofd`.

```bash
npx http-server .     # repo root
```

Open `http://localhost:8080/web/viewer.html?file=<path to your .ofd>` (a path relative to the repo root works, e.g. `../test/ofdFile/<your-sample>.ofd`).

| Param | Description |
| --- | --- |
| `file` | OFD path or URL to open. In the repo build the default points at a sample bundled under `../test/ofdFile/`; the `dist` package strips the test-file selector and this default (no auto-load without `?file=`). |
| `page` | Initial page to jump to (1-based). |
| `rotate` | Initial rotation angle in degrees. |
| `search` | Text to search for and highlight once the document is open. |

## Feature Modules

### Opening documents

The toolbar "Open" button uses `<input type="file">` for local `.ofd` files; the URL parameter opens a document directly.

### Pages and navigation

Page input (1-based), previous / next, scroll-driven paging; all page changes go through `setCurrentPage` and fire the `onPageChange` callback.

### Zoom

Zoom − / + plus the scale dropdown modes: `auto` (default — fits page height first, and when the whole page already fits it grows to page width, capped at 1.5×), `page-actual` (100%), `page-fit` (whole page in the container), `page-width`, fixed percentages, and `custom` after manual zooming. Zoom only changes container size and SVG width — vectors stay sharp.

### Rotate

`state.rotation` rotates the whole document.

### Search

Search-as-you-type findbar with prev / next and a hit counter. Matches are located by character range within text nodes and scrolled into view. `Ctrl+F` / `Cmd+F` opens the findbar; if text is selected in the document, the selection is filled into the search box and searched immediately (selections inside the findbar or sidebar do not overwrite the current query).

### Sidebar

Three panels, closable:

- **Thumbnails**: 200px-wide page thumbnails, click to jump, current page highlighted
- **Outline**: document bookmark tree; falls back to a "Page N" list when the document has no bookmarks
- **Signatures**: seal list (signer / time / seal image) with per-item "verify" running the digest comparison

### Outline

Outline data comes from `ofd.document.outlines`; clicking navigates to the target page and highlights the clicked item.

### Signature viewing and verification

The signature panel shows `OFD.getSignatures` results; the "verify" button calls `OFD.verifySignature(ofd, sig.index)` and shows `status` / `message`. Signature regions on the page open a detail popup when clicked.

### Seal placement

In placement mode, clicking a page drops a seal; right-clicking a placed seal deletes it (via the `sealMenu` popup). Positions are tracked in millimetres (top-left origin) and replayed by `applySealsToPage` when a page is re-rendered after unmounting.

### Toolbar extras

| Button | Behaviour |
| --- | --- |
| Print | renders all pages into a hidden iframe and calls the browser print dialog |
| Download | downloads the original `.ofd` (keeping the original file name) |
| Export PDF | converts via `build/ofd2pdf/ofd2pdf.js`, downloads `<name>.pdf` |
| Document properties | shows `OFD.getDocumentInfo` metadata |

## State Object

```js
const state = {
  ofd: null,             // handle returned by OFD.load
  pageCount: 0,
  currentPage: 0,        // 0-based
  scale: 1.0,
  scaleMode: 'auto',     // 'auto' | 'page-actual' | 'page-fit' | 'page-width' | 'custom'
  rotation: 0,
  pageContainers: [],    // per-page container DOM
  pageSvgs: [],          // per-page SVG (lazy; null when unmounted)
  renderedPages: new Set(), // indices currently rendered; used by the unmount scan
  pageDimensions: [],    // per-page { width, height } in mm
  loadToken: 0,          // load race generation
  fileName: 'sample.ofd', // displayed file name (last URL/path segment; repo builds seed it with a test sample)
  searchMatches: [],
  searchIndex: -1,
  searchQuery: '',
  sidebarView: 'thumb',
  activeOutlineLink: null,
  sigHighlight: null,
  stampMode: false,
  seal: null,            // { sealImg, width, height, sealId }
  sealGetCb: null,       // registered via onGetSeal
  sealChangeCb: null,    // registered via onSealChange
  pageChangeCb: null,    // registered via onPageChange
  sealPlaced: [],        // placed seals (mm coordinates)
  sealContextTarget: null,
  pdfConverting: false,
  lazyBuffer: 2,         // pages pre-rendered above/below the viewport
  renderTokens: [],      // per-page render generation
};
```

## Public Interfaces

The viewer adds seal, paging and toolbar-operation interfaces to the global `OFD` object. The five seal/paging interfaces are detailed below; the remaining toolbar operations are listed under "Toolbar operation APIs".

### OFD.setSeal(opts)

Provides a seal and enters placement mode.

| Param | Type | Description |
| --- | --- | --- |
| opts.sealImg | string | required — seal image base64 or image URL |
| opts.width | number | millimetres, default 36 |
| opts.height | number | millimetres, defaults to width |
| opts.sealId | string | signature id, passed through to callbacks |

```js
OFD.setSeal({ sealImg: 'data:image/png;base64,...', width: 36, height: 36, sealId: 'S001' });
```

The configuration is stored in `sessionStorage` (key `ofd_last_seal`), so the Stamp button reuses the last seal after a refresh.

### OFD.onGetSeal(cb)

Registers the seal-acquisition callback: clicking the toolbar "Stamp" button fires `cb()`; your code performs acquisition / password checks and calls `OFD.setSeal()` on success. Without a callback the button reuses the last seal.

```js
OFD.onGetSeal(async () => {
  const seal = await mySealService.pick();
  OFD.setSeal({ sealImg: seal.img, width: 36, height: 36, sealId: seal.id });
});
```

### OFD.onSealChange(cb)

Registers the unified seal-change callback, fired on both placement (`'place'`) and deletion (`'delete'`).

```js
OFD.onSealChange((list, action) => {
  // list: [{ sealImg, width, height, sealId, page, x, y }] — full current positions
  // page 1-based; x / y in mm, top-left origin; action: 'place' | 'delete'
});
```

### OFD.goToPage(page, opts)

Jumps to a page. `page` is 1-based; `opts.smooth === false` disables smooth scrolling. Returns whether the jump succeeded.

```js
OFD.goToPage(3);
OFD.goToPage(3, { smooth: false });
```

### OFD.onPageChange(cb)

Registers a page-change listener: prev/next buttons, page input, scroll paging, jumps and thumbnail clicks all trigger it.

```js
OFD.onPageChange((page, total) => {
  console.log('current', page, '/', total);   // page 1-based
});
```

### Toolbar operation APIs

| API | Description |
| --- | --- |
| `OFD.openFile(source, fileName?)` | Open a document from URL / Blob / ArrayBuffer / Uint8Array; returns `Promise<boolean>` |
| `OFD.chooseFile()` | Open the browser file picker (same as the toolbar Open button) |
| `OFD.download()` | Download the original OFD; returns `Promise<boolean>` |
| `OFD.print()` | Open the print dialog; returns whether it started |
| `OFD.convertToPdf()` | Convert to PDF and download; returns `Promise<boolean>` |
| `OFD.showDocumentInfo()` | Open the document-properties dialog |
| `OFD.firstPage()` / `OFD.lastPage()` | Jump to the first / last page |
| `OFD.prevPage()` / `OFD.nextPage()` | Previous / next page; `false` at the boundary |
| `OFD.setScale(value)` | `auto` / `page-actual` / `page-fit` / `page-width`, or a number 0.2–5; returns the actual scale |
| `OFD.zoomIn()` / `OFD.zoomOut()` | Zoom one step; returns the actual scale |
| `OFD.rotate(delta)` | Relative rotation; `delta` must be a multiple of 90; returns the current angle |
| `OFD.setRotation(deg)` | Absolute rotation; `deg` must be a multiple of 90; returns the current angle |
| `OFD.setSidebar(view)` | Open and switch to `thumb` / `outline` / `sign` |
| `OFD.toggleSidebar(view)` | Toggle a sidebar; `true` when opened, `false` when closed/invalid |
| `OFD.closeSidebar()` | Close the sidebar |
| `OFD.openSearch()` | Open the findbar, keeping the current query |
| `OFD.search(query)` | Open the findbar, fill the query and search; returns `Promise<number>` match count |
| `OFD.findNext()` / `OFD.findPrev()` | Next / previous match; returns the match count (0 when none) |
| `OFD.closeSearch()` | Close the findbar and clear highlights |
| `OFD.stamp()` | Enter stamp mode (same as the toolbar Stamp button); `false` without a document/seal |
| `OFD.exitStamp()` | Leave stamp mode |
| `OFD.toggleTools(show?)` | Open/close the secondary toolbar; omit `show` to toggle; returns visibility |
| `OFD.getViewerState()` | Returns `{ fileName, page, pageCount, scale, scaleMode, rotation, sidebarOpen, sidebarView, searchQuery, searchCount, stampMode }` |

## Full Integration Example

```html
<script src="build/ofd/ofd.js"></script>
<script src="build/ofd2pdf/ofd2pdf.js"></script>
<script src="web/viewer.js"></script>
<script>
  // external font directory (optional; not shipped, degrades to embedded/system fonts)
  OFD.setFontBase('assets/font/');

  // seal acquisition: show your own picker when "Stamp" is clicked
  OFD.onGetSeal(async () => {
    const seal = await mySealService.pick();
    OFD.setSeal({ sealImg: seal.img, width: 36, height: 36, sealId: seal.id });
  });

  // seal positions changed: submit to your backend
  OFD.onSealChange((list, action) => {
    if (action === 'place') myApi.saveSignatures(list);
    else myApi.deleteSignature(list);
  });

  // paging hook (e.g. reading progress)
  OFD.onPageChange((page, total) => myApi.saveProgress(page, total));

  // programmatic jump
  OFD.goToPage(1);
</script>
```

### Embedding in an iframe

The viewer is a self-contained page, so a host page can drop it into an `<iframe>` and drive the **same `OFD` interfaces** on the iframe's own window. The following is a complete host page: it opens a document by URL, waits until the document is actually ready, then wires the interfaces and drives them from controls.

> Serve the host page and the viewer over **HTTP(S) from the same origin** (e.g. `npx http-server .` at the repo root) — `contentWindow.OFD` is blocked cross-origin, and `?file=` needs `fetch` (unavailable on `file://`).

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <title>OFD viewer iframe example</title>
</head>
<body>
  <div>
    <button id="open">Load OFD</button>
    <input id="pg" type="number" min="1" value="3">
    <button id="go">goToPage</button>
    <button id="seal">setSeal</button>
    <span id="pgind">page: -</span>
  </div>

  <!-- viewer is self-contained; open the document purely via URL params (no JS needed) -->
  <iframe id="ofd" src="about:blank" style="width:100%;height:80vh"></iframe>

<script>
  const frame = document.getElementById('ofd');
  const log = (m) => console.log('[viewer]', m);
  const placeholderSeal = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">' +
    '<circle cx="40" cy="40" r="36" fill="none" stroke="#c00" stroke-width="3"/></svg>');

  let api = null;

  function wireIframe() {
    // load = skeleton ready only; contentWindow.OFD exists once viewer.js has run.
    // ?file= parsing is still async, so "ready" is confirmed by the first onPageChange.
    try {
      api = frame.contentWindow.OFD;             // same-origin only
    } catch (e) {
      log('cannot read contentWindow.OFD — host and viewer must be same-origin');
      return;
    }
    if (!api || !api.goToPage) { setTimeout(wireIframe, 50); return; }  // viewer.js not done yet

    api.onPageChange((page, total) => {
      document.getElementById('pgind').textContent = `page: ${page}/${total}`;
    });

    // Seal acquisition: fired when the toolbar "Stamp" button is clicked.
    api.onGetSeal(async () => {
      const seal = await mySealService.pick();    // your picker / password flow
      api.setSeal({ sealImg: seal.img, width: 36, height: 36, sealId: seal.id });
    });

    // Seal positions changed (place / delete) -> submit to your backend.
    api.onSealChange((list, action) => {
      // list: [{ sealImg, width, height, sealId, page, x, y }], page 1-based, x/y in mm
      myApi.save(list, action);
    });
  }
  frame.addEventListener('load', wireIframe);

  document.getElementById('open').onclick = () => {
    const file = prompt('OFD path/URL (relative to repo root)', '../test/ofdFile/<your-sample>.ofd');
    if (file) frame.src = 'web/viewer.html?file=' + encodeURIComponent(file);
  };

  document.getElementById('go').onclick = () => {
    const n = parseInt(document.getElementById('pg').value, 10);
    // returns false while the document is not loaded yet
    if (!api || !api.goToPage(n, { smooth: false })) log(`page ${n} not available yet`);
  };

  document.getElementById('seal').onclick = () => {
    if (api) api.setSeal({ sealImg: placeholderSeal, width: 36, height: 36, sealId: 'MANUAL' });
  };
</script>
</body>
</html>
```

### Minimal form

If the host only needs to open and position a document, no JS is required — just point the iframe at the viewer:

```html
<iframe src="web/viewer.html?file=../test/ofdFile/<your-sample>.ofd&page=3&search=合同" width="100%" height="800"></iframe>
```

- **Open / position via URL params first**: `?file=` (plus `page` / `rotate` / `search`) need no JS at all — the recommended way to hand a viewer to a host page.
- **Same-origin required for the JS API**: a cross-origin parent can only pass URL parameters; the browser blocks access to `contentWindow.OFD`. Serve the viewer and host from the same origin to call the interfaces.
- **Timing**: the `load` event fires when the skeleton is ready, but `?file=` parsing is async — a `goToPage` before the document is ready returns `false`; wait for the first `onPageChange` if you need to act after pages are available.

## Interaction Conventions

- Page numbers in `goToPage` / `onPageChange` are **1-based**; engine APIs take 0-based `pageIndex`
- Seal coordinates are **millimetres**, origin at the page's top-left corner
- Placed seals are deleted by **right-click**; deletion fires `onSealChange` with `action='delete'` and the remaining list
- Clicking a signature region on the page opens the signature detail popup

## Security notes

The viewer loads and parses external OFD files — unavoidable by design, since OFD exists to display documents from elsewhere.

### Engine-side mitigations

Implemented (see the [core engine docs](ofd.md#security-and-robustness)):

- ZIP decompression capped at 256 MB per entry (decompression-bomb defense), 64-entry cache
- Image decoding capped at 100 megapixels
- `javascript:` / `file:` / `data:` URL protocols rejected
- XML character references range-checked; malformed ones yield U+FFFD
- Signature / annotation / outline parsing individually wrapped in `try/catch`

**Not professionally security audited.** Known gaps: anomalous compression ratios, XML nesting depth, and boundary completeness in the hand-written TIFF/LZW decoder. Evaluate before processing untrusted files.

### Escaping status

The signature modal and seal list assign engine-generated SVG strings straight to `innerHTML` (`seal.innerHTML = sig.sealImage.data` in `web/viewer.js`). Escaping on that path:

- **Text content** — via `escapeXml()` ✓
- **Image data URLs** — via `escapeXml()` ✓
- **Font names** — via `cssFontName()`, which strips quotes and backslashes so attributes cannot break out ✓
- **Numeric attributes** (`box.w` / `Boundary` / `CTM` / `lineWidth`) — coerced to `number` by `parseBox` / `parseFloat`; no string concatenation ✓

No exploitable injection point was found in the render layer. But this relies on the convention that every concatenation point goes through escaping — **when adding a new graphic type, always reuse `escapeXml()`.**

### What you must handle at deployment time

1. **Verification is not proof of trust.** A "verified" badge in the viewer only means the signature value is self-consistent, protected files are unmodified, and the validity period covers the signing time. It does **not** mean a trusted authority signed it — certificates are trusted as-is with no chain building. Compliance scenarios require a separate CA validation layer.
2. **`unknown` is not `valid`.** When data is insufficient the API returns `status: 'unknown'`; your UI must render it distinctly, never as a pass.
3. **Configure `sandbox` and CSP when embedding via iframe.** By default the viewer executes same-origin JS.
4. **The `file` URL parameter triggers a cross-origin request.** Whitelist it before exposing the viewer publicly, otherwise it can be abused to probe internal resources (SSRF).

## Notes

1. The UI opens from `file://` (icons are external `images/*.svg`), but loading an OFD by URL needs HTTP; on `file://` use the **Open File** button
2. PDF export is demo-grade; complex layouts should be checked visually. Missing `build/ofd2pdf/ofd2pdf.js` reports "未加载 ofd2pdf.js，无法转换"
3. External fonts are optional. `npm run build` creates `<root>/font/`, which the engine auto-detects (from `ofd.min.js`); drop `name.ttf|.otf|.woff2` there with no `setFontBase` call. The folder must be served with a **directory listing** (nginx autoindex, `serve`/`http-server`) or `fetchFontIndex()` returns `null` and external fonts won't load — in that case rendering still falls back to embedded / system-stack fonts (a declared-but-unloadable embedded font also falls back to the system stack). Use `OFD.setFontBase('your/path/')` only to point elsewhere
4. Printing renders every page — watch memory and time on very large documents
5. Searching does the same: `doSearch()` calls `renderAllPages()` first, so one query on a thousand-page document renders the whole thing
6. Seal callbacks record **positions only**; writing seals back into the OFD file is up to the integrating system
7. With no `file` parameter **nothing loads automatically** (the release package strips the repo's test files); the user must pick one via the toolbar
