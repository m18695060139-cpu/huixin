// 把本机数据收成各页要用的结构。不读 wx，方便用 node 核对「明早拆信」。

const date = require('./date');
const { INK, SEP, CARD } = require('./theme');

function letterOf(S, d) {
  return (S.letters && S.letters[d]) || null;
}

function hasText(S, d) {
  const l = letterOf(S, d);
  return !!(l && l.text && String(l.text).trim());
}

function hasSent(S, d) {
  const l = letterOf(S, d);
  return !!(hasText(S, d) && l.sent_at);
}

function deliverNow(S) {
  return !!(S.settings && S.settings.deliver === 'now');
}

function isSealed(S, d, now) {
  if (deliverNow(S)) return false;
  const l = letterOf(S, d);
  if (!l || !l.sent_at || l.opened) return false;
  now = now || new Date();
  if (now >= date.deliverAt(d)) return false;
  const sentAt = new Date(l.sent_at);
  if (isNaN(sentAt.getTime())) return false;
  return sentAt < date.cutoff(d);
}

function totalLetters(S) {
  return Object.keys(S.letters || {}).filter(d => hasText(S, d)).length;
}

function letterNo(S, d) {
  const after = Object.keys(S.letters || {}).filter(x => x > d && hasText(S, x)).length;
  return Math.max(1, totalLetters(S) - after + (hasText(S, d) ? 0 : 1));
}

function unopenedLetter(S, t, now) {
  const hit = Object.keys(S.letters || {}).filter(d => {
    const l = S.letters[d];
    return hasSent(S, d) && l.reply && !l.reply.imported && !isSealed(S, d, now) && !l.opened && d >= date.addDays(t, -3);
  }).sort();
  return hit.length ? S.letters[hit[hit.length - 1]] : null;
}

function activeHabits(S) {
  return (S.habits || []).filter(h => !h.archived).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0) || String(a.created || '').localeCompare(String(b.created || '')));
}

function habitItems(S, day) {
  return activeHabits(S).map(h => ({
    id: h.id,
    name: h.name,
    on: !!(S.logs && S.logs[h.id + '|' + day]),
  }));
}

function dueInfo(td, t) {
  if (!td.due) return null;
  const n = date.diffDays(td.due, t);
  if (n < 0) return { cls: 'red', label: '过期 ' + (-n) + ' 天', rank: 0 };
  if (n === 0) return { cls: 'red', label: '今天', rank: 1 };
  if (n === 1) return { cls: 'amber', label: '明天到期', rank: 2 };
  return { cls: '', label: n < 7 ? '周' + date.wd(td.due) : date.cn(td.due), rank: 3 };
}

function sourceHidden(S, x, now, unopenedDate) {
  if (!x || !x.source_date) return false;
  now = now || new Date();
  if (isSealed(S, x.source_date, now)) return true;
  if (unopenedDate === undefined) {
    const u = unopenedLetter(S, date.today(now), now);
    unopenedDate = u ? u.date : '';
  }
  return unopenedDate === x.source_date;
}

function openTodos(S, t, now) {
  now = now || new Date();
  const u = unopenedLetter(S, date.today(now), now);
  const ud = u ? u.date : '';
  return (S.todos || []).filter(x => !x.done && !x.archived && !x.dropped_at && !sourceHidden(S, x, now, ud)).sort((a, b) => {
    const da = dueInfo(a, t);
    const db = dueInfo(b, t);
    const ra = da ? da.rank : 4;
    const rb = db ? db.rank : 4;
    if (ra !== rb) return ra - rb;
    const ad = a.due || '9999';
    const bd = b.due || '9999';
    if (ad < bd) return -1;
    if (ad > bd) return 1;
    return String(a.created || '') < String(b.created || '') ? 1 : -1;
  });
}

function openIdeas(S, now) {
  now = now || new Date();
  const u = unopenedLetter(S, date.today(now), now);
  const ud = u ? u.date : '';
  return (S.ideas || []).filter(i => i.status === 'open' && !sourceHidden(S, i, now, ud));
}

function srcLine(S, x, t) {
  if (!x.source_date) return { text: '自己加的', cls: '' };
  if (x.source_date === date.addDays(t, -1)) return { text: '昨晚的信 · No.' + letterNo(S, x.source_date), cls: 'hot' };
  if (x.source_date === t) return { text: '今天的信', cls: 'hot' };
  return { text: date.cn(x.source_date) + '的信', cls: '' };
}

function todoView(S, x, t) {
  const d = dueInfo(x, t);
  const s = srcLine(S, x, t);
  let pill = '';
  let pillCls = '';
  if (x.dropped_at) {
    pill = date.cn(x.dropped_at) + ' 放下';
  } else if (x.done) {
    pill = x.done_at ? date.cn(x.done_at) + ' 完成' : '完成';
    pillCls = 'green';
  } else if (d) {
    pill = d.label;
    pillCls = d.cls;
  }
  return {
    id: x.id,
    text: x.text || '',
    note: x.note || '',
    sub: s.text,
    subCls: (x.done || x.dropped_at) ? '' : s.cls,
    pill: pill,
    pillCls: pillCls,
    done: !!x.done,
    dropped: !!x.dropped_at,
    due: x.due || '',
    source: x.source_date ? ('来自 ' + date.cn(x.source_date) + ' 的信') : '',
  };
}

function ideaView(i, t) {
  const age = date.diffDays(t, i.created || t);
  const stale = age >= 7;
  const sub = stale ? ('点子 · ' + age + ' 天没动了') : ('点子 · ' + (i.source_date ? date.cn(i.source_date) + '的信' : '自己记的'));
  return {
    id: i.id,
    text: i.text || '',
    sub: sub,
    subCls: stale ? 'warm' : '',
    source: i.source_date ? ('来自 ' + date.cn(i.source_date) + ' 的信') : '',
    dropped: i.status === 'dropped',
    droppedLabel: i.dropped_at ? date.cn(String(i.dropped_at).slice(0, 10)) + ' 放下' : '放下了',
  };
}

function firstLine(text) {
  const lines = String(text || '').split('\n').map(s => s.trim()).filter(Boolean);
  return lines.find(s => !/^[^，。,]{1,12}[，,：:]$/.test(s)) || lines[0] || '';
}

function heroBlock(S, now) {
  const t = date.today(now);
  const h = now.getHours();
  const night = h >= 17 || h < 4;
  const ld = date.letterDay(now);
  const yday = date.addDays(t, -1);
  const u = unopenedLetter(S, t, now);
  if (u) {
    return {
      type: 'envelope',
      date: u.date,
      title: (u.date === yday || u.date === t) ? '昨晚的你来信了' : date.cn(u.date) + '的回信到了',
      sub: 'No.' + letterNo(S, u.date) + ((u.reply && u.reply.todos && u.reply.todos.length) ? (' · ' + u.reply.todos.length + ' 件待办') : '') + ((u.reply && u.reply.ideas && u.reply.ideas.length) ? (' · ' + u.reply.ideas.length + ' 个点子') : ''),
    };
  }
  if (hasSent(S, ld) && isSealed(S, ld, now)) {
    return {
      type: 'sealed',
      date: ld,
      title: ld === date.letterDay(now) ? '今晚的信已寄出' : date.cn(ld) + '的信已寄出',
      sub: '回信明早 6:00 送到',
    };
  }
  const skip = S.skip || {};
  if (!night && h < 12 && !hasText(S, ld) && !hasText(S, yday) && totalLetters(S) > 0 && !skip[yday]) {
    return {
      type: 'backfill',
      date: yday,
      title: '昨晚没有写信',
      dateLabel: date.cn(yday),
      sub: '现在补上也来得及。补写的信寄出后，回信马上送到，拆出来的事直接放进今天。',
    };
  }
  if (!hasText(S, ld) && night) return writeHero(S, ld, '今晚');
  const last = [ld, yday].filter(d => hasSent(S, d) && S.letters[d].opened && !isSealed(S, d, now))[0];
  if (last) {
    const l = S.letters[last];
    const line = (l.reply && l.reply.summary)
      ? (String(l.reply.summary).split(/[。！？\n]/).map(s => s.trim()).filter(Boolean).pop() || '')
      : firstLine(l.text);
    const who = last === yday ? '昨晚的回信' : last === t ? '今天的回信' : date.cn(last) + '的回信';
    return {
      type: 'read',
      date: last,
      title: who + ' · 已拆开',
      sub: line ? ('“' + line + '”') : ('No.' + letterNo(S, last)),
    };
  }
  if (hasText(S, ld)) return { type: 'none' };
  return writeHero(S, ld, h < 17 ? '今天' : '今晚');
}

function writeHero(S, d, label) {
  const habits = activeHabits(S);
  return {
    type: 'write',
    date: d,
    label: label,
    title: label + '的信还没写',
    sub: (habits.length ? '写信时顺手打卡 · ' : '') + (deliverNow(S) ? '寄出后马上回信' : '回信明早 6:00 送到'),
  };
}

// 旧信里翻出来的一句话（30 天以前写的）。点一下换一封信里的句子。
// 没有满 30 天的信，或那封信里没有 8–60 字的句子时，整张卡片不出现。
function memoryBlock(S, t, offset) {
  const old = Object.keys(S.letters || {}).map(d => S.letters[d]).filter(l => l && l.text && l.date && date.diffDays(t, l.date) >= 30);
  if (!old.length) return null;
  const l = old[(date.hash(t) + (offset || 0)) % old.length];
  const sents = String(l.text).split(/[。！？!?\n]/).map(s => s.trim()).filter(s => s.length >= 8 && s.length <= 60);
  if (!sents.length) return null;
  const q = sents[date.hash(t + l.date) % sents.length];
  return {
    days: date.diffDays(t, l.date),
    quote: q + '。',
    meta: date.cn(l.date) + '的信 · 点一下换一句',
  };
}

function todayModel(S, now, opts) {
  opts = opts || {};
  now = now || new Date();
  const t = date.today(now);
  const h = now.getHours();
  const just = opts.justDone || {};
  const todos = openTodos(S, t, now);
  const showT = todos.slice(0, 4).map(x => todoView(S, x, t));
  const recentDone = (S.todos || []).filter(x => x.done && x.done_at === t && !x.dropped_at && !x.archived && !sourceHidden(S, x, now));
  const justList = recentDone.filter(x => just[x.id]).map(x => todoView(S, x, t));
  const ideas = openIdeas(S, now);
  let ideaBlock = null;
  if (ideas.length) {
    const limit = todos.length <= 1 ? 5 : 3;
    const byNew = ideas.slice().sort((a, b) => String(a.created || '') < String(b.created || '') ? 1 : -1);
    const fresh = byNew.filter(i => date.diffDays(t, i.created || t) < 7);
    const stale = byNew.filter(i => date.diffDays(t, i.created || t) >= 7);
    let show = fresh.slice(0, stale.length ? limit - 1 : limit);
    if (stale.length) show.push(stale[date.hash(t) % stale.length]);
    if (show.length < limit) {
      byNew.forEach(i => {
        if (show.length >= limit) return;
        if (show.indexOf(i) < 0) show.push(i);
      });
    }
    ideaBlock = {
      hint: fresh.length ? ('最近 7 天 ' + fresh.length + ' 个') : '最近没有新点子',
      items: show.map(i => ideaView(i, t)),
      more: ideas.length - show.length,
      moreLabel: (ideas.length - show.length) > 0 ? ('全部 ' + ideas.length + ' 个 ›') : '全部 ›',
      total: ideas.length,
    };
  }
  return {
    dateLabel: date.cn(t) + ' 星期' + date.wd(t),
    hello: (h >= 4 && h < 11) ? '早上好' : '今天',
    count: totalLetters(S),
    todoTitle: (h >= 4 && h < 12) ? '今天要做的' : '待处理',
    hero: heroBlock(S, now),
    todos: showT,
    justDone: justList,
    todoMore: Math.max(0, todos.length - showT.length),
    todoMoreLabel: (todos.length - showT.length) > 0 ? ('还有 ' + (todos.length - showT.length) + ' 项 ›') : '全部 ›',
    todoOpen: todos.length,
    pendingExtra: (function () {
      const u = unopenedLetter(S, t, now);
      const n = u && u.reply && u.reply.todos ? u.reply.todos.length : 0;
      return n ? ('拆信后再加 ' + n + ' 件') : '';
    })(),
    doneCount: recentDone.length,
    showDoneLine: recentDone.length > justList.length,
    habits: habitItems(S, t),
    habitLabel: '今天的习惯',
    ideas: ideaBlock,
    memory: memoryBlock(S, t, opts.memoryOffset || 0),
  };
}

function writeMeta(S, day, now) {
  now = now || new Date();
  const t = date.today(now);
  const ld = date.letterDay(now);
  const h = now.getHours();
  const isToday = day === ld;
  const label = isToday ? ((h >= 17 || h < 4) ? '今晚' : '今天') : (day === date.addDays(ld, -1) ? '补写昨天' : '补写');
  const l = letterOf(S, day) || {};
  const tonight = !deliverNow(S) && date.sendsTonight(day, now);
  return {
    date: day,
    label: label,
    sub: date.cn(day) + ' 星期' + date.wd(day),
    to: isToday ? '致 明早的我' : ('补写 · ' + date.cn(day)),
    no: letterNo(S, day),
    canNext: day < ld,
    sent: !!l.sent_at,
    sealed: isSealed(S, day, now),
    sealedTitle: day === ld ? '今晚的信已寄出' : (date.cn(day) + '的信已寄出'),
    hasReply: !!(l.reply && l.reply.summary),
    opened: !!l.opened,
    sendLabel: l.sent_at ? '重新寄出' : '寄出',
    note: tonight ? '回信明早 6:00 送到 · 送到前都可以拿回来改' : '寄出后马上回信',
    tonight: tonight,
    habits: habitItems(S, day),
    showHabits: activeHabits(S).length > 0 && day >= date.addDays(t, -6),
    habitLabel: day === t ? '今天的习惯' : date.cn(day) + '的习惯',
    text: l.text || '',
    mood: l.mood || '',
    energy: l.energy || 0,
    preview: firstLine(l.text || ''),
    chars: String(l.text || '').trim().length,
  };
}

function energySeries(S, t, now, n) {
  const pts = [];
  for (let i = n; i >= 0; i--) {
    const d = date.addDays(t, -i);
    const l = letterOf(S, d);
    const visible = !!(l && l.sent_at && !isSealed(S, d, now));
    pts.push({
      d: d,
      v: visible && l.energy ? Number(l.energy) : 0,
      ok: !!(visible && l.energy),
      mood: visible && l.mood ? l.mood : '',
    });
  }
  return pts;
}

function stateCard(S, t, now, theme) {
  const n = 30;
  const pts = energySeries(S, t, now, n);
  const vals = pts.filter(p => p.ok);
  if (vals.length < 3) {
    return { ready: false, empty: '写几天信之后，回信会给每天的精力打分，这里会出现你的精力曲线。' };
  }
  const avg = vals.reduce((s, p) => s + p.v, 0) / vals.length;
  const recent = pts.slice(-7).filter(p => p.ok);
  const before = pts.slice(0, -7).filter(p => p.ok);
  let trend = '';
  let trendCls = '';
  if (recent.length >= 2 && before.length >= 2) {
    const ar = recent.reduce((s, p) => s + p.v, 0) / recent.length;
    const ab = before.reduce((s, p) => s + p.v, 0) / before.length;
    const dlt = ar - ab;
    if (Math.abs(dlt) < 0.3) {
      trend = '和之前差不多';
      trendCls = 'flat';
    } else if (dlt > 0) {
      trend = '最近一周 +' + dlt.toFixed(1);
      trendCls = 'up';
    } else {
      trend = '最近一周 ' + dlt.toFixed(1);
      trendCls = 'down';
    }
  }
  const moods = {};
  pts.forEach(p => { if (p.mood) moods[p.mood] = (moods[p.mood] || 0) + 1; });
  const top = Object.keys(moods).sort((a, b) => moods[b] - moods[a])[0];
  const dates = Object.keys(S.letters || {}).filter(d => hasText(S, d)).sort();
  const first = dates[0];
  const span = Math.max(1, Math.min(n, first ? date.diffDays(t, first) + 1 : n));
  const rates = activeHabits(S).slice(0, 4).map(h => {
    let c = 0;
    for (let i = 0; i < span; i++) if (S.logs && S.logs[h.id + '|' + date.addDays(t, -i)]) c++;
    return h.name + ' ' + Math.round(c / span * 100) + '%';
  }).join(' · ');
  return {
    ready: true,
    avg: avg.toFixed(1),
    trend: trend,
    trendCls: trendCls,
    start: date.cn(pts[0].d),
    top: top ? (top + ' · ' + moods[top] + ' 天') : '',
    rates: rates,
    pts: pts.map(p => ({ v: p.v, ok: p.ok ? 1 : 0 })),
    ink: INK[theme] || INK.ink,
    sep: SEP[theme] || SEP.ink,
    card: CARD[theme] || CARD.ink,
  };
}

function dayRow(S, d, now) {
  const num = Number(d.slice(8));
  const w = '周' + date.wd(d);
  if (!hasText(S, d)) return { kind: 'gap', date: d, num: num, wd: w };
  const l = S.letters[d];
  const sealed = isSealed(S, d, now);
  let line;
  let meta;
  const r = l.reply || {};
  if (sealed) {
    line = '回信封存中 · 明早 6:00 送到';
    meta = 'No.' + letterNo(S, d);
  } else if (!l.sent_at) {
    line = firstLine(l.text) || '草稿';
    meta = '还没寄出';
  } else {
    line = firstLine(r.summary || l.text);
    meta = l.energy ? ('No.' + letterNo(S, d) + ' · 精力 ' + l.energy + (l.mood ? ' · ' + l.mood : '')) : (r.imported ? '旧信' : '还没有回信');
  }
  return { kind: 'day', date: d, num: num, wd: w, line: line, meta: meta, sealed: sealed };
}

function digestCard(d) {
  const c = d.content || {};
  const st = c.stats || {};
  const kindN = { week: '周信', quarter: '季信', year: '年信' }[d.kind] || '信';
  let lab = d.key;
  if (d.kind === 'week' && /^\d{4}-\d{2}-\d{2}$/.test(d.key)) lab = date.cn(d.key) + ' 那一周';
  else if (d.kind === 'quarter') lab = String(d.key).replace('-', ' 年 ');
  else if (d.kind === 'year') lab = d.key + ' 年';
  return {
    kind: d.kind,
    key: d.key,
    title: c.title || '',
    badge: kindN + (st.letters ? (' · ' + st.letters + ' 封信') : ''),
    read: '读完整的' + kindN + ' ›',
    lab: lab,
    hasStats: !!c.stats,
    excerpt: c.letter || '',
    energy: st.energyAvg != null ? st.energyAvg : '—',
    todos: st.todosDone || 0,
    forgotten: (c.forgotten || []).length,
  };
}

function mailboxModel(S, now, ui) {
  ui = ui || {};
  now = now || new Date();
  const t = date.today(now);
  const theme = ui.theme || 'ink';
  const dates = Object.keys(S.letters || {}).filter(d => hasText(S, d)).sort();
  const first = dates[0] || '';
  const days = first ? date.diffDays(t, first) + 1 : 0;
  const month = Number(t.slice(5, 7));
  const monthN = dates.filter(d => d.slice(0, 7) === t.slice(0, 7)).length;
  const limit = ui.limit || 140;
  let groups = [];
  let more = false;
  if (dates.length) {
    const oldest = dates[0];
    const ld = date.letterDay(now);
    const start = hasText(S, ld) ? ld : date.addDays(ld, -1);
    let guard = 0;
    let last = start;
    for (let d = start; d >= oldest && guard < limit; d = date.addDays(d, -1), guard++) {
      last = d;
      const wk = date.weekKey(d);
      if (!groups.length || groups[groups.length - 1].wk !== wk) groups.push({ wk: wk, days: [] });
      groups[groups.length - 1].days.push(d);
    }
    more = last > oldest;
    const thisWk = date.weekKey(t);
    const digests = S.digests || [];
    groups = groups.map(g => {
      const found = digests.find(d => d.kind === 'week' && d.key === g.wk);
      return {
        wk: g.wk,
        title: g.wk === thisWk ? '本周' : (g.wk === date.addDays(thisWk, -7) ? '上周' : date.cn(g.wk) + ' 那一周'),
        range: date.cn(g.wk) + ' – ' + date.cn(date.addDays(g.wk, 6)),
        rows: g.days.map(d => dayRow(S, d, now)),
        digest: found ? digestCard(found) : null,
        canGen: g.wk < thisWk && !found,
      };
    });
  }
  return {
    eyebrow: days ? ('已经往来 ' + days + ' 天 · ' + dates.length + ' 封信') : '还没有信',
    tab: (ui.tab === 'week' || ui.tab === 'quarter' || ui.tab === 'year') ? ui.tab : 'all',
    tiles: [
      { key: 'todos', label: '待办', n: openTodos(S, t, now).length, link: true },
      { key: 'ideas', label: '点子', n: openIdeas(S, now).length, link: true },
      { key: 'month', label: month + '月的信', n: monthN, link: false },
    ],
    state: stateCard(S, t, now, theme),
    groups: groups,
    empty: !dates.length,
    more: more,
    writeDate: date.letterDay(now),
    kindDigests: (S.digests || []).filter(d => d.kind === ((ui.tab === 'week' || ui.tab === 'quarter' || ui.tab === 'year') ? ui.tab : '')).map(digestCard),
    kindHead: kindHead((ui.tab === 'week' || ui.tab === 'quarter' || ui.tab === 'year') ? ui.tab : '', t),
  };
}

function kindHead(tab, t) {
  const names = {
    week: ['周信', '每周一早上 6 点', '本周'],
    quarter: ['季信', '每季度第一天早上 6 点', '这一季'],
    year: ['年信', '每年元旦早上 6 点', '今年'],
  };
  const n = names[tab];
  if (!n) return null;
  let key = t.slice(0, 4);
  if (tab === 'week') key = date.weekKey(t);
  else if (tab === 'quarter') key = t.slice(0, 4) + '-Q' + (Math.floor((Number(t.slice(5, 7)) - 1) / 3) + 1);
  return {
    note: n[0] + '会在' + n[1] + '自动送达。也可以现在就让回信先写一封' + n[2] + '到目前为止的。',
    gen: '现在写' + n[2] + '的' + n[0] + ' ›',
    empty: '还没有' + n[0] + '。',
    kind: tab,
    key: key,
  };
}

function letterModel(S, day, now) {
  now = now || new Date();
  const l = letterOf(S, day);
  if (!l || !hasText(S, day)) return { missing: true, date: day };
  const t = date.today(now);
  const yday = date.addDays(t, -1);
  const sealed = isSealed(S, day, now);
  const opened = !!l.opened;
  const hideBody = sealed && !opened;
  const reply = (!hideBody && l.reply && l.reply.summary) ? replyBlock(S, l, t) : null;
  let title = date.cn(day) + '的信';
  if (reply && day === yday) title = '昨晚的回信';
  else if (reply && day === t) title = '今天的回信';
  else if (reply) title = date.cn(day) + '的回信';
  else if (!hideBody && opened && day === yday) title = '昨晚的信';
  else if (!hideBody && !sealed && !opened && (day === yday || day === t)) title = '昨晚的你来信了';
  return {
    missing: false,
    date: day,
    no: letterNo(S, day),
    eyebrow: (reply ? 'Re: ' : '') + 'No.' + letterNo(S, day) + ' · 星期' + date.wd(day),
    title: title,
    text: l.text || '',
    hideBody: hideBody,
    sealed: sealed,
    opened: opened,
    sent: !!l.sent_at,
    note: sealed ? ('回信已经写好，封存到 ' + date.cn(date.addDays(day, 1)) + ' 早上 6:00。') : ((!reply && l.sent_at) ? '这封信还没有回信。' : ''),
    mood: l.mood || '',
    energy: l.energy || 0,
    chars: String(l.text || '').trim().length,
    hasReply: !!reply,
    showGo: !!(reply && day >= yday),
    canAsk: !!(l.sent_at && !hideBody && !sealed && !reply),
    reply: reply,
  };
}

function replyBlock(S, l, t) {
  const r = l.reply;
  const paras = String(r.summary || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  const mine = String(l.text || '').split('\n').map(s => s.trim()).find(Boolean) || '';
  const lenses = [
    ['health', '健康', '#FF2D55'],
    ['energy', '精力', '#E07A00'],
    ['career', '事业', '#007AFF'],
    ['relation', '关系', '#248A3D'],
  ].map(row => ({
    key: row[0],
    name: row[1],
    mark: row[1].slice(0, 1),
    color: row[2],
    text: (r.lenses && r.lenses[row[0]]) || '',
  })).filter(row => row.text);
  const todos = (r.todos || []).map(x => {
    const live = (S.todos || []).find(y => y.id === x.id) || x;
    let badge = '已加入待办';
    if (live.dropped_at) badge = '已放下';
    else if (live.done) badge = '已完成';
    else if (live.due && live.due <= t) badge = '已放进今天';
    const due = live.due ? (live.due === t ? '今天' : date.cn(live.due)) : '';
    return { id: x.id, text: x.text, due: due, badge: badge };
  });
  const ideas = (r.ideas || []).map(x => ({ id: x.id, text: x.text }));
  let when = '';
  if (r.imported) when = '从 Life OS 搬过来的旧信';
  else if (l.replied_at) {
    const at = new Date(l.replied_at);
    if (!isNaN(at.getTime())) {
      const sealedOnce = at < date.cutoff(l.date) && !deliverNow(S);
      when = sealedOnce
        ? (date.cn(date.addDays(l.date, 1)) + ' 6:00 送到')
        : (date.cn(date.localDate(at)) + ' ' + date.hm(at) + ' 收到');
    }
  }
  return {
    paras: paras,
    mine: mine,
    when: when,
    energy: r.energy || 0,
    mood: r.mood || '',
    highlight: r.highlight || '',
    lenses: lenses,
    todos: todos,
    ideas: ideas,
    engine: r.engine || '',
    fb: r.fb || 0,
  };
}

function groupOf(d, t) {
  const wk = date.weekKey(t);
  if (d === t) return ['today', '今天'];
  if (d === date.addDays(t, -1)) return ['yday', '昨天'];
  if (date.weekKey(d) === wk) return ['week', '这周'];
  if (date.diffDays(t, d) <= 35) {
    const w = date.weekKey(d);
    const label = w === date.addDays(wk, -7) ? '上周' : (date.cn(w) + '那一周');
    return ['w' + w, label];
  }
  const y = d.slice(0, 4) === t.slice(0, 4) ? '' : d.slice(0, 4) + '年';
  return ['m' + d.slice(0, 7), y + Number(d.slice(5, 7)) + '月'];
}

function historyRow(S, x, d, gk) {
  const view = todoView(S, x, d);
  view.showDate = ['today', 'yday'].indexOf(gk) < 0;
  view.dateLabel = Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10));
  return view;
}

function doneHistory(S, t, mode, openGroups) {
  mode = mode === 'dropped' ? 'dropped' : 'done';
  const pool = (S.todos || []).filter(x => !x.archived);
  const doneL = pool.filter(x => x.done && !x.dropped_at && x.done_at);
  const dropL = pool.filter(x => x.dropped_at);
  const list = (mode === 'done' ? doneL : dropL).map(x => ({ x: x, d: mode === 'done' ? x.done_at : x.dropped_at }))
    .filter(it => it.d)
    .sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : 0);
  const opened = openGroups || {};
  const groups = [];
  list.forEach(it => {
    const ginfo = groupOf(it.d, t);
    let g = null;
    for (let i = 0; i < groups.length; i++) if (groups[i].key === ginfo[0]) g = groups[i];
    if (!g) {
      g = { key: ginfo[0], label: ginfo[1], items: [] };
      groups.push(g);
    }
    g.items.push(it);
  });
  const few = list.length <= 12;
  const hasRecent = groups.some(g => ['today', 'yday', 'week'].indexOf(g.key) >= 0);
  return {
    mode: mode,
    doneCount: doneL.length,
    dropCount: dropL.length,
    empty: !list.length,
    emptyText: mode === 'done' ? '最近还没有完成的待办。' : '还没有放下的事。做不了或决定不做的待办，点开选「放下」会收在这里。',
    groups: groups.map((g, gi) => {
      const explicit = Object.prototype.hasOwnProperty.call(opened, g.key);
      const open = explicit ? !!opened[g.key] : (few || ['today', 'yday', 'week'].indexOf(g.key) >= 0 || (gi === 0 && !hasRecent));
      return {
        key: g.key,
        label: g.label,
        open: open,
        count: g.items.length,
        verb: mode === 'done' ? '完成' : '放下',
        rows: open ? g.items.map(it => historyRow(S, it.x, it.d, g.key)) : [],
      };
    }),
  };
}

function listsModel(S, now, ui) {
  ui = ui || {};
  now = now || new Date();
  const t = date.today(now);
  const tab = ui.tab || 'todos';
  const ideas = openIdeas(S, now).slice().sort((a, b) => String(a.created || '') < String(b.created || '') ? 1 : -1);
  const dropped = (S.ideas || []).filter(i => i.status === 'dropped')
    .slice().sort((a, b) => String(a.dropped_at || a.updated_at || '') < String(b.dropped_at || b.updated_at || '') ? 1 : -1);
  return {
    tab: tab,
    todos: openTodos(S, t, now).map(x => todoView(S, x, t)),
    ideas: ideas.map(i => ideaView(i, t)),
    showDropped: !!ui.showDropped,
    dropped: dropped.map(i => ideaView(i, t)),
    done: doneHistory(S, t, ui.doneMode, ui.openGroups),
  };
}

module.exports = {
  hasText, hasSent, isSealed, letterNo, totalLetters, unopenedLetter,
  habitItems, todayModel, writeMeta, mailboxModel, letterModel, listsModel,
  openTodos, openIdeas,
};
