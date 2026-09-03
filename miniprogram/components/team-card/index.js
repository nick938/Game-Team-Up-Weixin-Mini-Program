const { formatTimeRange, isSoon, statusText, teamEndAt } = require("../../utils/format");

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
  data: {
    timeText: "",
    statusText: "",
  },
  observers: {
    team(team) {
      if (!team || !team._id) return;
      this.setData({
        timeText: formatTimeRange(team.startAt, teamEndAt(team)),
        statusText: statusText(team.displayStatus || team.status),
      });
      if (team.soon === undefined) {
        team.soon = isSoon(team.startAt);
      }
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
