// 本机是一份可以先看的副本。云端是正本，联网后刷新；写失败会留在队列里。

const { DEFAULT_QUESTIONS } = require('./defaults');
const cloud = require('./cloud');

const CACHE = 'hx_mp_v1';

const listeners = [];
const held = {};
const burned = {};
const burnedItems = {};

function blank() {
  return {
    settings: { theme: 'auto', questions: DEFAULT_QUESTIONS.slice(), name: '', deliver: 'morning' },
    letters: {},
    todos: [],
    ideas: [],
    habits: [],
    logs: {},
    digests: [],
    skip: {},
    ready: false,
    online: true,
    cloud: false,
    warn: '',
  };
}

let data = blank();
let writeTarget = null;
let replyingDate = '';

function get() { return data; }

function setReplying(date) {
  replyingDate = date || '';
  emit();
}

function getReplying() { return replyingDate; }

function subscribe(fn) {
  listeners.push(fn);
  return function () {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

function emit() {
  listeners.slice().forEach(fn => {
    try { fn(data); } catch (e) { console.error(e); }
  });
}

function snapshot() {
  return {
    settings: data.settings,
    letters: data.letters,
    todos: data.todos,
    ideas: data.ideas,
    habits: data.habits,
    logs: data.logs,
    digests: data.digests,
    skip: data.skip,
  };
}

function saveCache() {
  try { wx.setStorageSync(CACHE, snapshot()); } catch (e) { /* 空间不够就只用云端 */ }
}

function loadCache() {
  try {
    const c = wx.getStorageSync(CACHE);
    if (c && typeof c === 'object') return c;
  } catch (e) { /* ignore */ }
  return null;
}

function setOnline(on) {
  if (data.online === !!on) return;
  data.online = !!on;
  emit();
}

function hold(date) { held[date] = true; }
function unhold(date) { delete held[date]; }

function boot(cloudReady) {
  const cached = loadCache();
  if (cached) {
    data.settings = Object.assign(blank().settings, cached.settings || {});
    if (!Array.isArray(data.settings.questions) || !data.settings.questions.length) {
      data.settings.questions = DEFAULT_QUESTIONS.slice();
    }
    data.letters = cached.letters || {};
    data.todos = cached.todos || [];
    data.ideas = cached.ideas || [];
    data.habits = cached.habits || [];
    data.logs = cached.logs || {};
    data.digests = cached.digests || [];
    data.skip = cached.skip || {};
  }
  data.ready = true;
  data.cloud = !!cloudReady;
  data.online = !!cloudReady;
  emit();
  if (cloudReady) {
    cloud.flush().then(() => {
      if (cloud.pending()) { setOnline(false); return; }
      return refresh();
    }).catch(() => setOnline(false));
  }
}

cloud.setHooks({
  online: setOnline,
  risky: function (item, message) {
    if (item && item.entity === 'letter' && item.payload && item.payload.date) hold(item.payload.date);
    data.warn = message || '内容包含不适合保存的信息，请修改后再存';
    emit();
  },
  saved: function (item, result) {
    if (result && result._id) noteCloudId(item.entity, item.payload, result._id);
  },
});

function clearWarn() {
  if (!data.warn) return;
  data.warn = '';
  emit();
}

function clearBurn(date) {
  if (date && burned[date]) delete burned[date];
}

function upsertLetter(date, fields) {
  // 已焚毁后拒绝把旧信写回来（进行中的保存、回信回调等）。
  // 用户同一天再写新信时，saveLetter 会先 clearBurn。
  if (burned[date]) return;
  const prev = data.letters[date] || { date: date, text: '', mood: '', energy: null, sent_at: '', opened: false };
  data.letters[date] = Object.assign({}, prev, fields, { date: date });
  saveCache();
  emit();
}

function markOpened(date) {
  if (!data.letters[date]) return;
  data.letters[date].opened = true;
  saveCache();
  emit();
}

// 焚毁成功后立刻从本机拿掉。burned 防止正在进行的 refresh 把旧信又合并回来。
function applyBurn(date, items) {
  if (!date) return;
  burned[date] = true;
  delete data.letters[date];
  if (items) {
    // 勾了「同时删掉待办和点子」时，也挡住正在进行的 refresh 把它们合回来。
    burnedItems[date] = true;
    data.todos = (data.todos || []).filter(x => x.source_date !== date);
    data.ideas = (data.ideas || []).filter(x => x.source_date !== date);
  }
  saveCache();
  emit();
}

function upsertTodo(todo) {
  if (todo && todo.source_date && burnedItems[todo.source_date]) return;
  const i = data.todos.findIndex(x => x.id === todo.id);
  if (i >= 0) data.todos[i] = Object.assign({}, data.todos[i], todo);
  else data.todos.unshift(todo);
  saveCache();
  emit();
}

function removeTodo(id) {
  data.todos = data.todos.filter(x => x.id !== id);
  saveCache();
  emit();
}

function removeIdea(id) {
  data.ideas = data.ideas.filter(x => x.id !== id);
  saveCache();
  emit();
}

function upsertIdea(idea) {
  if (idea && idea.source_date && burnedItems[idea.source_date]) return;
  const i = data.ideas.findIndex(x => x.id === idea.id);
  if (i >= 0) data.ideas[i] = Object.assign({}, data.ideas[i], idea);
  else data.ideas.unshift(idea);
  saveCache();
  emit();
}

function upsertHabit(habit) {
  const i = data.habits.findIndex(x => x.id === habit.id);
  if (i >= 0) data.habits[i] = Object.assign({}, data.habits[i], habit);
  else data.habits.push(habit);
  saveCache();
  emit();
}

function setLog(habitId, day, on) {
  const k = habitId + '|' + day;
  if (on) data.logs[k] = true;
  else delete data.logs[k];
  saveCache();
  emit();
}

function patchSettings(patch) {
  data.settings = Object.assign({}, data.settings, patch);
  saveCache();
  emit();
}

function skipBackfill(day) {
  data.skip[day] = true;
  saveCache();
  emit();
}

function setWriteTarget(date, editing) {
  writeTarget = { date: date, editing: !!editing };
}

function takeWriteTarget() {
  const t = writeTarget;
  writeTarget = null;
  return t;
}

function noteCloudId(entity, payload, id) {
  if (!payload || !id) return;
  if (entity === 'letter' && data.letters[payload.date]) data.letters[payload.date]._id = id;
  if (entity === 'todo') {
    const x = data.todos.find(t => t.id === payload.id);
    if (x) x._id = id;
  }
  if (entity === 'idea') {
    const x = data.ideas.find(t => t.id === payload.id);
    if (x) x._id = id;
  }
  if (entity === 'habit') {
    const x = data.habits.find(t => t.id === payload.id);
    if (x) x._id = id;
  }
  if (entity === 'settings') data.settings._id = id;
  saveCache();
}

function resetLocal() {
  data = blank();
  data.ready = true;
  data.online = cloud.cloudOn();
  data.cloud = data.online;
  Object.keys(held).forEach(k => delete held[k]);
  Object.keys(burned).forEach(k => delete burned[k]);
  Object.keys(burnedItems).forEach(k => delete burnedItems[k]);
  try {
    const info = wx.getStorageInfoSync();
    (info.keys || []).forEach(k => {
      if (k.indexOf('hx_mp') === 0) wx.removeStorageSync(k);
    });
  } catch (e) { /* ignore */ }
  cloud.clearQueue();
  emit();
}

async function fetchAll(name) {
  const db = wx.cloud.database();
  const coll = db.collection(name);
  const out = [];
  let skip = 0;
  for (let i = 0; i < 40; i++) {
    let res;
    try {
      res = await coll.skip(skip).limit(20).get();
    } catch (e) {
      if (!out.length) return [];
      break;
    }
    const rows = (res && res.data) || [];
    rows.forEach(r => out.push(r));
    if (rows.length < 20) break;
    skip += rows.length;
  }
  return out;
}

function applyCloud(bundle) {
  const letters = {};
  (bundle.letters || []).forEach(row => {
    if (!row.date) return;
    // 焚毁后若有一趟更早发出的 refresh 回来，云端快照里可能还带着这封信。不要合回来。
    if (burned[row.date]) return;
    const prev = data.letters[row.date];
    const next = {
      _id: row._id,
      date: row.date,
      text: row.text || '',
      mood: row.mood || '',
      energy: row.energy || null,
      sent_at: row.sent_at || '',
      opened: !!row.opened,
      updated_at: row.updated_at || '',
      reply: row.reply && row.reply.summary ? row.reply : ((prev && prev.reply) || null),
      replied_at: row.replied_at || (prev && prev.replied_at) || '',
    };
    if (held[row.date] && prev) next.text = prev.text;
    letters[row.date] = next;
  });
  Object.keys(data.letters).forEach(d => {
    if (burned[d]) return;
    if (!letters[d] && (held[d] || data.letters[d])) letters[d] = data.letters[d];
  });
  // 只有云端已经看不到这封信，才放下标记。快照里还在就继续挡。
  Object.keys(burned).forEach(d => {
    const still = (bundle.letters || []).some(r => r.date === d);
    if (!still) delete burned[d];
  });
  data.letters = letters;
  data.todos = (bundle.todos || []).filter(row => !burnedItems[row && row.source_date]).map(row => ({
    _id: row._id,
    id: row.id,
    text: row.text || '',
    due: row.due || '',
    note: row.note || '',
    done: !!row.done,
    done_at: row.done_at || '',
    dropped_at: row.dropped_at || '',
    archived: !!row.archived,
    source_date: row.source_date || '',
    created: row.created || '',
  }));
  data.ideas = (bundle.ideas || []).filter(row => !burnedItems[row && row.source_date]).map(row => ({
    _id: row._id,
    id: row.id,
    text: row.text || '',
    status: row.status || 'open',
    source_date: row.source_date || '',
    created: row.created || '',
    dropped_at: row.dropped_at || '',
  }));
  Object.keys(burnedItems).forEach(d => {
    const still = (bundle.todos || []).some(r => r && r.source_date === d)
      || (bundle.ideas || []).some(r => r && r.source_date === d);
    if (!still) delete burnedItems[d];
  });
  data.habits = (bundle.habits || []).map(row => ({
    _id: row._id,
    id: row.id,
    name: row.name || '',
    sort: row.sort || 0,
    archived: !!row.archived,
    created: row.created || '',
  }));
  const logs = {};
  (bundle.logs || []).forEach(row => {
    if (row.habit_id && row.date && row.done !== false) logs[row.habit_id + '|' + row.date] = true;
  });
  data.logs = logs;
  data.digests = (bundle.digests || []).map(row => ({
    _id: row._id,
    kind: row.kind,
    key: row.key,
    content: row.content || {},
    created_at: row.created_at || '',
  })).sort((a, b) => String(a.key) < String(b.key) ? 1 : -1);
  const s = (bundle.settings && bundle.settings[0]) || null;
  if (s) {
    data.settings = {
      _id: s._id,
      theme: s.theme || data.settings.theme || 'auto',
      name: s.name || '',
      deliver: s.deliver === 'now' ? 'now' : 'morning',
      questions: (Array.isArray(s.questions) && s.questions.length) ? s.questions : data.settings.questions,
    };
  }
  saveCache();
  emit();
}

async function refresh() {
  if (!cloud.cloudOn()) return;
  const bundle = {};
  const names = ['letters', 'todos', 'ideas', 'habits', 'habit_logs', 'settings', 'digests'];
  const rows = await Promise.all(names.map(n => fetchAll(n).catch(() => [])));
  bundle.letters = rows[0];
  bundle.todos = rows[1];
  bundle.ideas = rows[2];
  bundle.habits = rows[3];
  bundle.logs = rows[4];
  bundle.settings = rows[5];
  bundle.digests = rows[6];
  applyCloud(bundle);
  setOnline(true);
}

module.exports = {
  get, subscribe, boot, refresh, setOnline, clearWarn, hold, unhold,
  upsertLetter, clearBurn, markOpened, applyBurn, upsertTodo, removeTodo, removeIdea, upsertIdea, upsertHabit, setLog,
  setReplying, getReplying,
  patchSettings, skipBackfill, setWriteTarget, takeWriteTarget, noteCloudId, resetLocal,
};
