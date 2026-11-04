const { DROP_REASONS } = require('../../utils/defaults');

Component({
  properties: {
    show: { type: Boolean, value: false },
    mode: { type: String, value: 'todo' },
    item: { type: Object, value: {} },
    token: { type: Number, value: 0 },
    theme: { type: String, value: 'ink' },
  },
  data: {
    reasons: DROP_REASONS,
    text: '',
    due: '',
    note: '',
    focusNote: false,
    statusBar: 20,
    safeBottom: 0,
  },
  lifetimes: {
    attached() {
      try {
        const sys = wx.getSystemInfoSync();
        const safeBottom = sys.safeArea && sys.screenHeight ? Math.max(0, sys.screenHeight - sys.safeArea.bottom) : 0;
        this.setData({ statusBar: sys.statusBarHeight || 20, safeBottom: safeBottom });
      } catch (e) { /* 用默认 */ }
    },
  },
  observers: {
    'show, token': function (show) {
      if (!show) return;
      const item = this.data.item || {};
      this.setData({
        text: item.text || '',
        due: item.due || '',
        note: item.note || '',
        focusNote: !!item.focusNote,
      });
    },
  },
  methods: {
    noop() {},
    onClose() { this.triggerEvent('close'); },
    onText(e) { this.setData({ text: e.detail.value }); },
    onNote(e) { this.setData({ note: e.detail.value }); },
    onDue(e) { this.setData({ due: e.detail.value }); },
    clearDue() { this.setData({ due: '' }); },
    onReason(e) {
      const v = e.currentTarget.dataset.v;
      const cur = (this.data.note || '').trim();
      const note = !cur ? v : (cur.indexOf(v) >= 0 ? cur : cur + '，' + v);
      this.setData({ note: note });
    },
    emit(action) {
      const item = this.data.item || {};
      this.triggerEvent('submit', {
        mode: this.data.mode,
        action: action,
        id: item.id || '',
        text: (this.data.text || '').trim(),
        due: this.data.due || '',
        note: (this.data.note || '').trim(),
        source_date: item.source_date || '',
      });
    },
    onSave() {
      if (this.data.mode !== 'drop' && !(this.data.text || '').trim()) {
        wx.showToast({ title: '先写一点内容', icon: 'none' });
        return;
      }
      this.emit('save');
    },
    onDelete() { this.emit('delete'); },
    onAskDrop() { this.emit('ask-drop'); },
    onUndrop() { this.emit('undrop'); },
    onToTodo() { this.emit('to-todo'); },
    onIdeaDrop() { this.emit('idea-drop'); },
    onDrop() { this.emit('save'); },
  },
});
