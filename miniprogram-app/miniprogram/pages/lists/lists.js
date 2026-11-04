const behavior = require('../../behaviors/page');
const state = require('../../utils/state');
const actions = require('../../utils/actions');
const model = require('../../utils/model');

Page({
  behaviors: [behavior],
  data: { tab: 'todos', doneMode: 'done', openGroups: {}, showDropped: false },
  onLoad(query) {
    const tab = query && query.tab;
    if (tab === 'todos' || tab === 'ideas' || tab === 'done') this.setData({ tab: tab });
  },
  onShow() {
    this.hideShare();
    this.syncChrome();
    this.unsub = state.subscribe(() => this.paint());
    this.paint();
  },
  onHide() { if (this.unsub) this.unsub(); },
  onUnload() { if (this.unsub) this.unsub(); },
  tabShouldShow() { return false; },
  paint() {
    const view = model.listsModel(state.get(), new Date(), {
      tab: this.data.tab,
      doneMode: this.data.doneMode,
      openGroups: this.data.openGroups,
      showDropped: this.data.showDropped,
    });
    this.setData(view);
    this.syncChrome();
  },
  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/today/today' }) }); },
  onTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ tab: tab }, () => this.paint());
  },
  onDoneMode(e) {
    this.setData({ doneMode: e.currentTarget.dataset.mode, openGroups: {} }, () => this.paint());
  },
  onGroup(e) {
    const key = e.currentTarget.dataset.key;
    const groups = (this.data.done && this.data.done.groups) || [];
    const g = groups.find(x => x.key === key);
    const openGroups = Object.assign({}, this.data.openGroups);
    openGroups[key] = !(g && g.open);
    this.setData({ openGroups: openGroups }, () => this.paint());
  },
  toggleDropped() {
    this.setData({ showDropped: !this.data.showDropped }, () => this.paint());
  },
  async onToggle(e) {
    const id = e.currentTarget.dataset.id;
    await actions.toggleTodo(id);
    this.paint();
  },
  onIdeaDrop(e) {
    const id = e.currentTarget.dataset.id;
    actions.setIdeaStatus(id, 'dropped').then(r => {
      if (r && r.code === 'risky') this.toast(r.message);
      else this.toast('已放下', { act: 'idea-undrop', id: id, label: '撤回' });
    });
  },
  onIdeaTodo(e) {
    actions.ideaToTodo(e.currentTarget.dataset.id).then(r => {
      if (r && r.code === 'risky') this.toast(r.message);
      else this.toast('已转成待办');
    });
  },
  onRestore(e) {
    actions.setIdeaStatus(e.currentTarget.dataset.id, 'open').then(() => this.toast('已恢复到点子库'));
  },
});
