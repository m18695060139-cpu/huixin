const behavior = require('../../behaviors/page');
const state = require('../../utils/state');
const actions = require('../../utils/actions');
const model = require('../../utils/model');
const { letterDay, addDays, hm } = require('../../utils/date');
const { MOODS } = require('../../utils/poem');

Page({
  behaviors: [behavior],
  data: {
    date: '',
    text: '',
    mood: '',
    energy: 0,
    editing: true,
    canSend: false,
    saveState: '',
    warn: '',
    sentShow: false,
    meta: {},
    moods: [],
    energies: [],
  },
  onShow() {
    this.hideShare();
    const target = state.takeWriteTarget();
    const day = (target && target.date) || this.data.date || letterDay(new Date());
    const editing = target ? !!target.editing : this.data.editing;
    this.loadDay(day, editing);
    this.unsub = state.subscribe(() => this.paintAround());
  },
  onHide() {
    if (this.unsub) this.unsub();
    clearTimeout(this._saveT);
  },
  onUnload() { if (this.unsub) this.unsub(); },
  tabShouldShow() { return !this.data.editing && !this.data.sentShow && !this.data.ed.show; },
  loadDay(day, editing) {
    const meta = model.writeMeta(state.get(), day, new Date());
    const draft = actions.readDraft(day);
    const saved = meta.text || '';
    const text = draft && draft.text != null ? draft.text : saved;
    const mood = draft && draft.mood != null ? draft.mood : (meta.mood || '');
    const energy = draft && draft.energy != null ? Number(draft.energy) : (meta.energy || 0);
    const dirty = draft && draft.text != null && draft.text !== saved;
    const showEditor = !!editing || !meta.sent || !!dirty;
    this._text = text;
    this.setData({
      date: day,
      text: text,
      mood: mood,
      energy: energy,
      editing: showEditor,
      canSend: !!String(text).trim(),
      saveState: text ? '已存' : '',
      warn: state.get().warn || '',
      sentShow: false,
      meta: meta,
      moods: MOODS.map(id => ({ id: id, on: id === mood })),
      energies: [1, 2, 3, 4, 5].map(n => ({ n: n, on: n === Number(energy) })),
    });
    this.setTab(1, !showEditor);
  },
  paintAround() {
    const day = this.data.date;
    if (!day) return;
    const meta = model.writeMeta(state.get(), day, new Date());
    this.setData({
      meta: meta,
      warn: this.data.warn || state.get().warn || '',
      online: state.get().online,
    });
  },
  onInput(e) {
    this._text = e.detail.value;
    this.data.text = this._text;
    const date = this.data.date;
    this.setData({ canSend: !!String(this._text).trim(), saveState: '保存中', warn: '' });
    state.clearWarn();
    actions.writeDraft(date, { text: this._text, mood: this.data.mood, energy: this.data.energy });
    clearTimeout(this._saveT);
    const text = this._text;
    const self = this;
    this._saveT = setTimeout(() => self.autosave(date, text), 1200);
  },
  async autosave(date, text) {
    if (date !== this.data.date) return;
    const r = await actions.saveLetter(date, { text: text, mood: this.data.mood, energy: this.data.energy });
    if (r && r.code === 'risky') {
      this.setData({ warn: r.message, saveState: '未保存' });
      return;
    }
    this.setData({ saveState: r && r.local ? '存在本机' : '已存', warn: '' });
    this.paintAround();
  },
  onMood(e) {
    const id = e.currentTarget.dataset.id;
    const mood = this.data.mood === id ? '' : id;
    this.setData({
      mood: mood,
      moods: MOODS.map(m => ({ id: m, on: m === mood })),
    });
    actions.writeDraft(this.data.date, { text: this._text || '', mood: mood, energy: this.data.energy });
  },
  onEnergy(e) {
    const n = Number(e.currentTarget.dataset.n);
    const energy = this.data.energy === n ? 0 : n;
    this.setData({
      energy: energy,
      energies: [1, 2, 3, 4, 5].map(x => ({ n: x, on: x === energy })),
    });
    actions.writeDraft(this.data.date, { text: this._text || '', mood: this.data.mood, energy: energy });
  },
  onPrev() { this.shift(-1); },
  onNext() { if (this.data.meta.canNext) this.shift(1); },
  shift(n) {
    clearTimeout(this._saveT);
    const day = addDays(this.data.date, n);
    if (day > letterDay(new Date())) return;
    this.loadDay(day, false);
  },
  onChip(e) {
    const q = e.currentTarget.dataset.q || '';
    const cur = this._text || '';
    const text = cur.replace(/\s*$/, '') + (cur.trim() ? '\n' : '') + q;
    this._text = text;
    this.setData({ text: text, canSend: !!text.trim(), saveState: '保存中' });
    this.onInput({ detail: { value: text } });
  },
  async onSend() {
    const text = this._text || '';
    if (!text.trim()) return;
    clearTimeout(this._saveT);
    const tonight = this.data.meta.tonight;
    const r = await actions.saveLetter(this.data.date, {
      text: text,
      mood: this.data.mood,
      energy: this.data.energy || null,
    }, { sent: true });
    if (r && r.code === 'risky') {
      this.setData({ warn: r.message, editing: true });
      this.setTab(1, false);
      return;
    }
    const meta = model.writeMeta(state.get(), this.data.date, new Date());
    if (!tonight) await actions.markOpened(this.data.date);
    this.setData({
      editing: false,
      warn: '',
      saveState: r && r.local ? '存在本机' : '已寄出',
      sentShow: !!tonight,
      sentTime: hm(new Date()),
      sentNo: meta.no,
      sentDate: this.data.date.replace(/-/g, '.'),
      meta: model.writeMeta(state.get(), this.data.date, new Date()),
    });
    this.setTab(1, !tonight);
    if (!tonight) this.toast('已存好，现在可以回看');
  },
  takeBack() {
    this.setData({ sentShow: false, editing: true, text: this._text || this.data.meta.text || '' });
    this.setTab(1, false);
  },
  sentClose() {
    this.setData({ sentShow: false });
    wx.switchTab({ url: '/pages/today/today' });
  },
  closeWrite() {
    wx.switchTab({ url: '/pages/today/today' });
  },
  onHabit(e) {
    actions.toggleHabit(e.currentTarget.dataset.id, this.data.date);
  },
  pickSentence(e) {
    const text = e.currentTarget.dataset.text;
    this.openEditor('todo', {
      text: text,
      due: require('../../utils/date').addDays(require('../../utils/date').today(), 3),
      source_date: this.data.date,
    });
  },
  openLetter() {
    wx.navigateTo({ url: '/pages/letter/letter?date=' + this.data.date });
  },
});
