import type { Result } from '../api/client';
interface CloudApi {
  init(input: { env: string; traceUser: boolean }): void;
  callFunction(input: { name: string; data: Record<string, unknown> }): Promise<{ result: Result }>;
  uploadFile(input: { cloudPath: string; filePath: string }): Promise<{ fileID: string }>;
}
declare const wx: { cloud: CloudApi };
export function wechatCloud(): CloudApi {
  let cloud: CloudApi | undefined;
  // #ifdef MP-WEIXIN
  cloud = (wx as unknown as { cloud: CloudApi }).cloud;
  // #endif
  if (!cloud) throw new Error('当前平台暂不可用');
  return cloud;
}
