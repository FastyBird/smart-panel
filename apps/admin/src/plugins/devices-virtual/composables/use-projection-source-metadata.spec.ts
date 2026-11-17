import { computed, nextTick, ref, watchEffect } from 'vue';

import { describe, expect, it } from 'vitest';

import type { IChannel, IChannelProperty, IDevice } from '../../../modules/devices';

import { useProjectionSourceMetadata } from './use-projection-source-metadata';

const fixture = (count = 1) => {
	const device = {
		id: 'device',
		name: 'Relay',
		type: 'physical',
		draft: false,
		hidden: false,
		hiddenBy: null,
		roomId: 'room',
		zoneIds: ['zone'],
	} as IDevice;
	const channel = { id: 'channel', device: 'device', name: 'Relay 1', category: 'switcher' } as IChannel;
	const property = {
		id: 'property',
		channel: 'channel',
		name: 'On',
		category: 'on',
		dataType: 'bool',
		permissions: ['rw'],
		format: null,
		step: null,
		unit: null,
		value: { value: false, lastUpdated: null, trend: null },
	} as IChannelProperty;
	const devices = ref<Record<string, IDevice>>({ device });
	const channels = ref<Record<string, IChannel>>({ channel });
	const properties = ref<Record<string, IChannelProperty>>(
		Object.fromEntries(Array.from({ length: count }, (_, index) => [`p${index}`, { ...property, id: `p${index}` }]))
	);
	const metadata = useProjectionSourceMetadata(
		{ findAll: () => Object.values(devices.value) },
		{ findAll: () => Object.values(channels.value) },
		{ findAll: () => Object.values(properties.value) }
	);
	return { devices, channels, properties, metadata };
};

describe('projection source metadata isolation', () => {
	it('keeps the catalogue identity stable through immutable telemetry updates on a large installation', async () => {
		const { devices, properties, metadata } = fixture(4096);
		let catalogues = 0;
		const stop = watchEffect(() => {
			void metadata.snapshot.value;
			catalogues++;
		});
		const initial = metadata.snapshot.value;
		for (let tick = 0; tick < 10; tick++) {
			properties.value.p0 = { ...properties.value.p0, value: { value: !!(tick % 2), lastUpdated: new Date().toISOString(), trend: null } };
			devices.value.device = { ...devices.value.device, status: { ...devices.value.device.status, online: !!(tick % 2) }, updatedAt: new Date() };
			await nextTick();
		}
		expect(metadata.snapshot.value).toBe(initial);
		expect(catalogues).toBe(1);
		expect(initial.properties[0]).not.toHaveProperty('value');
		expect(initial.devices[0]).not.toHaveProperty('status');
		stop();
	});

	it('reacts to actual contract and placement changes without subscribing to other device state', async () => {
		const { devices, properties, metadata } = fixture();
		const first = metadata.snapshot.value;
		properties.value.p0.permissions = ['ro'] as IChannelProperty['permissions'];
		await nextTick();
		expect(metadata.snapshot.value).not.toBe(first);
		const second = metadata.snapshot.value;
		devices.value.device.roomId = 'another-room';
		await nextTick();
		expect(metadata.snapshot.value).not.toBe(second);
		// A downstream expensive join is also cached across value-only store replacements.
		let joins = 0;
		const joined = computed(() => {
			joins++;
			return metadata.snapshot.value.properties.map((property) => property.id);
		});
		const result = joined.value;
		properties.value.p0 = { ...properties.value.p0, value: { value: true, lastUpdated: null, trend: null } };
		expect(joined.value).toBe(result);
		expect(joins).toBe(1);
	});
});
