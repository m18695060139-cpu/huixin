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
    mic: svg(22, '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
    clock: svg(16, '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', 2.2),
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
    mb: 'all', sheets: [], quoteOffset: 0, olderLoaded: false, online: navigator.onLine,
    sent: null,                 // 刚寄出、正在看「已寄出」那一屏的信：{ date, at }
    burn: null,                 // 焚毁：{ date, items, phase: 'confirm'|'fire'|'rest' }
  };

  function fromBoot(b) {
    return {
      user: b.user, settings: b.settings || {}, stats: b.stats || {},
      letters: Object.fromEntries((b.letters || []).map(l => [l.date, l])),
      todos: b.todos || [], ideas: b.ideas || [], habits: b.habits || [],
      logs: new Set((b.habitLogs || []).map(([h, d]) => h + '|' + d)),
      digests: b.digests || [],
      feedback: Object.fromEntries((b.feedback || []).map(f => [f.date + '|' + f.block, f.value])),
    };
  }
  function toCache() {
    if (!S) return;
    store.set('hx_cache', {
      user: S.user, settings: S.settings, stats: S.stats,
      letters: Object.values(S.letters), todos: S.todos, ideas: S.ideas, habits: S.habits,
      habitLogs: [...S.logs].map(k => k.split('|')), digests: S.digests,
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
    if (!S || Date.now() - lastRefresh < 60000 || V.editing || V.replying || V.burn) return;
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
      bootNav();
      try { await refresh(); if (!V.editing) render(); } catch (e) { setOnline(false); }
      flush();
      return;
    }
    try {
      await refresh();
      pickStartTab();
      render();
      bootNav();
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
        bootNav();
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
    const html = V.tab === 'today' ? viewToday() : V.tab === 'write' ? viewWrite() : viewMailbox();
    const sent = V.sent && V.tab === 'write' ? viewSent() : '';
    $('#app').innerHTML = html + tabbar() + sent + V.sheets.map(viewSheet).join('') + viewBurn();
    if (V._lastTab !== V.tab) window.scrollTo(0, 0); else window.scrollTo(0, keepScroll);
    V._lastTab = V.tab;
    afterRender();
  }

  function tabbar() {
    const dot = V.tab !== 'today' && unopenedLetter(today()) ? '<i class="badge-dot" aria-hidden="true"></i>' : '';
    const b = (id, label, icon, cls = '', extra = '') =>
      `<button class="${cls}" data-act="tab" data-v="${id}" ${V.tab === id ? 'aria-current="page"' : ''} aria-label="${label}">${icon}<span>${label}</span>${extra}</button>`;
    return `<div class="tabbar${V._composing ? ' hide-m' : ''}"><div class="brand" aria-hidden="true"><b>Re:</b><span>回信</span></div>
      <nav aria-label="主导航">${b('today', '今天', ICON.today, '', dot)}${b('write', '写信', ICON.pen, 'write')}${b('mailbox', '信箱', ICON.box)}</nav>
      <button class="side-set" data-act="settings">${ICON.gear}<span>设置</span></button></div>`;
  }

  const offlineLine = () => `<div class="offline" data-offline ${V.online ? 'hidden' : ''}>离线中 · 改动会在联网后自动同步</div>`;
  const countBadge = () => { const n = totalLetters(); return n ? `<div class="count" aria-label="已经写了 ${n} 封信">${n}</div>` : ''; };

  // ───────────── 今天 ─────────────
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
      ${showEditor ? `<button class="round-btn" data-act="close-write" aria-label="关闭">${ICON.x}</button>` : '<span style="width:40px"></span>'}
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
    const filters = [['all', '全部'], ['week', '周信'], ['quarter', '季信'], ['year', '年信']];
    const seg = `<div class="seg" role="tablist" aria-label="信的类型">${filters.map(([k, n]) => `<button role="tab" aria-selected="${V.mb === k}" data-act="mb" data-v="${k}">${n}</button>`).join('')}</div>`;
    const first = S.stats.first;
    const days = first ? diffDays(t, first) + 1 : 0;
    const month = Number(t.slice(5, 7));
    const monthN = Object.values(S.letters).filter(l => l.text && l.date.slice(0, 7) === t.slice(0, 7)).length;
    const tiles = `<div class="tiles">
        <button class="tile" data-act="lists" data-v="todos"><span>待办</span><b>${openTodos(t).length}</b></button>
        <button class="tile" data-act="lists" data-v="ideas"><span>点子</span><b>${openIdeas().length}</b></button>
        <div class="tile"><span>${month}月的信</span><b>${monthN}</b></div></div>`;
    const main = V.mb === 'all' ? stateCard(t) + timeline(t) : digestList(V.mb, t);
    return `<main class="page">
      <div class="head">
        <div class="head-l"><span class="eyebrow">${days ? `已经往来 ${days} 天 · ${totalLetters()} 封信` : '还没有信'}</span><h1>信箱</h1></div>
        <button class="round-btn" data-act="settings" aria-label="设置">${ICON.gear}</button>
      </div>
      ${offlineLine()}
      ${seg}${tiles}${main}
    </main>`;
  }

  function energySeries(t, n) {
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
    const letters = Object.values(S.letters).filter(l => l.text && l.text.trim()).sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!letters.length) return `<div class="card empty mt">信箱还是空的。今晚写第一封信吧。<br><button class="lk" data-act="write-day" data-v="${letterDay()}">去写信 ›</button></div>`;
    // 一天一行：写了的是信，没写的留一个空位，可以点进去补写
    const oldest = letters[letters.length - 1].date;
    const start = hasText(letterDay()) ? letterDay() : addDays(letterDay(), -1);
    const groups = [];
    for (let d = start, i = 0; d >= oldest && i < 140; d = addDays(d, -1), i++) {
      const wk = weekKey(d);
      if (!groups.length || groups[groups.length - 1].wk !== wk) groups.push({ wk, days: [] });
      groups[groups.length - 1].days.push(d);
    }
    const thisWk = weekKey(t);
    let html = '';
    groups.forEach(g => {
      const name = g.wk === thisWk ? '本周' : g.wk === addDays(thisWk, -7) ? '上周' : cn(g.wk) + ' 那一周';
      html += `<div class="gh"><h2>${name}</h2><span>${cn(g.wk)} – ${cn(addDays(g.wk, 6))}</span></div>`;
      const dg = S.digests.find(x => x.kind === 'week' && x.key === g.wk);
      if (dg) html += digestCard(dg) + '<div style="height:12px"></div>';
      const rows = g.days.map(d => (hasText(d) ? dayRow(S.letters[d]) : gapRow(d))).join('');
      const gen = !dg && g.wk < thisWk ? `<div class="row foot"><button class="lk" data-act="gen" data-v="week|${g.wk}">让回信写这一周的周信 ›</button></div>` : '';
      html += `<div class="card">${rows}${gen}</div>`;
    });
    html += V.olderLoaded === 'done' ? '' : `<div style="text-align:center;margin-top:20px"><button class="btn ghost sm" data-act="older">更早的信</button></div>`;
    return html;
  }
  function digestList(kind, t) {
    const list = S.digests.filter(d => d.kind === kind);
    const kindN = { week: '周信', quarter: '季信', year: '年信' }[kind];
    const when = { week: '每周一早上 6 点', quarter: '每季度第一天早上 6 点', year: '每年元旦早上 6 点' }[kind];
    const curKey = kind === 'week' ? weekKey(t) : kind === 'quarter' ? quarterKey(t) : t.slice(0, 4);
    const curName = { week: '本周', quarter: '这一季', year: '今年' }[kind];
    let html = `<p class="note" style="margin-top:18px">${kindN}会在${when}自动送达。也可以现在就让回信先写一封${curName}到目前为止的。</p>
      <div style="padding:0 4px"><button class="lk" data-act="gen" data-v="${kind}|${curKey}">现在写${curName}的${kindN} ›</button></div>`;
    html += list.length ? list.map(d => `<div style="margin-top:12px">${digestCard(d)}</div>`).join('') : `<div class="card empty mt">还没有${kindN}。</div>`;
    return html;
  }

  // ───────────── 二级页面 ─────────────
  function openSheet(s, opts) {
    s.fresh = true;
    V.sheets.push(s);
    render();
    if (opts && opts.replace) navReplace();
    else navPush();
  }
  function closeSheet() {
    if (V.burn && V.burn.phase === 'fire') return;
    if (navBack()) return;
    // 没有可回的历史层（例如刚登录还没种下栈），就地关掉
    if (V.burn && V.burn.phase === 'confirm') { V.burn = null; render(); return; }
    const top = V.sheets[V.sheets.length - 1];
    if (top && top.type === 'settings') { closeSettingsFromHistory(); return; }
    V.sheets.pop(); V.droppedIdeas = undefined; if (!V.sheets.length) { V.openGroups = null; V.olderTodos = undefined; } render();
  }
  function viewSheet(s) {
    const titles = { reply: '', letter: '', digest: '', lists: '待办与点子', settings: '设置', todo: s.id ? '编辑待办' : '加一件事', drop: '放下这件事', idea: s.id ? '编辑点子' : '记一个点子' };
    const burning = V.burn && (s.type === 'letter' || s.type === 'reply') && V.burn.date === s.date && V.burn.phase !== 'confirm';
    const anim = s.fresh && !burning ? ' enter' : '';
    s.fresh = false;   // 只在刚打开时升起，之后刷新内容不再重播动画
    let bar;
    if (burning) bar = '';
    else if (s.type === 'settings') {
      const page = V.setPage || '';
      const title = SET_TITLES[page] || '设置';
      const back = page
        ? `<button class="st-back" type="button" data-act="set-back" aria-label="返回设置">${ICON.left}<span class="st-back-t">设置</span></button>`
        : '';
      const close = page ? '' : `<button class="x" data-act="close" aria-label="关闭">${ICON.x}</button>`;
      bar = `<div class="sheet-bar set-bar"><div>${close}${back}<span class="t">${esc(title)}</span></div></div>`;
    } else {
      bar = `<div class="sheet-bar"><div><button class="x" data-act="close" aria-label="关闭">${ICON.x}</button><span class="t">${titles[s.type] || ''}</span><span class="sp"></span></div></div>`;
    }
    const pageClass = s.type === 'settings' ? 'page st-page' : 'page';
    return `<div class="sheet-dim" data-act="close" aria-hidden="true"></div><div class="sheet${anim}${burning ? ' burning' : ''}" role="dialog" aria-modal="true">
      ${bar}
      <div class="${pageClass}">${sheetBody(s)}</div></div>`;
  }
  function sheetBody(s) {
    const t = today();
    if (s.type === 'reply' || s.type === 'letter') {
      const l = S.letters[s.date];
      if (!l) return '<div class="card empty">找不到这封信。</div>';
      const yday = addDays(t, -1);
      const title = !l.reply || isSealed(l.date) ? cn(l.date) + '的信' : l.date === yday ? '昨晚的回信' : l.date === t ? '今天的回信' : cn(l.date) + '的回信';
      const burning = V.burn && V.burn.date === s.date && V.burn.phase !== 'confirm';
      const head = `<div class="head"><div class="head-l"><span class="eyebrow">Re: No.${letterNo(l.date)} · 星期${wd(l.date)}</span><h1 style="font-size:28px">${title}</h1></div></div>`;
      let inner = '';
      if (!l.reply || isSealed(l.date)) {
        inner += `<div class="card paper mt"><p class="letter-text">${esc(l.text)}</p></div>`;
        if (!burning) inner += isSealed(l.date) ? `<p class="note">回信已经写好，封存到 ${cn(addDays(l.date, 1))} 早上 6:00。</p>` : `<p class="note">这封信还没有回信。</p>`;
      } else {
        inner += replyView(l, { mine: true, go: !burning && l.date >= yday && s.type === 'reply' });
      }
      if (burning) {
        return `<div class="burn-stage ${V.burn.phase}" id="burn-stage">
          <div class="burn-page">${head}${inner}</div>
        </div>`;
      }
      return head + inner
        + `<div style="padding:0 4px;margin-top:8px"><button class="lk" data-act="open-in-write" data-v="${l.date}">在写信里打开</button></div>`
        + `<div class="burn-entry"><button type="button" class="burn-link" data-act="burn-ask" data-v="${l.date}">焚毁这封信</button></div>`;
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
    if (s.type === 'settings') return settingsBody();
    return '';
  }

  // ───────────── 设置（iOS 分组列表 + 二级页） ─────────────
  const SET_TITLES = {
    name: '称呼', deliver: '回信送达', ai: 'AI 回信', appearance: '外观',
    habits: '习惯', questions: '回信问题', api: 'API 密钥',
  };
  const AI_HELP = '接上之后，你的回信和周信都用你自己的 AI 写，花的是你自己的额度。Key 加密保存在服务器上，网页里只显示后 4 位。DeepSeek、智谱、通义千问、Kimi、硅基流动等大多数服务商都能这样接入；模型名以服务商控制台为准。自己的 AI 出错时，会自动改用免费模型，不会漏掉回信。';
  const KEY_RISK = '有了这串密钥，就能读到你全部的信、待办、点子和习惯。只交给你信任的 agent，别发给别人；担心泄露就点作废。接口只能读，不能改。';
  const KEY_HIDDEN = '你的密钥（只在生成时显示过，忘了就重新生成）';

  function settingsOpen() {
    return !!(V.sheets.length && V.sheets[V.sheets.length - 1].type === 'settings');
  }
  function dropSettingsHistory() {
    V.setPage = '';
    V.setAnim = '';
    if (V.key) V.key.fresh = '';
  }
  function setUrl(page) { return page ? '#settings/' + page : '#settings'; }

  // ───────────── 返回栈 ─────────────
  // 每一层可进入的界面（写信、信、回信、周季年信、待办列表、待办/点子编辑、
  // 设置及二级页、寄出屏、焚毁确认）都 pushState。手机边缘滑动和浏览器后退
  // 都走 popstate，只退一层。点 ✕ / 返回也走 history.back()，避免自己关了
  // 却留下一条空历史。自己记 navDepth，因为浏览器不让读整个历史栈。
  let navDepth = 0;
  let navLock = null;          // null | 'rewind'
  let navRewindTo = 0;
  let navRewindAfter = null;

  function navSnap() {
    return {
      hx: 'nav',
      depth: navDepth,
      tab: V.tab,
      writeDate: V.writeDate,
      editing: !!V.editing,
      sheets: V.sheets.map(s => ({
        type: s.type, date: s.date, id: s.id, kind: s.kind, key: s.key,
        tab: s.tab, note: s.note,
      })),
      setPage: V.setPage || '',
      sent: V.sent ? { date: V.sent.date, at: V.sent.at ? new Date(V.sent.at).toISOString() : null } : null,
      burn: (V.burn && V.burn.phase === 'confirm') ? { date: V.burn.date, items: !!V.burn.items } : null,
    };
  }
  function navUrl(st) {
    const s = st || navSnap();
    if (s.burn) return '#burn';
    if (s.sent) return '#sent';
    const top = s.sheets && s.sheets[s.sheets.length - 1];
    if (top) {
      if (top.type === 'settings') return s.setPage ? '#settings/' + s.setPage : '#settings';
      if (top.type === 'reply' && top.date) return '#reply/' + top.date;
      if (top.type === 'letter' && top.date) return '#letter/' + top.date;
      if (top.type === 'digest') return '#digest/' + (top.kind || '') + '/' + encodeURIComponent(top.key || '');
      if (top.type === 'lists') return '#lists' + (top.tab ? '/' + top.tab : '');
      if (top.type === 'todo') return '#todo';
      if (top.type === 'idea') return '#idea';
      if (top.type === 'drop') return '#drop';
    }
    if (s.tab === 'write') return '#write';
    if (s.tab === 'mailbox') return '#mailbox';
    return location.pathname + location.search;
  }
  function navSeed() {
    navDepth = 0;
    history.replaceState(navSnap(), '', navUrl());
  }
  function navPush() {
    if (navLock) return;
    navDepth += 1;
    history.pushState(navSnap(), '', navUrl());
  }
  function navReplace() {
    if (navLock) return;
    const st = navSnap();
    st.depth = navDepth;
    history.replaceState(st, '', navUrl(st));
  }
  function navBack() {
    if (navLock) return false;
    if (history.state && history.state.hx === 'nav' && (history.state.depth || 0) > 0) {
      history.back();
      return true;
    }
    return false;
  }
  function navTargetDepth() {
    let d = 0;
    if (V.tab === 'write') d++;
    d += V.sheets.length;
    if (V.setPage) d++;
    if (V.sent) d++;
    if (V.burn && V.burn.phase === 'confirm') d++;
    return d;
  }
  // 界面已经改好（寄出关掉、焚毁完成、切 tab），把多出来的历史条目收回来，
  // 并 replace 成现在的界面，清掉指向已焚毁信件这类过期状态的前进记录。
  function navRewind(toDepth, after) {
    toDepth = Math.max(0, toDepth);
    if (navDepth <= toDepth) {
      navDepth = toDepth;
      navReplace();
      if (after) after();
      return;
    }
    navLock = 'rewind';
    navRewindTo = toDepth;
    navRewindAfter = after || null;
    history.back();
  }
  function navRewindToCurrent(after) {
    navRewind(navTargetDepth(), after);
  }
  function resetOverlays() {
    V.sheets = [];
    V.setPage = '';
    V.setAnim = '';
    V.sent = null;
    if (!(V.burn && V.burn.phase === 'fire')) V.burn = null;
    V.droppedIdeas = undefined;
    V.openGroups = null;
    V.olderTodos = undefined;
    if (V.key) V.key.fresh = '';
  }
  function leavingWrite(nextTab) {
    if (V.tab === 'write' && nextTab !== 'write') {
      flushWriteDraft();
      V.editing = false;
      if (rec) try { rec.stop(); } catch (e) { /* ignore */ }
    }
  }
  function flushWriteDraft() {
    clearTimeout(afterRender._t);
    const ed = $('#editor');
    if (!ed) return;
    const d = V.writeDate;
    if (!d || !S) return;
    const text = ed.value;
    const l = S.letters[d];
    const had = !!(l && l.text && l.text.trim());
    if (!String(text).trim() && had) {
      // 空内容不得覆盖已有正文（已寄出的信尤其不能被掏空）
      store.del('hx_draft_' + d);
      return;
    }
    store.set('hx_draft_' + d, text);
    if (text !== ((l && l.text) || '')) saveLetter(d, text);
  }
  function applyNav(st) {
    navDepth = (st && st.depth) || 0;
    const sheets = ((st && st.sheets) || []).filter(s => {
      if ((s.type === 'letter' || s.type === 'reply') && S && !S.letters[s.date]) return false;
      return true;
    }).map(s => Object.assign({}, s, { fresh: false }));
    const wasPage = V.setPage || '';
    const nextPage = (st && st.setPage) || '';
    V.tab = (st && st.tab) || 'today';
    if (st && st.writeDate) V.writeDate = st.writeDate;
    V.sheets = sheets;
    V.setPage = nextPage;
    V.setAnim = (!wasPage && nextPage) ? 'push' : (wasPage && !nextPage) ? 'pop' : '';
    if (!sheets.some(s => s.type === 'lists')) V.droppedIdeas = undefined;
    if (!sheets.length) { V.openGroups = null; V.olderTodos = undefined; }
    if (st && st.sent && S && S.letters[st.sent.date] && sendsTonight(st.sent.date)) {
      V.sent = { date: st.sent.date, at: st.sent.at ? new Date(st.sent.at) : new Date() };
    } else {
      V.sent = null;
    }
    if (st && st.burn && S && S.letters[st.burn.date]) {
      V.burn = { date: st.burn.date, items: !!st.burn.items, phase: 'confirm' };
    } else if (!(V.burn && V.burn.phase === 'fire')) {
      V.burn = null;
    }
    V.editing = !!(st && st.editing && V.tab === 'write');
    if (sheets.some(s => s.type === 'settings')) {
      V.ai = V.ai || { loading: true };
      V.key = V.key || { loading: true };
    }
    render();
  }
  function bootNav() {
    // 先把当前页种成根，避免第一条后退直接离开站点；再按地址栏补一层。
    const hash = (location.hash || '').replace(/^#/, '');
    navDepth = 0;
    const seed = navSnap();
    seed.tab = (V.tab === 'write') ? 'today' : (V.tab || 'today');
    seed.sheets = [];
    seed.setPage = '';
    seed.sent = null;
    seed.burn = null;
    seed.editing = false;
    history.replaceState(seed, '', location.pathname + location.search);
    if (!S) return;
    if (hash === 'mailbox') {
      V.tab = 'mailbox';
      render();
      navReplace();
    } else if (hash === 'write') {
      V.tab = 'write';
      V.writeDate = V.writeDate || letterDay();
      render();
      navPush();
    } else if (hash === 'settings' || hash.startsWith('settings/')) {
      const page = hash.startsWith('settings/') ? hash.slice('settings/'.length) : '';
      openSettings();
      if (page && SET_TITLES[page]) {
        V.setPage = page;
        V.setAnim = '';
        render();
        navPush();
      }
    }
  }

  function openSettings() {
    if (settingsOpen()) return;
    V.ai = { loading: true };
    V.key = { loading: true };
    V.setPage = '';
    V.setAnim = '';
    openSheet({ type: 'settings' });
    loadAI();
    loadKey();
  }
  function goSetPage(page) {
    if (!SET_TITLES[page]) return;
    flushSetPage();
    V.setPage = page;
    V.setAnim = 'push';
    render();
    navPush();
  }
  function backSetPage() {
    if (navBack()) return;
    applySetPage('', 'pop');
  }
  function applySetPage(page, anim) {
    flushSetPage();
    V.setPage = page || '';
    V.setAnim = anim || '';
    render();
    navReplace();
  }
  function closeSettingsFromHistory() {
    flushSetPage();
    if (V.key) V.key.fresh = '';
    V.setPage = '';
    V.setAnim = '';
    if (settingsOpen()) V.sheets.pop();
    V.droppedIdeas = undefined;
    if (!V.sheets.length) { V.openGroups = null; V.olderTodos = undefined; }
    render();
  }
  function closeSettings() {
    flushSetPage();
    if (V.key) V.key.fresh = '';
    if (navBack()) return;
    closeSettingsFromHistory();
  }
  window.addEventListener('popstate', () => {
    if (navLock === 'rewind') {
      const st = history.state;
      const d = (st && st.hx === 'nav') ? (st.depth || 0) : 0;
      if (d > navRewindTo) { history.back(); return; }
      navDepth = navRewindTo;
      navLock = null;
      const after = navRewindAfter;
      navRewindAfter = null;
      navReplace();
      if (after) after();
      return;
    }
    if (!S) return;
    const st = history.state;
    // 焚毁请求进行中，不允许后退取消；把刚弹掉的这一层推回去
    if (V.burn && V.burn.phase === 'fire') {
      navDepth = (st && st.hx === 'nav' ? (st.depth || 0) : navDepth) + 1;
      history.pushState(navSnap(), '', navUrl());
      return;
    }
    if (V.tab === 'write' && (!st || st.hx !== 'nav' || st.tab !== 'write')) leavingWrite((st && st.tab) || 'today');
    if ((settingsOpen() || V.setPage) && !(st && st.setPage && st.setPage === V.setPage)) flushSetPage();
    if (st && st.hx === 'nav') {
      applyNav(st);
      return;
    }
    // 兼容旧的设置历史 { hx: 'set' }，以及退到我们种下根之前的空白条目
    if (st && st.hx === 'set') {
      if (!settingsOpen()) {
        V.setPage = st.page || '';
        V.setAnim = '';
        V.ai = V.ai || { loading: true };
        V.key = V.key || { loading: true };
        V.sheets.push({ type: 'settings', fresh: false });
        if (!V.ai.data) loadAI();
        if (!V.key.data) loadKey();
      } else {
        flushSetPage();
        const was = V.setPage || '';
        V.setPage = st.page || '';
        V.setAnim = (!was && V.setPage) ? 'push' : (was && !V.setPage) ? 'pop' : '';
      }
      render();
      return;
    }
    leavingWrite('today');
    resetOverlays();
    V.tab = 'today';
    navDepth = 0;
    render();
  });

  // 测试用：给 Playwright 读当前栈深和界面，不会改变行为
  try { window.__hxNav = () => ({ depth: navDepth, lock: navLock, state: history.state, v: { tab: V.tab, writeDate: V.writeDate, editing: V.editing, sheets: V.sheets.map(s => s.type), setPage: V.setPage || '', sent: V.sent, burn: V.burn } }); } catch (e) { /* ignore */ }

  function flushSetPage() {
    if (!S) return;
    if (V.setPage === 'questions') {
      const el = document.getElementById('set-q');
      if (el) {
        const qs = el.value.split('\n').map(s => s.trim()).filter(Boolean);
        if (qs.length && qs.join('\n') !== (S.settings.questions || []).join('\n')) {
          S.settings.questions = qs;
          queue('PUT', '/settings', { questions: qs });
          toCache();
        }
      }
    }
    if (V.setPage === 'name') {
      const nm = document.getElementById('set-name');
      if (nm) {
        const name = nm.value.trim();
        if (name !== (S.user.name || '')) {
          S.user.name = name;
          queue('PUT', '/settings', { name });
          toCache();
        }
      }
    }
  }

  function stSec(inner, head, foot) {
    return `<div class="st-sec">${head ? `<div class="st-head">${head}</div>` : ''}<div class="st-group">${inner}</div>${foot ? `<div class="st-foot">${foot}</div>` : ''}</div>`;
  }
  function stRow({ act, v, title, value, grow, danger, chev, html }) {
    const attrs = act ? `type="button" data-act="${act}"${v != null ? ` data-v="${esc(String(v))}"` : ''}` : 'type="button" disabled';
    const cls = 'st-row' + (act ? '' : ' st-static') + (danger ? ' st-danger-row' : '');
    return `<button class="${cls}" ${attrs}><span class="st-body">
      <span class="st-t${grow || value == null ? ' st-grow' : ''}${danger ? ' st-danger' : ''}">${title}</span>
      ${value != null ? `<span class="st-value">${esc(value)}</span>` : ''}
      ${chev ? '<span class="st-chev" aria-hidden="true">' + ICON.chev + '</span>' : ''}
      ${html || ''}
    </span></button>`;
  }

  function themeName(id) {
    const t = THEMES.find(x => x.id === (id || 'auto'));
    return t ? t.name : '跟随系统';
  }
  function aiRowValue() {
    const d = V.ai && V.ai.data;
    if (!d || V.ai.loading) return V.ai && V.ai.error ? '未读取' : '读取中…';
    if (d.configured) return ((d.providers[d.provider] || d.providers.custom).name) || '已接入';
    return '免费模型';
  }
  function keyRowValue() {
    const K = V.key || {};
    if (K.loading) return '读取中…';
    if (K.error || !K.data) return '未读取';
    return K.data.exists ? '已生成' : '未生成';
  }

  function settingsBody() {
    const page = V.setPage || '';
    const anim = V.setAnim === 'push' ? ' st-push' : V.setAnim === 'pop' ? ' st-pop' : '';
    V.setAnim = '';
    const inner = page ? settingsSub(page) : settingsList();
    return `<div class="st-view${anim}">${inner}</div>`;
  }

  function settingsList() {
    const name = (S.user.name && String(S.user.name).trim()) || '未设置';
    const deliver = deliverMode() === 'now' ? '寄出后马上' : '明早 6:00';
    const habits = S.habits.filter(h => !h.archived);
    const qs = (S.settings.questions || []).filter(x => String(x || '').trim());
    return stSec(
        stRow({ act: 'set-page', v: 'name', title: '称呼', value: name, chev: true })
        + stRow({ act: 'set-page', v: 'deliver', title: '回信送达', value: deliver, chev: true })
      )
      + stSec(stRow({ act: 'set-page', v: 'ai', title: 'AI 回信', value: aiRowValue(), chev: true }))
      + stSec(
        stRow({ act: 'set-page', v: 'appearance', title: '外观', value: themeName(S.settings.theme), chev: true })
        + stRow({ act: 'set-page', v: 'habits', title: '习惯', value: habits.length ? (habits.length + ' 个') : '未添加', chev: true })
        + stRow({ act: 'set-page', v: 'questions', title: '回信问题', value: qs.length ? (qs.length + ' 个') : '未设置', chev: true })
      )
      + stSec(stRow({ act: 'set-page', v: 'api', title: 'API 密钥', value: keyRowValue(), chev: true }))
      + stSec(
        `<div class="st-row st-static"><span class="st-body">
          <span class="st-ok" aria-hidden="true">${ICON.checkSm}</span>
          <span class="st-t st-grow">已登录</span>
          <span class="st-value">${esc(S.user.username || '')}</span>
        </span></div>`
        + stRow({ act: 'logout', title: '退出登录', grow: true }),
        '账号'
      )
      + `<p class="st-tag">回信 Re: · 今晚写给明早的自己</p>`;
  }

  function settingsSub(page) {
    if (page === 'name') return settingsName();
    if (page === 'deliver') return settingsDeliver();
    if (page === 'ai') return aiSettings();
    if (page === 'appearance') return settingsAppearance();
    if (page === 'habits') return settingsHabits();
    if (page === 'questions') return settingsQuestions();
    if (page === 'api') return keySettings();
    return settingsList();
  }

  function settingsName() {
    return stSec(
      `<div class="st-row st-static"><span class="st-body">
        <span class="st-t">称呼</span>
        <input class="st-in" id="set-name" value="${esc(S.user.name || '')}" placeholder="比如：非云" maxlength="20" autocomplete="nickname">
      </span></div>`,
      '',
      '回信怎么称呼你'
    );
  }

  function settingsDeliver() {
    const dm = deliverMode();
    const opt = (v, t1, t2) => `<button class="st-row" type="button" data-act="deliver" data-v="${v}" aria-pressed="${dm === v}">
      <span class="st-body">
        <span class="st-main">
          <span class="st-t st-grow">${t1}</span>
          <span class="st-sub">${t2}</span>
        </span>
        ${dm === v ? `<span class="st-tick" aria-hidden="true">${ICON.tick}</span>` : ''}
      </span></button>`;
    return stSec(
      opt('morning', '明早 6:00 拆信', '今晚寄出的信，回信封存到第二天早上；补写的信马上送到')
      + opt('now', '寄出后马上', '写完就能看到回信'),
      '回信什么时候送到'
    );
  }

  function settingsAppearance() {
    const cur = S.settings.theme || 'auto';
    const items = THEMES.map(th => {
      const on = cur === th.id;
      const bg = th.id === 'auto' ? 'linear-gradient(90deg,#F2F2F7 50%,#000 50%)' : th.sw[0];
      return `<button class="st-theme${on ? ' on' : ''}" type="button" data-act="theme" data-v="${th.id}" aria-pressed="${on}" aria-label="${esc(th.name)}">
        <span class="st-ring"><span class="st-sw" style="background:${bg}"><i class="st-bar" style="background:${th.sw[2]};width:60%"></i><i class="st-bar" style="background:${th.sw[1]};width:85%"></i></span></span>
        <span class="st-tn">${esc(th.name)}</span>
      </button>`;
    }).join('');
    return stSec(`<div class="st-themes">${items}</div>`, '外观');
  }

  function settingsHabits() {
    const habits = S.habits.filter(h => !h.archived);
    const rows = habits.length
      ? habits.map(h => `<div class="st-row st-static"><span class="st-body">
          <input class="st-in st-left" value="${esc(h.name)}" data-habit-name="${h.id}" maxlength="30" aria-label="习惯名称">
          <button class="st-act st-danger" type="button" data-act="habit-del" data-v="${h.id}">删除</button>
        </span></div>`).join('')
      : `<div class="st-row st-static"><span class="st-body"><span class="st-empty">还没有习惯</span></span></div>`;
    const add = `<form id="habit-form" class="st-row st-static"><span class="st-body">
        <input class="st-in st-left" id="habit-new" maxlength="30" placeholder="新习惯，比如：运动 30 分钟" aria-label="新习惯" autocomplete="off">
        <button class="st-act st-accent" type="submit">添加</button>
      </span></form>`;
    return stSec(rows + add, '写信时顺手打卡的习惯');
  }

  function settingsQuestions() {
    const text = (S.settings.questions || []).join('\n');
    return stSec(
      `<div class="st-row st-static"><span class="st-body st-area-body">
        <textarea class="st-area" id="set-q" maxlength="1200">${esc(text)}</textarea>
      </span></div>`
      + stRow({ act: 'save-q', title: '保存问题', grow: true }),
      '回信写信时会想着的问题（一行一个）'
    );
  }

  // V.ai：{ loading, data（服务器上的配置，不含 Key）, form（正在填的）, pick（列表里勾的项，free 表示免费模型）, msg, busy }
  async function loadAI() {
    V.ai = Object.assign({}, V.ai, { loading: true });
    try {
      const d = await api('GET', '/ai-config');
      const pick = d.configured ? d.provider : 'free';
      const pre = d.providers[pick] || {};
      V.ai = {
        data: d,
        pick,
        form: { provider: d.configured ? d.provider : 'deepseek', base_url: d.base_url || pre.base || '', model: d.model || pre.model || '', key: '' },
      };
    } catch (e) { V.ai = { error: e.message }; }
    if (settingsOpen()) render();
  }
  function aiSettings() {
    const A = V.ai || {};
    if (A.loading) return stSec(`<div class="st-row st-static"><span class="st-body"><span class="st-empty">读取中…</span></span></div>`);
    if (A.error || !A.data) return stSec(`<div class="st-row st-static"><span class="st-body"><span class="st-empty">${esc(A.error || '联网后可以设置')}</span></span></div>`);
    const d = A.data, f = A.form || {}, P = d.providers;
    const pick = A.pick || (d.configured ? d.provider : 'free');
    const showForm = pick !== 'free';
    const status = d.configured
      ? `<span class="st-t st-grow st-wrap">正在用你自己的 <b>${esc((P[d.provider] || P.custom).name)}</b></span>
         <span class="st-sub">${esc(d.model)} · Key 尾号 ${esc(d.last4)}</span>`
      : `<span class="st-t st-grow st-wrap">正在用 <b>Cloudflare 免费模型</b></span>
         <span class="st-sub">不用花钱，但每天有额度上限，写一封要等半分钟左右。</span>`;
    const head = stSec(`<div class="st-row st-static"><span class="st-body"><span class="st-main">${status}</span></span></div>`);
    const providers = [{ id: 'free', name: 'Cloudflare 免费模型（默认）' }].concat(Object.entries(P).map(([id, v]) => ({ id, name: v.name })));
    const list = providers.map(p => {
      const on = (d.configured ? d.provider : 'free') === p.id;
      const pending = pick === p.id && !on;
      return `<button class="st-row" type="button" data-act="ai-provider" data-v="${esc(p.id)}">
        <span class="st-body">
          <span class="st-t st-grow st-wrap">${esc(p.name)}</span>
          ${pending ? '<span class="st-pending">将使用</span>' : ''}
          ${on ? `<span class="st-tick" aria-hidden="true">${ICON.tick}</span>` : ''}
        </span></button>`;
    }).join('');
    let html = head + stSec(list, '服务商', AI_HELP);
    if (showForm) {
      const keyPh = (d.configured && pick === d.provider)
        ? ('已保存（尾号 ' + d.last4 + '），不改就留空')
        : '粘贴服务商给你的 Key';
      html += stSec(
        `<div class="st-row st-static"><span class="st-body st-col"><span class="st-lab">接口地址</span>
          <input class="st-in st-left" id="ai-base" data-ai="base_url" value="${esc(f.base_url || '')}" placeholder="https://…/v1" inputmode="url" autocomplete="off" spellcheck="false"></span></div>`
        + `<div class="st-row st-static"><span class="st-body st-col"><span class="st-lab">模型名</span>
          <input class="st-in st-left" id="ai-model" data-ai="model" value="${esc(f.model || '')}" placeholder="比如 deepseek-chat" autocomplete="off" spellcheck="false"></span></div>`
        + `<div class="st-row st-static"><span class="st-body st-col"><span class="st-lab">API Key</span>
          <input class="st-in st-left" id="ai-key" data-ai="key" type="password" value="${esc(f.key || '')}" placeholder="${esc(keyPh)}" autocomplete="off" spellcheck="false"></span></div>`
      );
      html += stSec(
        stRow({ act: 'ai-test', title: A.busy === 'test' ? '测试中…' : '测试一下', grow: true })
        + stRow({ act: 'ai-save', title: A.busy === 'save' ? '保存中…' : '保存', grow: true }),
        '',
        A.msg ? `<span class="${A.ok ? 'st-msg-ok' : 'st-danger'}">${esc(A.msg)}</span>` : ''
      );
    }
    if (d.configured) {
      html += stSec(stRow({ act: 'ai-off', title: '停用，改回免费模型', grow: true, danger: true }));
    }
    return `<div class="${A.busy ? 'st-busy' : ''}">${html}</div>`;
  }

  // V.key：{ loading, data, fresh（刚生成的完整密钥，只显示这一次）, busy, error }
  async function loadKey() {
    V.key = Object.assign({}, V.key, { loading: true });
    try { V.key = { data: await api('GET', '/api-key'), fresh: (V.key && V.key.fresh) || '' }; }
    catch (e) { V.key = { error: e.message }; }
    if (settingsOpen()) render();
  }
  function bjTime(iso) {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    const d = new Date(t + 8 * 3600e3).toISOString();
    return cn(d.slice(0, 10)) + ' ' + d.slice(11, 16);
  }
  function keyDoc(key) {
    const url = location.origin + '/api/v1/export';
    const since = today().slice(0, 8) + '01';
    return ['回信只读 API',
      `地址：GET ${url}`,
      `请求头：Authorization: Bearer ${key || KEY_HIDDEN}`,
      '可选参数：since=YYYY-MM-DD（只要这天以后的）；type=letters,todos,ideas,habits,digests（只要某几类，逗号分隔）',
      `示例：curl -H "Authorization: Bearer ${key || '<你的密钥>'}" "${url}?since=${since}"`,
      '返回 JSON：letters（信和回信）、todos、ideas、habits、habit_logs、digests（周信季信年信）。只能读，不能改。每分钟最多 30 次。',
    ].join('\n');
  }
  function keySettings() {
    const K = V.key || {};
    if (K.loading) return stSec(`<div class="st-row st-static"><span class="st-body"><span class="st-empty">读取中…</span></span></div>`);
    if (K.error || !K.data) return stSec(`<div class="st-row st-static"><span class="st-body"><span class="st-empty">${esc(K.error || '联网后可以设置')}</span></span></div>`);
    const d = K.data;
    if (!d.exists) {
      return stSec(
        `<div class="st-row st-static"><span class="st-body"><span class="st-main">
          <span class="st-t st-grow">还没有密钥</span>
          <span class="st-sub">生成后，你信任的 agent 或工具可以用它读取你的数据</span>
        </span></span></div>`,
        '',
        KEY_RISK
      ) + stSec(stRow({ act: 'key-new', title: K.busy ? '生成中…' : '生成密钥', grow: true }));
    }
    return stSec(
        `<div class="st-row st-static"><span class="st-body"><span class="st-main">
          <span class="st-t st-grow">密钥 ${esc(d.hint)}…</span>
          <span class="st-sub">${esc(bjTime(d.created_at))} 生成 · ${d.last_used_at ? '最近使用 ' + esc(bjTime(d.last_used_at)) : '还没用过'}</span>
        </span></span></div>`,
        '',
        KEY_RISK
      )
      + stSec(
        `<div class="st-row st-static"><span class="st-body st-key-body">
          <pre class="st-key" id="key-doc">${esc(keyDoc(K.fresh))}</pre>
          <span class="st-key-foot">
            <button class="st-copy" type="button" data-act="key-copy">${K.fresh ? '复制' : '复制用法'}</button>
            <span class="st-t st-grow st-risk">${K.fresh ? '只显示这一次，先复制好。' : '把密钥那行换成你保存的密钥。'}</span>
          </span>
        </span></div>`
      )
      + stSec(stRow({ act: 'key-regen', title: K.busy ? '生成中…' : '重新生成', grow: true }))
      + stSec(stRow({ act: 'key-revoke', title: '作废', grow: true, danger: true }));
  }

  // ───────────── 渲染后的绑定（输入框、表单） ─────────────

  function viewBurn() {
    if (!V.burn || V.burn.phase !== 'confirm') return '';
    return `<div class="burn-dim" data-act="burn-keep" aria-hidden="true"></div>
      <div class="burn-card" role="dialog" aria-modal="true" aria-labelledby="burn-msg">
        <p class="burn-msg" id="burn-msg">焚毁后，这封信和它的回信都会消失，<br>找不回来。</p>
        <label class="burn-check">
          <input type="checkbox" data-act="burn-items"${V.burn.items ? ' checked' : ''}>
          <span>同时删掉它整理出的待办和点子</span>
        </label>
        <div class="burn-actions">
          <button class="btn burn-keep" type="button" data-act="burn-keep" id="burn-keep">留着</button>
          <button class="burn-hold" type="button" id="burn-hold" style="--hold:0" aria-label="按住一秒半焚毁这封信">
            <i class="fill" aria-hidden="true"></i>
            <span class="lab-idle">焚毁</span>
            <span class="lab-on" aria-hidden="true">焚毁</span>
          </button>
        </div>
        <p class="burn-hint">按住「焚毁」一秒半，松手即取消</p>
      </div>`;
  }

  // 按住 1.5 秒才焚毁：短按、滑动、中途松手都没有效果
  function bindBurnHold() {
    const btn = $('#burn-hold');
    if (!btn) return;
    const HOLD_MS = 1500, MOVE = 10;
    let raf = 0, start = 0, x0 = 0, y0 = 0, holding = false, pid = null;
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; holding = false;
      if (pid != null) { try { btn.releasePointerCapture(pid); } catch (e) { /* ignore */ } pid = null; }
      btn.style.setProperty('--hold', 0);
      btn.classList.remove('holding');
    };
    const tick = now => {
      const t = Math.min(1, (now - start) / HOLD_MS);
      btn.style.setProperty('--hold', t);
      if (t >= 1) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0; holding = false;
        if (pid != null) { try { btn.releasePointerCapture(pid); } catch (e) { /* ignore */ } pid = null; }
        doBurn();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    btn.addEventListener('pointerdown', e => {
      if (e.button) return;
      e.preventDefault();
      e.stopPropagation();
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      pid = e.pointerId; holding = true; x0 = e.clientX; y0 = e.clientY;
      start = performance.now();
      btn.classList.add('holding');
      btn.style.setProperty('--hold', 0);
      raf = requestAnimationFrame(tick);
    });
    btn.addEventListener('pointermove', e => {
      if (holding && Math.hypot(e.clientX - x0, e.clientY - y0) > MOVE) stop();
    });
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('lostpointercapture', () => { if (holding) stop(); });
    btn.addEventListener('contextmenu', e => e.preventDefault());
    btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function doBurn() {
    const b = V.burn;
    if (!b || b.busy || b.phase !== 'confirm') return;
    b.busy = true;
    const date = b.date, items = !!b.items;
    const animMs = 400;
    b.phase = 'fire';
    render();
    const t0 = performance.now();
    try {
      await api('POST', `/letters/${date}/burn`, { items });
      await sleep(Math.max(0, animMs - (performance.now() - t0)));
      if (!V.burn || V.burn !== b) return;
      applyBurnLocal(date, items);
      V.burn = null;
      V.sheets = V.sheets.filter(s => !((s.type === 'letter' || s.type === 'reply') && s.date === date));
      toCache();
      render();
      navRewindToCurrent();
    } catch (e) {
      if (V.burn === b) { b.phase = 'confirm'; b.busy = false; render(); }
      toast(e.message || '没能焚毁，请再试一次');
    }
  }

  function applyBurnLocal(date, items) {
    delete S.letters[date];
    if (items) {
      S.todos = S.todos.filter(x => x.source_date !== date);
      S.ideas = S.ideas.filter(x => x.source_date !== date);
      if (Array.isArray(V.droppedIdeas)) V.droppedIdeas = V.droppedIdeas.filter(x => x.source_date !== date);
    }
    Object.keys(S.feedback).forEach(k => { if (k.startsWith(date + '|')) delete S.feedback[k]; });
    const remain = Object.values(S.letters).filter(l => l.text && l.text.trim());
    S.stats.letters = Math.max(0, (S.stats.letters || 1) - 1);
    if (S.stats.first === date) S.stats.first = remain.map(l => l.date).sort()[0] || null;
    outbox = outbox.filter(o => !String(o.path || '').startsWith('/letters/' + date));
    store.set('hx_outbox', outbox);
    store.del('hx_draft_' + date);
  }

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
    bindBurnHold();
    if (V.burn && V.burn.phase === 'confirm' && $('#burn-keep')) $('#burn-keep').focus();
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
    // 空保存不得覆盖已有正文（关掉空编辑器时，不能把已寄出的信掏空）
    if (!(text || '').trim() && l.text && l.text.trim()) return;
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
    navReplace();
    if (V.sent) navPush();
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
      const hadDigest = V.sheets.some(s => s.type === 'digest');
      V.sheets = V.sheets.filter(s => s.type !== 'digest');
      openSheet({ type: 'digest', kind: r.digest.kind, key: r.digest.key }, hadDigest ? { replace: true } : undefined);
    } catch (e) { toast(e.message); }
  }

  function startEdit(d) {
    if (settingsOpen() || V.setPage) flushSetPage();
    leavingWrite('write');
    resetOverlays();
    V.tab = 'write'; V.writeDate = d; V.editing = true; V.sent = null;
    store.set('hx_draft_' + d, (S.letters[d] || {}).text || '');
    render();
    const want = navTargetDepth();
    if (navDepth === want) navReplace();
    else if (navDepth > want) navRewind(want);
    else navPush();
  }

  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]');
    if (!el || !S) return;
    const act = el.dataset.act, v = el.dataset.v;
    const t = today();
    switch (act) {
      case 'tab': {
        if (v === V.tab && !V.sheets.length && !V.sent && !(V.burn && V.burn.phase === 'confirm') && !V.setPage) break;
        if (settingsOpen() || V.setPage) flushSetPage();
        leavingWrite(v);
        resetOverlays();
        V.tab = v;
        if (v === 'write') V.writeDate = V.writeDate || letterDay();
        render();
        if (v === 'write') {
          if (navDepth === 0) navPush();
          else navRewind(0, () => navPush());
        } else {
          navRewind(0);
        }
        break;
      }
      case 'close-write':
        leavingWrite('today');
        if (navBack()) break;
        resetOverlays();
        V.tab = 'today';
        render();
        navRewind(0);
        break;
      case 'write-day': {
        if (settingsOpen() || V.setPage) flushSetPage();
        const already = V.tab === 'write' && navDepth > 0 && !V.sheets.length && !V.sent;
        leavingWrite('write');
        resetOverlays();
        V.tab = 'write'; V.writeDate = v; V.editing = !hasText(v); V.replyErr = ''; V.sent = null;
        render();
        if (already) navReplace();
        else if (navDepth === 0) navPush();
        else navRewind(0, () => navPush());
        break;
      }
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
        V.sheets.pop(); openSheet({ type: 'drop', id: v, note }, { replace: true }); break;
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
        toCache();
        if (V.sheets.length && V.sheets[V.sheets.length - 1].type === 'idea') V.sheets.pop();
        render();
        navRewindToCurrent();
        toast('已转成待办'); break;
      }
      case 'idea-drop':
        V._droppedIdea = S.ideas.find(y => y.id === v) || null;
        queue('PUT', '/ideas/' + v, { status: 'dropped' });
        S.ideas = S.ideas.filter(y => y.id !== v);
        toCache();
        if (V.sheets.length && V.sheets[V.sheets.length - 1].type === 'idea') V.sheets.pop();
        render();
        navRewindToCurrent();
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
      case 'sent-close':
        V.sent = null; V.tab = 'today'; resetOverlays(); render(); navRewind(0); break;
      case 'skip-backfill': store.set('hx_skipbf_' + v, true); render(); break;
      case 'open-reply': markOpened(v); openSheet({ type: 'reply', date: v }); break;
      case 'go-today':
        if (settingsOpen() || V.setPage) flushSetPage();
        leavingWrite('today');
        resetOverlays();
        V.tab = 'today';
        render();
        navRewind(0);
        break;
      case 'fb': {
        const key = el.dataset.d + '|' + v; const val = Number(el.dataset.x);
        const next = S.feedback[key] === val ? 0 : val;
        if (next) S.feedback[key] = next; else delete S.feedback[key];
        api('POST', '/feedback', { date: el.dataset.d, block: v, value: next }).catch(() => {});
        toCache(); render(); break;
      }
      case 'mb': V.mb = v; render(); break;
      case 'letter': if (!isSealed(v)) markOpened(v); openSheet({ type: 'letter', date: v }); break;
      case 'open-in-write': {
        if (settingsOpen() || V.setPage) flushSetPage();
        leavingWrite('write');
        resetOverlays();
        V.tab = 'write'; V.writeDate = v; V.editing = false; V.sent = null;
        render();
        if (navDepth === 0) navPush();
        else navRewind(0, () => navPush());
        break;
      }
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
      case 'settings': openSettings(); break;
      case 'set-page': goSetPage(v); break;
      case 'set-back': backSetPage(); break;
      case 'key-new': case 'key-regen': {
        if (act === 'key-regen' && !confirm('重新生成密钥？旧密钥会立刻作废，用它的 agent 或工具要换成新的。')) return;
        V.key.busy = true; render();
        try { const d = await api('POST', '/api-key'); V.key = { data: d, fresh: d.key }; toast('已生成，只显示这一次'); }
        catch (e2) { V.key.busy = false; toast(e2.message); }
        render(); break;
      }
      case 'key-revoke': {
        if (!confirm('作废这个密钥？作废后，用它的 agent 或工具马上就读不到你的数据了。')) return;
        V.key.busy = true; render();
        try { V.key = { data: await api('DELETE', '/api-key') }; toast('已作废'); }
        catch (e2) { V.key.busy = false; toast(e2.message); }
        render(); break;
      }
      case 'key-copy': {
        if (!V.key || !V.key.data || !V.key.data.exists) return;
        const doc = keyDoc(V.key.fresh);
        try { await navigator.clipboard.writeText(doc); toast('已复制'); }
        catch (e2) { const r = document.createRange(); const el = $('#key-doc'); if (el) { r.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } toast('已选中，长按或 Ctrl+C 复制'); }
        break;
      }
      case 'deliver':
        S.settings.deliver = v; queue('PUT', '/settings', { deliver: v }); toCache(); render();
        toast(v === 'now' ? '之后寄出的信，马上就能看到回信' : '之后今晚寄出的信，回信明早 6:00 送到'); break;
      case 'ai-provider': {
        const A = V.ai || {};
        if (!A.data || A.busy) break;
        if (v === 'free') {
          if (A.data.configured) { /* 走下面的 ai-off 确认 */ document.querySelector('[data-act="ai-off"]').click(); break; }
          A.pick = 'free'; A.msg = ''; render(); break;
        }
        const pre = A.data.providers[v] || {};
        const form = Object.assign({}, A.form, { provider: v, key: (A.form && A.form.key) || '' });
        if (A.data.configured && A.data.provider === v) {
          form.base_url = A.data.base_url || pre.base || '';
          form.model = A.data.model || pre.model || '';
        } else if (v !== 'custom') {
          form.base_url = pre.base || '';
          form.model = pre.model || '';
        }
        A.pick = v; A.form = form; A.msg = ''; render(); break;
      }
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
            V.ai.data = d; V.ai.form.key = ''; V.ai.pick = d.provider; V.ai.ok = true; V.ai.msg = '';
            toast('已保存，之后的回信用你自己的 AI 写');
          }
        } catch (e2) { V.ai.ok = false; V.ai.msg = e2.message; }
        V.ai.busy = null; render(); break;
      }
      case 'ai-off': {
        if (!confirm('停用自己的 AI，改回免费模型？保存的 Key 会被删除。')) return;
        try {
          V.ai.data = await api('DELETE', '/ai-config');
          V.ai.pick = 'free';
          V.ai.form = { provider: 'deepseek', base_url: '', model: '', key: '' };
          toast('已改回免费模型');
        } catch (e2) { toast(e2.message); }
        render(); break;
      }
      case 'burn-ask':
        V.burn = { date: v, items: false, phase: 'confirm' };
        render();
        navPush();
        break;
      case 'burn-keep':
        if (V.burn && V.burn.phase === 'fire') return;
        if (navBack()) break;
        V.burn = null; render(); break;
      case 'burn-items': {
        if (!V.burn) return;
        const box = el.matches('input[type="checkbox"]') ? el : el.querySelector('input');
        V.burn.items = !!(box && box.checked);
        break;
      }
      case 'close': closeSheet(); break;
      case 'theme':
        S.settings.theme = v; applyTheme(); queue('PUT', '/settings', { theme: v }); toCache(); render(); break;
      case 'save-q': {
        const qs = $('#set-q').value.split('\n').map(s => s.trim()).filter(Boolean);
        if (!qs.length) return toast('至少留一个问题');
        S.settings.questions = qs; queue('PUT', '/settings', { questions: qs }); toCache(); toast('已保存。下一封信的提示会换成这些。'); break;
      }
      case 'habit-del':
        if (!confirm('删除这个习惯？以后的打卡里不再出现。以前的记录还留着。')) return;
        queue('PUT', '/habits/' + v, { archived: true });
        S.habits = S.habits.filter(h => h.id !== v); toCache(); render(); break;
      case 'logout':
        try { await api('POST', '/logout'); } catch (err) { /* ignore */ }
        store.del('hx_outbox'); store.del('hx_opened2'); outbox = []; opened = new Set();
        dropSettingsHistory();
        resetOverlays();
        showLogin();
        navRewind(0);
        break;
    }
  });

  boot();
})();
