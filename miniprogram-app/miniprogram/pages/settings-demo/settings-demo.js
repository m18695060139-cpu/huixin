const behavior = require('../../behaviors/settings');
const state = require('../../utils/state');

Page({
  behaviors: [behavior],
  onShow() { this.bootSettings(); },
  onSeed() {
    if (!wx.cloud) { this.toast('云端还没连上'); return; }
    wx.showModal({
      title: '载入示例数据？',
      content: '写入和网页版演示账号同一套信、回信、待办、点子、习惯、周信和季信。已有的内容会留下；同一天已有你自己的信则跳过。',
      confirmText: '载入',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '写入中', mask: true });
        try {
          const r = await wx.cloud.callFunction({ name: 'demoSeed', data: { action: 'seed' } });
          const body = (r && r.result) || {};
          wx.hideLoading();
          if (!body.ok) { this.toast(body.message || '没写进去'); return; }
          await state.refresh();
          this.toast('已载入 ' + (body.letters || 0) + ' 封信');
        } catch (e) {
          wx.hideLoading();
          this.toast('没写进去。请先在开发者工具里上传并部署 demoSeed');
        }
      },
    });
  },
  onClear() {
    if (!wx.cloud) { this.toast('云端还没连上'); return; }
    wx.showModal({
      title: '清除示例数据？',
      content: '只删除标了 demo 的信、待办、点子、习惯、打卡和总结信。你自己写的会留下。',
      confirmText: '清除',
      confirmColor: '#C0352B',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '清除中', mask: true });
        try {
          const r = await wx.cloud.callFunction({ name: 'demoSeed', data: { action: 'clear' } });
          const body = (r && r.result) || {};
          wx.hideLoading();
          if (!body.ok) { this.toast(body.message || '没清除'); return; }
          await state.refresh();
          this.toast('示例数据已清除');
        } catch (e) {
          wx.hideLoading();
          this.toast('没清除。请先上传并部署 demoSeed');
        }
      },
    });
  },
});
