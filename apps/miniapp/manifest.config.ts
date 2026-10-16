// Adapted from unibest base; platform AppIDs belong to their own applications.
import { defineManifestConfig } from '@uni-helper/vite-plugin-uni-manifest';
import pkg from './package.json';
const version = process.env.MINIAPP_VERSION || pkg.version;
export default defineManifestConfig({
  "name": "开黑星球｜游戏搭子",
  "description": "游戏搭子组队",
  "appid": "",
  "versionName": version,
  "versionCode": String(version.split('.').reduce((code, part) => code * 1000 + Number(part), 0)),
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
    "sitemapLocation": "static/sitemap.json",
    "appid": process.env.VITE_WEIXIN_APP_ID || "wxa1af4fb6a4c66334",
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
