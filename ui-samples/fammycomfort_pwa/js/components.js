/* ============================================================
   Fammy Comforts — Reusable Component Library
   Pure render helpers (string → HTML) + UI primitives (toast, modal).
   Consumed by app.js views. No view owns its own copy of these.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- DOM utils ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Formatting ---------- */
  const money = (n) => 'KES ' + Number(n || 0).toLocaleString('en-KE');
  const titleCase = (s) => String(s).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  /* ---------- Icons ---------- */
  const icon = (name, cls = '') => `<span class="material-symbols-outlined ${cls}">${name}</span>`;

  /* ---------- Badges ---------- */
  const badge = (status, label) =>
    `<span class="badge b-${status}">${label || titleCase(status)}</span>`;

  /* ---------- Avatar ---------- */
  const avatar = (initials, variant = '') => `<div class="avatar ${variant}">${esc(initials)}</div>`;

  /* ---------- Section header ---------- */
  const sectionHead = (title, sub, action = '') => `
    <div class="section-head">
      <div>
        <h2 class="font-display text-headline-md text-on-surface">${esc(title)}</h2>
        ${sub ? `<p class="text-body-md text-on-surface-variant mt-1">${esc(sub)}</p>` : ''}
      </div>
      ${action}
    </div>`;

  const pageHero = (eyebrow, title, sub) => `
    <header class="mb-6">
      ${eyebrow ? `<p class="eyebrow mb-2">${esc(eyebrow)}</p>` : ''}
      <h2 class="font-display text-headline-lg text-on-surface">${esc(title)}</h2>
      ${sub ? `<p class="text-body-lg text-on-surface-variant mt-1">${esc(sub)}</p>` : ''}
    </header>`;

  /* ---------- KPI widget ---------- */
  const kpi = ({ icon: ic, label, value, delta, tone = 'primary', mono = false }) => {
    const tones = {
      primary: 'background:rgba(20,184,166,0.16);color:#2dd4bf',
      accent: 'background:rgba(234,179,8,0.16);color:#facc15',
      info: 'background:rgba(56,189,248,0.16);color:#7dd3fc',
      warning: 'background:rgba(245,158,11,0.18);color:#fbbf24',
      danger: 'background:rgba(244,63,94,0.16);color:#fb7185'
    };
    return `
    <div class="card card-hover kpi">
      <div class="kpi-icon" style="${tones[tone]}">${icon(ic)}</div>
      <span class="kpi-label">${esc(label)}</span>
      <span class="kpi-value text-on-surface ${mono ? 'mono' : ''}" ${typeof value === 'number' && !mono ? `data-count="${value}"` : ''}>${value}</span>
      ${delta ? `<span class="kpi-delta ${delta.dir === 'down' ? 'delta-down' : 'delta-up'}">${icon(delta.dir === 'down' ? 'trending_down' : 'trending_up', 'text-[14px]')} ${esc(delta.text)}</span>` : ''}
    </div>`;
  };

  /* ---------- Room card ---------- */
  const roomCard = (r, action = '') => `
    <div class="card card-hover room-card" data-room="${r.id}">
      <div class="room-media">
        <img src="${r.image}" alt="${esc(r.name)}" loading="lazy" onerror="this.style.opacity=0.2"/>
        <div style="position:absolute;top:.7rem;left:.7rem;display:flex;gap:.4rem">
          ${r.vip ? badge('vip', 'VIP') : ''}
        </div>
        <div style="position:absolute;top:.7rem;right:.7rem">${badge(r.status)}</div>
      </div>
      <div class="room-body">
        <div class="flex items-center justify-between">
          <span class="mono text-body-md text-on-surface-variant">${r.id}</span>
          <span class="text-body-md text-on-surface-variant">${icon('star', 'text-[15px] align-middle text-warning')} ${r.rating}</span>
        </div>
        <h3 class="font-display text-headline-sm text-on-surface mt-1">${esc(r.name)}</h3>
        <p class="text-body-md text-on-surface-variant mt-0.5">${r.type} · ${icon('group', 'text-[15px] align-middle')} ${r.capacity}</p>
        <div class="flex items-end justify-between mt-3">
          <div><span class="mono text-headline-sm text-primary">${money(r.price)}</span><span class="text-body-md text-on-surface-variant"> /night</span></div>
          ${action}
        </div>
      </div>
    </div>`;

  /* ---------- Simple SVG sparkline ---------- */
  const sparkline = (data, color = '#14b8a6') => {
    const w = 100, h = 30, max = Math.max(...data), min = Math.min(...data);
    const pts = data
      .map((d, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((d - min) / (max - min || 1)) * (h - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${pts}"/>
    </svg>`;
  };

  /* ---------- Bar chart ---------- */
  const barChart = (data, labels, fmt = (v) => v) => {
    const max = Math.max(...data) || 1;
    return `<div class="bar-chart">
      ${data
        .map(
          (d, i) => `<div class="bar-col">
            <div class="bar" style="height:0" data-h="${(d / max) * 100}" title="${fmt(d)}"></div>
            <span class="lbl">${labels[i]}</span>
          </div>`
        )
        .join('')}
    </div>`;
  };

  /* ---------- Donut chart ---------- */
  const donut = (segments) => {
    const total = segments.reduce((s, x) => s + x.value, 0);
    const R = 52, C = 2 * Math.PI * R;
    let offset = 0;
    const rings = segments
      .map((s) => {
        const len = (s.value / total) * C;
        const ring = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${s.color}" stroke-width="16" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}"/>`;
        offset += len;
        return ring;
      })
      .join('');
    return `<svg class="donut" width="140" height="140" viewBox="0 0 140 140">${rings}</svg>`;
  };

  /* ---------- Toast ---------- */
  function toast(msg, type = 'success', ic) {
    const icons = { success: 'check_circle', info: 'info', warn: 'warning', error: 'error' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `${icon(ic || icons[type])}<span>${esc(msg)}</span>`;
    $('#toast-wrap').appendChild(el);
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 300);
    }, 2800);
  }

  /* ---------- Modal ---------- */
  function modal(html) {
    const m = $('#modal');
    m.innerHTML = `<div class="modal-card fade-in">${html}</div>`;
    m.classList.remove('hidden');
    document.body.classList.add('lock');
    requestAnimationFrame(() => m.classList.remove('opacity-0'));
    m.onclick = (e) => { if (e.target === m) closeModal(); };
    $$('[data-close]', m).forEach((b) => (b.onclick = closeModal));
  }
  function closeModal() {
    const m = $('#modal');
    m.classList.add('opacity-0');
    document.body.classList.remove('lock');
    setTimeout(() => { m.classList.add('hidden'); m.innerHTML = ''; }, 300);
  }

  /* ---------- Bottom sheet / centered picker ---------- */
  function sheet(html) {
    const s = $('#sheet');
    s.innerHTML = `<div class="sheet-card fade-in">${html}</div>`;
    s.classList.remove('hidden');
    document.body.classList.add('lock');
    requestAnimationFrame(() => s.classList.remove('opacity-0'));
    s.onclick = (e) => { if (e.target === s) closeSheet(); };
    $$('[data-close]', s).forEach((b) => (b.onclick = closeSheet));
  }
  function closeSheet() {
    const s = $('#sheet');
    s.classList.add('opacity-0');
    document.body.classList.remove('lock');
    setTimeout(() => { s.classList.add('hidden'); s.innerHTML = ''; }, 300);
  }

  /* ---------- Right-docked panel (AI / detail drill-downs) ---------- */
  function panel(html) {
    const o = $('#rpanel-overlay'), p = $('#rpanel');
    p.innerHTML = html;
    o.classList.remove('hidden');
    document.body.classList.add('lock');
    requestAnimationFrame(() => { o.classList.remove('opacity-0'); p.classList.add('open'); });
    o.onclick = (e) => { if (e.target === o) closePanel(); };
    $$('[data-close]', p).forEach((b) => (b.onclick = closePanel));
  }
  function closePanel() {
    const o = $('#rpanel-overlay'), p = $('#rpanel');
    o.classList.add('opacity-0');
    p.classList.remove('open');
    document.body.classList.remove('lock');
    setTimeout(() => { o.classList.add('hidden'); p.innerHTML = ''; }, 300);
  }

  /* ---------- Star rating ---------- */
  const stars = (r) => {
    let h = '';
    for (let i = 1; i <= 5; i++) h += `<span class="material-symbols-outlined" style="font-size:16px;color:#facc15;font-variation-settings:'FILL' ${i <= Math.round(r) ? 1 : 0}">star</span>`;
    return h;
  };

  /* ---------- Empty state ---------- */
  const empty = (ic, title, sub) => `
    <div class="card" style="text-align:center;padding:3rem 1.5rem">
      ${icon(ic, 'text-on-surface-variant')}<style>.card .material-symbols-outlined{font-size:48px}</style>
      <h3 class="font-display text-headline-sm text-on-surface mt-2">${esc(title)}</h3>
      <p class="text-body-md text-on-surface-variant mt-1">${esc(sub)}</p>
    </div>`;

  /* ---------- Count-up animation ---------- */
  function animateCounts(scope = document) {
    $$('[data-count]', scope).forEach((el) => {
      const target = +el.dataset.count;
      if (isNaN(target)) return;
      let cur = 0;
      const steps = 28;
      const inc = target / steps;
      const tick = () => {
        cur += inc;
        if (cur >= target) { el.textContent = target.toLocaleString('en-KE'); return; }
        el.textContent = Math.floor(cur).toLocaleString('en-KE');
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  /* ---------- Animate bars/meters on mount ---------- */
  function animateBars(scope = document) {
    requestAnimationFrame(() => {
      $$('.bar[data-h]', scope).forEach((b) => (b.style.height = b.dataset.h + '%'));
      $$('.meter > span[data-w]', scope).forEach((s) => (s.style.width = s.dataset.w + '%'));
    });
  }

  window.SC_toast = toast;
  window.SC = {
    $, $$, esc, money, titleCase, icon, badge, avatar,
    sectionHead, pageHero, kpi, roomCard, sparkline, barChart, donut, stars,
    toast, modal, closeModal, sheet, closeSheet, panel, closePanel, empty, animateCounts, animateBars
  };
})();
