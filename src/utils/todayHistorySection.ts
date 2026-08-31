/**
 * Today tab history block visibility — keeps active-only state free of empty copy.
 */

export type TodayHistorySectionMode = 'hidden' | 'empty' | 'list';

/**
 * When an active episode exists but no completed episodes, hide the lower block.
 * Empty state only when there is no active episode and no history.
 */
export function getTodayHistorySectionMode(
	hasActiveEpisode: boolean,
	completedCount: number
): TodayHistorySectionMode {
	if (completedCount > 0) {
		return 'list';
	}
	if (!hasActiveEpisode) {
		return 'empty';
	}
	return 'hidden';
}
