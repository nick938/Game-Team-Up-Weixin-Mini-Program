import type { PageEvent } from '../types/domain';

/** Preserve typed objects passed by the template; native datasets may stringify them. */
export function eventWithDataset(event: unknown, dataset: Record<string, unknown> = {}): PageEvent {
  const source = event as { detail?: object; currentTarget?: { dataset?: object } };
  return {
    detail: source.detail || {},
    currentTarget: { dataset: { ...source.currentTarget?.dataset, ...dataset } },
  } as PageEvent;
}
