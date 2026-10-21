import { computed, ref } from 'vue';
import type { User } from '../types/domain';
import { platform } from '../platform/host';
import { usePageFeedback } from './usePageFeedback';

export function useProfileContacts(user: () => User | null) {
  const { toast } = usePageFeedback();
  const copying = ref(false);
  const contacts = computed(() =>
    [
      { key: 'steamFriendCode', label: 'Steam 好友码', value: user()?.steamFriendCode || '' },
      { key: 'wechatId', label: '微信 ID', value: user()?.wechatId || '' },
    ].filter((item) => item.value),
  );
  function copyContact(key: string) {
    const item = contacts.value.find((contact) => contact.key === key);
    if (!item || copying.value) return;
    copying.value = true;
    platform.setClipboardData({
      data: item.value,
      showToast: false,
      success() {
        toast.success(`已复制${item.label}`);
      },
      fail() {
        toast.error('复制失败，请重试');
      },
      complete() {
        copying.value = false;
      },
    });
  }
  return { contacts, copyContact };
}
