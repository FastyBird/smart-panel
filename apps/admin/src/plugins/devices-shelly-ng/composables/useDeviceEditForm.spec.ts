import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StoreInjectionKey } from '../../../common';
import { DevicesValidationException, FormResult, channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi';
import type { IShellyNgDevice } from '../store/devices.store.types';

import { useDeviceEditForm } from './useDeviceEditForm';

const deviceId = uuid().toString();

const mockDevice: IShellyNgDevice = {
	id: deviceId.toString(),
	type: 'test-type',
	category: DevicesModuleDeviceCategory.generic,
	name: 'Test Device',
	description: 'Test Desc',
	draft: true,
	hostname: '192.168.0.1',
	password: 'secret',
} as IShellyNgDevice;

const mockEdit = vi.fn();
const mockSave = vi.fn();

const mockSuccess = vi.fn();
const mockError = vi.fn();
const mockInfo = vi.fn();

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
};

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', () => ({
	injectStoresManager: () => ({
		getStore: (key: StoreInjectionKey) => {
			if (key === devicesStoreKey) {
				return {
					edit: mockEdit,
					save: mockSave,
				};
			} else if (key === channelsStoreKey) {
				return {
					findForDevice: vi.fn(),
				};
			} else if (key === channelsPropertiesStoreKey) {
				return {
					findForChannel: vi.fn(),
				};
			} else {
				throw new Error('Unknown key');
			}
		},
	}),
	useFlashMessage: () => ({
		success: mockSuccess,
		error: mockError,
		info: mockInfo,
	}),
	useBackend: () => ({
		client: backendClient,
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
		expect(form.model.hostname).toBe(mockDevice.hostname);
		expect(form.model.password).toBe(mockDevice.password);
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
				hostname: '192.168.0.1',
				password: 'secret',
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
