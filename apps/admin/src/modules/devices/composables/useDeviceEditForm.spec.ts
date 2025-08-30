import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModuleDeviceCategory } from '../../../openapi';
import { DEVICES_MODULE_NAME, FormResult } from '../devices.constants';
import { DevicesValidationException } from '../devices.exceptions';
import { DeviceSchema } from '../store/devices.store.schemas';
import type { IDevice } from '../store/devices.store.types';

import { useDeviceEditForm } from './useDeviceEditForm';

const deviceId = uuid().toString();

const mockDevice: IDevice = {
	id: deviceId.toString(),
	type: 'test-type',
	category: DevicesModuleDeviceCategory.generic,
	name: 'Test Device',
	description: 'Test Desc',
	draft: true,
} as IDevice;

const mockEdit = vi.fn();
const mockSave = vi.fn();

const mockSuccess = vi.fn();
const mockError = vi.fn();
const mockInfo = vi.fn();

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', () => ({
	injectStoresManager: () => ({
		getStore: () => ({
			edit: mockEdit,
			save: mockSave,
		}),
	}),
	useFlashMessage: () => ({
		success: mockSuccess,
		error: mockError,
		info: mockInfo,
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

describe('useDeviceEditForm', () => {
	beforeEach(() => {
		mockEdit.mockClear();
		mockSave.mockClear();
		mockSuccess.mockClear();
		mockError.mockClear();
	});

	it('initializes model with device data', () => {
		const form = useDeviceEditForm({ device: mockDevice });

		expect(form.model.id).toBe(mockDevice.id);
		expect(form.model.name).toBe(mockDevice.name);
		expect(form.model.description).toBe(mockDevice.description);
	});

	it('sets formChanged to true if name or description is edited', async () => {
		const form = useDeviceEditForm({ device: mockDevice });

		form.model.name = 'Updated';
		await nextTick();

		expect(form.formChanged.value).toBe(true);
	});

	it('throws validation error if form is invalid', async () => {
		const form = useDeviceEditForm({ device: mockDevice });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(false),
		} as unknown as FormInstance;

		await expect(form.submit()).rejects.toThrow(DevicesValidationException);
	});

	it('submits and saves if device is a draft', async () => {
		const form = useDeviceEditForm({ device: mockDevice });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		await form.submit();

		expect(mockEdit).toHaveBeenCalledWith({
			id: mockDevice.id,
			data: {
				id: mockDevice.id,
				type: mockDevice.type,
				category: mockDevice.category,
				name: mockDevice.name,
				description: mockDevice.description,
			},
		});
		expect(mockSave).toHaveBeenCalledWith({ id: mockDevice.id });
		expect(mockSuccess).toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.OK);
	});

	it('submits and edits if device is not a draft', async () => {
		const device = { ...mockDevice, draft: false };
		const form = useDeviceEditForm({ device });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		await form.submit();

		expect(mockEdit).toHaveBeenCalled();
		expect(mockSave).not.toHaveBeenCalled();
		expect(mockSuccess).toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.OK);
	});
});
