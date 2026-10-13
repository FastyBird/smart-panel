import { describe, expect, it } from 'vitest';

import { VirtualDeviceCreateReqSchema, VirtualDeviceModeSchema, VirtualDeviceResSchema, VirtualDeviceSchema } from './devices.store.schemas';

describe('virtual device mode rollout', () => {
	it('defaults omitted legacy mode to projection and parses every published producer mode', () => {
		expect(VirtualDeviceSchema.shape.mode.parse(undefined)).toBe('projection');
		for (const mode of ['projection', 'sensor_aggregate', 'actuator_group', 'climate_controller', 'sensor_transform'])
			expect(VirtualDeviceModeSchema.parse(mode)).toBe(mode);
	});

	it('rejects unknown mode values and reserves later runtimes from current authoring', () => {
		expect(VirtualDeviceModeSchema.safeParse('other').success).toBe(false);
		const base = { id: '6e2c6001-4d1d-4561-a1b0-960d4af6c2e8', type: 'virtual', category: 'sensor', name: 'Sensor' };
		expect(VirtualDeviceCreateReqSchema.safeParse({ ...base, mode: 'climate_controller' }).success).toBe(false);
		expect(
			VirtualDeviceResSchema.safeParse({
				...base,
				identifier: null,
				description: null,
				enabled: true,
				hidden: false,
				hidden_by: null,
				room_id: null,
				zone_ids: [],
				status: { online: false, status: 'unknown' },
				updated_at: null,
				created_at: '2026-10-13',
				controls: [],
				channels: [],
				future_field: 'ignored',
			}).success
		).toBe(true);
	});
});
