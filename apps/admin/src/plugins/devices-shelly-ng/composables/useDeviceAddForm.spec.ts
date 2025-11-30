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

describe('useDeviceAddForm', () => {
	let form: ReturnType<typeof useDeviceAddForm>;

	const deviceId = uuid().toString();

	beforeEach(() => {
		form = useDeviceAddForm({ id: deviceId.toString() });
		form.stepOneFormEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;
		form.stepTwoFormEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
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

	it('should submit and call store add method', async () => {
		form.model.name = 'New Device';
		form.model.hostname = '192.168.0.1';

		await nextTick();

		await form.submitStep('two');

		expect(mockAdd).toHaveBeenCalledWith({
			id: deviceId.toString(),
			draft: false,
			data: {
				type: DEVICES_SHELLY_NG_TYPE,
				id: deviceId.toString(),
				category: DevicesModuleDeviceCategory.generic,
				name: 'New Device',
				description: null,
				enabled: true,
				hostname: '192.168.0.1',
				password: '',
			},
		});
		expect(form.formResult.value).toBe(FormResult.OK);
	});
});
