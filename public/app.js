/* 回信 · 前端
 * 原则：你只写信，其余交给回信。
 * 数据：云端是正本；本机缓存一份，打开秒开、没网也能写，联网后自动补寄。
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
  const weekKey = s => addDays(s, -((new Date(s + 'T00:00:00').getDay() + 6) % 7));
  const quarterKey = s => s.slice(0, 4) + '-Q' + (Math.floor((Number(s.slice(5, 7)) - 1) / 3) + 1);
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 存不下就算了 */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  const ICON = {
    check: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--on-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.3 5.8 10 11 4.2"/></svg>',
    checkSm: '<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="var(--on-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.3 5.8 10 11 4.2"/></svg>',
    today: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.2M12 19v2.2M2.8 12h2.2M19 12h2.2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5 7 17M17 7l1.5-1.5"/></svg>',
    write: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.5 4.5 19.5 8.5 9 19H5v-4z"/><path d="M13 7l4 4"/></svg>',
    box: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m3.8 7 8.2 6 8.2-6"/></svg>',
    gear: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    left: '<svg width="11" height="18" viewBox="0 0 11 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 1 2 9l7 8"/></svg>',
    right: '<svg width="11" height="18" viewBox="0 0 11 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 1 7 8-7 8"/></svg>',
    chev: '<svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="var(--ring)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m1 1 6 6-6 6"/></svg>',
    plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  };

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ───────────── 状态 ─────────────
  let S = null;                 // 当前用户的所有数据
  const V = {                   // 界面状态
    tab: 'today', writeDate: null, editing: false, replying: false, replyErr: '',
    mb: 'all', sheets: [], quoteOffset: 0, olderLoaded: false, online: navigator.onLine,
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
    if (res.status === 401 && path !== '/login') { showLogin(); throw new Error('请先登录'); }
    if (!res.ok) throw new Error(data.error || ('请求失败 ' + res.status));
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
    { id: 'auto', name: '跟随系统', sw: ['#FFFFFF', '#000000', '#2B4C9B'] },
    { id: 'ink', name: '墨水', sw: ['#FFFFFF', '#1D1D1F', '#2B4C9B'] },
    { id: 'night', name: '夜信', sw: ['#000000', '#F5F5F7', '#8FA8EC'] },
    { id: 'paper', name: '信笺', sw: ['#F6F1E7', '#2B2622', '#A8392C'] },
    { id: 'mono', name: '素笺', sw: ['#FFFFFF', '#000000', '#000000'] },
  ];
  const darkMQ = matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    let t = (S && S.settings.theme) || 'auto';
    if (t === 'auto') t = darkMQ.matches ? 'night' : 'ink';
    document.documentElement.setAttribute('data-theme', t);
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    $('#meta-theme').setAttribute('content', bg || '#FFFFFF');
  }
  darkMQ.addEventListener && darkMQ.addEventListener('change', applyTheme);

  // ───────────── 启动 ─────────────
  function today() { return localDate(); }
  // 凌晨 4 点前写的，算前一天的信
  function letterDay() { const h = new Date().getHours(); return h < 4 ? addDays(today(), -1) : today(); }
  function hasText(d) { const l = S.letters[d]; return !!(l && l.text && l.text.trim()); }

  function pickStartTab() {
    const h = new Date().getHours();
    const yday = addDays(today(), -1);
    if (h >= 19 || h < 4) { V.tab = 'write'; V.writeDate = letterDay(); return; }
    if (h < 12 && !hasText(yday) && S.stats.letters > 0) { V.tab = 'write'; V.writeDate = yday; return; }
    V.tab = 'today';
    V.writeDate = letterDay();
  }

  let lastRefresh = 0;
  async function refresh() {
    const b = await api('GET', '/bootstrap');
    const pendingLetters = outbox.filter(o => o.path.startsWith('/letters/')).map(o => o.path.split('/')[2]);
    const keep = {};
    pendingLetters.forEach(d => { if (S && S.letters[d]) keep[d] = S.letters[d]; });   // 本机还没寄出的信，不被云端旧版盖掉
    S = fromBoot(b);
    Object.assign(S.letters, keep);
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

  // ───────────── 登录 ─────────────
  function showLogin(msg) {
    S = null;
    store.del('hx_cache');
    V.sheets = [];
    applyThemeFallback();
    $('#app').innerHTML = `
      <form class="login" id="login-form" autocomplete="on">
        <div class="logo">Re:</div>
        <h1>回信</h1>
        <p>每晚写一封信，回信替未来的你整理好一切。</p>
        <input class="input" name="username" autocomplete="username" placeholder="账号" aria-label="账号" required>
        <input class="input" style="margin-top:10px" name="password" type="password" autocomplete="current-password" placeholder="密码" aria-label="密码" required>
        <button class="btn full" type="submit">登录</button>
        <div class="msg" id="login-msg">${esc(msg || '')}</div>
      </form>`;
    $('#login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const btn = f.querySelector('button');
      btn.disabled = true; btn.textContent = '登录中…';
      try {
        await api('POST', '/login', { username: f.username.value.trim(), password: f.password.value });
        await refresh();
        pickStartTab();
        render();
      } catch (err) {
        $('#login-msg').textContent = err.message;
        btn.disabled = false; btn.textContent = '登录';
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
    const html = V.tab === 'today' ? viewToday() : V.tab === 'write' ? viewWrite() : viewMailbox();
    $('#app').innerHTML = html + tabbar() + V.sheets.map(viewSheet).join('');
    if (V._lastTab !== V.tab) window.scrollTo(0, 0); else window.scrollTo(0, keepScroll);
    V._lastTab = V.tab;
    afterRender();
  }

  function tabbar() {
    const b = (id, label, icon) => `<button data-act="tab" data-v="${id}" ${V.tab === id ? 'aria-current="page"' : ''}>${icon}${label}</button>`;
    return `<div class="tabbar"><div class="brand" aria-hidden="true"><b>Re:</b><span>回信</span></div><nav aria-label="主导航">${b('today', '今天', ICON.today)}${b('write', '写信', ICON.write)}${b('mailbox', '信箱', ICON.box)}</nav>
      <button class="side-set" data-act="settings">${ICON.gear}<span>设置</span></button></div>`;
  }

  const offlineLine = () => `<div class="offline" data-offline ${V.online ? 'hidden' : ''}>离线中 · 改动会在联网后自动同步</div>`;

  // ───────────── 今天 ─────────────
  function viewToday() {
    const t = today();
    const yday = addDays(t, -1);
    const h = new Date().getHours();
    let banner = '';
    if (h >= 4 && h < 12 && !hasText(yday) && S.stats.letters > 0) {
      banner = `<button class="banner" data-act="write-day" data-v="${yday}"><span>昨天的信还没写，现在补上？</span>${ICON.right}</button>`;
    } else if ((h >= 19 || h < 4) && !hasText(letterDay())) {
      banner = `<button class="banner" data-act="write-day" data-v="${letterDay()}"><span>今晚的信，写几句？</span>${ICON.right}</button>`;
    }
    return `<main class="page">
      <div class="head">
        <div class="head-l"><span class="eyebrow">${cn(t)} 星期${wd(t)}</span><h1>今天</h1></div>
        <span class="mark" aria-hidden="true">Re:</span>
      </div>
      ${offlineLine()}
      <div class="cols">
        <div class="col">
          ${quoteBlock(t)}
          ${banner}
          ${reminders(t)}
          ${habitsBlock(t)}
        </div>
        <div class="col">
          ${pendingBlock(t)}
          ${energyBlock(t, 14)}
        </div>
      </div>
    </main>`;
  }

  // 每日一句：大多数日子是诗，偶尔（约三天一次）换成「很久以前的你写过的一句话」
  function quoteBlock(t) {
    const own = ownQuote(t);
    if (own && V.quoteOffset === 0) {
      return `<button class="quote" data-act="quote">
        <span class="quote-label">${own.ago} 天前的你写道</span>
        <p class="quote-t">${esc(own.text)}</p>
        <span class="quote-s">${cn(own.date)} 的信</span></button>`;
    }
    const p = poem(t);
    if (!p) return '';
    const lines = String(p.t).replace(/([，。；！？])(?!$)/g, '$1\n').split('\n');
    return `<button class="quote" data-act="quote"><p class="quote-t">${lines.map(esc).join('<br>')}</p><span class="quote-s">${esc(p.s)}</span></button>`;
  }
  function ownQuote(t) {
    if (hash(t + '|own') % 3 !== 0) return null;
    const old = Object.values(S.letters).filter(l => l.text && diffDays(t, l.date) >= 30);
    if (!old.length) return null;
    const l = old[hash(t) % old.length];
    const sents = l.text.split(/[。！？!?\n]/).map(s => s.trim()).filter(s => s.length >= 8 && s.length <= 60);
    if (!sents.length) return null;
    return { date: l.date, ago: diffDays(t, l.date), text: sents[hash(t + l.date) % sents.length] + '。' };
  }
  function poem(t) {
    if (!window.POEMS) return null;
    const y = S.letters[addDays(t, -1)];
    const mood = y && y.mood && window.POEMS[y.mood] ? y.mood : null;
    let list;
    if (mood) list = window.POEMS[mood].list;
    else {
      const m = Number(t.slice(5, 7));
      const season = m >= 3 && m <= 5 ? '春' : m >= 6 && m <= 8 ? '夏' : m >= 9 && m <= 11 ? '秋' : '冬';
      list = (window.SEASON_POEMS[season] || {}).list || window.POEMS['平静'].list;
    }
    return list[(hash(t + '|' + (mood || '')) + V.quoteOffset) % list.length];
  }

  function dueInfo(td, t) {
    if (!td.due) return null;
    const n = diffDays(td.due, t);
    if (n < 0) return { cls: 'late', label: `过期 ${-n} 天`, rank: 0 };
    if (n === 0) return { cls: 'hot', label: '今天', rank: 1 };
    if (n === 1) return { cls: '', label: '明天', rank: 2 };
    return { cls: '', label: cn(td.due), rank: 3 };
  }
  function openTodos(t) {
    return S.todos.filter(x => !x.done && !x.archived).sort((a, b) => {
      const da = dueInfo(a, t), db = dueInfo(b, t);
      const ra = da ? da.rank : 4, rb = db ? db.rank : 4;
      if (ra !== rb) return ra - rb;
      return (a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : (a.created < b.created ? 1 : -1);
    });
  }
  function staleIdeas(t) {
    return S.ideas.filter(i => i.status === 'open' && diffDays(t, i.created) >= 7);
  }

  function reminders(t) {
    const items = [];
    openTodos(t).forEach(x => {
      const d = dueInfo(x, t);
      if (d && d.rank === 0 && items.length < 2) items.push(`「${esc(x.text)}」已经过期 ${-diffDays(x.due, t)} 天`);
      else if (d && d.rank === 1 && items.length < 2) items.push(`「${esc(x.text)}」今天到期`);
    });
    const st = staleIdeas(t);
    if (st.length) {
      const i = st[hash(t) % st.length];
      items.push(`${diffDays(t, i.created)} 天前的点子「${esc(i.text)}」还没动`);
    }
    if (!items.length) return '';
    const y = S.letters[addDays(t, -1)];
    const who = y && y.reply && !y.reply.imported ? '昨晚的回信提醒你' : '回信提醒你';
    return `<div class="re-card"><div class="re-card-h"><b>Re:</b><span>${who}</span></div>
      ${items.map(s => `<div class="re-item"><span>${s}</span></div>`).join('')}</div>`;
  }

  function habitsBlock(t) {
    if (!S.habits.length) {
      return `<div class="sec-h"><h2>习惯</h2></div><div class="empty">还没有要打卡的习惯。<button class="link-btn" data-act="settings">去添加 ›</button></div>`;
    }
    const wk = weekKey(t);
    const days = diffDays(t, wk) + 1;
    let done = 0;
    S.habits.forEach(h => { for (let i = 0; i < days; i++) if (S.logs.has(h.id + '|' + addDays(wk, i))) done++; });
    const rows = S.habits.map(h => {
      const dots = [6, 5, 4, 3, 2, 1].map(n => `<i class="${S.logs.has(h.id + '|' + addDays(t, -n)) ? 'on' : ''}"></i>`).join('');
      const on = S.logs.has(h.id + '|' + t);
      return `<div class="habit"><div class="habit-l"><span class="habit-name">${esc(h.name)}</span><div class="dots" aria-hidden="true">${dots}</div></div>
        <button class="hchk ${on ? 'on' : ''}" data-act="habit" data-v="${h.id}" aria-pressed="${on}" aria-label="${esc(h.name)} 今天${on ? '已完成' : '未完成'}"><i>${ICON.check}</i></button></div>`;
    }).join('');
    return `<div class="sec-h"><h2>习惯</h2><span class="sec-meta">本周 ${done} / ${S.habits.length * days}</span></div><div class="rows">${rows}</div>`;
  }

  function todoRow(x, t, opts = {}) {
    const d = dueInfo(x, t);
    const meta = x.done ? (x.done_at ? cn(x.done_at) + ' 完成' : '') : d ? d.label : '';
    return `<div class="row">
      <button class="chk ${x.done ? 'on' : ''}" data-act="todo-toggle" data-v="${x.id}" aria-pressed="${x.done}" aria-label="${x.done ? '标为未完成' : '完成'}：${esc(x.text)}"><i>${ICON.checkSm}</i></button>
      <button class="row-text ${x.done ? 'done' : ''}" data-act="todo-edit" data-v="${x.id}">${esc(x.text)}</button>
      ${meta ? `<span class="row-meta ${x.done ? '' : d ? d.cls : ''}">${meta}</span>` : ''}
    </div>`;
  }
  function ideaRow(i, opts = {}) {
    return `<div class="row">
      <span class="tag">点子</span>
      <button class="row-text" data-act="idea-edit" data-v="${i.id}">${esc(i.text)}</button>
      <button class="link-btn" data-act="idea-todo" data-v="${i.id}">转待办</button>
      ${opts.drop ? `<button class="link-btn" style="color:var(--sub)" data-act="idea-drop" data-v="${i.id}">放下</button>` : ''}
    </div>`;
  }

  function pendingBlock(t) {
    const todos = openTodos(t);
    const ideas = S.ideas.filter(i => i.status === 'open');
    const showT = todos.slice(0, 5);
    const st = staleIdeas(t);
    const showI = (st.length ? st : ideas).slice(0, 2);
    const recentDone = S.todos.filter(x => x.done && x.done_at === t);
    const body = (showT.length || showI.length || recentDone.length)
      ? showT.map(x => todoRow(x, t)).join('') + recentDone.map(x => todoRow(x, t)).join('') + showI.map(i => ideaRow(i)).join('')
      : `<div class="empty">没有待处理的事。写信时提到要做的事、冒出的点子，回信会自动放到这里。</div>`;
    const more = todos.length - showT.length + ideas.length - showI.length;
    return `<div class="sec-h"><h2>待处理</h2><span class="sec-meta">待办 ${todos.length} · 点子 ${ideas.length}</span></div>
      <div class="rows">${body}</div>
      <div style="display:flex;justify-content:space-between">
        <button class="link-btn" data-act="todo-new">${'＋ 加一件事'}</button>
        <button class="link-btn" data-act="lists" data-v="todos">${more > 0 ? `还有 ${more} 项 ›` : '全部 ›'}</button>
      </div>`;
  }

  function energySeries(t, n) {
    const pts = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = addDays(t, -i);
      const l = S.letters[d];
      pts.push({ d, v: l && l.energy ? l.energy : null });
    }
    return pts;
  }
  function chartSvg(pts, label) {
    const W = 350, H = 96, n = pts.length;
    const x = i => (n === 1 ? W / 2 : (i * (W - 4)) / (n - 1) + 2);
    const y = v => 86 - (v - 1) * 18.5;
    let segs = [], cur = [];
    pts.forEach((p, i) => {
      if (p.v == null) { if (cur.length) segs.push(cur); cur = []; return; }
      cur.push(`${x(i).toFixed(1)},${y(p.v).toFixed(1)}`);
    });
    if (cur.length) segs.push(cur);
    const lines = segs.map(s => s.length > 1
      ? `<polyline points="${s.join(' ')}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
      : `<circle cx="${s[0].split(',')[0]}" cy="${s[0].split(',')[1]}" r="2.5" fill="var(--ink)"/>`).join('');
    let lastI = -1;
    pts.forEach((p, i) => { if (p.v != null) lastI = i; });
    const last = lastI >= 0 ? `<circle cx="${x(lastI).toFixed(1)}" cy="${y(pts[lastI].v).toFixed(1)}" r="4.5" fill="var(--bg)" stroke="var(--ink)" stroke-width="2"/>` : '';
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
      <line x1="0" y1="${y(1) + 2}" x2="${W}" y2="${y(1) + 2}" stroke="var(--sep)" stroke-width="1"/>
      <line x1="0" y1="${y(3)}" x2="${W}" y2="${y(3)}" stroke="var(--sep)" stroke-width="1" stroke-dasharray="2 4"/>
      ${lines}${last}</svg>`;
  }
  function energyBlock(t, n) {
    const pts = energySeries(t, n);
    const vals = pts.filter(p => p.v != null);
    const head = `<div class="sec-h"><h2>状态</h2><span class="sec-meta">近 ${n} 天 · 精力</span></div>`;
    if (vals.length < 3) return head + `<div class="empty">写几天信之后，回信会给每天的精力打分，这里会出现你的精力曲线。</div>`;
    const avg = a => a.reduce((s, p) => s + p.v, 0) / a.length;
    const half = Math.floor(n / 2);
    const a1 = pts.slice(0, half).filter(p => p.v != null), a2 = pts.slice(half).filter(p => p.v != null);
    let note = `平均 ${avg(vals).toFixed(1)} 分（满分 5）`;
    if (a1.length >= 2 && a2.length >= 2) {
      const d = avg(a2) - avg(a1);
      note += Math.abs(d) < 0.3 ? '，前后两周差不多。' : d > 0 ? `，最近一周比之前高 ${d.toFixed(1)}。` : `，最近一周比之前低 ${(-d).toFixed(1)}。`;
    }
    const moods = {};
    pts.forEach(p => { const l = S.letters[p.d]; if (l && l.mood) moods[l.mood] = (moods[l.mood] || 0) + 1; });
    const top = Object.entries(moods).sort((a, b) => b[1] - a[1])[0];
    if (top) note += ` 出现最多的情绪是「${top[0]}」。`;
    return head + chartSvg(pts, `近 ${n} 天精力曲线，${note}`) +
      `<div class="chart-x"><span>${cn(pts[0].d)}</span><span>今天</span></div><p class="note">${esc(note)}</p>`;
  }

  // ───────────── 写信 ─────────────
  function viewWrite() {
    const d = V.writeDate || letterDay();
    const t = today();
    const l = S.letters[d] || { date: d, text: '' };
    const draft = store.get('hx_draft_' + d, null);
    const text = draft != null ? draft : (l.text || '');
    const showEditor = V.editing || !l.text || !l.text.trim() || (!l.reply && !V.replying && !V.replyErr && draft != null && draft !== l.text);
    const isToday = d === letterDay();
    const label = isToday ? (new Date().getHours() >= 17 || new Date().getHours() < 4 ? '今晚' : '今天') : (d === addDays(t, -1) ? '补写昨天' : '补写');
    const canNext = d < letterDay();

    let body;
    if (showEditor) {
      body = `<textarea class="editor" id="editor" placeholder="今天过得怎么样？做了什么、想到什么、哪里卡住了，随便写。&#10;&#10;写完点「寄出」，回信会帮你整理好其余的一切。" aria-label="信的内容">${esc(text)}</textarea>
        <div class="send-bar"><div>
          <span class="save-state" id="save-state">${text ? '已存为草稿' : ''}</span>
          ${V.editing && l.reply ? `<button class="btn ghost" data-act="cancel-edit">取消</button>` : ''}
          <button class="btn" data-act="send" id="send-btn" ${text.trim() ? '' : 'disabled'}>${l.reply ? '重新寄出' : '寄出'}</button>
        </div></div>`;
    } else {
      body = `<div class="write-grid"><div class="letter-col"><p class="letter-text">${esc(l.text)}</p>
        <div style="margin-top:10px"><button class="link-btn" data-act="edit-letter">修改这封信</button></div></div>
        <div class="reply-col">${replySection(l)}</div></div>`;
    }
    return `<main class="page">
      <div class="head">
        <div class="head-l"><span class="eyebrow">${cn(d)} 星期${wd(d)} · ${label}</span><h1>写信</h1></div>
        <div class="daynav">
          <button class="icon-btn" data-act="day" data-v="-1" aria-label="前一天">${ICON.left}</button>
          <button class="icon-btn" data-act="day" data-v="1" aria-label="后一天" ${canNext ? '' : 'disabled'}>${ICON.right}</button>
        </div>
      </div>
      ${offlineLine()}
      ${body}
    </main>`;
  }

  function replySection(l, opts = {}) {
    if (V.replying && V.writeDate === l.date && !opts.readonly) {
      return `<div class="re-div"><span></span><b>Re:</b><span></span></div><div class="waiting"><i class="pulse"></i>正在给你回信…</div>`;
    }
    if (V.replyErr && V.writeDate === l.date && !opts.readonly) {
      return `<div class="re-div"><span></span><b>Re:</b><span></span></div>
        <div class="err-box"><span>信已经存好了，但回信暂时没写成：${esc(V.replyErr)}</span><button class="btn sm" data-act="retry-reply">再试一次</button></div>`;
    }
    const r = l.reply;
    if (!r) {
      return opts.readonly ? '' : `<div class="re-div"><span></span><b>Re:</b><span></span></div>
        <div class="err-box"><span>这封信还没有回信。</span><button class="btn sm" data-act="retry-reply">让回信回一封</button></div>`;
    }
    const when = l.replied_at ? new Date(l.replied_at) : null;
    const whenTxt = r.imported ? '从 Life OS 搬过来的旧信' : when ? `${pad(when.getHours())}:${pad(when.getMinutes())} 收到回信` : '';
    const fb = block => {
      const v = S.feedback[l.date + '|' + block] || 0;
      return `<div class="fb"><button class="${v > 0 ? 'on' : ''}" data-act="fb" data-v="${block}" data-d="${l.date}" data-x="1">有用</button><button class="${v < 0 ? 'on' : ''}" data-act="fb" data-v="${block}" data-d="${l.date}" data-x="-1">没用</button></div>`;
    };
    let html = `<div class="re-div"><span></span><b>Re:</b><span></span></div>${whenTxt ? `<p class="re-when">${whenTxt}</p>` : ''}<div class="reply">`;
    if (r.summary) html += `<p class="reply-sum">${esc(r.summary)}</p>`;
    if (r.energy) {
      html += `<div class="stats">
        <div class="stat"><span>精力</span><b>${r.energy}<small> / 5</small></b></div>
        <div class="stat"><span>情绪</span><b>${esc(r.mood || '—')}</b></div>
        <div class="stat"><span>高光</span><b>${esc(r.highlight || '—')}</b></div></div>`;
    }
    const tds = r.todos || [], ids = r.ideas || [];
    if (tds.length || ids.length) {
      html += `<div class="blk"><span class="blk-h">从信里拆出来的</span><div class="panel">
        ${tds.map(x => `<div class="panel-row"><span class="tag ink">待办</span><span>${esc(x.text)}</span><span class="small muted">已加入</span></div>`).join('')}
        ${ids.map(x => `<div class="panel-row"><span class="tag">点子</span><span>${esc(x.text)}</span><span class="small muted">已存入</span></div>`).join('')}
      </div></div>`;
    }
    const L = r.lenses || {};
    if (L.health || L.energy || L.career || L.relation) {
      const ln = [['health', '健康'], ['energy', '精力'], ['career', '事业'], ['relation', '关系']]
        .map(([k, n]) => `<b>${n}</b><span>${L[k] ? esc(L[k]) : '<span class="muted">信里没提到</span>'}</span>`).join('');
      html += `<div class="blk"><span class="blk-h">四个角度 <span class="tag line">实验</span></span><div class="lenses">${ln}</div>${fb('lenses')}</div>`;
    }
    const qs = r.questions && r.questions.length ? r.questions : (S.settings.questions || []);
    const ans = r.answers || [];
    if (ans.some(Boolean)) {
      const n = ans.filter(Boolean).length;
      html += `<details class="qa"><summary><span>${r.imported ? '当时回答的问题' : (qs.length + ' 个问题的回答')}<small>${r.imported ? `答了 ${n} 题` : `回信从信里找到了 ${n} 题的答案`}</small></span>${ICON.chev}</summary>
        <div class="qa-list">${qs.map((q, i) => `<div><div class="qa-q">${esc(q)}</div><div class="qa-a ${ans[i] ? '' : 'none'}">${ans[i] ? esc(ans[i]) : '信里没有线索'}</div></div>`).join('')}
        ${r.imported ? '' : fb('answers')}</div></details>`;
    }
    html += `</div>`;
    return html;
  }

  // ───────────── 信箱 ─────────────
  function viewMailbox() {
    const t = today();
    const filters = [['all', '全部'], ['week', '周信'], ['quarter', '季信'], ['year', '年信']];
    const seg = `<div class="seg" role="tablist" aria-label="信的类型">${filters.map(([k, n]) => `<button role="tab" aria-selected="${V.mb === k}" data-act="mb" data-v="${k}">${n}</button>`).join('')}</div>`;
    const first = S.stats.first;
    const days = first ? diffDays(t, first) + 1 : 0;
    const monthN = Object.values(S.letters).filter(l => l.text && l.date.slice(0, 7) === t.slice(0, 7)).length;
    // 手机上：分类 → 小卡片 → 曲线 → 时间线；电脑上：小卡片和曲线挪到右侧栏
    const side = `<div class="tiles">
        <button class="tile" data-act="lists" data-v="todos"><span>待办</span><b>${openTodos(t).length}</b></button>
        <button class="tile" data-act="lists" data-v="ideas"><span>点子</span><b>${S.ideas.filter(i => i.status === 'open').length}</b></button>
        <div class="tile"><span>本月的信</span><b>${monthN}</b></div></div>${energyBlock(t, 30)}`;
    const main = V.mb === 'all' ? timeline(t) : digestList(V.mb, t);
    const body = `<div class="mb-grid"><aside class="mb-side ${V.mb === 'all' ? '' : 'only-wide'}">${side}</aside><div class="mb-main">${main}</div></div>`;
    return `<main class="page">
      <div class="head">
        <div class="head-l"><span class="eyebrow">${days ? `已经往来 ${days} 天 · ${S.stats.letters} 封信` : '还没有信'}</span><h1>信箱</h1></div>
        <button class="icon-btn" data-act="settings" aria-label="设置">${ICON.gear}</button>
      </div>
      ${offlineLine()}
      ${seg}
      ${body}
    </main>`;
  }

  function dayRow(l) {
    const r = l.reply || {};
    const sum = r.summary || l.text;
    const meta = l.energy ? `<i class="${l.energy <= 2 ? 'low' : ''}"></i>精力 ${l.energy}${l.mood ? ' · ' + esc(l.mood) : ''}` : (r.imported ? '旧信' : '还没有回信');
    return `<button class="day" data-act="letter" data-v="${l.date}">
      <span class="day-d"><b>${Number(l.date.slice(8))}</b><span>周${wd(l.date)}</span></span>
      <span class="day-b"><span class="day-t">${esc(sum)}</span><span class="day-m">${meta}</span></span></button>`;
  }
  function digestCard(d) {
    const kindN = { week: '周信', quarter: '季信', year: '年信' }[d.kind];
    const lab = d.kind === 'week' ? `${cn(d.key)} 那一周 · 周信` : d.kind === 'quarter' ? `${d.key.replace('-', ' 年 ')} · 季信` : `${d.key} 年 · 年信`;
    return `<button class="digest" data-act="digest" data-v="${d.kind}|${d.key}">
      <span class="digest-h"><span>${lab}</span><small>${d.imported ? '旧版复盘' : kindN}</small></span>
      ${d.title && !d.imported ? `<span class="digest-t">${esc(d.title)}</span>` : ''}
      <span class="digest-b">${esc(d.letter || '')}</span>
      <span class="digest-go">读完整的${kindN} ›</span></button>`;
  }
  function timeline(t) {
    const letters = Object.values(S.letters).filter(l => l.text && l.text.trim()).sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!letters.length) return `<div class="empty" style="margin-top:30px">信箱还是空的。今晚写第一封信吧。<br><button class="link-btn" data-act="write-day" data-v="${letterDay()}">去写信 ›</button></div>`;
    const groups = [];
    letters.forEach(l => {
      const wk = weekKey(l.date);
      if (!groups.length || groups[groups.length - 1].wk !== wk) groups.push({ wk, items: [] });
      groups[groups.length - 1].items.push(l);
    });
    const thisWk = weekKey(t);
    let html = '';
    groups.forEach(g => {
      const name = g.wk === thisWk ? '本周' : g.wk === addDays(thisWk, -7) ? '上周' : `${cn(g.wk)} – ${cn(addDays(g.wk, 6))}`;
      html += `<h2 class="wk-h">${name}</h2>`;
      const dg = S.digests.find(d => d.kind === 'week' && d.key === g.wk);
      if (dg) html += digestCard(dg);
      else if (g.wk < thisWk) html += `<button class="link-btn" data-act="gen" data-v="week|${g.wk}">让回信写这一周的周信 ›</button>`;
      html += g.items.map(dayRow).join('');
    });
    html += V.olderLoaded === 'done' ? '' : `<div style="text-align:center;margin-top:20px"><button class="btn ghost sm" data-act="older">更早的信</button></div>`;
    return html;
  }
  function digestList(kind, t) {
    const list = S.digests.filter(d => d.kind === kind);
    const kindN = { week: '周信', quarter: '季信', year: '年信' }[kind];
    const when = { week: '每周一早上 7 点', quarter: '每季度第一天早上 7 点', year: '每年元旦早上 7 点' }[kind];
    const curKey = kind === 'week' ? weekKey(t) : kind === 'quarter' ? quarterKey(t) : t.slice(0, 4);
    const curName = { week: '本周', quarter: '这一季', year: '今年' }[kind];
    let html = `<p class="note" style="margin-top:18px">${kindN}会在${when}自动送达。也可以现在就让回信先写一封${curName}到目前为止的。</p>
      <button class="link-btn" data-act="gen" data-v="${kind}|${curKey}">现在写${curName}的${kindN} ›</button>`;
    html += list.length ? list.map(digestCard).join('') : `<div class="empty">还没有${kindN}。</div>`;
    return html;
  }

  // ───────────── 二级页面 ─────────────
  function openSheet(s) { V.sheets.push(s); render(); }
  function closeSheet() { V.sheets.pop(); render(); }
  function viewSheet(s) {
    const titles = { letter: '信', digest: '', lists: '待办与点子', settings: '设置', todo: s.id ? '编辑待办' : '加一件事', idea: '编辑点子' };
    return `<div class="sheet-dim" data-act="close" aria-hidden="true"></div><div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-bar"><div><button class="back" data-act="close">${ICON.left}<span style="margin-left:6px">返回</span></button><span class="t">${titles[s.type] || ''}</span></div></div>
      <div class="page">${sheetBody(s)}</div></div>`;
  }
  function sheetBody(s) {
    const t = today();
    if (s.type === 'letter') {
      const l = S.letters[s.date];
      if (!l) return '<div class="empty">找不到这封信。</div>';
      return `<div class="head"><div class="head-l"><span class="eyebrow">星期${wd(l.date)}</span><h1>${cn(l.date)}</h1></div></div>
        <p class="letter-text">${esc(l.text)}</p>
        <div style="margin-top:10px"><button class="link-btn" data-act="open-in-write" data-v="${l.date}">在写信里打开</button></div>
        ${replySection(l, { readonly: true })}`;
    }
    if (s.type === 'digest') {
      const d = S.digests.find(x => x.kind === s.kind && x.key === s.key);
      if (!d) return '<div class="empty">找不到这封信。</div>';
      const kindN = { week: '周信', quarter: '季信', year: '年信' }[d.kind];
      const range = d.range ? `${cn(d.range[0])} – ${cn(d.range[1])}` : (d.kind === 'week' ? `${cn(d.key)} – ${cn(addDays(d.key, 6))}` : d.key);
      let h = `<div class="head"><div class="head-l"><span class="eyebrow">${kindN} · ${range}</span><h1 style="font-size:28px">${esc(d.title || kindN)}</h1></div></div>`;
      if (d.stats) h += `<div class="stats" style="margin-top:20px">
        <div class="stat" style="background:var(--tile)"><span>写了</span><b>${d.stats.letters}<small> 封</small></b></div>
        <div class="stat" style="background:var(--tile)"><span>平均精力</span><b>${d.stats.energyAvg ?? '—'}</b></div>
        <div class="stat" style="background:var(--tile)"><span>完成待办</span><b>${d.stats.todosDone}</b></div></div>`;
      h += `<p class="letter-text" style="font-size:17px">${esc(d.letter || '')}</p>`;
      if (d.energy_note) h += `<div class="field"><span class="lab">精力的规律</span><div>${esc(d.energy_note)}</div></div>`;
      if (d.forgotten && d.forgotten.length) h += `<div class="field"><span class="lab">可能漏掉的</span>${d.forgotten.map(x => `<div class="re-item"><span>${esc(x)}</span></div>`).join('')}</div>`;
      if (d.next) h += `<div class="field"><span class="lab">${d.kind === 'week' ? '下周最值得做的一件事' : '接下来'}</span><div>${esc(d.next)}</div></div>`;
      const four = [['health', '健康'], ['energy', '精力'], ['career', '事业'], ['relation', '关系']];
      if (d.lenses && Object.values(d.lenses).some(Boolean)) h += `<div class="field"><span class="lab">四个角度</span><div class="lenses">${four.map(([k, n]) => `<b>${n}</b><span>${esc(d.lenses[k] || '—')}</span>`).join('')}</div></div>`;
      if (d.plans && Object.values(d.plans).some(Boolean)) h += `<div class="field"><span class="lab">下个季度的四条小规划</span><div class="lenses">${four.map(([k, n]) => `<b>${n}</b><span>${esc(d.plans[k] || '—')}</span>`).join('')}</div></div>`;
      if (d.themes && d.themes.length) h += `<div class="field"><span class="lab">这一年反复出现的主题</span><div>${d.themes.map(esc).join(' · ')}</div></div>`;
      if (!d.imported) h += `<div style="margin-top:30px"><button class="btn ghost sm" data-act="gen" data-v="${d.kind}|${d.key}">让回信重写这封${kindN}</button></div>`;
      return h;
    }
    if (s.type === 'lists') {
      const tab = s.tab || 'todos';
      const seg = `<div class="seg three" role="tablist">${[['todos', '待办'], ['ideas', '点子'], ['done', '已完成']].map(([k, n]) => `<button role="tab" aria-selected="${tab === k}" data-act="lists-tab" data-v="${k}">${n}</button>`).join('')}</div>`;
      let rows;
      if (tab === 'todos') {
        const l = openTodos(t);
        rows = l.length ? l.map(x => todoRow(x, t)).join('') : '<div class="empty">没有待办。</div>';
        rows += `<button class="link-btn" data-act="todo-new">＋ 加一件事</button>`;
      } else if (tab === 'ideas') {
        const l = S.ideas.filter(i => i.status === 'open');
        rows = l.length ? l.map(i => ideaRow(i, { drop: true })).join('') : '<div class="empty">点子库是空的。写信时冒出的想法，回信会收到这里。</div>';
        rows += `<button class="link-btn" data-act="idea-new">＋ 记一个点子</button>`;
      } else {
        const l = S.todos.filter(x => x.done).sort((a, b) => ((a.done_at || '') < (b.done_at || '') ? 1 : -1));
        rows = l.length ? l.map(x => todoRow(x, t)).join('') : '<div class="empty">最近 30 天还没有完成的待办。</div>';
      }
      return seg + `<div class="rows" style="margin-top:10px">${rows}</div>`;
    }
    if (s.type === 'todo') {
      const x = s.id ? S.todos.find(y => y.id === s.id) : { text: '', due: addDays(t, 3) };
      if (!x) return '';
      return `<form id="todo-form">
        <div class="field"><label for="tf-text">要做的事</label><textarea class="input" id="tf-text" rows="2" required>${esc(x.text)}</textarea></div>
        <div class="field"><label for="tf-due">截止日期</label><input class="input" id="tf-due" type="date" value="${esc(x.due || '')}"></div>
        ${x.source_date ? `<p class="note">来自 ${cn(x.source_date)} 的信</p>` : ''}
        <div style="display:flex;gap:10px;margin-top:26px"><button class="btn" type="submit">保存</button>
        ${s.id ? `<button class="btn ghost" type="button" data-act="todo-del" data-v="${x.id}">删除</button>` : ''}</div></form>`;
    }
    if (s.type === 'idea') {
      const x = s.id ? S.ideas.find(y => y.id === s.id) : { text: '' };
      if (!x) return '';
      return `<form id="idea-form">
        <div class="field"><label for="if-text">点子</label><textarea class="input" id="if-text" rows="3" required>${esc(x.text)}</textarea></div>
        ${x.source_date ? `<p class="note">来自 ${cn(x.source_date)} 的信</p>` : ''}
        <div style="display:flex;gap:10px;margin-top:26px"><button class="btn" type="submit">保存</button>
        ${s.id ? `<button class="btn ghost" type="button" data-act="idea-todo" data-v="${x.id}">转成待办</button><button class="btn ghost" type="button" data-act="idea-drop" data-v="${x.id}">放下</button>` : ''}</div></form>`;
    }
    if (s.type === 'settings') {
      const cur = S.settings.theme || 'auto';
      const themes = THEMES.map(th => `<button class="theme-opt" data-act="theme" data-v="${th.id}" aria-pressed="${cur === th.id}">
        <span class="swatch" style="background:${th.id === 'auto' ? 'linear-gradient(90deg,#fff 50%,#000 50%)' : th.sw[0]}"><i style="background:${th.sw[2]};width:60%"></i><i style="background:${th.id === 'auto' ? '#8E8E93' : th.sw[1]};width:85%;opacity:.5"></i></span>${th.name}</button>`).join('');
      const habits = S.habits.map(h => `<div class="row"><input class="input" style="background:none;padding:0;min-height:48px" value="${esc(h.name)}" data-habit-name="${h.id}" aria-label="习惯名称"><button class="link-btn" style="color:var(--danger)" data-act="habit-del" data-v="${h.id}">删除</button></div>`).join('');
      return `
        <div class="field"><label for="set-name">回信怎么称呼你</label><input class="input" id="set-name" value="${esc(S.user.name || '')}" placeholder="比如：非云"></div>
        <div class="field"><span class="lab">外观</span><div class="themes">${themes}</div></div>
        <div class="field"><span class="lab">要打卡的习惯</span><div class="group">${habits || '<div class="empty" style="padding:14px">还没有习惯</div>'}</div>
          <form id="habit-form" style="display:flex;gap:8px"><input class="input" id="habit-new" placeholder="新习惯，比如：运动 30 分钟" aria-label="新习惯"><button class="btn sm" style="height:48px" type="submit">添加</button></form></div>
        <div class="field"><label for="set-q">回信每天替你回答的问题（一行一个）</label><textarea class="input" id="set-q" rows="8">${esc((S.settings.questions || []).join('\n'))}</textarea>
          <button class="btn sm ghost" style="align-self:flex-start" data-act="save-q">保存问题</button></div>
        <div class="field"><span class="lab">搬家</span><p class="note" style="margin:0">在旧版 Life OS 的「设置 → 导出备份」得到一个 .json 文件，选它就能把以前的日记、待办、习惯、周复盘都搬过来。已有的不会被覆盖。</p>
          <label class="btn sm ghost" style="align-self:flex-start;display:inline-flex;align-items:center">选择备份文件<input type="file" id="import-file" accept=".json,application/json" hidden></label>
          <span class="note" id="import-msg" style="margin:0"></span></div>
        <div class="field"><span class="lab">账号</span><div class="muted small">当前登录：${esc(S.user.username)}</div>
          <button class="btn sm ghost" style="align-self:flex-start" data-act="logout">退出登录</button></div>
        <p class="note" style="margin-top:40px;text-align:center">回信 Re: · 你只写信，其余交给回信</p>`;
    }
    return '';
  }

  // ───────────── 渲染后的绑定（输入框、表单） ─────────────
  function afterRender() {
    const ed = $('#editor');
    if (ed) {
      const grow = () => { ed.style.height = 'auto'; ed.style.height = Math.max(ed.scrollHeight, window.innerHeight * 0.46) + 'px'; };
      grow();
      ed.addEventListener('input', () => {
        grow();
        const d = V.writeDate;
        store.set('hx_draft_' + d, ed.value);
        $('#send-btn').disabled = !ed.value.trim();
        $('#save-state').textContent = '正在保存…';
        clearTimeout(afterRender._t);
        afterRender._t = setTimeout(() => saveLetter(d, ed.value), 1200);
      });
      if (V.editing) { ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length); }
    }
    const tf = $('#todo-form');
    if (tf) tf.addEventListener('submit', e => {
      e.preventDefault();
      const s = V.sheets[V.sheets.length - 1];
      const text = $('#tf-text').value.trim(); const due = $('#tf-due').value || null;
      if (!text) return;
      if (s.id) {
        const x = S.todos.find(y => y.id === s.id); Object.assign(x, { text, due });
        queue('PUT', '/todos/' + x.id, { text, due });
      } else {
        const x = { id: uid('t'), text, due, done: false, created: today() };
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
    const imp = $('#import-file');
    if (imp) imp.addEventListener('change', async () => {
      const f = imp.files[0];
      if (!f) return;
      const msg = $('#import-msg');
      msg.textContent = '正在搬家…';
      try {
        const data = JSON.parse(await f.text());
        const r = await api('POST', '/import', data);
        const n = r.imported;
        await refresh();
        msg.textContent = `搬好了：${n.letters} 封信、${n.todos} 件待办、${n.habits} 个习惯（${n.habitLogs} 次打卡）、${n.weekly} 篇周复盘、${n.ideas} 个点子。`;
        toast('搬家完成');
      } catch (e) { msg.textContent = '没搬成：' + e.message; }
    });
  }

  // ───────────── 动作 ─────────────
  async function saveLetter(d, text) {
    const l = S.letters[d] || (S.letters[d] = { date: d, text: '', reply: null });
    l.text = text;
    toCache();
    queue('PUT', '/letters/' + d, { text });
    const st = $('#save-state');
    if (st) st.textContent = V.online ? '已保存' : '已存在本机，联网后同步';
  }

  async function send() {
    const d = V.writeDate;
    const ed = $('#editor');
    const text = ed ? ed.value : (S.letters[d] || {}).text;
    if (!text || !text.trim()) return;
    clearTimeout(afterRender._t);
    const l = S.letters[d] || (S.letters[d] = { date: d });
    l.text = text;
    store.del('hx_draft_' + d);
    V.editing = false; V.replying = true; V.replyErr = '';
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
      const r = await api('POST', `/letters/${d}/reply`, { today: today() });
      const l = S.letters[d];
      l.reply = r.reply; l.replied_at = r.replied_at; l.energy = r.reply.energy; l.mood = r.reply.mood;
      (r.todos || []).forEach(x => { if (!S.todos.find(y => y.id === x.id)) S.todos.push(x); });
      (r.ideas || []).forEach(x => { if (!S.ideas.find(y => y.id === x.id)) S.ideas.unshift(x); });
      if (!S.stats.first || d < S.stats.first) S.stats.first = d;
      S.stats.letters = Object.values(S.letters).filter(x => x.text && x.text.trim()).length;
      V.replying = false; toCache(); render();
      toast('收到回信');
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

  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]');
    if (!el || !S) return;
    const act = el.dataset.act, v = el.dataset.v;
    const t = today();
    switch (act) {
      case 'tab':
        if (V.tab === 'write' && v !== 'write') { V.editing = false; }
        V.tab = v; V.sheets = [];
        if (v === 'write' && !V.writeDate) V.writeDate = letterDay();
        render(); break;
      case 'write-day': V.tab = 'write'; V.writeDate = v; V.editing = !hasText(v); V.replyErr = ''; V.sheets = []; render(); break;
      case 'day': {
        const n = addDays(V.writeDate, Number(v));
        if (n > letterDay()) return;
        V.writeDate = n; V.editing = false; V.replyErr = ''; render(); break;
      }
      case 'quote': V.quoteOffset++; render(); break;
      case 'habit': {
        const k = v + '|' + t; const on = !S.logs.has(k);
        on ? S.logs.add(k) : S.logs.delete(k);
        queue('PUT', `/habits/${v}/log/${t}`, { done: on }); toCache(); render(); break;
      }
      case 'todo-toggle': {
        const x = S.todos.find(y => y.id === v); if (!x) return;
        x.done = !x.done; x.done_at = x.done ? t : null;
        queue('PUT', '/todos/' + v, { done: x.done, done_at: x.done_at }); toCache(); render(); break;
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
        queue('PUT', '/ideas/' + v, { status: 'dropped' });
        S.ideas = S.ideas.filter(y => y.id !== v);
        toCache(); if (V.sheets.length && V.sheets[V.sheets.length - 1].type === 'idea') V.sheets.pop(); render(); toast('已放下'); break;
      case 'lists': openSheet({ type: 'lists', tab: v }); break;
      case 'lists-tab': V.sheets[V.sheets.length - 1].tab = v; render(); break;
      case 'send': send(); break;
      case 'retry-reply': {
        const d = V.writeDate;
        if (outbox.some(o => o.key === 'PUT /letters/' + d)) { await flush(); }
        requestReply(d); break;
      }
      case 'edit-letter': V.editing = true; store.set('hx_draft_' + V.writeDate, S.letters[V.writeDate].text); render(); break;
      case 'cancel-edit': V.editing = false; store.del('hx_draft_' + V.writeDate); render(); break;
      case 'fb': {
        const key = el.dataset.d + '|' + v; const val = Number(el.dataset.x);
        const next = S.feedback[key] === val ? 0 : val;
        if (next) S.feedback[key] = next; else delete S.feedback[key];
        api('POST', '/feedback', { date: el.dataset.d, block: v, value: next }).catch(() => {});
        toCache(); render(); break;
      }
      case 'mb': V.mb = v; render(); break;
      case 'letter': openSheet({ type: 'letter', date: v }); break;
      case 'open-in-write': V.sheets = []; V.tab = 'write'; V.writeDate = v; V.editing = false; render(); break;
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
      case 'settings': openSheet({ type: 'settings' }); break;
      case 'close': closeSheet(); break;
      case 'theme':
        S.settings.theme = v; applyTheme(); queue('PUT', '/settings', { theme: v }); toCache(); render(); break;
      case 'save-q': {
        const qs = $('#set-q').value.split('\n').map(s => s.trim()).filter(Boolean);
        if (!qs.length) return toast('至少留一个问题');
        S.settings.questions = qs; queue('PUT', '/settings', { questions: qs }); toCache(); toast('已保存，明天的回信开始生效'); break;
      }
      case 'habit-del':
        if (!confirm('删除这个习惯？以前的打卡记录会一起隐藏。')) return;
        queue('PUT', '/habits/' + v, { archived: true });
        S.habits = S.habits.filter(h => h.id !== v); toCache(); render(); break;
      case 'logout':
        try { await api('POST', '/logout'); } catch (err) { /* ignore */ }
        store.del('hx_outbox'); outbox = [];
        showLogin(); break;
    }
  });

  boot();
})();
