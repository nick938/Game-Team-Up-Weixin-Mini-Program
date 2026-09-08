Component({
  properties: {
    team: {
      type: Object,
      value: {},
    },
    mark: {
      type: String,
      value: "",
    },
  },
  methods: {
    onTap() {
      const id = this.data.team && this.data.team._id;
      if (!id) return;
      this.triggerEvent("tap", { id });
    },
  },
});
