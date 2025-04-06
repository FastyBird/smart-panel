import type { FormInstance } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesChannelPropertyCategory, DevicesChannelPropertyData_type } from '../../../openapi';
import { FormResult } from '../devices.constants';
import { DevicesValidationException } from '../devices.exceptions';
import type { IChannelProperty } from '../store/channels.properties.store.types';

import { useChannelPropertyEditForm } from './useChannelPropertyEditForm';

const mockProperty: IChannelProperty = {
	id: 'property-1',
	channel: 'channel-1',
	name: 'My Property',
	category: DevicesChannelPropertyCategory.brightness,
	dataType: DevicesChannelPropertyData_type.float,
	permissions: [],
	unit: '',
	format: [],
	invalid: '',
	step: null,
	draft: true,
	value: null,
	createdAt: new Date(),
	updatedAt: null,
} as IChannelProperty;

const mockEdit = vi.fn();
const mockSave = vi.fn();

const mockSuccess = vi.fn();
const mockError = vi.fn();

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
			findForChannel: () => [],
		}),
	}),
	useFlashMessage: () => ({
		success: mockSuccess,
		error: mockError,
	}),
}));

vi.mock('./useChannels', () => ({
	useChannels: () => ({
		channels: {
			value: [{ id: 'channel-1', category: 'light', name: 'Channel A' }],
		},
		fetchChannels: vi.fn().mockResolvedValue(undefined),
		areLoading: false,
	}),
}));

describe('useChannelPropertyEditForm', () => {
	beforeEach(() => {
		mockEdit.mockClear();
		mockSave.mockClear();
		mockSuccess.mockClear();
		mockError.mockClear();
	});

	it('initializes model from property', () => {
		const form = useChannelPropertyEditForm({ property: mockProperty });

		expect(form.model.id).toBe(mockProperty.id);
		expect(form.model.channel).toBe(mockProperty.channel);
		expect(form.model.name).toBe(mockProperty.name);
	});

	it('detects form changes', async () => {
		const form = useChannelPropertyEditForm({ property: mockProperty });

		form.model.name = 'Changed';
		await Promise.resolve();

		expect(form.formChanged.value).toBe(true);
	});

	it('throws on invalid form', async () => {
		const form = useChannelPropertyEditForm({ property: mockProperty });
		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(false),
		} as unknown as FormInstance;

		await expect(form.submit()).rejects.toThrow(DevicesValidationException);
	});

	it('submits and saves when draft', async () => {
		const form = useChannelPropertyEditForm({ property: mockProperty });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		await form.submit();

		expect(mockEdit).toHaveBeenCalled();
		expect(mockSave).toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.OK);
		expect(mockSuccess).toHaveBeenCalled();
	});

	it('submits and edits when not draft', async () => {
		const form = useChannelPropertyEditForm({ property: { ...mockProperty, draft: false } });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		await form.submit();

		expect(mockEdit).toHaveBeenCalled();
		expect(mockSave).not.toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.OK);
		expect(mockSuccess).toHaveBeenCalled();
	});
});
