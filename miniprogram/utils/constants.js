const PLATFORMS = ["Steam", "手游", "端游", "主机"];
const VOICES = ["不限", "KOOK", "游戏内语音", "开麦"];

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
};
