// 先改本机，再交给云函数。内容被拦住时不改「已寄出」，草稿留在输入框里。

const state = require('./state');
const cloud = require('./cloud');
const { uid } = require('./id');
const { today } = require('./date');
const { RISKY_MESSAGE } = require('./defaults');

function draftKey(date) {
  return 'hx_mp_draft_' + date;
}

async function push(entity, action, payload, key) {
  if (!cloud.cloudOn()) {
    cloud.enqueue({ key: key, entity: entity, action: action, payload: payload });
    state.setOnline(false);
    return { ok: true, local: true };
  }
  try {
    const r = await cloud.call('save', { entity: entity, action: action, payload: payload });
    if (r && r.ok === false) {
      if (r.code === 'risky' && !r.message) r.message = RISKY_MESSAGE;
      return r;
    }
    state.setOnline(true);
    if (r && r._id) state.noteCloudId(entity, payload, r._id);
    return r || { ok: true };
  } catch (e) {
    cloud.enqueue({ key: key, entity: entity, action: action, payload: payload });
    state.setOnline(false);
    return { ok: true, local: true, queued: true };
  }
}

function readDraft(date) {
  try {
    const v = wx.getStorageSync(draftKey(date));
    if (v && typeof v === 'object') return v;
    if (typeof v === 'string') return { text: v };
  } catch (e) { /* ignore */ }
  return null;
}

function writeDraft(date, draft) {
  try { wx.setStorageSync(draftKey(date), draft); } catch (e) { /* ignore */ }
}

function clearDraft(date) {
  try { wx.removeStorageSync(draftKey(date)); } catch (e) { /* ignore */ }
}

async function saveLetter(date, fields, opts) {
  opts = opts || {};
  const prev = (state.get().letters || {})[date] || {};
  const next = {
    text: fields.text != null ? fields.text : (prev.text || ''),
    mood: fields.mood != null ? fields.mood : (prev.mood || ''),
    energy: fields.energy != null ? fields.energy : (prev.energy || null),
  };
  if (opts.sent) {
    next.sent_at = new Date().toISOString();
    next.opened = false;
  }
  // 跟云函数一样：已寄出的信不要被一次空的保存盖掉正文。
  const incomingEmpty = !String(next.text || '').trim();
  const hadText = String(prev.text || '').trim();
  if (incomingEmpty && hadText && (prev.sent_at || opts.sent)) {
    next.text = prev.text;
  }
  state.upsertLetter(date, next);
  const letter = state.get().letters[date];
  const payload = {
    date: date,
    text: letter.text || '',
    mood: letter.mood || '',
    energy: letter.energy || null,
    sent_at: letter.sent_at || '',
    opened: !!letter.opened,
  };
  const r = await push('letter', 'upsert', payload, 'letter:' + date);
  if (r && r.code === 'risky') {
    state.hold(date);
    if (opts.sent) {
      state.upsertLetter(date, { sent_at: prev.sent_at || '', opened: !!prev.opened });
    }
    return r;
  }
  state.unhold(date);
  if (opts.sent && r && r.ok !== false) clearDraft(date);
  return r;
}

async function markOpened(date) {
  const letter = (state.get().letters || {})[date];
  if (!letter) return { ok: false };
  state.markOpened(date);
  return push('letter', 'upsert', {
    date: date,
    opened: true,
  }, 'letter-open:' + date);
}

function todoPayload(x) {
  return {
    id: x.id,
    text: x.text || '',
    due: x.due || '',
    note: x.note || '',
    done: !!x.done,
    done_at: x.done_at || '',
    dropped_at: x.dropped_at || '',
    archived: !!x.archived,
    source_date: x.source_date || '',
    created: x.created || today(),
  };
}

async function saveTodo(fields) {
  const t = today();
  const id = fields.id || uid('t');
  const prev = (state.get().todos || []).find(x => x.id === id) || {};
  const todo = Object.assign({
    id: id,
    text: '',
    due: '',
    note: '',
    done: false,
    done_at: '',
    dropped_at: '',
    archived: false,
    source_date: '',
    created: t,
  }, prev, fields, { id: id });
  state.upsertTodo(todo);
  const r = await push('todo', 'upsert', todoPayload(todo), 'todo:' + id);
  if (r && r.code === 'risky') {
    if (prev.id) state.upsertTodo(prev);
    else state.removeTodo(id);
    return r;
  }
  return r;
}

async function toggleTodo(id) {
  const x = (state.get().todos || []).find(t => t.id === id);
  if (!x || x.dropped_at) return { ok: false };
  const done = !x.done;
  const t = today();
  state.upsertTodo({ id: id, done: done, done_at: done ? t : '' });
  const cur = state.get().todos.find(item => item.id === id);
  return push('todo', 'upsert', todoPayload(cur), 'todo:' + id);
}

async function dropTodo(id, note, drop) {
  const x = (state.get().todos || []).find(t => t.id === id);
  if (!x) return { ok: false };
  const t = today();
  state.upsertTodo({
    id: id,
    note: note != null ? note : (x.note || ''),
    dropped_at: drop ? (x.dropped_at || t) : '',
    done: false,
    done_at: '',
  });
  const cur = state.get().todos.find(item => item.id === id);
  const r = await push('todo', 'upsert', todoPayload(cur), 'todo:' + id);
  if (r && r.code === 'risky') {
    state.upsertTodo(x);
    return r;
  }
  return r;
}

async function deleteTodo(id) {
  state.removeTodo(id);
  return push('todo', 'delete', { id: id }, 'todo-del:' + id);
}

async function saveIdea(fields) {
  const id = fields.id || uid('i');
  const prev = (state.get().ideas || []).find(x => x.id === id) || {};
  const idea = Object.assign({
    id: id,
    text: '',
    status: 'open',
    source_date: '',
    created: today(),
    dropped_at: '',
  }, prev, fields, { id: id });
  state.upsertIdea(idea);
  const r = await push('idea', 'upsert', {
    id: idea.id,
    text: idea.text,
    status: idea.status,
    source_date: idea.source_date || '',
    created: idea.created || today(),
    dropped_at: idea.dropped_at || '',
  }, 'idea:' + id);
  if (r && r.code === 'risky') {
    if (prev.id) state.upsertIdea(prev);
    else state.removeIdea(id);
    return r;
  }
  return r;
}

async function setIdeaStatus(id, status) {
  const x = (state.get().ideas || []).find(i => i.id === id);
  if (!x) return { ok: false };
  const dropped_at = status === 'dropped' ? today() : '';
  state.upsertIdea({ id: id, status: status, dropped_at: dropped_at });
  return push('idea', 'upsert', {
    id: id,
    text: x.text,
    status: status,
    source_date: x.source_date || '',
    created: x.created || today(),
    dropped_at: dropped_at,
  }, 'idea:' + id);
}

async function ideaToTodo(id) {
  const i = (state.get().ideas || []).find(x => x.id === id);
  if (!i) return { ok: false };
  const t = today();
  const due = require('./date').addDays(t, 3);
  // 两条一起寄，不用等第一条回来；待办没过检查就把点子放回点子库
  const [, r] = await Promise.all([
    setIdeaStatus(id, 'todo'),
    saveTodo({ text: i.text, due: due, source_date: i.source_date || '', created: t }),
  ]);
  if (r && r.code === 'risky') setIdeaStatus(id, i.status || 'open');
  return r;
}

async function saveHabit(fields) {
  const id = fields.id || uid('h');
  const prev = (state.get().habits || []).find(h => h.id === id) || {};
  const habit = Object.assign({
    id: id,
    name: '',
    sort: (state.get().habits || []).length,
    archived: false,
    created: today(),
  }, prev, fields, { id: id });
  state.upsertHabit(habit);
  const r = await push('habit', 'upsert', {
    id: habit.id,
    name: habit.name,
    sort: habit.sort || 0,
    archived: !!habit.archived,
    created: habit.created || today(),
  }, 'habit:' + id);
  if (r && r.code === 'risky') {
    if (prev.id) state.upsertHabit(prev);
    else state.upsertHabit(Object.assign({}, habit, { archived: true, name: prev.name || habit.name }));
    return r;
  }
  return r;
}

async function archiveHabit(id) {
  const h = (state.get().habits || []).find(x => x.id === id);
  if (!h) return { ok: false };
  state.upsertHabit({ id: id, archived: true });
  return push('habit', 'upsert', {
    id: id,
    name: h.name,
    sort: h.sort || 0,
    archived: true,
    created: h.created || today(),
  }, 'habit:' + id);
}

async function toggleHabit(id, day) {
  const on = !(state.get().logs || {})[id + '|' + day];
  state.setLog(id, day, on);
  return push('habitLog', 'upsert', { habit_id: id, date: day, done: on }, 'log:' + id + ':' + day);
}

async function saveSettings(patch) {
  const prev = Object.assign({}, state.get().settings);
  state.patchSettings(patch);
  const s = state.get().settings;
  const payload = {};
  if ('theme' in patch) payload.theme = s.theme;
  if ('name' in patch) payload.name = s.name || '';
  if ('deliver' in patch) payload.deliver = s.deliver === 'now' ? 'now' : 'morning';
  if ('questions' in patch) payload.questions = s.questions || [];
  const r = await push('settings', 'upsert', payload, 'settings');
  if (r && r.code === 'risky') {
    state.patchSettings({
      theme: prev.theme,
      name: prev.name,
      deliver: prev.deliver,
      questions: prev.questions,
    });
    return r;
  }
  return r;
}


async function wipe() {
  if (cloud.cloudOn()) {
    try { await cloud.call('wipe', {}); }
    catch (e) { return { ok: false, message: '云端没清空，请联网后再试' }; }
  }
  state.resetLocal();
  return { ok: true };
}

module.exports = {
  readDraft, writeDraft, clearDraft,
  saveLetter, markOpened,
  saveTodo, toggleTodo, dropTodo, deleteTodo,
  saveIdea, setIdeaStatus, ideaToTodo,
  saveHabit, archiveHabit, toggleHabit,
  saveSettings, wipe,
};
