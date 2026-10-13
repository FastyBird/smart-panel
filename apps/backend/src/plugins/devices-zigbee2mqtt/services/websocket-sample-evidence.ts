import { Z2mDeviceStateMetadata } from '../interfaces/zigbee2mqtt.interface';

/** The frontend sends startup cache entries through the same websocket message shape as new reports. */
export function websocketSampleEvidence(
	payload: unknown,
	connectedAt: Date | null,
	receivedAt: Date,
): Pick<Z2mDeviceStateMetadata, 'isCached' | 'sampledAt' | 'qualificationReason'> {
	const raw = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).last_seen : undefined;
	const sampledAt = typeof raw === 'string' || typeof raw === 'number' ? new Date(raw) : null;
	if (!sampledAt || !Number.isFinite(sampledAt.getTime())) {
		return { isCached: true, qualificationReason: 'websocket_measurement_timestamp_missing_or_invalid' };
	}
	if (!connectedAt || sampledAt.getTime() <= connectedAt.getTime() || sampledAt.getTime() > receivedAt.getTime()) {
		return { isCached: true, sampledAt, qualificationReason: 'websocket_measurement_not_proven_after_connection' };
	}
	return { isCached: false, sampledAt, qualificationReason: 'websocket_post_connection_measurement_timestamp' };
}
