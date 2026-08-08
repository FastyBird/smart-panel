import type { FormInstance } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StoreInjectionKey } from '../../../common';
import { FormResult, devicesStoreKey } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type { IZigbee2mqttDevice } from '../store/devices.store.types';

import { useDeviceEditForm } from './useDeviceEditForm';

const deviceId = uuid().toString();
const roomOneId = uuid().toString();
const roomTwoId = uuid().toString();

const mockDevice = {
	id: deviceId,
	type: 'zigbee2mqtt',
	category: DevicesModuleDeviceCategory.generic,
	identifier: 'zigbee-device',
	name: 'Test Device',
	description: 'Test Desc',
	enabled: true,
	draft: false,
	roomId: roomOneId,
} as unknown as IZigbee2mqttDevice;

const mockEdit = vi.fn();
const mockSave = vi.fn();

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
					return { edit: mockEdit, save: mockSave };
				}

				throw new Error('Unexpected store requested by the zigbee2mqtt edit form');
			},
		}),
		useFlashMessage: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
		useLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
	};
});

const submittable = (form: ReturnType<typeof useDeviceEditForm>): void => {
	form.formEl.value = {
		clearValidate: vi.fn(),
		validate: vi.fn().mockResolvedValue(true),
	} as unknown as FormInstance;
};

describe('useDeviceEditForm (zigbee2mqtt)', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mockEdit.mockResolvedValue(undefined);
		mockSave.mockResolvedValue(undefined);
	});

	// The backend reads any `room_id` in a PATCH as a placement change and refuses one outright for a
	// hidden device — which is what a source device becomes when a virtual device replaces it. An edit
	// form that echoes the stored room back would make renaming such a device fail with a 422 about a
	// placement nobody touched.
	it('sends no room when the form never offered one', async () => {
		const form = useDeviceEditForm({ device: mockDevice });

		submittable(form);

		form.model.name = 'Updated name';

		await form.submit();

		const editPayload = mockEdit.mock.calls[0][0] as { data: Record<string, unknown> };

		expect('roomId' in editPayload.data).toBe(false);
		expect(form.formResult.value).toBe(FormResult.OK);
	});

	// The form has no room field today, so the model never carries one. This pins the guard for the day
	// it grows one: a room set to what it already was is not a placement change and must not be sent.
	it('sends no room when one is set but unchanged', async () => {
		const form = useDeviceEditForm({ device: mockDevice });

		submittable(form);

		(form.model as { roomId?: string | null }).roomId = roomOneId;
		form.model.name = 'Updated name';

		await form.submit();

		const editPayload = mockEdit.mock.calls[0][0] as { data: Record<string, unknown> };

		expect('roomId' in editPayload.data).toBe(false);
	});

	it('sends the room when it actually moved', async () => {
		const form = useDeviceEditForm({ device: mockDevice });

		submittable(form);

		(form.model as { roomId?: string | null }).roomId = roomTwoId;

		await form.submit();

		const editPayload = mockEdit.mock.calls[0][0] as { data: Record<string, unknown> };

		expect(editPayload.data.roomId).toBe(roomTwoId);
	});
});
