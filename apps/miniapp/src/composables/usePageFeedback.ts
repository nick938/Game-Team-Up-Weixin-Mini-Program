import { useToast } from '@wot-ui/ui/components/wd-toast';
import { useDialog } from '@wot-ui/ui/components/wd-dialog';

/** Each page owns feedback state; AppShell renders the matching Wot hosts. */
export function usePageFeedback() {
  const toast = useToast();
  const dialog = useDialog();
  function showError(error: unknown) {
    toast.error(error instanceof Error ? error.message : '出错了，请稍后重试');
  }
  return { toast, dialog, showError };
}
