import { onMounted, onUnmounted, ref } from 'vue';
export function useKeyboardVisible() {
  const visible = ref(false);
  const changed = (event: { height: number }) => {
    visible.value = event.height > 0;
  };
  onMounted(() => {
    if (typeof uni.onKeyboardHeightChange === 'function') uni.onKeyboardHeightChange(changed);
  });
  onUnmounted(() => {
    if (typeof uni.offKeyboardHeightChange === 'function') uni.offKeyboardHeightChange(changed);
  });
  return visible;
}
