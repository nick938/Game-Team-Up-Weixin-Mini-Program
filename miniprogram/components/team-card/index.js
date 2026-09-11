const { usableTeamId } = require("../../utils/team-entry");

Component({
  properties: {
    team: {
      type: Object,
      value: {},
    },
    teamId: {
      type: String,
      value: "",
    },
    mark: {
      type: String,
      value: "",
    },
  },
  methods: {
    onTap() {
      const team = this.data.team || {};
      const id = usableTeamId(this.data.teamId || team.id || team._id);
      if (!id) return;
      this.triggerEvent("open", { id, gameName: team.gameName || "" });
    },
  },
});
