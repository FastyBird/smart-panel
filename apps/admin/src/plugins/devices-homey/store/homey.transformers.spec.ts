import { describe, expect, it, vi } from 'vitest';

import type {
	DevicesHomeyPluginAdoptionResultSchema,
	DevicesHomeyPluginInventoryDeviceSchema,
	DevicesHomeyPluginStatusSchema,
} from '../../../openapi.constants';
import { DevicesHomeyValidationException } from '../devices-homey.exceptions';

import { transformHomeyAdoptionResult, transformHomeyInventoryDevice, transformHomeyStatus } from './homey.transformers';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');
	return { ...actual, logger: { error: vi.fn() } };
});

describe('Homey transformers', () => {
	it('normalizes generated inventory responses without losing full capability IDs', () => {
		const result = transformHomeyInventoryDevice({
			id: 'homey-device',
			name: 'Desk light',
			class: 'light',
			zone_id: 'office',
			zone_name: 'Office',
			zone_path: ['Ground floor', 'Office'],
			available: true,
			capabilities: [
				{
					id: 'measure_temperature.inside',
					base_id: 'measure_temperature',
					type: 'number',
					unit: '°C',
					readable: true,
					writable: false,
				},
			],
			support_state: 'supported',
			support_reasons: [],
			suggested_category: 'lighting',
			adopted: false,
		} as DevicesHomeyPluginInventoryDeviceSchema);

		expect(result.zonePath).toEqual(['Ground floor', 'Office']);
		expect(result.capabilities[0].id).toBe('measure_temperature.inside');
		expect(result.suggestedCategory).toBe('lighting');
	});

	it('normalizes operational status counters and timestamps', () => {
		const result = transformHomeyStatus({
			service_state: 'started',
			connection_state: 'connected',
			enabled: true,
			configured: true,
			healthy: true,
			degraded: false,
			last_inventory_sync_at: '2026-08-24T12:00:00.000Z',
			adopted_device_count: 3,
			missing_device_count: 0,
			unsupported_device_count: 1,
			unavailable_device_count: 2,
			reconnect_count: 4,
			reconciliation_count: 5,
			reconciliation_failure_count: 0,
		} as DevicesHomeyPluginStatusSchema);

		expect(result.connectionState).toBe('connected');
		expect(result.lastInventorySyncAt).toBe('2026-08-24T12:00:00.000Z');
		expect(result.unavailableDeviceCount).toBe(2);
	});

	it('normalizes adoption results', () => {
		expect(
			transformHomeyAdoptionResult({
				device_id: 'homey-device',
				status: 'failed',
				failure_code: 'unsupported_mapping',
				message: 'No compatible mapping is available.',
			} as DevicesHomeyPluginAdoptionResultSchema)
		).toEqual({
			deviceId: 'homey-device',
			status: 'failed',
			failureCode: 'unsupported_mapping',
			message: 'No compatible mapping is available.',
		});
	});

	it('rejects invalid inventory responses', () => {
		expect(() => transformHomeyInventoryDevice({ id: null } as unknown as DevicesHomeyPluginInventoryDeviceSchema)).toThrow(
			DevicesHomeyValidationException
		);
	});
});
