const { createHash } = require('node:crypto');

const PROVIDERS = new Set(['weixin', 'qq']);

function identityError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function validSubject(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 256
    && !/[\s\u0000-\u001f\u007f]/.test(value);
}

// 这是已验证身份的存储键，不是登录令牌，也不把平台 OpenID 当作内部 userId。
function identityKey({ provider, appId, subject } = {}) {
  if (!PROVIDERS.has(provider) || !validSubject(appId) || !validSubject(subject)) {
    throw identityError('INVALID_IDENTITY');
  }
  return 'identity_v1_' + createHash('sha256').update(JSON.stringify([provider, appId, subject])).digest('hex');
}

function createWechatIdentityResolver({ getTrustedContext, expectedAppId, findIdentity } = {}) {
  if (typeof getTrustedContext !== 'function' || typeof findIdentity !== 'function'
      || !validSubject(expectedAppId)) {
    throw identityError('INVALID_AUTH_CONFIGURATION');
  }
  return Object.freeze({
    // 不接收 HTTP body、query、headers 或 event；上下文只能来自服务端注入的 SDK。
    async currentActor() {
      const context = await getTrustedContext();
      if (!context || !validSubject(context.APPID) || !validSubject(context.OPENID)) {
        throw identityError('AUTH_CONTEXT_REQUIRED');
      }
      if (context.APPID !== expectedAppId) throw identityError('APP_NOT_ALLOWED');
      const verified = Object.freeze({ provider: 'weixin', appId: context.APPID, subject: context.OPENID });
      const key = identityKey(verified);
      const record = await findIdentity(key);
      // 首阶段不自动创建/回填生产身份，不允许未关联用户被默认认领。
      if (!record) throw identityError('IDENTITY_NOT_LINKED');
      if (record.identityKey !== key || record.provider !== verified.provider
          || record.appId !== verified.appId || record.subject !== verified.subject
          || typeof record.userId !== 'string' || !/^u_[0-9a-f]{32}$/.test(record.userId)) {
        throw identityError('IDENTITY_CONFLICT');
      }
      // 角色必须由业务层重新核验；不复制映射记录中的 isAdmin/roles/封禁字段。
      return Object.freeze({
        userId: record.userId,
        provider: 'weixin',
        appId: verified.appId,
        legacyOpenId: verified.subject,
      });
    },
  });
}

module.exports = { identityKey, createWechatIdentityResolver };
