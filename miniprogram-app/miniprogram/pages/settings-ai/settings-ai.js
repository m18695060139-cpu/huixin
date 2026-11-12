const behavior = require('../../behaviors/settings');
const ss = require('../../utils/setting-status');

Page({
  behaviors: [behavior],
  data: {
    ai: { loading: true },
    aiHelp: ss.AI_HELP,
  },
  onLoad() {
    const cached = ss.readAICache();
    if (cached) {
      this.setData({ ai: ss.aiView(cached, null, {}) });
    }
  },
  onShow() {
    this.bootSettings();
    this.loadAI();
  },
  loadAI() {
    const cached = ss.readAICache();
    if (cached && this.data.ai && this.data.ai.loading) {
      this.setData({ ai: ss.aiView(cached, null, {}) });
    }
    if (this._aiEditing) return;
    if (ss.isFresh(cached)) return;
    ss.aiCall('status').then(r => {
      ss.writeAICache(r);
      if (this._aiEditing) return;
      const form = this._aiForm || null;
      this.setData({ ai: ss.aiView(r, form, { msg: this.data.ai.msg, ok: this.data.ai.ok, busy: this.data.ai.busy }) });
    }).catch(e => {
      if (this._aiEditing || cached) return;
      this.setData({ ai: ss.aiView({ configured: false, providers: ss.AI_PROVIDERS }, null, { msg: e.message, ok: false }) });
    });
  },
  onProvider(e) {
    const id = e.currentTarget.dataset.id;
    const a = this.data.ai || {};
    if (id === 'hunyuan') {
      if (a.configured) this.onOff();
      else if (a.showForm) {
        this._aiForm = null;
        this._aiKey = '';
        this._aiEditing = false;
        this.setData({ ai: ss.aiView(a.data, { provider: 'hunyuan' }, { msg: '', busy: '' }) });
      }
      return;
    }
    const p = (a.providers || []).filter(x => x.id === id)[0];
    if (!p) return;
    const form = Object.assign({}, this._aiForm || a.form, { provider: p.id, key: (this._aiKey != null ? this._aiKey : (a.form && a.form.key) || '') });
    if (p.on) {
      const d = a.data || {};
      form.base_url = d.base_url || p.base || '';
      form.model = d.model || p.model || '';
    } else if (p.id !== 'custom') {
      form.base_url = p.base;
      form.model = p.model;
    }
    this._aiForm = form;
    this._aiEditing = true;
    this.setData({ ai: ss.aiView(a.data, form, { msg: '', busy: a.busy }) });
  },
  onField(e) {
    const k = e.currentTarget.dataset.k;
    const v = e.detail.value;
    if (!this._aiForm) this._aiForm = Object.assign({}, (this.data.ai && this.data.ai.form) || {});
    this._aiForm[k] = v;
    if (k === 'key') this._aiKey = v;
    this._aiEditing = true;
    if (this.data.ai && this.data.ai.form) this.data.ai.form[k] = v;
  },
  formNow() {
    const a = this.data.ai || {};
    const form = Object.assign({}, this._aiForm || a.form || {});
    if (this._aiKey != null && this._aiKey !== undefined) form.key = this._aiKey;
    return form;
  },
  onTest() {
    const a = this.data.ai || {};
    if (a.busy) return;
    const form = this.formNow();
    this.setData({ 'ai.busy': 'test', 'ai.msg': '' });
    ss.aiCall('test', form).then(r => {
      const ok = !!r.ok;
      const msg = ok
        ? ('接通了，用时 ' + (r.ms / 1000).toFixed(1) + ' 秒，它回复：「' + (r.reply || '') + '」')
        : ('没接通：' + (r.error || r.message || '请稍后再试'));
      if (a.data) ss.writeAICache(a.data);
      this.setData({ ai: ss.aiView(a.data, form, { busy: '', msg: msg, ok: ok }) });
    }).catch(e => {
      this.setData({ ai: ss.aiView(a.data, form, { busy: '', msg: e.message, ok: false }) });
    });
  },
  onSave() {
    const a = this.data.ai || {};
    if (a.busy) return;
    const form = this.formNow();
    this.setData({ 'ai.busy': 'save', 'ai.msg': '' });
    ss.aiCall('save', form).then(r => {
      this._aiKey = '';
      this._aiForm = null;
      this._aiEditing = false;
      ss.writeAICache(r);
      this.setData({ ai: ss.aiView(r, { provider: r.provider, base_url: r.base_url, model: r.model, key: '' }, { msg: '', ok: true }) });
      this.toast('已保存，之后的回信用你自己的 AI 写');
    }).catch(e => {
      this.setData({ ai: ss.aiView(a.data, form, { busy: '', msg: e.message, ok: false }) });
    });
  },
  onOff() {
    wx.showModal({
      title: '停用自己的 AI，改回免费模型？',
      content: '保存的 Key 会被删除。',
      confirmText: '停用',
      confirmColor: '#C0352B',
      success: (res) => {
        if (!res.confirm) return;
        ss.aiCall('off').then(r => {
          this._aiKey = '';
          this._aiForm = null;
          this._aiEditing = false;
          ss.writeAICache(r);
          this.setData({ ai: ss.aiView(r, null, {}) });
          this.toast('已改回免费模型');
        }).catch(e => this.toast(e.message));
      },
    });
  },
});
