(() => {
  'use strict';

  const MANIFEST_PATH = 'content/manifest.json';
  let manifest = null;

  // ---- Boot ----
  async function init() {
    try {
      const res = await fetch(MANIFEST_PATH);
      if (!res.ok) throw new Error('manifest fetch failed');
      manifest = await res.json();
    } catch {
      setContent('<div class="loading">Could not load site content.</div>');
      return;
    }

    marked.use({ gfm: true, breaks: false });
    buildTabNav();
    window.addEventListener('hashchange', route);
    route();
  }

  // ---- Tab Navigation ----
  function buildTabNav() {
    const nav = document.getElementById('tab-nav');
    nav.innerHTML = manifest.tabs
      .map(t => `<a class="tab" href="#${t.id}" role="tab" data-tab="${t.id}">${esc(t.label)}</a>`)
      .join('');
  }

  function activateTab(tabId) {
    document.querySelectorAll('.tab').forEach(el => {
      const on = el.dataset.tab === tabId;
      el.classList.toggle('active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  // ---- Router ----
  function route() {
    const hash = location.hash.slice(1);
    if (!hash) {
      location.replace('#' + manifest.tabs[0].id);
      return;
    }

    const [tabId, slug] = hash.split('/');
    const tab = manifest.tabs.find(t => t.id === tabId);

    if (!tab) {
      renderNotFound();
      return;
    }

    activateTab(tabId);

    if (slug) {
      const article = tab.articles.find(a => a.slug === slug);
      article ? loadArticle(tab, article) : renderNotFound();
    } else {
      renderList(tab);
    }
  }

  // ---- List View ----
  function renderList(tab) {
    const cards = tab.articles.length === 0
      ? '<div class="empty-state"><p>No articles yet — check back soon.</p></div>'
      : `<div class="article-grid">${tab.articles.map(a => cardHtml(tab.id, a)).join('')}</div>`;

    setContent(`
      <div class="tab-description">
        <h2>${esc(tab.label)}</h2>
        <p>${esc(tab.description)}</p>
      </div>
      ${cards}
    `);
  }

  function cardHtml(tabId, a) {
    const tags = (a.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    return `
      <a class="article-card" href="#${tabId}/${a.slug}">
        <div class="article-card-date">${fmtDate(a.date)}</div>
        <div class="article-card-title">${esc(a.title)}</div>
        ${a.description ? `<div class="article-card-desc">${esc(a.description)}</div>` : ''}
        ${tags ? `<div class="article-card-tags">${tags}</div>` : ''}
      </a>`;
  }

  // ---- Article View ----
  async function loadArticle(tab, article) {
    setContent('<div class="loading">Loading…</div>');

    let raw;
    try {
      const res = await fetch(`content/${tab.id}/${article.slug}.md`);
      if (!res.ok) throw new Error('not found');
      raw = await res.text();
    } catch {
      setContent(`
        <a class="back-btn" href="#${tab.id}">← ${esc(tab.label)}</a>
        <div class="loading">Could not load this article.</div>`);
      return;
    }

    const { meta, body } = parseFrontmatter(raw);
    const title = meta.title || article.title;
    const date  = meta.date  || article.date;
    const tags  = parseTags(meta.tags).length ? parseTags(meta.tags) : (article.tags || []);
    const tagHtml = tags.map(t => `<span class="tag">${esc(t)}</span>`).join('');

    setContent(`
      <div class="article-view-header">
        <a class="back-btn" href="#${tab.id}"><span aria-hidden="true">←</span> ${esc(tab.label)}</a>
        <h1 class="article-view-title">${esc(title)}</h1>
        <div class="article-view-meta">
          ${date ? `<span class="date">${fmtDate(date)}</span>` : ''}
          ${tagHtml ? `<div class="article-card-tags">${tagHtml}</div>` : ''}
        </div>
      </div>
      <div class="article-view-body">${renderMd(body)}</div>
    `);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- Not Found ----
  function renderNotFound() {
    setContent(`
      <div class="empty-state">
        <p>Page not found. <a href="#">Return home →</a></p>
      </div>`);
  }

  // ---- Helpers ----
  function setContent(html) {
    document.getElementById('main-content').innerHTML = html;
  }

  function renderMd(text) {
    const html = marked.parse(text);
    return html.replace(
      /<a\s+href="(https?:\/\/[^"]+)"/g,
      '<a target="_blank" rel="noopener noreferrer" href="$1"'
    );
  }

  function parseFrontmatter(raw) {
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { meta: {}, body: raw };
    const meta = {};
    m[1].split('\n').forEach(line => {
      const i = line.indexOf(':');
      if (i < 1) return;
      meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
    return { meta, body: m[2] };
  }

  function parseTags(str) {
    if (!str) return [];
    return str.replace(/^\[|\]$/g, '').split(',').map(t => t.trim()).filter(Boolean);
  }

  function fmtDate(str) {
    if (!str) return '';
    try {
      return new Date(str + 'T00:00:00').toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch { return str; }
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
