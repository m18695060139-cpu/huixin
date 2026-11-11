const { DROP_REASONS } = require('../../utils/defaults');
const chrome = require('../../utils/chrome');
const { cn } = require('../../utils/date');

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
    droppedLabel: '',
    statusBar: 20,
    safeBottom: 0,
  },
  lifetimes: {
    attached() {
      const box = chrome.measure();
      this.setData({ statusBar: box.statusBar, safeBottom: box.safeBottom });
    },
  },
  observers: {
    'show, token': function (show) {
      if (!show) return;
      const item = this.data.item || {};
      const dropped = item.dropped_at ? String(item.dropped_at).slice(0, 10) : '';
      this.setData({
        text: item.text || '',
        due: item.due || '',
        note: item.note || '',
        focusNote: !!item.focusNote,
        droppedLabel: dropped ? (cn(dropped) + ' 放下了这件事') : '',
      });
    },
  },
  methods: {
    noop() {},
    onClose() { this.triggerEvent('close'); },
    // 输入时只记在逻辑层，不回写输入框：边打字边 setData 会打断安卓输入法、光标乱跳、字叠在一起
    onText(e) { this.data.text = e.detail.value; },
    onNote(e) { this.data.note = e.detail.value; },
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
