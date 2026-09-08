const PLATFORMS = ["Steam", "手游", "端游", "主机"];
const VOICES = ["不限", "KOOK", "游戏内语音", "开麦"];
const MAX_TEAM_HOURS = 24;
const APP_VERSION = "0.6.0";
const FEEDBACK_KINDS = ["遇到问题", "功能建议", "体验吐槽", "其他"];
const FEEDBACK_PAGES = ["大厅", "发车", "组队详情", "我的", "其他"];
const FEEDBACK_TEMPLATE = "【我遇到的情况】\n\n\n【我希望怎样】\n";

const STATUS_TEXT = {
  recruiting: "缺人",
  full: "满员",
  cancelled: "已散",
  expired: "已结束",
};

// 公众平台模板：游戏组局即将发车
// 字段 thing5 日程标题 / time6 开始时间 / thing11 备注
const SUBSCRIBE_TMPL_ID = "6CGZ2ttjMY5Dl_PC2TrrXmrF-KT8awGU7SLPHif2EJ4";

module.exports = {
  PLATFORMS,
  VOICES,
  STATUS_TEXT,
  SUBSCRIBE_TMPL_ID,
  MAX_TEAM_HOURS,
  APP_VERSION,
  FEEDBACK_KINDS,
  FEEDBACK_PAGES,
  FEEDBACK_TEMPLATE,
};
