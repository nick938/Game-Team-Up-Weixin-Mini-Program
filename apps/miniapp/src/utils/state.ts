import { nextTick } from 'vue';

// First migration keeps the existing event handlers; updates go through Vue's reactive data.
export function updateState(this: { $data: Record<string, unknown> }, values: Record<string, unknown>, done?: () => void) {
  Object.assign(this.$data, values);
  if (done) void nextTick(done);
}

export function eventWithDataset(event: { detail?: unknown; currentTarget?: { dataset?: Record<string, unknown> }; target?: unknown }, dataset: Record<string, unknown> = {}) {
  return { detail: event.detail || {}, currentTarget: { dataset: { ...event.currentTarget?.dataset, ...dataset } }, target: event.target };
}
