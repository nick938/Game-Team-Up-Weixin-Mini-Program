export class ApiError extends Error {
  constructor(
    message: string,
    public code = 'REQUEST_FAILED',
  ) {
    super(message);
  }
}
export type Result = {
  ok: boolean;
  code?: string;
  errMsg?: string;
  message?: string;
  [key: string]: unknown;
};
export type Request = (path: string, body: Record<string, unknown>, token?: string) => Promise<Result>;
export interface Session {
  accessToken: string;
  expiresAt: number;
}
export type SessionState = { session: Session | null };
const READS = new Set([
  'getProfile',
  'getPublicProfile',
  'getTeam',
  'listTeams',
  'myTeams',
  'searchProxyUsers',
]);

export function checked(result: Result): Result {
  if (!result || result.ok !== true)
    throw new ApiError(result?.errMsg || result?.message || '请求失败', result?.code);
  return result;
}

// A client instance owns its session and pending reads. Writes are never retried automatically.
export function createTeamClient(options: {
  target: string;
  request: Request;
  loginCode: () => Promise<string>;
  state: SessionState;
  nativeCall?: (action: string, input: Record<string, unknown>) => Promise<Result>;
}) {
  let authenticating: Promise<void> | null = null;
  const pending = new Map<string, Promise<Result>>();
  async function ensureSession() {
    if (options.target !== 'mp-qq') throw new ApiError('请在微信或 QQ 小程序中使用', 'PLATFORM_UNAVAILABLE');
    if (options.state.session && options.state.session.expiresAt > Date.now() + 30_000) return;
    options.state.session = null;
    if (!authenticating) {
      authenticating = (async () => {
        const code = await options.loginCode();
        const result = checked(await options.request('/v1/auth/qq', { code }));
        if (
          typeof result.accessToken !== 'string' ||
          !result.accessToken ||
          typeof result.expiresAt !== 'number' ||
          result.expiresAt <= Date.now()
        ) {
          throw new ApiError('登录失败，请重试', 'INVALID_SESSION');
        }
        options.state.session = { accessToken: result.accessToken, expiresAt: result.expiresAt };
      })().finally(() => {
        authenticating = null;
      });
    }
    await authenticating;
  }
  async function invoke(action: string, input: Record<string, unknown>) {
    if (options.target === 'mp-weixin' && options.nativeCall)
      return checked(await options.nativeCall(action, input));
    await ensureSession();
    try {
      return checked(await options.request('/v1/rpc', { action, input }, options.state.session!.accessToken));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') options.state.session = null;
      throw error;
    }
  }
  return {
    ensureSession,
    call(action: string, input: Record<string, unknown> = {}) {
      if (!READS.has(action)) return invoke(action, input);
      const key = JSON.stringify([action, input]);
      if (!pending.has(key))
        pending.set(
          key,
          invoke(action, input).finally(() => pending.delete(key)),
        );
      return pending.get(key)!;
    },
  };
}
