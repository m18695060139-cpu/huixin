Component({
  data: { show: false, msg: '', act: null },
  methods: {
    show(msg, act) {
      this.setData({ show: true, msg: msg || '', act: act || null });
      const self = this;
      clearTimeout(this._t);
      this._t = setTimeout(() => {
        self.setData({ show: false, act: null });
      }, act ? 5000 : 2200);
    },
    onAct() {
      const act = this.data.act;
      this.setData({ show: false, act: null });
      this.triggerEvent('act', act || {});
    },
  },
});
