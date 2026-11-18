/** The binding limit for a maximum sample age. */
const MAXIMUM_AGE_LIMIT_SECONDS = 86_400;

/**
 * A maximum sample age that suits a source's observed reporting: the longest gap between reports
 * plus half of it, so one late report does not make the input stale, rounded up to whole minutes
 * and kept within 60 s .. 24 h.
 */
export function recommendedMaximumAgeSeconds(longestIntervalMs: number): number | null {
	if (!Number.isFinite(longestIntervalMs) || longestIntervalMs <= 0) return null;
	const minutes = Math.ceil((longestIntervalMs * 1.5) / 60_000);
	return Math.min(MAXIMUM_AGE_LIMIT_SECONDS, Math.max(60, minutes * 60));
}
