import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModuleDeviceCategory } from '../../../openapi';
import { DEVICES_MODULE_NAME, FormResult } from '../devices.constants';
import { DeviceSchema } from '../store/devices.store.schemas';

import { useDeviceAddForm } from './useDeviceAddForm';

const mockAdd = vi.fn();

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', () => ({
	injectStoresManager: () => ({
		getStore: () => ({
			add: mockAdd,
		}),
	}),
	useFlashMessage: () => ({
		success: vi.fn(),
		error: vi.fn(),
	}),
}));

const deviceSchema = DeviceSchema;

const mockPluginList = [
	{
		type: 'test-plugin',
		source: 'source',
		name: 'Test Plugin',
		description: 'Description',
		links: {
			documentation: '',
			devDocumentation: '',
			bugsTracking: '',
		},
		elements: [
			{
				type: 'test-type',
				schemas: {
					deviceSchema,
				},
			},
		],
		isCore: false,
		modules: [DEVICES_MODULE_NAME],
	},
];

vi.mock('./useDevicesPlugins', () => ({
	useDevicesPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.type === type),
	}),
}));

describe('useDeviceAddForm', () => {
	let form: ReturnType<typeof useDeviceAddForm>;

	const deviceId = uuid().toString();

	beforeEach(() => {
		form = useDeviceAddForm({ id: deviceId.toString(), type: 'test-type' });
		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;
	});

	it('should initialize with default values', () => {
		expect(form.model.id).toBe(deviceId.toString());
		expect(form.model.type).toBe('test-type');
		expect(form.model.name).toBe('');
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

		await nextTick();

		await form.submit();

		expect(mockAdd).toHaveBeenCalledWith({
			id: deviceId.toString(),
			draft: false,
			data: {
				type: 'test-type',
				id: deviceId.toString(),
				category: DevicesModuleDeviceCategory.generic,
				name: 'New Device',
				description: null,
				enabled: true,
			},
		});
		expect(form.formResult.value).toBe(FormResult.OK);
	});
});
