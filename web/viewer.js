﻿/*!
 * viewer.js — OFD 预览器应用逻辑
 * 依赖 ofd.js
 */
(function () {
  'use strict';

  const state = {
    ofd: null,
    pageCount: 0,
    currentPage: 0,
    scale: 1.0,
    scaleMode: 'auto',
    rotation: 0,
    pageContainers: [],
    pageSvgs: [],
    renderedPages: new Set(),
    pageDimensions: [],
    loadToken: 0,
    fileName: '999.ofd',
    searchMatches: [],
    searchIndex: -1,
    searchQuery: '',
    sidebarView: 'thumb',
    activeOutlineLink: null,  // 点击目录项时记录其 DOM，高亮跟随点击项而非页码
    sigHighlight: null,
    stampMode: false,
    seal: null,
    sealGetCb: null,
    sealChangeCb: null,
    pageChangeCb: null,
    sealPlaced: [],
    sealContextTarget: null,
    pdfConverting: false,
    // 懒渲染：仅渲染可视区 + 缓冲页，滚动时增量渲染/卸载离屏页
    lazyBuffer: 2,            // 视口上下各预渲染的页数
    renderTokens: [],         // 每页渲染代次：卸载/重渲染时递增，使在途渲染结果作废
    // 印章
    sealSeq: 0                // 印章放置唯一序号（删除定位用，不随数组下标漂移）
  };

  try {
    const savedSeal = sessionStorage.getItem('ofd_last_seal');
    if (savedSeal) {
      const s = JSON.parse(savedSeal);
      if (s && s.sealImg) state.seal = s;
    }
  } catch (e) {}

  const PX_PER_MM = 96 / 25.4;

  const $ = (id) => document.getElementById(id);
  const els = {
    outer: $('outerContainer'),
    main: $('mainContainer'),
    sidebarToggle: $('sidebarToggle'),
    outlineToggle: $('outlineToggle'),
    sidebarClose: $('sidebarCloseButton'),
    thumbnailView: $('thumbnailView'),
    outlineView: $('outlineView'),
    viewThumbnail: $('viewThumbnail'),
    viewOutline: $('viewOutline'),
    viewSignatures: $('viewSignatures'),
    signatureView: $('signatureView'),
    signatureToggle: $('signatureToggle'),
    stampButton: $('stampButton'),
    pdfButton: $('pdfButton'),
    sealMenu: $('sealMenu'),
    sealMenuDelete: $('sealMenuDelete'),
    viewer: $('viewer'),
    viewerContainer: $('viewerContainer'),
    pageNumber: $('pageNumber'),
    numPages: $('numPages'),
    prev: $('previousButton'),
    next: $('nextButton'),
    zoomIn: $('zoomInButton'),
    zoomOut: $('zoomOutButton'),
    scaleSelect: $('scaleSelect'),
    openFile: $('openFileButton'),
    findButton: $('findButton'),
    findbar: $('findbar'),
    findInput: $('findInput'),
    findPrevious: $('findPrevious'),
    findNext: $('findNext'),
    findResultsCount: $('findResultsCount'),
    findClose: $('findClose'),
    download: $('downloadButton'),
    print: $('printButton'),
    fileInput: $('fileInput'),
    fileSelect: $('fileSelect'),
    // 次级工具栏
    secondaryToggle: $('secondaryToolbarToggleButton'),
    secondaryToolbar: $('secondaryToolbar'),
    secondaryOpenFile: $('secondaryOpenFile'),
    secondaryDownload: $('secondaryDownload'),
    secondaryPrint: $('secondaryPrint'),
    firstPage: $('firstPage'),
    lastPage: $('lastPage'),
    rotateCw: $('pageRotateCw'),
    rotateCcw: $('pageRotateCcw'),
    docProps: $('documentProperties'),
    loadingBar: $('loadingBar'),
    progress: null,
    errorWrapper: $('errorWrapper'),
    errorTitle: $('errorTitle'),
    errorMessage: $('errorMessage'),
    errorRetry: $('errorRetry'),
    statusBar: $('statusBar'),
    infoDialog: $('documentInfoDialog'),
    infoClose: $('infoCloseBtn'),
    sigModalOverlay: $('sigModalOverlay'),
    sigModalSeal: $('sigModalSeal'),
    sigModalStatus: $('sigModalStatus'),
    sigModalSignInfo: $('sigModalSignInfo'),
    sigModalSealInfo: $('sigModalSealInfo'),
    sigModalVerify: $('sigModalVerify'),
    sigModalMsg: $('sigModalMsg'),
    sigModalClose: $('sigModalClose'),
    pdfModalOverlay: $('pdfModalOverlay'),
    pdfModalClose: $('pdfModalClose'),
    pdfModalMsg: $('pdfModalMsg'),
    pdfProgressInner: $('pdfProgressInner'),
    pdfProgressText: $('pdfProgressText')
  };
  els.progress = els.loadingBar.querySelector('.progress');

  function setProgress(pct, complete, error) {
    els.progress.style.width = pct + '%';
    els.progress.classList.toggle('complete', !!complete);
    els.progress.classList.toggle('error', !!error);
  }

  let statusTimer = 0;
  function showStatus(msg, ms) {
    els.statusBar.textContent = msg;
    els.statusBar.classList.add('visible');
    clearTimeout(statusTimer);
    if (ms) statusTimer = setTimeout(() => els.statusBar.classList.remove('visible'), ms);
  }

  function showError(message, title) {
    els.errorTitle.textContent = title || '加载失败';
    els.errorMessage.textContent = message;
    els.errorWrapper.classList.add('visible');
  }
  function hideError() {
    els.errorWrapper.classList.remove('visible');
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function verifyStatusLabel(st) {
    return st === 'valid' ? '验证通过' : st === 'partial' ? '部分验证' : st === 'invalid' ? '验证失败' : '无法验证';
  }

  async function openSource(source, fileName) {
    const token = ++state.loadToken; // 本次加载序号；之后若序号变化，说明已切换文件，旧流程立即退出
    if (fileName) state.fileName = fileName;
    hideError();
    clearSearch();
    setProgress(5);
    state.pageContainers = [];
    state.pageSvgs = [];
    state.renderedPages.clear();
    state.pageDimensions = [];
    state.signatures = null;   // 重置签名数据，避免旧文件的签名残留到新文件页面
    state.sigHighlight = null;
    exitStampMode();
    hideSealMenu();
    state.sealPlaced = []; // 页面重建，已放置印章的 DOM 引用失效
    state.sealSeq = 0;
    state.renderTokens = [];
    els.viewer.innerHTML = '';
    els.thumbnailView.innerHTML = '';

    try {
      showStatus('正在解析 OFD…');
      setProgress(20);
      const ofd = await OFD.load(source);
      if (token !== state.loadToken) return false; // 已切换文件，放弃本次加载
      state.ofd = ofd;
      state.pageCount = OFD.getPageCount(ofd);
      els.numPages.textContent = '/ ' + state.pageCount;

      // 获取每页尺寸（图像已懒加载，此处只解析页面 XML，很快）
      for (let i = 0; i < state.pageCount; i++) {
        const dim = await OFD.getPageDimensions(ofd, i);
        if (token !== state.loadToken) return false; // 加载期间切走了文件，立即停止
        state.pageDimensions.push(dim);
      }

      setProgress(50);
      showStatus('共 ' + state.pageCount + ' 页，正在渲染…');
      await buildPageSlots();
      if (token !== state.loadToken) return false;
      applyScaleMode(); // 渲染前确定缩放比例，避免渲染后再调整导致页面跳变
      // 懒渲染：仅渲染可视区 + 缓冲页；滚动时增量渲染 / 卸载离屏页
      await syncVisiblePages();
      if (token !== state.loadToken) return false;

      els.numPages.textContent = '/ ' + state.pageCount;
      els.pageNumber.value = '1';
      state.currentPage = 0;
      setProgress(100, true);
      showStatus('加载完成：' + state.pageCount + ' 页', 2000);
      updateNavButtons();

      // 缩略图、目录与签名列表
      renderThumbnails();
      renderOutline();
      renderSignatures().catch(e => console.error('签名列表渲染失败', e));
      return true;
    } catch (err) {
      if (token !== state.loadToken) return false; // 旧加载的报错不影响新加载的文档
      console.error(err);
      setProgress(100, false, true);
      showError(err && err.message ? err.message : String(err), 'OFD 加载错误');
      return false;
    }
  }

  async function buildPageSlots() {
    const ofd = state.ofd;
    for (let i = 0; i < state.pageCount; i++) {
      const dim = state.pageDimensions[i];
      const pxW = Math.round(dim.width * PX_PER_MM);
      const pxH = Math.round(dim.height * PX_PER_MM);
      const slot = document.createElement('div');
      slot.className = 'ofd-page';
      slot.dataset.pageIndex = String(i);
      slot.style.width = pxW + 'px';
      slot.style.height = pxH + 'px';
      slot.innerHTML =
        '<div class="ofd-page-placeholder">第 ' + (i + 1) + ' 页</div>';
      slot.addEventListener('click', (e) => {
        const link = e.target.closest && e.target.closest('.ofd-link');
        if (link) {
          e.preventDefault();
          e.stopPropagation();
          const url = link.getAttribute('data-link-url') || '';
          if (/^https?:\/\//i.test(url)) {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
          return;
        }
        if (state.stampMode) {
          onPageStampClick(i, e);
        } else {
          // 点击页面跳转到该页
          setCurrentPage(i, false);
        }
      });
      els.viewer.appendChild(slot);
      state.pageContainers.push(slot);
    }
  }

  function renderThumbnails() {
    for (let i = 0; i < state.pageCount; i++) {
      const thumb = document.createElement('div');
      thumb.className = 'thumbnail';
      thumb.dataset.pageIndex = String(i);
      thumb.title = '第 ' + (i + 1) + ' 页';
      thumb.addEventListener('click', () => {
        setCurrentPage(i, true);
      });
      const label = document.createElement('div');
      label.className = 'thumb-label';
      label.textContent = (i + 1) + ' / ' + state.pageCount;
      thumb.appendChild(label);
      els.thumbnailView.appendChild(thumb);
    }
    renderVisibleThumbnails();
    updateThumbnailSelection();
  }

  function renderVisibleThumbnails() {
    const container = els.thumbnailView;
    const rect = container.getBoundingClientRect();
    const top = rect.top - 400;     // 上下各留 400px 预渲染缓冲
    const bottom = rect.bottom + 400;
    const thumbs = container.children;
    for (let i = 0; i < thumbs.length; i++) {
      const thumb = thumbs[i];
      if (thumb.querySelector('svg')) continue;   // 已渲染过
      const r = thumb.getBoundingClientRect();
      if (r.bottom >= top && r.top <= bottom) {
        renderThumbnail(parseInt(thumb.dataset.pageIndex, 10), thumb);
      }
    }
  }

  async function renderThumbnail(idx, thumb) {
    try {
      const svg = await OFD.renderPage(state.ofd, idx, { width: 200 });
      if (thumb.isConnected) {
        thumb.insertBefore(svg, thumb.firstChild);
      }
    } catch (e) {
      console.error('缩略图渲染失败: 第 ' + (idx + 1) + ' 页', e);
    }
  }

  // 渲染目录（大纲）
  function renderOutline() {
    els.outlineView.innerHTML = '';
    let outlines = state.ofd?.document?.outlines || [];

    // 无内置目录时：按页面数自动生成兜底目录（第 X 页）
    let isFallback = false;
    if (!outlines.length && state.pageCount > 0) {
      isFallback = true;
      outlines = [];
      for (let i = 0; i < state.pageCount; i++) {
        outlines.push({ title: '第 ' + (i + 1) + ' 页', page: i, children: [] });
      }
    }
    state.outlines = outlines;

    if (!outlines.length) {
      const empty = document.createElement('div');
      empty.className = 'toc-empty';
      empty.textContent = '该文档没有目录';
      els.outlineView.appendChild(empty);
      return;
    }

    const rootUl = document.createElement('ul');
    rootUl.className = 'toc-list';
    // 兜底目录因为没有层级嵌套，depth 固定为 0
    renderOutlineItems(outlines, rootUl, 0, isFallback);
    els.outlineView.appendChild(rootUl);

    // 首次渲染后同步当前页面的选中状态
    updateOutlineSelection();
  }

  // 递归渲染目录项（isFallback：兜底生成的目录，当前虽未使用，但保留以便后续样式差异）
  function renderOutlineItems(items, parentUl, depth, _isFallback) {
    const linkPadLeft = 4 + depth * 16; // 每层缩进 16px
    for (const item of items) {
      const li = document.createElement('li');
      li.className = 'toc-item';

      // 一行：展开按钮 + 链接
      const row = document.createElement('div');
      row.className = 'toc-row';

      // 展开/折叠按钮
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'toc-toggle';
      const hasChildren = !!(item.children && item.children.length);
      if (!hasChildren) toggle.classList.add('leaf');
      // 标题占满一行时也需要占宽度，因此即使 leaf 也保留占位（CSS 让它透明不可点击）
      toggle.setAttribute('aria-label', hasChildren ? '折叠' : '');
      toggle.tabIndex = hasChildren ? 0 : -1;
      row.appendChild(toggle);

      const link = document.createElement('div');
      link.className = 'toc-link';
      if (item.page == null) link.classList.add('no-page');
      link.style.paddingLeft = linkPadLeft + 'px';
      if (item.page != null) link.dataset.pageIndex = String(item.page);

      const titleSpan = document.createElement('span');
      titleSpan.className = 'toc-title';
      titleSpan.textContent = item.title || '(无标题)';
      link.appendChild(titleSpan);

      if (item.page != null) {
        const pageSpan = document.createElement('span');
        pageSpan.className = 'toc-page';
        pageSpan.textContent = String(item.page + 1);
        link.appendChild(pageSpan);

        link.addEventListener('click', () => {
          state.activeOutlineLink = link; // 记录点击项，高亮跟随点击而非页码
          goToOutline(item);
          updateOutlineSelection();
        });
      }

      row.appendChild(link);
      li.appendChild(row);
      parentUl.appendChild(li);

      // 子项列表
      let subUl = null;
      if (hasChildren) {
        subUl = document.createElement('ul');
        subUl.className = 'toc-list';
        renderOutlineItems(item.children, subUl, depth + 1);
        parentUl.appendChild(subUl);

        // 初始默认展开（若需要默认折叠可改为 collapsed 初始 + toggle.classList.add('collapsed')）
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const isCollapsed = subUl.classList.toggle('collapsed');
          toggle.classList.toggle('collapsed', isCollapsed);
          toggle.setAttribute('aria-label', isCollapsed ? '展开' : '折叠');
        });
      }
    }
  }

  // 更新目录项选中态：优先高亮点击的目录项；无点击记录时按页码高亮
  function updateOutlineSelection() {
    if (!state.outlines?.length) return;
    const links = els.outlineView.querySelectorAll('.toc-link[data-page-index]');
    const currentPage = state.currentPage;
    for (const lk of links) lk.classList.remove('active');

    // 优先高亮点击的目录项（页码与当前页一致时保持，翻页后自动回退页码逻辑）
    const clicked = state.activeOutlineLink;
    if (clicked && clicked.isConnected &&
        parseInt(clicked.dataset.pageIndex, 10) === currentPage) {
      clicked.classList.add('active');
      scrollOutlineRowIntoView(clicked);
      return;
    }
    state.activeOutlineLink = null;

    let best = null;
    for (const lk of links) {
      const idx = parseInt(lk.dataset.pageIndex, 10);
      if (!isFinite(idx)) continue;
      if (idx <= currentPage && (best == null || idx > best)) best = idx;
    }
    if (best != null) {
      for (const lk of links) {
        if (parseInt(lk.dataset.pageIndex, 10) === best) {
          lk.classList.add('active');
          scrollOutlineRowIntoView(lk);
          break;
        }
      }
    }
  }

  // 确保目录项整行在侧栏视区内（对齐整行，避免仅滚动链接内部）
  function scrollOutlineRowIntoView(lk) {
    const row = lk.closest('.toc-row') || lk;
    if (row.scrollIntoView) {
      const parentRect = els.outlineView.getBoundingClientRect();
      const rect = row.getBoundingClientRect();
      if (rect.top < parentRect.top || rect.bottom > parentRect.bottom) {
        row.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function setSidebarView(view) {
    state.sidebarView = view;
    els.viewThumbnail.classList.toggle('active', view === 'thumb');
    els.viewOutline.classList.toggle('active', view === 'outline');
    els.viewSignatures.classList.toggle('active', view === 'sign');
    els.thumbnailView.classList.toggle('hidden', view !== 'thumb');
    els.outlineView.classList.toggle('hidden', view !== 'outline');
    els.signatureView.classList.toggle('hidden', view !== 'sign');
    syncSidebarUI();
  }

  // 同步侧边栏按钮选中态：三个按钮互斥 —
  // 缩略图/目录视图选中 sidebarToggle（或按细分：目录视图高亮 outlineToggle，缩略图高亮 sidebarToggle），
  // 签名视图选中 signatureToggle；侧栏关闭则都不选中
  function syncSidebarUI() {
    const open = els.outer.classList.contains('sidebarOpen');
    const isSign = state.sidebarView === 'sign';
    const isOutline = state.sidebarView === 'outline';
    const isThumb = state.sidebarView === 'thumb';
    // sidebarToggle：侧栏开且是缩略图视图
    const toggleSidebarBtn = open && isThumb;
    els.sidebarToggle.setAttribute('aria-expanded', String(toggleSidebarBtn));
    els.sidebarToggle.classList.toggle('toggled', toggleSidebarBtn);
    // outlineToggle：侧栏开且是目录视图
    const toggleOutlineBtn = open && isOutline;
    els.outlineToggle.setAttribute('aria-expanded', String(toggleOutlineBtn));
    els.outlineToggle.classList.toggle('toggled', toggleOutlineBtn);
    // signatureToggle：侧栏开且是签名视图
    els.signatureToggle.setAttribute('aria-expanded', String(open && isSign));
    els.signatureToggle.classList.toggle('toggled', open && isSign);
  }

  function applySigHighlight() {
    document.querySelectorAll('.ofd-signature-box').forEach(r => r.remove());
    const hl = state.sigHighlight;
    if (!hl) return;
    const svg = state.pageSvgs[hl.page];
    if (!svg) return;
    const b = hl.boundary;
    const ns = 'http://www.w3.org/2000/svg';
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('class', 'ofd-signature-box');
    rect.setAttribute('x', b.x);
    rect.setAttribute('y', b.y);
    rect.setAttribute('width', b.w);
    rect.setAttribute('height', b.h);
    svg.appendChild(rect);
  }

  // 在页面上为签名位置添加可交互区域：滑过显示虚线框，点击弹出签名信息模态框
  // 幂等：先移除本页已有的 hit 区域再添加，切换文件后不会残留旧文件的区域
  function addSignatureHitAreas(i) {
    const svg = state.pageSvgs[i];
    if (!svg) return;
    svg.querySelectorAll('.ofd-sig-hit').forEach(r => r.remove());
    const sigs = state.signatures || [];
    const ns = 'http://www.w3.org/2000/svg';
    sigs.forEach((sig) => {
      (sig.positions || []).forEach((pos) => {
        if (pos.page !== i + 1) return;
        const b = pos.boundary;
        if (!b) return;
        const rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('class', 'ofd-sig-hit');
        rect.setAttribute('x', b.x);
        rect.setAttribute('y', b.y);
        rect.setAttribute('width', b.w);
        rect.setAttribute('height', b.h);
        svg.appendChild(rect);
        rect.addEventListener('mouseenter', () => showSigHoverBox(svg, b));
        rect.addEventListener('mouseleave', () => removeSigHoverBox(svg));
        rect.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openSigModal(sig);
        });
      });
    });
  }

  // 滑过签名位置时显示临时虚线框（与签名边界一致）
  function showSigHoverBox(svg, b) {
    removeSigHoverBox(svg);
    const ns = 'http://www.w3.org/2000/svg';
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('class', 'ofd-sig-hover');
    rect.setAttribute('x', b.x);
    rect.setAttribute('y', b.y);
    rect.setAttribute('width', b.w);
    rect.setAttribute('height', b.h);
    svg.appendChild(rect);
  }
  function removeSigHoverBox(svg) {
    svg.querySelectorAll('.ofd-sig-hover').forEach(r => r.remove());
  }

  function openSigModal(sig) {
    const seal = els.sigModalSeal;
    seal.innerHTML = '';
    if (sig.sealImage) {
      if (sig.sealImage.type === 'image') {
        const img = document.createElement('img');
        img.src = sig.sealImage.data;
        img.alt = '签章';
        seal.appendChild(img);
      } else {
        seal.innerHTML = sig.sealImage.data; // 矢量印章 SVG 字符串
      }
    }
    els.sigModalStatus.textContent = '未验证';
    els.sigModalStatus.classList.remove('ok', 'bad');

    // 生成一行信息（label + value）
    function sigRow(label, value) {
      return '<div class="sig-row"><span class="sig-label">' + label + '：</span><span class="sig-value">' + value + '</span></div>';
    }
    // 生成折叠分组：标题 + 详情按钮 + 默认显示核心行，extraHtml 展开后显示
    function sigGroup(title, coreHtml, extraHtml, toggleLabel) {
      const label = toggleLabel || '详情';
      return '<div class="sig-group-head"><span class="sig-group-title">' + title +
             '</span><button class="sig-group-toggle" type="button" data-collapsed-label="' + label + '">' + label + '</button></div>' +
             '<div class="sig-group-body collapsed">' + coreHtml +
             '<div class="sig-extra">' + extraHtml + '</div></div>';
    }

    // 签章信息组：默认显示签章人/签章时间，详情展开其余字段
    // 原文摘要/原文属性与 WPS 一致：均指向 Signature.xml（路径 + 完整 SM3 摘要）
    const signatureDigest = sig.signatureDigest || '';
    const digestVal = signatureDigest
      ? '<code title="' + escapeHtml(signatureDigest) + '">' + escapeHtml(signatureDigest) + '</code>'
      : '—';
    // 签名值：从 SignedValue 中提取的签名值（SM2 为 DER 编码 r||s），与 WPS 一致显示完整 hex
    const sigVal = sig.signatureValueHex
      ? '<code title="' + escapeHtml(sig.signedValuePath + (sig.signedValueSize ? '（' + sig.signedValueSize + ' 字节）' : '')) + '">' + escapeHtml(sig.signatureValueHex) + '</code>'
      : escapeHtml(sig.signedValuePath || '—') + (sig.signedValueSize ? '（' + sig.signedValueSize + ' 字节）' : '');
    els.sigModalSignInfo.innerHTML = sigGroup(
      '签章信息',
      sigRow('签章人', escapeHtml(sig.signer || '—')) +
        sigRow('签章时间', escapeHtml(sig.signTime || '—')),
      sigRow('签章提供者', escapeHtml(sig.provider || '—')) +
        sigRow('原文摘要', digestVal) +
        sigRow('原文属性', escapeHtml(sig.signaturePath || '—')) +
        sigRow('签名值', sigVal) +
        sigRow('签名方法', escapeHtml(sig.signatureMethod || '—')) +
        sigRow('版本号', escapeHtml(sig.providerVersion || '—')),
      '签章详情'
    );

    // 印章信息组：默认显示印章名称/有效起止日期，详情展开其余字段
    const sa = sig.sealAttrs || {};
    const validHtml = '从' + (sa.notBefore || '—') + '到' + (sa.notAfter || '—');
    els.sigModalSealInfo.innerHTML = sigGroup(
      '印章信息',
      sigRow('印章名称', escapeHtml(sa.name || '—')) +
        sigRow('有效日期', escapeHtml(validHtml)),
      sigRow('印章标识', escapeHtml(sa.id || '—')) +
        sigRow('印章类型', escapeHtml(sa.type || '—')) +
        sigRow('制章时间', escapeHtml(sa.createTime || '—')),
      '印章属性'
    );

    // 绑定折叠切换
    [els.sigModalSignInfo, els.sigModalSealInfo].forEach(function (container) {
      const toggle = container.querySelector('.sig-group-toggle');
      const body = container.querySelector('.sig-group-body');
      toggle.addEventListener('click', function () {
        body.classList.toggle('collapsed');
        this.textContent = body.classList.contains('collapsed') ? this.dataset.collapsedLabel : '收起';
      });
    });
    els.sigModalMsg.textContent = '';
    els.sigModalMsg.classList.remove('ok', 'bad', 'unknown');
    els.sigModalVerify.disabled = false;
    els.sigModalVerify.textContent = '验证';
    els.sigModalVerify.onclick = async () => {
      els.sigModalVerify.disabled = true;
      els.sigModalVerify.textContent = '验证中…';
      els.sigModalStatus.textContent = '验证中…';
      let res;
      try {
        res = await OFD.verifySignature(state.ofd, sig.index);
      } catch (e) {
        res = { valid: false, status: 'unknown', message: '验证异常：' + (e && e.message ? e.message : String(e)) };
      }
      const st = res.status || (res.valid ? 'valid' : 'invalid');
      els.sigModalStatus.textContent = verifyStatusLabel(st);
      els.sigModalStatus.classList.remove('ok', 'bad', 'unknown');
      els.sigModalStatus.classList.add(st === 'valid' ? 'ok' : (st === 'invalid' ? 'bad' : 'unknown'));
      els.sigModalVerify.disabled = false;
      els.sigModalVerify.textContent = '验证';
      els.sigModalMsg.textContent = res.message || '';
      els.sigModalMsg.classList.remove('ok', 'bad', 'unknown');
      els.sigModalMsg.classList.add(st === 'valid' ? 'ok' : (st === 'invalid' ? 'bad' : 'unknown'));
    };
    els.sigModalOverlay.classList.remove('hidden');
  }

  // 关闭签名信息模态框
  function closeSigModal() {
    els.sigModalOverlay.classList.add('hidden');
  }

  function enterStampMode() {
    if (!state.ofd || !state.seal) return;
    state.stampMode = true;
    els.viewerContainer.classList.add('stamp-mode');
    els.stampButton.classList.add('toggled');
    showStatus('盖章模式：移动鼠标选择位置，点击放置印章（Esc 退出）', 3000);
  }

  // 工具栏「盖章」按钮：触发第三方取章回调；若未注册回调则复用上次印章直接进入
  function toggleStampMode() {
    if (!state.ofd) return;
    if (state.stampMode) { exitStampMode(); return; }
    hideSealMenu();
    if (state.sealGetCb) {
      // 交给第三方：自行弹密码框/取章，获取成功后内部调用 OFD.setSeal() 进入选位
      try { state.sealGetCb(); } catch (e) { console.error(e); }
      return;
    }
    if (!state.seal) {
      // 未注册取章回调且无可用印章：给出正确接入指引
      showStatus('未接入取章流程：请调用 OFD.onGetSeal() 注册取章回调（或先调用 OFD.setSeal() 提供印章）', 4000);
      return;
    }
    enterStampMode();
  }

  function exitStampMode() {
    state.stampMode = false;
    els.viewerContainer.classList.remove('stamp-mode');
    els.stampButton.classList.remove('toggled');
    removeStampPlacePreview();
  }

  // 移除页面上的盖章位置预览
  function removeStampPlacePreview() {
    document.querySelectorAll('.stamp-place-preview').forEach(el => el.remove());
  }

  // 客户端坐标 → SVG 用户坐标（mm）。用 getScreenCTM 逆变换，兼容缩放与旋转
  function clientToSvg(svg, clientX, clientY) {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  // 盖章模式下鼠标移动：印章图片跟随光标（印章中心对齐光标）
  function updateStampFollow(svg, x, y) {
    const seal = state.seal;
    if (!seal) return;
    // 跨页移动时，移除其它页面上残留的预览
    const cur = document.querySelector('.stamp-place-preview');
    if (cur && cur.ownerSVGElement !== svg) removeStampPlacePreview();
    const ns = 'http://www.w3.org/2000/svg';
    let img = svg.querySelector('.stamp-place-preview');
    if (!img) {
      img = document.createElementNS(ns, 'image');
      img.setAttribute('class', 'stamp-place-preview');
      img.setAttribute('width', String(seal.width));
      img.setAttribute('height', String(seal.height));
      img.setAttribute('href', seal.sealImg);
      svg.appendChild(img);
    }
    img.setAttribute('x', String(x - seal.width / 2));
    img.setAttribute('y', String(y - seal.height / 2));
  }

  // 选位模式下点击页面：换算物理坐标并立即回调
  function onPageStampClick(pageIndex, event) {
    if (!state.seal) { exitStampMode(); return; }
    const svg = state.pageSvgs[pageIndex];
    if (!svg) return; // 页面尚未渲染时忽略本次点击
    const pos = clientToSvg(svg, event.clientX, event.clientY);
    if (!pos) return;
    const dim = state.pageDimensions[pageIndex];
    if (!dim) return;
    const w = state.seal.width;
    const h = state.seal.height;
    // 以鼠标点击处为印章中心，夹取到页面范围内保证印章完整落在页内
    const x = Math.max(0, Math.min(pos.x - w / 2, dim.width - w));
    const y = Math.max(0, Math.min(pos.y - h / 2, dim.height - h));
    // 在页面上绘制已放置的印章（供右键删除）
    placeSealVisual(pageIndex, x, y, w, h);
    // 统一回调：携带变化后的「全部签章位置」列表
    emitSealChange('place', buildSealList());
    // 放置完成后退出选位状态；再次盖章需重新点击工具栏按钮
    exitStampMode();
    showStatus('已记录签章位置：第 ' + (pageIndex + 1) + ' 页 (' + Math.round(x * 100) / 100 + ', ' + Math.round(y * 100) / 100 + ') mm', 3000);
  }

  // 当前全部已放置签章的位置列表（onSealChange 回调的 list 格式）
  // [{ sealImg, width, height, sealId, page: 1-based, x, y }]（x/y 为毫米左上角坐标）
  function buildSealList() {
    return state.sealPlaced.map(function (p) {
      return {
        sealImg: p.sealImg,
        width: p.width,
        height: p.height,
        sealId: p.sealId,
        page: p.page + 1,
        x: Math.round(p.x * 100) / 100,
        y: Math.round(p.y * 100) / 100
      };
    });
  }

  // 触发签章变化回调（place / delete），list 为变化后的完整签章列表
  function emitSealChange(action, list) {
    if (typeof state.sealChangeCb === 'function') {
      try { state.sealChangeCb(list, action); } catch (e) { console.error(e); }
    }
  }

  // 在页面上绘制已放置的印章（透明度见 .seal-placed，可右键删除）。
  // 数据记录在 state.sealPlaced（mm 坐标），_uid 为唯一序号用于删除定位；
  // 页面懒渲染卸载后重渲染时由 applySealsToPage 重放。
  function placeSealVisual(pageIndex, x, y, w, h) {
    const svg = state.pageSvgs[pageIndex];
    if (!svg || !state.seal) return;
    const rec = {
      page: pageIndex,
      x: x,
      y: y,
      width: w,
      height: h,
      sealImg: state.seal.sealImg,
      sealId: state.seal.sealId,
      _uid: ++state.sealSeq
    };
    state.sealPlaced.push(rec);
    appendSealImage(svg, rec);
  }

  // 按数据记录在指定 SVG 上创建印章 <image>（放置与懒渲染重放共用）
  function appendSealImage(svg, rec) {
    const ns = 'http://www.w3.org/2000/svg';
    const img = document.createElementNS(ns, 'image');
    img.setAttribute('class', 'seal-placed');
    img.setAttribute('data-seal-uid', String(rec._uid));
    img.setAttribute('x', String(rec.x));
    img.setAttribute('y', String(rec.y));
    img.setAttribute('width', String(rec.width));
    img.setAttribute('height', String(rec.height));
    img.setAttribute('href', rec.sealImg);
    svg.appendChild(img);
  }

  // 懒渲染：页面（重新）渲染后重放该页已放置的全部印章
  function applySealsToPage(pageIndex) {
    const svg = state.pageSvgs[pageIndex];
    if (!svg) return;
    for (const rec of state.sealPlaced) {
      if (rec.page === pageIndex) appendSealImage(svg, rec);
    }
  }

  // 开放接口：OFD.setSeal(opts)
  //   opts: { sealImg: base64 或图片 URL, width: 毫米, height: 毫米, sealId: 签章 id }
  // 提供印章并进入盖章模式；点击放置后通过 OFD.onSealChange(cb) 统一回调全部签章位置。
  function setSeal(opts) {
    opts = opts || {};
    if (!opts.sealImg) throw new Error('setSeal 缺少参数 sealImg');
    const w = Number(opts.width) > 0 ? Number(opts.width) : 36;
    const h = Number(opts.height) > 0 ? Number(opts.height) : w;
    state.seal = {
      sealImg: opts.sealImg,
      width: w,
      height: h,
      sealId: opts.sealId || ''
    };
    // 记住本次印章配置：刷新页面后点「盖章」仍可直接进入选位模式
    try { sessionStorage.setItem('ofd_last_seal', JSON.stringify(state.seal)); } catch (e) { /* 超出存储配额时忽略 */ }
    if (!state.ofd) {
      showStatus('文档尚未加载，无法进入盖章模式', 3000);
    } else {
      enterStampMode();
    }
  }
  OFD.setSeal = setSeal;

  // 开放接口：OFD.onGetSeal(cb)
  // 注册第三方取章回调：点击工具栏「盖章」按钮时触发 cb()，
  // 第三方自行完成取章/密码验证等操作，成功后调用 OFD.setSeal() 进入盖章模式。
  // 未注册回调时，按钮直接复用上次 OFD.setSeal() 的印章进入模式。
  function onGetSeal(cb) {
    state.sealGetCb = typeof cb === 'function' ? cb : null;
  }
  OFD.onGetSeal = onGetSeal;

  // 开放接口：OFD.onSealChange(cb)
  // 注册签章变化统一回调：点击放置(place)或右键删除(delete)后都会触发。
  //   cb(list, action)：list 为变化后的「全部签章位置」数组
  //     [{ sealImg, width, height, sealId, page, x, y }, ...]，
  //   action 为 'place' 或 'delete'，用于区分是新增还是删除。
  // 只注册一次即可收到后续所有放置/删除事件；删除时 list 为剩余签章列表。
  function onSealChange(cb) {
    state.sealChangeCb = typeof cb === 'function' ? cb : null;
  }
  OFD.onSealChange = onSealChange;

  function showSealMenu(clientX, clientY) {
    const m = els.sealMenu;
    m.classList.remove('hidden');
    // 保持菜单完整在视口内
    const r = m.getBoundingClientRect();
    const left = Math.min(clientX, window.innerWidth - r.width - 4);
    const top = Math.min(clientY, window.innerHeight - r.height - 4);
    m.style.left = Math.max(0, left) + 'px';
    m.style.top = Math.max(0, top) + 'px';
  }

  function hideSealMenu() {
    els.sealMenu.classList.add('hidden');
    state.sealContextTarget = null;
  }

  async function renderSignatures() {
    els.signatureView.innerHTML = '';
    let sigs = [];
    try {
      sigs = await OFD.getSignatures(state.ofd);
    } catch (e) {
      console.error(e);
    }
    state.signatures = sigs;  // 供页面签名点击区域使用
    // 签名数据就绪后，为已渲染的页面补加点击区域
    for (let i = 0; i < state.pageCount; i++) {
      if (state.pageSvgs[i]) addSignatureHitAreas(i);
    }
    if (!sigs.length) {
      const empty = document.createElement('div');
      empty.className = 'sig-empty';
      empty.textContent = '该文档没有数字签名';
      els.signatureView.appendChild(empty);
      return;
    }
    sigs.forEach((sig, idx) => {
      const card = document.createElement('div');
      card.className = 'sig-card';

      // 签章图片
      const sealWrap = document.createElement('div');
      sealWrap.className = 'sig-seal';
      if (sig.sealImage) {
        if (sig.sealImage.type === 'image') {
          const img = document.createElement('img');
          img.src = sig.sealImage.data;
          img.alt = '签章';
          sealWrap.appendChild(img);
        } else {
          sealWrap.innerHTML = sig.sealImage.data; // 矢量印章 SVG 字符串
        }
      }

      // 状态 + 验证按钮
      const status = document.createElement('span');
      status.className = 'sig-status';
      status.textContent = '未验证';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sig-verify';
      btn.textContent = '验证';
      btn.dataset.idx = String(idx);

      const actions = document.createElement('div');
      actions.className = 'sig-actions';
      actions.appendChild(status);
      actions.appendChild(btn);

      const head = document.createElement('div');
      head.className = 'sig-card-head';
      head.appendChild(sealWrap);
      head.appendChild(actions);

      // 信息行
      const info = document.createElement('div');
      info.className = 'sig-info';
      const signer = document.createElement('div');
      signer.innerHTML = '<span class="sig-label">签章人：</span>' + escapeHtml(sig.signer || '—');
      const time = document.createElement('div');
      time.innerHTML = '<span class="sig-label">签章时间：</span>' + escapeHtml(sig.signTime || '—');
      const domain = document.createElement('div');
      domain.innerHTML = '<span class="sig-label">域：</span>' +
        (sig.pages.length
          ? sig.pages.map(function (p) {
              return '<a href="#" class="sig-page" data-page="' + p + '">位于第 ' + p + ' 页</a>';
            }).join('、')
          : '—');
      info.appendChild(signer);
      info.appendChild(time);
      info.appendChild(domain);

      card.appendChild(head);
      card.appendChild(info);
      els.signatureView.appendChild(card);

      // 验证按钮：SM3/SHA 摘要比对（ofd-core 提供 verifySignature）
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = '验证中…';
        status.textContent = '验证中…';
        status.classList.remove('ok', 'bad', 'unknown');
        let res;
        try {
          res = await OFD.verifySignature(state.ofd, parseInt(btn.dataset.idx, 10));
        } catch (e) {
          res = { valid: false, status: 'unknown', message: '验证异常：' + (e && e.message ? e.message : String(e)) };
        }
        const st = res.status || (res.valid ? 'valid' : 'invalid');
        status.textContent = verifyStatusLabel(st);
        status.classList.remove('ok', 'bad', 'unknown');
        status.classList.add(st === 'valid' ? 'ok' : (st === 'invalid' ? 'bad' : 'unknown'));
        btn.disabled = false;
        btn.textContent = '验证';
        let msg = card.querySelector('.sig-msg');
        if (!msg) {
          msg = document.createElement('div');
          msg.className = 'sig-msg';
          card.appendChild(msg);
        }
        msg.textContent = res.message || '';
        msg.classList.remove('ok', 'bad', 'unknown');
        msg.classList.add(st === 'valid' ? 'ok' : (st === 'invalid' ? 'bad' : 'unknown'));
      });

      // 域内页码跳转 + 页面虚线框定位
      domain.querySelectorAll('.sig-page').forEach((a) => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const page = parseInt(a.dataset.page, 10) - 1;
          const pos = (sig.positions || []).find(p => p.page === page + 1);
          state.sigHighlight = pos ? { page, boundary: pos.boundary } : null;
          setCurrentPage(page, true);
          applySigHighlight();
        });
      });
    });
  }

  async function renderPage(i) {
    if (state.pageSvgs[i]) return;
    const ofd = state.ofd;
    const slot = state.pageContainers[i];
    if (!slot) return;
    const dim = state.pageDimensions[i];
    if (!dim) return;
    // 渲染代次：卸载/重渲染会使在途的异步渲染结果作废
    const tok = (state.renderTokens[i] = (state.renderTokens[i] || 0) + 1);
    // 渲染逻辑宽度：尺寸不变，仅影响 SVG 的 width 属性（保持矢量）
    const pxW = Math.round(dim.width * PX_PER_MM);
    const svg = await OFD.renderPage(ofd, i, { width: pxW });
    if (tok !== state.renderTokens[i]) return; // 已被卸载/重渲染取代，丢弃本次结果
    if (state.pageSvgs[i]) return;             // 并发下其它路径已渲染
    svg.classList.add('ofd-page-svg');
    slot.innerHTML = '';
    slot.appendChild(svg);
    state.pageSvgs[i] = svg;
    state.renderedPages.add(i);
    applyPageStyle(i, state.scale);
    // 叠加层重建（均幂等）：签名热区 / 已放置印章 / 签名定位框 / 搜索高亮
    addSignatureHitAreas(i);
    applySealsToPage(i);
    applySigHighlight();
    applySearchHighlights(i);
  }

  // 卸载离屏页：清空 slot 释放 SVG DOM 与内存，恢复占位；印章数据仍保留，重渲染时重放
  function releasePage(i) {
    state.renderedPages.delete(i);
    if (!state.pageSvgs[i]) return;
    state.renderTokens[i] = (state.renderTokens[i] || 0) + 1; // 使在途渲染结果作废
    const slot = state.pageContainers[i];
    if (slot) {
      slot.innerHTML = '<div class="ofd-page-placeholder">第 ' + (i + 1) + ' 页</div>';
    }
    state.pageSvgs[i] = null;
  }

  // 页槽按 offsetTop 单调排列，用二分查找代替每次滚动全量扫描
  function findFirstPageBelow(top) {
    let lo = 0, hi = state.pageCount - 1, ans = state.pageCount;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const s = state.pageContainers[mid];
      if (!s) { lo = mid + 1; continue; }
      if (s.offsetTop + s.offsetHeight > top) { ans = mid; hi = mid - 1; }
      else lo = mid + 1;
    }
    return ans;
  }
  function findLastPageAtOrBefore(bottom) {
    let lo = 0, hi = state.pageCount - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const s = state.pageContainers[mid];
      if (!s) { lo = mid + 1; continue; }
      if (s.offsetTop <= bottom) { ans = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return ans;
  }

  // 当前可视页范围（含上下缓冲），基于 slot 布局尺寸计算
  function visibleRange() {
    if (!state.pageCount || !state.pageContainers.length) return null;
    const container = els.viewerContainer;
    const top = container.scrollTop;
    const bottom = top + container.clientHeight;
    const B = state.lazyBuffer;
    const firstIdx = findFirstPageBelow(top);
    const lastIdx = findLastPageAtOrBefore(bottom);
    const first = firstIdx < state.pageCount ? firstIdx : state.pageCount - 1;
    const last = lastIdx >= 0 ? lastIdx : 0;
    return {
      first: Math.max(0, first - B),
      last: Math.min(state.pageCount - 1, Math.max(first, last) + B),
    };
  }

  let lazyRaf = 0;
  function scheduleSyncVisiblePages() {
    cancelAnimationFrame(lazyRaf);
    lazyRaf = requestAnimationFrame(() => syncVisiblePages());
  }

  // 懒渲染核心：渲染进入可视区（含缓冲）的页，卸载远离可视区的页
  async function syncVisiblePages() {
    const range = visibleRange();
    if (!range) return;
    const tasks = [];
    for (let i = range.first; i <= range.last; i++) {
      if (!state.pageSvgs[i]) {
        tasks.push(renderPage(i).catch(e => console.error('页面渲染失败: 第 ' + (i + 1) + ' 页', e)));
      }
    }
    // 卸载缓冲带之外的页（只遍历已渲染页，避免千页文档每次滚动全量扫描）
    for (const i of state.renderedPages) {
      if (i < range.first - 1 || i > range.last + 1) releasePage(i);
    }
    if (tasks.length) await Promise.all(tasks);
  }

  /* ----------------------------- 页面跳转 ----------------------------- */
  function setCurrentPage(idx, scrollIntoView) {
    if (idx < 0 || idx >= state.pageCount) return;
    state.currentPage = idx;
    els.pageNumber.value = String(idx + 1);
    updateNavButtons();
    updateThumbnailSelection();
    updateOutlineSelection();
    if (scrollIntoView) {
      const slot = state.pageContainers[idx];
      if (slot) {
        // 仅在 viewerContainer 内滚动，避免工具栏被一起滚动
        const container = els.viewerContainer;
        const targetTop = getOffsetTopWithin(slot, container);
        container.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    }
    applySigHighlight();
    emitPageChange();
    // 跳页后确保目标页进入懒渲染范围（配合滚动事件双保险）
    scheduleSyncVisiblePages();
  }

  // 目录跳转：切换到目标页，并按 Dest 坐标定位到页内对应位置
  // OFD 目录坐标（Left/Top，单位 mm）相对页面左上角；旋转时按显示坐标系换算
  function goToOutline(item) {
    if (item.page == null) return;
    // 先切页并触发该页渲染，确保 slot 高度正确后再定位
    setCurrentPage(item.page, false);
    const slot = state.pageContainers[item.page];
    if (!slot) return;
    const dim = state.pageDimensions[item.page];
    const container = els.viewerContainer;
    const targetTop = getOffsetTopWithin(slot, container);
    let yPx = 0;
    if (item.dest && dim) {
      const { x, y } = item.dest;
      const rot = state.rotation;
      if (rot === 90) {
        yPx = x * PX_PER_MM * state.scale;
      } else if (rot === 180) {
        yPx = (dim.height - y) * PX_PER_MM * state.scale;
      } else if (rot === 270) {
        yPx = (dim.width - x) * PX_PER_MM * state.scale;
      } else {
        yPx = y * PX_PER_MM * state.scale;
      }
    }
    container.scrollTo({ top: targetTop + yPx, behavior: 'smooth' });
  }

  // 页码变化统一回调：cb(page, total)，page 为 1-based
  function emitPageChange() {
    if (typeof state.pageChangeCb === 'function') {
      try { state.pageChangeCb(state.currentPage + 1, state.pageCount); } catch (e) { console.error(e); }
    }
  }

  // 开放接口：OFD.goToPage(page, opts)
  //   跳转到指定页。page 为 1-based；opts 可选 { smooth: false } 关闭平滑滚动。
  //   返回是否跳转成功。
  function goToPage(page, opts) {
    const idx = Number(page) - 1;
    if (isNaN(idx) || idx < 0 || idx >= state.pageCount) return false;
    opts = opts || {};
    setCurrentPage(idx, false);
    const slot = state.pageContainers[idx];
    if (slot) {
      const container = els.viewerContainer;
      const targetTop = getOffsetTopWithin(slot, container);
      if (opts.smooth === false) {
        container.scrollTop = targetTop;
      } else {
        container.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    }
    return true;
  }
  OFD.goToPage = goToPage;

  // 开放接口：OFD.onPageChange(cb)
  //   注册页码监听：翻页按钮 / 页码输入 / 滚动换页 / 跳转 / 缩略图点击等导致当前页变化时触发。
  //   cb(page, total)：page 为 1-based 当前页码，total 为总页数。
  function onPageChange(cb) {
    state.pageChangeCb = typeof cb === 'function' ? cb : null;
  }
  OFD.onPageChange = onPageChange;

  // ==================== 工具栏操作开放接口 ====================
  function chooseFile() {
    els.fileInput.click();
    return true;
  }

  async function openFile(source, fileName) {
    if (!source) return false;
    let name = fileName;
    if (!name && source && source.name) name = source.name;
    if (!name && typeof source === 'string') {
      try {
        const u = new URL(source, location.href);
        name = decodeURIComponent(u.pathname.split('/').pop() || '') || 'document.ofd';
      } catch (e) {
        name = 'document.ofd';
      }
    }
    return await openSource(source, name || 'document.ofd');
  }

  function firstPage() {
    if (!state.pageCount) return false;
    setCurrentPage(0, true);
    return true;
  }
  function lastPage() {
    if (!state.pageCount) return false;
    setCurrentPage(state.pageCount - 1, true);
    return true;
  }
  function prevPage() {
    if (!state.pageCount || state.currentPage <= 0) return false;
    setCurrentPage(state.currentPage - 1, true);
    return true;
  }
  function nextPage() {
    if (!state.pageCount || state.currentPage >= state.pageCount - 1) return false;
    setCurrentPage(state.currentPage + 1, true);
    return true;
  }

  function zoomIn() {
    state.scaleMode = 'custom';
    applyScale(Math.min(state.scale * 1.2, 5));
    return state.scale;
  }
  function zoomOut() {
    state.scaleMode = 'custom';
    applyScale(Math.max(state.scale / 1.2, 0.2));
    return state.scale;
  }
  function setScale(value) {
    const modes = ['auto', 'page-actual', 'page-fit', 'page-width'];
    if (typeof value === 'string' && modes.indexOf(value) >= 0) {
      state.scaleMode = value;
      applyScaleMode();
      return state.scale;
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return state.scale;
    state.scaleMode = 'custom';
    applyScale(Math.min(5, Math.max(0.2, n)));
    return state.scale;
  }

  function rotate(delta) {
    const d = Number(delta);
    if (!Number.isFinite(d) || d % 90 !== 0) return state.rotation;
    applyRotation(d);
    return state.rotation;
  }
  function setRotation(deg) {
    const d = Number(deg);
    if (!Number.isFinite(d) || d % 90 !== 0) return state.rotation;
    const target = ((d % 360) + 360) % 360;
    applyRotation(target - state.rotation);
    return state.rotation;
  }

  function closeSidebar() {
    els.outer.classList.remove('sidebarOpen');
    syncSidebarUI();
    setTimeout(() => applyScaleMode(), 250);
    return true;
  }
  function setSidebar(view) {
    if (view !== 'thumb' && view !== 'outline' && view !== 'sign') return false;
    setSidebarView(view);
    els.outer.classList.add('sidebarOpen');
    syncSidebarUI();
    setTimeout(() => applyScaleMode(), 250);
    return true;
  }
  function toggleSidebar(view) {
    if (view !== 'thumb' && view !== 'outline' && view !== 'sign') return false;
    const open = els.outer.classList.contains('sidebarOpen');
    if (open && state.sidebarView === view) {
      closeSidebar();
      return false;
    }
    setSidebar(view);
    return true;
  }

  async function search(query) {
    const q = query == null ? '' : String(query).trim();
    openFindbar(true);
    els.findInput.value = q;
    if (!q) {
      clearSearch();
      return 0;
    }
    return await doSearch();
  }
  function openSearch() {
    openFindbar();
    return true;
  }
  function findNext() {
    if (!state.searchMatches.length) return 0;
    goNextMatch();
    return state.searchMatches.length;
  }
  function findPrev() {
    if (!state.searchMatches.length) return 0;
    goPrevMatch();
    return state.searchMatches.length;
  }
  function closeSearch() {
    closeFindbar();
    return true;
  }

  function stamp() {
    if (!state.ofd) return false;
    if (state.stampMode) return true;
    toggleStampMode();
    return state.stampMode || !!state.sealGetCb;
  }
  function exitStamp() {
    exitStampMode();
    return true;
  }

  function toggleTools(show) {
    if (show === undefined) toggleSecondaryToolbar();
    else closeSecondaryToolbar(!show);
    return !els.secondaryToolbar.classList.contains('hidden');
  }

  function getViewerState() {
    return {
      fileName: state.fileName,
      page: state.currentPage + 1,
      pageCount: state.pageCount,
      scale: state.scale,
      scaleMode: state.scaleMode,
      rotation: state.rotation,
      sidebarOpen: els.outer.classList.contains('sidebarOpen'),
      sidebarView: state.sidebarView,
      searchQuery: state.searchQuery,
      searchCount: state.searchMatches.length,
      stampMode: state.stampMode,
    };
  }

  OFD.chooseFile = chooseFile;
  OFD.openFile = openFile;
  OFD.firstPage = firstPage;
  OFD.lastPage = lastPage;
  OFD.prevPage = prevPage;
  OFD.nextPage = nextPage;
  OFD.zoomIn = zoomIn;
  OFD.zoomOut = zoomOut;
  OFD.setScale = setScale;
  OFD.rotate = rotate;
  OFD.setRotation = setRotation;
  OFD.closeSidebar = closeSidebar;
  OFD.setSidebar = setSidebar;
  OFD.toggleSidebar = toggleSidebar;
  OFD.search = search;
  OFD.openSearch = openSearch;
  OFD.findNext = findNext;
  OFD.findPrev = findPrev;
  OFD.closeSearch = closeSearch;
  OFD.stamp = stamp;
  OFD.exitStamp = exitStamp;
  OFD.toggleTools = toggleTools;
  OFD.download = downloadDocument;
  OFD.print = printDocument;
  OFD.convertToPdf = convertToPdf;
  OFD.showDocumentInfo = showDocumentInfo;
  OFD.getViewerState = getViewerState;

  // 计算元素相对于指定容器的偏移 top（用于手动滚动定位）
  function getOffsetTopWithin(el, container) {
    let top = 0;
    let node = el;
    while (node && node !== container) {
      top += node.offsetTop;
      node = node.offsetParent;
    }
    return top;
  }

  function updateNavButtons() {
    els.prev.disabled = state.currentPage <= 0;
    els.next.disabled = state.currentPage >= state.pageCount - 1;
    els.firstPage.disabled = state.currentPage <= 0;
    els.lastPage.disabled = state.currentPage >= state.pageCount - 1;
  }

  function updateThumbnailSelection() {
    const thumbs = els.thumbnailView.querySelectorAll('.thumbnail');
    thumbs.forEach((t, i) => {
      t.classList.toggle('selected', i === state.currentPage);
    });
  }

  function applyScaleMode() {
    if (!state.pageCount || !state.pageDimensions[state.currentPage]) return;
    const container = els.viewerContainer;
    const dim = state.pageDimensions[state.currentPage];
    const pageWidthPx = dim.width * PX_PER_MM;
    const pageHeightPx = dim.height * PX_PER_MM;
    const containerW = container.clientWidth - 40;
    const containerH = container.clientHeight - 40;

    let scale = state.scale;
    let mode = state.scaleMode;
    if (mode === 'auto') {
      // 选择适合页宽或页高，取较小者
      const sx = containerW / pageWidthPx;
      const sy = containerH / pageHeightPx;
      scale = Math.min(sx, sy, 2);
      // 页面可完整显示（缩小比例 >= 1）时放大到适合页宽（上限 1.5 倍）
      if (scale >= 1) scale = Math.min(containerW / pageWidthPx, 1.5);
    } else if (mode === 'page-actual') {
      scale = 1;
    } else if (mode === 'page-fit') {
      const sx = containerW / pageWidthPx;
      const sy = containerH / pageHeightPx;
      scale = Math.min(sx, sy);
    } else if (mode === 'page-width') {
      scale = containerW / pageWidthPx;
    }
    applyScale(scale);
  }

  // 应用单页的尺寸 + 旋转 transform（applyScale 和 renderPage 复用）
  function applyPageStyle(i, scale) {
    const slot = state.pageContainers[i];
    if (!slot) return;
    const dim = state.pageDimensions[i];
    const rot = state.rotation;
    const rotated = rot === 90 || rot === 270;
    const w = dim.width * PX_PER_MM * scale;
    const h = dim.height * PX_PER_MM * scale;
    // 旋转 90/270 时容器宽高互换
    const cw = rotated ? h : w;
    const ch = rotated ? w : h;
    slot.style.width = cw + 'px';
    slot.style.height = ch + 'px';
    slot.classList.remove('rotated-90', 'rotated-180', 'rotated-270');
    if (rot) slot.classList.add('rotated-' + rot);
    const svg = state.pageSvgs[i];
    if (svg) {
      // SVG 宽高保持原始 w/h（viewBox 也是 0 0 w h，不变形）
      svg.setAttribute('width', String(w));
      svg.setAttribute('height', String(h));
      // 用内联样式锁定尺寸，避免 .ofd-page-svg 的 width:100% 覆盖（旋转时会被容器拉伸）
      svg.style.width = w + 'px';
      svg.style.height = h + 'px';
      // CSS transform 从右到左应用：先 rotate，再 translate 补偿
      if (rot === 0) {
        svg.style.transform = '';
        svg.style.transformOrigin = '';
        svg.style.position = '';
      } else if (rot === 90) {
        // 顺时针 90°：rotate 后内容 x∈[-h,0], y∈[0,w]，translate(h,0) 移到 [0,h]×[0,w]
        svg.style.transform = `translate(${h}px, 0) rotate(90deg)`;
        svg.style.transformOrigin = '0 0';
        svg.style.position = 'absolute';
      } else if (rot === 180) {
        svg.style.transform = `translate(${w}px, ${h}px) rotate(180deg)`;
        svg.style.transformOrigin = '0 0';
        svg.style.position = 'absolute';
      } else if (rot === 270) {
        // 顺时针 270°：rotate 后内容 x∈[0,h], y∈[-w,0]，translate(0,w) 移到 [0,h]×[0,w]
        svg.style.transform = `translate(0, ${w}px) rotate(270deg)`;
        svg.style.transformOrigin = '0 0';
        svg.style.position = 'absolute';
      }
      svg.style.left = '0';
      svg.style.top = '0';
      svg.style.marginLeft = '';
      svg.style.marginTop = '';
    }
  }

  function applyScale(scale) {
    const container = els.viewerContainer;
    // 缩放前记录「视口顶部锚点页 + 它滚出顶部的比例」：缩放会改容器高度，
    // 若只保留 scrollTop 数值，重排后同一数值会落到别的页上（跳转页丢失）。
    const oldTop = container.scrollTop;
    let anchorIdx = 0, anchorOldTop = 0, anchorOldH = 0;
    for (let i = 0; i < state.pageCount; i++) {
      const slot = state.pageContainers[i];
      if (!slot) continue;
      if (slot.offsetTop <= oldTop) { anchorIdx = i; anchorOldTop = slot.offsetTop; anchorOldH = slot.offsetHeight || 1; }
      else break;
    }
    const anchorRatio = anchorOldH ? Math.max(0, Math.min(1, (oldTop - anchorOldTop) / anchorOldH)) : 0;

    state.scale = scale;
    for (let i = 0; i < state.pageCount; i++) {
      applyPageStyle(i, scale);
    }
    updateScaleSelect();
    applySigHighlight();

    // 按锚点页缩放后的新几何还原滚动位置，保持跳转页不跑偏
    const anchorSlot = state.pageContainers[anchorIdx];
    if (anchorSlot) container.scrollTop = anchorSlot.offsetTop + anchorRatio * anchorSlot.offsetHeight;

    // 缩放改变页面布局尺寸，重新计算可视范围
    scheduleSyncVisiblePages();
  }

  function applyRotation(delta) {
    state.rotation = (state.rotation + delta + 360) % 360;
    applyScale(state.scale);
  }

  // Ctrl+F 时优先使用正文选区；必须在 openFindbar() 聚焦输入框之前读取，
  // 否则浏览器会清掉文档选区。
  function getSelectedDocText() {
    try {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return "";
      const node = sel.getRangeAt(0).commonAncestorContainer;
      const el = node.nodeType === 1 ? node : node.parentElement;
      if (!el || !el.closest || !el.closest('.ofd-page')) return "";
      return sel.toString().trim();
    } catch (e) {
      return "";
    }
  }

  function openFindbar(skipSearch) {
    // 用 position:fixed 定位，与 #secondaryToolbar 弹出框一致，避免父级 overflow 裁剪
    const btnRect = els.findButton.getBoundingClientRect();
    const bar = els.findbar;
    const menuWidth = 340;
    let left = btnRect.left;
    if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
    if (left < 4) left = 4;
    bar.style.left = left + 'px';
    bar.style.top = (btnRect.bottom + 4) + 'px';
    bar.style.width = menuWidth + 'px';
    bar.classList.remove('hidden');
    els.findButton.classList.add('toggled');
    els.findButton.setAttribute('aria-expanded', 'true');
    els.findInput.focus();
    els.findInput.select();
    if (!skipSearch && els.findInput.value.trim()) doSearch();
  }

  function closeFindbar() {
    els.findbar.classList.add('hidden');
    els.findButton.classList.remove('toggled');
    els.findButton.setAttribute('aria-expanded', 'false');
    clearSearch();
  }

  function clearSearch() {
    clearHighlights();
    state.searchMatches = [];
    state.searchIndex = -1;
    state.searchQuery = '';
    els.findResultsCount.classList.add('hidden');
  }

  function clearHighlights() {
    document.querySelectorAll('.search-highlight').forEach(el => el.remove());
  }

  // 高亮矩形坐标是页面坐标，必须插在 SVG 根层。
  // 文字现在包在 <g transform>（Boundary/CTM）里，插到 text 旁边会被二次变换。
  function insertHighlightRect(textEl, rect) {
    const svg = textEl.ownerSVGElement;
    if (!svg) return false;
    let host = textEl;
    while (host.parentNode && host.parentNode !== svg) host = host.parentNode;
    if (host.parentNode !== svg) {
      svg.appendChild(rect);
      return true;
    }
    // 放在该图元组之前：位于页面白底之后、文字之下
    svg.insertBefore(rect, host);
    return true;
  }

  // 在指定页（重渲染后）重建搜索高亮：按 textIdx 重新定位文本元素并生成矩形
  function applySearchHighlights(i) {
    const svg = state.pageSvgs[i];
    if (!svg) return;
    const textEls = svg.querySelectorAll('text');
    for (const m of state.searchMatches) {
      if (m.page !== i) continue;
      if (m.rect) { m.rect.remove(); m.rect = null; }
      const tEl = m.textIdx < textEls.length ? textEls[m.textIdx] : null;
      const rect = tEl ? makeHighlightRect(tEl, m.start, m.end) : null;
      if (rect && insertHighlightRect(tEl, rect)) {
        m.rect = rect;
        rect.classList.toggle('active', m === state.searchMatches[state.searchIndex]);
      }
    }
  }

  // 确保所有页面已渲染（搜索需要全文档文本）
  async function renderAllPages() {
    const tasks = [];
    for (let i = 0; i < state.pageCount; i++) {
      if (!state.pageSvgs[i]) tasks.push(renderPage(i));
    }
    if (tasks.length) await Promise.all(tasks);
  }

  // 执行搜索：提取所有页 <text> 内容，匹配并生成高亮 rect
  async function doSearch() {
    const query = els.findInput.value.trim();
    if (!query) {
      clearSearch();
      return 0;
    }
    state.searchQuery = query.toLowerCase();
    await renderAllPages();

    const matches = [];
    for (let i = 0; i < state.pageCount; i++) {
      const svg = state.pageSvgs[i];
      if (!svg) continue;
      const textEls = svg.querySelectorAll('text');
      // 记录 text 元素在页面中的索引而非引用：页面被懒渲染卸载后重渲染时可重建高亮
      for (let k = 0; k < textEls.length; k++) {
        const content = (textEls[k].textContent || '').toLowerCase();
        let idx = content.indexOf(state.searchQuery);
        while (idx >= 0) {
          matches.push({ page: i, textIdx: k, start: idx, end: idx + state.searchQuery.length, rect: null });
          idx = content.indexOf(state.searchQuery, idx + 1);
        }
      }
    }

    clearHighlights();
    state.searchMatches = matches;
    state.searchIndex = -1;

    for (const m of matches) {
      const svg = state.pageSvgs[m.page];
      if (!svg) continue;
      const tEl = svg.querySelectorAll('text')[m.textIdx];
      const rect = tEl ? makeHighlightRect(tEl, m.start, m.end) : null;
      if (rect && insertHighlightRect(tEl, rect)) {
        m.rect = rect;
      }
    }

    if (matches.length) {
      els.findResultsCount.classList.remove('hidden');
      setActiveMatch(findStartIndex());
    } else {
      els.findResultsCount.classList.remove('hidden');
      els.findResultsCount.textContent = '无匹配';
    }
    return matches.length;
  }

  // 根据文本元素内容与匹配字符范围，构造 SVG 高亮矩形
  function makeHighlightRect(textEl, start, end) {
    const ns = 'http://www.w3.org/2000/svg';
    try {
      const n = textEl.getNumberOfChars();
      if (!n) return null;
      const s = Math.max(0, Math.min(start, n - 1));
      const e = Math.max(1, Math.min(end, n));
      // X 用字符起始/结束位置（按字符推进宽度，相邻字符高亮连续）；
      // Y 用匹配字符的实际字形范围（getExtentOfChar）：getBBox 会包含字体行高
      // （ascent+descent），大字身字体（如部分 CJK）下高亮框会比字形高出很多
      const p0 = textEl.getStartPositionOfChar(s);
      const p1 = textEl.getEndPositionOfChar(e - 1);
      let y0 = Infinity, y1 = -Infinity;
      let extentOk = false;
      for (let i = s; i < e; i++) {
        try {
          const ex = textEl.getExtentOfChar(i);
          if (!ex.width && !ex.height) continue; // 零宽字符（如空字形）跳过
          y0 = Math.min(y0, ex.y); y1 = Math.max(y1, ex.y + ex.height);
          extentOk = true;
        } catch (err) {}
      }
      if (!extentOk) {
        // 字形范围不可用（异常字体/字符）：退回字体框
        const bbox = textEl.getBBox();
        if (!bbox.width && !bbox.height) return null;
        y0 = bbox.y; y1 = bbox.y + bbox.height;
      }
      let x0 = Math.min(p0.x, p1.x);
      let x1 = Math.max(p0.x, p1.x);
      if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return null;
      // getBBox / getStartPositionOfChar 返回文本元素局部坐标（不含元素自身 transform 及
      // viewBox 缩放），需经 getCTM 换算到页面坐标系，否则高亮会错位（如堆在左上角或铺满页面）
      const svg = textEl.ownerSVGElement;
      const svgCtm = svg && svg.getCTM();
      const textCtm = textEl.getCTM();
      if (svgCtm && textCtm) {
        const pageCtm = svgCtm.inverse().multiply(textCtm);
        const xs = [], ys = [];
        for (const p of [new DOMPoint(x0, y0), new DOMPoint(x1, y0), new DOMPoint(x0, y1), new DOMPoint(x1, y1)]) {
          const q = p.matrixTransform(pageCtm);
          xs.push(q.x); ys.push(q.y);
        }
        x0 = Math.min.apply(null, xs); x1 = Math.max.apply(null, xs);
        y0 = Math.min.apply(null, ys); y1 = Math.max.apply(null, ys);
      }
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('class', 'search-highlight');
      rect.setAttribute('x', String(x0));
      rect.setAttribute('y', String(y0));
      rect.setAttribute('width', String(x1 - x0));
      rect.setAttribute('height', String(y1 - y0));
      return rect;
    } catch (e) {
      return null;
    }
  }

  // 定位第一个匹配（优先当前页之后的）
  function findStartIndex() {
    const matches = state.searchMatches;
    if (!matches.length) return 0;
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].page >= state.currentPage) return i;
    }
    return 0;
  }

  // 激活指定匹配：更新 active class、计数、跳页并滚动
  async function setActiveMatch(idx) {
    const matches = state.searchMatches;
    if (!matches.length) return;
    idx = ((idx % matches.length) + matches.length) % matches.length;
    state.searchIndex = idx;
    matches.forEach((m, k) => {
      if (m.rect) m.rect.classList.toggle('active', k === idx);
    });
    els.findResultsCount.textContent = (idx + 1) + ' / ' + matches.length;
    const m = matches[idx];
    if (m.page !== state.currentPage) {
      setCurrentPage(m.page, false);
    }
    // 目标页可能已被懒渲染卸载：先渲染（renderPage 内部会重建该页高亮），再定位
    if (!state.pageSvgs[m.page]) await renderPage(m.page);
    applySearchHighlights(m.page);
    if (m.rect) scrollToMatch(m);
  }

  function scrollToMatch(m) {
    if (!m.rect) return;
    const container = els.viewerContainer;
    const r = m.rect.getBoundingClientRect();
    const c = container.getBoundingClientRect();
    const targetTop = container.scrollTop + (r.top - c.top) - container.clientHeight / 2 + r.height / 2;
    container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  }

  function goNextMatch() {
    if (state.searchMatches.length) setActiveMatch(state.searchIndex + 1);
  }

  function goPrevMatch() {
    if (state.searchMatches.length) setActiveMatch(state.searchIndex - 1);
  }

  function toggleSecondaryToolbar() {
    const hidden = els.secondaryToolbar.classList.contains('hidden');
    closeSecondaryToolbar(!hidden);
  }

  function closeSecondaryToolbar(close) {
    if (close === undefined) close = true;
    if (close) {
      els.secondaryToolbar.classList.add('hidden');
      els.secondaryToggle.setAttribute('aria-expanded', 'false');
      els.secondaryToggle.classList.remove('toggled');
    } else {
      // 用 position:fixed 定位，避免父级 overflow 裁剪
      const btnRect = els.secondaryToggle.getBoundingClientRect();
      const menu = els.secondaryToolbar;
      menu.classList.remove('hidden');
      // 左对齐按钮，下方 4px；超出右边界时回退为右对齐
      const menuWidth = 220; // 略大于 min-width，给文字留余地
      const maxLeft = window.innerWidth - menuWidth - 4;
      let left = Math.min(btnRect.left, maxLeft);
      if (left < 4) left = 4;
      menu.style.left = left + 'px';
      menu.style.top = (btnRect.bottom + 4) + 'px';
      menu.style.minWidth = menuWidth + 'px';
      els.secondaryToggle.setAttribute('aria-expanded', 'true');
      els.secondaryToggle.classList.add('toggled');
    }
  }

  function updateScaleSelect() {
    const v = state.scale;
    const select = els.scaleSelect;
    // 非自定义模式：显示模式名（自动缩放/适合页宽等），不显示百分比
    if (state.scaleMode !== 'custom') {
      select.value = state.scaleMode;
      return;
    }
    const percent = Math.round(v * 100);
    // 检查是否匹配预设
    const preset = Array.from(select.options).find(o =>
      o.value !== 'custom' && o.value !== 'auto' &&
      o.value !== 'page-actual' && o.value !== 'page-fit' && o.value !== 'page-width' &&
      Math.abs(parseFloat(o.value) - v) < 0.001
    );
    if (preset) {
      select.value = preset.value;
    } else {
      const custom = select.querySelector('#customScaleOption');
      custom.textContent = percent + '%';
      custom.value = String(v);
      select.value = String(v);
    }
  }

  function bindEvents() {
    // 侧边栏切换（缩略图按钮）
    els.sidebarToggle.addEventListener('click', () => {
      const showing = els.outer.classList.contains('sidebarOpen') && state.sidebarView === 'thumb';
      if (showing) {
        els.outer.classList.remove('sidebarOpen');
      } else {
        els.outer.classList.add('sidebarOpen');
        setSidebarView('thumb');
      }
      syncSidebarUI();
      setTimeout(() => applyScaleMode(), 250);
    });
    els.sidebarClose.addEventListener('click', () => {
      els.outer.classList.remove('sidebarOpen');
      syncSidebarUI();
      setTimeout(() => applyScaleMode(), 250);
    });
    // 点击阅读区域关闭侧边栏
    els.viewerContainer.addEventListener('click', () => {
      if (els.outer.classList.contains('sidebarOpen')) {
        els.outer.classList.remove('sidebarOpen');
        syncSidebarUI();
        setTimeout(() => applyScaleMode(), 250);
      }
    });

    // 签名信息模态框关闭
    els.sigModalClose.addEventListener('click', closeSigModal);
    els.sigModalOverlay.addEventListener('click', (e) => {
      if (e.target === els.sigModalOverlay) closeSigModal();
    });

    // 盖章：工具栏按钮进入选位模式（印章由 OFD.setSeal 提供）
    els.stampButton.addEventListener('click', () => toggleStampMode());

    // 转换为 PDF
    els.pdfButton.addEventListener('click', () => convertToPdf());
    els.pdfModalClose.addEventListener('click', () => {
      if (state.pdfConverting) return;
      els.pdfModalOverlay.classList.add('hidden');
    });
    els.pdfModalOverlay.addEventListener('click', (e) => {
      if (state.pdfConverting) return;
      if (e.target === els.pdfModalOverlay) els.pdfModalOverlay.classList.add('hidden');
    });

    // 盖章模式下：印章图片跟随鼠标移动
    els.viewerContainer.addEventListener('mousemove', (e) => {
      if (!state.stampMode || !state.seal) return;
      const t = e.target;
      const slot = t && t.closest ? t.closest('.ofd-page') : null;
      if (!slot) return;
      const idx = parseInt(slot.dataset.pageIndex, 10);
      const svg = state.pageSvgs[idx];
      if (!svg) return;
      const pos = clientToSvg(svg, e.clientX, e.clientY);
      if (pos) updateStampFollow(svg, pos.x, pos.y);
    });

    // 已放置印章：右键弹出删除菜单
    els.viewerContainer.addEventListener('contextmenu', (e) => {
      const t = e.target;
      const el = t && t.closest ? t.closest('.seal-placed') : null;
      if (!el) { hideSealMenu(); return; }
      e.preventDefault();
      state.sealContextTarget = el;
      showSealMenu(e.clientX, e.clientY);
    });
    els.sealMenuDelete.addEventListener('click', () => {
      const el = state.sealContextTarget;
      if (el) {
        // 数据匹配删除：data-seal-uid 为放置时分配的唯一序号，不随数组下标漂移
        const uid = parseInt(el.getAttribute('data-seal-uid'), 10);
        const idx = state.sealPlaced.findIndex(p => p._uid === uid);
        if (idx >= 0) state.sealPlaced.splice(idx, 1);
        el.remove();
        // 删除后回调剩余全部签章位置
        emitSealChange('delete', buildSealList());
      }
      hideSealMenu();
    });
    // 点击其它位置 / 滚动 / 切换页面时关闭菜单
    document.addEventListener('click', hideSealMenu);
    document.addEventListener('scroll', hideSealMenu, true);

    // 侧边栏视图切换（缩略图 / 数字签名）
    const openSidebar = () => {
      els.outer.classList.add('sidebarOpen');
      syncSidebarUI();
      setTimeout(() => applyScaleMode(), 250);
    };
    els.viewThumbnail.addEventListener('click', () => { openSidebar(); setSidebarView('thumb'); });
    els.viewOutline.addEventListener('click', () => { openSidebar(); setSidebarView('outline'); });
    els.viewSignatures.addEventListener('click', () => { openSidebar(); setSidebarView('sign'); });
    // 工具栏"目录"图标按钮：点击打开侧边栏并显示目录（再次点击收起）
    els.outlineToggle.addEventListener('click', () => {
      const showing = els.outer.classList.contains('sidebarOpen') && state.sidebarView === 'outline';
      if (showing) {
        els.outer.classList.remove('sidebarOpen');
      } else {
        els.outer.classList.add('sidebarOpen');
        setSidebarView('outline');
      }
      syncSidebarUI();
      setTimeout(() => applyScaleMode(), 250);
    });
    // 工具栏"签名"图标按钮：点击打开侧边栏并显示签名列表（再次点击收起）
    els.signatureToggle.addEventListener('click', () => {
      const showing = els.outer.classList.contains('sidebarOpen') && state.sidebarView === 'sign';
      if (showing) {
        els.outer.classList.remove('sidebarOpen');
      } else {
        els.outer.classList.add('sidebarOpen');
        setSidebarView('sign');
      }
      syncSidebarUI();
      setTimeout(() => applyScaleMode(), 250);
    });

    // 上一页 / 下一页
    els.prev.addEventListener('click', () => setCurrentPage(state.currentPage - 1, true));
    els.next.addEventListener('click', () => setCurrentPage(state.currentPage + 1, true));

    // 跳页输入
    els.pageNumber.addEventListener('change', () => {
      const v = parseInt(els.pageNumber.value, 10);
      if (isFinite(v) && v >= 1 && v <= state.pageCount) {
        setCurrentPage(v - 1, true);
      } else {
        els.pageNumber.value = String(state.currentPage + 1);
      }
    });

    // 缩放
    els.zoomIn.addEventListener('click', () => {
      state.scaleMode = 'custom';
      applyScale(Math.min(state.scale * 1.2, 5));
    });
    els.zoomOut.addEventListener('click', () => {
      state.scaleMode = 'custom';
      applyScale(Math.max(state.scale / 1.2, 0.2));
    });
    els.scaleSelect.addEventListener('change', () => {
      const v = els.scaleSelect.value;
      if (v === 'auto' || v === 'page-actual' || v === 'page-fit' || v === 'page-width') {
        state.scaleMode = v;
        applyScaleMode();
      } else {
        state.scaleMode = 'custom';
        applyScale(parseFloat(v));
      }
    });

    // 滚动时检测当前页 + 懒渲染可视区页面
    let scrollRaf = 0;
    els.viewerContainer.addEventListener('scroll', () => {
      cancelAnimationFrame(scrollRaf);
      scrollRaf = requestAnimationFrame(() => {
        detectCurrentPageOnScroll();
        syncVisiblePages();
      });
    }, { passive: true });

    // 缩略图侧栏滚动：惰性渲染进入视口的缩略图
    let thumbScrollRaf = 0;
    els.thumbnailView.addEventListener('scroll', () => {
      cancelAnimationFrame(thumbScrollRaf);
      thumbScrollRaf = requestAnimationFrame(() => {
        renderVisibleThumbnails();
      });
    }, { passive: true });

    // 文件打开
    els.openFile.addEventListener('click', () => els.fileInput.click());
    els.secondaryOpenFile.addEventListener('click', () => {
      els.fileInput.click();
      closeSecondaryToolbar();
    });
    els.fileInput.addEventListener('change', () => {
      const file = els.fileInput.files && els.fileInput.files[0];
      if (file) {
        state.fileName = file.name;
        openSource(file, file.name);
      }
      els.fileInput.value = '';
    });

    // 查找
    let findTimer = 0;
    els.findButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (els.findbar.classList.contains('hidden')) openFindbar();
      else closeFindbar();
    });
    els.findClose.addEventListener('click', () => closeFindbar());
    // 点击页面其他地方关闭搜索弹出框
    document.addEventListener('click', (e) => {
      if (!els.findbar.classList.contains('hidden') &&
          !els.findbar.contains(e.target) &&
          e.target !== els.findButton) {
        closeFindbar();
      }
    });
    els.findInput.addEventListener('input', () => {
      clearTimeout(findTimer);
      findTimer = setTimeout(doSearch, 200);
    });
    els.findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) goPrevMatch();
        else goNextMatch();
      }
    });
    els.findNext.addEventListener('click', goNextMatch);
    els.findPrevious.addEventListener('click', goPrevMatch);

    // 下载（原样保存为 ofd）
    els.download.addEventListener('click', downloadDocument);
    els.secondaryDownload.addEventListener('click', () => {
      downloadDocument();
      closeSecondaryToolbar();
    });

    // 打印
    els.print.addEventListener('click', () => printDocument());
    els.secondaryPrint.addEventListener('click', () => {
      printDocument();
      closeSecondaryToolbar();
    });

    // 文档属性（次级菜单入口）
    els.infoClose.addEventListener('click', () => els.infoDialog.classList.remove('visible'));

    // 次级工具栏
    els.secondaryToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSecondaryToolbar();
    });
    // 点击页面其他地方关闭次级菜单
    document.addEventListener('click', (e) => {
      if (!els.secondaryToolbar.classList.contains('hidden') &&
          !els.secondaryToolbar.contains(e.target) &&
          e.target !== els.secondaryToggle) {
        closeSecondaryToolbar(true);
      }
    });
    // 按 Esc 关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.secondaryToolbar.classList.contains('hidden')) {
        closeSecondaryToolbar(true);
      }
    });

    // 旋转
    els.rotateCw.addEventListener('click', () => {
      applyRotation(90);
      closeSecondaryToolbar();
    });
    els.rotateCcw.addEventListener('click', () => {
      applyRotation(-90);
      closeSecondaryToolbar();
    });

    // 转到第一页 / 最后一页
    els.firstPage.addEventListener('click', () => {
      setCurrentPage(0, true);
      closeSecondaryToolbar();
    });
    els.lastPage.addEventListener('click', () => {
      setCurrentPage(state.pageCount - 1, true);
      closeSecondaryToolbar();
    });

    // 文档属性（次级菜单入口）
    els.docProps.addEventListener('click', () => {
      showDocumentInfo();
      closeSecondaryToolbar();
    });

    // 错误重试
    els.errorRetry.addEventListener('click', () => {
      hideError();
      loadDefault();
    });

    // 文件选择器（下拉框）
    els.fileSelect.addEventListener('change', () => {
      const fileName = els.fileSelect.value;
      if (!fileName) return;
      openSource('../test/ofdFile/' + encodeURIComponent(fileName), fileName);
    });

    // 拖放
    ['dragenter', 'dragover'].forEach(ev => {
      els.main.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
          els.main.classList.add('dragover');
        }
      });
    });
    ['dragleave', 'drop'].forEach(ev => {
      els.main.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (ev === 'dragleave' && e.relatedTarget && els.main.contains(e.relatedTarget)) return;
        els.main.classList.remove('dragover');
      });
    });
    els.main.addEventListener('drop', (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file && /\.ofd$/i.test(file.name)) {
        state.fileName = file.name;
        openSource(file, file.name);
      }
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      // 查找快捷键（焦点在输入框时也响应）
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const selected = getSelectedDocText();
        if (selected) {
          clearTimeout(findTimer);
          els.findInput.value = selected;
        }
        openFindbar();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) goPrevMatch();
        else goNextMatch();
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) goPrevMatch();
        else goNextMatch();
        return;
      }
      if (e.key === 'Escape' && !els.findbar.classList.contains('hidden')) {
        closeFindbar();
        return;
      }
      if (e.key === 'Escape' && state.stampMode) {
        exitStampMode();
        return;
      }
      if (e.key === 'Escape') {
        hideSealMenu();
      }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentPage(state.currentPage - 1, true);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentPage(state.currentPage + 1, true);
      } else if (e.key === 'Home') {
        setCurrentPage(0, true);
      } else if (e.key === 'End') {
        setCurrentPage(state.pageCount - 1, true);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        state.scaleMode = 'custom';
        applyScale(Math.min(state.scale * 1.1, 5));
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        state.scaleMode = 'custom';
        applyScale(Math.max(state.scale / 1.1, 0.2));
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        state.scaleMode = 'auto';
        applyScaleMode();
      }
    });

    // 窗口大小变化重新计算
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (state.scaleMode !== 'custom') applyScaleMode();
        scheduleSyncVisiblePages();
      }, 200);
    });
  }

  // 滚动时检测当前页
  function detectCurrentPageOnScroll() {
    const container = els.viewerContainer;
    const cTop = container.scrollTop + 80;
    const cur = Math.max(0, findLastPageAtOrBefore(cTop));
    if (cur !== state.currentPage) {
      state.currentPage = cur;
      els.pageNumber.value = String(cur + 1);
      updateNavButtons();
      updateThumbnailSelection();
      emitPageChange();
    }
  }

  // 下载 — 重新打包为原始 OFD：直接从 ofd-core 保留的 zip 对象取原始字节
  async function downloadCurrentOfd() {
    if (state.ofd && state.ofd.zip && state.ofd.zip.data) {
      return state.ofd.zip.data;
    }
    return null;
  }

  // 下载（原样保存为 ofd）；工具栏按钮与 OFD.download() 共用
  async function downloadDocument() {
    if (!state.ofd) return false;
    try {
      const bytes = await downloadCurrentOfd();
      if (!bytes) return false;
      const blob = new Blob([bytes], { type: 'application/ofd' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = state.fileName || 'document.ofd';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (e) {
      showError(e.message, '下载失败');
      return false;
    }
  }

  // 转换为 PDF：模态框显示进度，完成后自动下载
  async function convertToPdf() {
    if (!state.ofd || state.pdfConverting) return false;
    if (!window.TOPDF || typeof TOPDF.ofdToPdf !== 'function') {
      showError('未加载 toPdf.js，无法转换', '转换失败');
      return false;
    }
    state.pdfConverting = true;
    els.pdfModalMsg.classList.remove('error');
    els.pdfModalMsg.textContent = '正在转换 ' + state.fileName + ' …';
    els.pdfProgressInner.style.width = '0';
    els.pdfProgressText.textContent = '0%';
    els.pdfModalOverlay.classList.remove('hidden');
    try {
      const base = state.fileName || 'document';
      const pdf = await TOPDF.ofdToPdf(state.ofd, {
        title: base.replace(/\.ofd$/i, ''),
        onProgress: (done, total) => {
          const pct = total > 0 ? Math.round(done / total * 100) : 100;
          els.pdfProgressInner.style.width = pct + '%';
          els.pdfProgressText.textContent = pct + '%';
          els.pdfModalMsg.textContent = '正在转换 ' + state.fileName + ' … (' + done + '/' + total + ' 页)';
        }
      });
      // 完成：自动下载
      const blob = new Blob([pdf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = base.replace(/\.ofd$/i, '.pdf');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      els.pdfModalMsg.textContent = '转换完成，已开始下载。';
      els.pdfProgressInner.style.width = '100%';
      els.pdfProgressText.textContent = '100%';
      setTimeout(() => {
        state.pdfConverting = false;
        els.pdfModalOverlay.classList.add('hidden');
      }, 1500);
      return true;
    } catch (e) {
      state.pdfConverting = false;
      els.pdfModalMsg.textContent = '转换失败：' + (e && e.message ? e.message : e);
      els.pdfModalMsg.classList.add('error');
      return false;
    }
  }

  // 打印：通过隐藏 iframe 静默打开打印对话框，不打开新窗口
  function printDocument() {
    if (!state.ofd) return false;

    // 移除之前的打印 iframe（如果有）
    const oldFrame = document.getElementById('ofd-print-frame');
    if (oldFrame) oldFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'ofd-print-frame';
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    doc.open();
    doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>打印 OFD</title>');
    doc.write('<style>');
    doc.write('@page { margin: 0; }');
    doc.write('body { margin: 0; padding: 0; background: #fff; }');
    doc.write('.ofd-print-page { page-break-after: always; display: block; }');
    doc.write('.ofd-print-page:last-child { page-break-after: auto; }');
    doc.write('svg { display: block; width: 100%; height: auto; }');
    doc.write('</style></head><body>');
    doc.write('<div id="pages"></div>');
    doc.write('</body></html>');
    doc.close();

    const pagesContainer = doc.getElementById('pages');
    let pending = state.pageCount;
    if (pending === 0) {
      iframe.remove();
      return false;
    }

    for (let i = 0; i < state.pageCount; i++) {
      const div = doc.createElement('div');
      div.className = 'ofd-print-page';
      pagesContainer.appendChild(div);
      OFD.renderPageToString(state.ofd, i, {}).then(svgStr => {
        div.innerHTML = svgStr;
        pending--;
        if (pending === 0) {
          setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => iframe.remove(), 1000);
          }, 200);
        }
      }).catch(err => {
        div.textContent = '渲染失败：' + err.message;
        pending--;
        if (pending === 0) {
          setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => iframe.remove(), 1000);
          }, 200);
        }
      });
    }
    return true;
  }

  // 文档属性
  function showDocumentInfo() {
    if (!state.ofd) return false;
    const info = OFD.getDocumentInfo(state.ofd);
    $('info-docId').textContent = info.docId || '-';
    $('info-title').textContent = info.title || '-';
    $('info-author').textContent = info.author || '-';
    $('info-subject').textContent = info.subject || '-';
    $('info-creator').textContent = info.creator || info.producer || '-';
    $('info-creationDate').textContent = formatDate(info.creationDate) || '-';
    $('info-modDate').textContent = formatDate(info.modDate) || '-';
    $('info-pageCount').textContent = String(state.pageCount);
    els.infoDialog.classList.add('visible');
    return true;
  }

  function formatDate(s) {
    if (!s) return '';
    // OFD 日期格式：YYYY-MM-DDThh:mm:ss
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?/.exec(s);
    if (!m) return s;
    return m[1] + '-' + m[2] + '-' + m[3] +
      (m[4] ? ' ' + m[4] + ':' + m[5] + ':' + (m[6] || '00') : '');
  }

  async function loadDefault() {
    const params = new URLSearchParams(location.search);
    const url = params.get('file') || '../test/ofdFile/999.ofd';
    state.fileName = url.split('/').pop() || '999.ofd';
    await openSource(url, state.fileName);

    // 应用 URL 参数：page / rotate / search
    const page = parseInt(params.get('page'), 10);
    if (page > 0 && page <= state.pageCount) {
      setCurrentPage(page - 1, true);
    }
    const rot = parseInt(params.get('rotate'), 10);
    if (!isNaN(rot) && rot % 90 === 0) {
      const target = ((rot % 360) + 360) % 360;
      applyRotation((target - state.rotation + 360) % 360);
    }
    const search = params.get('search');
    if (search) {
      els.findInput.value = search;
      openFindbar();
    }
  }

  // 页面加载完成后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    bindEvents();
    loadDefault();
  }

})();

