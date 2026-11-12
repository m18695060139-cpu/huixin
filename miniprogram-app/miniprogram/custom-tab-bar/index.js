const nav = require('../utils/nav');
const state = require('../utils/state');
const model = require('../utils/model');
const { letterDay } = require('../utils/date');

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
      if (i === 1) {
        const day = letterDay(new Date());
        const sent = model.hasSent(state.get(), day);
        nav.openWrite(day, { editing: !sent });
        return;
      }
      const urls = { 0: '/pages/today/today', 2: '/pages/mailbox/mailbox' };
      if (urls[i]) wx.switchTab({ url: urls[i] });
    },
  },
});
