# viewer.js — OFD Viewer Application Logic

## Overview

`web/viewer.js` is the application layer of the OFD online reader. Together with `viewer.html` / `viewer.css` it provides the full reading experience: lazily rendered pages, zoom/rotate, full-text search, thumbnail / outline / signature sidebars, seal placement, printing, download and PDF export.

It does not reinvent the wheel: parsing and rendering are delegated to `build/ofd.js`, PDF export to `build/toPdf.js`; viewer.js itself owns state, DOM interaction and scheduling.

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
| Parsing / rendering | OFD → SVG | `build/ofd.js` |
| Conversion | SVG → PDF | `build/toPdf.js` |
| Application | state, interaction, scheduling | `web/viewer.js` |

### loadToken race protection

Opening files back to back, or starting a new load while one is in flight, must not let stale results overwrite the UI. Each load increments `state.loadToken`; async callbacks compare generations on return and drop mismatches.

## Call Flow

### Startup

```
DOMContentLoaded
  ├─ cache DOM elements (els.*)
  ├─ bind toolbar / sidebar / findbar events
  ├─ read URL param ?file= (default ../test/ofdFile/999.ofd)
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
├─ viewer.css    styles
└─ images/       icons (SVG)

Dependencies:
├─ ../build/ofd.js     parsing and rendering (required)
├─ ../build/toPdf.js   PDF export (optional; the button reports "未加载 toPdf.js" if missing)
└─ external fonts      pointed to by OFD.setFontBase — external/font/ in this repo
```

## Startup and URL Parameters

Serve over HTTP (`fetch` is blocked on `file://`):

```bash
npx http-server .     # repo root
```

Open `http://localhost:8080/web/viewer.html?file=../test/ofdFile/999.ofd`.

| Param | Description |
| --- | --- |
| `file` | OFD path or URL to open; default `../test/ofdFile/999.ofd` |

## Feature Modules

### Opening documents

The toolbar "Open" button uses `<input type="file">` for local `.ofd` files; the URL parameter opens a document directly.

### Pages and navigation

Page input (1-based), previous / next, scroll-driven paging; all page changes go through `setCurrentPage` and fire the `onPageChange` callback.

### Zoom

Zoom − / + and an "auto" mode (`scaleMode: 'auto'` fits container width). Zoom only changes container size and SVG width — vectors stay sharp.

### Rotate

`state.rotation` rotates the whole document.

### Search

Search-as-you-type findbar with prev / next and a hit counter. Matches are located by character range within text nodes and scrolled into view.

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
| Export PDF | converts via `build/toPdf.js`, downloads `<name>.pdf` |
| Document properties | shows `OFD.getDocumentInfo` metadata |

## State Object

```js
const state = {
  ofd: null,             // handle returned by OFD.load
  pageCount: 0,
  currentPage: 0,        // 0-based
  scale: 1.0,
  scaleMode: 'auto',     // 'auto' | manual factor
  rotation: 0,
  pageContainers: [],    // per-page container DOM
  pageSvgs: [],          // per-page SVG (lazy; null when unmounted)
  pageDimensions: [],    // per-page { width, height } in mm
  loadToken: 0,          // load race generation
  fileName: '999.ofd',
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

viewer adds five interfaces to the global `OFD` object for third-party seal integration and paging hooks.

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

## Full Integration Example

```html
<script src="build/ofd.js"></script>
<script src="build/toPdf.js"></script>
<script src="web/viewer.js"></script>
<script>
  // external font directory (this repo keeps fonts in external/font/)
  OFD.setFontBase('external/font/');

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

## Interaction Conventions

- Page numbers in `goToPage` / `onPageChange` are **1-based**; engine APIs take 0-based `pageIndex`
- Seal coordinates are **millimetres**, origin at the page's top-left corner
- Placed seals are deleted by **right-click**; deletion fires `onSealChange` with `action='delete'` and the remaining list
- Clicking a signature region on the page opens the signature detail popup

## Notes

1. Serve over HTTP (`fetch` does not work on `file://`)
2. PDF export is demo-grade; complex layouts should be checked visually. Missing `build/toPdf.js` reports "未加载 toPdf.js，无法转换"
3. The default external font directory is `<root>/font/`; this repo uses `external/font/`, so call `OFD.setFontBase('external/font/')`
4. Printing renders every page — watch memory and time on very large documents
5. Seal callbacks record **positions only**; writing seals back into the OFD file is up to the integrating system
