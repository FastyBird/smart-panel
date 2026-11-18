/** Gateway clocks may run slightly ahead of ours; beyond this the source time is not trusted. */
export const SOURCE_TIMESTAMP_MAX_FUTURE_SKEW_MS = 60_000;

/**
 * Parse Zigbee2MQTT's optional `last_seen` (`advanced.last_seen`: ISO_8601, ISO_8601_local or epoch).
 *
 * It is the moment the device last sent a message, persisted by Zigbee2MQTT across restarts, so it
 * times live reports and startup replays alike. Returns null when it is missing, invalid, or too far
 * in the future to trust, and for epoch 0; a small forward skew is capped at the receive time.
 */
export function parseSourceTimestamp(raw: unknown, receivedAt: Date): Date | null {
	if (typeof raw !== 'string' && typeof raw !== 'number') return null;
	const time = new Date(raw).getTime();
	// Zigbee2MQTT reports epoch 0 for a device it has never heard from: not a source time.
	if (!Number.isFinite(time) || time <= 0 || time > receivedAt.getTime() + SOURCE_TIMESTAMP_MAX_FUTURE_SKEW_MS)
		return null;
	return new Date(Math.min(time, receivedAt.getTime()));
}
