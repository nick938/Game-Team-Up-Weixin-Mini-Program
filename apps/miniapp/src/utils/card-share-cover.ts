import type { Team } from '../types/domain';
import { platform } from '../platform/host';
import { renderTeamCover, type ShareCanvas } from './team-cover';

// One canvas per page, drawn only for the card being shared. Serialize exports
// so a second share cannot overwrite a canvas while its first image is saving.
let rendering: Promise<unknown> = Promise.resolve();
export function renderCardShareCover(team: Partial<Team>) {
  const result = rendering.then(async () => {
    const canvas = await new Promise<ShareCanvas | null>((resolve) => {
      if (typeof platform.createSelectorQuery !== 'function') return resolve(null);
      platform
        .createSelectorQuery()
        .select('#cardShareCover')
        .fields({ node: true, size: true }, () => {})
        .exec((res) => resolve(res?.[0]?.node || null));
    });
    if (!canvas) throw new Error('Card share canvas unavailable');
    let dpr = 1;
    try {
      dpr = platform.getWindowInfo?.().pixelRatio || platform.getSystemInfoSync?.().pixelRatio || 1;
    } catch {
      // Keep sharing available on older host versions.
    }
    return renderTeamCover(canvas, team, dpr, 'cardShareCover');
  });
  rendering = result.catch(() => {});
  return result;
}
