(() => {
  const icons = {
    'arrow-right': `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="M13 5l7 7-7 7"/></svg>`,
    grid: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4z"/><path d="M13 4h7v7h-7z"/><path d="M4 13h7v7H4z"/><path d="M13 13h7v7h-7z"/></svg>`,
    files: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`,
    upload: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>`,
    link: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0 0-7.07 5 5 0 0 0-7.07 0L10.5 5"/><path d="M14 11a5 5 0 0 0-7.07 0L5.5 12.41a5 5 0 0 0 0 7.07 5 5 0 0 0 7.07 0L13.5 19"/></svg>`,
    user: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>`,
    logout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`,
    menu: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>`,
    x: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>`,
    lock: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    'user-plus': `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><path d="M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>`,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function renderIcons() {
    $$('[data-icon]').forEach((el) => {
      const name = el.getAttribute('data-icon');
      if (!name) return;
      el.innerHTML = icons[name] || '';
      el.setAttribute('aria-hidden', 'true');
    });
  }

  function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = Number(bytes || 0);
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
  }

  function formatDate(value) {
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '—';
      return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    } catch {
      return '—';
    }
  }

  function ensureToastHost() {
    let host = $('.toast-host');
    if (host) return host;
    host = document.createElement('div');
    host.className = 'toast-host';
    document.body.appendChild(host);
    return host;
  }

  function toast(title, message, tone = 'info') {
    const host = ensureToastHost();
    const el = document.createElement('div');
    el.className = `toast ${tone === 'danger' ? 'toast--danger' : ''} ${tone === 'success' ? 'toast--success' : ''}`;
    el.innerHTML = `<div class="toast__title"></div><div class="toast__msg"></div>`;
    $('.toast__title', el).textContent = title;
    $('.toast__msg', el).textContent = message;
    host.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  function haptic(ms = 10) {
    try {
      if (typeof navigator.vibrate === 'function') navigator.vibrate(ms);
    } catch {
      // ignore
    }
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');

    const res = await fetch(path, { ...options, headers });
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await res.json().catch(() => null) : null;

    if (res.status === 401) {
      if (document.body.dataset.page !== 'login') window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const msg = payload?.error || `Request failed (${res.status})`;
      throw new Error(msg);
    }

    return payload;
  }

  let copyModalInit = false;
  function initCopyModal() {
    if (copyModalInit) return;
    copyModalInit = true;

    const modal = $('[data-copy-modal]');
    const title = $('[data-copy-title]');
    const input = $('[data-copy-input]');
    const hint = $('[data-copy-hint]');
    const copyBtn = $('[data-copy-btn]');
    const shareBtn = $('[data-copy-share]');
    if (!modal || !input || !copyBtn) return;

    const setText = (text, nextTitle = 'Copy') => {
      if (title) title.textContent = nextTitle;
      input.value = String(text || '');
      const canShare = Boolean(navigator.share);
      if (shareBtn) shareBtn.hidden = !canShare;
      if (hint) hint.textContent = 'Jika tombol Copy gagal, tap lalu tahan → Salin.';
      try {
        input.focus();
        input.select();
      } catch {
        // ignore
      }
    };

    modal.addEventListener('close', () => setText('', 'Copy'));

    copyBtn.addEventListener('click', async () => {
      const value = String(input.value || '');
      const ok = await copyToClipboard(value);
      if (ok) {
        haptic(12);
        toast('Copied', 'Link tersalin ke clipboard', 'success');
        modal.close();
      } else {
        toast('Copy gagal', 'Tap lalu tahan → Salin', 'danger');
      }
    });

    shareBtn?.addEventListener('click', async () => {
      const value = String(input.value || '');
      if (!value || !navigator.share) return;
      try {
        await navigator.share({ url: value });
      } catch {
        // user cancelled
      }
    });

    modal.__setText = setText;
  }

  function openCopyModal(text, title = 'Copy') {
    initCopyModal();
    const modal = $('[data-copy-modal]');
    const setter = modal && modal.__setText;
    if (!modal?.showModal || typeof setter !== 'function') return false;
    setter(text, title);
    modal.showModal();
    return true;
  }

  async function copyToClipboard(text) {
    const value = String(text || '');
    if (!value) return false;
    if (!window.isSecureContext) return false;
    if (!navigator.clipboard?.writeText) return false;
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  async function copyWithFallback(text, title = 'Copy') {
    const ok = await copyToClipboard(text);
    if (ok) {
      haptic(12);
      return true;
    }
    openCopyModal(text, title);
    return false;
  }

  function initNavigation() {
    const sidebar = $('[data-sidebar]');
    const overlay = $('[data-sidebar-overlay]');
    const openBtn = $('[data-sidebar-open]');
    const closeBtn = $('[data-sidebar-close]');

    const open = () => {
      if (!sidebar || !overlay) return;
      sidebar.classList.add('is-open');
      overlay.classList.add('is-open');
    };
    const close = () => {
      if (!sidebar || !overlay) return;
      sidebar.classList.remove('is-open');
      overlay.classList.remove('is-open');
    };

    openBtn?.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    overlay?.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    $$('a[data-nav]').forEach((a) => {
      a.addEventListener('click', (e) => {
        if (e.defaultPrevented) return;
        if (a.target === '_blank') return;
        const href = a.getAttribute('href');
        if (!href || href.startsWith('#')) return;
        if (href.startsWith('http')) return;
        e.preventDefault();
        close();
        document.body.classList.add('is-leaving');
        setTimeout(() => {
          window.location.href = href;
        }, 160);
      });
    });
  }

  function initLoginPage() {
    const form = $('[data-login-form]');
    const error = $('[data-login-error]');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (error) error.textContent = '';

      const fd = new FormData(form);
      const username = String(fd.get('username') || '');
      const password = String(fd.get('password') || '');

      try {
        await api('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        window.location.href = '/dashboard';
      } catch (err) {
        if (error) error.textContent = err?.message || 'Login failed';
      }
    });
  }

  async function initDashboardPage() {
    const used = $('[data-metric-used]');
    const quota = $('[data-metric-quota]');
    const bar = $('[data-storage-progress]');
    const totalFiles = $('[data-metric-total-files]');
    const shared = $('[data-metric-shared]');
    const recentBody = $('[data-recent-files]');

    const data = await api('/api/dashboard');
    const d = data.dashboard;

    if (used) used.textContent = d.storage.usedHuman;
    if (quota) quota.textContent = `${d.storage.quotaHuman} quota`;
    if (bar) bar.style.width = `${Math.round(d.storage.percent)}%`;
    if (totalFiles) totalFiles.textContent = String(d.totalFiles);
    if (shared) shared.textContent = String(d.activeShares);

    if (recentBody) {
      recentBody.innerHTML = '';
      if (!d.recentFiles.length) {
        recentBody.innerHTML = `<tr><td colspan="3" class="muted">No uploads yet.</td></tr>`;
        return;
      }
      for (const f of d.recentFiles) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(f.name)}</td>
          <td class="right">${formatBytes(f.sizeBytes)}</td>
          <td class="right">${formatDate(f.createdAt)}</td>
        `;
        recentBody.appendChild(tr);
      }
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function fileTypeLabel(mimeType, name) {
    const ext = String(name || '').split('.').pop()?.toUpperCase();
    if (!mimeType) return ext ? ext : 'FILE';
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    if (mimeType === 'application/pdf') return 'PDF';
    if (mimeType.includes('zip')) return 'ZIP';
    if (mimeType.startsWith('text/')) return 'TEXT';
    return ext ? ext : 'FILE';
  }

  function fileExtLower(name) {
    const parts = String(name || '').split('.');
    if (parts.length <= 1) return '';
    return parts[parts.length - 1].toLowerCase();
  }

  function detectPreviewKind(mimeType, name) {
    const mt = String(mimeType || '').toLowerCase();
    const ext = fileExtLower(name);

    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) || mt.startsWith('image/')) {
      if (mt === 'image/svg+xml' || ext === 'svg') return 'none';
      return 'image';
    }
    if (['mp4', 'webm'].includes(ext) || mt.startsWith('video/')) return 'video';
    if (['mp3', 'wav'].includes(ext) || mt.startsWith('audio/')) return 'audio';
    if (ext === 'pdf' || mt === 'application/pdf') return 'pdf';

    if (
      mt.startsWith('text/') ||
      ['application/json', 'application/x-ndjson', 'application/xml'].includes(mt) ||
      ['txt', 'json', 'md', 'log'].includes(ext)
    ) {
      return 'text';
    }

    if (
      ['docx', 'xlsx', 'pptx'].includes(ext) ||
      [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ].includes(mt)
    ) {
      return 'office';
    }

    return 'none';
  }

  function officeViewerEmbedUrl(rawUrl) {
    const url = String(rawUrl || '').trim();
    if (!url) return '';
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  }

  async function renderPreviewInto(host, { name, mimeType, previewUrl, officeRawUrl }) {
    if (!host) return;
    host.innerHTML = `<div class="muted">Loading preview...</div>`;

    const kind = detectPreviewKind(mimeType, name);
    const url = String(previewUrl || '').trim();

    if (kind === 'image' && url) {
      const img = document.createElement('img');
      img.className = 'preview-media';
      img.alt = '';
      img.loading = 'lazy';
      img.src = url;
      host.innerHTML = '';
      host.appendChild(img);
      return;
    }

    if (kind === 'video' && url) {
      const video = document.createElement('video');
      video.className = 'preview-media';
      video.controls = true;
      video.preload = 'metadata';
      video.playsInline = true;
      video.setAttribute('controlslist', 'nodownload noremoteplayback');
      video.src = url;
      host.innerHTML = '';
      host.appendChild(video);
      return;
    }

    if (kind === 'audio' && url) {
      const audio = document.createElement('audio');
      audio.style.width = '100%';
      audio.controls = true;
      audio.preload = 'metadata';
      audio.setAttribute('controlslist', 'nodownload');
      audio.src = url;
      host.innerHTML = '';
      host.appendChild(audio);
      return;
    }

    if (kind === 'pdf' && url) {
      const iframe = document.createElement('iframe');
      iframe.className = 'preview-frame';
      iframe.title = name || 'PDF preview';
      iframe.src = url;
      host.innerHTML = '';
      host.appendChild(iframe);
      return;
    }

    if (kind === 'text' && url) {
      const res = await fetch(url, { cache: 'no-store' });
      const text = await res.text();
      host.innerHTML = '';

      const truncated = res.headers.get('x-preview-truncated') === '1';
      if (truncated) {
        const warn = document.createElement('div');
        warn.className = 'muted';
        warn.style.marginBottom = '8px';
        warn.textContent = 'Preview dipotong (file terlalu besar).';
        host.appendChild(warn);
      }

      const pre = document.createElement('pre');
      pre.className = 'preview-code';
      pre.textContent = text;
      host.appendChild(pre);
      return;
    }

    if (kind === 'office') {
      const embed = officeViewerEmbedUrl(officeRawUrl);
      if (embed) {
        const iframe = document.createElement('iframe');
        iframe.className = 'preview-frame';
        iframe.title = name || 'Office preview';
        iframe.referrerPolicy = 'no-referrer';
        iframe.src = embed;
        host.innerHTML = '';
        host.appendChild(iframe);
        return;
      }

      host.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="font-weight:800">Office preview</div>
          <div class="muted">Untuk DOCX/XLSX/PPTX, viewer butuh URL file yang bisa diakses publik. Aktifkan share dulu.</div>
        </div>
      `;
      return;
    }

    host.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <span class="icon" data-icon="files"></span>
        <div>
          <div style="font-weight:800">Preview tidak didukung</div>
          <div class="muted">File ini tetap bisa didownload.</div>
        </div>
      </div>
    `;
    renderIcons();
  }

  function fileThumb(file) {
    if (file.mimeType && file.mimeType.startsWith('image/')) {
      return `<img alt="" src="/api/files/${file.id}/preview" loading="lazy" />`;
    }
    return `<span class="icon" data-icon="files"></span>`;
  }

  async function initFilesPage() {
    const tbody = $('[data-files-tbody]');
    const grid = $('[data-files-grid]');
    const tableWrap = $('[data-files-table]');
    const search = $('[data-files-search]');
    const count = $('[data-files-count]');
    const viewBtns = $$('[data-view]');
    const renameModal = $('[data-rename-modal]');
    const renameInput = $('[data-rename-input]');
    const renameHint = $('[data-rename-hint]');
    const renameSave = $('[data-rename-save]');
    const previewModal = $('[data-preview-modal]');
    const previewTitle = $('[data-preview-title]');
    const previewMeta = $('[data-preview-meta]');
    const previewHost = $('[data-preview-host]');
    const previewDownload = $('[data-preview-download]');

    let allFiles = [];
    let view = 'table';
    let renameTarget = null;
    let previewTarget = null;

    const setView = (next) => {
      view = next;
      viewBtns.forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-view') === next));
      if (grid) grid.hidden = next !== 'grid';
      if (tableWrap) tableWrap.hidden = next !== 'table';
    };

    viewBtns.forEach((b) => b.addEventListener('click', () => setView(b.getAttribute('data-view'))));
    setView('table');

    function filtered() {
      const q = String(search?.value || '').trim().toLowerCase();
      if (!q) return allFiles;
      return allFiles.filter((f) => f.name.toLowerCase().includes(q));
    }

    function render() {
      const items = filtered();
      if (count) count.textContent = `${items.length} file(s)`;

      if (tbody) {
        tbody.innerHTML = '';
        for (const file of items) {
          const tr = document.createElement('tr');
          const shareButtons = file.isShared
            ? `
                <button class="btn btn--sm" type="button" data-act="copy">Copy link</button>
                <button class="btn btn--sm" type="button" data-act="regen">Regenerate</button>
                <button class="btn btn--sm btn--danger" type="button" data-act="private">Make private</button>
              `
            : `<button class="btn btn--sm" type="button" data-act="share">Share</button>`;
          tr.innerHTML = `
            <td>
              <div style="display:flex;align-items:center;gap:10px;min-width:240px">
                <div class="thumb">${fileThumb(file)}</div>
                <div style="min-width:0">
                  <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                  <div class="file-meta">${file.isShared ? '<span class="badge badge--warn">Shared</span>' : '<span class="badge">Private</span>'}</div>
                </div>
              </div>
            </td>
            <td>${fileTypeLabel(file.mimeType, file.name)}</td>
            <td class="right">${file.sizeHuman}</td>
            <td class="right">${formatDate(file.createdAt)}</td>
            <td class="right">
              <div style="display:inline-flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
                <button class="btn btn--sm" type="button" data-act="preview">Preview</button>
                <button class="btn btn--sm" type="button" data-act="download">Download</button>
                ${shareButtons}
                <button class="btn btn--sm" type="button" data-act="rename">Rename</button>
                <button class="btn btn--sm btn--danger" type="button" data-act="delete">Delete</button>
              </div>
            </td>
          `;
          $$('[data-icon]', tr).forEach((el) => {
            const name = el.getAttribute('data-icon');
            el.innerHTML = icons[name] || '';
          });
          tr.addEventListener('click', async (e) => {
            const btn = e.target.closest('button[data-act]');
            if (!btn) return;
            const act = btn.getAttribute('data-act');
            if (act === 'preview') openPreview(file);
            if (act === 'download') window.location.href = `/api/files/${file.id}/download`;
            if (act === 'delete') await handleDelete(file);
            if (act === 'share') await enableShare(file, { regenerate: false });
            if (act === 'copy') {
              if (file.shareUrl) {
                const ok = await copyWithFallback(file.shareUrl, 'Share link');
                toast('Share link', ok ? 'Copied to clipboard' : 'Tap lalu tahan → Salin', ok ? 'success' : 'danger');
              } else {
                await enableShare(file, { regenerate: false });
              }
            }
            if (act === 'regen') await enableShare(file, { regenerate: true });
            if (act === 'private') await disableShare(file);
            if (act === 'rename') openRename(file);
          });
          tbody.appendChild(tr);
        }
        if (!items.length) tbody.innerHTML = `<tr><td colspan="5" class="muted">No files.</td></tr>`;
      }

      if (grid) {
        grid.innerHTML = '';
        for (const file of items) {
          const card = document.createElement('div');
          card.className = 'file-card';
          const shareButtons = file.isShared
            ? `
                <button class="btn btn--sm" type="button" data-act="copy">Copy link</button>
                <button class="btn btn--sm" type="button" data-act="regen">Regenerate</button>
                <button class="btn btn--sm btn--danger" type="button" data-act="private">Make private</button>
              `
            : `<button class="btn btn--sm" type="button" data-act="share">Share</button>`;
          card.innerHTML = `
            <div class="file-card__top">
              <div class="thumb">${fileThumb(file)}</div>
              <div style="min-width:0">
                <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                <div class="file-meta">${file.sizeHuman} · ${formatDate(file.createdAt)}</div>
              </div>
            </div>
            <div class="file-actions">
              <button class="btn btn--sm" type="button" data-act="preview">Preview</button>
              <button class="btn btn--sm" type="button" data-act="download">Download</button>
              ${shareButtons}
              <button class="btn btn--sm" type="button" data-act="rename">Rename</button>
              <button class="btn btn--sm btn--danger" type="button" data-act="delete">Delete</button>
            </div>
          `;
          $$('[data-icon]', card).forEach((el) => {
            const name = el.getAttribute('data-icon');
            el.innerHTML = icons[name] || '';
          });
          card.addEventListener('click', async (e) => {
            const btn = e.target.closest('button[data-act]');
            if (!btn) return;
            const act = btn.getAttribute('data-act');
            if (act === 'preview') openPreview(file);
            if (act === 'download') window.location.href = `/api/files/${file.id}/download`;
            if (act === 'delete') await handleDelete(file);
            if (act === 'share') await enableShare(file, { regenerate: false });
            if (act === 'copy') {
              if (file.shareUrl) {
                const ok = await copyWithFallback(file.shareUrl, 'Share link');
                toast('Share link', ok ? 'Copied to clipboard' : 'Tap lalu tahan → Salin', ok ? 'success' : 'danger');
              } else {
                await enableShare(file, { regenerate: false });
              }
            }
            if (act === 'regen') await enableShare(file, { regenerate: true });
            if (act === 'private') await disableShare(file);
            if (act === 'rename') openRename(file);
          });
          grid.appendChild(card);
        }
        if (!items.length) grid.innerHTML = `<div class="muted">No files.</div>`;
      }
    }

    async function refresh() {
      const data = await api('/api/files');
      allFiles = data.files;
      render();
      renderIcons();
    }

    async function handleDelete(file) {
      const ok = confirm(`Delete "${file.name}"?`);
      if (!ok) return;
      try {
        await api(`/api/files/${file.id}`, { method: 'DELETE' });
        toast('Deleted', file.name, 'success');
        await refresh();
      } catch (err) {
        toast('Delete failed', err?.message || 'Error', 'danger');
      }
    }

    async function enableShare(file, { regenerate = false } = {}) {
      try {
        const data = await api(`/api/files/${file.id}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enable: true, regenerate }),
        });
        openCopyModal(data.shareUrl, 'Share link');
        toast('Share link', 'Link siap', 'success');
        await refresh();
      } catch (err) {
        toast('Share failed', err?.message || 'Error', 'danger');
      }
    }

    async function disableShare(file) {
      try {
        await api(`/api/files/${file.id}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enable: false }),
        });
        toast('Private', 'Share disabled', 'success');
        await refresh();
      } catch (err) {
        toast('Update failed', err?.message || 'Error', 'danger');
      }
    }

    async function renderPreview(file) {
      const previewUrl = file.previewUrl || `/api/files/${file.id}/preview`;
      await renderPreviewInto(previewHost, {
        name: file.name,
        mimeType: file.mimeType,
        previewUrl,
        officeRawUrl: file.shareRawUrl,
      });
    }

    function openPreview(file) {
      previewTarget = file;
      if (previewTitle) previewTitle.textContent = file.name;
      if (previewMeta) {
        const label = fileTypeLabel(file.mimeType, file.name);
        previewMeta.textContent = `${label} • ${file.sizeHuman} • ${formatDate(file.createdAt)}`;
      }
      if (previewDownload) previewDownload.href = `/api/files/${file.id}/download`;
      if (previewModal?.showModal) previewModal.showModal();
      renderPreview(file).catch((err) => {
        if (previewHost) previewHost.innerHTML = `<div class="muted">Preview failed: ${escapeHtml(err?.message || 'Error')}</div>`;
      });
    }

    function openRename(file) {
      renameTarget = file;
      if (renameInput) renameInput.value = file.name;
      if (renameHint) renameHint.textContent = 'Tip: keep the extension (.pdf, .jpg, …) if needed.';
      if (renameModal?.showModal) renameModal.showModal();
    }

    renameSave?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!renameTarget) return;
      const name = String(renameInput?.value || '').trim();
      try {
        await api(`/api/files/${renameTarget.id}/rename`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        toast('Renamed', name, 'success');
        renameModal?.close?.();
        await refresh();
      } catch (err) {
        toast('Rename failed', err?.message || 'Error', 'danger');
      }
    });

    search?.addEventListener('input', render);
    await refresh();
  }

  async function initSharedPage() {
    const tbody = $('[data-shares-tbody]');
    if (!tbody) return;
    const data = await api('/api/shares');
    tbody.innerHTML = '';

    if (!data.shares.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="muted">No shared links yet.</td></tr>`;
      return;
    }

    for (const s of data.shares) {
      const tr = document.createElement('tr');
      const status = s.isActive ? `<span class="badge badge--ok">Active</span>` : `<span class="badge">Revoked</span>`;
      tr.innerHTML = `
        <td>${escapeHtml(s.fileName)}</td>
        <td class="right">${formatDate(s.createdAt)}</td>
        <td class="right">${status}</td>
        <td class="right">
          <div style="display:inline-flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
            <button class="btn btn--sm" type="button" data-act="copy" ${s.shareUrl ? '' : 'disabled'}>Copy link</button>
            <button class="btn btn--sm btn--danger" type="button" data-act="revoke" ${s.isActive ? '' : 'disabled'}>Make private</button>
          </div>
        </td>
      `;

      tr.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-act]');
        if (!btn) return;
        const act = btn.getAttribute('data-act');
        if (act === 'copy') {
          const ok = await copyWithFallback(s.shareUrl, 'Share link');
          toast('Share link', ok ? 'Copied to clipboard' : 'Tap lalu tahan, lalu Salin', ok ? 'success' : 'danger');
        }
        if (act === 'revoke') {
          try {
            await api(`/api/files/${s.fileId}/share`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ enable: false }),
            });
            toast('Private', s.fileName, 'success');
            await initSharedPage();
          } catch (err) {
            toast('Revoke failed', err?.message || 'Error', 'danger');
          }
        }
      });

      tbody.appendChild(tr);
    }
  }

  async function initPublicSharePage() {
    const root = $('[data-public-share]');
    const preview = root ? $('[data-public-share-preview]', root) : null;
    const copyBtn = $('[data-public-share-copy]');
    if (!root || !preview) return;

    const name = root.dataset.name || 'File';
    const mimeType = root.dataset.mime || '';
    const previewUrl = root.dataset.previewUrl || '';
    const officeRawUrl = root.dataset.officeRawUrl || '';
    const shareUrl = root.dataset.shareUrl || window.location.href;

    await renderPreviewInto(preview, { name, mimeType, previewUrl, officeRawUrl });

    copyBtn?.addEventListener('click', async () => {
      const ok = await copyWithFallback(shareUrl, 'Share link');
      toast('Share link', ok ? 'Copied to clipboard' : 'Tap lalu tahan, lalu Salin', ok ? 'success' : 'danger');
    });
  }

  async function initUploadPage() {
    const dz = $('[data-dropzone]');
    const input = $('[data-upload-input]');
    const queue = $('[data-upload-queue]');
    const list = $('[data-upload-list]');
    const startBtn = $('[data-upload-start]');
    const cancelBtn = $('[data-upload-cancel]');
    const progressWrap = $('[data-upload-progress]');
    const progressBar = $('[data-upload-progress-bar]');
    const maxUpload = $('[data-max-upload]');

    if (maxUpload) maxUpload.textContent = 'Configurable (MAX_UPLOAD_BYTES)';
    if (!dz || !input || !startBtn) return;

    let files = [];
    let currentXhr = null;

    const setQueueVisible = (visible) => {
      if (!queue) return;
      queue.hidden = !visible;
    };

    function renderQueue() {
      if (!list) return;
      list.innerHTML = '';
      for (const f of files) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(f.name)}</td>
          <td class="right">${formatBytes(f.size)}</td>
          <td class="right"><span class="badge">Ready</span></td>
        `;
        list.appendChild(tr);
      }
    }

    function setProgress(percent) {
      if (!progressWrap || !progressBar) return;
      progressWrap.hidden = false;
      progressBar.style.width = `${percent}%`;
    }

    function resetProgress() {
      if (!progressWrap || !progressBar) return;
      progressWrap.hidden = true;
      progressBar.style.width = '0%';
    }

    function selectFiles(fileList) {
      files = Array.from(fileList || []);
      setQueueVisible(files.length > 0);
      renderQueue();
      resetProgress();
    }

    dz.addEventListener('click', () => input.click());
    input.addEventListener('change', () => selectFiles(input.files));

    dz.addEventListener('dragover', (e) => {
      e.preventDefault();
      dz.classList.add('is-drag');
    });
    dz.addEventListener('dragleave', () => dz.classList.remove('is-drag'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('is-drag');
      selectFiles(e.dataTransfer.files);
    });

    cancelBtn?.addEventListener('click', () => {
      if (currentXhr) currentXhr.abort();
    });

    startBtn.addEventListener('click', () => {
      if (!files.length) {
        toast('No files', 'Pick files first', 'danger');
        return;
      }

      const fd = new FormData();
      for (const f of files) fd.append('files', f, f.name);

      const xhr = new XMLHttpRequest();
      currentXhr = xhr;
      cancelBtn && (cancelBtn.disabled = false);
      startBtn.disabled = true;
      setProgress(0);

      xhr.open('POST', '/api/files', true);
      xhr.upload.addEventListener('progress', (e) => {
        if (!e.lengthComputable) return;
        setProgress(Math.round((e.loaded / e.total) * 100));
      });

      xhr.onload = () => {
        cancelBtn && (cancelBtn.disabled = true);
        startBtn.disabled = false;
        currentXhr = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          toast('Uploaded', `${files.length} file(s)`, 'success');
          window.location.href = '/files';
        } else {
          toast('Upload failed', `HTTP ${xhr.status}`, 'danger');
        }
      };
      xhr.onerror = () => {
        cancelBtn && (cancelBtn.disabled = true);
        startBtn.disabled = false;
        currentXhr = null;
        toast('Upload failed', 'Network error', 'danger');
      };
      xhr.onabort = () => {
        cancelBtn && (cancelBtn.disabled = true);
        startBtn.disabled = false;
        currentXhr = null;
        toast('Upload cancelled', 'Request aborted', 'danger');
      };

      xhr.send(fd);
    });
  }

  async function initAccountPage() {
    const username = $('[data-account-username]');
    const email = $('[data-account-email]');
    const quota = $('[data-account-quota]');
    const data = await api('/api/me');
    if (username) username.textContent = data.user.username || '—';
    if (email) email.textContent = data.user.email || '—';
    if (quota) quota.textContent = formatBytes(data.user.storage_quota_bytes || 0);
  }

  async function initAdminUsersPage() {
    const tbody = $('[data-admin-users-tbody]');
    const form = $('[data-admin-create-user]');
    const error = $('[data-admin-create-error]');
    if (!tbody || !form) return;

    const me = await api('/api/me');
    const myUserId = me?.user?.id || null;

    function bytesToMb(bytes) {
      return Math.max(1, Math.round(Number(bytes) / (1024 * 1024)));
    }
    function mbToBytes(mb) {
      return Math.round(Number(mb) * 1024 * 1024);
    }

    async function refresh() {
      const data = await api('/api/admin/users');
      tbody.innerHTML = '';

      for (const u of data.users) {
        const tr = document.createElement('tr');
        const deleteDisabled = u.role === 'super_admin' || (myUserId && u.id === myUserId);
        tr.innerHTML = `
          <td>
            <div style="display:flex;flex-direction:column;gap:2px">
              <div style="font-weight:800">${escapeHtml(u.username)}</div>
              <div class="muted" style="font-size:12px">${escapeHtml(u.email || '')}</div>
            </div>
          </td>
          <td>${escapeHtml(u.role)}</td>
          <td class="right">${formatBytes(u.usedBytes)}</td>
          <td class="right">
            <input class="input" style="width:110px;text-align:right" type="number" min="1" step="1" value="${bytesToMb(u.quotaBytes)}" data-quota />
          </td>
          <td class="right">
            <button class="btn btn--sm" type="button" data-act="save">Save</button>
            <button class="btn btn--sm btn--danger" type="button" data-act="delete" ${deleteDisabled ? 'disabled' : ''}>Delete</button>
          </td>
        `;

        tr.addEventListener('click', async (e) => {
          const btn = e.target.closest('button[data-act]');
          if (!btn) return;
          const act = btn.getAttribute('data-act');
          if (act === 'save') {
            const input = $('[data-quota]', tr);
            const nextMb = Number(input?.value || 0);
            try {
              await api(`/api/admin/users/${u.id}/quota`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quotaBytes: mbToBytes(nextMb) }),
              });
              toast('Updated', `${u.username} quota saved`, 'success');
              await refresh();
            } catch (err) {
              toast('Update failed', err?.message || 'Error', 'danger');
            }
          }
          if (act === 'delete') {
            const ok = confirm(`Delete user "${u.username}"? This will remove their files too.`);
            if (!ok) return;
            try {
              await api(`/api/admin/users/${u.id}`, { method: 'DELETE' });
              toast('Deleted', u.username, 'success');
              await refresh();
            } catch (err) {
              toast('Delete failed', err?.message || 'Error', 'danger');
            }
          }
        });

        tbody.appendChild(tr);
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      error && (error.textContent = '');

      const fd = new FormData(form);
      const username = String(fd.get('username') || '').trim();
      const email = String(fd.get('email') || '').trim() || null;
      const password = String(fd.get('password') || '');
      const quotaMb = Number(fd.get('quotaMb') || 0);

      try {
        await api('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            email,
            password,
            quotaBytes: mbToBytes(quotaMb),
          }),
        });
        toast('User created', username, 'success');
        form.reset();
        await refresh();
      } catch (err) {
        if (error) error.textContent = err?.message || 'Create failed';
        toast('Create failed', err?.message || 'Error', 'danger');
      }
    });

    await refresh();
  }

  async function main() {
    renderIcons();
    initNavigation();

    const page = document.body.dataset.page;
    try {
      if (page === 'login') initLoginPage();
      if (page === 'dashboard') await initDashboardPage();
      if (page === 'files') await initFilesPage();
      if (page === 'shared') await initSharedPage();
      if (page === 'public-share') await initPublicSharePage();
      if (page === 'upload') await initUploadPage();
      if (page === 'account') await initAccountPage();
      if (page === 'admin-users') await initAdminUsersPage();
    } catch (err) {
      toast('Error', err?.message || 'Something went wrong', 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', main);
})();

