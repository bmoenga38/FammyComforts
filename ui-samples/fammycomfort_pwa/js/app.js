/* ============================================================
   Fammy Comforts — Application Engine
   Vanilla JS SPA · hash router · role-based nav · persisted state
   ============================================================ */
(function () {
  'use strict';

  const D = window.SC_DATA;
  const C = window.SC; // component library
  const { $, $$, esc, money, badge, avatar, icon, kpi, roomCard, sectionHead, pageHero, barChart, donut, sparkline } = C;

  /* ---------------- Persisted state ---------------- */
  // Demo: no data persistence — every refresh starts clean from the seed data.
  // (Theme is the one exception and is handled separately in theme.js.)
  const store = {
    get(k, d) { return d; },
    set() {}
  };
  const state = {
    role: store.get('role', 'customer'),
    points: store.get('points', 4820),
    tasks: store.get('tasks', null) || D.TASKS.map((t) => ({ ...t })),
    auth: store.get('auth', null) // { method:'phone'|'email', identity }
  };
  const persist = () => { store.set('role', state.role); store.set('points', state.points); store.set('tasks', state.tasks); };
  const ADMIN_CRED = { email: 'admin@fammycomforts.co.ke', pass: 'admin123' };
  const credit = '<p class="credit">Powered by <a href="https://bytebazaar-plane.vercel.app/" target="_blank" rel="noopener noreferrer">ByteBazaar Tech Labs</a></p>';

  /* ---------------- Roles & nav config ---------------- */
  const ROLES = [
    { id: 'customer', label: 'Customer', icon: 'person', home: 'home', desc: 'Book & manage your stay' },
    { id: 'reception', label: 'Reception', icon: 'concierge', home: 'desk', desc: 'Front desk operations' },
    { id: 'operations', label: 'Operations', icon: 'monitoring', home: 'ops', desc: 'Analytics & oversight' },
    { id: 'assistant', label: 'Lounge Assistant', icon: 'cleaning_services', home: 'tasks', desc: 'Tasks & housekeeping' },
    { id: 'admin', label: 'Administrator', icon: 'admin_panel_settings', home: 'overview', desc: 'System & users' }
  ];

  const NAV = {
    customer: [
      { route: 'home', label: 'Home', icon: 'home' },
      { route: 'search', label: 'Book', icon: 'search' },
      { route: 'reservations', label: 'Trips', icon: 'luggage' },
      { route: 'loyalty', label: 'Rewards', icon: 'loyalty' },
      { route: 'profile', label: 'Profile', icon: 'account_circle' }
    ],
    reception: [
      { route: 'desk', label: 'Desk', icon: 'concierge' },
      { route: 'calendar', label: 'Calendar', icon: 'calendar_month' },
      { route: 'walkins', label: 'Walk-ins', icon: 'directions_walk' },
      { route: 'occupancy', label: 'Rooms', icon: 'meeting_room' },
      { route: 'lookup', label: 'Lookup', icon: 'person_search' },
      { route: 'notifications', label: 'Alerts', icon: 'notifications' }
    ],
    operations: [
      { route: 'ops', label: 'Daily Ops', icon: 'dashboard' },
      { route: 'analytics', label: 'Analytics', icon: 'monitoring' },
      { route: 'staff', label: 'Staff', icon: 'groups' },
      { route: 'forecast', label: 'Forecast', icon: 'insights' }
    ],
    assistant: [
      { route: 'tasks', label: 'Tasks', icon: 'task_alt' },
      { route: 'prep', label: 'Prep', icon: 'bed' },
      { route: 'maintenance', label: 'Fixes', icon: 'build' },
      { route: 'incidents', label: 'Report', icon: 'report' }
    ],
    admin: [
      { route: 'overview', label: 'Overview', icon: 'dashboard' },
      { route: 'users', label: 'Users', icon: 'group' },
      { route: 'roles', label: 'Roles', icon: 'shield_person' },
      { route: 'templates', label: 'Messages', icon: 'sms' },
      { route: 'config', label: 'Config', icon: 'settings' },
      { route: 'audit', label: 'Audit', icon: 'history' }
    ]
  };

  /* ============================================================
     AUTHENTICATION
     Admin → email + password · Everyone else → phone + OTP
     ============================================================ */
  const loginHTML = (mode, step, phoneVal) => `
    <div class="login-card glass-panel fade-in">
      <button id="lg-theme" class="icon-btn" style="position:absolute;top:1rem;right:1rem" aria-label="Theme"><span class="material-symbols-outlined" data-theme-icon>light_mode</span></button>
      <div style="text-align:center;margin-bottom:1.4rem">
        <div class="brand-mark" style="width:58px;height:58px;font-size:28px;margin:0 auto 0.8rem">F</div>
        <h1 class="font-hero" style="font-size:26px;margin:0">Fammy Comforts</h1>
        <p class="text-body-md text-on-surface-variant" style="margin:.25rem 0 0">All-in-one rooms, bookings, guests &amp; operations</p>
      </div>
      <div class="seg" style="width:100%;margin-bottom:1.3rem">
        <button class="seg-btn lg-tab ${mode === 'phone' ? 'active' : ''}" data-m="phone" style="flex:1;justify-content:center">${icon('smartphone')} Phone OTP</button>
        <button class="seg-btn lg-tab ${mode === 'email' ? 'active' : ''}" data-m="email" style="flex:1;justify-content:center">${icon('admin_panel_settings')} Admin</button>
      </div>
      ${mode === 'phone'
        ? (step === 'enter'
          ? `<div class="field" style="margin-bottom:1rem"><label>Phone number</label>
               <div class="input-icon">${icon('call')}<input id="lg-phone" class="input" inputmode="tel" placeholder="+254 7XX XXX XXX" value="${esc(phoneVal)}"/></div></div>
             <button class="btn btn-primary btn-block" id="lg-send">${icon('sms')} Send OTP</button>
             <p class="text-body-md text-on-surface-variant" style="text-align:center;margin-top:1rem">Guests &amp; staff sign in with their phone number.</p>`
          : `<p class="text-body-md text-on-surface-variant" style="margin-bottom:.8rem">Enter the 6-digit code sent to <b class="text-on-surface">${esc(phoneVal)}</b></p>
             <div class="field" style="margin-bottom:1rem"><label>One-time code</label><input id="lg-otp" class="input otp-input" inputmode="numeric" maxlength="6" placeholder="••••••"/></div>
             <button class="btn btn-primary btn-block" id="lg-verify">${icon('lock_open')} Verify &amp; sign in</button>
             <div style="display:flex;justify-content:space-between;margin-top:1rem">
               <button id="lg-back" class="chip">${icon('arrow_back', 'text-[14px]')} Change number</button>
               <button id="lg-resend" class="chip">Resend code</button></div>`)
        : `<div class="field" style="margin-bottom:.8rem"><label>Email</label><div class="input-icon">${icon('mail')}<input id="lg-email" class="input" type="email" placeholder="admin@fammycomforts.co.ke"/></div></div>
           <div class="field" style="margin-bottom:.5rem"><label>Password</label><div class="input-icon">${icon('lock')}<input id="lg-pass" class="input" type="password" placeholder="••••••••"/></div></div>
           <label class="list-row" style="cursor:pointer;padding:.2rem"><input type="checkbox" checked style="width:16px;height:16px;accent-color:var(--primary)"/><span class="text-body-md text-on-surface-variant" style="margin-left:.5rem">Keep me signed in</span></label>
           <button class="btn btn-primary btn-block" id="lg-signin" style="margin-top:.6rem">${icon('login')} Sign in to dashboard</button>
           <p class="text-body-md text-on-surface-variant" style="text-align:center;margin-top:1rem">Demo · admin@fammycomforts.co.ke / admin123</p>`}
      <div style="display:flex;gap:1.2rem;justify-content:center;margin-top:1.4rem;opacity:.75">
        <span class="text-body-md text-on-surface-variant">${icon('lock', 'text-[14px] align-middle')} Secure</span>
        <span class="text-body-md text-on-surface-variant">${icon('support_agent', 'text-[14px] align-middle')} 24/7 support</span>
      </div>
      ${credit}
    </div>`;

  function showLogin() {
    document.body.classList.add('auth-locked');
    document.body.classList.remove('lock');
    const el = $('#login');
    el.classList.remove('hidden');
    let mode = 'phone', step = 'enter', phoneVal = '';
    const draw = () => { el.innerHTML = loginHTML(mode, step, phoneVal); window.SC_Theme.apply(); wire(); };
    const wire = () => {
      $$('.lg-tab').forEach((b) => (b.onclick = () => { mode = b.dataset.m; step = 'enter'; draw(); }));
      $('#lg-theme').onclick = () => { window.SC_Theme.toggle(); draw(); };
      if (mode === 'phone' && step === 'enter') {
        const go = () => {
          const p = ($('#lg-phone').value || '').trim();
          if (p.replace(/\D/g, '').length < 9) return C.toast('Enter a valid phone number', 'error');
          phoneVal = p; step = 'otp'; draw();
          C.toast('OTP sent to ' + p + ' · demo code 123456', 'info', 'sms');
        };
        $('#lg-send').onclick = go;
        $('#lg-phone').onkeydown = (e) => { if (e.key === 'Enter') go(); };
      } else if (mode === 'phone') {
        const go = () => {
          const c = ($('#lg-otp').value || '').replace(/\D/g, '');
          if (c.length < 6) return C.toast('Enter the 6-digit code', 'error');
          enterApp('phone', phoneVal);
        };
        $('#lg-verify').onclick = go;
        $('#lg-otp').onkeydown = (e) => { if (e.key === 'Enter') go(); };
        $('#lg-back').onclick = () => { step = 'enter'; draw(); };
        $('#lg-resend').onclick = () => C.toast('New OTP sent · demo code 123456', 'info', 'sms');
        setTimeout(() => $('#lg-otp') && $('#lg-otp').focus(), 60);
      } else {
        const go = () => {
          const em = ($('#lg-email').value || '').trim().toLowerCase();
          const pw = $('#lg-pass').value || '';
          if (em === ADMIN_CRED.email && pw === ADMIN_CRED.pass) enterApp('email', em);
          else C.toast('Invalid admin credentials', 'error', 'lock');
        };
        $('#lg-signin').onclick = go;
        $('#lg-pass').onkeydown = (e) => { if (e.key === 'Enter') go(); };
      }
    };
    draw();
  }

  function enterApp(method, identity) {
    state.auth = { method, identity };
    if (method === 'email') state.role = 'admin';
    else if (state.role === 'admin') state.role = 'customer'; // phone users can't hold admin
    store.set('auth', state.auth);
    persist();
    document.body.classList.remove('auth-locked');
    $('#login').classList.add('hidden');
    $('#login').innerHTML = '';
    renderNav();
    location.hash = '#/' + ROLES.find((r) => r.id === state.role).home;
    render();
    C.toast('Signed in' + (method === 'email' ? ' as Administrator' : ''), 'success', 'check_circle');
  }

  function logout() {
    state.auth = null;
    store.set('auth', null);
    closeDrawer();
    C.closeModal && C.closeModal();
    showLogin();
  }

  /* ============================================================
     SHELL RENDERING
     ============================================================ */
  function renderNav() {
    const items = NAV[state.role];
    const sideHtml = items
      .map((n) => `<button class="nav-link" data-route="${n.route}">${icon(n.icon)}<span>${n.label}</span></button>`)
      .join('');
    $('#side-nav').innerHTML = sideHtml;
    $('#drawer-nav').innerHTML = sideHtml;

    // bottom nav = up to 5 destinations
    $('#bottom-nav').innerHTML = items
      .slice(0, 5)
      .map((n) => `<button class="bnav-item" data-route="${n.route}">${icon(n.icon)}<span>${n.label}</span></button>`)
      .join('');

    const cur = ROLES.find((r) => r.id === state.role);
    $$('[data-role-icon]').forEach((e) => (e.textContent = cur.icon));
    $$('[data-role-label]').forEach((e) => (e.textContent = cur.label));

    $$('[data-route]').forEach((b) => (b.onclick = () => { location.hash = '#/' + b.dataset.route; closeDrawer(); }));
  }

  function highlightNav(route) {
    $$('.nav-link, .bnav-item').forEach((b) => b.classList.toggle('active', b.dataset.route === route));
  }

  function switchRole(id) {
    if (id === 'admin' && (!state.auth || state.auth.method !== 'email')) {
      return C.toast('Admin requires email sign-in. Please sign out and use Admin login.', 'warn', 'lock');
    }
    state.role = id;
    persist();
    renderNav();
    C.closeSheet();
    location.hash = '#/' + ROLES.find((r) => r.id === id).home;
    C.toast(ROLES.find((r) => r.id === id).label + ' workspace active', 'info', ROLES.find((r) => r.id === id).icon);
  }

  function roleSheet() {
    // Phone-authenticated users (guests/staff) can't reach the Admin workspace.
    const list = state.auth && state.auth.method === 'phone' ? ROLES.filter((r) => r.id !== 'admin') : ROLES;
    C.sheet(`
      <div class="modal-head"><h3 class="font-display text-headline-sm">Switch workspace</h3>
        <button data-close class="icon-btn ml-auto">${icon('close')}</button></div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:.5rem">
        ${list.map(
          (r) => `<button class="list-row" data-pick="${r.id}" style="cursor:pointer;border:1px solid ${r.id === state.role ? 'var(--primary)' : 'var(--outline)'}">
            <div class="avatar avatar-primary">${icon(r.icon)}</div>
            <div style="flex:1"><p class="font-display text-headline-sm text-on-surface" style="font-size:15px">${r.label}</p>
            <p class="text-body-md text-on-surface-variant">${r.desc}</p></div>
            ${r.id === state.role ? badge('active', 'Active') : ''}
          </button>`
        ).join('')}
        <p class="text-body-md text-on-surface-variant" style="text-align:center;margin-top:.4rem">Signed in via ${state.auth && state.auth.method === 'email' ? 'Admin email' : 'phone · ' + (state.auth ? esc(state.auth.identity) : '')}</p>
      </div>`);
    $$('[data-pick]').forEach((b) => (b.onclick = () => switchRole(b.dataset.pick)));
  }

  /* ---------------- Drawer ---------------- */
  function openDrawer() {
    $('#drawer-overlay').classList.remove('hidden');
    document.body.classList.add('lock');
    requestAnimationFrame(() => { $('#drawer-overlay').classList.remove('opacity-0'); $('#drawer').classList.remove('-translate-x-full'); });
  }
  function closeDrawer() {
    $('#drawer-overlay').classList.add('opacity-0');
    $('#drawer').classList.add('-translate-x-full');
    document.body.classList.remove('lock');
    setTimeout(() => $('#drawer-overlay').classList.add('hidden'), 300);
  }

  /* ---------------- Search overlay ---------------- */
  function openSearch() {
    C.modal(`
      <div class="modal-head">${icon('search', 'text-on-surface-variant')}
        <input id="g-search" class="input" placeholder="Search rooms, guests, bookings…" style="border:none;background:transparent;padding-left:.4rem" autofocus/>
        <button data-close class="icon-btn">${icon('close')}</button></div>
      <div class="modal-body"><div id="g-results" style="display:flex;flex-direction:column;gap:.4rem"></div></div>`);
    const run = () => {
      const q = ($('#g-search').value || '').toLowerCase().trim();
      const rooms = D.ROOMS.filter((r) => (r.name + r.id + r.type).toLowerCase().includes(q)).slice(0, 4);
      const guests = D.GUESTS.filter((g) => (g.name + g.phone).toLowerCase().includes(q)).slice(0, 3);
      $('#g-results').innerHTML =
        (rooms.length || guests.length
          ? rooms.map((r) => `<button class="list-row" onclick="location.hash='#/search'" style="cursor:pointer">${icon('meeting_room', 'text-primary')}<div style="flex:1"><p class="text-on-surface">${esc(r.name)}</p><p class="mono text-body-md text-on-surface-variant">${r.id} · ${money(r.price)}</p></div>${badge(r.status)}</button>`).join('') +
            guests.map((g) => `<button class="list-row" onclick="location.hash='#/lookup'" style="cursor:pointer">${avatar(g.avatar, 'avatar-accent')}<div style="flex:1"><p class="text-on-surface">${esc(g.name)}</p><p class="text-body-md text-on-surface-variant">${esc(g.phone)}</p></div>${badge(g.tier.toLowerCase())}</button>`).join('')
          : `<p class="text-body-md text-on-surface-variant" style="padding:1rem;text-align:center">No matches for “${esc(q)}”.</p>`);
    };
    run();
    $('#g-search').oninput = run;
  }

  /* ---------------- AI assistant (floating, right-docked) ---------------- */
  function aiAnswer(q) {
    q = q.toLowerCase();
    const avail = D.ROOMS.filter((r) => r.status === 'available');
    if (/occupan/.test(q)) return `Occupancy is <b>${D.ANALYTICS.kpis.occupancy}%</b> — ${D.ROOMS.filter((r) => r.status === 'occupied').length} occupied, ${avail.length} available.`;
    if (/avail/.test(q)) return `${avail.length} lounges available now: <b>${avail.map((r) => r.id).join(', ')}</b>.`;
    if (/check.?in|arriv|next/.test(q)) return `Next arrival: <b>Faith Chebet</b> (VIP) → Maasai Mara Penthouse (SC-201) at 12:00.`;
    if (/clean/.test(q)) return `${state.tasks.filter((t) => t.type === 'Cleaning' && t.status !== 'done').length} room(s) need cleaning. Top priority: <b>SC-103</b> (deep clean).`;
    if (/revenue|sales|earn|money/.test(q)) return `Revenue today is <b>${money(D.ANALYTICS.kpis.revenueToday)}</b>, up <b>+12%</b> vs last week.`;
    if (/point|loyal|reward/.test(q)) return `You have <b>${state.points.toLocaleString()}</b> points — 180 from a free night.`;
    if (/payment|pending|unpaid/.test(q)) return `${D.BOOKINGS.filter((b) => !b.paid && b.status !== 'cancelled').length} booking(s) await payment, e.g. <b>BK-7843</b>.`;
    if (/maintenance|fault|repair|broken/.test(q)) return `${state.tasks.filter((t) => t.type === 'Maintenance').length} open maintenance request(s). Urgent: <b>SC-202</b> AC fault.`;
    if (/sms|message|notif/.test(q)) return `${D.NOTIFICATIONS.filter((n) => n.channel === 'SMS').length} SMS sent today via <b>FAMMY</b>.`;
    if (/audit|recent|log/.test(q)) return `Latest activity: ${D.AUDIT[0].action} <span class="mono">(${D.AUDIT[0].time})</span>.`;
    if (/task|urgent|work/.test(q)) return `${state.tasks.filter((t) => t.status !== 'done').length} open tasks, <b>${state.tasks.filter((t) => t.priority === 'urgent').length} urgent</b>.`;
    if (/time|check.?out/.test(q)) return `Check-in is <b>14:00</b>, check-out <b>11:00</b>.`;
    if (/template|disabled/.test(q)) return `${D.TEMPLATES.filter((t) => !t.active).length} template disabled: "${(D.TEMPLATES.find((t) => !t.active) || {}).name}".`;
    return `Good question. In production I'd query live data to answer that — for now try one of the suggested prompts below.`;
  }
  function openAI() {
    const ctx = {
      customer: ['Find me an available lounge', 'How many points do I have?', 'What time is check-in?'],
      reception: ['Who is checking in next?', 'Which rooms are available?', 'Any pending payments?'],
      operations: ['Show today’s occupancy', 'Revenue vs last week', 'How many open tasks?'],
      assistant: ['What are my urgent tasks?', 'Which rooms need cleaning?', 'Any open maintenance?'],
      admin: ['How many SMS sent today?', 'Show recent audit activity', 'Any disabled templates?']
    };
    const examples = ctx[state.role] || ctx.customer;
    C.panel(`
      <div class="rpanel-head">
        <div class="avatar avatar-primary">${icon('auto_awesome')}</div>
        <div style="flex:1;min-width:0"><h3 class="font-display text-headline-sm">Fammy Comforts AI</h3>
          <p class="text-body-md text-on-surface-variant">Copilot · ${C.titleCase(state.role)} workspace</p></div>
        <button data-close class="icon-btn">${icon('close')}</button>
      </div>
      <div class="rpanel-body">
        <div id="ai-feed" class="ai-feed">
          <div class="ai-msg bot">Karibu! I can help with occupancy, arrivals, cleaning, revenue, payments and more. Ask me anything.</div>
        </div>
      </div>
      <div class="rpanel-foot">
        <p class="text-label-caps uppercase text-on-surface-variant mb-2">Suggested</p>
        <div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.8rem">
          ${examples.map((e) => `<button class="chip ai-ex">${e}</button>`).join('')}
        </div>
        <div class="input-icon">${icon('chat')}<input id="ai-input" class="input" placeholder="Ask Fammy Comforts AI…" autocomplete="off"/></div>
      </div>`);
    const send = (text) => {
      const feed = $('#ai-feed');
      feed.insertAdjacentHTML('beforeend', `<div class="ai-msg me">${esc(text)}</div>`);
      feed.scrollTop = feed.scrollHeight;
      setTimeout(() => {
        feed.insertAdjacentHTML('beforeend', `<div class="ai-msg bot">${aiAnswer(text)}</div>`);
        feed.scrollTop = feed.scrollHeight;
      }, 420);
    };
    $$('.ai-ex').forEach((b) => (b.onclick = () => send(b.textContent)));
    const inp = $('#ai-input');
    inp.onkeydown = (e) => { if (e.key === 'Enter' && inp.value.trim()) { send(inp.value.trim()); inp.value = ''; } };
  }

  /* ---------------- Room detail ----------------
     popup=true  → centered modal (customer side)
     popup=false → right-docked panel (reception room board) */
  function openRoomDetail(id, popup = true) {
    const r = D.ROOMS.find((x) => x.id === id);
    if (!r) return;
    const reviews = D.REVIEWS[id] || D.REVIEWS.default;
    const open = popup ? C.modal : C.panel;
    const close = popup ? C.closeModal : C.closePanel;
    open(`
      <div class="detail-hero">
        <img src="${r.image}" alt="${esc(r.name)}" onerror="this.style.opacity=.2"/>
        <div class="scrim"></div>
        <button data-close class="icon-btn close-x">${icon('close')}</button>
        <div style="position:absolute;bottom:1rem;left:1.3rem;right:1.3rem">
          <div style="display:flex;gap:.4rem;margin-bottom:.5rem">${r.vip ? badge('vip', 'VIP') : ''}${badge(r.status)}</div>
          <h3 class="font-display text-headline-md" style="color:#fff;margin:0">${esc(r.name)}</h3>
          <p class="mono" style="color:#cdd6e8;margin:.2rem 0 0">${r.id} · ${r.type}</p>
        </div>
      </div>
      <div class="rpanel-body">
        <div class="flex items-center justify-between mb-4">
          <div>${C.stars(r.rating)} <span class="text-body-md text-on-surface-variant">${r.rating} · ${r.reviews} reviews</span></div>
          <div><span class="mono text-headline-sm text-primary">${money(r.price)}</span><span class="text-body-md text-on-surface-variant">/night</span></div>
        </div>
        <div class="grid grid-3" style="gap:.5rem;text-align:center;margin-bottom:1.3rem">
          <div class="card card-pad-sm"><p class="kpi-value" style="font-size:18px">${r.capacity}</p><p class="text-body-md text-on-surface-variant">Guests</p></div>
          <div class="card card-pad-sm"><p class="kpi-value" style="font-size:18px">${r.floor}</p><p class="text-body-md text-on-surface-variant">Floor</p></div>
          <div class="card card-pad-sm"><p class="kpi-value" style="font-size:18px">${icon('star', 'text-warning')}</p><p class="text-body-md text-on-surface-variant">${r.rating}</p></div>
        </div>
        <p class="text-label-caps uppercase text-on-surface-variant mb-2">Amenities</p>
        <div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:1.3rem">${r.amenities.map((a) => `<span class="badge b-info">${icon('check', 'text-[14px]')} ${a}</span>`).join('')}</div>
        <p class="text-label-caps uppercase text-on-surface-variant mb-1">Guest reviews</p>
        <div class="divide-rows">${reviews.map((rv) => `<div style="padding:.8rem 0">
          <div class="flex items-center gap-2 mb-1">${avatar(rv.avatar, 'avatar-primary')}<div style="flex:1"><p class="text-on-surface" style="font-weight:600;font-size:14px">${esc(rv.by)}</p><p class="text-body-md text-on-surface-variant">${rv.when}</p></div><div>${C.stars(rv.rating)}</div></div>
          <p class="text-body-md text-on-surface-variant">${esc(rv.text)}</p></div>`).join('')}</div>
      </div>
      <div class="rpanel-foot">
        ${r.status === 'available'
          ? `<button class="btn btn-primary btn-block" id="rd-book">${icon('event_available')} Book this lounge</button>`
          : `<button class="btn btn-ghost btn-block" disabled style="opacity:.6">${C.titleCase(r.status)} — unavailable</button>`}
      </div>`);
    const bk = $('#rd-book');
    if (bk) bk.onclick = () => { close(); setTimeout(() => openBooking(id), 320); };
  }

  /* ---------------- Guest & booking detail — editable popup (Front Desk) ---------------- */
  function openGuestDetail(id) {
    const g = D.GUESTS.find((x) => x.id === id);
    if (!g) return;
    const booking = D.BOOKINGS.find((b) => b.guest === id && b.status !== 'cancelled') || D.BOOKINGS.find((b) => b.guest === id);
    const statusOpts = ['confirmed', 'pending', 'checked-in', 'checkout-due', 'cancelled'];
    C.modal(`
      <div class="modal-head">
        ${avatar(g.avatar, g.vip ? 'avatar-accent' : 'avatar-primary')}
        <div style="flex:1;min-width:0"><h3 class="font-display text-headline-sm">Edit details</h3>
          <p class="text-body-md text-on-surface-variant">${esc(g.name)} · ${badge(g.tier.toLowerCase())} ${g.vip ? badge('vip', 'VIP') : ''}</p></div>
        <button data-close class="icon-btn">${icon('close')}</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:1.1rem">
        <div class="grid grid-2" style="gap:.5rem">
          <button class="btn btn-ghost gd-act" data-act="Calling ${esc(g.name)}…">${icon('call')} Call</button>
          <button class="btn btn-ghost gd-act" data-act="SMS draft opened (FAMMY)">${icon('sms')} Message</button>
        </div>
        <div>
          <p class="text-label-caps uppercase text-on-surface-variant mb-2">Guest details</p>
          <div style="display:flex;flex-direction:column;gap:.7rem">
            <div class="field"><label>Full name</label><div class="input-icon">${icon('person')}<input id="gd-name" class="input" value="${esc(g.name)}"/></div></div>
            <div class="grid grid-2" style="gap:.7rem">
              <div class="field"><label>Phone</label><input id="gd-phone" class="input" value="${esc(g.phone)}"/></div>
              <div class="field"><label>Email</label><input id="gd-email" class="input" value="${esc(g.email)}"/></div>
            </div>
            <div class="field"><label>ID / Passport number</label><div class="input-icon">${icon('badge')}<input id="gd-idno" class="input" value="${esc(g.idNumber || '')}" placeholder="e.g. 12345678"/></div></div>
            <div class="field"><label>ID photo</label>
              <div class="id-up">
                <img id="gd-idimg" class="id-thumb ${g.idPhoto ? '' : 'hide'}" src="${g.idPhoto || ''}"/>
                <label class="btn btn-ghost" style="flex:1">${icon('photo_camera')} <span id="gd-idlabel">${g.idPhoto ? 'Change ID photo' : 'Upload ID photo'}</span><input id="gd-idfile" type="file" accept="image/*" style="display:none"/></label>
              </div>
            </div>
          </div>
        </div>
        ${booking ? `
        <div>
          <p class="text-label-caps uppercase text-on-surface-variant mb-2">Booking · <span class="mono">${booking.code}</span></p>
          <div style="display:flex;flex-direction:column;gap:.7rem">
            <div class="field"><label>Room</label><select id="gd-room" class="input">${D.ROOMS.map((r) => `<option value="${r.id}" ${r.id === booking.room ? 'selected' : ''}>${r.id} · ${esc(r.name)}</option>`).join('')}</select></div>
            <div class="grid grid-2" style="gap:.7rem">
              <div class="field"><label>Check-in</label><input id="gd-in" type="date" class="input" value="${booking.checkIn}"/></div>
              <div class="field"><label>Check-out</label><input id="gd-out" type="date" class="input" value="${booking.checkOut}"/></div>
            </div>
            <div class="grid grid-2" style="gap:.7rem">
              <div class="field"><label>Guests</label><input id="gd-guests" type="number" min="1" class="input" value="${booking.guests}"/></div>
              <div class="field"><label>Status</label><select id="gd-status" class="input">${statusOpts.map((s) => `<option value="${s}" ${s === booking.status ? 'selected' : ''}>${C.titleCase(s)}</option>`).join('')}</select></div>
            </div>
            <label class="list-row" style="cursor:pointer;padding:.4rem .2rem"><span class="text-on-surface" style="flex:1">Payment received</span><span class="switch ${booking.paid ? 'on' : ''}" id="gd-paid"><span class="knob"></span></span></label>
            <div class="grid grid-2" style="gap:.6rem">
              <button class="btn btn-ghost gd-invoice" type="button">${icon('receipt_long')} Invoice</button>
              <button class="btn btn-ghost gd-cancel" type="button" style="border-color:rgba(244,63,94,.4);color:#fb7185">${icon('cancel')} Cancel</button>
            </div>
          </div>
        </div>` : '<p class="text-body-md text-on-surface-variant">No active booking for this guest.</p>'}
      </div>
      <div class="rpanel-foot" style="display:flex;gap:.6rem">
        <button class="btn btn-ghost" data-close style="flex:1">Cancel</button>
        <button class="btn btn-primary" id="gd-save" style="flex:1">${icon('save')} Save changes</button>
      </div>`);
    $$('.gd-act').forEach((b) => (b.onclick = () => C.toast(b.dataset.act, 'info', 'check_circle')));
    $$('.gd-invoice').forEach((b) => (b.onclick = () => openInvoice(booking)));
    $$('.gd-cancel').forEach((b) => (b.onclick = () => openCancel(booking)));
    const paid = $('#gd-paid');
    if (paid) paid.onclick = () => paid.classList.toggle('on');
    let idPhoto = g.idPhoto || '';
    $('#gd-idfile').onchange = (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { idPhoto = rd.result; $('#gd-idimg').src = idPhoto; $('#gd-idimg').classList.remove('hide'); $('#gd-idlabel').textContent = 'Change ID photo'; };
      rd.readAsDataURL(f);
    };
    $('#gd-save').onclick = () => {
      g.name = ($('#gd-name').value || '').trim() || g.name;
      g.phone = ($('#gd-phone').value || '').trim();
      g.email = ($('#gd-email').value || '').trim();
      g.idNumber = ($('#gd-idno').value || '').trim();
      g.idPhoto = idPhoto;
      if (booking) {
        booking.room = $('#gd-room').value;
        booking.checkIn = $('#gd-in').value;
        booking.checkOut = $('#gd-out').value;
        booking.guests = +$('#gd-guests').value || booking.guests;
        booking.status = $('#gd-status').value;
        booking.paid = $('#gd-paid').classList.contains('on');
      }
      C.closeModal();
      C.toast('Details updated for ' + g.name, 'success', 'save');
      render();
    };
  }

  /* ---------------- Tax invoice / receipt (16% VAT, KRA) ---------------- */
  const INVOICE_DATE = new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
  function openInvoice(b) {
    if (!b) return;
    const g = D.GUESTS.find((x) => x.id === b.guest) || { name: b.guestName || 'Guest', phone: b.guestPhone || '' };
    const r = D.ROOMS.find((x) => x.id === b.room) || { name: b.roomName || b.room, id: b.room };
    const gross = b.amount || 0;
    const net = Math.round(gross / 1.16);   // rate is VAT-inclusive at 16%
    const vat = gross - net;
    const nights = b.nights || 1;
    const nightly = Math.round(gross / nights);
    C.modal(`
      <div class="modal-head no-print"><span class="badge b-info">${icon('receipt_long')} Tax invoice</span>
        <h3 class="font-display text-headline-sm mono">${b.code || 'INV'}</h3>
        <button data-close class="icon-btn ml-auto">${icon('close')}</button></div>
      <div class="modal-body invoice">
        <div class="inv-head">
          <div>
            <div class="brand-mark" style="width:40px;height:40px;font-size:20px">F</div>
            <h2 class="font-hero" style="font-size:20px;margin:.5rem 0 0">Fammy Comforts</h2>
            <p class="text-body-md text-on-surface-variant">Nairobi, Kenya · +254 746 507 979</p>
            <p class="text-body-md text-on-surface-variant mono">KRA PIN: P051234567X</p>
          </div>
          <div style="text-align:right">
            <p class="text-label-caps uppercase text-on-surface-variant">Tax invoice</p>
            <p class="mono text-on-surface" style="font-weight:600">INV-${(b.code || '0000').replace('BK-', '')}</p>
            <p class="text-body-md text-on-surface-variant">${INVOICE_DATE}</p>
            <div style="margin-top:.3rem">${b.paid ? badge('success', 'PAID') : badge('pending', 'UNPAID')}</div>
          </div>
        </div>
        <div class="inv-billto">
          <p class="text-label-caps uppercase text-on-surface-variant mb-1">Bill to</p>
          <p class="text-on-surface" style="font-weight:600">${esc(g.name)}</p>
          <p class="text-body-md text-on-surface-variant">${esc(g.phone || '')}</p>
        </div>
        <table class="inv-table">
          <thead><tr><th>Description</th><th>Nights</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>
            <tr><td>${esc(r.name)} <span class="mono">(${r.id})</span><br><span class="text-body-md text-on-surface-variant">${b.checkIn || ''} → ${b.checkOut || ''}</span></td>
              <td class="mono">${nights}</td><td class="mono">${money(nightly)}</td><td class="mono">${money(gross)}</td></tr>
          </tbody>
        </table>
        <div class="inv-totals">
          <div><span>Subtotal (excl. VAT)</span><span class="mono">${money(net)}</span></div>
          <div><span>VAT @ 16%</span><span class="mono">${money(vat)}</span></div>
          <div class="inv-grand"><span>Total (VAT incl.)</span><span class="mono">${money(gross)}</span></div>
          <div><span>Paid${b.paid ? ' · M-Pesa' : ''}</span><span class="mono">${money(b.paid ? gross : 0)}</span></div>
          <div><span>Balance due</span><span class="mono">${money(b.paid ? 0 : gross)}</span></div>
        </div>
        <p class="text-body-md text-on-surface-variant" style="text-align:center;margin-top:1.2rem">Thank you for staying with Fammy Comforts. Prices are VAT inclusive at 16%. This is a KRA tax invoice.</p>
      </div>
      <div class="rpanel-foot no-print" style="display:flex;gap:.6rem">
        <button class="btn btn-ghost" id="inv-send" style="flex:1">${icon('send')} Send to guest</button>
        <button class="btn btn-primary" id="inv-print" style="flex:1">${icon('print')} Print / Save PDF</button>
      </div>`);
    $('#inv-send').onclick = () => C.toast('Invoice ' + (b.code || '') + ' sent via SMS & email', 'success', 'send');
    $('#inv-print').onclick = () => window.print();
  }

  /* ---------------- Booking calendar helpers ---------------- */
  const CAL_START = '2026-06-08';
  const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const calDates = (days) => { const out = []; const base = new Date(CAL_START + 'T00:00:00'); for (let i = 0; i < days; i++) { const d = new Date(base); d.setDate(base.getDate() + i); out.push(d); } return out; };
  const addDays = (str, n) => { const d = new Date(str + 'T00:00:00'); d.setDate(d.getDate() + n); return isoDate(d); };
  // overlap if newIn < existingOut AND newOut > existingIn (checkout day is free)
  const hasConflict = (roomId, inStr, outStr, ignoreCode) =>
    D.BOOKINGS.some((b) => b.room === roomId && b.status !== 'cancelled' && b.code !== ignoreCode && inStr < b.checkOut && outStr > b.checkIn);

  function quickBooking(roomId, dateStr) {
    const r = D.ROOMS.find((x) => x.id === roomId);
    if (!r) return;
    C.modal(`
      <div class="modal-head"><span class="badge b-success">${icon('event_available')} New booking</span><h3 class="font-display text-headline-sm mono">${r.id}</h3><button data-close class="icon-btn ml-auto">${icon('close')}</button></div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:.9rem">
        <p class="text-on-surface">${esc(r.name)} · <span class="mono text-primary">${money(r.price)}</span>/night</p>
        <div class="field"><label>Guest</label><select id="qb-guest" class="input">${D.GUESTS.map((g) => `<option value="${g.id}">${esc(g.name)} · ${esc(g.phone)}</option>`).join('')}</select></div>
        <div class="grid grid-2" style="gap:.7rem">
          <div class="field"><label>Check-in</label><input id="qb-in" type="date" class="input" value="${dateStr}"/></div>
          <div class="field"><label>Nights</label><input id="qb-nights" type="number" min="1" class="input" value="1"/></div>
        </div>
        <div id="qb-warn"></div>
      </div>
      <div class="rpanel-foot" style="display:flex;gap:.6rem">
        <button class="btn btn-ghost" data-close style="flex:1">Cancel</button>
        <button class="btn btn-primary" id="qb-save" style="flex:1">${icon('check')} Create booking</button>
      </div>`);
    $('#qb-save').onclick = () => {
      const inStr = $('#qb-in').value;
      const nights = Math.max(1, +$('#qb-nights').value || 1);
      const outStr = addDays(inStr, nights);
      if (hasConflict(roomId, inStr, outStr)) {
        $('#qb-warn').innerHTML = `<div class="card card-pad-sm" style="border-color:rgba(244,63,94,.4);background:rgba(244,63,94,.08);color:#fb7185">${icon('block', 'align-middle')} Double-booking blocked — ${r.id} is already reserved in that range.</div>`;
        C.toast('Double-booking prevented', 'error', 'block');
        return;
      }
      const code = 'BK-' + (7847 + D.BOOKINGS.length + 1);
      const g = D.GUESTS.find((x) => x.id === $('#qb-guest').value);
      D.BOOKINGS.push({ code, guest: g.id, room: roomId, status: 'confirmed', checkIn: inStr, checkOut: outStr, nights, guests: 1, amount: r.price * nights, paid: false, channel: 'Front Desk', eta: '—' });
      C.closeModal();
      C.toast(code + ' created for ' + g.name, 'success', 'event_available');
      render();
    };
  }

  /* ---------------- Check-in / check-out workflow ---------------- */
  const nowTime = () => new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false });
  function logActivity(ic, tone, text) { D.ACTIVITY.unshift({ icon: ic, tone, text, time: nowTime() }); if (D.ACTIVITY.length > 20) D.ACTIVITY.pop(); }

  function openCheckIn(code) {
    const b = D.BOOKINGS.find((x) => x.code === code);
    if (!b) return;
    const g = D.GUESTS.find((x) => x.id === b.guest) || { name: 'Guest', avatar: 'G' };
    const r = D.ROOMS.find((x) => x.id === b.room) || { name: b.room, id: b.room };
    C.modal(`
      <div class="modal-head"><span class="badge b-success">${icon('login')} Check-in</span><h3 class="font-display text-headline-sm mono">${b.code}</h3><button data-close class="icon-btn ml-auto">${icon('close')}</button></div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:1rem">
        <div class="list-row" style="padding:0">${avatar(g.avatar, g.vip ? 'avatar-accent' : 'avatar-primary')}<div style="flex:1"><p class="text-on-surface" style="font-weight:600">${esc(g.name)} ${g.vip ? badge('vip', 'VIP') : ''}</p><p class="text-body-md text-on-surface-variant">${esc(g.phone || '')}${g.idNumber ? ' · ID ' + esc(g.idNumber) : ''}</p></div></div>
        <div class="card card-pad-sm">
          <div class="flex items-center justify-between"><span class="text-on-surface-variant text-body-md">Room</span><span class="text-on-surface mono">${r.id} · ${esc(r.name)}</span></div>
          <div class="flex items-center justify-between" style="margin-top:.4rem"><span class="text-on-surface-variant text-body-md">Stay</span><span class="text-on-surface">${b.checkIn} → ${b.checkOut} · ${b.nights || nightsBetween(b.checkIn, b.checkOut)} nights</span></div>
          <div class="flex items-center justify-between" style="margin-top:.4rem"><span class="text-on-surface-variant text-body-md">Payment</span>${b.paid ? badge('success', 'Paid') : badge('pending', 'Unpaid')}</div>
        </div>
        ${!b.paid ? `<div class="card card-pad-sm" style="background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.3)">${icon('info', 'text-warning align-middle')} <span class="text-body-md text-on-surface">Balance outstanding — collect ${money(b.amount)} or mark paid on check-in.</span></div>` : ''}
        <label class="list-row" style="cursor:pointer;padding:.2rem"><input type="checkbox" ${b.paid ? 'checked disabled' : ''} id="ci-paid"/><span class="text-on-surface" style="margin-left:.5rem">Payment received</span></label>
        <p class="text-body-md text-on-surface-variant">${icon('meeting_room', 'align-middle text-[16px]')} ${r.id} will be marked <b class="text-on-surface">Occupied</b>.</p>
      </div>
      <div class="rpanel-foot" style="display:flex;gap:.6rem">
        <button class="btn btn-ghost" data-close style="flex:1">Cancel</button>
        <button class="btn btn-primary" id="ci-confirm" style="flex:1">${icon('login')} Confirm check-in</button>
      </div>`);
    $('#ci-confirm').onclick = () => {
      if ($('#ci-paid') && $('#ci-paid').checked) b.paid = true;
      b.status = 'checked-in';
      b.eta = '—';
      const room = D.ROOMS.find((x) => x.id === b.room);
      if (room) room.status = 'occupied';
      logActivity('login', 'success', `Checked in ${g.name} to ${r.name} (${r.id})`);
      C.closeModal();
      C.toast(g.name + ' checked in · ' + r.id + ' now Occupied', 'success', 'login');
      render();
    };
  }

  function openCheckOut(code) {
    const b = D.BOOKINGS.find((x) => x.code === code);
    if (!b) return;
    const g = D.GUESTS.find((x) => x.id === b.guest) || { name: 'Guest', avatar: 'G' };
    const r = D.ROOMS.find((x) => x.id === b.room) || { name: b.room, id: b.room };
    C.modal(`
      <div class="modal-head"><span class="badge b-warning">${icon('logout')} Check-out</span><h3 class="font-display text-headline-sm mono">${b.code}</h3><button data-close class="icon-btn ml-auto">${icon('close')}</button></div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:1rem">
        <div class="list-row" style="padding:0">${avatar(g.avatar, g.vip ? 'avatar-accent' : 'avatar-primary')}<div style="flex:1"><p class="text-on-surface" style="font-weight:600">${esc(g.name)}</p><p class="text-body-md text-on-surface-variant mono">${r.id} · ${esc(r.name)}</p></div></div>
        <div class="card card-pad-sm">
          <div class="flex items-center justify-between"><span class="text-on-surface-variant text-body-md">Folio total</span><span class="mono text-headline-sm text-primary">${money(b.amount)}</span></div>
          <div class="flex items-center justify-between" style="margin-top:.4rem"><span class="text-on-surface-variant text-body-md">Balance</span><span class="mono ${b.paid ? 'text-on-surface-variant' : ''}">${money(b.paid ? 0 : b.amount)}</span></div>
        </div>
        <p class="text-body-md text-on-surface-variant">${icon('cleaning_services', 'align-middle text-[16px]')} ${r.id} will move to <b class="text-on-surface">Cleaning</b> and a housekeeping task is created. A tax invoice is generated.</p>
      </div>
      <div class="rpanel-foot" style="display:flex;gap:.6rem">
        <button class="btn btn-ghost" data-close style="flex:1">Cancel</button>
        <button class="btn btn-primary" id="co-confirm" style="flex:1">${icon('logout')} Check-out &amp; invoice</button>
      </div>`);
    $('#co-confirm').onclick = () => {
      b.status = 'checked-out';
      b.paid = true;
      const room = D.ROOMS.find((x) => x.id === b.room);
      if (room) room.status = 'cleaning';
      // create a turnover housekeeping task
      const tid = 'TK-' + (10 + state.tasks.length + 1);
      state.tasks.unshift({ id: tid, room: b.room, type: 'Cleaning', priority: 'high', status: 'pending', assignee: 'ST-02', due: nowTime(), note: 'Post-checkout turnover' });
      persist();
      logActivity('logout', 'warning', `Checked out ${g.name} from ${r.id} — turnover scheduled`);
      C.closeModal();
      C.toast(g.name + ' checked out · ' + r.id + ' → Cleaning', 'success', 'logout');
      render();
      openInvoice(b);
    };
  }

  /* ---------------- Add / edit room (with photo) ---------------- */
  function openRoomEdit(id) {
    const editing = !!id;
    const r = editing
      ? D.ROOMS.find((x) => x.id === id)
      : { id: '', name: '', type: 'Standard', capacity: 2, price: 4000, status: 'available', floor: 1, amenities: ['Wi-Fi'], rating: 4.6, reviews: 0, image: D.IMG.lounge1, vip: false };
    if (editing && !r) return;
    let imgSrc = r.image || D.IMG.lounge1;
    const types = ['Standard', 'Deluxe', 'Executive', 'Penthouse'];
    const statuses = ['available', 'occupied', 'cleaning', 'reserved', 'maintenance'];
    C.modal(`
      <div class="modal-head"><span class="badge b-info">${icon(editing ? 'edit' : 'add_home')} ${editing ? 'Edit room' : 'Add room'}</span><h3 class="font-display text-headline-sm mono">${editing ? r.id : 'New room'}</h3><button data-close class="icon-btn ml-auto">${icon('close')}</button></div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:.9rem">
        <div class="re-photo"><img id="re-img" src="${imgSrc}" onerror="this.style.opacity=.2"/>
          <label class="btn re-upload">${icon('photo_camera')} Change photo<input id="re-file" type="file" accept="image/*"/></label></div>
        <div class="field"><label>Image URL (or upload above)</label><input id="re-url" class="input" value="${esc(r.image || '')}" placeholder="https://…"/></div>
        <div class="grid grid-2" style="gap:.7rem">
          <div class="field"><label>Room ID</label><input id="re-id" class="input mono" value="${esc(r.id)}" ${editing ? 'readonly style="opacity:.65"' : ''} placeholder="SC-401"/></div>
          <div class="field"><label>Type</label><select id="re-type" class="input">${types.map((t) => `<option ${t === r.type ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>Room name</label><input id="re-name" class="input" value="${esc(r.name)}" placeholder="e.g. Savannah Executive Suite"/></div>
        <div class="grid grid-2" style="gap:.7rem">
          <div class="field"><label>Price / night (KES)</label><input id="re-price" type="number" min="0" class="input" value="${r.price}"/></div>
          <div class="field"><label>Capacity</label><input id="re-cap" type="number" min="1" class="input" value="${r.capacity}"/></div>
        </div>
        <div class="grid grid-2" style="gap:.7rem">
          <div class="field"><label>Floor</label><input id="re-floor" type="number" min="1" class="input" value="${r.floor}"/></div>
          <div class="field"><label>Status</label><select id="re-status" class="input">${statuses.map((s) => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${C.titleCase(s)}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>Amenities (comma separated)</label><input id="re-amen" class="input" value="${esc((r.amenities || []).join(', '))}" placeholder="Wi-Fi, AC, Smart TV"/></div>
        <label class="list-row" style="cursor:pointer;padding:.2rem"><span class="text-on-surface" style="flex:1">VIP / premium room</span><span class="switch ${r.vip ? 'on' : ''}" id="re-vip"><span class="knob"></span></span></label>
      </div>
      <div class="rpanel-foot" style="display:flex;gap:.6rem">
        ${editing ? `<button class="btn btn-ghost" id="re-del" style="flex:none;border-color:rgba(244,63,94,.4);color:#fb7185" title="Delete room">${icon('delete')}</button>` : ''}
        <button class="btn btn-ghost" data-close style="flex:1">Cancel</button>
        <button class="btn btn-primary" id="re-save" style="flex:1">${icon('save')} ${editing ? 'Save room' : 'Add room'}</button>
      </div>`);
    $('#re-file').onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { imgSrc = rd.result; $('#re-img').src = imgSrc; $('#re-url').value = ''; };
      rd.readAsDataURL(f);
    };
    $('#re-url').oninput = (e) => { const v = e.target.value.trim(); if (v) { imgSrc = v; $('#re-img').src = v; } };
    const vip = $('#re-vip');
    vip.onclick = () => vip.classList.toggle('on');
    if (editing) $('#re-del').onclick = () => {
      const i = D.ROOMS.findIndex((x) => x.id === r.id);
      if (i > -1) D.ROOMS.splice(i, 1);
      C.closeModal();
      C.toast('Room ' + r.id + ' removed', 'info', 'delete');
      render();
    };
    $('#re-save').onclick = () => {
      const name = ($('#re-name').value || '').trim();
      const idVal = editing ? r.id : ($('#re-id').value || '').trim().toUpperCase();
      if (!editing && !idVal) return C.toast('Enter a room ID', 'error');
      if (!editing && D.ROOMS.some((x) => x.id === idVal)) return C.toast('Room ID already exists', 'error');
      if (!name) return C.toast('Enter a room name', 'error');
      const data = {
        id: idVal, name,
        type: $('#re-type').value,
        price: +$('#re-price').value || 0,
        capacity: +$('#re-cap').value || 1,
        floor: +$('#re-floor').value || 1,
        status: $('#re-status').value,
        amenities: ($('#re-amen').value || '').split(',').map((s) => s.trim()).filter(Boolean),
        vip: $('#re-vip').classList.contains('on'),
        image: imgSrc
      };
      if (editing) Object.assign(r, data);
      else D.ROOMS.push({ ...data, rating: 4.6, reviews: 0 });
      C.closeModal();
      C.toast((editing ? 'Room updated · ' : 'Room added · ') + idVal, 'success', 'meeting_room');
      render();
    };
  }

  /* ---------------- Cancellation & refund ---------------- */
  function openCancel(b) {
    if (!b) return;
    const g = D.GUESTS.find((x) => x.id === b.guest) || { name: 'Guest' };
    const room = D.ROOMS.find((x) => x.id === b.room) || { name: b.room };
    const refund = b.paid ? b.amount : 0;
    C.modal(`
      <div class="modal-head"><span class="badge b-danger">${icon('cancel')} Cancel booking</span><h3 class="font-display text-headline-sm mono">${b.code}</h3><button data-close class="icon-btn ml-auto">${icon('close')}</button></div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:1rem">
        <div class="card card-pad-sm"><p class="text-on-surface" style="font-weight:600">${esc(room.name)}</p><p class="text-body-md text-on-surface-variant">${esc(g.name)} · ${b.checkIn} → ${b.checkOut}</p></div>
        <div class="field"><label>Reason</label><select id="cx-reason" class="input"><option>Guest request</option><option>No-show</option><option>Overbooking</option><option>Payment failed</option><option>Other</option></select></div>
        <div class="card card-pad-sm" style="background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.3)">
          <p class="text-body-md text-on-surface">${icon('info', 'text-warning align-middle')} Free cancellation up to 24 hrs before check-in.</p>
          <div class="flex items-center justify-between mt-2"><span class="text-on-surface-variant">Refund due</span><span class="mono text-headline-sm text-primary">${money(refund)}</span></div>
        </div>
      </div>
      <div class="rpanel-foot" style="display:flex;gap:.6rem">
        <button class="btn btn-ghost" data-close style="flex:1">Keep booking</button>
        <button class="btn" id="cx-confirm" style="flex:1;background:var(--danger);color:#fff">${icon('cancel')} Confirm cancel</button>
      </div>`);
    $('#cx-confirm').onclick = () => {
      b.status = 'cancelled';
      b.refund = refund;
      C.closeModal();
      C.toast(refund ? ('Cancelled · refund ' + money(refund) + ' initiated') : 'Booking cancelled', refund ? 'success' : 'info', 'cancel');
      render();
    };
  }

  /* ---------------- Notifications panel ---------------- */
  function openNotifications() {
    C.modal(`
      <div class="modal-head">${icon('notifications', 'text-primary')}<h3 class="font-display text-headline-sm">Notifications</h3>
        <button data-close class="icon-btn ml-auto">${icon('close')}</button></div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:.6rem">
        ${D.NOTIFICATIONS.map(
          (n) => `<div class="list-row" style="align-items:flex-start;background:${n.read ? 'transparent' : 'rgba(20,184,166,0.06)'}">
            <div class="avatar ${n.channel === 'SMS' ? 'avatar-primary' : n.channel === 'Push' ? 'avatar-accent' : ''}">${icon(n.channel === 'SMS' ? 'sms' : n.channel === 'Push' ? 'notifications_active' : 'mail')}</div>
            <div style="flex:1"><div class="flex items-center justify-between"><p class="text-on-surface" style="font-weight:600">${esc(n.title)}</p><span class="text-body-md text-on-surface-variant">${n.time}</span></div>
            <p class="text-body-md text-on-surface-variant">To ${esc(n.to)} · ${n.channel}</p>
            <p class="text-body-md text-on-surface mt-1">${esc(n.body)}</p></div>
          </div>`
        ).join('')}
      </div>`);
    $('#notif-badge').classList.add('hide');
  }

  /* ---------------- Shared view fragments ---------------- */
  const FEED_TONE = {
    success: 'background:rgba(20,184,166,0.16);color:#2dd4bf',
    accent: 'background:rgba(234,179,8,0.16);color:#facc15',
    info: 'background:rgba(56,189,248,0.16);color:#7dd3fc',
    warning: 'background:rgba(245,158,11,0.18);color:#fbbf24',
    danger: 'background:rgba(244,63,94,0.16);color:#fb7185'
  };
  const activityFeed = (limit = 6) => `
    <div class="card">
      <div class="section-head"><h2 class="font-display text-headline-sm">${icon('bolt', 'text-primary align-middle')} Live activity</h2><span class="badge b-success"><span class="pulse-live">●</span> Live</span></div>
      ${D.ACTIVITY.slice(0, limit).map((a) => `<div class="feed-item"><div class="feed-dot" style="${FEED_TONE[a.tone] || FEED_TONE.info}">${icon(a.icon)}</div><div style="flex:1;min-width:0"><p class="text-body-md text-on-surface">${esc(a.text)}</p><p class="text-body-md text-on-surface-variant mono">${a.time}</p></div></div>`).join('')}
    </div>`;
  const quickActions = (items) => `
    <div class="qa-grid">${items.map((a) => `<div class="card card-hover qa" onclick="${a.onclick}"><div class="qa-ic" style="${FEED_TONE[a.tone] || FEED_TONE.info}">${icon(a.icon)}</div><span class="text-on-surface" style="font-weight:600;font-size:14px">${a.label}</span></div>`).join('')}</div>`;

  /* ============================================================
     VIEWS
     ============================================================ */
  const V = {};

  /* ---------- CUSTOMER ---------- */
  V.home = () => {
    const me = D.GUESTS[0];
    const featured = D.ROOMS.filter((r) => r.status === 'available').slice(0, 6);
    const active = D.BOOKINGS.find((b) => b.guest === me.id && b.status === 'confirmed');
    const room = D.ROOMS.find((r) => r.id === active.room);
    return `
    <section class="fade-in">
      ${pageHero('Karibu · ' + me.tier + ' member', 'Good afternoon, ' + me.name.split(' ')[0] + '.', 'Find a lounge that feels like home.')}
      <button id="home-search" class="card card-hover" style="display:flex;align-items:center;gap:.8rem;width:100%;text-align:left;cursor:pointer;padding:1rem 1.2rem;margin-bottom:1.5rem">
        ${icon('search', 'text-on-surface-variant')}<span class="text-on-surface-variant">Search lounges, dates, guests…</span>
      </button>

      <div class="card" style="background:linear-gradient(120deg,#0d9488,#0b1326 70%);border-color:rgba(20,184,166,.25);margin-bottom:1.5rem;position:relative;overflow:hidden">
        <div style="position:absolute;right:-30px;top:-30px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(20,184,166,.25),transparent 70%)"></div>
        <span class="badge b-confirmed">${icon('bolt')} Active reservation</span>
        <h3 class="font-display text-headline-md text-on-surface mt-3">${esc(room.name)}</h3>
        <p class="text-body-md text-on-surface-variant mt-1 mono">${active.code} · Check-in ${active.checkIn} · ${active.eta}</p>
        <div class="flex items-center gap-3 mt-4">
          <button class="btn btn-primary" onclick="location.hash='#/checkin'">${icon('qr_code_2')} View QR</button>
          <button class="btn btn-ghost" onclick="location.hash='#/reservations'">Manage</button>
        </div>
      </div>

      ${sectionHead('Featured lounges', 'Handpicked for you', `<button class="btn btn-ghost" onclick="location.hash='#/search'" style="padding:.4rem .8rem">View all</button>`)}
      <div class="grid grid-3 stagger">${featured.map((r) => roomCard(r, `<button class="btn btn-primary book-room" data-room="${r.id}" style="padding:.5rem .9rem">Book</button>`)).join('')}</div>

      <div class="card card-hover mt-6" style="display:flex;align-items:center;gap:1rem;background:linear-gradient(135deg,rgba(234,179,8,.1),transparent)" onclick="location.hash='#/loyalty'">
        <div class="avatar avatar-accent">${icon('loyalty')}</div>
        <div style="flex:1"><p class="text-on-surface" style="font-weight:600">${state.points.toLocaleString()} reward points</p><p class="text-body-md text-on-surface-variant">You're 180 points from a free night.</p></div>
        ${icon('chevron_right', 'text-on-surface-variant')}
      </div>
      ${credit}
    </section>`;
  };
  V.home.wire = () => {
    $('#home-search').onclick = openSearch;
    $$('.book-room').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); openBooking(b.dataset.room); }));
    $$('[data-room]').forEach((c) => (c.onclick = () => openRoomDetail(c.dataset.room)));
  };

  V.search = () => {
    return `
    <section class="fade-in">
      ${pageHero('Find a lounge', 'Book your stay', null)}
      <div class="card" style="margin-bottom:1.5rem">
        <div class="grid grid-3" style="gap:.8rem">
          <div class="field"><label>Check-in</label><input type="date" class="input" value="2026-06-09"/></div>
          <div class="field"><label>Check-out</label><input type="date" class="input" value="2026-06-11"/></div>
          <div class="field"><label>Guests</label><select class="input"><option>1 guest</option><option>2 guests</option><option>3 guests</option><option>4 guests</option></select></div>
        </div>
      </div>
      <div style="display:flex;gap:.5rem;overflow-x:auto;padding-bottom:.5rem;margin-bottom:1rem" class="hide-scroll" id="type-chips">
        ${['All', 'Standard', 'Deluxe', 'Executive', 'Penthouse'].map((t, i) => `<button class="btn ${i === 0 ? 'btn-primary' : 'btn-ghost'} type-chip" data-type="${t}" style="padding:.45rem .9rem;white-space:nowrap">${t}</button>`).join('')}
      </div>
      <div id="room-grid" class="grid grid-3 stagger"></div>
    </section>`;
  };
  V.search.wire = () => {
    let type = 'All';
    const render = () => {
      const list = type === 'All' ? D.ROOMS : D.ROOMS.filter((r) => r.type === type);
      $('#room-grid').innerHTML = list.map((r) => roomCard(r, `<button class="btn btn-primary book-room" data-room="${r.id}" style="padding:.5rem .9rem">Book</button>`)).join('');
      $$('.book-room').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); openBooking(b.dataset.room); }));
      $$('[data-room]').forEach((c) => (c.onclick = () => openRoomDetail(c.dataset.room)));
    };
    $$('.type-chip').forEach((c) => (c.onclick = () => {
      type = c.dataset.type;
      $$('.type-chip').forEach((x) => x.className = `btn ${x === c ? 'btn-primary' : 'btn-ghost'} type-chip`);
      render();
    }));
    render();
  };

  const nightsBetween = (a, b) => { const d1 = new Date(a + 'T00:00:00'), d2 = new Date(b + 'T00:00:00'); return Math.max(1, Math.round((d2 - d1) / 86400000)); };

  function openBooking(roomId) {
    const r = D.ROOMS.find((x) => x.id === roomId);
    const me = D.GUESTS[0];
    // captured client KYC for this booking
    const form = {
      name: me ? me.name : '',
      idNo: '',
      idPhoto: '',
      phone: state.auth && state.auth.method === 'phone' ? state.auth.identity : (me ? me.phone : ''),
      checkIn: '2026-06-09',
      checkOut: '2026-06-11'
    };
    let nights = nightsBetween(form.checkIn, form.checkOut);
    let total = r.price * nights;
    let created = null;
    C.modal(`
      <div class="room-media" style="aspect-ratio:16/9;border-radius:18px 18px 0 0;overflow:hidden;position:relative">
        <img src="${r.image}" style="width:100%;height:100%;object-fit:cover"/>
        <button data-close class="icon-btn" style="position:absolute;top:.6rem;right:.6rem;background:rgba(0,0,0,.4);color:#fff">${icon('close')}</button>
        <div style="position:absolute;bottom:.7rem;left:.9rem;display:flex;gap:.4rem">${r.vip ? badge('vip', 'VIP') : ''}<span class="badge" style="background:rgba(0,0,0,.45);color:#fff" class="mono">${r.id}</span></div>
      </div>
      <div class="modal-body">
        <div class="stepper" style="margin-bottom:1.4rem">
          ${['Details', 'Pay', 'Confirmed'].map((s, i) => `<div class="step ${i === 0 ? 'current' : ''}" data-step="${i}"><div class="dot">${i + 1}</div><span class="lbl">${s}</span></div>`).join('')}
        </div>
        <div id="book-body"></div>
      </div>`);
    const body = $('#book-body');
    const setStep = (n) => $$('#modal .step').forEach((s, i) => { s.classList.toggle('done', i < n); s.classList.toggle('current', i === n); });

    const step1 = () => {
      setStep(0);
      body.innerHTML = `
        <span class="mono text-body-md text-on-surface-variant">${r.id} · Room ${r.id.replace('SC-', '')}</span>
        <h3 class="font-display text-headline-md text-on-surface">${esc(r.name)}</h3>
        <p class="text-body-md text-on-surface-variant mb-3">${r.type} · up to ${r.capacity} guests · ${icon('star', 'text-[14px] text-warning align-middle')} ${r.rating}</p>
        <div class="grid grid-2" style="gap:.8rem;margin-bottom:1rem">
          <div class="field"><label>Check-in</label><input id="bk-in" type="date" class="input" value="${form.checkIn}"/></div>
          <div class="field"><label>Check-out</label><input id="bk-out" type="date" class="input" value="${form.checkOut}"/></div>
        </div>

        <p class="text-label-caps uppercase text-on-surface-variant mb-2">Guest details</p>
        <div style="display:flex;flex-direction:column;gap:.8rem;margin-bottom:1rem">
          <div class="field"><label>Full name (as on ID)</label><div class="input-icon">${icon('person')}<input id="bk-name" class="input" value="${esc(form.name)}" placeholder="e.g. Jane Muthoni"/></div></div>
          <div class="field"><label>ID / Passport number</label><div class="input-icon">${icon('badge')}<input id="bk-idno" class="input" value="${esc(form.idNo)}" placeholder="e.g. 12345678"/></div></div>
          <div class="field"><label>ID photo</label>
            <div class="id-up">
              <img id="bk-idimg" class="id-thumb ${form.idPhoto ? '' : 'hide'}" src="${form.idPhoto || ''}"/>
              <label class="btn btn-ghost" style="flex:1">${icon('photo_camera')} <span id="bk-idlabel">${form.idPhoto ? 'Change ID photo' : 'Upload ID photo'}</span><input id="bk-idfile" type="file" accept="image/*" style="display:none"/></label>
            </div>
          </div>
          <div class="field"><label>M-Pesa phone (for payment prompt)</label><div class="input-icon">${icon('smartphone')}<input id="bk-phone" class="input" inputmode="tel" value="${esc(form.phone)}" placeholder="+254 7XX XXX XXX"/></div></div>
        </div>

        <div class="card card-pad-sm" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <span class="text-on-surface-variant">${money(r.price)} × <span id="bk-nlbl">${nights}</span> nights</span><span class="mono text-headline-sm text-primary" id="bk-total">${money(total)}</span>
        </div>
        <button class="btn btn-primary btn-block" id="to-pay">Continue to payment ${icon('arrow_forward')}</button>`;
      const recalc = () => {
        form.checkIn = $('#bk-in').value; form.checkOut = $('#bk-out').value;
        nights = nightsBetween(form.checkIn, form.checkOut); total = r.price * nights;
        $('#bk-nlbl').textContent = nights; $('#bk-total').textContent = money(total);
      };
      $('#bk-in').onchange = recalc; $('#bk-out').onchange = recalc;
      $('#bk-idfile').onchange = (e) => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => { form.idPhoto = rd.result; $('#bk-idimg').src = rd.result; $('#bk-idimg').classList.remove('hide'); $('#bk-idlabel').textContent = 'Change ID photo'; };
        rd.readAsDataURL(f);
      };
      $('#to-pay').onclick = () => {
        form.name = ($('#bk-name').value || '').trim();
        form.idNo = ($('#bk-idno').value || '').trim();
        form.phone = ($('#bk-phone').value || '').trim();
        if (!form.name) return C.toast('Enter the guest full name', 'error');
        if (!form.idNo) return C.toast('Enter the ID / passport number', 'error');
        if (form.phone.replace(/\D/g, '').length < 9) return C.toast('Enter a valid M-Pesa phone number', 'error');
        recalc();
        step2();
      };
    };

    const step2 = () => {
      setStep(1);
      body.innerHTML = `
        <p class="text-label-caps uppercase text-on-surface-variant mb-2">Pay ${money(total)}</p>
        <div class="card card-pad-sm" style="border-color:rgba(20,184,166,.4);background:rgba(20,184,166,.06);display:flex;align-items:center;gap:.8rem;margin-bottom:1rem">
          <div class="avatar avatar-primary" style="font-weight:800">M</div>
          <div style="flex:1"><p class="text-on-surface" style="font-weight:700;letter-spacing:.04em">M-PESA</p><p class="text-body-md text-primary">STK push to ${esc(form.phone)}</p></div>${icon('verified', 'text-primary')}
        </div>
        <div class="card card-pad-sm" style="margin-bottom:1rem">
          <div class="flex items-center justify-between"><span class="text-on-surface-variant text-body-md">Guest</span><span class="text-on-surface">${esc(form.name)}</span></div>
          <div class="flex items-center justify-between" style="margin-top:.4rem"><span class="text-on-surface-variant text-body-md">Room</span><span class="text-on-surface mono">${r.id} · ${esc(r.name)}</span></div>
          <div class="flex items-center justify-between" style="margin-top:.4rem"><span class="text-on-surface-variant text-body-md">Amount</span><span class="text-primary mono" style="font-weight:600">${money(total)}</span></div>
        </div>
        <div class="field" style="margin-bottom:1rem"><label>M-Pesa phone number</label>
          <div class="input-icon">${icon('smartphone')}<input id="bk-pay-phone" class="input" value="${esc(form.phone)}"/></div></div>
        <div style="display:flex;gap:.6rem">
          <button class="btn btn-ghost" id="bk-back" style="flex:none">${icon('arrow_back')}</button>
          <button class="btn btn-primary" id="pay-now" style="flex:1">${icon('lock')} Send STK push</button>
        </div>`;
      $('#bk-back').onclick = step1;
      $('#pay-now').onclick = () => {
        form.phone = ($('#bk-pay-phone').value || '').trim();
        C.toast('STK push sent to ' + form.phone + ' — confirm on phone', 'info', 'smartphone');
        $('#pay-now').innerHTML = `<span class="spinner" style="width:20px;height:20px;border-width:3px"></span> Waiting for confirmation…`;
        $('#pay-now').disabled = true;
        setTimeout(step3, 1100);
      };
    };

    const step3 = () => {
      setStep(2);
      state.points += 120; persist();
      // create the client + booking records so reception/admin see them
      const initials = form.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'GG';
      const gid = 'G-' + (1000 + D.GUESTS.length + 1);
      D.GUESTS.push({ id: gid, name: form.name, phone: form.phone, email: '', tier: 'Bronze', points: 120, stays: 1, vip: false, avatar: initials, idNumber: form.idNo, idPhoto: form.idPhoto });
      const code = 'BK-' + (7847 + D.BOOKINGS.length + 1);
      created = { code, guest: gid, room: r.id, status: 'confirmed', checkIn: form.checkIn, checkOut: form.checkOut, nights, guests: 1, amount: total, paid: true, channel: 'App', eta: '14:00' };
      D.BOOKINGS.push(created);
      body.innerHTML = `
        <div style="text-align:center;padding:.5rem 0 0">
          <img src="QR_sommycomfort.co.ke.png" alt="Fammy Comforts booking QR code" class="qr-img"/>
          <h3 class="font-display text-headline-md text-on-surface mt-4">Booking confirmed!</h3>
          <p class="text-body-md text-on-surface-variant">${esc(form.name)} · ${r.id} · ${money(total)} paid</p>
          <p class="text-body-md text-primary mt-1">+120 reward points earned</p>
          <div class="card card-pad-sm mt-3" style="text-align:left">
            <p class="sms-sender">FAMMY</p>
            <p class="text-body-md text-on-surface">Hi ${esc(form.name.split(' ')[0])}, booking ${code} for ${esc(r.name)} (${r.id}) is CONFIRMED. Check-in ${form.checkIn}. Total ${money(total)}. Karibu!</p>
          </div>
          <div style="display:flex;gap:.6rem;margin-top:.8rem">
            <button class="btn btn-ghost" id="bk-invoice" style="flex:1">${icon('receipt_long')} Receipt</button>
            <button class="btn btn-primary" data-close style="flex:1">Done</button>
          </div>
        </div>`;
      $$('[data-close]', $('#modal')).forEach((b) => (b.onclick = () => { C.closeModal(); render(); }));
      $('#bk-invoice').onclick = () => openInvoice(created);
    };

    step1();
  }

  V.reservations = () => {
    const me = D.GUESTS[0];
    const mine = D.BOOKINGS.filter((b) => b.guest === me.id || ['BK-7842', 'BK-7846'].includes(b.code));
    return `
    <section class="fade-in">
      ${pageHero('My trips', 'Reservations', 'Upcoming and past stays')}
      <div class="grid grid-2 stagger">
        ${mine.map((b) => {
          const r = D.ROOMS.find((x) => x.id === b.room);
          return `<div class="card card-hover">
            <div class="flex items-center justify-between"><span class="mono text-body-md text-on-surface-variant">${b.code}</span>${badge(b.status)}</div>
            <h3 class="font-display text-headline-sm text-on-surface mt-2">${esc(r.name)}</h3>
            <p class="text-body-md text-on-surface-variant">${b.checkIn} → ${b.checkOut} · ${b.nights} nights · ${b.guests} guests</p>
            <div class="flex items-center justify-between mt-3">
              <span class="mono text-headline-sm text-primary">${money(b.amount)}</span>
              <div style="display:flex;gap:.4rem;flex-wrap:wrap;justify-content:flex-end">
                ${b.paid ? `<button class="btn btn-ghost res-receipt" data-code="${b.code}" style="padding:.4rem .7rem">${icon('receipt_long')} Receipt</button>` : ''}
                ${b.status === 'confirmed' ? `<button class="btn btn-ghost" onclick="location.hash='#/checkin'" style="padding:.4rem .8rem">${icon('qr_code_2')} Check-in</button>` : (!b.paid && b.status !== 'cancelled' ? badge('pending', 'Unpaid') : '')}
                ${['confirmed', 'pending'].includes(b.status) ? `<button class="btn btn-ghost res-cancel" data-code="${b.code}" style="padding:.4rem .7rem;border-color:rgba(244,63,94,.4);color:#fb7185">${icon('close')} Cancel</button>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </section>`;
  };
  V.reservations.wire = () => {
    $$('.res-receipt').forEach((b) => (b.onclick = () => openInvoice(D.BOOKINGS.find((x) => x.code === b.dataset.code))));
    $$('.res-cancel').forEach((b) => (b.onclick = () => openCancel(D.BOOKINGS.find((x) => x.code === b.dataset.code))));
  };

  V.checkin = () => {
    const b = D.BOOKINGS.find((x) => x.code === 'BK-7841');
    const r = D.ROOMS.find((x) => x.id === b.room);
    const steps = ['Booked', 'Arrived', 'Checked-In', 'Enjoy', 'Checkout'];
    return `
    <section class="fade-in" style="max-width:520px;margin:0 auto">
      ${pageHero('Check-in', esc(r.name), b.code + ' · ' + b.checkIn)}
      <div class="card" style="text-align:center">
        <img src="QR_sommycomfort.co.ke.png" alt="Fammy Comforts booking QR code" class="qr-img"/>
        <p class="text-body-md text-on-surface-variant mt-4">Show this code at the front desk</p>
        <p class="mono text-headline-sm text-on-surface mt-1">${b.code}</p>
      </div>
      <div class="card mt-4">
        <p class="text-label-caps uppercase text-on-surface-variant mb-4">Stay progress</p>
        <div class="stepper">
          ${steps.map((s, i) => `<div class="step ${i < 1 ? 'done' : i === 1 ? 'current' : ''}"><div class="dot">${i < 1 ? icon('check', 'text-[16px]') : i + 1}</div><span class="lbl">${s}</span></div>`).join('')}
        </div>
      </div>
      <button class="btn btn-primary btn-block mt-4" id="sim-checkin">${icon('login')} Simulate arrival & check-in</button>
      ${credit}
    </section>`;
  };
  V.checkin.wire = () => {
    $('#sim-checkin').onclick = () => {
      const b = D.BOOKINGS.find((x) => x.code === 'BK-7841');
      if (b && b.status !== 'checked-in') {
        b.status = 'checked-in'; b.eta = '—';
        const room = D.ROOMS.find((r) => r.id === b.room);
        if (room) room.status = 'occupied';
        logActivity('login', 'success', 'Self check-in · ' + ((D.GUESTS.find((g) => g.id === b.guest) || {}).name || 'Guest'));
      }
      C.toast('Checked in to Savannah Executive Suite — enjoy your stay!', 'success', 'login');
    };
  };

  V.loyalty = () => {
    const me = D.GUESTS[0];
    const nextTier = 6000;
    const pct = Math.min(100, Math.round((state.points / nextTier) * 100));
    return `
    <section class="fade-in">
      ${pageHero('Rewards', state.points.toLocaleString() + ' points', me.tier + ' member')}
      <div class="card" style="background:linear-gradient(135deg,rgba(234,179,8,.16),transparent);margin-bottom:1.5rem">
        <div class="flex items-center justify-between mb-2"><span class="text-on-surface">${me.tier}</span><span class="text-on-surface-variant text-body-md">${nextTier - state.points} pts to Diamond</span></div>
        <div class="meter"><span data-w="${pct}" style="width:0;background:var(--accent)"></span></div>
      </div>
      ${sectionHead('Redeem points', 'Treat yourself')}
      <div class="grid grid-3 stagger">
        ${D.REWARDS.map((rw) => `<div class="card card-hover" style="text-align:center">
          <div class="avatar avatar-accent" style="margin:0 auto 0.6rem;width:48px;height:48px">${icon(rw.icon)}</div>
          <p class="text-on-surface" style="font-weight:600">${esc(rw.name)}</p>
          <p class="mono text-primary mt-1">${rw.cost.toLocaleString()} pts</p>
          <button class="btn ${state.points >= rw.cost ? 'btn-primary' : 'btn-ghost'} btn-block mt-3 redeem" data-cost="${rw.cost}" data-name="${esc(rw.name)}" ${state.points < rw.cost ? 'disabled style="opacity:.5"' : ''}>Redeem</button>
        </div>`).join('')}
      </div>
    </section>`;
  };
  V.loyalty.wire = () => {
    $$('.redeem').forEach((b) => (b.onclick = () => {
      const cost = +b.dataset.cost;
      if (state.points < cost) return;
      state.points -= cost; persist();
      C.toast(b.dataset.name + ' redeemed! ' + money(cost).replace('KES', '') + ' pts used', 'success', 'redeem');
      render();
    }));
  };

  V.profile = () => {
    const me = D.GUESTS[0];
    return `
    <section class="fade-in" style="max-width:560px;margin:0 auto">
      ${pageHero('Account', 'Profile', null)}
      <div class="card" style="display:flex;align-items:center;gap:1rem">
        <div class="avatar avatar-primary" style="width:64px;height:64px;font-size:24px">${me.avatar}</div>
        <div style="flex:1"><h3 class="font-display text-headline-sm text-on-surface">${esc(me.name)}</h3>
        <p class="text-body-md text-on-surface-variant">${esc(me.email)}</p><div class="mt-1">${badge('platinum', me.tier + ' · ' + me.stays + ' stays')}</div></div>
      </div>
      <div class="card mt-4 divide-rows" style="padding:0">
        ${[['person', 'Personal details'], ['payments', 'Payment methods'], ['notifications', 'Notification preferences'], ['help', 'Help & support'], ['privacy_tip', 'Privacy & data']].map((x) => `<button class="list-row" style="width:100%;cursor:pointer">${icon(x[0], 'text-on-surface-variant')}<span class="text-on-surface" style="flex:1;text-align:left">${x[1]}</span>${icon('chevron_right', 'text-on-surface-variant')}</button>`).join('')}
      </div>
      <button class="btn btn-ghost btn-block mt-4" data-install-prompt onclick="SC_install()" style="display:flex">${icon('install_mobile')} Install Fammy Comforts app</button>
      ${credit}
    </section>`;
  };

  /* ---------- RECEPTION ---------- */
  V.desk = () => {
    const arrivals = D.BOOKINGS.filter((b) => ['confirmed', 'pending'].includes(b.status));
    const departures = D.BOOKINGS.filter((b) => ['checked-in', 'checkout-due'].includes(b.status));
    const inhouse = D.BOOKINGS.filter((b) => b.status === 'checked-in');
    const row = (b, kind) => {
      const g = D.GUESTS.find((x) => x.id === b.guest);
      const r = D.ROOMS.find((x) => x.id === b.room);
      return `<div class="list-row">
        ${avatar(g.avatar, g.vip ? 'avatar-accent' : '')}
        <div style="flex:1;min-width:0;cursor:pointer" data-guest="${b.guest}"><p class="text-on-surface" style="font-weight:600">${esc(g.name)} ${g.vip ? badge('vip', 'VIP') : ''}</p>
        <p class="text-body-md text-on-surface-variant mono">${b.code} · ${r ? r.id : b.room} · ${kind === 'arr' ? (b.eta !== '—' ? 'ETA ' + b.eta : 'today') : b.checkOut}</p></div>
        ${kind === 'arr'
          ? `<button class="btn btn-primary desk-checkin" data-code="${b.code}" style="padding:.4rem .8rem">${icon('login')} Check-in</button>`
          : `<button class="btn btn-ghost desk-checkout" data-code="${b.code}" style="padding:.4rem .8rem">${icon('logout')} Check-out</button>`}
      </div>`;
    };
    return `
    <section class="fade-in">
      ${pageHero('Front desk · ' + new Date().toLocaleDateString('en-KE', { weekday: 'long', month: 'short', day: 'numeric' }), 'Today at a glance', null)}
      <div class="grid grid-kpi" style="margin-bottom:1.5rem">
        ${kpi({ icon: 'login', label: 'Arrivals', value: arrivals.length, tone: 'primary' })}
        ${kpi({ icon: 'logout', label: 'Departures', value: D.BOOKINGS.filter((b) => b.status === 'checkout-due').length, tone: 'warning' })}
        ${kpi({ icon: 'hotel', label: 'In-house', value: inhouse.length, tone: 'info' })}
        ${kpi({ icon: 'pending_actions', label: 'Pending pay', value: D.BOOKINGS.filter((b) => !b.paid && b.status !== 'cancelled').length, tone: 'danger' })}
      </div>
      <div class="card card-pad-sm" style="display:flex;gap:.5rem;margin-bottom:1.5rem;flex-wrap:wrap">
        <span class="text-label-caps uppercase text-on-surface-variant" style="align-self:center;margin-right:.5rem">Workflow</span>
        ${['Booking', 'Arrival', 'Check-In', 'Occupancy', 'Check-Out'].map((s) => `<span class="badge b-info">${s}</span>`).join(icon('arrow_forward_ios', 'text-[10px] text-on-surface-variant') + ' ')}
      </div>
      <div style="margin-bottom:1.5rem">${quickActions([
        { icon: 'directions_walk', label: 'New walk-in', tone: 'success', onclick: "location.hash='#/walkins'" },
        { icon: 'person_search', label: 'Find guest', tone: 'info', onclick: "location.hash='#/lookup'" },
        { icon: 'meeting_room', label: 'Room board', tone: 'accent', onclick: "location.hash='#/occupancy'" },
        { icon: 'calendar_month', label: 'Calendar', tone: 'warning', onclick: "location.hash='#/calendar'" }
      ])}</div>
      <div class="grid grid-2" style="margin-bottom:1.5rem">
        <div class="card"><div class="section-head"><h2 class="font-display text-headline-sm">${icon('login', 'text-primary align-middle')} Arrivals</h2></div><div class="divide-rows">${arrivals.map((b) => row(b, 'arr')).join('') || '<p class="text-body-md text-on-surface-variant" style="padding:1rem">No arrivals pending.</p>'}</div></div>
        <div class="card"><div class="section-head"><h2 class="font-display text-headline-sm">${icon('logout', 'text-warning align-middle')} In-house &amp; checkouts</h2></div><div class="divide-rows">${departures.map((b) => row(b, 'dep')).join('') || '<p class="text-body-md text-on-surface-variant" style="padding:1rem">Nobody in-house.</p>'}</div></div>
      </div>
      ${activityFeed(6)}
    </section>`;
  };
  V.desk.wire = () => {
    $$('.desk-checkin').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); openCheckIn(b.dataset.code); }));
    $$('.desk-checkout').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); openCheckOut(b.dataset.code); }));
    $$('[data-guest]').forEach((c) => (c.onclick = () => openGuestDetail(c.dataset.guest)));
  };

  V.walkins = () => {
    const avail = D.ROOMS.filter((r) => r.status === 'available');
    return `
    <section class="fade-in">
      ${pageHero('Walk-in', 'New walk-in guest', 'Register & assign a room instantly')}
      <div class="grid grid-2">
        <div class="card">
          <h3 class="font-display text-headline-sm text-on-surface mb-4">Guest details</h3>
          <div style="display:flex;flex-direction:column;gap:.9rem">
            <div class="field"><label>Full name</label><div class="input-icon">${icon('person')}<input class="input" placeholder="e.g. Jane Muthoni"/></div></div>
            <div class="field"><label>Phone</label><div class="input-icon">${icon('call')}<input class="input" placeholder="+254 7XX XXX XXX"/></div></div>
            <div class="grid grid-2" style="gap:.8rem"><div class="field"><label>Nights</label><input class="input" type="number" value="1"/></div><div class="field"><label>Guests</label><input class="input" type="number" value="1"/></div></div>
            <button class="btn btn-primary btn-block" id="reg-walkin">${icon('how_to_reg')} Register & assign</button>
          </div>
        </div>
        <div class="card">
          <h3 class="font-display text-headline-sm text-on-surface mb-3">Available now (${avail.length})</h3>
          <div class="divide-rows">
            ${avail.map((r) => `<div class="list-row">${icon('meeting_room', 'text-primary')}<div style="flex:1"><p class="text-on-surface">${esc(r.name)}</p><p class="mono text-body-md text-on-surface-variant">${r.id} · ${money(r.price)}/night</p></div><button class="btn btn-ghost pick" data-name="${esc(r.name)}" style="padding:.35rem .7rem">Assign</button></div>`).join('')}
          </div>
        </div>
      </div>
    </section>`;
  };
  V.walkins.wire = () => {
    $('#reg-walkin').onclick = () => C.toast('Walk-in registered & SMS sent via FAMMY', 'success', 'how_to_reg');
    $$('.pick').forEach((b) => (b.onclick = () => C.toast(b.dataset.name + ' assigned', 'success', 'meeting_room')));
  };

  V.occupancy = () => {
    const floors = [...new Set(D.ROOMS.map((r) => r.floor))].sort((a, b) => a - b);
    return `
    <section class="fade-in">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;flex-wrap:wrap">
        ${pageHero('Occupancy', 'Room board', D.ROOMS.length + ' rooms · ' + D.ANALYTICS.kpis.occupancy + '% occupied')}
        <button class="btn btn-primary" id="add-room" style="margin-bottom:1.5rem">${icon('add_home')} Add room</button>
      </div>
      <div class="card card-pad-sm" style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem;align-items:center">
        ${[['available', 'Available'], ['occupied', 'Occupied'], ['cleaning', 'Cleaning'], ['reserved', 'Reserved'], ['maintenance', 'Maintenance']].map((s) => `<span class="badge b-${s[0]}">${s[1]}</span>`).join('')}
        <span class="badge" style="background:var(--surface-high);color:var(--on-surface-variant)">${icon('edit', 'text-[14px]')} Tap a room to edit</span>
      </div>
      ${floors.map((f) => `<div style="margin-bottom:1.5rem">
        <p class="text-label-caps uppercase text-on-surface-variant mb-2">Floor ${f}</p>
        <div class="grid grid-3 stagger">
          ${D.ROOMS.filter((r) => r.floor === f).map((r) => `<div class="card card-hover room-tile" data-room="${r.id}" style="cursor:pointer;overflow:hidden;padding:0">
            <div style="height:96px;overflow:hidden;background:var(--surface-high);position:relative">
              <img src="${r.image}" alt="${esc(r.name)}" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.style.opacity=.2"/>
              <div style="position:absolute;top:.5rem;right:.5rem">${badge(r.status)}</div>
              ${r.vip ? `<div style="position:absolute;top:.5rem;left:.5rem">${badge('vip', 'VIP')}</div>` : ''}
            </div>
            <div style="padding:.9rem 1rem">
              <div class="flex items-center justify-between"><span class="mono text-on-surface" style="font-weight:600">${r.id}</span><span class="text-on-surface-variant">${icon('edit', 'text-[16px]')}</span></div>
              <p class="text-body-md text-on-surface mt-1">${esc(r.name)}</p>
              <p class="text-body-md text-on-surface-variant">${r.type} · <span class="mono">${money(r.price)}</span></p>
            </div>
          </div>`).join('')}
        </div></div>`).join('')}
    </section>`;
  };
  V.occupancy.wire = () => {
    $('#add-room').onclick = () => openRoomEdit(null);
    $$('[data-room]').forEach((c) => (c.onclick = () => openRoomEdit(c.dataset.room)));
  };

  V.lookup = () => `
    <section class="fade-in">
      ${pageHero('Customer lookup', 'Find a guest', null)}
      <div class="input-icon" style="margin-bottom:1.5rem;max-width:520px">${icon('search')}<input id="lk" class="input" placeholder="Search by name or phone…"/></div>
      <div id="lk-results" class="grid grid-2 stagger"></div>
    </section>`;
  V.lookup.wire = () => {
    const render = (q = '') => {
      const list = D.GUESTS.filter((g) => (g.name + g.phone).toLowerCase().includes(q.toLowerCase()));
      $('#lk-results').innerHTML = list.map((g) => `<div class="card card-hover" data-guest="${g.id}" style="cursor:pointer">
        <div style="display:flex;align-items:center;gap:.9rem">${avatar(g.avatar, g.vip ? 'avatar-accent' : 'avatar-primary')}
          <div style="flex:1"><p class="text-on-surface" style="font-weight:600">${esc(g.name)} ${g.vip ? badge('vip', 'VIP') : ''}</p><p class="text-body-md text-on-surface-variant">${esc(g.phone)}</p></div>${badge(g.tier.toLowerCase())}</div>
        <div class="grid grid-3 mt-3" style="gap:.5rem;text-align:center">
          <div class="card card-pad-sm"><p class="kpi-value mono" style="font-size:18px">${g.stays}</p><p class="text-body-md text-on-surface-variant">Stays</p></div>
          <div class="card card-pad-sm"><p class="kpi-value mono" style="font-size:18px">${g.points}</p><p class="text-body-md text-on-surface-variant">Points</p></div>
          <div class="card card-pad-sm"><p class="kpi-value" style="font-size:18px">${g.tier}</p><p class="text-body-md text-on-surface-variant">Tier</p></div>
        </div></div>`).join('') || C.empty('person_search', 'No guests found', 'Try another name or number.');
      $$('[data-guest]').forEach((c) => (c.onclick = () => openGuestDetail(c.dataset.guest)));
    };
    render();
    $('#lk').oninput = (e) => render(e.target.value);
  };

  V.calendar = () => {
    const dates = calDates(14);
    const wk = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const CAL_BG = { confirmed: 'rgba(56,189,248,.30)', 'checked-in': 'rgba(20,184,166,.34)', pending: 'rgba(245,158,11,.30)', 'checkout-due': 'rgba(245,158,11,.42)', reserved: 'rgba(245,158,11,.22)' };
    return `
    <section class="fade-in">
      ${pageHero('Front desk', 'Booking calendar', 'Availability & reservations · tap a free cell to book')}
      <div class="card card-pad-sm" style="display:flex;gap:.7rem;flex-wrap:wrap;margin-bottom:1rem;align-items:center">
        ${[['confirmed', 'Confirmed'], ['checked-in', 'In-house'], ['pending', 'Pending'], ['checkout-due', 'Checkout due'], ['reserved', 'Reserved']].map((s) => `<span class="badge b-${s[0]}">${s[1]}</span>`).join('')}
        <span class="badge" style="background:var(--surface-high);color:var(--on-surface-variant)">${icon('add', 'text-[14px]')} Free = tap to book</span>
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <div class="cal hide-scroll">
          <div class="cal-row cal-head">
            <div class="cal-room cal-corner"><span class="text-label-caps uppercase text-on-surface-variant">Room</span></div>
            ${dates.map((d) => `<div class="cal-day"><span>${d.getDate()}</span><small>${wk[d.getDay()]}</small></div>`).join('')}
          </div>
          ${D.ROOMS.map((r) => `<div class="cal-row">
            <div class="cal-room"><span class="mono" style="font-weight:600">${r.id}</span><small>${esc(r.type)}</small></div>
            ${dates.map((d) => {
              const ds = isoDate(d);
              const bk = D.BOOKINGS.find((b) => b.room === r.id && b.status !== 'cancelled' && ds >= b.checkIn && ds < b.checkOut);
              if (bk) {
                const g = D.GUESTS.find((x) => x.id === bk.guest);
                const start = ds === bk.checkIn;
                return `<div class="cal-cell busy" data-book="${bk.code}" title="${g ? esc(g.name) : ''} · ${bk.code} (${bk.status})" style="background:${CAL_BG[bk.status] || 'rgba(56,189,248,.3)'}">${start ? `<span class="cal-tag">${g ? g.avatar : '•'}</span>` : ''}</div>`;
              }
              return `<div class="cal-cell free" data-new="${r.id}|${ds}" title="${r.id} available ${ds}"></div>`;
            }).join('')}
          </div>`).join('')}
        </div>
      </div>
      <p class="text-body-md text-on-surface-variant mt-3">${D.ROOMS.length} rooms · next 14 days. Overlapping dates are blocked automatically to prevent double-bookings.</p>
    </section>`;
  };
  V.calendar.wire = () => {
    $$('.cal-cell[data-book]').forEach((c) => (c.onclick = () => { const bk = D.BOOKINGS.find((b) => b.code === c.dataset.book); if (bk) openGuestDetail(bk.guest); }));
    $$('.cal-cell[data-new]').forEach((c) => (c.onclick = () => { const [room, ds] = c.dataset.new.split('|'); quickBooking(room, ds); }));
  };

  /* ---------- OPERATIONS ---------- */
  V.ops = () => {
    const k = D.ANALYTICS.kpis;
    return `
    <section class="fade-in">
      ${pageHero('Operations', 'Daily operations', 'Live performance across the property')}
      <div class="grid grid-kpi" style="margin-bottom:1.5rem">
        ${kpi({ icon: 'donut_large', label: 'Occupancy', value: k.occupancy + '%', tone: 'primary', delta: { dir: 'up', text: '+6% vs avg' } })}
        ${kpi({ icon: 'payments', label: 'Revenue today', value: money(k.revenueToday), tone: 'accent', mono: true, delta: { dir: 'up', text: '+12%' } })}
        ${kpi({ icon: 'login', label: 'Arrivals', value: k.arrivals, tone: 'info' })}
        ${kpi({ icon: 'task', label: 'Pending tasks', value: k.pendingTasks, tone: 'warning' })}
      </div>
      <div style="margin-bottom:1.5rem">${quickActions([
        { icon: 'analytics', label: 'Analytics', tone: 'info', onclick: "location.hash='#/analytics'" },
        { icon: 'groups', label: 'Staff', tone: 'success', onclick: "location.hash='#/staff'" },
        { icon: 'insights', label: 'Forecast', tone: 'accent', onclick: "location.hash='#/forecast'" },
        { icon: 'file_download', label: 'Export', tone: 'warning', onclick: "SC_toast('Report exported (CSV)','success','file_download')" }
      ])}</div>
      <div class="grid grid-2" style="margin-bottom:1.5rem">
        <div class="card"><div class="section-head"><h2 class="font-display text-headline-sm">Revenue · last 7 days</h2><span class="mono text-primary">${money(D.ANALYTICS.revenue7d.reduce((a, b) => a + b, 0))}</span></div>
          ${barChart(D.ANALYTICS.revenue7d, D.ANALYTICS.revenueLabels, money)}</div>
        <div class="card"><div class="section-head"><h2 class="font-display text-headline-sm">Occupancy trend</h2></div>${barChart(D.ANALYTICS.occupancy7d, D.ANALYTICS.revenueLabels, (v) => v + '%')}</div>
      </div>
      <div class="grid grid-2">
        <div class="card"><h2 class="font-display text-headline-sm mb-3">Upcoming arrivals</h2><div class="divide-rows">
          ${D.BOOKINGS.filter((b) => b.eta !== '—' && b.status !== 'cancelled').slice(0, 4).map((b) => { const g = D.GUESTS.find((x) => x.id === b.guest); return `<div class="list-row">${avatar(g.avatar, g.vip ? 'avatar-accent' : '')}<div style="flex:1"><p class="text-on-surface">${esc(g.name)}</p><p class="mono text-body-md text-on-surface-variant">${b.room} · ${b.eta}</p></div>${badge(b.status)}</div>`; }).join('')}
        </div></div>
        <div class="card"><h2 class="font-display text-headline-sm mb-3">Pending tasks</h2><div class="divide-rows">
          ${state.tasks.filter((t) => t.status !== 'done').slice(0, 4).map((t) => `<div class="list-row">${icon(t.type === 'Maintenance' ? 'build' : t.type === 'Cleaning' ? 'cleaning_services' : 'task', 'text-on-surface-variant')}<div style="flex:1"><p class="text-on-surface">${t.type} · ${t.room}</p><p class="text-body-md text-on-surface-variant">Due ${t.due}</p></div>${badge(t.priority)}</div>`).join('')}
        </div></div>
      </div>
      <div style="margin-top:1.5rem">${activityFeed(6)}</div>
    </section>`;
  };
  V.ops.wire = () => C.animateBars($('#app'));

  V.analytics = () => {
    const a = D.ANALYTICS;
    return `
    <section class="fade-in">
      ${pageHero('Analytics', 'Performance insights', 'Revenue, occupancy & guest behaviour')}
      <div class="grid grid-2" style="margin-bottom:1.5rem">
        <div class="card"><div class="section-head"><h2 class="font-display text-headline-sm">Revenue</h2>${badge('success', '+12%')}</div>${barChart(a.revenue7d, a.revenueLabels, money)}</div>
        <div class="card"><div class="section-head"><h2 class="font-display text-headline-sm">Peak check-in hours</h2></div>${barChart(a.peakHours.map((p) => p.v), a.peakHours.map((p) => p.h.slice(0, 2)), (v) => v + '%')}</div>
      </div>
      <div class="grid grid-3" style="margin-bottom:1.5rem">
        <div class="card" style="text-align:center"><h2 class="font-display text-headline-sm mb-3">Room mix</h2>
          <div style="position:relative;width:140px;margin:0 auto">${donut(a.roomMix)}<div style="position:absolute;inset:0;display:grid;place-items:center"><div><p class="kpi-value">${a.roomMix.length}</p><p class="text-body-md text-on-surface-variant">types</p></div></div></div>
          <div style="display:flex;flex-direction:column;gap:.3rem;margin-top:1rem">${a.roomMix.map((s) => `<div class="flex items-center justify-between"><span class="text-body-md text-on-surface-variant"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${s.color};margin-right:6px"></span>${s.label}</span><span class="mono text-on-surface">${s.value}%</span></div>`).join('')}</div>
        </div>
        <div class="card"><h2 class="font-display text-headline-sm mb-2">Customer retention</h2><p class="mono text-headline-md text-primary">${a.retention.at(-1)}%</p><p class="text-body-md text-on-surface-variant mb-3">12-month trend</p>${sparkline(a.retention)}</div>
        <div class="card"><h2 class="font-display text-headline-sm mb-2">Satisfaction</h2><p class="mono text-headline-md text-warning">${a.kpis.satisfaction} ${icon('star', 'text-warning')}</p><p class="text-body-md text-on-surface-variant mb-3">Avg guest rating</p>${sparkline([4.2, 4.3, 4.5, 4.4, 4.6, 4.7], '#F59E0B')}</div>
      </div>
      <div class="card"><h2 class="font-display text-headline-sm mb-3">Staff performance</h2>
        ${a.staffPerf.map((s) => `<div style="margin-bottom:.9rem"><div class="flex items-center justify-between mb-1"><span class="text-body-md text-on-surface">${s.name}</span><span class="mono text-on-surface-variant">${s.score}%</span></div><div class="meter"><span data-w="${s.score}" style="width:0"></span></div></div>`).join('')}
      </div>
    </section>`;
  };
  V.analytics.wire = () => C.animateBars($('#app'));

  V.staff = () => `
    <section class="fade-in">
      ${pageHero('Team', 'Staff management', 'Shifts, workload & performance')}
      <div class="grid grid-2 stagger">
        ${D.STAFF.map((s) => `<div class="card card-hover">
          <div style="display:flex;align-items:center;gap:.9rem">${avatar(s.avatar, 'avatar-primary')}
            <div style="flex:1"><p class="text-on-surface" style="font-weight:600">${esc(s.name)}</p><p class="text-body-md text-on-surface-variant">${s.role} · ${s.shift}</p></div>${badge(s.status)}</div>
          <div class="grid grid-3 mt-3" style="gap:.5rem;text-align:center">
            <div class="card card-pad-sm"><p class="kpi-value mono" style="font-size:18px">${s.tasks}</p><p class="text-body-md text-on-surface-variant">Tasks</p></div>
            <div class="card card-pad-sm"><p class="kpi-value" style="font-size:18px">${s.rating}${icon('star', 'text-[14px] text-warning')}</p><p class="text-body-md text-on-surface-variant">Rating</p></div>
            <div class="card card-pad-sm"><p class="kpi-value" style="font-size:18px">${s.shift.split(' ')[0]}</p><p class="text-body-md text-on-surface-variant">Shift</p></div>
          </div></div>`).join('')}
      </div>
    </section>`;

  V.forecast = () => {
    const next = [76, 82, 88, 91, 84, 79, 73];
    return `
    <section class="fade-in">
      ${pageHero('Forecast', 'Reservation forecast', 'Projected occupancy · next 7 days')}
      <div class="card" style="margin-bottom:1.5rem">${barChart(next, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], (v) => v + '%')}</div>
      <div class="grid grid-3">
        ${kpi({ icon: 'trending_up', label: 'Peak day', value: 'Thu 91%', tone: 'primary' })}
        ${kpi({ icon: 'event_available', label: 'Avg occupancy', value: '82%', tone: 'info' })}
        ${kpi({ icon: 'savings', label: 'Projected revenue', value: money(1280000), tone: 'accent', mono: true })}
      </div>
      <div class="card mt-4" style="display:flex;gap:.9rem;align-items:center;background:linear-gradient(135deg,rgba(20,184,166,.08),transparent)">
        ${icon('auto_awesome', 'text-primary')}<p class="text-body-md text-on-surface">AI suggestion: Open 2 more Executive rooms for Thursday — demand is projected to exceed supply by 14%.</p>
      </div>
    </section>`;
  };
  V.forecast.wire = () => C.animateBars($('#app'));

  /* ---------- LOUNGE ASSISTANT ---------- */
  V.tasks = () => {
    const order = { urgent: 0, high: 1, medium: 2, low: 3 };
    const list = [...state.tasks].sort((a, b) => order[a.priority] - order[b.priority]);
    return `
    <section class="fade-in">
      ${pageHero('My work', 'Assigned tasks', state.tasks.filter((t) => t.status !== 'done').length + ' open · tap to advance')}
      <div class="divide-rows card" style="padding:.5rem">
        ${list.map((t) => `<div class="list-row task-row" data-id="${t.id}" style="cursor:pointer">
          <div class="avatar ${t.status === 'done' ? 'avatar-primary' : ''}" style="${t.status === 'done' ? '' : 'background:var(--surface-high)'}">${icon(t.type === 'Maintenance' ? 'build' : t.type === 'Cleaning' ? 'cleaning_services' : t.type === 'Incident' ? 'report' : t.type === 'Inspection' ? 'fact_check' : 'bed')}</div>
          <div style="flex:1;min-width:0"><p class="text-on-surface" style="font-weight:600">${t.type} · <span class="mono">${t.room}</span></p><p class="text-body-md text-on-surface-variant">${esc(t.note)} · Due ${t.due}</p></div>
          <div style="display:flex;flex-direction:column;gap:.3rem;align-items:flex-end">${badge(t.priority)}${badge(t.status)}</div>
        </div>`).join('')}
      </div>
      <p class="text-body-md text-on-surface-variant mt-3" style="text-align:center">Tap a task to cycle: Pending → In-progress → Done</p>
    </section>`;
  };
  V.tasks.wire = () => $$('.task-row').forEach((row) => (row.onclick = () => {
    const t = state.tasks.find((x) => x.id === row.dataset.id);
    const flow = { pending: 'in-progress', 'in-progress': 'done', done: 'pending' };
    t.status = flow[t.status];
    persist();
    C.toast(`${t.type} ${t.room} → ${C.titleCase(t.status)}`, t.status === 'done' ? 'success' : 'info', t.status === 'done' ? 'check_circle' : 'pending');
    render();
  }));

  V.prep = () => {
    const checklist = ['Strip & replace linen', 'Restock minibar', 'Sanitize bathroom', 'Vacuum & dust', 'Welcome amenities (VIP)', 'Final inspection photo'];
    return `
    <section class="fade-in" style="max-width:560px;margin:0 auto">
      ${pageHero('Room prep', 'SC-201 · Maasai Mara Penthouse', 'VIP arrival 12:00 — Faith Chebet')}
      <div class="card">
        ${checklist.map((c, i) => `<label class="list-row" style="cursor:pointer"><input type="checkbox" ${i < 2 ? 'checked' : ''} class="chk" style="width:20px;height:20px;accent-color:var(--primary)"/><span class="text-on-surface" style="flex:1">${c}</span></label>`).join('')}
        <div class="meter mt-2"><span id="prep-meter" style="width:33%"></span></div>
      </div>
      <button class="btn btn-ghost btn-block mt-4">${icon('photo_camera')} Upload completion photo</button>
      <button class="btn btn-primary btn-block mt-3" id="prep-done">${icon('check')} Mark room ready</button>
    </section>`;
  };
  V.prep.wire = () => {
    const upd = () => { const all = $$('.chk'); const done = all.filter((c) => c.checked).length; $('#prep-meter').style.width = Math.round((done / all.length) * 100) + '%'; };
    $$('.chk').forEach((c) => (c.onchange = upd)); upd();
    $('#prep-done').onclick = () => C.toast('SC-201 marked ready — reception notified', 'success', 'bed');
  };

  V.maintenance = () => {
    const reqs = state.tasks.filter((t) => ['Maintenance', 'Incident'].includes(t.type));
    return `
    <section class="fade-in">
      ${pageHero('Maintenance', 'Open requests', reqs.length + ' active')}
      <div class="grid grid-2 stagger">
        ${reqs.map((t) => `<div class="card card-hover">
          <div class="flex items-center justify-between"><span class="mono text-on-surface" style="font-weight:600">${t.room}</span>${badge(t.priority)}</div>
          <p class="text-on-surface mt-2" style="font-weight:600">${t.type}</p>
          <p class="text-body-md text-on-surface-variant">${esc(t.note)}</p>
          <div class="flex items-center justify-between mt-3"><span class="text-body-md text-on-surface-variant">Due ${t.due}</span>${badge(t.status)}</div>
        </div>`).join('')}
      </div>
      <button class="btn btn-primary mt-4" onclick="location.hash='#/incidents'">${icon('add')} Report new issue</button>
    </section>`;
  };

  V.incidents = () => `
    <section class="fade-in" style="max-width:560px;margin:0 auto">
      ${pageHero('Report', 'New incident report', 'Log a maintenance or guest issue')}
      <div class="card" style="display:flex;flex-direction:column;gap:.9rem">
        <div class="field"><label>Room</label><select class="input">${D.ROOMS.map((r) => `<option>${r.id} · ${r.name}</option>`).join('')}</select></div>
        <div class="field"><label>Category</label><select class="input"><option>Plumbing</option><option>Electrical</option><option>AC / HVAC</option><option>Furniture</option><option>Guest incident</option></select></div>
        <div class="field"><label>Priority</label>
          <div style="display:flex;gap:.5rem">${['Low', 'Medium', 'High', 'Urgent'].map((p, i) => `<button type="button" class="btn ${i === 2 ? 'btn-primary' : 'btn-ghost'} pri" style="flex:1;padding:.5rem">${p}</button>`).join('')}</div></div>
        <div class="field"><label>Description</label><textarea class="input" rows="3" placeholder="Describe the issue…"></textarea></div>
        <button class="btn btn-ghost">${icon('photo_camera')} Attach photo</button>
        <button class="btn btn-primary btn-block" id="submit-incident">${icon('send')} Submit report</button>
      </div>
    </section>`;
  V.incidents.wire = () => {
    $$('.pri').forEach((b) => (b.onclick = () => $$('.pri').forEach((x) => (x.className = `btn ${x === b ? 'btn-primary' : 'btn-ghost'} pri`))));
    $('#submit-incident').onclick = () => C.toast('Incident logged & assigned to maintenance', 'success', 'report');
  };

  /* ---------- ADMIN ---------- */
  V.overview = () => {
    const clients = D.GUESTS.length;
    const active = D.BOOKINGS.filter((b) => ['confirmed', 'checked-in', 'pending', 'checkout-due'].includes(b.status)).length;
    const k = D.ANALYTICS.kpis;
    const card = (ic, title, sub, route, tone) => `
      <div class="card card-hover" onclick="location.hash='#/${route}'" style="cursor:pointer;display:flex;align-items:center;gap:.9rem">
        <div class="qa-ic" style="${FEED_TONE[tone] || FEED_TONE.info}">${icon(ic)}</div>
        <div style="flex:1;min-width:0"><p class="text-on-surface" style="font-weight:600">${title}</p><p class="text-body-md text-on-surface-variant">${sub}</p></div>
        ${icon('chevron_right', 'text-on-surface-variant')}
      </div>`;
    return `
    <section class="fade-in">
      ${pageHero('Administration', 'Overview', 'Everything at a glance — tap a card to manage')}
      <div class="grid grid-kpi" style="margin-bottom:1.5rem">
        ${kpi({ icon: 'group', label: 'Clients', value: clients, tone: 'info' })}
        ${kpi({ icon: 'event_available', label: 'Active bookings', value: active, tone: 'primary' })}
        ${kpi({ icon: 'payments', label: 'Revenue today', value: money(k.revenueToday), tone: 'accent', mono: true })}
        ${kpi({ icon: 'donut_large', label: 'Occupancy', value: k.occupancy + '%', tone: 'warning' })}
      </div>
      ${sectionHead('Manage', 'Jump straight to a module')}
      <div class="grid grid-2 stagger" style="margin-bottom:1.5rem">
        ${card('group', 'Users & clients', D.STAFF.length + ' staff · ' + clients + ' clients', 'users', 'info')}
        ${card('sms', 'Messaging & SMS', D.TEMPLATES.length + ' templates · FAMMY', 'templates', 'primary')}
        ${card('shield_person', 'Roles & permissions', '4 roles configured', 'roles', 'accent')}
        ${card('monitoring', 'Analytics', 'Revenue, occupancy & guests', 'analytics', 'primary')}
        ${card('settings', 'System config', 'Property & policy settings', 'config', 'warning')}
        ${card('history', 'Audit log', "Today's activity", 'audit', 'danger')}
      </div>
      ${activityFeed(6)}
    </section>`;
  };
  V.overview.wire = () => C.animateCounts($('#app'));

  V.users = () => {
    const inHouse = (id) => D.BOOKINGS.some((b) => b.guest === id && b.status === 'checked-in');
    return `
    <section class="fade-in">
      ${pageHero('Administration', 'User management', D.STAFF.length + ' staff · ' + D.GUESTS.length + ' clients in the system')}
      <div class="seg">
        <button class="seg-btn" data-tab="staff">${icon('badge')} Staff (${D.STAFF.length})</button>
        <button class="seg-btn" data-tab="clients">${icon('group')} Clients (${D.GUESTS.length})</button>
      </div>

      <div id="tab-staff">
        ${sectionHead('Staff accounts', 'Team members with system access', `<button class="btn btn-primary" style="padding:.45rem .9rem">${icon('person_add')} Add user</button>`)}
        <div class="card" style="padding:.5rem"><div class="divide-rows">
          ${D.STAFF.map((s) => `<div class="list-row">${avatar(s.avatar, 'avatar-primary')}
            <div style="flex:1;min-width:0"><p class="text-on-surface" style="font-weight:600">${esc(s.name)}</p><p class="text-body-md text-on-surface-variant">${s.role}</p></div>
            <span class="badge b-info" style="margin-right:.4rem">${s.shift}</span>${badge(s.status)}
            <button class="icon-btn">${icon('more_vert')}</button></div>`).join('')}
        </div></div>
      </div>

      <div id="tab-clients" class="hide">
        ${sectionHead('Client accounts', 'Every guest registered in Fammy Comforts', `<div class="input-icon" style="max-width:240px">${icon('search')}<input id="cl-search" class="input" placeholder="Search clients…"/></div>`)}
        <div class="card" style="padding:.5rem"><div class="divide-rows" id="cl-list">
          ${D.GUESTS.map((g) => `<div class="list-row" data-guest="${g.id}" style="cursor:pointer">${avatar(g.avatar, g.vip ? 'avatar-accent' : 'avatar-primary')}
            <div style="flex:1;min-width:0"><p class="text-on-surface" style="font-weight:600">${esc(g.name)} ${g.vip ? badge('vip', 'VIP') : ''}</p>
            <p class="text-body-md text-on-surface-variant" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(g.phone)} · ${esc(g.email)}</p></div>
            <span class="badge b-${g.tier.toLowerCase()}" style="margin-right:.4rem">${g.tier}</span>
            ${inHouse(g.id) ? badge('checked-in', 'In-house') : '<span class="badge b-active"><span class="net-dot is-online" style="width:7px;height:7px"></span> Active</span>'}
            ${icon('chevron_right', 'text-on-surface-variant')}</div>`).join('')}
        </div></div>
      </div>
    </section>`;
  };
  V.users.wire = () => {
    const show = (t) => {
      $('#tab-staff').classList.toggle('hide', t !== 'staff');
      $('#tab-clients').classList.toggle('hide', t !== 'clients');
      $$('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    };
    $$('.seg-btn').forEach((b) => (b.onclick = () => show(b.dataset.tab)));
    show('staff');
    const wireClients = () => $$('#tab-clients [data-guest]').forEach((c) => (c.onclick = () => openGuestDetail(c.dataset.guest)));
    wireClients();
    const search = $('#cl-search');
    if (search) search.oninput = (e) => {
      const q = e.target.value.toLowerCase();
      const list = D.GUESTS.filter((g) => (g.name + g.phone + g.email).toLowerCase().includes(q));
      const inHouse = (id) => D.BOOKINGS.some((b) => b.guest === id && b.status === 'checked-in');
      $('#cl-list').innerHTML = list.map((g) => `<div class="list-row" data-guest="${g.id}" style="cursor:pointer">${avatar(g.avatar, g.vip ? 'avatar-accent' : 'avatar-primary')}
        <div style="flex:1;min-width:0"><p class="text-on-surface" style="font-weight:600">${esc(g.name)} ${g.vip ? badge('vip', 'VIP') : ''}</p>
        <p class="text-body-md text-on-surface-variant" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(g.phone)} · ${esc(g.email)}</p></div>
        <span class="badge b-${g.tier.toLowerCase()}" style="margin-right:.4rem">${g.tier}</span>
        ${inHouse(g.id) ? badge('checked-in', 'In-house') : '<span class="badge b-active"><span class="net-dot is-online" style="width:7px;height:7px"></span> Active</span>'}
        ${icon('chevron_right', 'text-on-surface-variant')}</div>`).join('') || '<p class="text-body-md text-on-surface-variant" style="padding:1rem">No clients found.</p>';
      wireClients();
    };
  };

  V.roles = () => {
    const perms = ['Bookings', 'Check-in/out', 'Rooms', 'Analytics', 'Staff', 'Templates', 'System config'];
    const matrix = {
      Receptionist: [1, 1, 1, 0, 0, 0, 0],
      'Lounge Assistant': [0, 0, 1, 0, 0, 0, 0],
      'Operations Manager': [1, 1, 1, 1, 1, 1, 0],
      Administrator: [1, 1, 1, 1, 1, 1, 1]
    };
    return `
    <section class="fade-in">
      ${pageHero('Access', 'Roles & permissions', 'Who can do what')}
      <div class="card" style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:640px">
          <thead><tr><th style="text-align:left;padding:.6rem;color:var(--on-variant);font-size:12px;text-transform:uppercase;letter-spacing:.05em">Role</th>
          ${perms.map((p) => `<th style="padding:.6rem;color:var(--on-variant);font-size:11px;font-weight:600">${p}</th>`).join('')}</tr></thead>
          <tbody>${Object.entries(matrix).map(([role, vals]) => `<tr style="border-top:1px solid rgba(255,255,255,.05)"><td style="padding:.7rem;color:var(--on-surface);font-weight:600">${role}</td>
          ${vals.map((v) => `<td style="text-align:center;padding:.7rem">${v ? icon('check_circle', 'text-primary') : icon('remove', 'text-on-surface-variant')}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    </section>`;
  };

  V.templates = () => `
    <section class="fade-in">
      ${pageHero('Messaging', 'Notification templates', 'Sender ID · FAMMY')}
      <div class="grid grid-2 stagger">
        ${D.TEMPLATES.map((t) => `<div class="card card-hover tpl" data-id="${t.id}" style="cursor:pointer">
          <div class="flex items-center justify-between"><span class="badge b-info">${t.channel}</span>${t.active ? badge('active', 'On') : badge('offline', 'Off')}</div>
          <h3 class="font-display text-headline-sm text-on-surface mt-2">${esc(t.name)}</h3>
          <p class="text-body-md text-on-surface-variant">Trigger: ${esc(t.trigger)}</p>
          <p class="text-body-md text-on-surface mt-2" style="opacity:.8">${esc(t.body.slice(0, 80))}…</p>
        </div>`).join('')}
      </div>
    </section>`;
  V.templates.wire = () => $$('.tpl').forEach((c) => (c.onclick = () => {
    const t = D.TEMPLATES.find((x) => x.id === c.dataset.id);
    const sample = t.body.replace('{name}', 'Wanjiru').replace('{code}', 'BK-7841').replace('{room}', 'Savannah Suite').replace('{date}', '9 Jun').replace('{amount}', 'KES 17,000');
    C.modal(`
      <div class="modal-head"><span class="badge b-info">${t.channel}</span><h3 class="font-display text-headline-sm">${esc(t.name)}</h3><button data-close class="icon-btn ml-auto">${icon('close')}</button></div>
      <div class="modal-body">
        <p class="text-label-caps uppercase text-on-surface-variant mb-2">Live preview</p>
        <div class="phone-frame" style="margin:0 auto 1.2rem">
          ${t.channel === 'SMS' ? `<div class="sms-bubble"><p class="sms-sender">FAMMY</p>${esc(sample)}</div>` : t.channel === 'Push' ? `<div class="card card-pad-sm" style="display:flex;gap:.6rem"><div class="brand-mark" style="width:32px;height:32px;font-size:16px">S</div><div><p class="text-on-surface" style="font-weight:600;font-size:13px">Fammy Comforts</p><p class="text-body-md text-on-surface-variant">${esc(sample)}</p></div></div>` : `<div class="card card-pad-sm"><p class="text-on-surface-variant text-body-md">From: Fammy Comforts &lt;hello@fammycomforts.co.ke&gt;</p><p class="text-on-surface mt-2">${esc(sample)}</p></div>`}
        </div>
        <div class="field"><label>Template body</label><textarea class="input" rows="3">${esc(t.body)}</textarea></div>
        <button class="btn btn-primary btn-block mt-3" data-close onclick="SC_toast('Template saved','success','sms')">Save changes</button>
      </div>`);
    $$('[data-close]', $('#modal')).forEach((b) => b.addEventListener('click', C.closeModal));
  }));

  V.config = () => {
    const toggles = [['Accept online bookings', 1], ['SMS notifications (FAMMY)', 1], ['Push notifications', 1], ['Email receipts', 1], ['Auto-assign housekeeping', 1], ['Maintenance mode', 0], ['Require deposit on booking', 0]];
    return `
    <section class="fade-in" style="max-width:640px">
      ${pageHero('System', 'Configuration', 'Property-wide settings')}
      <div class="card divide-rows" style="padding:.3rem 1rem">
        ${toggles.map((t) => `<label class="list-row" style="cursor:pointer"><span class="text-on-surface" style="flex:1">${t[0]}</span>
          <span class="switch ${t[1] ? 'on' : ''}"><input type="checkbox" ${t[1] ? 'checked' : ''} style="display:none"/><span class="knob"></span></span></label>`).join('')}
      </div>
      <div class="card mt-4">
        <h3 class="font-display text-headline-sm mb-3">Property details</h3>
        <div class="grid grid-2" style="gap:.8rem">
          <div class="field"><label>Property name</label><input class="input" value="Fammy Comforts Lounge"/></div>
          <div class="field"><label>Currency</label><input class="input" value="KES (Kenyan Shilling)"/></div>
          <div class="field"><label>Check-in time</label><input class="input" value="14:00"/></div>
          <div class="field"><label>Check-out time</label><input class="input" value="11:00"/></div>
        </div>
        <button class="btn btn-primary mt-4" onclick="SC_toast('Settings saved','success','settings')">Save settings</button>
      </div>
    </section>`;
  };
  V.config.wire = () => $$('.switch').forEach((s) => (s.onclick = () => { s.classList.toggle('on'); C.toast(s.classList.contains('on') ? 'Enabled' : 'Disabled', 'info'); }));

  V.audit = () => `
    <section class="fade-in">
      ${pageHero('Security', 'Audit log', "Today's activity")}
      <div class="card" style="padding:.5rem"><div class="divide-rows">
        ${D.AUDIT.map((a) => `<div class="list-row">
          <div class="avatar" style="background:var(--surface-high)">${icon({ checkin: 'login', override: 'edit', sms: 'sms', task: 'task_alt', config: 'settings' }[a.type] || 'history')}</div>
          <div style="flex:1"><p class="text-on-surface">${esc(a.action)}</p><p class="text-body-md text-on-surface-variant">${esc(a.user)}</p></div>
          <span class="mono text-body-md text-on-surface-variant">${a.time}</span></div>`).join('')}
      </div></div>
    </section>`;

  V.notifications = () => `
    <section class="fade-in">
      ${pageHero('Inbox', 'Notifications', 'SMS · Push · Email · sent via FAMMY')}
      <div class="card" style="padding:.5rem"><div class="divide-rows">
        ${D.NOTIFICATIONS.map((n) => `<div class="list-row" style="align-items:flex-start;background:${n.read ? 'transparent' : 'rgba(20,184,166,0.05)'}">
          <div class="avatar ${n.channel === 'SMS' ? 'avatar-primary' : n.channel === 'Push' ? 'avatar-accent' : ''}">${icon(n.channel === 'SMS' ? 'sms' : n.channel === 'Push' ? 'notifications_active' : 'mail')}</div>
          <div style="flex:1;min-width:0"><div class="flex items-center justify-between"><p class="text-on-surface" style="font-weight:600">${esc(n.title)}</p><span class="text-body-md text-on-surface-variant">${n.time}</span></div>
          <p class="text-body-md text-on-surface-variant">To ${esc(n.to)} · ${n.channel}</p>
          <p class="text-body-md text-on-surface mt-1">${esc(n.body)}</p></div>
        </div>`).join('')}
      </div></div>
    </section>`;
  V.notifications.wire = () => $('#notif-badge').classList.add('hide');

  /* ============================================================
     ROUTER
     ============================================================ */
  const META = {
    home: ['Home', 'Welcome back'], search: ['Book a lounge', 'Find your stay'],
    reservations: ['My trips', 'Your reservations'], checkin: ['Check-in', 'Your QR pass'],
    loyalty: ['Rewards', 'Loyalty programme'], profile: ['Profile', 'Your account'],
    desk: ['Front Desk', 'Reception'], calendar: ['Booking Calendar', 'Availability'], walkins: ['Walk-ins', 'New guest'], occupancy: ['Occupancy', 'Room board'],
    lookup: ['Customer Lookup', 'Find a guest'], ops: ['Daily Operations', 'Live overview'],
    analytics: ['Analytics', 'Insights'], staff: ['Staff', 'Team management'], forecast: ['Forecast', 'Projections'],
    tasks: ['Tasks', 'Your assignments'], prep: ['Room Prep', 'Housekeeping'], maintenance: ['Maintenance', 'Requests'],
    incidents: ['Report', 'New incident'], overview: ['Administration', 'Overview'], users: ['Users', 'Management'], roles: ['Roles', 'Permissions'],
    templates: ['Templates', 'Messaging'], config: ['Configuration', 'System'], audit: ['Audit Log', 'Security'],
    notifications: ['Notifications', 'Alerts']
  };

  function render() {
    const hash = location.hash.replace(/^#\/?/, '') || ROLES.find((r) => r.id === state.role).home;
    const route = hash.split('?')[0];
    const view = V[route];
    if (!view) { location.hash = '#/' + ROLES.find((r) => r.id === state.role).home; return; }

    const app = $('#app');
    app.innerHTML = typeof view === 'function' ? view() : '';
    window.scrollTo(0, 0);
    const meta = META[route] || ['', ''];
    $('#page-title').textContent = meta[0];
    $('#page-sub').textContent = meta[1];
    highlightNav(route);
    C.animateCounts(app);
    C.animateBars(app);
    if (view.wire) view.wire();
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    window.SC_Theme.apply();

    // Shell controls (always present in the DOM)
    $('#menu-btn').onclick = openDrawer;
    $('#drawer-close').onclick = closeDrawer;
    $('#drawer-overlay').onclick = (e) => { if (e.target === $('#drawer-overlay')) closeDrawer(); };
    $('#role-switch').onclick = roleSheet;
    $('#role-switch-m').onclick = roleSheet;
    $('#theme-btn').onclick = () => window.SC_Theme.toggle();
    $('#search-btn').onclick = openSearch;
    $('#ai-fab').onclick = openAI;
    $('#notif-btn').onclick = openNotifications;
    $('#logout-btn') && ($('#logout-btn').onclick = logout);
    $('#logout-btn-m') && ($('#logout-btn-m').onclick = logout);

    window.addEventListener('hashchange', () => { if (state.auth) render(); });

    // Auth gate
    if (state.auth) {
      renderNav();
      if (!location.hash) location.hash = '#/' + ROLES.find((r) => r.id === state.role).home;
      render();
    } else {
      showLogin();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.SC_render = render;
})();
