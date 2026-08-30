import { describe, expect, it, vi } from 'vitest';

import type {
	DevicesHomeyPluginAdoptionResultSchema,
	DevicesHomeyPluginCloudAuthorizationStartSchema,
	DevicesHomeyPluginInventoryDeviceSchema,
	DevicesHomeyPluginMappingPreviewSchema,
	DevicesHomeyPluginStatusSchema,
} from '../../../openapi.constants';
import { DevicesHomeyValidationException } from '../devices-homey.exceptions';

import {
	transformHomeyAdoptionResult,
	transformHomeyCloudAuthorizationStart,
	transformHomeyInventoryDevice,
	transformHomeyMappingPreview,
	transformHomeyStatus,
} from './homey.transformers';

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

	it('normalizes cloud authorization transaction fields', () => {
		expect(
			transformHomeyCloudAuthorizationStart({
				authorize_url: 'https://api.athom.com/oauth2/authorise',
				transaction_id: 'opaque-transaction',
				expires_at: '2026-08-30T12:00:00.000Z',
			} as DevicesHomeyPluginCloudAuthorizationStartSchema)
		).toEqual({
			authorizeUrl: 'https://api.athom.com/oauth2/authorise',
			transactionId: 'opaque-transaction',
			expiresAt: '2026-08-30T12:00:00.000Z',
		});
	});

	it('rejects a cloud authorization redirect outside the fixed Homey provider', () => {
		expect(() =>
			transformHomeyCloudAuthorizationStart({
				authorize_url: 'https://attacker.example/steal',
				transaction_id: 'opaque-transaction',
				expires_at: '2026-08-30T12:00:00.000Z',
			} as DevicesHomeyPluginCloudAuthorizationStartSchema)
		).toThrow(DevicesHomeyValidationException);
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

	it('accepts null ranges for non-numeric mapping preview properties', () => {
		const result = transformHomeyMappingPreview({
			device: {
				id: 'homey-device',
				name: 'Desk light',
				class: 'light',
				zone_id: null,
				zone_path: ['Office'],
				available: true,
			},
			suggested_category: 'lighting',
			selected_category: 'lighting',
			valid_categories: ['lighting'],
			channels: [
				{
					identifier: 'light',
					mapping_name: 'light',
					mapping_source: 'builtin',
					category: 'light',
					name: 'Light',
					properties: [
						{
							capability_id: 'onoff',
							capability_base_id: 'onoff',
							mapping_name: 'onoff',
							mapping_source: 'builtin',
							category: 'on',
							data_type: 'bool',
							direction: 'bidirectional',
							permissions: ['read', 'write'],
							readable: true,
							writable: true,
							unit: null,
							range: null,
							source_range: null,
							enum_values: [],
							panel_enum_values: [],
							current_value: true,
							value_available: true,
							capability_available: true,
							conversion: {
								type: 'identity',
								reversible: true,
								lossy: false,
								ambiguous: false,
							},
						},
					],
				},
			],
			unsupported_capability_ids: [],
			warnings: [],
			ready_to_adopt: true,
		} as unknown as DevicesHomeyPluginMappingPreviewSchema);

		expect(result.channels[0]?.properties[0]).toEqual(expect.objectContaining({ range: null, sourceRange: null }));
	});

	it('rejects invalid inventory responses', () => {
		expect(() => transformHomeyInventoryDevice({ id: null } as unknown as DevicesHomeyPluginInventoryDeviceSchema)).toThrow(
			DevicesHomeyValidationException
		);
	});
});
