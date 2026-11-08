const seeds = require('./profile-options.json').groups;

function createGroups(db) {
  async function read(source = db) {
    try {
      const { data } = await source.collection('app_config').doc('groups').get();
      if (data) return { groups: data.groups, revision: data.revision };
    } catch (error) {
      if (!/not exist|not found|不存在/i.test(String(error.errMsg || error.message))) throw error;
    }
    return { groups: seeds.map(group => ({ ...group, enabled: true })), revision: 0 };
  }
  async function save(input, actor) {
    if (!input || typeof input.label !== 'string' || !input.label.trim() || input.label.trim().length > 40 ||
        typeof input.enabled !== 'boolean' || !Number.isInteger(input.revision) ||
        typeof input.value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(input.value)) {
      throw new Error('群组名称需为1–40字，请刷新后重试');
    }
    return db.runTransaction(async tx => {
      const current = await read(tx);
      if (current.revision !== input.revision) throw new Error('群组已被其他管理员修改，请刷新后重试');
      const label = input.label.trim();
      if (current.groups.some(group => group.value !== input.value && group.label === label)) throw new Error('群组名称已存在');
      const index = current.groups.findIndex(group => group.value === input.value);
      if (index < 0 && current.groups.length >= 200) throw new Error('群组最多200个');
      const group = { value: input.value, label, enabled: input.enabled };
      const groups = [...current.groups];
      if (index < 0) groups.push(group);
      else groups[index] = group;
      const result = { groups, revision: current.revision + 1 };
      await tx.collection('app_config').doc('groups').set({ data: { ...result, updatedBy: actor, updatedAt: Date.now() } });
      return result;
    });
  }
  return { read, save };
}
module.exports = { createGroups };
