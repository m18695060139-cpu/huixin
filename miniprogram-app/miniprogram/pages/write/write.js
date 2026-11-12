const behavior = require('../../behaviors/page');
const state = require('../../utils/state');
const actions = require('../../utils/actions');
const model = require('../../utils/model');
const { letterDay, addDays, hm } = require('../../utils/date');
const { AI_ENABLED } = require('../../config');
const voice = require('../../utils/voice');

Page({
  behaviors: [behavior],
  data: {
    date: '',
    text: '',
    empty: true,
    focused: false,
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
    aiOn: !!AI_ENABLED,
    rec: { on: false, cancel: false, clock: '0:00' },
    tidy: { show: false, preview: false, busy: false, result: '', canAll: false },
  },
  onLoad() { this.initVoice(); },
  onShow() {
    this.hideShare();
    this.initVoice();
    const target = state.takeWriteTarget();
    const day = (target && target.date) || this.data.date || letterDay(new Date());
    const editing = target ? !!target.editing : this.data.editing;
    this.loadDay(day, editing);
    this.unsub = state.subscribe(() => this.paintAround());
  },
  onHide() {
    if (this.unsub) this.unsub();
    clearTimeout(this._saveT);
    this.abortRec(true);
  },
  onUnload() {
    if (this.unsub) this.unsub();
    clearTimeout(this._saveT);
    this.abortRec(true);
  },
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
      focused: false,
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
      rec: { on: false, cancel: false, clock: '0:00' },
      tidy: { show: false, preview: false, busy: false, result: '', canAll: false },
      aiOn: !!AI_ENABLED,
    });
    this._dictated = null;
    this._tidyBackup = null;
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
  onFocus() {
    // 聚焦就藏起自定义提示字。iOS 拼音组合时不会触发 bindinput，
    // 若只靠 empty，组合中的字会叠在灰色提示上。
    if (!this.data.focused) this.setData({ focused: true });
  },
  onBlur(e) {
    const text = (e.detail && e.detail.value != null) ? e.detail.value : (this._text || '');
    this._text = text;
    this.setData({ focused: false, empty: !text, canSend: !!String(text).trim() });
  },
  onInput(e) {
    // 不回写 text：输入时 setData 输入框的值会打断安卓输入法、光标乱跳。
    // empty 在失焦后用来决定要不要再显示提示字；聚焦时提示字已经藏起来了。
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
    if (!text.trim() || this._sending) return;
    this._sending = true;
    clearTimeout(this._saveT);
    const tonight = this.data.meta.tonight;
    const r = await actions.saveLetter(this.data.date, {
      text: text,
      mood: this.data.mood,
      energy: this.data.energy || null,
    }, { sent: true });
    if (r && r.code === 'risky') {
      this._sending = false;
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
    this._sending = false;
  },
  cancelEdit() {
    clearTimeout(this._saveT);
    actions.clearDraft(this.data.date);
    this.loadDay(this.data.date, false);
  },
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

  // ── 语音输入 ──
  initVoice() {
    if (this._mgr || this._mgrFail) return;
    const r = voice.createManager();
    if (!r.ok) { this._mgrFail = r.message; return; }
    const mgr = r.manager;
    const self = this;
    mgr.onStart = function () {
      if (!self._micHolding) {
        try { mgr.stop(); } catch (e) { /* 已经松手 */ }
        return;
      }
      self._recStartedAt = Date.now();
      self._recCancel = false;
      self.setData({ rec: { on: true, cancel: false, clock: '0:00' } });
      self.tickRec();
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    };
    mgr.onStop = function (res) { self.onRecStop(res); };
    mgr.onError = function (res) { self.onRecError(res); };
    this._mgr = mgr;
  },
  tickRec() {
    const self = this;
    clearInterval(this._recTick);
    this._recTick = setInterval(() => {
      if (!self.data.rec.on) { clearInterval(self._recTick); return; }
      const sec = Math.max(0, Math.floor((Date.now() - (self._recStartedAt || Date.now())) / 1000));
      const clock = Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
      if (clock !== self.data.rec.clock) self.setData({ 'rec.clock': clock });
    }, 250);
  },
  ensureMic(cb) {
    const self = this;
    const go = function () {
      wx.getSetting({
        success(res) {
          const v = res.authSetting && res.authSetting['scope.record'];
          if (v === true) { cb(); return; }
          if (v === false) { self.askOpenSetting(); return; }
          wx.authorize({
            scope: 'scope.record',
            success() { cb(); },
            fail() { self.askOpenSetting(); },
          });
        },
        fail() { self.askOpenSetting(); },
      });
    };
    if (wx.requirePrivacyAuthorize) {
      wx.requirePrivacyAuthorize({
        success: go,
        fail() { self.toast('需要同意隐私说明才能录音'); },
      });
    } else go();
  },
  askOpenSetting() {
    this._micHolding = false;
    this.setData({ rec: { on: false, cancel: false, clock: '0:00' } });
    wx.showModal({
      title: '需要麦克风',
      content: '语音输入要把你说的话写成文字。请在设置里打开麦克风。',
      confirmText: '去设置',
      success(r) { if (r.confirm) wx.openSetting(); },
    });
  },
  onMicStart(e) {
    const t = e.touches && e.touches[0];
    this._micHolding = true;
    this._micStartY = t ? t.clientY : 0;
    this._recCancel = false;
    const self = this;
    this.ensureMic(() => {
      if (!self._micHolding) return;
      self.startRec();
    });
  },
  onMicMove(e) {
    if (!this._micHolding) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    const cancel = (this._micStartY - t.clientY) > 72;
    if (cancel !== this._recCancel) {
      this._recCancel = cancel;
      if (this.data.rec.on) this.setData({ 'rec.cancel': cancel });
    }
  },
  onMicEnd() {
    this._micHolding = false;
    if (this.data.rec && this.data.rec.on) this.stopRec();
  },
  startRec() {
    this.initVoice();
    if (!this._mgr) {
      this._micHolding = false;
      this.toast(this._mgrFail || '语音还没开通。请先在公众平台添加「微信同声传译」插件。');
      return;
    }
    this._recCancel = false;
    this._recStartedAt = Date.now();
    try {
      this._mgr.start({ duration: 60000, lang: 'zh_CN' });
    } catch (e) {
      this._micHolding = false;
      this.toast('没能开始录音，请再试一次');
    }
  },
  stopRec() {
    clearInterval(this._recTick);
    if (this._mgr) {
      try { this._mgr.stop(); } catch (e) { /* onStop 会收尾 */ }
    }
  },
  abortRec(silent) {
    this._micHolding = false;
    this._recCancel = true;
    clearInterval(this._recTick);
    if (this._mgr && this.data.rec && this.data.rec.on) {
      try { this._mgr.stop(); } catch (e) { /* 忽略 */ }
    }
    if (!silent) this.setData({ rec: { on: false, cancel: false, clock: '0:00' } });
    else if (this.data.rec && this.data.rec.on) this.setData({ rec: { on: false, cancel: false, clock: '0:00' } });
  },
  onRecStop(res) {
    clearInterval(this._recTick);
    const cancel = this._recCancel;
    this._recCancel = false;
    this._micHolding = false;
    this.setData({ rec: { on: false, cancel: false, clock: '0:00' } });
    if (cancel) return;
    const ms = (res && res.duration) || (Date.now() - (this._recStartedAt || 0));
    const spoken = String((res && res.result) || '').trim();
    if (ms < 600 || !spoken) {
      this.toast('说的时间有点短，再试一次。');
      return;
    }
    this.appendSpoken(spoken);
  },
  onRecError(res) {
    clearInterval(this._recTick);
    this._micHolding = false;
    this.setData({ rec: { on: false, cancel: false, clock: '0:00' } });
    if (this._recCancel) { this._recCancel = false; return; }
    const msg = voice.errorMessage(res);
    if (!msg) return;
    if (msg === 'need-mic') { this.askOpenSetting(); return; }
    this.toast(msg);
  },
  appendSpoken(spoken) {
    const cur = this._text || '';
    const sep = !cur ? '' : (/\n\s*$/.test(cur) ? '' : '\n');
    const start = cur.length + sep.length;
    const text = cur + sep + spoken;
    this._text = text;
    this._dictated = { start: start, end: text.length, text: spoken };
    this._tidyBackup = null;
    const canAll = cur.trim().length > 0;
    this.setData({
      text: text,
      empty: !text,
      canSend: !!String(text).trim(),
      saveState: '保存中',
      warn: '',
      tidy: {
        show: !!AI_ENABLED,
        preview: false,
        busy: false,
        result: '',
        canAll: canAll,
      },
    });
    this.queueDraft(text);
  },
  queueDraft(text) {
    const date = this.data.date;
    actions.writeDraft(date, { text: text, mood: this.data.mood, energy: this.data.energy });
    clearTimeout(this._saveT);
    const self = this;
    this._saveT = setTimeout(() => self.autosave(date, text), 1200);
  },
  dictatedSlice() {
    const d = this._dictated;
    const cur = this._text || '';
    if (d && cur.slice(d.start, d.end) === d.text) return d;
    if (d && d.text && cur.indexOf(d.text) >= 0) {
      const i = cur.lastIndexOf(d.text);
      return { start: i, end: i + d.text.length, text: d.text };
    }
    return null;
  },
  onTidySeg() { this.runTidy(false); },
  onTidyAll() { this.runTidy(true); },
  runTidy(all) {
    if (!AI_ENABLED) return;
    if (this.data.tidy && this.data.tidy.busy) return;
    const cur = this._text || '';
    let src, start, end;
    if (all) {
      src = cur;
      start = 0;
      end = cur.length;
    } else {
      const d = this.dictatedSlice();
      if (!d) { this.toast('找不到刚说的那段，试试整理整封信'); return; }
      src = d.text;
      start = d.start;
      end = d.end;
    }
    if (!String(src).trim()) { this.toast('没有要整理的文字'); return; }
    if (!wx.cloud) { this.toast('云端还没连上'); return; }
    this._tidyRange = { start: start, end: end, src: src, all: !!all, before: cur };
    this.setData({ 'tidy.busy': true, 'tidy.preview': false, 'tidy.result': '' });
    const self = this;
    wx.cloud.callFunction({ name: 'tidy', data: { text: src } }).then(res => {
      const body = (res && res.result) || {};
      if (!body.ok || !body.text) {
        self.setData({ 'tidy.busy': false });
        self.toast(body.message || '整理这次没写成，稍后再试。');
        return;
      }
      self.setData({
        tidy: {
          show: true,
          preview: true,
          busy: false,
          result: body.text,
          canAll: self.data.tidy.canAll,
        },
      });
    }).catch(() => {
      self.setData({ 'tidy.busy': false });
      self.toast('网络不好，整理没写成。请再试一次。');
    });
  },
  onTidyUse() {
    const range = this._tidyRange;
    const result = (this.data.tidy && this.data.tidy.result) || '';
    if (!range || !result) return;
    const before = range.before != null ? range.before : (this._text || '');
    const next = before.slice(0, range.start) + result + before.slice(range.end);
    this._tidyBackup = before;
    this._tidyUsed = true;
    this._text = next;
    if (this._dictated) {
      this._dictated = { start: range.start, end: range.start + result.length, text: result };
    }
    this.setData({
      text: next,
      empty: !next,
      canSend: !!String(next).trim(),
      saveState: '保存中',
      tidy: { show: true, preview: false, busy: false, result: '', canAll: this.data.tidy.canAll, used: true },
    });
    this.queueDraft(next);
  },
  onTidyUndo() {
    if (this._tidyUsed && this._tidyBackup != null) {
      const bak = this._tidyBackup;
      this._tidyUsed = false;
      this._tidyBackup = null;
      this._text = bak;
      const range = this._tidyRange;
      if (range) this._dictated = { start: range.start, end: range.end, text: range.src };
      this.setData({
        text: bak,
        empty: !bak,
        canSend: !!String(bak).trim(),
        saveState: '保存中',
        tidy: { show: true, preview: false, busy: false, result: '', canAll: this.data.tidy.canAll, used: false },
      });
      this.queueDraft(bak);
      this.toast('已撤回');
      return;
    }
    this._tidyUsed = false;
    this.setData({
      'tidy.preview': false,
      'tidy.result': '',
      'tidy.busy': false,
      'tidy.used': false,
    });
  },
});
