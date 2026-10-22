import type { TeamRequests, TeamResponse } from '../types/domain';
import { ApiError, checked, createTeamClient, type Request, type Result } from './client';
import { buildTarget, loginCode } from '../platform/host';
import { wechatCloud } from '../platform/wechat';
import { useAppStore } from '../stores/app';

export function apiBaseURL(): string {
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  if (!/^https:\/\/[^/?#]+(?:\/[^?#]*)?$/.test(base))
    throw new ApiError('当前平台服务尚未接入，请稍后再试', 'API_NOT_CONFIGURED');
  return base;
}
export const request: Request = (path, data, token) =>
  new Promise((resolve, reject) => {
    let base: string;
    try {
      base = apiBaseURL();
    } catch (error) {
      reject(error);
      return;
    }
    uni.request({
      url: base + path,
      method: 'POST',
      data,
      timeout: 15000,
      header: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      success(response) {
        if (response.statusCode === 401) {
          reject(new ApiError('登录已过期，请重试', 'UNAUTHENTICATED'));
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new ApiError('请求失败，请稍后重试'));
          return;
        }
        if (!response.data || typeof response.data !== 'object') {
          reject(new ApiError('服务响应异常'));
          return;
        }
        resolve(response.data as Result);
      },
      fail() {
        reject(new ApiError('网络连接失败，请稍后重试'));
      },
    });
  });
let client: ReturnType<typeof createTeamClient> | undefined;
export function teamClient() {
  client ||= createTeamClient({
    target: buildTarget,
    state: useAppStore(),
    request,
    loginCode: () => {
      apiBaseURL();
      return loginCode();
    },
    nativeCall: async (type, data) =>
      (await wechatCloud().callFunction({ name: 'team', data: { ...data, type } })).result,
  });
  return client;
}
export function callTeam<K extends keyof TeamRequests>(
  action: K,
  ...args: TeamRequests[K] extends undefined ? [data?: Record<string, never>] : [data: TeamRequests[K]]
): Promise<TeamResponse<K>> {
  return teamClient().call(action, (args[0] || {}) as Record<string, unknown>) as unknown as Promise<
    TeamResponse<K>
  >;
}

export async function uploadAvatar(filePath: string): Promise<string> {
  if (buildTarget === 'mp-weixin') {
    const uploaded = await wechatCloud().uploadFile({
      filePath,
      cloudPath: `avatars/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`,
    });
    if (!uploaded.fileID) throw new ApiError('头像上传失败');
    return uploaded.fileID;
  }
  const base = apiBaseURL();
  await teamClient().ensureSession();
  const token = useAppStore().session?.accessToken;
  return new Promise((resolve, reject) =>
    uni.uploadFile({
      url: base + '/v1/media/avatar',
      filePath,
      name: 'file',
      header: { Authorization: `Bearer ${token}` },
      success(response) {
        try {
          if (response.statusCode !== 200) throw new ApiError('头像上传失败，请重试');
          const result = checked(JSON.parse(response.data) as Result);
          if (typeof result.fileID !== 'string' || !result.fileID.startsWith('cloud://'))
            throw new ApiError('头像上传失败');
          resolve(result.fileID);
        } catch (error) {
          reject(error);
        }
      },
      fail() {
        reject(new ApiError('头像上传失败，请重试'));
      },
    }),
  );
}
