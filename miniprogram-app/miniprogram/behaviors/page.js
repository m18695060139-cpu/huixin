const chrome = require('../utils/chrome');
const state = require('../utils/state');
const model = require('../utils/model');
const actions = require('../utils/actions');
const { today, addDays } = require('../utils/date');

module.exports = Behavior({
  data: Object.assign({
    ed: { show: false, mode: 'todo', item: {}, token: 0 },
  }, chrome.initial()),
  methods: {
    hideShare() {
      if (wx.hideShareMenu) wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
    },
    syncChrome() {
      const app = getApp();
      const theme = app.resolvedTheme();
      const sys = app.globalData || {};
      this.setData({
        theme: theme,
        statusBar: sys.statusBar || this.data.statusBar || 20,
        safeBottom: sys.safeBottom || this.data.safeBottom || 0,
        online: state.get().online,
      });
      app.paintChrome(theme);
    },
    setTab(index, visible) {
      this.syncChrome();
      const now = new Date();
      const badge = !!model.unopenedLetter(state.get(), today(now), now);
      const bar = typeof this.getTabBar === 'function' && this.getTabBar();
      if (bar) {
        bar.setData({
          hidden: !visible,
          selected: index,
          theme: this.data.theme,
          badge: badge,
        });
      }
    },
    toast(msg, act) {
      const c = this.selectComponent('#toast');
      if (c && c.show) c.show(msg, act);
      else wx.showToast({ title: String(msg || '').slice(0, 18), icon: 'none' });
    },
    openEditor(mode, item) {
      this.setData({
        ed: {
          show: true,
          mode: mode,
          item: item || {},
          token: Date.now(),
        },
      });
      const bar = typeof this.getTabBar === 'function' && this.getTabBar();
      if (bar) bar.setData({ hidden: true });
    },
    closeEditor() {
      this.setData({ 'ed.show': false });
      if (typeof this.tabShouldShow === 'function' && !this.tabShouldShow()) return;
      const bar = typeof this.getTabBar === 'function' && this.getTabBar();
      if (bar) bar.setData({ hidden: false });
    },
    async onEditorSubmit(e) {
      const d = e.detail || {};
      if (d.action === 'ask-drop') {
        const item = Object.assign({}, (this.data.ed && this.data.ed.item) || {}, { note: d.note, text: d.text, id: d.id });
        this.setData({
          ed: { show: true, mode: 'drop', item: item, token: Date.now() },
        });
        return;
      }
      let r = { ok: true };
      let msg = '';
      let undo = null;
      if (d.mode === 'drop') {
        r = await actions.dropTodo(d.id, d.note, true);
        msg = '已放下';
      } else if (d.action === 'undrop') {
        r = await actions.dropTodo(d.id, d.note, false);
        msg = '已恢复成待办';
      } else if (d.action === 'delete') {
        r = await actions.deleteTodo(d.id);
      } else if (d.action === 'to-todo') {
        r = await actions.ideaToTodo(d.id);
        msg = '已转成待办';
      } else if (d.action === 'idea-drop') {
        r = await actions.setIdeaStatus(d.id, 'dropped');
        msg = '已放下';
        undo = { act: 'idea-undrop', id: d.id, label: '撤回' };
      } else if (d.mode === 'idea') {
        r = await actions.saveIdea({ id: d.id, text: d.text, source_date: d.source_date || '' });
        msg = '已保存';
      } else {
        r = await actions.saveTodo({
          id: d.id,
          text: d.text,
          due: d.due,
          note: d.note,
          source_date: d.source_date || '',
        });
        msg = '已保存';
      }
      if (r && r.code === 'risky') {
        this.toast(r.message);
        return;
      }
      this.closeEditor();
      if (msg) this.toast(msg, undo);
      if (typeof this.paint === 'function') this.paint();
    },
    onToastAct(e) {
      const act = e.detail || {};
      if (act.act === 'idea-undrop' && act.id) actions.setIdeaStatus(act.id, 'open');
      if (act.act === 'todo-note' && act.id) {
        const x = (state.get().todos || []).find(t => t.id === act.id);
        if (x) this.openEditor('todo', Object.assign({}, x, { focusNote: true }));
      }
    },
    newTodo() {
      this.openEditor('todo', { due: addDays(today(), 3) });
    },
    editTodo(e) {
      const id = e.currentTarget.dataset.id;
      const x = (state.get().todos || []).find(t => t.id === id);
      if (x) this.openEditor('todo', x);
    },
    newIdea() {
      this.openEditor('idea', {});
    },
    editIdea(e) {
      const id = e.currentTarget.dataset.id;
      const x = (state.get().ideas || []).find(t => t.id === id);
      if (x) this.openEditor('idea', x);
    },
  },
});
