/* global Component */
const SWITCH_DELAY_MS = 180;
const DRAG_THRESHOLD_PX = 8;

Component({
  data: {
    items: [],
    selectedRoute: '',
    hidden: true,
    dark: false,
    lensIndex: 0,
    dragging: false,
    lensStretch: 1,
  },
  observers: {
    'items, selectedRoute, hidden': function () {
      this.resetLens();
    },
  },
  lifetimes: {
    detached() {
      clearTimeout(this.switchTimer);
    },
  },
  methods: {
    resetLens() {
      clearTimeout(this.switchTimer);
      this.switching = false;
      this.gesture = null;
      const index = this.data.items.findIndex((item) => item.pagePath === this.data.selectedRoute);
      this.setData({ lensIndex: Math.max(index, 0), dragging: false, lensStretch: 1 });
    },
    switchPage(event) {
      if (Date.now() < this.suppressTapUntil) return;
      const route = event.currentTarget.dataset.route;
      this.selectTab(this.data.items.findIndex((item) => item.pagePath === route));
    },
    selectTab(index) {
      const item = this.data.items[index];
      if (this.data.hidden || this.switching || !item) return;
      this.setData({ lensIndex: index, dragging: false, lensStretch: 1 });
      if (item.pagePath === this.data.selectedRoute) return;
      this.switching = true;
      // Let the current page's lens settle before WeChat replaces its tab bar instance.
      this.switchTimer = setTimeout(() => {
        wx.switchTab({
          url: '/' + item.pagePath,
          complete: () => this.resetLens(),
        });
      }, SWITCH_DELAY_MS);
    },
    onTouchStart(event) {
      if (this.data.hidden || this.switching) return;
      if (event.touches.length !== 1) {
        this.onTouchCancel();
        return;
      }
      const { clientX, clientY } = event.touches[0];
      const gesture = { clientX, clientY, lastX: clientX, rect: null, dragging: false, ignored: false };
      this.gesture = gesture;
      this.createSelectorQuery()
        .select('.glass-tabs')
        .boundingClientRect((rect) => {
          if (this.gesture === gesture && rect?.width > 8) gesture.rect = rect;
        })
        .exec();
    },
    onTouchMove(event) {
      const gesture = this.gesture;
      if (!gesture || gesture.ignored || event.touches.length !== 1) return;
      const { clientX, clientY } = event.touches[0];
      if (!gesture.dragging) {
        const horizontal = Math.abs(clientX - gesture.clientX);
        const vertical = Math.abs(clientY - gesture.clientY);
        if (vertical >= DRAG_THRESHOLD_PX && vertical > horizontal) gesture.ignored = true;
        if (horizontal < DRAG_THRESHOLD_PX || gesture.ignored || !gesture.rect) return;
        gesture.dragging = true;
      }
      const stretch = Math.min(0.09, Math.abs(clientX - gesture.lastX) / 240);
      gesture.lastX = clientX;
      this.setData({
        lensIndex: this.touchIndex(clientX, gesture.rect),
        dragging: true,
        lensStretch: Number((1.15 + stretch).toFixed(3)),
      });
    },
    onTouchEnd(event) {
      const gesture = this.gesture;
      this.gesture = null;
      if (!gesture?.dragging) return;
      this.suppressTapUntil = Date.now() + 320;
      const x = event.changedTouches[0]?.clientX;
      this.selectTab(Math.round(x == null ? this.data.lensIndex : this.touchIndex(x, gesture.rect)));
    },
    onTouchCancel() {
      if (!this.gesture) return;
      this.resetLens();
    },
    touchIndex(x, rect) {
      // The bar has 4px padding on each side.
      const step = (rect.width - 8) / this.data.items.length;
      return Math.max(0, Math.min(this.data.items.length - 1, (x - rect.left - 4) / step - 0.5));
    },
  },
});
