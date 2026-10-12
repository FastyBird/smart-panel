import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesApiException, DevicesValidationException, FormResult } from '../../../modules/devices';
import { DevicesModuleDeviceCategory, DevicesReTerminalPluginVariant } from '../../../openapi.constants';
import { DevicesReTerminalValidationException } from '../devices-reterminal.exceptions';
import type { IReTerminalDevice } from '../store/devices.store.types';

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
	variant: DevicesReTerminalPluginVariant.reterminal,
} as unknown as IReTerminalDevice;

const mockEdit = vi.fn();
const mockSave = vi.fn();

const mockSuccess = vi.fn();
const mockError = vi.fn();
const mockInfo = vi.fn();

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
				edit: mockEdit,
				save: mockSave,
			}),
		}),
		useFlashMessage: () => ({
			success: mockSuccess,
			error: mockError,
			info: mockInfo,
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
		mockEdit.mockReset();
		mockSave.mockReset();
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
				variant: mockDevice.variant,
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
	it('sends an explicit null for room removal and omits an unchanged null room', async () => {
		const form = useDeviceEditForm({ device: { ...mockDevice, draft: false, roomId: roomOneId } });
		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;
		form.model.roomId = null;

		await form.submit();
		expect(mockEdit.mock.calls[0][0].data).toHaveProperty('roomId', null);

		form.model.name = 'Room remains cleared';
		await form.submit();
		expect(mockEdit.mock.calls[1][0].data).not.toHaveProperty('roomId');
	});

	describe('shared submit lifecycle', () => {
		beforeEach(() => vi.useFakeTimers());
		afterEach(() => vi.useRealTimers());

		const createForm = (draft = false, messages?: { success?: string; error?: string }) => {
			const form = useDeviceEditForm({ device: { ...mockDevice, draft }, messages });
			form.formEl.value = {
				clearValidate: vi.fn(),
				validate: vi.fn().mockResolvedValue(true),
			} as unknown as FormInstance;
			return form;
		};

		it('exposes API validation errors and clears the error result after two seconds', async () => {
			const error = new DevicesApiException('Placement is invalid', 422);
			mockEdit.mockRejectedValueOnce(error);
			const form = createForm();
			form.model.name = 'Unsaved edit';
			await nextTick();

			await expect(form.submit()).rejects.toBe(error);

			expect(form.formResult.value).toBe(FormResult.ERROR);
			expect(form.formChanged.value).toBe(true);
			expect(mockError).toHaveBeenCalledWith(error.message);
			expect(mockSave).not.toHaveBeenCalled();
			expect(mockSuccess).not.toHaveBeenCalled();
			vi.advanceTimersByTime(2000);
			expect(form.formResult.value).toBe(FormResult.NONE);
		});

		it('uses the supplied error message for other store failures', async () => {
			const error = new DevicesApiException('Server unavailable', 503);
			mockEdit.mockRejectedValueOnce(error);
			const form = createForm(false, { error: 'custom edit failure' });

			await expect(form.submit()).rejects.toBe(error);

			expect(mockError).toHaveBeenCalledWith('custom edit failure');
		});

		it('handles a draft save failure after the edit without reporting success', async () => {
			const error = new Error('Save failed');
			mockSave.mockRejectedValueOnce(error);
			const form = createForm(true, { error: 'custom create failure' });

			await expect(form.submit()).rejects.toBe(error);

			expect(mockEdit).toHaveBeenCalledOnce();
			expect(mockSave).toHaveBeenCalledWith({ id: mockDevice.id });
			expect(mockError).toHaveBeenCalledWith('custom create failure');
			expect(mockSuccess).not.toHaveBeenCalled();
			expect(form.formResult.value).toBe(FormResult.ERROR);
		});

		it('preserves the schema validation exception without submitting', async () => {
			const form = createForm();
			form.model.id = 'invalid-id';

			await expect(form.submit()).rejects.toThrow(DevicesReTerminalValidationException);

			expect(mockEdit).not.toHaveBeenCalled();
			expect(mockSave).not.toHaveBeenCalled();
			expect(mockError).not.toHaveBeenCalled();
			expect(form.formResult.value).toBe(FormResult.NONE);
		});

		it('keeps validation rejection outside the store error lifecycle', async () => {
			const form = createForm();
			const error = new Error('Form validation rejected');
			vi.mocked(form.formEl.value!.validate).mockRejectedValueOnce(error);

			await expect(form.submit()).rejects.toBe(error);

			expect(mockEdit).not.toHaveBeenCalled();
			expect(mockError).not.toHaveBeenCalled();
			expect(form.formResult.value).toBe(FormResult.NONE);
		});

		it('returns the existing submit outcomes and uses custom success messages', async () => {
			const form = createForm(false, { success: 'custom.success' });
			form.model.name = 'Saved edit';
			await nextTick();

			await expect(form.submit()).resolves.toBe('saved');

			expect(mockSuccess).toHaveBeenCalledWith('custom.success');
			expect(form.formChanged.value).toBe(false);
			vi.advanceTimersByTime(2000);
			expect(form.formResult.value).toBe(FormResult.NONE);

			await expect(createForm(true).submit()).resolves.toBe('added');
		});

		it('refreshes the room baseline after saving a placement change', async () => {
			const form = createForm();
			form.model.roomId = roomTwoId;
			await form.submit();
			form.model.name = 'Second edit';
			await nextTick();
			expect(form.formChanged.value).toBe(true);
			await form.submit();

			expect(mockEdit.mock.calls[0][0].data.roomId).toBe(roomTwoId);
			expect(mockEdit.mock.calls[1][0].data).not.toHaveProperty('roomId');
			form.clear();
			expect(form.formResult.value).toBe(FormResult.NONE);
		});
	});
});
