Component({
  data: {
    selected: 0,
    theme: 'ink',
    badge: false,
    hidden: false,
  },
  methods: {
    go(e) {
      const i = Number(e.currentTarget.dataset.i);
      const urls = ['/pages/today/today', '/pages/write/write', '/pages/mailbox/mailbox'];
      if (urls[i]) wx.switchTab({ url: urls[i] });
    },
  },
});
