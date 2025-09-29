import { nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSupportedDevices } from './useSupportedDevices';

const backendClient = {
	GET: vi.fn(),
};

const flash = {
	error: vi.fn(),
};

const transformSupportedDevicesResponse = vi.fn();

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({
			client: backendClient,
		}),
		useFlashMessage: () => flash,
		getErrorReason: vi.fn().mockImplementation((_error, fallback: string) => fallback ?? 'fallback'),
	};
});

vi.mock('../utils/devices.transformers', () => ({
	transformSupportedDevicesResponse: (response: object[]) => transformSupportedDevicesResponse(response),
}));

describe('useSupportedDevices', () => {
	beforeEach(() => {
		backendClient.GET.mockReset();
		flash.error.mockReset();
		transformSupportedDevicesResponse.mockReset();
	});

	it('exposes default refs', () => {
		const { supportedDevices, loaded, fetchDevices } = useSupportedDevices();
		expect(Array.isArray(supportedDevices.value)).toBe(true);
		expect(supportedDevices.value.length).toBe(0);
		expect(loaded.value).toBe(false);
		expect(typeof fetchDevices).toBe('function');
	});

	it('fetches and stores supported devices on success, marks loaded=true', async () => {
		const apiPayload = { data: [{ group: 'G', name: 'Device', models: [], categories: [], components: [], system: [] }] };
		const transformed = [{ group: 'G', name: 'Device X' }];

		backendClient.GET.mockResolvedValueOnce({
			data: { data: apiPayload.data },
			error: undefined,
			response: { status: 200 },
		});

		transformSupportedDevicesResponse.mockReturnValueOnce(transformed);

		const { supportedDevices, loaded, fetchDevices } = useSupportedDevices();

		await fetchDevices();
		await nextTick();

		expect(backendClient.GET).toHaveBeenCalledTimes(1);
		expect(backendClient.GET).toHaveBeenCalledWith('/plugins/devices-shelly-ng/devices/supported', {});
		expect(transformSupportedDevicesResponse).toHaveBeenCalledWith(apiPayload.data);
		expect(supportedDevices.value).toEqual(transformed);
		expect(loaded.value).toBe(true);
		expect(flash.error).not.toHaveBeenCalled();
	});

	it('does not fetch again if already loaded and force=false', async () => {
		backendClient.GET.mockResolvedValueOnce({
			data: { data: [] },
			error: undefined,
			response: { status: 200 },
		});

		transformSupportedDevicesResponse.mockReturnValueOnce([]);

		const { fetchDevices } = useSupportedDevices();

		await fetchDevices();
		await nextTick();

		await fetchDevices();
		await nextTick();

		expect(backendClient.GET).toHaveBeenCalledTimes(1);
	});

	it('fetches again when force=true even if already loaded', async () => {
		backendClient.GET.mockResolvedValueOnce({
			data: { data: [] },
			error: undefined,
			response: { status: 200 },
		});

		transformSupportedDevicesResponse.mockReturnValue([]);

		const { fetchDevices } = useSupportedDevices();

		await fetchDevices();
		await nextTick();

		backendClient.GET.mockResolvedValueOnce({
			data: { data: [] },
			error: undefined,
			response: { status: 200 },
		});

		await fetchDevices(true);
		await nextTick();

		expect(backendClient.GET).toHaveBeenCalledTimes(2);
	});

	it('shows specific error on 422 using getErrorReason', async () => {
		backendClient.GET.mockResolvedValueOnce({
			data: undefined,
			error: { detail: 'validation' },
			response: { status: 422 },
		});

		const { fetchDevices } = useSupportedDevices();

		await fetchDevices();
		await nextTick();

		expect(flash.error).toHaveBeenCalledTimes(1);
		expect(flash.error).toHaveBeenCalledWith('Failed to fetch supported devices.');
	});

	it('shows generic i18n error message for non-422 errors', async () => {
		backendClient.GET.mockResolvedValueOnce({
			data: undefined,
			error: { detail: 'boom' },
			response: { status: 500 },
		});

		const { fetchDevices } = useSupportedDevices();

		await fetchDevices();
		await nextTick();

		expect(flash.error).toHaveBeenCalledTimes(1);
		expect(flash.error).toHaveBeenCalledWith('devicesShellyNgPlugin.messages.devices.failedLoadSupportedDevices');
	});
});
