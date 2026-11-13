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
      const box = chrome.measure();
      this.setData({
        theme: theme,
        statusBar: sys.statusBar || box.statusBar || this.data.statusBar || 20,
        safeBottom: sys.safeBottom || box.safeBottom || this.data.safeBottom || 0,
        statusBarHeight: box.statusBarHeight,
        navHeight: box.navHeight,
        navBar: box.navBar,
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
    // 系统右滑 / 安卓返回：page-container 会先关图层，不销毁当前页
    onOverlayBack() {
      if (this.data.ed && this.data.ed.show) this.closeEditor();
    },
    // 跟网页版一样先改本机、马上关掉面板，云端在后台慢慢存。
    // 只有内容安全检查没过时才退回：本机已经回滚，再把刚写的内容原样放回面板，不会丢。
    onEditorSubmit(e) {
      const d = e.detail || {};
      const edItem = (this.data.ed && this.data.ed.item) || {};
      if (d.action === 'ask-drop') {
        const item = Object.assign({}, edItem, { note: d.note, text: d.text, id: d.id });
        this.setData({
          ed: { show: true, mode: 'drop', item: item, token: Date.now() },
        });
        return;
      }
      let job;
      let msg = '';
      let undo = null;
      let reopen = null;
      if (d.mode === 'drop') {
        job = actions.dropTodo(d.id, d.note, true);
        msg = '已放下';
        reopen = { mode: 'drop', item: Object.assign({}, edItem, { note: d.note }) };
      } else if (d.action === 'undrop') {
        job = actions.dropTodo(d.id, d.note, false);
        msg = '已恢复成待办';
      } else if (d.action === 'delete') {
        job = actions.deleteTodo(d.id);
      } else if (d.action === 'to-todo') {
        job = actions.ideaToTodo(d.id);
        msg = '已转成待办';
      } else if (d.action === 'idea-drop') {
        job = actions.setIdeaStatus(d.id, 'dropped');
        msg = '已放下';
        undo = { act: 'idea-undrop', id: d.id, label: '撤回' };
      } else if (d.mode === 'idea') {
        job = actions.saveIdea({ id: d.id, text: d.text, source_date: d.source_date || '' });
        msg = '已保存';
        reopen = { mode: 'idea', item: Object.assign({}, edItem, { text: d.text }) };
      } else {
        job = actions.saveTodo({
          id: d.id,
          text: d.text,
          due: d.due,
          note: d.note,
          source_date: d.source_date || '',
        });
        msg = '已保存';
        reopen = { mode: 'todo', item: Object.assign({}, edItem, { text: d.text, due: d.due, note: d.note, focusNote: false }) };
      }
      this.closeEditor();
      if (msg) this.toast(msg, undo);
      if (typeof this.paint === 'function') this.paint();
      Promise.resolve(job).then(r => {
        if (!(r && r.code === 'risky')) return;
        if (typeof this.paint === 'function') this.paint();
        if (reopen && !(this.data.ed && this.data.ed.show)) this.openEditor(reopen.mode, reopen.item);
        this.toast(r.message);
      }).catch(() => { /* 网络失败已进离线队列，联网后自动补寄 */ });
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
