import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FormResult } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

import { useDeviceAddForm } from './useDeviceAddForm';

const mockAdd = vi.fn();

const backendClient = {
	POST: vi.fn(),
};

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: () => ({
			getStore: () => ({
				add: mockAdd,
			}),
		}),
		useFlashMessage: () => ({
			success: vi.fn(),
			error: vi.fn(),
		}),
		useBackend: () => ({
			client: backendClient,
		}),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
	};
});

const DEVICE_INFO_RESPONSE = {
	id: 'shellyplus1-a1b2',
	name: 'Living room',
	mac: 'A1B2C3D4E5F6',
	model: 'SNSW-001X16EU',
	firmware: '1.4.4',
	app: 'Plus1',
	authentication: { domain: null, enabled: false },
	discoverable: true,
	components: [],
};

const DEVICE_INFO = { ...DEVICE_INFO_RESPONSE } as unknown as NonNullable<ReturnType<typeof useDeviceAddForm>['deviceInfo']['value']>;

describe('useDeviceAddForm', () => {
	let form: ReturnType<typeof useDeviceAddForm>;

	const deviceId = uuid().toString();

	beforeEach(() => {
		vi.clearAllMocks();
		form = useDeviceAddForm({ id: deviceId.toString() });
		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
			validateField: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;
	});

	it('should initialize with default values', () => {
		expect(form.model.id).toBe(deviceId.toString());
		expect(form.model.name).toBe('');
		expect(form.model.hostname).toBe('');
		expect(form.model.password).toBe('');
		expect(form.model.category).toBe(DevicesModuleDeviceCategory.generic);
	});

	it('should mark form as changed when model updates', async () => {
		expect(form.formChanged.value).toBe(false);

		form.model.name = 'New Device';
		await nextTick();

		expect(form.formChanged.value).toBe(true);
	});

	it('adds a tested device without reading it again', async () => {
		form.model.name = 'New Device';
		form.model.hostname = '192.168.0.1';

		// A changed hostname forgets the last test, so the test comes after it
		await nextTick();

		form.deviceInfo.value = DEVICE_INFO;

		await nextTick();

		await form.submit();

		expect(backendClient.POST).not.toHaveBeenCalled();
		expect(mockAdd).toHaveBeenCalledWith({
			id: deviceId.toString(),
			draft: false,
			data: expect.objectContaining({
				type: DEVICES_SHELLY_NG_TYPE,
				id: deviceId.toString(),
				name: 'New Device',
				identifier: 'shellyplus1-a1b2',
				wifiAddress: '192.168.0.1',
			}),
		});
		expect(form.formResult.value).toBe(FormResult.OK);
	});

	it('reads an untested device first, then adds it', async () => {
		backendClient.POST.mockResolvedValueOnce({ data: { data: DEVICE_INFO_RESPONSE }, error: undefined, response: { status: 200 } });
		form.model.name = 'New Device';
		form.model.hostname = '192.168.0.1';

		await form.submit();

		expect(backendClient.POST).toHaveBeenCalledTimes(1);
		expect(form.deviceInfo.value?.model).toBe('SNSW-001X16EU');
		expect(mockAdd).toHaveBeenCalledTimes(1);
	});

	it('adds nothing when the device cannot be read', async () => {
		backendClient.POST.mockResolvedValueOnce({ data: undefined, error: { error: { message: 'Not found' } }, response: { status: 404 } });
		form.model.name = 'New Device';
		form.model.hostname = '192.168.0.1';

		await expect(form.submit()).rejects.toThrow();

		expect(mockAdd).not.toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.ERROR);
	});

	it('tests the connection without a toast, returning the reason it failed', async () => {
		backendClient.POST.mockResolvedValueOnce({ data: undefined, error: undefined, response: { status: 500 } });
		form.model.hostname = '192.168.0.1';

		await expect(form.checkDevice()).rejects.toThrow('devicesShellyNgPlugin.messages.devices.notChecked');

		expect(form.formResult.value).toBe(FormResult.NONE);
	});
});
