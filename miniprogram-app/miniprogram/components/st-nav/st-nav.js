const chrome = require('../../utils/chrome');

Component({
  options: { styleIsolation: 'apply-shared' },
  properties: {
    title: { type: String, value: '' },
    back: { type: String, value: '' },
    close: { type: Boolean, value: false },
  },
  data: { pad: 20, inner: 44 },
  lifetimes: {
    attached() { this.layout(); },
  },
  pageLifetimes: {
    show() { this.layout(); },
  },
  methods: {
    layout() {
      const m = chrome.navMetrics();
      this.setData({ pad: m.statusBarHeight, inner: m.navHeight });
    },
    onBack() { this.triggerEvent('back'); },
    onClose() { this.triggerEvent('close'); },
  },
});
