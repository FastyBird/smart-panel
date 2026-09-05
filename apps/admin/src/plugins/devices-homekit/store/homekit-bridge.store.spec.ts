import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesHomeKitApiException } from '../devices-homekit.exceptions';

import { useHomeKitBridge } from './homekit-bridge.store';

const get = vi.fn();
const post = vi.fn();

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({ client: { GET: get, POST: post } }),
		getErrorReason: () => 'Sanitized HomeKit request failure',
	};
});

const mockBridgeStatusResponse = {
	data: {
		data: {
			running: true,
			paired: false,
			paired_clients_count: 0,
			bridge_name: 'Smart Panel Bridge',
			port: 51826,
			pincode: '031-45-154',
			username: 'CC:22:3D:E3:CE:30',
			setup_uri: 'X-HM://0024R932WSP01',
			qr_code_data_uri: 'data:image/svg+xml;utf8,<svg></svg>',
			exposed_devices_count: 2,
		},
	},
	response: { status: 200 },
};

const mockCandidatesResponse = {
	data: {
		data: [
			{
				id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
				name: 'Living Room Light',
				category: 'lighting',
				room_name: 'Living Room',
				room_id: 'a123f1ee-6c54-4b01-90e6-d701748f0899',
				is_compatible: true,
				suggested_service_type: 'lightbulb',
				is_mapped: true,
				channels_count: 1,
			},
			{
				id: 'e390f1ee-6c54-4b01-90e6-d701748f0852',
				name: 'Kitchen Thermostat',
				category: 'thermostat',
				room_name: 'Kitchen',
				room_id: 'b123f1ee-6c54-4b01-90e6-d701748f0899',
				is_compatible: true,
				suggested_service_type: 'thermostat',
				is_mapped: false,
				channels_count: 1,
			},
		],
	},
	response: { status: 200 },
};

describe('HomeKit Bridge Store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
	});

	it('fetches bridge status successfully', async () => {
		get.mockResolvedValueOnce(mockBridgeStatusResponse);
		const store = useHomeKitBridge();

		const status = await store.fetchStatus();

		expect(status.running).toBe(true);
		expect(status.bridgeName).toBe('Smart Panel Bridge');
		expect(status.pincode).toBe('031-45-154');
		expect(status.exposedDevicesCount).toBe(2);
		expect(store.status).toEqual(status);
	});

	it('throws DevicesHomeKitApiException when fetching bridge status fails', async () => {
		get.mockResolvedValueOnce({ data: undefined, error: { message: 'Server error' }, response: { status: 500 } });
		const store = useHomeKitBridge();

		await expect(store.fetchStatus()).rejects.toThrow(DevicesHomeKitApiException);
	});

	it('fetches device candidates successfully', async () => {
		get.mockResolvedValueOnce(mockCandidatesResponse);
		const store = useHomeKitBridge();

		const candidates = await store.fetchCandidates();

		expect(candidates).toHaveLength(2);
		expect(candidates[0].name).toBe('Living Room Light');
		expect(candidates[0].isCompatible).toBe(true);
		expect(candidates[0].isMapped).toBe(true);
		expect(store.candidates).toEqual(candidates);
	});

	it('maps devices successfully', async () => {
		post.mockResolvedValueOnce(mockCandidatesResponse);
		const store = useHomeKitBridge();

		const result = await store.mapDevices(['d290f1ee-6c54-4b01-90e6-d701748f0851']);

		expect(post).toHaveBeenCalledWith(
			'/plugins/devices-homekit/bridge/candidates/map',
			expect.objectContaining({
				body: {
					data: {
						device_ids: ['d290f1ee-6c54-4b01-90e6-d701748f0851'],
					},
				},
			})
		);
		expect(result).toHaveLength(2);
	});

	it('resets pairing successfully', async () => {
		post.mockResolvedValueOnce(mockBridgeStatusResponse);
		const store = useHomeKitBridge();

		const result = await store.resetPairing();

		expect(post).toHaveBeenCalledWith('/plugins/devices-homekit/bridge/reset-pairing');
		expect(result.running).toBe(true);
		expect(store.status).toEqual(result);
	});
});
