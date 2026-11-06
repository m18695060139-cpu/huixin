/* 回信 · 前端
 * 原则：你只写信，其余交给回信。
 * 数据：云端是正本；本机缓存一份，打开秒开、没网也能写，联网后自动补寄。
 * 送达：今晚寄出的信，回信马上写好，但封存到第二天早上 6 点才拆；补写的信马上送到。
 */
(function () {
  'use strict';

  // ───────────── 小工具 ─────────────
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return localDate(d); };
  const diffDays = (a, b) => Math.round((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 86400e3);
  const WD = ['日', '一', '二', '三', '四', '五', '六'];
  const wd = s => WD[new Date(s + 'T00:00:00').getDay()];
  const cn = s => `${Number(s.slice(5, 7))}月${Number(s.slice(8, 10))}日`;
  const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const weekKey = s => addDays(s, -((new Date(s + 'T00:00:00').getDay() + 6) % 7));
  const quarterKey = s => s.slice(0, 4) + '-Q' + (Math.floor((Number(s.slice(5, 7)) - 1) / 3) + 1);
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 存不下就算了 */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  const svg = (w, body, sw = 2) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const ICON = {
    checkSm: '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="var(--on-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.3 5.8 10 11 4.2"/></svg>',
    check: svg(14, '<path d="M5 12.5l4.5 4.5L19 7.5"/>', 3),
    today: svg(24, '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.2M12 19v2.2M2.8 12h2.2M19 12h2.2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5 7 17M17 7l1.5-1.5"/>', 1.8),
    pen: svg(24, '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
    penSm: svg(16, '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>', 2.2),
    box: svg(24, '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m3.8 7 8.2 6 8.2-6"/>', 1.8),
    boxSm: svg(18, '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m3.8 7 8.2 6 8.2-6"/>'),
    send: svg(20, '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>'),
    bulb: svg(14, '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>', 2.4),
    self: svg(24, '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>', 1.8),
    mic: svg(22, '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
    clock: svg(16, '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', 2.2),
    timeline: svg(24, '<circle cx="5" cy="5" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="5" cy="19" r="2"/><path d="M11 5h8M11 12h8M11 19h8"/>', 1.8),
    x: svg(15, '<path d="M6 6l12 12M18 6L6 18"/>', 2.6),
    gear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    left: svg(18, '<path d="M15 5l-7 7 7 7"/>', 2.4),
    right: svg(18, '<path d="M9 5l7 7-7 7"/>', 2.4),
    chev: '<svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    tick: svg(18, '<path d="M5 12.5l4.5 4.5L19 7.5"/>', 2.6),
  };
  // 首页「昨晚的你来信了」那只信封
  const ENVELOPE = `<svg class="bob" width="200" height="128" viewBox="0 0 200 128" aria-hidden="true">
    <rect x="0" y="0" width="200" height="128" rx="14" style="fill:var(--card)"/>
    <path d="M6 6 L100 74 L194 6" style="fill:var(--tint);stroke:var(--sep)" stroke-width="2"/>
    <circle cx="100" cy="72" r="16" style="fill:var(--ink)"/>
    <text x="100" y="78" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--on-ink)">回</text></svg>`;

  // act: 可选的按钮 { label, act, v }，比如「补一句备注」
  function toast(msg, act, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('has-act', !!act);
    if (act) {
      const b = document.createElement('button');
      b.className = 'toast-act'; b.dataset.act = act.act; if (act.v) b.dataset.v = act.v; b.textContent = act.label;
      t.appendChild(b);
    }
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show', 'has-act'), ms || (act ? 5000 : 2200));
  }
  function hideToast() { clearTimeout(toast._t); $('#toast').classList.remove('show', 'has-act'); }

  // ───────────── 状态 ─────────────
  let S = null;                 // 当前用户的所有数据
  const V = {                   // 界面状态
    tab: 'today', writeDate: null, editing: false, replying: false, replyErr: '',
    mb: 'all', archiveTab: 'timeline', sheets: [], quoteOffset: 0, olderLoaded: false, online: navigator.onLine,
    sent: null,                 // 刚寄出、正在看「已寄出」那一屏的信：{ date, at }
  };

  function fromBoot(b) {
    return {
      user: b.user, settings: b.settings || {}, stats: b.stats || {},
      letters: Object.fromEntries((b.letters || []).map(l => [l.date, l])),
      todos: b.todos || [], ideas: b.ideas || [], habits: b.habits || [],
      logs: new Set((b.habitLogs || []).map(([h, d]) => h + '|' + d)),
      digests: b.digests || [], memories: b.memories || [],
      feedback: Object.fromEntries((b.feedback || []).map(f => [f.date + '|' + f.block, f.value])),
    };
  }
  function toCache() {
    if (!S) return;
    store.set('hx_cache', {
      user: S.user, settings: S.settings, stats: S.stats,
      letters: Object.values(S.letters), todos: S.todos, ideas: S.ideas, habits: S.habits,
      habitLogs: [...S.logs].map(k => k.split('|')), digests: S.digests, memories: S.memories || [],
      feedback: Object.entries(S.feedback).map(([k, v]) => ({ date: k.split('|')[0], block: k.split('|')[1], value: v })),
    });
  }

  // ───────────── 网络：直接请求 + 离线待寄队列 ─────────────
  async function api(method, path, body) {
    const res = await fetch('/api' + path, {
      method, credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/login' && path !== '/register') { showLogin(); throw new Error('请先登录'); }
    if (!res.ok) { const e = new Error(data.error || ('请求失败 ' + res.status)); e.status = res.status; throw e; }
    return data;
  }

  // 写操作先进队列：同一件东西只保留最后一次，联网后按顺序寄出
  let outbox = store.get('hx_outbox', []);
  function queue(method, path, body) {
    const key = method + ' ' + path;
    outbox = outbox.filter(o => o.key !== key);
    outbox.push({ key, method, path, body });
    store.set('hx_outbox', outbox);
    flush();
  }
  let flushing = false;
  async function flush() {
    if (flushing || !outbox.length) return;
    flushing = true;
    try {
      while (outbox.length) {
        const o = outbox[0];
        try {
          await api(o.method, o.path, o.body);
        } catch (e) {
          if (/Failed to fetch|NetworkError|Load failed|network/i.test(e.message)) { setOnline(false); break; }
          // 登录过期、服务器临时出错：留着下次再寄，不能丢
          if (e.message === '请先登录') break;
          if (e.status >= 500 && (o.tries = (o.tries || 0) + 1) < 5) { store.set('hx_outbox', outbox); break; }
          console.warn('丢弃一条寄不出的修改', o, e.message);   // 服务器明确拒绝的，不再重试
        }
        outbox.shift();
        store.set('hx_outbox', outbox);
        setOnline(true);
      }
    } finally { flushing = false; }
  }
  function setOnline(on) {
    if (V.online === on) return;
    V.online = on;
    const el = document.querySelector('[data-offline]');
    if (el) el.hidden = on;
  }
  window.addEventListener('online', () => { setOnline(true); flush(); });
  setInterval(flush, 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { flush(); maybeRefresh(); }
  });

  // ───────────── 外观 ─────────────
  const THEMES = [
    { id: 'auto', name: '跟随系统', sw: ['#F2F2F7', '#000000', '#D0402B'] },
    { id: 'ink', name: '回信红', sw: ['#F2F2F7', '#FFFFFF', '#D0402B'] },
    { id: 'night', name: '夜信', sw: ['#000000', '#1C1C1E', '#FF6B5E'] },
    { id: 'paper', name: '信笺', sw: ['#F4EEE4', '#FFFDF8', '#B4432F'] },
    { id: 'mono', name: '素笺', sw: ['#F2F2F2', '#FFFFFF', '#000000'] },
  ];
  const darkMQ = matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    let t = (S && S.settings.theme) || 'auto';
    if (t === 'auto') t = darkMQ.matches ? 'night' : 'ink';
    document.documentElement.setAttribute('data-theme', t);
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    $('#meta-theme').setAttribute('content', bg || '#F2F2F7');
  }
  darkMQ.addEventListener && darkMQ.addEventListener('change', applyTheme);

  // ───────────── 日子 ─────────────
  function today() { return localDate(); }
  // 凌晨 4 点前写的，算前一天的信
  function letterDay() { const h = new Date().getHours(); return h < 4 ? addDays(today(), -1) : today(); }
  function hasText(d) { const l = S.letters[d]; return !!(l && l.text && l.text.trim()); }
  function totalLetters() { return Math.max(Object.values(S.letters).filter(l => l.text && l.text.trim()).length, S.stats.letters || 0); }
  // 第几封信：总数减去这一天之后写的
  function letterNo(d) {
    const after = Object.values(S.letters).filter(l => l.date > d && l.text && l.text.trim()).length;
    return Math.max(1, totalLetters() - after + (hasText(d) ? 0 : 1));
  }

  // ───────────── 送达：今晚寄出，明早 6 点拆 ─────────────
  // 回信在寄出时就写好了（待办点子也已入库），这里只决定什么时候给你看
  // 记「拆过哪封」用 日期|回信时间：信重寄、回信重写，就又是一封没拆的
  let opened = new Set(store.get('hx_opened2', null) || []);
  const okey = d => d + '|' + ((S.letters[d] && S.letters[d].replied_at) || '');
  const isOpened = d => opened.has(okey(d));
  function saveOpened() { store.set('hx_opened2', [...opened].sort().slice(-400)); }
  function markOpened(d) { const k = okey(d); if (!opened.has(k)) { opened.add(k); saveOpened(); } }
  // 第一次用新版本：以前收到的回信都算已经拆过，只留昨晚那封让你拆
  function initOpened() {
    if (store.get('hx_opened2', null) != null) return;
    const y = addDays(today(), -1);
    Object.values(S.letters).forEach(l => { if (l.reply && l.date !== y) opened.add(okey(l.date)); });
    saveOpened();
    store.del('hx_opened');
  }
  const deliverMode = () => (S.settings.deliver === 'now' ? 'now' : 'morning');
  const deliverAt = d => new Date(addDays(d, 1) + 'T06:00:00');
  const cutoff = d => new Date(addDays(d, 1) + 'T04:00:00');   // 过了这个点再寄，就算补写
  // 现在寄出这封信，回信要不要等到明早
  function sendsTonight(d) { return deliverMode() === 'morning' && new Date() < cutoff(d); }
  function isSealed(d) {
    const l = S.letters[d];
    if (!l || !l.reply || l.reply.imported || deliverMode() === 'now' || isOpened(d)) return false;
    if (new Date() >= deliverAt(d)) return false;
    const sentAt = l.replied_at ? new Date(l.replied_at) : new Date();
    return sentAt < cutoff(d);
  }
  // 封存中、或已送到还没拆的那封信里拆出来的事，拆开之前先不出现
  const visibleFrom = x => !x.source_date || (!isSealed(x.source_date) && x.source_date !== V._env);
  // 已经送到、还没拆的回信（最近三天里最新的一封）
  function unopenedLetter(t) {
    return Object.values(S.letters)
      .filter(l => l.reply && !l.reply.imported && !isOpened(l.date) && !isSealed(l.date) && l.date >= addDays(t, -3))
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;
  }
  const deliverNote = d => (sendsTonight(d) ? '回信明早 6:00 送到' : '寄出后马上回信');

  // ───────────── 启动 ─────────────
  function pickStartTab() {
    V.writeDate = letterDay();
    V.tab = 'today';   // 打开总是先到首页；晚上首页最上面就是「写今晚的信」
  }

  let lastRefresh = 0;
  async function refresh() {
    const b = await api('GET', '/bootstrap');
    const pendingLetters = outbox.filter(o => o.path.startsWith('/letters/')).map(o => o.path.split('/')[2]);
    const keep = {};
    pendingLetters.forEach(d => { if (S && S.letters[d]) keep[d] = S.letters[d]; });   // 本机还没寄出的信，不被云端旧版盖掉
    S = fromBoot(b);
    Object.assign(S.letters, keep);
    initOpened();
    lastRefresh = Date.now();
    toCache();
    applyTheme();
  }
  async function maybeRefresh() {
    if (!S || Date.now() - lastRefresh < 60000 || V.editing || V.replying) return;
    try { await refresh(); render(); } catch (e) { /* 离线就用缓存 */ }
  }

  async function boot() {
    const cache = store.get('hx_cache', null);
    if (cache && cache.user) {
      S = fromBoot(cache);
      initOpened();
      applyTheme();
      pickStartTab();
      render();
      try { await refresh(); if (!V.editing) render(); } catch (e) { setOnline(false); }
      flush();
      return;
    }
    try {
      await refresh();
      pickStartTab();
      render();
    } catch (e) {
      if (!S) showLogin(/请先登录/.test(e.message) ? '' : '连不上服务器，请检查网络后再试');
    }
  }
  // 封存的回信到点自动出现
  setInterval(() => { if (S && !V.editing && !V.sheets.length && V.tab === 'today') render(); }, 5 * 60e3);

  // ───────────── 登录 ─────────────
  function showLogin(msg, mode) {
    S = null;
    store.del('hx_cache');
    V.sheets = [];
    applyThemeFallback();
    const reg = mode === 'register';
    $('#app').innerHTML = `
      <form class="login" id="login-form" autocomplete="on">
        <div class="logo">Re:</div>
        <h1>回信</h1>
        <p>每晚写一封信给明早的自己，回信替你整理好一切。</p>
        <input class="input" name="username" autocomplete="username" placeholder="账号" aria-label="账号" required>
        <input class="input" style="margin-top:10px" name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="${reg ? '密码（至少 8 位）' : '密码'}" aria-label="密码" required>
        ${reg ? '<input class="input" style="margin-top:10px" name="code" placeholder="邀请码" aria-label="邀请码" autocomplete="off" required>' : ''}
        <button class="btn full" type="submit">${reg ? '注册' : '登录'}</button>
        <div class="msg" id="login-msg">${esc(msg || '')}</div>
        <button class="btn sm ghost" type="button" id="login-switch">${reg ? '已有账号？去登录' : '有邀请码？去注册'}</button>
      </form>`;
    $('#login-switch').addEventListener('click', () => showLogin('', reg ? 'login' : 'register'));
    $('#login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const btn = f.querySelector('button[type=submit]');
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = reg ? '注册中…' : '登录中…';
      try {
        const data = { username: f.username.value.trim(), password: f.password.value };
        if (reg) data.code = f.code.value.trim();
        await api('POST', reg ? '/register' : '/login', data);
        await refresh();
        pickStartTab();
        render();
      } catch (err) {
        $('#login-msg').textContent = err.message;
        btn.disabled = false; btn.textContent = label;
      }
    });
  }
  function applyThemeFallback() {
    document.documentElement.setAttribute('data-theme', darkMQ.matches ? 'night' : 'ink');
  }

  // ───────────── 渲染总入口 ─────────────
  function render() {
    if (!S) return;
    const keepScroll = V._lastTab === V.tab ? window.scrollY : 0;
    V._composing = false;
    const u = unopenedLetter(today());
    V._env = u ? u.date : null;
    const html = V.tab === 'today' ? viewToday() : V.tab === 'write' ? viewWrite() : V.tab === 'self' ? viewSelf() : V.tab === 'archive' ? viewArchive() : viewMailbox();
    const sent = V.sent && V.tab === 'write' ? viewSent() : '';
    $('#app').innerHTML = html + tabbar() + sent + V.sheets.map(viewSheet).join('');
    if (V._lastTab !== V.tab) window.scrollTo(0, 0); else window.scrollTo(0, keepScroll);
    V._lastTab = V.tab;
    afterRender();
  }

  function tabbar() {
    const dot = V.tab !== 'today' && unopenedLetter(today()) ? '<i class="badge-dot" aria-hidden="true"></i>' : '';
    const b = (id, label, icon, cls = '', extra = '') =>
      `<button class="${cls}" data-act="tab" data-v="${id}" ${V.tab === id ? 'aria-current="page"' : ''} aria-label="${label}">${icon}<span>${label}</span>${extra}</button>`;
    return `<div class="tabbar${V._composing ? ' hide-m' : ''}"><div class="brand" aria-hidden="true"><b>Re:</b><span>回信</span></div>
      <nav aria-label="主导航">${b('today', '今天', ICON.today, '', dot)}${b('self', '认识自己', ICON.self)}${b('write', '写信', ICON.pen, 'write')}${b('archive', '时光', ICON.timeline)}${b('mailbox', '信箱', ICON.box)}</nav>
      <button class="side-set" data-act="settings">${ICON.gear}<span>设置</span></button></div>`;
  }

  const offlineLine = () => `<div class="offline" data-offline ${V.online ? 'hidden' : ''}>离线中 · 改动会在联网后自动同步</div>`;
  const countBadge = () => { const n = totalLetters(); return n ? `<div class="count" aria-label="已经写了 ${n} 封信">${n}</div>` : ''; };

  // ───────────── 认识自己 ─────────────
  function viewSelf() {
    const items = (S.memories || []).slice().sort((a,b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    const names = { value:'价值观', goal:'长期目标', preference:'偏好', relationship:'重要关系', work:'工作与项目', pattern:'反复出现的模式', health:'健康相关', other:'其他' };
    const groups = Object.keys(names).map(k => {
      const list = items.filter(x => x.category === k);
      if (!list.length) return '';
      return `<details class="self-collection"><summary><span class="self-collection-name">${names[k]}</span><span class="self-collection-count">${list.length} 条线索</span></summary><div class="self-collection-body">${list.map(x => `<article class="self-memory"><p>${esc(x.content)}</p><div class="self-memory-meta"><span>${(x.evidence_dates || []).map(esc).join('、') || '手动补充'}</span><span>可信度 ${Math.round((Number(x.confidence)||0)*100)}%</span></div><div class="memory-actions"><button class="lk" data-act="memory-edit" data-v="${esc(x.id)}">修改</button><button class="lk danger-link" data-act="memory-del" data-v="${esc(x.id)}">删除</button></div></article>`).join('')}</div></details>`;
    }).join('');
    const enabled = S.settings.memory_enabled !== false;
    const categories = Object.keys(names).filter(k => items.some(x => x.category === k)).length;
    return `<main class="page self-page">
      <div class="head"><div class="head-l"><span class="eyebrow">了解自己，是一件持续发生的事</span><h1>认识自己</h1><p class="note">不急着定义你。先从真实的日常里，看见那些慢慢浮现的线索。</p></div></div>
      <section class="self-opening">
        <div class="self-opening-top"><span>PERSONAL NOTES</span><span class="self-status">${enabled ? '长期记忆开启' : '长期记忆已暂停'}</span></div>
        <div class="self-opening-title">你正在成为<br><em>更了解自己的人。</em></div>
        <div class="self-opening-bottom"><div><b>${items.length}</b><span>条长期线索</span></div><i></i><div><b>${categories}</b><span>个观察维度</span></div></div>
      </section>
      <section class="self-recent"><div class="section-intro"><div><span class="eyebrow">RECENTLY</span><h2>最近的你</h2></div><span>从近况开始</span></div>${stateCard(today())}</section>
      <section class="self-long"><div class="section-intro"><div><span class="eyebrow">OVER TIME</span><h2>慢慢形成的理解</h2></div><span>${items.length} 条</span></div>
        <p class="self-long-note">这些不是给你贴上的标签，而是从信件中整理出的阶段性理解。你可以随时展开、修改或删除。</p>
        ${groups || '<div class="card empty">还没有形成长期线索。继续写信，回信会逐步整理值得保留的内容。</div>'}
        <div class="self-footer"><button class="lk" data-act="memory-add">＋ 添加一条自己的线索</button><button class="lk muted" data-act="settings">记忆设置 ›</button></div>
      </section>
    </main>`;
  }

  // ───────────── 时光  // ───────────── 时光 ─────────────
  function viewArchive() {
    const letters = Object.values(S.letters).filter(x => x.text && x.text.trim());
    const digests = S.digests || [];
    const spanDays = S.stats.first ? diffDays(today(), S.stats.first) + 1 : 0;
    const tabs = [['timeline','时间线'],['week','周信'],['quarter','季信'],['year','年信']];
    const seg = `<div class="seg archive-seg" role="tablist" aria-label="时光分类">${tabs.map(([k,n]) => `<button role="tab" aria-selected="${V.archiveTab === k}" data-act="archive-tab" data-v="${k}">${n}</button>`).join('')}</div>`;
    const content = V.archiveTab === 'timeline' ? timeline(today()) : digestList(V.archiveTab, today());
    return `<main class="page archive-page">
      <div class="head"><div class="head-l"><span class="eyebrow">每一段经历，都有它的位置</span><h1>时光</h1><p class="note">把走过的日子留在这里。多年以后，再回来看看当时的自己。</p></div></div>
      <section class="archive-cover">
        <div class="archive-cover-label">YOUR LIFE, IN MOMENTS</div>
        <div class="archive-cover-quote">时间没有替你<br>留下些什么，<br><em>是你自己留下了。</em></div>
        <div class="archive-cover-stats"><div><b>${S.stats.letters || letters.length}</b><span>封信</span></div><div><b>${digests.length}</b><span>篇回顾</span></div><div><b>${spanDays}</b><span>记录天数</span></div></div>
      </section>
      ${seg}
      <div class="archive-content">${content}</div>
    </main>`;
  }

  // ───────────── 今天  // ───────────── 今天 ─────────────
  function viewToday() {
    const t = today();
    const h = new Date().getHours();
    return `<main class="page">
      <div class="head">
        <div class="head-l"><span class="eyebrow">${cn(t)} 星期${wd(t)}</span><h1>${h >= 4 && h < 11 ? '早上好' : '今天'}</h1></div>
        ${countBadge()}
      </div>
      ${offlineLine()}
      ${heroBlock(t)}
      ${pendingBlock(t)}
      ${ideasBlock(t)}
      ${memoryBlock(t)}
    </main>`;
  }

  // 首页的主角：按时段和信的状态换
  function heroBlock(t) {
    const h = new Date().getHours();
    const night = h >= 17 || h < 4;
    const ld = letterDay(), yday = addDays(t, -1);
    const u = unopenedLetter(t);
    if (u) return envelopeCard(u, t);
    if (hasText(ld) && (isSealed(ld) || (V.replying && V.writeDate === ld && sendsTonight(ld)))) return sealedCard(ld);
    if (!night && h < 12 && !hasText(ld) && !hasText(yday) && S.stats.letters > 0 && !store.get('hx_skipbf_' + yday, false)) return backfillCard(yday);
    if (!hasText(ld) && night) return writeCard(ld, '今晚');
    const last = [ld, yday].find(d => hasText(d) && S.letters[d].reply);
    if (last) return readRow(last, t);
    return hasText(ld) ? '' : writeCard(ld, h < 17 ? '今天' : '今晚');
  }
  function envelopeCard(l, t) {
    const r = l.reply;
    const nT = (r.todos || []).length, nI = (r.ideas || []).length;
    const who = l.date === addDays(t, -1) || l.date === t ? '昨晚的你来信了' : `${cn(l.date)}的回信到了`;
    return `<button class="envelope" data-act="open-reply" data-v="${l.date}">${ENVELOPE}
      <span><span class="env-t" style="display:block">${who}</span><span class="env-s" style="display:block">No.${letterNo(l.date)}${nT ? ` · ${nT} 件待办` : ''}${nI ? ` · ${nI} 个点子` : ''}</span></span>
      <span class="env-btn">拆开</span></button>`;
  }
  function sealedCard(d) {
    const busy = V.replying && V.writeDate === d;
    return `<div class="card hero"><div class="hero-top">
        <span class="hero-ic">${ICON.boxSm}</span>
        <div style="flex:1;min-width:0"><div class="hero-t">${d === letterDay() ? '今晚的信已寄出' : cn(d) + '的信已寄出'}</div>
        <div class="hero-s">${busy ? '回信正在连夜整理…' : '回信明早 6:00 送到'}</div></div>
        <button class="btn sm ghost" data-act="take-back" data-v="${d}">拿回来改</button></div></div>`;
  }
  function backfillCard(d) {
    return `<div class="card hero" style="align-items:center;text-align:center;padding-top:24px">
      <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true"><rect x="2" y="2" width="116" height="76" rx="12" style="fill:var(--tile);stroke:var(--ring)" stroke-width="2" stroke-dasharray="6 5"/><path d="M6 7 L60 46 L114 7" fill="none" style="stroke:var(--ring)" stroke-width="2" stroke-dasharray="6 5"/></svg>
      <div class="hero-t" style="font-size:20px">昨晚没有写信</div>
      <div class="hero-s" style="font-size:14px;line-height:1.6">现在补上也来得及。补写的信寄出后，回信马上送到，拆出来的事直接放进今天。</div>
      <button class="btn full" data-act="write-day" data-v="${d}">补写 ${cn(d)}的信</button>
      <button class="lk muted" data-act="skip-backfill" data-v="${d}">今天先不补</button></div>`;
  }
  function writeCard(d, label) {
    return `<div class="card hero"><div class="hero-top">
        <span class="hero-ic">${ICON.pen}</span>
        <div><div class="hero-t">${label}的信还没写</div><div class="hero-s">${S.habits.length ? '写信时顺手打卡 · ' : ''}${deliverNote(d)}</div></div></div>
      <button class="btn full" data-act="write-day" data-v="${d}">写${label}的信</button></div>`;
  }
  function readRow(d, t) {
    const l = S.letters[d];
    const first = String(l.reply.summary || '').split(/[。！？\n]/).map(s => s.trim()).filter(Boolean).pop() || '';
    const who = d === addDays(t, -1) ? '昨晚的回信' : d === t ? '今天的回信' : cn(d) + '的回信';
    return `<button class="card row tap" style="margin-top:16px;min-height:64px" data-act="open-reply" data-v="${d}">
      <span class="ic">${ICON.boxSm}</span>
      <span class="row-main"><span style="font-size:15px;font-weight:600">${who} · 已拆开</span><span class="sub one-line">${first ? '“' + esc(first) + '”' : 'No.' + letterNo(d)}</span></span>
      <span style="font-size:15px;color:var(--ink)">再读</span>${ICON.chev}</button>`;
  }

  // 旧信里翻出来的一句话（30 天以前写的），点一下换一句
  function memoryBlock(t) {
    const old = Object.values(S.letters).filter(l => l.text && diffDays(t, l.date) >= 30);
    if (!old.length) return '';
    const l = old[(hash(t) + V.quoteOffset) % old.length];
    const sents = l.text.split(/[。！？!?\n]/).map(s => s.trim()).filter(s => s.length >= 8 && s.length <= 60);
    if (!sents.length) return '';
    const q = sents[hash(t + l.date) % sents.length];
    return `<button class="card memo tap" data-act="quote" aria-label="换一句">
      <span class="lab">${diffDays(t, l.date)} 天前的你写道</span>
      <span class="q">${esc(q)}。</span>
      <span class="sub">${cn(l.date)}的信 · 点一下换一句</span></button>`;
  }

  function dueInfo(td, t) {
    if (!td.due) return null;
    const n = diffDays(td.due, t);
    if (n < 0) return { cls: 'red', label: `过期 ${-n} 天`, rank: 0 };
    if (n === 0) return { cls: 'red', label: '今天', rank: 1 };
    if (n === 1) return { cls: 'amber', label: '明天到期', rank: 2 };
    return { cls: '', label: n < 7 ? '周' + wd(td.due) : cn(td.due), rank: 3 };
  }
  function openTodos(t) {
    return S.todos.filter(x => !x.done && !x.archived && !x.dropped_at && visibleFrom(x)).sort((a, b) => {
      const da = dueInfo(a, t), db = dueInfo(b, t);
      const ra = da ? da.rank : 4, rb = db ? db.rank : 4;
      if (ra !== rb) return ra - rb;
      return (a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : (a.created < b.created ? 1 : -1);
    });
  }
  const openIdeas = () => S.ideas.filter(i => i.status === 'open' && visibleFrom(i));
  function staleIdeas(t) { return openIdeas().filter(i => diffDays(t, i.created) >= 7); }
  function srcLine(x, t) {
    if (!x.source_date) return { text: '自己加的', cls: '' };
    if (x.source_date === addDays(t, -1)) return { text: `昨晚的信 · No.${letterNo(x.source_date)}`, cls: 'hot' };
    if (x.source_date === t) return { text: '今天的信', cls: 'hot' };
    return { text: cn(x.source_date) + '的信', cls: '' };
  }

  function todoRow(x, t) {
    const d = dueInfo(x, t);
    const s = srcLine(x, t);
    const tail = x.dropped_at ? `<span class="pill">${cn(x.dropped_at)} 放下</span>`
      : x.done ? `<span class="pill green">${x.done_at ? cn(x.done_at) + ' 完成' : '完成'}</span>` : d ? `<span class="pill ${d.cls}">${d.label}</span>` : '';
    const note = x.note ? `<span class="sub todo-note">${esc(x.note)}</span>` : '';
    const ck = x.dropped_at
      ? `<span class="ck dropped" aria-hidden="true"><i>${ICON.x}</i></span>`
      : `<button class="ck ${x.done ? 'on' : ''}" data-act="todo-toggle" data-v="${x.id}" aria-pressed="${x.done}" aria-label="${x.done ? '标为未完成' : '完成'}：${esc(x.text)}"><i>${ICON.checkSm}</i></button>`;
    return `<div class="row">
      ${ck}
      <button class="row-main ${x.done || x.dropped_at ? 'done' : ''}" data-act="todo-edit" data-v="${x.id}"><span>${esc(x.text)}</span>${note}<span class="sub ${x.done || x.dropped_at ? '' : s.cls}">${s.text}</span></button>
      ${tail}</div>`;
  }
  function ideaRow(i, opts = {}) {
    const age = diffDays(today(), i.created);
    const sub = age >= 7 ? `点子 · ${age} 天没动了` : `点子 · ${i.source_date ? cn(i.source_date) + '的信' : '自己记的'}`;
    return `<div class="row">
      <span class="ic sm idea">${ICON.bulb}</span>
      <button class="row-main" data-act="idea-edit" data-v="${i.id}"><span>${esc(i.text)}</span><span class="sub ${age >= 7 ? 'warm' : ''}">${sub}</span></button>
      <button class="lk" data-act="idea-todo" data-v="${i.id}">转待办</button>
      ${opts.drop ? `<button class="lk muted" data-act="idea-drop" data-v="${i.id}">放下</button>` : ''}</div>`;
  }

  // 待处理：到期提醒和「放久了的点子」都合在这一张卡片里
  function pendingBlock(t) {
    const h = new Date().getHours();
    const todos = openTodos(t);
    const showT = todos.slice(0, 4);
    // 今天完成的：刚勾掉的那几条留几秒（点错了能撤回），其余合成一行
    const recentDone = S.todos.filter(x => x.done && x.done_at === t && !x.dropped_at && visibleFrom(x));
    const justDone = recentDone.filter(x => V.justDone && V.justDone[x.id] > Date.now());
    const doneLine = recentDone.length > justDone.length
      ? `<button class="row done-line" data-act="lists" data-v="done"><span class="ck on" aria-hidden="true"><i>${ICON.checkSm}</i></span><span class="row-main"><span>今天完成了 ${recentDone.length} 件</span></span><span class="lk muted">查看 ›</span></button>` : '';
    const body = (showT.length || recentDone.length)
      ? showT.map(x => todoRow(x, t)).join('') + justDone.map(x => todoRow(x, t)).join('') + doneLine
      : `<div class="empty">没有待处理的事。写信时提到要做的事、冒出的点子，回信会自动放到这里。</div>`;
    const more = todos.length - showT.length;
    const env = V._env && S.letters[V._env] ? (S.letters[V._env].reply.todos || []).length : 0;
    return `<div class="gh"><h2>${h >= 4 && h < 12 ? '今天要做的' : '待处理'}</h2>${env ? `<span>拆信后再加 ${env} 件</span>` : `<span class="gh-links"><button class="lk muted" data-act="lists" data-v="todos">待办 ${todos.length} ›</button></span>`}</div>
      <div class="card">${body}
        <div class="row foot"><button class="lk" data-act="todo-new">＋ 加一件事</button>
        <button class="lk muted" data-act="lists" data-v="todos">${more > 0 ? `还有 ${more} 项 ›` : '全部 ›'}</button></div></div>`;
  }

  // ───────── 完成 / 放下：按时间分组，条数少全展开，条数多时只展开最近的 ─────────
  function doneHistory(t) {
    const mode = V.doneMode || 'done';
    const pool = S.todos.concat((Array.isArray(V.olderTodos) ? V.olderTodos : []).filter(o => !S.todos.some(x => x.id === o.id)));
    const doneL = pool.filter(x => x.done && !x.dropped_at && x.done_at);
    const dropL = pool.filter(x => x.dropped_at);
    const list = (mode === 'done' ? doneL : dropL).map(x => ({ x, d: mode === 'done' ? x.done_at : x.dropped_at }))
      .sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
    const toggle = `<div class="mini-seg" role="tablist">
      <button role="tab" aria-selected="${mode === 'done'}" data-act="done-mode" data-v="done">完成 ${doneL.length}</button>
      <button role="tab" aria-selected="${mode === 'dropped'}" data-act="done-mode" data-v="dropped">放下 ${dropL.length}</button></div>`;
    const older = V.olderTodos === undefined
      ? `<div class="fold"><button class="lk muted" data-act="older-todos">查看 30 天以前的 ›</button></div>`
      : V.olderTodos === 'loading' ? `<div class="fold"><span class="sub">正在找…</span></div>` : '';
    if (!list.length) {
      return toggle + `<div class="card"><div class="empty">${mode === 'done' ? '最近还没有完成的待办。' : '还没有放下的事。做不了或决定不做的待办，点开选「放下」会收在这里。'}</div></div>` + older;
    }
    // 分组：今天 / 昨天 / 这周 / 某一周（35 天内）/ 某个月（更早）
    const wk = weekKey(t);
    const groupOf = d => d === t ? ['today', '今天'] : d === addDays(t, -1) ? ['yday', '昨天']
      : weekKey(d) === wk ? ['week', '这周']
      : diffDays(t, d) <= 35 ? ['w' + weekKey(d), weekKey(d) === addDays(wk, -7) ? '上周' : `${cn(weekKey(d))}那一周`]
      : ['m' + d.slice(0, 7), `${d.slice(0, 4) === t.slice(0, 4) ? '' : d.slice(0, 4) + '年'}${Number(d.slice(5, 7))}月`];
    const groups = [];
    list.forEach(it => {
      const [k, label] = groupOf(it.d);
      let g = groups.find(y => y.k === k);
      if (!g) groups.push(g = { k, label, items: [] });
      g.items.push(it);
    });
    // 总数不多就全部展开；多了只展开最近的（今天、昨天、这周），其余点开再看
    const few = list.length <= 12;
    const opened = V.openGroups || (V.openGroups = {});
    const html = groups.map((g, gi) => {
      const open = g.k in opened ? opened[g.k] : (few || ['today', 'yday', 'week'].includes(g.k) || (gi === 0 && !groups.some(y => ['today', 'yday', 'week'].includes(y.k))));
      const head = `<button class="grp-h" data-act="done-group" data-v="${g.k}" aria-expanded="${open}">
        <span>${g.label}</span><span class="grp-n">${mode === 'done' ? '完成' : '放下'} ${g.items.length} 件<i class="grp-chev ${open ? 'up' : ''}">›</i></span></button>`;
      const rows = open ? g.items.map(({ x, d }) => historyRow(x, d, g.k)).join('') : '';
      return `<div class="card grp">${head}${rows}</div>`;
    }).join('');
    return toggle + html + older;
  }
  function historyRow(x, d, gk) {
    const showDate = !['today', 'yday'].includes(gk);
    const ck = x.dropped_at
      ? `<span class="ck dropped" aria-hidden="true"><i>${ICON.x}</i></span>`
      : `<button class="ck on" data-act="todo-toggle" data-v="${x.id}" aria-pressed="true" aria-label="标为未完成：${esc(x.text)}"><i>${ICON.checkSm}</i></button>`;
    return `<div class="row hist">${ck}
      <button class="row-main" data-act="todo-edit" data-v="${x.id}"><span>${esc(x.text)}</span>${x.note ? `<span class="sub todo-note">${esc(x.note)}</span>` : ''}</button>
      ${showDate ? `<span class="hist-d">${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}</span>` : ''}</div>`;
  }

  // 首页的点子：最新的在前，待办少时多放几条；放了 7 天以上没动的留一个位置提醒
  function ideasBlock(t) {
    const all = openIdeas();
    if (!all.length) return '';
    const limit = openTodos(t).length <= 1 ? 5 : 3;
    const byNew = all.slice().sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0));
    const fresh = byNew.filter(i => diffDays(t, i.created) < 7);
    const stale = staleIdeas(t);
    let show = fresh.slice(0, stale.length ? limit - 1 : limit);
    if (stale.length) show.push(stale[hash(t) % stale.length]);
    if (show.length < limit) show = show.concat(byNew.filter(i => !show.includes(i)).slice(0, limit - show.length));
    const more = all.length - show.length;
    return `<div class="gh"><h2>点子</h2><span>${fresh.length ? `最近 7 天 ${fresh.length} 个` : '最近没有新点子'}</span></div>
      <div class="card">${show.map(i => ideaRow(i, { drop: true })).join('')}
        <div class="row foot"><button class="lk" data-act="idea-new">＋ 记一个点子</button>
        <button class="lk muted" data-act="lists" data-v="ideas">${more > 0 ? `全部 ${all.length} 个 ›` : '全部 ›'}</button></div></div>`;
  }

  // ───────────── 写信 ─────────────
  const PROMPTS = ['今天哪一刻最有劲？', '有什么在回避？', '明天要做的事：', '今天想记住的一句话：'];
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  function viewWrite() {
    const d = V.writeDate || letterDay();
    const t = today();
    const h = new Date().getHours();
    const l = S.letters[d] || { date: d, text: '' };
    const draft = store.get('hx_draft_' + d, null);
    const text = draft != null ? draft : (l.text || '');
    const showEditor = V.editing || !l.text || !l.text.trim() || (!l.reply && !V.replying && !V.replyErr && draft != null && draft !== l.text);
    const isToday = d === letterDay();
    const label = isToday ? (h >= 17 || h < 4 ? '今晚' : '今天') : d === addDays(letterDay(), -1) ? '补写昨天' : '补写';
    const canNext = d < letterDay();
    V._composing = showEditor;

    const bar = `<div class="wbar">
      ${showEditor ? `<button class="round-btn" data-act="tab" data-v="today" aria-label="关闭">${ICON.x}</button>` : '<span style="width:40px"></span>'}
      <div class="daynav">
        <button class="nav-btn" data-act="day" data-v="-1" aria-label="前一天">${ICON.left}</button>
        <div class="lab"><b>${label}</b><span>${cn(d)} 星期${wd(d)}</span></div>
        <button class="nav-btn" data-act="day" data-v="1" aria-label="后一天" ${canNext ? '' : 'disabled'}>${ICON.right}</button>
      </div>
      <span class="save-state" id="save-state">${showEditor && text ? '已存' : ''}</span></div>`;
    const to = isToday ? '致 明早的我' : `补写 · ${cn(d)}`;

    if (showEditor) {
      return `<main class="page bare" style="padding-bottom:calc(var(--safe-bottom) + 130px)">${bar}${offlineLine()}
        <div class="card paper"><div class="paper-h"><span>${to}</span><span class="no-tag">No.${letterNo(d)}</span></div>
          <textarea class="editor" id="editor" placeholder="今天过得怎么样？做了什么、想到什么、哪里卡住了，随便写。&#10;&#10;写完点「寄出」，回信会帮你整理好其余的一切。" aria-label="信的内容">${esc(text)}</textarea></div>
        <div class="chips" role="group" aria-label="不知道写什么时，点一个">${PROMPTS.map(p => `<button class="chip" data-act="chip" data-v="${esc(p)}"><i></i>${esc(p)}</button>`).join('')}</div>
        ${habitStrip(d)}
        <div class="send-bar"><div>
          <div class="send-row">
            ${SR ? `<button class="mic" id="mic" data-act="mic" aria-label="语音写信">${ICON.mic}</button>` : ''}
            ${V.editing && l.reply ? `<button class="btn ghost" data-act="cancel-edit">取消</button>` : ''}
            <button class="btn" data-act="send" id="send-btn" ${text.trim() ? '' : 'disabled'}>${ICON.send}${l.reply ? '重新寄出' : '寄出'}</button>
          </div>
          <span class="send-note">${deliverNote(d)}${sendsTonight(d) ? ' · 送到前都可以拿回来改' : ''}</span>
        </div></div>
      </main>`;
    }

    let after;
    if (V.replying && V.writeDate === d) {
      after = sendsTonight(d)
        ? `<div class="card hero sealed"><div class="hero-top"><span class="hero-ic">${ICON.boxSm}</span><div><div class="hero-t">已寄出</div><div class="hero-s">回信正在连夜整理，明早 6:00 送到</div></div></div></div>`
        : `<div class="card sealed"><div class="waiting"><svg class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 1-9 9"/></svg>正在拆信、整理待办和点子…</div></div>`;
    } else if (V.replyErr && V.writeDate === d) {
      after = `<div class="card pad sealed" style="display:flex;flex-direction:column;gap:12px;font-size:15px;line-height:1.6"><span>信已经存好了，但回信暂时没写成：${esc(V.replyErr)}</span><button class="btn sm" style="align-self:flex-start" data-act="retry-reply">再试一次</button></div>`;
    } else if (!l.reply) {
      after = `<div class="card pad sealed" style="display:flex;flex-direction:column;gap:12px;font-size:15px"><span class="muted">这封信还没有回信。</span><button class="btn sm" style="align-self:flex-start" data-act="retry-reply">让回信回一封</button></div>`;
    } else if (isSealed(d)) {
      after = sealedCard(d);
    } else {
      after = replyView(l, {});
    }
    return `<main class="page">${bar}${offlineLine()}
      <div class="card paper"><div class="paper-h"><span>${to}</span><span class="no-tag">No.${letterNo(d)}</span></div>
        <p class="letter-text">${esc(l.text)}</p></div>
      ${isSealed(d) || V.replying ? '' : `<div style="padding:0 4px"><button class="lk" data-act="edit-letter">修改这封信</button></div>`}
      ${habitStrip(d)}
      ${after}
    </main>`;
  }

  // 写信时顺手打卡：只打这一天的
  function habitStrip(d) {
    if (!S.habits.length || d < addDays(today(), -6)) return '';
    const hs = S.habits.map(h => {
      const on = S.logs.has(h.id + '|' + d);
      return `<button class="hb ${on ? 'on' : ''}" data-act="habit" data-v="${h.id}" data-d="${d}" aria-pressed="${on}" aria-label="${esc(h.name)}${on ? ' 已完成' : ' 未完成'}">${ICON.check}${esc(h.name)}</button>`;
    }).join('');
    return `<div class="card habits"><span>${d === today() ? '今天的习惯' : cn(d) + '的习惯'}</span>${hs}</div>`;
  }

  // 寄出后的那一屏：信封落下、盖戳，回信在后台连夜整理
  function viewSent() {
    const d = V.sent.date;
    const busy = V.replying && V.writeDate === d;
    const err = !busy && V.replyErr && V.writeDate === d;
    const step2 = busy
      ? `<span class="dot"><svg class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9F0A" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 1-9 9"/></svg></span><span class="t">连夜拆信、整理待办和点子</span>`
      : err ? `<span class="dot err">!</span><span class="t">整理时出了点问题</span><button class="btn sm" data-act="retry-reply">再试</button>`
        : `<span class="dot ok">${ICON.check}</span><span class="t">待办和点子都整理好了</span>`;
    return `<div class="sent" role="dialog" aria-modal="true" aria-label="信已寄出">
      <div class="env-wrap"><svg width="300" height="190" viewBox="0 0 300 190" role="img" aria-label="封好的信封，邮戳 No.${letterNo(d)}">
        <rect width="300" height="190" rx="16" fill="#FFFFFF"/>
        <path d="M8 8 L150 110 L292 8" fill="none" stroke="#E5E5EA" stroke-width="2"/>
        <rect x="236" y="18" width="46" height="54" rx="6" fill="#FFE3DE"/>
        <text x="259" y="53" text-anchor="middle" font-size="20" font-weight="700" fill="#D0402B">回</text>
        <g class="pm"><circle cx="236" cy="64" r="28" fill="none" stroke="#D0402B" stroke-width="2" opacity=".85"/>
          <text x="236" y="60" text-anchor="middle" font-size="8" fill="#D0402B">${d.replace(/-/g, '.')}</text>
          <text x="236" y="74" text-anchor="middle" font-size="12" font-weight="700" fill="#D0402B">No.${letterNo(d)}</text></g>
        <text x="24" y="166" font-size="14" fill="#6C6C70">致 明早的我</text></svg></div>
      <h1>已寄出</h1>
      <p class="lead">好好睡一觉，剩下的交给回信。</p>
      <div class="steps">
        <div class="row"><span class="dot ok">${ICON.check}</span><span class="t">信已寄出</span><span class="tm">${hm(V.sent.at)}</span></div>
        <div class="row">${step2}</div>
        <div class="row"><span class="dot">${ICON.clock}</span><span class="t dim">明早 6:00 送到</span></div>
      </div>
      <div class="sent-btns">
        <button class="btn dark" data-act="take-back" data-v="${d}">拿回来改</button>
        <button class="btn light" data-act="sent-close">晚安</button>
      </div></div>`;
  }

  // ───────────── 回信 ─────────────
  function replyView(l, opts) {
    const r = l.reply;
    const t = today();
    let h = '';
    if (opts.mine) {
      const first = l.text.split('\n').map(s => s.trim()).find(Boolean) || '';
      h += `<details class="card mine mt"><summary class="row"><span class="ic gray">${ICON.penSm}</span>
        <span class="row-main"><span style="font-size:15px;font-weight:600">你写的信</span><span class="sub one-line">${esc(first)}</span></span>${ICON.chev}</summary>
        <p class="letter-text">${esc(l.text)}</p></details>`;
    }
    const paras = String(r.summary || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
    const when = l.replied_at ? new Date(l.replied_at) : null;
    const sealedOnce = when && when < cutoff(l.date) && deliverMode() === 'morning';
    const whenTxt = r.imported ? '从 Life OS 搬过来的旧信'
      : sealedOnce ? `${cn(addDays(l.date, 1))} 6:00 送到` : when ? `${cn(localDate(when))} ${hm(when)} 收到` : '';
    if (r.observation) h += `<div class="gh"><h2>我注意到</h2><span>一条可被你纠正的观察</span></div><div class="card pad" style="line-height:1.7">${esc(r.observation)}<div class="sub" style="margin-top:10px">回应方式：${esc(r.mode || '倾听')} · 这只是基于现有信件的观察，不是对你的定论。</div></div>`;
    h += `<article class="card reply-letter">${paras || '<p class="muted">（这封回信没有正文）</p>'}
      <div class="reply-sign"><b>Re: 回信</b><span>${esc(whenTxt)}${r.engine ? ' · ' + esc(r.engine) : ''}</span></div></article>`;

    const tds = r.todos || [], ids = r.ideas || [];
    if (tds.length || ids.length) {
      const rows = tds.map((x, i) => {
        const live = S.todos.find(y => y.id === x.id) || x;
        const due = live.due;
        const badge = live.dropped_at ? '已放下' : live.done ? '已完成' : due && due <= t ? '已放进今天' : '已加入待办';
        return `<div class="row"><span class="ic">${ICON.check}</span>
          <span class="row-main"><span>${esc(x.text)}</span><span class="sub">待办${due ? ' · ' + (due === t ? '今天' : cn(due)) : ''}</span></span>
          <span class="pill green pop" style="animation-delay:${0.6 + i * 0.2}s">${badge}</span></div>`;
      }).join('') + ids.map((x, i) => `<div class="row"><span class="ic idea">${ICON.bulb}</span>
          <span class="row-main"><span>${esc(x.text)}</span><span class="sub">点子</span></span>
          <span class="pill green pop" style="animation-delay:${0.6 + (tds.length + i) * 0.2}s">已收进点子库</span></div>`).join('');
      h += `<div class="gh"><h2>附件</h2><span>从你的信里整理出来的</span></div><div class="card">${rows}</div>`;
    }
    if (r.energy) {
      h += `<div class="card stats mt">
        <div class="stat"><span>精力</span><b>${r.energy}<small> / 5</small></b></div>
        <div class="stat"><span>情绪</span><b>${esc(r.mood || '—')}</b></div>
        <div class="stat"><span>高光</span><b>${esc(r.highlight || '—')}</b></div></div>`;
    }
    const L = r.lenses || {};
    if (L.health || L.energy || L.career || L.relation) {
      const v = S.feedback[l.date + '|lenses'] || 0;
      const ln = LENSES.map(([k, n, c]) => `<div class="row lens"><span class="ic" style="background:${c}" aria-hidden="true">${n[0]}</span>
        <span class="row-main"><span>${n}</span><span>${L[k] ? esc(L[k]) : '<span class="muted">信里没提到</span>'}</span></span></div>`).join('');
      h += `<div class="gh"><h2>四个角度</h2><span style="color:var(--ink);font-weight:600">实验</span></div>
        <div class="card">${ln}<div class="row foot"><span class="small muted">这部分对你有用吗？</span>
          <div class="seg2"><button class="${v > 0 ? 'on' : ''}" data-act="fb" data-v="lenses" data-d="${l.date}" data-x="1">有用</button><button class="${v < 0 ? 'on' : ''}" data-act="fb" data-v="lenses" data-d="${l.date}" data-x="-1">没用</button></div></div></div>`;
    }
    if (r.ownError) h += `<p class="note">你自己的 AI 这次没接通（${esc(r.ownError)}），这封先用免费模型写的。可以去「设置 → AI 回信」检查一下。</p>`;
    if (opts.go) h += `<button class="btn full" style="margin-top:20px" data-act="go-today">去看今天要做的</button>`;
    return h;
  }
  const LENSES = [['health', '健康', '#FF2D55'], ['energy', '精力', '#E07A00'], ['career', '事业', '#007AFF'], ['relation', '关系', '#248A3D']];

  // ───────────── 信箱 ─────────────
  function viewMailbox() {
    const t = today();
    const firstDate = S.stats.first;
    const days = firstDate ? diffDays(t, firstDate) + 1 : 0;
    const letters = Object.values(S.letters).filter(l => l.text && l.text.trim()).sort((a,b) => a.date < b.date ? 1 : -1);
    const unread = letters.filter(l => l.reply && !isSealed(l.date) && !isOpened(l.date));
    const filters = [['all','全部'],['unread','未读回信'],['mine','我写的'],['replies','AI 回信']];
    const seg = `<div class="seg mailbox-seg" role="tablist" aria-label="交流分类">${filters.map(([k,n]) => `<button role="tab" aria-selected="${V.mb === k}" data-act="mb" data-v="${k}">${n}</button>`).join('')}</div>`;
    const featured = unread[0] || letters[0] || null;
    const spotlight = featured ? (() => {
      const sealed = isSealed(featured.date);
      const reply = featured.reply && !sealed ? String(featured.reply.summary || '伙伴已经给你回信。') : '';
      const own = String(featured.text || '').trim();
      return `<section class="conversation-feature">
        <div class="conversation-feature-head"><span>最近一次交流</span><span>${cn(featured.date)} · No.${letterNo(featured.date)}</span></div>
        <div class="conversation-bubble mine"><small>你</small><p>${esc(own.slice(0,105))}${own.length>105?'…':''}</p></div>
        ${reply ? `<div class="conversation-bubble partner"><small>回信</small><p>${esc(reply.slice(0,125))}${reply.length>125?'…':''}</p></div>` : `<div class="conversation-wait">${sealed ? '这封回信会在明早 6:00 送达' : '伙伴正在等你继续分享下一件事'}</div>`}
        <button class="conversation-open" data-act="${reply ? 'open-reply' : 'letter'}" data-v="${featured.date}">${reply ? (unread.includes(featured) ? '阅读新回信' : '继续这次交流') : '查看这次交流'} ${ICON.chev}</button>
      </section>`;
    })() : `<section class="conversation-feature conversation-empty"><span class="eyebrow">A PLACE TO TALK</span><h2>这里一直有个位置，<br>留给你慢慢说。</h2><p>写下最近的心情、困惑或一个小念头。你的伙伴会认真读完，再给你回应。</p><button class="btn sm" data-act="tab" data-v="write">写第一封信</button></section>`;
    let list = V.mb === 'unread' ? unread : V.mb === 'mine' ? letters : V.mb === 'replies' ? letters.filter(l => l.reply) : letters;
    if (featured && V.mb === 'all') list = list.filter(l => l.date !== featured.date);
    const rows = list.map(l => {
      const waiting = l.reply && !isSealed(l.date) && !isOpened(l.date);
      const line = l.reply && !isSealed(l.date) ? String(l.reply.summary || '伙伴已经给你回信') : String(l.text || '你写下的一封信');
      const status = isSealed(l.date) ? '回信明早送达' : waiting ? '有新回信' : l.reply ? '已读' : '等待回信';
      return `<button class="conversation-row" data-act="letter" data-v="${l.date}">
        <span class="conversation-day"><b>${Number(l.date.slice(8))}</b><small>${Number(l.date.slice(5,7))}月</small></span>
        <span class="conversation-row-copy"><strong>${esc(line.slice(0,72))}${line.length>72?'…':''}</strong><small>${cn(l.date)} · ${status}</small></span>${ICON.chev}
      </button>`;
    }).join('');
    const empty = V.mb === 'unread' ? '暂时没有未读回信。' : V.mb === 'replies' ? '还没有收到 AI 回信。' : V.mb === 'mine' ? '你写下的信会留在这里。' : '更多交流会按时间留在这里。';
    const monthN = letters.filter(l => l.date.slice(0,7) === t.slice(0,7)).length;
    const tools = `<div class="mailbox-quick"><button data-act="lists" data-v="todos"><span>待办清单</span><b>${openTodos(t).length}</b></button><button data-act="lists" data-v="ideas"><span>灵感收藏</span><b>${openIdeas().length}</b></button><span>本月 ${monthN} 次交流</span></div>`;
    return `<main class="page mailbox-page">
      <div class="head"><div class="head-l"><span class="eyebrow">${days ? '已经一起走过 ' + days + ' 天' : '从一次交流开始'}</span><h1>信箱</h1><p class="note">不只是收信，也是你和 AI 伙伴持续对话的地方。</p></div><button class="round-btn" data-act="settings" aria-label="设置">${ICON.gear}</button></div>
      ${offlineLine()}
      <section class="mailbox-presence"><span class="presence-orbit"><i></i></span><div><b>AI 伙伴</b><small>${unread.length ? unread.length + ' 封回信等你阅读' : '在这里，继续上一次没说完的话'}</small></div><span class="presence-dot"></span></section>
      ${spotlight}
      ${seg}
      <div class="gh"><h2>${V.mb === 'unread' ? '未读回信' : V.mb === 'mine' ? '我写下的' : V.mb === 'replies' ? '伙伴的回信' : '更早的交流'}</h2><span>${list.length} 次</span></div>
      <div class="conversation-list">${rows || `<div class="card empty">${empty}</div>`}</div>
      ${tools}
    </main>`;
  }

  function energySeries  function energySeries(t, n) {
    const pts = [];
    for (let i = n; i >= 1; i--) {
      const d = addDays(t, -i);
      const l = S.letters[d];
      pts.push({ d, v: l && l.energy && !isSealed(d) ? l.energy : null, mood: l && !isSealed(d) ? l.mood : null });
    }
    const tl = S.letters[t];
    pts.push({ d: t, v: tl && tl.energy && !isSealed(t) ? tl.energy : null, mood: tl && !isSealed(t) ? tl.mood : null });
    return pts;
  }
  function chartSvg(pts, label) {
    const W = 350, H = 88, n = pts.length;
    const x = i => (n === 1 ? W / 2 : (i * (W - 4)) / (n - 1) + 2);
    const y = v => 80 - (v - 1) * 17;
    let segs = [], cur = [];
    pts.forEach((p, i) => {
      if (p.v == null) { if (cur.length) segs.push(cur); cur = []; return; }
      cur.push(`${x(i).toFixed(1)},${y(p.v).toFixed(1)}`);
    });
    if (cur.length) segs.push(cur);
    const lines = segs.map(s => s.length > 1
      ? `<polyline points="${s.join(' ')}" fill="none" style="stroke:var(--ink)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`
      : `<circle cx="${s[0].split(',')[0]}" cy="${s[0].split(',')[1]}" r="2.5" style="fill:var(--ink)"/>`).join('');
    let lastI = -1;
    pts.forEach((p, i) => { if (p.v != null) lastI = i; });
    const last = lastI >= 0 ? `<circle cx="${x(lastI).toFixed(1)}" cy="${y(pts[lastI].v).toFixed(1)}" r="4.5" style="fill:var(--card);stroke:var(--ink)" stroke-width="2.4"/>` : '';
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
      <line x1="0" y1="${y(1) + 2}" x2="${W}" y2="${y(1) + 2}" style="stroke:var(--sep)" stroke-width="1"/>
      <line x1="0" y1="${y(3)}" x2="${W}" y2="${y(3)}" style="stroke:var(--sep)" stroke-width="1" stroke-dasharray="2 4"/>
      ${lines}${last}</svg>`;
  }
  // 状态：近 30 天精力、情绪、习惯完成率。趋势一周看一次就够，所以放在信箱
  function stateCard(t) {
    const n = 30;
    const pts = energySeries(t, n);
    const vals = pts.filter(p => p.v != null);
    const head = `<div class="gh"><h2>状态</h2><span>近 ${n} 天</span></div>`;
    if (vals.length < 3) return head + `<div class="card empty">写几天信之后，回信会给每天的精力打分，这里会出现你的精力曲线。</div>`;
    const avg = a => a.reduce((s, p) => s + p.v, 0) / a.length;
    const recent = pts.slice(-7).filter(p => p.v != null), before = pts.slice(0, -7).filter(p => p.v != null);
    let trend = '';
    if (recent.length >= 2 && before.length >= 2) {
      const dlt = avg(recent) - avg(before);
      trend = Math.abs(dlt) < 0.3 ? '<span class="up" style="color:var(--sub)">和之前差不多</span>'
        : dlt > 0 ? `<span class="up">最近一周 +${dlt.toFixed(1)}</span>` : `<span class="down">最近一周 ${dlt.toFixed(1)}</span>`;
    }
    const moods = {};
    pts.forEach(p => { if (p.mood) moods[p.mood] = (moods[p.mood] || 0) + 1; });
    const top = Object.entries(moods).sort((a, b) => b[1] - a[1])[0];
    const span = Math.max(1, Math.min(n, first() ? diffDays(t, first()) + 1 : n));
    const rates = S.habits.slice(0, 4).map(hb => {
      let c = 0; for (let i = 0; i < span; i++) if (S.logs.has(hb.id + '|' + addDays(t, -i))) c++;
      return `${esc(hb.name)} ${Math.round(c / span * 100)}%`;
    }).join(' · ');
    const label = `近 ${n} 天精力曲线，平均 ${avg(vals).toFixed(1)} 分`;
    return head + `<div class="card pad">
      <div class="big-num"><span class="small muted" style="font-weight:600">平均精力</span><b>${avg(vals).toFixed(1)}</b><span class="small muted">/ 5</span>${trend}</div>
      ${chartSvg(pts, label)}
      <div class="chart-x"><span>${cn(pts[0].d)}</span><span>今天</span></div>
      ${top ? `<div class="kv"><span>出现最多的情绪</span><b>${esc(top[0])} · ${top[1]} 天</b></div>` : ''}
      ${rates ? `<div class="kv"><span>习惯完成率</span><b>${rates}</b></div>` : ''}
    </div>`;
  }
  const first = () => S.stats.first;

  function dayRow(l) {
    const r = l.reply || {};
    const sealed = isSealed(l.date);
    // 跳过开头只有称呼的那一行（「非云，」）
    const line = sealed ? '回信封存中 · 明早 6:00 送到'
      : (String(r.summary || l.text).split('\n').map(s => s.trim()).find(s => s && !/^[^，。,]{1,12}[，,：:]$/.test(s)) || '');
    const meta = sealed ? `No.${letterNo(l.date)}` : l.energy ? `No.${letterNo(l.date)} · 精力 ${l.energy}${l.mood ? ' · ' + esc(l.mood) : ''}` : (r.imported ? '旧信' : '还没有回信');
    return `<button class="row day" data-act="letter" data-v="${l.date}">
      <span class="dt"><b>${Number(l.date.slice(8))}</b><span>周${wd(l.date)}</span></span>
      <span class="row-main"><span class="one-line">${esc(line)}</span><span class="sub">${meta}</span></span>${ICON.chev}</button>`;
  }
  function gapRow(d) {
    return `<button class="row day gapday" data-act="write-day" data-v="${d}">
      <span class="dt gap"><b>${Number(d.slice(8))}</b><span>周${wd(d)}</span></span>
      <span class="row-main"><span>这天没有写信</span><span class="sub">点一下补写</span></span>${ICON.chev}</button>`;
  }
  function digestCard(d) {
    const kindN = { week: '周信', quarter: '季信', year: '年信' }[d.kind];
    const st = d.stats;
    const badge = `${kindN}${st && st.letters ? ` · ${st.letters} 封信` : ''}`;
    const lab = d.imported ? '旧版复盘' : d.kind === 'week' ? `${cn(d.key)} 那一周` : d.kind === 'quarter' ? d.key.replace('-', ' 年 ') : `${d.key} 年`;
    return `<button class="digest tap" data-act="digest" data-v="${d.kind}|${d.key}">
      <span class="digest-h"><span class="badge">${badge}</span><span>${lab}</span></span>
      ${d.title && !d.imported ? `<span class="digest-t">${esc(d.title)}</span>` : ''}
      ${st ? `<span class="digest-stats"><span><span>平均精力</span><b>${st.energyAvg ?? '—'}</b></span><span><span>完成待办</span><b>${st.todosDone ?? 0}</b></span><span><span>可能漏掉</span><b>${(d.forgotten || []).length}</b></span></span>`
        : `<span class="digest-b">${esc(d.letter || '')}</span>`}
      <span style="font-size:14px;font-weight:600">读完整的${kindN} ›</span></button>`;
  }
  function timeline(t) {
    const letters = Object.values(S.letters).filter(l => l.text && l.text.trim()).sort((a,b) => a.date < b.date ? 1 : -1);
    if (!letters.length) return `<div class="archive-empty"><p>这里还没有留下记录。</p><span>今晚写下第一封信，让时间线从今天开始。</span><button class="lk" data-act="write-day" data-v="${letterDay()}">去写信 ›</button></div>`;
    const months = new Map();
    letters.forEach(l => { const key=l.date.slice(0,7); if(!months.has(key)) months.set(key,[]); months.get(key).push(l); });
    let html = '';
    for (const [key,entries] of months) {
      const [year,month] = key.split('-').map(Number);
      const title = year === Number(t.slice(0,4)) ? `${month} 月` : `${year} 年 ${month} 月`;
      html += `<section class="life-month"><div class="life-month-heading"><h2>${title}</h2><span>${entries.length} 个片段</span></div><div class="life-track">`;
      html += entries.map(l => {
        const sealed = isSealed(l.date);
        const body = String(l.text || '').replace(/\\s+/g,' ').trim();
        const reply = l.reply && !sealed ? String(l.reply.summary || '').replace(/\\s+/g,' ').trim() : '';
        const headline = body.slice(0,92);
        const note = reply || (sealed ? '回信将在明早送达' : l.reply ? '那一天，伙伴也留下了回应' : '那一天，你为自己留下一段记录');
        return `<button class="life-moment" data-act="letter" data-v="${l.date}">
          <span class="life-marker"></span><span class="life-date"><b>${Number(l.date.slice(8))}</b><small>周${wd(l.date)}</small></span>
          <span class="life-moment-body"><strong>${esc(headline)}${body.length>92?'…':''}</strong><span>${esc(note.slice(0,76))}${note.length>76?'…':''}</span><em>${cn(l.date)} · No.${letterNo(l.date)}</em></span>
        </button>`;
      }).join('');
      html += `</div></section>`;
    }
    html += V.olderLoaded === 'done' ? '' : `<div class="archive-older"><button class="btn ghost sm" data-act="older">更早的记录</button></div>`;
    return html;
  }

  function digestList  function digestList(kind, t) {
    const list = S.digests.filter(d => d.kind === kind);
    const kindN = { week: '周信', quarter: '季信', year: '年信' }[kind];
    const when = { week: '每周一早上 7 点', quarter: '每季度第一天早上 7 点', year: '每年元旦早上 7 点' }[kind];
    const curKey = kind === 'week' ? weekKey(t) : kind === 'quarter' ? quarterKey(t) : t.slice(0, 4);
    const curName = { week: '本周', quarter: '这一季', year: '今年' }[kind];
    let html = `<p class="note" style="margin-top:18px">${kindN}会在${when}自动送达。也可以现在就让回信先写一封${curName}到目前为止的。</p>
      <div style="padding:0 4px"><button class="lk" data-act="gen" data-v="${kind}|${curKey}">现在写${curName}的${kindN} ›</button></div>`;
    html += list.length ? list.map(d => `<div style="margin-top:12px">${digestCard(d)}</div>`).join('') : `<div class="card empty mt">还没有${kindN}。</div>`;
    return html;
  }

  // ───────────── 二级页面 ─────────────
  function openSheet(s) { s.fresh = true; V.sheets.push(s); render(); }
  function closeSheet() { V.sheets.pop(); V.droppedIdeas = undefined; if (!V.sheets.length) { V.openGroups = null; V.olderTodos = undefined; } render(); }
  function viewSheet(s) {
    const titles = { reply: '', letter: '', digest: '', lists: '待办与点子', settings: '设置', todo: s.id ? '编辑待办' : '加一件事', drop: '放下这件事', idea: s.id ? '编辑点子' : '记一个点子' };
    const anim = s.fresh ? ' enter' : '';
    s.fresh = false;   // 只在刚打开时升起，之后刷新内容不再重播动画
    return `<div class="sheet-dim" data-act="close" aria-hidden="true"></div><div class="sheet${anim}" role="dialog" aria-modal="true">
      <div class="sheet-bar"><div><span class="sp"></span><span class="t">${titles[s.type] || ''}</span><button class="x" data-act="close" aria-label="关闭">${ICON.x}</button></div></div>
      <div class="page">${sheetBody(s)}</div></div>`;
  }
  function sheetBody(s) {
    const t = today();
    if (s.type === 'reply' || s.type === 'letter') {
      const l = S.letters[s.date];
      if (!l) return '<div class="card empty">找不到这封信。</div>';
      const yday = addDays(t, -1);
      const title = !l.reply || isSealed(l.date) ? cn(l.date) + '的信' : l.date === yday ? '昨晚的回信' : l.date === t ? '今天的回信' : cn(l.date) + '的回信';
      let h = `<div class="head"><div class="head-l"><span class="eyebrow">Re: No.${letterNo(l.date)} · 星期${wd(l.date)}</span><h1 style="font-size:28px">${title}</h1></div></div>`;
      if (!l.reply || isSealed(l.date)) {
        h += `<div class="card paper mt"><p class="letter-text">${esc(l.text)}</p></div>`;
        h += isSealed(l.date) ? `<p class="note">回信已经写好，封存到 ${cn(addDays(l.date, 1))} 早上 6:00。</p>` : `<p class="note">这封信还没有回信。</p>`;
      } else {
        h += replyView(l, { mine: true, go: l.date >= yday && s.type === 'reply' });
      }
      h += `<div style="padding:0 4px;margin-top:8px"><button class="lk" data-act="open-in-write" data-v="${l.date}">在写信里打开</button></div>`;
      return h;
    }
    if (s.type === 'digest') {
      const d = S.digests.find(x => x.kind === s.kind && x.key === s.key);
      if (!d) return '<div class="card empty">找不到这封信。</div>';
      const kindN = { week: '周信', quarter: '季信', year: '年信' }[d.kind];
      const range = d.range ? `${cn(d.range[0])} – ${cn(d.range[1])}` : (d.kind === 'week' ? `${cn(d.key)} – ${cn(addDays(d.key, 6))}` : d.key);
      let h = `<div class="head"><div class="head-l"><span class="eyebrow">${kindN} · ${range}</span><h1 style="font-size:26px">${esc(d.title || kindN)}</h1></div></div>`;
      if (d.stats) h += `<div class="card stats mt">
        <div class="stat"><span>写了</span><b>${d.stats.letters}<small> 封</small></b></div>
        <div class="stat"><span>平均精力</span><b>${d.stats.energyAvg ?? '—'}</b></div>
        <div class="stat"><span>完成待办</span><b>${d.stats.todosDone}</b></div></div>`;
      h += `<article class="card reply-letter"><p>${esc(d.letter || '')}</p></article>`;
      const sec = (lab, body) => `<div class="gh"><h2>${lab}</h2></div><div class="card pad" style="font-size:15px;line-height:1.6">${body}</div>`;
      if (d.energy_note) h += sec('精力的规律', esc(d.energy_note));
      if (d.forgotten && d.forgotten.length) h += sec('可能漏掉的', d.forgotten.map(x => `<div>· ${esc(x)}</div>`).join(''));
      if (d.next) h += sec(d.kind === 'week' ? '下周最值得做的一件事' : '接下来', esc(d.next));
      const four = (o) => `<div class="card">${LENSES.map(([k, n, c]) => `<div class="row lens"><span class="ic" style="background:${c}" aria-hidden="true">${n[0]}</span><span class="row-main"><span>${n}</span><span>${esc(o[k] || '—')}</span></span></div>`).join('')}</div>`;
      if (d.lenses && Object.values(d.lenses).some(Boolean)) h += `<div class="gh"><h2>四个角度</h2></div>` + four(d.lenses);
      if (d.plans && Object.values(d.plans).some(Boolean)) h += `<div class="gh"><h2>下个季度的四条小规划</h2></div>` + four(d.plans);
      if (d.themes && d.themes.length) h += sec('这一年反复出现的主题', d.themes.map(esc).join(' · '));
      if (!d.imported) h += `<div style="margin-top:26px"><button class="btn ghost sm" data-act="gen" data-v="${d.kind}|${d.key}">让回信重写这封${kindN}</button></div>`;
      return h;
    }
    if (s.type === 'lists') {
      const tab = s.tab || 'todos';
      const seg = `<div class="seg three" role="tablist">${[['todos', '待办'], ['ideas', '点子'], ['done', '完成 / 放下']].map(([k, n]) => `<button role="tab" aria-selected="${tab === k}" data-act="lists-tab" data-v="${k}">${n}</button>`).join('')}</div>`;
      let rows;
      if (tab === 'todos') {
        const l = openTodos(t);
        rows = (l.length ? l.map(x => todoRow(x, t)).join('') : '<div class="empty">没有待办。</div>') + `<div class="row foot"><button class="lk" data-act="todo-new">＋ 加一件事</button></div>`;
      } else if (tab === 'ideas') {
        const l = openIdeas();
        rows = (l.length ? l.map(i => ideaRow(i, { drop: true })).join('') : '<div class="empty">点子库是空的。写信时冒出的想法，回信会收到这里。</div>') + `<div class="row foot"><button class="lk" data-act="idea-new">＋ 记一个点子</button></div>`;
        // 放下的点子：藏在最底下，点开才加载
        const dv = V.droppedIdeas;
        const dropped = dv === undefined ? '' : dv === 'loading' ? '<div class="empty">正在找…</div>'
          : !dv.length ? '<div class="empty">还没有放下的点子。</div>'
          : dv.map(i => `<div class="row"><span class="ic sm idea dim">${ICON.bulb}</span>
              <span class="row-main done"><span>${esc(i.text)}</span><span class="sub">${i.dropped_at ? cn(i.dropped_at) + ' 放下' : '放下了'}</span></span>
              <button class="lk" data-act="idea-restore" data-v="${i.id}">恢复</button></div>`).join('');
        return seg + `<div class="card mt">${rows}</div>
          <div class="fold"><button class="lk muted" data-act="dropped-ideas">${dv === undefined ? '放下的点子 ›' : '收起放下的点子'}</button></div>
          ${dv === undefined ? '' : `<div class="card">${dropped}</div>`}`;
      } else {
        return seg + doneHistory(t);
      }
      return seg + `<div class="card mt">${rows}</div>`;
    }
    if (s.type === 'todo') {
      const x = s.id ? S.todos.find(y => y.id === s.id) : { text: '', due: addDays(t, 3) };
      if (!x) return '';
      return `<form id="todo-form">
        <div class="field"><label for="tf-text">要做的事</label><textarea class="input" id="tf-text" rows="2" required>${esc(x.text)}</textarea></div>
        <div class="field"><label for="tf-due">截止日期</label><input class="input" id="tf-due" type="date" value="${esc(x.due || '')}"></div>
        <div class="field"><label for="tf-note">备注</label><textarea class="input" id="tf-note" rows="3" maxlength="500" placeholder="进展、新想法，做完的感受，或者为什么做不了，都可以写。回信和周信会看到。">${esc(x.note || '')}</textarea></div>
        ${x.dropped_at ? `<p class="note">${cn(x.dropped_at)} 放下了这件事</p>` : ''}
        ${x.source_date ? `<p class="note">来自 ${cn(x.source_date)} 的信</p>` : ''}
        <div style="display:flex;gap:10px;margin-top:26px;flex-wrap:wrap"><button class="btn" type="submit">保存</button>
        ${s.id && x.dropped_at ? `<button class="btn ghost" type="button" data-act="todo-undrop" data-v="${x.id}">恢复成待办</button>` : ''}
        ${s.id && !x.dropped_at && !x.done ? `<button class="btn ghost" type="button" data-act="todo-drop" data-v="${x.id}">放下</button>` : ''}
        ${s.id ? `<button class="btn ghost" type="button" data-act="todo-del" data-v="${x.id}">删除</button>` : ''}</div></form>`;
    }
    if (s.type === 'drop') {
      const x = S.todos.find(y => y.id === s.id);
      if (!x) return '';
      const reasons = ['暂时没时间', '不重要了', '条件还不具备', '换了别的做法', '交给别人了'];
      return `<p class="drop-what">${esc(x.text)}</p>
        <div class="field"><label for="dn-note">为什么放下？</label>
          <textarea class="input" id="dn-note" rows="3" maxlength="500" placeholder="写一句就好，以后回头看会用得上。也可以不写。">${esc(s.note != null ? s.note : (x.note || ''))}</textarea></div>
        <div class="chips wrap" role="group" aria-label="常用原因">${reasons.map(r => `<button class="chip" type="button" data-act="drop-reason" data-v="${esc(r)}">${esc(r)}</button>`).join('')}</div>
        <p class="note">放下的事会和原因一起留在「完成 / 放下」里，随时可以恢复。回信和周信也会看到。</p>
        <div style="display:flex;gap:10px;margin-top:22px"><button class="btn" type="button" data-act="drop-confirm" data-v="${x.id}">放下</button>
        <button class="btn ghost" type="button" data-act="close">先不放下</button></div>`;
    }
    if (s.type === 'idea') {
      const x = s.id ? S.ideas.find(y => y.id === s.id) : { text: '' };
      if (!x) return '';
      return `<form id="idea-form">
        <div class="field"><label for="if-text">点子</label><textarea class="input" id="if-text" rows="3" required>${esc(x.text)}</textarea></div>
        ${x.source_date ? `<p class="note">来自 ${cn(x.source_date)} 的信</p>` : ''}
        <div style="display:flex;gap:10px;margin-top:26px;flex-wrap:wrap"><button class="btn" type="submit">保存</button>
        ${s.id ? `<button class="btn ghost" type="button" data-act="idea-todo" data-v="${x.id}">转成待办</button><button class="btn ghost" type="button" data-act="idea-drop" data-v="${x.id}">放下</button>` : ''}</div></form>`;
    }
    if (s.type === 'settings') {
      const cur = S.settings.theme || 'auto';
      const themes = THEMES.map(th => `<button class="theme-opt" data-act="theme" data-v="${th.id}" aria-pressed="${cur === th.id}">
        <span class="swatch" style="background:${th.id === 'auto' ? 'linear-gradient(90deg,#F2F2F7 50%,#000 50%)' : th.sw[0]}"><i style="background:${th.sw[2]};width:60%"></i><i style="background:${th.sw[1]};width:85%"></i></span>${th.name}</button>`).join('');
      const habits = S.habits.map(h => `<div class="row"><input class="input" style="background:none;padding:0;min-height:48px" value="${esc(h.name)}" data-habit-name="${h.id}" aria-label="习惯名称"><button class="lk" style="color:var(--danger)" data-act="habit-del" data-v="${h.id}">删除</button></div>`).join('');
      const dm = deliverMode();
      const opt = (v, t1, t2) => `<button class="opt" data-act="deliver" data-v="${v}" aria-pressed="${dm === v}"><span>${t1}<small>${t2}</small></span><span class="tick">${ICON.tick}</span></button>`;
      return `
        <div class="field"><label for="set-name">回信怎么称呼你</label><input class="input" id="set-name" value="${esc(S.user.name || '')}" placeholder="比如：非云"></div>
        <div class="field"><span class="lab">回信什么时候送到</span><div class="group opts">
          ${opt('morning', '明早 6:00 拆信', '今晚寄出的信，回信封存到第二天早上；补写的信马上送到')}
          ${opt('now', '寄出后马上', '写完就能看到回信')}</div></div>
        ${aiSettings()}
        <div class="field"><span class="lab">回信的长期记忆</span><div class="group opts"><button class="opt" data-act="memory-toggle" data-v="${S.settings.memory_enabled === false ? 'off' : 'on'}"><span>${S.settings.memory_enabled === false ? '已暂停记忆' : '记忆功能已开启'}<small>关闭后，回信不再检索或提炼长期记忆；已有记忆仍保留，可重新开启。</small></span><span class="tick">${ICON.tick}</span></button></div>
          <div class="note" style="margin:0">回信会从你多天的来信中整理长期目标、偏好和反复出现的主题。每条记忆都保留来源日期；你可以修改或删除。记忆只用于辅助理解，不会覆盖你今天写下的内容。</div>
          <div class="group" style="padding:4px 14px">
            ${(S.memories || []).length ? S.memories.map(x => `<div class="row" style="align-items:flex-start;padding:12px 0"><span class="row-main"><span>${esc(x.content)}</span><span class="sub">${esc(x.category)} · 来源 ${(x.evidence_dates || []).map(esc).join('、') || '待补充'}</span></span><button class="lk" data-act="memory-edit" data-v="${x.id}">修改</button><button class="lk" style="color:var(--danger)" data-act="memory-del" data-v="${x.id}">删除</button></div>`).join('') : '<div class="empty" style="padding:14px">还没有长期记忆。随着你持续写信，回信会逐步整理。</div>'}
          </div>
          <button class="btn sm ghost" style="align-self:flex-start" data-act="memory-add">手动添加一条记忆</button>
        </div>
        <div class="field"><span class="lab">外观</span><div class="themes">${themes}</div></div>
        <div class="field"><span class="lab">写信时顺手打卡的习惯</span><div class="group">${habits || '<div class="empty" style="padding:14px">还没有习惯</div>'}</div>
          <form id="habit-form" style="display:flex;gap:8px"><input class="input" id="habit-new" placeholder="新习惯，比如：运动 30 分钟" aria-label="新习惯"><button class="btn sm" style="height:48px" type="submit">添加</button></form></div>
        <div class="field"><label for="set-q">回信写信时会想着的问题（一行一个）</label><textarea class="input" id="set-q" rows="8">${esc((S.settings.questions || []).join('\n'))}</textarea>
          <button class="btn sm ghost" style="align-self:flex-start" data-act="save-q">保存问题</button></div>
        <div class="field"><span class="lab">账号</span><div class="muted small" style="padding:0 4px">当前登录：${esc(S.user.username)}</div>
          <button class="btn sm ghost" style="align-self:flex-start" data-act="logout">退出登录</button></div>
        <p class="note" style="margin-top:40px;text-align:center">回信 Re: · 今晚写给明早的自己</p>`;
    }
    return '';
  }


  // ───────────── 设置 · AI 回信 ─────────────
  // V.ai：{ loading, data（服务器上的配置，不含 Key）, form（正在填的）, msg, busy }
  async function loadAI() {
    V.ai = { loading: true };
    try {
      const d = await api('GET', '/ai-config');
      const p = d.configured ? d.provider : 'deepseek';
      const pre = d.providers[p] || {};
      V.ai = { data: d, form: { provider: p, base_url: d.base_url || pre.base, model: d.model || pre.model, key: '' }, open: !d.configured };
    } catch (e) { V.ai = { error: e.message }; }
    if (V.sheets.length && V.sheets[V.sheets.length - 1].type === 'settings') render();
  }
  function aiSettings() {
    const A = V.ai || {};
    if (A.loading) return `<div class="field"><span class="lab">AI 回信</span><div class="note" style="margin:0">读取中…</div></div>`;
    if (A.error || !A.data) return `<div class="field"><span class="lab">AI 回信</span><div class="note" style="margin:0">${esc(A.error || '联网后可以设置')}</div></div>`;
    const d = A.data, f = A.form, P = d.providers;
    const status = d.configured
      ? `正在用你自己的 <b>${esc((P[d.provider] || P.custom).name)}</b> · ${esc(d.model)} · Key 尾号 ${esc(d.last4)}`
      : `正在用 <b>Cloudflare 免费模型</b>：不用花钱，但每天有额度上限，写一封要等半分钟左右。`;
    const opts = Object.entries(P).map(([k, v]) => `<option value="${k}" ${f.provider === k ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
    return `<div class="field"><span class="lab">AI 回信</span>
      <div class="group" style="padding:14px;font-size:15px;line-height:1.6">${status}
        ${d.configured ? `<div style="margin-top:6px"><button class="lk" style="color:var(--danger);padding:4px 0" data-act="ai-off">停用，改回免费模型</button></div>` : ''}</div>
      <button class="lk" style="align-self:flex-start;padding-left:4px" data-act="ai-toggle">${A.open ? '收起' : (d.configured ? '修改 ›' : '接入自己的 AI ›')}</button>
      ${A.open ? `<div style="display:flex;flex-direction:column;gap:10px">
        <label class="lab" for="ai-provider">服务商</label>
        <select class="input" id="ai-provider" data-ai="provider">${opts}</select>
        <label class="lab" for="ai-base">接口地址</label>
        <input class="input" id="ai-base" data-ai="base_url" value="${esc(f.base_url || '')}" placeholder="https://…/v1" inputmode="url" autocomplete="off" spellcheck="false">
        <label class="lab" for="ai-model">模型名</label>
        <input class="input" id="ai-model" data-ai="model" value="${esc(f.model || '')}" placeholder="比如 deepseek-chat" autocomplete="off" spellcheck="false">
        <label class="lab" for="ai-key">API Key</label>
        <input class="input" id="ai-key" data-ai="key" type="password" value="${esc(f.key || '')}" placeholder="${d.configured ? '已保存（尾号 ' + esc(d.last4) + '），不改就留空' : '粘贴服务商给你的 Key'}" autocomplete="off" spellcheck="false">
        <div style="display:flex;gap:10px;margin-top:4px">
          <button class="btn sm ghost" data-act="ai-test" ${A.busy ? 'disabled' : ''}>${A.busy === 'test' ? '测试中…' : '测试一下'}</button>
          <button class="btn sm" data-act="ai-save" ${A.busy ? 'disabled' : ''}>${A.busy === 'save' ? '保存中…' : '保存'}</button>
        </div>
        ${A.msg ? `<div class="note" style="margin:0;color:${A.ok ? 'var(--ink)' : 'var(--danger)'}">${esc(A.msg)}</div>` : ''}
        <p class="note" style="margin:0">接上之后，你的回信和周信都用你自己的 AI 写，花的是你自己的额度。Key 加密保存在服务器上，网页里只显示后 4 位。DeepSeek、智谱、通义千问、Kimi、硅基流动等大多数服务商都能这样接入；模型名以服务商控制台为准。自己的 AI 出错时，会自动改用免费模型，不会漏掉回信。</p>
      </div>` : ''}
    </div>`;
  }

  // ───────────── 渲染后的绑定（输入框、表单） ─────────────
  function afterRender() {
    const ed = $('#editor');
    if (ed) {
      const grow = () => { ed.style.height = 'auto'; ed.style.height = Math.max(ed.scrollHeight, window.innerHeight * 0.36) + 'px'; };
      grow();
      ed.addEventListener('input', () => {
        grow();
        const d = V.writeDate;
        store.set('hx_draft_' + d, ed.value);
        $('#send-btn').disabled = !ed.value.trim();
        $('#save-state').textContent = '保存中';
        clearTimeout(afterRender._t);
        afterRender._t = setTimeout(() => saveLetter(d, ed.value), 1200);
      });
      if (V.editing) { ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length); }
      if (rec && $('#mic')) $('#mic').classList.add('on');
    }
    const topSheet = V.sheets[V.sheets.length - 1];
    if (topSheet && topSheet.focusNote && $('#tf-note')) { topSheet.focusNote = false; $('#tf-note').focus(); }
    const dn = $('#dn-note');
    if (dn) dn.addEventListener('input', () => { topSheet.note = dn.value; });
    const tf = $('#todo-form');
    if (tf) tf.addEventListener('submit', e => {
      e.preventDefault();
      const s = V.sheets[V.sheets.length - 1];
      const text = $('#tf-text').value.trim(); const due = $('#tf-due').value || null;
      const note = $('#tf-note').value.trim();
      if (!text) return;
      if (s.id) {
        const x = S.todos.find(y => y.id === s.id); Object.assign(x, { text, due, note });
        queue('PUT', '/todos/' + x.id, { text, due, note });
      } else {
        const x = { id: uid('t'), text, due, note, done: false, created: today() };
        S.todos.push(x);
        queue('PUT', '/todos/' + x.id, x);
      }
      toCache(); closeSheet();
    });
    const idf = $('#idea-form');
    if (idf) idf.addEventListener('submit', e => {
      e.preventDefault();
      const s = V.sheets[V.sheets.length - 1];
      const text = $('#if-text').value.trim();
      if (!text) return;
      if (s.id) { const x = S.ideas.find(y => y.id === s.id); x.text = text; queue('PUT', '/ideas/' + x.id, { text }); }
      else { const x = { id: uid('i'), text, status: 'open', created: today() }; S.ideas.unshift(x); queue('PUT', '/ideas/' + x.id, x); }
      toCache(); closeSheet();
    });
    document.querySelectorAll('[data-ai]').forEach(el => {
      const k = el.dataset.ai;
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
        V.ai.form[k] = el.value;
        if (k === 'provider') {
          const pre = V.ai.data.providers[el.value] || {};
          if (el.value !== 'custom') { V.ai.form.base_url = pre.base; V.ai.form.model = pre.model; }
          V.ai.msg = ''; render();
        }
      });
    });
    const nm = $('#set-name');
    if (nm) nm.addEventListener('change', () => {
      S.user.name = nm.value.trim();
      queue('PUT', '/settings', { name: S.user.name }); toCache(); toast('已保存');
    });
    document.querySelectorAll('[data-habit-name]').forEach(inp => inp.addEventListener('change', () => {
      const h = S.habits.find(x => x.id === inp.dataset.habitName);
      if (!h || !inp.value.trim()) return;
      h.name = inp.value.trim(); queue('PUT', '/habits/' + h.id, { name: h.name }); toCache(); toast('已保存');
    }));
    const hf = $('#habit-form');
    if (hf) hf.addEventListener('submit', e => {
      e.preventDefault();
      const name = $('#habit-new').value.trim();
      if (!name) return;
      const h = { id: uid('h'), name, sort: S.habits.length };
      S.habits.push(h); queue('PUT', '/habits/' + h.id, h); toCache(); render();
    });
  }

  // ───────────── 语音写信（浏览器支持才显示按钮） ─────────────
  let rec = null;
  function toggleMic() {
    if (!SR) return;
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = 'zh-CN'; rec.continuous = true; rec.interimResults = false;
    rec.onresult = e => {
      const ed = $('#editor'); if (!ed) return;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) { ed.value += e.results[i][0].transcript; ed.dispatchEvent(new Event('input')); }
      }
    };
    rec.onerror = ev => { if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') toast('没有麦克风权限，可以用键盘上的语音输入'); };
    rec.onend = () => { rec = null; const m = $('#mic'); if (m) m.classList.remove('on'); };
    try { rec.start(); const m = $('#mic'); if (m) m.classList.add('on'); toast('在听了，再点一下停止'); }
    catch (e) { rec = null; toast('这台设备暂时用不了语音，可以用键盘上的语音输入'); }
  }

  // ───────────── 动作 ─────────────
  async function saveLetter(d, text) {
    const l = S.letters[d] || (S.letters[d] = { date: d, text: '', reply: null });
    l.text = text;
    toCache();
    queue('PUT', '/letters/' + d, { text });
    const st = $('#save-state');
    if (st) st.textContent = V.online ? '已存' : '存在本机';
  }

  async function send() {
    const d = V.writeDate;
    const ed = $('#editor');
    const text = ed ? ed.value : (S.letters[d] || {}).text;
    if (!text || !text.trim()) return;
    clearTimeout(afterRender._t);
    if (rec) rec.stop();
    const l = S.letters[d] || (S.letters[d] = { date: d });
    l.text = text;
    store.del('hx_draft_' + d);
    V.editing = false; V.replying = true; V.replyErr = '';
    V.sent = sendsTonight(d) ? { date: d, at: new Date() } : null;
    toCache(); render();
    try {
      await api('PUT', '/letters/' + d, { text });
      outbox = outbox.filter(o => o.key !== 'PUT /letters/' + d); store.set('hx_outbox', outbox);
      await requestReply(d);
    } catch (e) {
      V.replying = false;
      if (/Failed to fetch|Load failed|NetworkError/i.test(e.message)) {
        queue('PUT', '/letters/' + d, { text });
        V.replyErr = '现在没有网络。信已经存在本机，联网后点「再试一次」';
      } else V.replyErr = e.message;
      render();
    }
  }
  async function requestReply(d) {
    V.replying = true; V.replyErr = ''; render();
    try {
      const r = await api('POST', `/letters/${d}/reply`, { today: letterDay() });   // 凌晨 4 点前寄出的，"今天"仍是前一天
      const l = S.letters[d];
      l.reply = r.reply; l.replied_at = r.replied_at; l.energy = r.reply.energy; l.mood = r.reply.mood;
      (r.todos || []).forEach(x => { if (!S.todos.find(y => y.id === x.id)) S.todos.push(x); });
      (r.ideas || []).forEach(x => { if (!S.ideas.find(y => y.id === x.id)) S.ideas.unshift(x); });
      if (!S.stats.first || d < S.stats.first) S.stats.first = d;
      S.stats.letters = Object.values(S.letters).filter(x => x.text && x.text.trim()).length;
      V.replying = false; toCache();
      if (isSealed(d)) { render(); if (!(V.sent && V.sent.date === d)) toast('整理好了，明早 6:00 送到'); return; }
      // 补写的信（或设成马上送到）：直接拆开
      if (V.tab === 'write' && V.writeDate === d && !V.sheets.length) { markOpened(d); openSheet({ type: 'reply', date: d }); return; }
      render(); toast('收到回信');
    } catch (e) {
      V.replying = false;
      V.replyErr = /Failed to fetch|Load failed|NetworkError/i.test(e.message) ? '现在没有网络，联网后点「再试一次」' : e.message;
      render();
    }
  }

  async function generate(kind, key) {
    const kindN = { week: '周信', quarter: '季信', year: '年信' }[kind];
    toast(`正在写${kindN}…`);
    try {
      const r = await api('POST', '/digests', { kind, key });
      S.digests = S.digests.filter(x => !(x.kind === r.digest.kind && x.key === r.digest.key));
      S.digests.unshift(r.digest);
      S.digests.sort((a, b) => (a.key < b.key ? 1 : -1));
      toCache();
      V.sheets = V.sheets.filter(s => s.type !== 'digest');
      openSheet({ type: 'digest', kind: r.digest.kind, key: r.digest.key });
    } catch (e) { toast(e.message); }
  }

  function startEdit(d) {
    V.tab = 'write'; V.writeDate = d; V.editing = true; V.sent = null; V.sheets = [];
    store.set('hx_draft_' + d, (S.letters[d] || {}).text || '');
    render();
  }

  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]');
    if (!el || !S) return;
    const act = el.dataset.act, v = el.dataset.v;
    const t = today();
    switch (act) {
      case 'tab':
        if (V.tab === 'write' && v !== 'write') { V.editing = false; if (rec) rec.stop(); }
        V.tab = v; V.sheets = []; V.sent = null;
        if (v === 'write') V.writeDate = V.writeDate || letterDay();
        render(); break;
      case 'write-day': V.tab = 'write'; V.writeDate = v; V.editing = !hasText(v); V.replyErr = ''; V.sheets = []; V.sent = null; render(); break;
      case 'day': {
        const n = addDays(V.writeDate, Number(v));
        if (n > letterDay()) return;
        V.writeDate = n; V.editing = false; V.replyErr = ''; render(); break;
      }
      case 'quote': V.quoteOffset++; render(); break;
      case 'chip': {
        const ed = $('#editor'); if (!ed) return;
        ed.value = ed.value.replace(/\s*$/, '') + (ed.value.trim() ? '\n' : '') + v;
        ed.dispatchEvent(new Event('input'));
        ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length);
        break;
      }
      case 'mic': toggleMic(); break;
      case 'habit': {
        const day = el.dataset.d || t;
        const k = v + '|' + day; const on = !S.logs.has(k);
        on ? S.logs.add(k) : S.logs.delete(k);
        queue('PUT', `/habits/${v}/log/${day}`, { done: on }); toCache();
        // 写信时不整页重画，免得打断正在写的字
        if ($('#editor')) { el.classList.toggle('on', on); el.setAttribute('aria-pressed', on); }
        else render();
        break;
      }
      case 'todo-toggle': {
        const x = S.todos.find(y => y.id === v); if (!x) return;
        x.done = !x.done; x.done_at = x.done ? t : null;
        V.justDone = V.justDone || {};
        if (x.done) { V.justDone[x.id] = Date.now() + 5000; setTimeout(() => { if (V.tab === 'today' && !V.sheets.length) render(); }, 5100); }
        else delete V.justDone[x.id];
        queue('PUT', '/todos/' + v, { done: x.done, done_at: x.done_at }); toCache(); render();
        if (x.done) toast('✓ 已完成', { label: x.note ? '改备注' : '补一句备注', act: 'todo-note', v: x.id }); else hideToast();
        break;
      }
      case 'todo-note': hideToast(); openSheet({ type: 'todo', id: v, focusNote: true }); break;
      case 'todo-drop': {
        // 放下前先问一句原因：把编辑页里已经写的备注带过去
        const note = $('#tf-note') ? $('#tf-note').value.trim() : null;
        V.sheets.pop(); openSheet({ type: 'drop', id: v, note }); break;
      }
      case 'drop-reason': {
        const ta = $('#dn-note'); if (!ta) return;
        const cur = ta.value.trim();
        ta.value = cur ? (cur.includes(v) ? cur : cur + '，' + v) : v;
        V.sheets[V.sheets.length - 1].note = ta.value; ta.focus(); break;
      }
      case 'drop-confirm': case 'todo-undrop': {
        const x = S.todos.find(y => y.id === v); if (!x) return;
        const ta = $('#dn-note') || $('#tf-note');
        const note = ta ? ta.value.trim() : (x.note || '');
        const drop = act === 'drop-confirm';
        Object.assign(x, { note, dropped_at: drop ? t : null, done: false, done_at: null });
        queue('PUT', '/todos/' + v, { note, dropped: drop, dropped_at: x.dropped_at });
        toCache(); closeSheet(); toast(drop ? '已放下' : '已恢复成待办'); break;
      }
      case 'todo-edit': openSheet({ type: 'todo', id: v }); break;
      case 'todo-new': openSheet({ type: 'todo' }); break;
      case 'todo-del':
        S.todos = S.todos.filter(y => y.id !== v); queue('DELETE', '/todos/' + v); toCache(); closeSheet(); break;
      case 'idea-edit': openSheet({ type: 'idea', id: v }); break;
      case 'idea-new': openSheet({ type: 'idea' }); break;
      case 'idea-todo': {
        const i = S.ideas.find(y => y.id === v); if (!i) return;
        i.status = 'todo';
        const x = { id: uid('t'), text: i.text, due: addDays(t, 3), done: false, created: t, source_date: i.source_date };
        S.todos.push(x);
        queue('PUT', '/ideas/' + v, { status: 'todo' }); queue('PUT', '/todos/' + x.id, x);
        S.ideas = S.ideas.filter(y => y.id !== v);
        toCache(); if (V.sheets.length && V.sheets[V.sheets.length - 1].type === 'idea') V.sheets.pop(); render(); toast('已转成待办'); break;
      }
      case 'idea-drop':
        V._droppedIdea = S.ideas.find(y => y.id === v) || null;
        queue('PUT', '/ideas/' + v, { status: 'dropped' });
        S.ideas = S.ideas.filter(y => y.id !== v);
        toCache(); if (V.sheets.length && V.sheets[V.sheets.length - 1].type === 'idea') V.sheets.pop(); render();
        toast('已放下', V._droppedIdea ? { label: '撤回', act: 'idea-undrop', v } : null); break;
      case 'done-mode': V.doneMode = v; render(); break;
      case 'done-group': {
        const sh = $('.grp-h[data-v="' + v + '"]');
        V.openGroups = V.openGroups || {};
        V.openGroups[v] = !(sh && sh.getAttribute('aria-expanded') === 'true'); render(); break;
      }
      case 'older-todos': {
        V.olderTodos = 'loading'; render();
        try { V.olderTodos = (await api('GET', '/todos')).todos; }
        catch (e) { V.olderTodos = undefined; toast(e.message); }
        render(); break;
      }
      case 'dropped-ideas': {
        if (V.droppedIdeas !== undefined) { V.droppedIdeas = undefined; render(); break; }
        V.droppedIdeas = 'loading'; render();
        try { V.droppedIdeas = (await api('GET', '/ideas/dropped')).ideas; }
        catch (e) { V.droppedIdeas = undefined; toast(e.message); }
        render(); break;
      }
      case 'idea-restore': {
        const i = Array.isArray(V.droppedIdeas) && V.droppedIdeas.find(y => y.id === v); if (!i) return;
        V.droppedIdeas = V.droppedIdeas.filter(y => y.id !== v);
        const back = { id: i.id, text: i.text, status: 'open', source_date: i.source_date, created: i.created };
        S.ideas.push(back); queue('PUT', '/ideas/' + v, { status: 'open' }); toCache(); render(); toast('已恢复到点子库'); break;
      }
      case 'idea-undrop': {
        const i = V._droppedIdea; hideToast();
        if (!i || i.id !== v) return;
        i.status = 'open'; V._droppedIdea = null;
        S.ideas.push(i); queue('PUT', '/ideas/' + v, { status: 'open' }); toCache(); render(); break;
      }
      case 'lists': openSheet({ type: 'lists', tab: v }); break;
      case 'lists-tab': V.sheets[V.sheets.length - 1].tab = v; render(); break;
      case 'send': send(); break;
      case 'retry-reply': {
        const d = V.writeDate;
        if (outbox.some(o => o.key === 'PUT /letters/' + d)) { await flush(); }
        requestReply(d); break;
      }
      case 'edit-letter': startEdit(V.writeDate); break;
      case 'take-back': startEdit(v || V.writeDate); break;
      case 'cancel-edit': V.editing = false; store.del('hx_draft_' + V.writeDate); render(); break;
      case 'sent-close': V.sent = null; V.tab = 'today'; render(); break;
      case 'skip-backfill': store.set('hx_skipbf_' + v, true); render(); break;
      case 'open-reply': markOpened(v); openSheet({ type: 'reply', date: v }); break;
      case 'go-today': V.sheets = []; V.tab = 'today'; render(); break;
      case 'fb': {
        const key = el.dataset.d + '|' + v; const val = Number(el.dataset.x);
        const next = S.feedback[key] === val ? 0 : val;
        if (next) S.feedback[key] = next; else delete S.feedback[key];
        api('POST', '/feedback', { date: el.dataset.d, block: v, value: next }).catch(() => {});
        toCache(); render(); break;
      }
      case 'mb': V.mb = v; render(); break;
      case 'archive-tab': V.archiveTab = v; render(); break;
      case 'letter': if (!isSealed(v)) markOpened(v); openSheet({ type: 'letter', date: v }); break;
      case 'open-in-write': V.sheets = []; V.tab = 'write'; V.writeDate = v; V.editing = false; V.sent = null; render(); break;
      case 'digest': { const [kind, key] = v.split('|'); openSheet({ type: 'digest', kind, key }); break; }
      case 'gen': { const [kind, key] = v.split('|'); generate(kind, key); break; }
      case 'older': {
        const dates = Object.keys(S.letters).sort();
        try {
          const r = await api('GET', '/letters?before=' + (dates[0] || t));
          r.letters.forEach(l => { S.letters[l.date] = l; });
          if (r.letters.length < 60) V.olderLoaded = 'done';
          render();
        } catch (err) { toast(err.message); }
        break;
      }
      case 'settings': V.ai = { loading: true }; openSheet({ type: 'settings' }); loadAI(); break;
      case 'memory-toggle': {
        const enabled = S.settings.memory_enabled === false;
        S.settings.memory_enabled = enabled;
        try { await api('PUT','/settings',{memory_enabled:enabled}); toCache(); render(); toast(enabled ? '长期记忆已开启' : '长期记忆已暂停'); }
        catch(e){ S.settings.memory_enabled = !enabled; render(); toast(e.message); }
        break;
      }
      case 'memory-add': {
        const content = prompt('想让回信长期记住什么？');
        if (!content || !content.trim()) break;
        try { await api('POST','/memories',{content:content.trim(),category:'other',confidence:1}); const d=await api('GET','/memories'); S.memories=d.memories; toCache(); render(); toast('已加入长期记忆'); }
        catch(e){ toast(e.message); } break;
      }
      case 'memory-edit': {
        const item=(S.memories||[]).find(x=>x.id===v); if(!item) break;
        const content=prompt('修改这条长期记忆',item.content); if(content===null) break;
        try { await api('PUT','/memories/'+v,{content}); const d=await api('GET','/memories'); S.memories=d.memories; toCache(); render(); toast('已更新'); }
        catch(e){ toast(e.message); } break;
      }
      case 'memory-del': {
        if(!confirm('删除这条长期记忆？删除后，之后的回信不会再使用它。')) break;
        try { await api('DELETE','/memories/'+v); S.memories=(S.memories||[]).filter(x=>x.id!==v); toCache(); render(); toast('已删除'); }
        catch(e){ toast(e.message); } break;
      }
      case 'deliver':
        S.settings.deliver = v; queue('PUT', '/settings', { deliver: v }); toCache(); render();
        toast(v === 'now' ? '之后寄出的信，马上就能看到回信' : '之后今晚寄出的信，回信明早 6:00 送到'); break;
      case 'ai-toggle': V.ai.open = !V.ai.open; V.ai.msg = ''; render(); break;
      case 'ai-test': case 'ai-save': {
        const isTest = act === 'ai-test';
        V.ai.busy = isTest ? 'test' : 'save'; V.ai.msg = ''; render();
        try {
          if (isTest) {
            const r = await api('POST', '/ai-config/test', V.ai.form);
            V.ai.ok = r.ok;
            V.ai.msg = r.ok ? `接通了，用时 ${(r.ms / 1000).toFixed(1)} 秒，它回复：「${r.reply}」` : '没接通：' + r.error;
          } else {
            const d = await api('PUT', '/ai-config', V.ai.form);
            V.ai.data = d; V.ai.form.key = ''; V.ai.open = false; V.ai.ok = true; V.ai.msg = '';
            toast('已保存，之后的回信用你自己的 AI 写');
          }
        } catch (e2) { V.ai.ok = false; V.ai.msg = e2.message; }
        V.ai.busy = null; render(); break;
      }
      case 'ai-off': {
        if (!confirm('停用自己的 AI，改回免费模型？保存的 Key 会被删除。')) return;
        try { V.ai.data = await api('DELETE', '/ai-config'); toast('已改回免费模型'); } catch (e2) { toast(e2.message); }
        render(); break;
      }
      case 'close': closeSheet(); break;
      case 'theme':
        S.settings.theme = v; applyTheme(); queue('PUT', '/settings', { theme: v }); toCache(); render(); break;
      case 'save-q': {
        const qs = $('#set-q').value.split('\n').map(s => s.trim()).filter(Boolean);
        if (!qs.length) return toast('至少留一个问题');
        S.settings.questions = qs; queue('PUT', '/settings', { questions: qs }); toCache(); toast('已保存，下一封回信开始生效'); break;
      }
      case 'habit-del':
        if (!confirm('删除这个习惯？以前的打卡记录会一起隐藏。')) return;
        queue('PUT', '/habits/' + v, { archived: true });
        S.habits = S.habits.filter(h => h.id !== v); toCache(); render(); break;
      case 'logout':
        try { await api('POST', '/logout'); } catch (err) { /* ignore */ }
        store.del('hx_outbox'); store.del('hx_opened2'); outbox = []; opened = new Set();
        showLogin(); break;
    }
  });

  boot();
})();
