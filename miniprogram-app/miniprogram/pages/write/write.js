const behavior = require('../../behaviors/page');
const state = require('../../utils/state');
const actions = require('../../utils/actions');
const model = require('../../utils/model');
const { letterDay, addDays, hm } = require('../../utils/date');
const { AI_ENABLED } = require('../../config');

Page({
  behaviors: [behavior],
  data: {
    date: '',
    text: '',
    empty: true,
    mood: '',
    energy: 0,
    editing: true,
    canSend: false,
    saveState: '',
    warn: '',
    sentShow: false,
    meta: {},
    sentBusy: false,
    sentReady: false,
    prompts: ['今天哪一刻最有劲？', '有什么在回避？', '明天要做的事：', '今天想记住的一句话：'],
    placeholder: '今天过得怎么样？做了什么、想到什么、哪里卡住了，随便写。\n\n写完点「寄出」，回信会帮你整理好其余的一切。',
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
    const mood = meta.mood || '';
    const energy = meta.energy || 0;
    const dirty = draft && draft.text != null && draft.text !== saved;
    const showEditor = !!editing || !meta.sent || !!dirty;
    const letter = model.letterModel(state.get(), day, new Date());
    this._text = text;
    this.setData({
      date: day,
      text: text,
      empty: !text,
      mood: mood,
      energy: energy,
      editing: showEditor,
      canSend: !!String(text).trim(),
      saveState: text ? '已存' : '',
      warn: state.get().warn || '',
      sentShow: false,
      sentFail: false,
      meta: meta,
      letter: letter,
    });
    this.setTab(1, !showEditor);
  },
  paintAround() {
    const day = this.data.date;
    if (!day) return;
    const meta = model.writeMeta(state.get(), day, new Date());
    this.setData({
      meta: meta,
      letter: model.letterModel(state.get(), day, new Date()),
      warn: this.data.warn || state.get().warn || '',
      online: state.get().online,
    });
  },
  onInput(e) {
    // 不回写 text：输入时 setData 输入框的值会打断安卓输入法、光标乱跳。
    // 但「空不空」必须 setData，否则渲染层一直以为是空的，灰色提示字会叠在正文后面（重影）。
    this._text = e.detail.value;
    const date = this.data.date;
    const patch = { canSend: !!String(this._text).trim(), saveState: '保存中', warn: '' };
    const empty = !this._text;
    if (empty !== this.data.empty) patch.empty = empty;
    this.setData(patch);
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
    this.setData({ text: text, empty: !text, canSend: !!text.trim(), saveState: '保存中' });
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
    this.setData({
      editing: false,
      warn: '',
      saveState: r && r.local ? '存在本机' : '已寄出',
      sentShow: !!tonight,
      sentBusy: !!AI_ENABLED,
      sentReady: false,
      sentTime: hm(new Date()),
      sentNo: meta.no,
      sentDate: this.data.date.replace(/-/g, '.'),
      meta: meta,
    });
    this.setTab(1, !tonight);
    if (AI_ENABLED && wx.cloud) {
      state.setReplying(this.data.date);
      try {
        const res = await wx.cloud.callFunction({ name: 'reply', data: { date: this.data.date } });
        const body = (res && res.result) || {};
        if (body.ok && body.reply) {
          state.upsertLetter(this.data.date, {
            reply: body.reply,
            replied_at: body.replied_at || '',
            mood: body.reply.mood,
            energy: body.reply.energy,
          });
          (body.todos || []).forEach(t => state.upsertTodo(Object.assign({ done: false, note: '', dropped_at: '' }, t)));
          (body.ideas || []).forEach(i => state.upsertIdea(Object.assign({ status: 'open', dropped_at: '' }, i)));
        }
        this.setData({ sentBusy: false, sentReady: !!body.ok, sentFail: !body.ok });
      } catch (e) {
        this.setData({ sentBusy: false, sentReady: false, sentFail: true });
      }
      state.setReplying('');
    } else {
      this.setData({ sentBusy: false, sentReady: true });
    }
    if (!tonight) {
      actions.markOpened(this.data.date);
      wx.navigateTo({ url: '/pages/letter/letter?date=' + this.data.date });
    }
  },
  cancelEdit() { this.loadDay(this.data.date, false); },
  goToday() { wx.switchTab({ url: '/pages/today/today' }); },
  retryReply() {
    const date = this.data.date;
    this.setData({ sentBusy: true, sentFail: false, sentReady: false });
    state.setReplying(date);
    wx.cloud.callFunction({ name: 'reply', data: { date: date } }).then(res => {
      const body = (res && res.result) || {};
      if (body.ok && body.reply) {
        state.upsertLetter(date, { reply: body.reply, replied_at: body.replied_at || '', mood: body.reply.mood, energy: body.reply.energy });
      }
      this.setData({ sentBusy: false, sentReady: !!body.ok, sentFail: !body.ok });
      this.paintAround();
    }).catch(() => this.setData({ sentBusy: false, sentFail: true, sentReady: false }))
      .then(() => state.setReplying(''));
  },
  takeBack() {
    state.setReplying('');
    const text = this._text || this.data.meta.text || '';
    this._text = text;
    this.setData({ sentShow: false, editing: true, text: text, empty: !text, canSend: !!text.trim() });
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
});
