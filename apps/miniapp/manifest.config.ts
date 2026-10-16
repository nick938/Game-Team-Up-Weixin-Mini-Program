// Adapted from unibest base; platform AppIDs belong to their own applications.
import { defineManifestConfig } from '@uni-helper/vite-plugin-uni-manifest';
export default defineManifestConfig({
  "name": "开黑星球｜游戏搭子",
  "description": "游戏搭子组队",
  "appid": "",
  "versionName": "0.1.0",
  "versionCode": "1",
  "vueVersion": "3",
  "uniStatistics": {
    "enable": false
  },
  "h5": {
    "router": {
      "mode": "hash"
    }
  },
  "mp-weixin": {
    "appid": "wxa1af4fb6a4c66334",
    "setting": {
      "urlCheck": true
    }
  },
  "mp-qq": {
    "appid": process.env.VITE_QQ_APP_ID || ""
  },
  "mp-alipay": {
    "appid": ""
  },
  "mp-toutiao": {
    "appid": ""
  }
});
