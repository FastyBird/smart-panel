import { computed } from 'vue';

import type { IChannel, IChannelProperty, IDevice } from '../../../modules/devices';

type DeviceMetadata = Pick<IDevice, 'id' | 'name' | 'type' | 'draft' | 'hidden' | 'hiddenBy' | 'roomId' | 'zoneIds'> & { mode?: unknown };
type ChannelMetadata = Pick<IChannel, 'id' | 'device' | 'name' | 'category'>;
type PropertyMetadata = Pick<IChannelProperty, 'id' | 'channel' | 'name' | 'category' | 'dataType' | 'permissions' | 'format' | 'step' | 'unit'> & {
	valueOrigin?: unknown;
	sourceProperty?: unknown;
};
interface SourceMetadata {
	devices: DeviceMetadata[];
	channels: ChannelMetadata[];
	properties: PropertyMetadata[];
}

/** Telemetry replaces store records. Only contract changes may invalidate a selector's catalogue. */
export function useProjectionSourceMetadata(
	devices: { findAll: () => DeviceMetadata[] },
	channels: { findAll: () => ChannelMetadata[] },
	properties: { findAll: () => PropertyMetadata[] }
) {
	const signature = computed(() =>
		JSON.stringify({
			devices: devices.findAll().map(({ id, name, type, draft, hidden, hiddenBy, roomId, zoneIds, mode }) => ({
				id,
				name,
				type,
				draft,
				hidden,
				hiddenBy,
				roomId,
				zoneIds,
				mode,
			})),
			channels: channels.findAll().map(({ id, device, name, category }) => ({ id, device, name, category })),
			properties: properties
				.findAll()
				.map(({ id, channel, name, category, dataType, permissions, format, step, unit, valueOrigin, sourceProperty }) => ({
					id,
					channel,
					name,
					category,
					dataType,
					permissions,
					format,
					step,
					unit,
					valueOrigin,
					sourceProperty,
				})),
		})
	);
	// Returning the same signature prevents downstream work on value/status-only events. Parsing
	// also detaches all nested objects, so a select's deep watcher cannot subscribe to telemetry.
	const snapshot = computed<SourceMetadata>(() => JSON.parse(signature.value) as SourceMetadata);
	return { signature, snapshot };
}
