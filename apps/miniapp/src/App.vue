<script setup lang="ts">
import { onLaunch, onError } from '@dcloudio/uni-app';
import { useAppStore } from './stores/app';
import { callTeam } from './api/team';
import { capabilities } from './platform/host';
import { wechatCloud } from './platform/wechat';
import { isSinglePage } from './utils/runtime';

onLaunch((options) => {
  const store = useAppStore();
  if (isSinglePage(options)) return;
  if (capabilities.wechatCloud) wechatCloud().init({ env: store.env, traceUser: true });
  // Non-WeChat platforms log in when a business action requires a session.
  if (capabilities.wechatCloud)
    void callTeam('getProfile')
      .then((result) => {
        store.user = result.user as typeof store.user;
        store.isAdmin = !!result.isAdmin;
        store.isOrganizer = !!result.isOrganizer;
      })
      .catch(() => {});
});
onError((error) => {
  useAppStore().lastError = String(error || '').slice(0, 500);
});
</script>
