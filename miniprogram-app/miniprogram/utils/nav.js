// 写信是普通页面（navigateTo），不是 tab。这样 iOS 右滑和安卓返回都走系统手势，
// 关掉时页面会销毁，不会留下 tab 页上的旧状态。

function openWrite(date, opts) {
  opts = opts || {};
  const editing = opts.editing !== false;
  const parts = [];
  if (date) parts.push('date=' + encodeURIComponent(date));
  parts.push(editing ? 'edit=1' : 'edit=0');
  const url = '/pages/write/write?' + parts.join('&');
  const pages = getCurrentPages() || [];
  const top = pages[pages.length - 1];
  if (top && top.route === 'pages/write/write') {
    if (typeof top.loadDay === 'function') top.loadDay(date || top.data.date, editing);
    return;
  }
  wx.navigateTo({
    url: url,
    fail: function () {
      wx.redirectTo({ url: url, fail: function () { /* 栈满或页面异常时不再强跳 */ } });
    },
  });
}

function closeWritePage() {
  wx.navigateBack({
    fail: function () {
      wx.switchTab({ url: '/pages/today/today' });
    },
  });
}

module.exports = { openWrite, closeWritePage };
