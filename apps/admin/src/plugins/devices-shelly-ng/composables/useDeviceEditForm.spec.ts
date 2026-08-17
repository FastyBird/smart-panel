import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StoreInjectionKey } from '../../../common';
import { DevicesValidationException, FormResult, channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices';
import { DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory, DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type { IShellyNgDevice } from '../store/devices.store.types';

import { useDeviceEditForm } from './useDeviceEditForm';

const deviceId = uuid().toString();
const roomOneId = uuid().toString();
const roomTwoId = uuid().toString();

const mockDevice = {
	id: deviceId.toString(),
	type: 'test-type',
	category: DevicesModuleDeviceCategory.generic,
	name: 'Test Device',
	description: 'Test Desc',
	draft: true,
	password: 'secret',
	addresses: [
		{ id: 'addr-1', interfaceType: 'ethernet', address: '192.168.0.1' },
		{ id: 'addr-2', interfaceType: 'wifi', address: '192.168.0.2' },
	],
} as unknown as IShellyNgDevice;

const mockEdit = vi.fn();
const mockSave = vi.fn();

const mockFindForDevice = vi.fn();
const mockFindForChannel = vi.fn();

const mockSuccess = vi.fn();
const mockError = vi.fn();
const mockInfo = vi.fn();

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
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
			getStore: (key: StoreInjectionKey) => {
				if (key === devicesStoreKey) {
					return {
						edit: mockEdit,
						save: mockSave,
					};
				} else if (key === channelsStoreKey) {
					return {
						findForDevice: mockFindForDevice,
					};
				} else if (key === channelsPropertiesStoreKey) {
					return {
						findForChannel: mockFindForChannel,
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
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
	};
});

describe('useDeviceEditForm', () => {
	beforeEach(() => {
		mockEdit.mockClear();
		mockSave.mockClear();
		mockSuccess.mockClear();
		mockError.mockClear();
		mockFindForDevice.mockReset().mockReturnValue([]);
		mockFindForChannel.mockReset().mockReturnValue([]);
	});

	it('derives category options from the stored model property value', () => {
		const channelId = uuid().toString();

		mockFindForDevice.mockReturnValue([{ id: channelId, category: DevicesModuleChannelCategory.device_information }]);
		// The channels-properties store normalizes every value into
		// `{ value, lastUpdated, trend }` — never a bare scalar.
		mockFindForChannel.mockReturnValue([
			{
				id: uuid().toString(),
				category: DevicesModuleChannelPropertyCategory.model,
				value: { value: 'SNSW-001P16EU', lastUpdated: null, trend: null },
			},
		]);

		const form = useDeviceEditForm({ device: mockDevice });

		form.supportedDevices.value = [
			{
				group: 'shelly-plus-1pm',
				name: 'Shelly Plus 1PM',
				models: ['SNSW-001P16EU'],
				categories: [DevicesModuleDeviceCategory.outlet, DevicesModuleDeviceCategory.lighting],
				components: [],
				system: [],
			},
		] as unknown as typeof form.supportedDevices.value;

		expect(form.categoriesOptions.value.map((option) => option.value)).toEqual(
			expect.arrayContaining([DevicesModuleDeviceCategory.outlet, DevicesModuleDeviceCategory.lighting])
		);
	});

	it('initializes model with device data', () => {
		const form = useDeviceEditForm({ device: mockDevice });

		expect(form.model.id).toBe(mockDevice.id);
		expect(form.model.name).toBe(mockDevice.name);
		expect(form.model.description).toBe(mockDevice.description);
		expect(form.model.ethernetAddress).toBe('192.168.0.1');
		expect(form.model.wifiAddress).toBe('192.168.0.2');
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
			data: expect.objectContaining({
				id: mockDevice.id,
				type: mockDevice.type,
				category: mockDevice.category,
				name: mockDevice.name,
				description: mockDevice.description,
				password: 'secret',
			}),
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

	it('omits room_id when the room was not changed', async () => {
		const device = { ...mockDevice, draft: false, roomId: roomOneId };
		const form = useDeviceEditForm({ device });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		form.model.name = 'Updated name';

		await form.submit();

		const editPayload = mockEdit.mock.calls[0][0];

		expect('roomId' in editPayload.data).toBe(false);
	});

	it('sends room_id when the room was changed', async () => {
		const device = { ...mockDevice, draft: false, roomId: roomOneId };
		const form = useDeviceEditForm({ device });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		form.model.roomId = roomTwoId;

		await form.submit();

		const editPayload = mockEdit.mock.calls[0][0];

		expect(editPayload.data.roomId).toBe(roomTwoId);
	});
});
