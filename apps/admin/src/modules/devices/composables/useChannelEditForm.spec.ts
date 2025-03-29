import type { FormInstance } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesChannelCategory } from '../../../openapi';
import { FormResult } from '../devices.constants';
import { DevicesValidationException } from '../devices.exceptions';
import type { IChannel } from '../store';

import { useChannelEditForm } from './useChannelEditForm';

const mockChannel: IChannel = {
	id: 'channel-1',
	device: 'device-1',
	name: 'Channel Name',
	description: 'Some desc',
	category: DevicesChannelCategory.light,
	draft: true,
} as IChannel;

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
			findForDevice: () => [],
		}),
	}),
	useFlashMessage: () => ({
		success: mockSuccess,
		error: mockError,
		info: mockInfo,
	}),
}));

vi.mock('./useDevices', () => ({
	useDevices: () => ({
		devices: { value: [{ id: 'device-1', category: 'generic', name: 'Device 1' }] },
		fetchDevices: vi.fn().mockResolvedValue(undefined),
		areLoading: false,
	}),
}));

describe('useChannelEditForm', () => {
	beforeEach(() => {
		mockEdit.mockClear();
		mockSave.mockClear();
		mockSuccess.mockClear();
		mockError.mockClear();
	});

	it('initializes model with channel data', () => {
		const form = useChannelEditForm(mockChannel);

		expect(form.model.id).toBe(mockChannel.id);
		expect(form.model.name).toBe(mockChannel.name);
		expect(form.model.description).toBe(mockChannel.description);
	});

	it('sets formChanged to true when model changes', async () => {
		const form = useChannelEditForm(mockChannel);

		form.model.name = 'Updated';
		await Promise.resolve();

		expect(form.formChanged.value).toBe(true);
	});

	it('throws if form is invalid', async () => {
		const form = useChannelEditForm(mockChannel);

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(false),
		} as unknown as FormInstance;

		await expect(form.submit()).rejects.toThrow(DevicesValidationException);
	});

	it('submits and saves if draft', async () => {
		const form = useChannelEditForm(mockChannel);

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		await form.submit();

		expect(mockEdit).toHaveBeenCalled();
		expect(mockSave).toHaveBeenCalled();
		expect(mockSuccess).toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.OK);
	});

	it('submits and edits if not draft', async () => {
		const form = useChannelEditForm({ ...mockChannel, draft: false });

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
