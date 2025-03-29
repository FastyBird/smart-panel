import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesChannelCategory, DevicesChannelPropertyCategory } from '../../../openapi';
import { FormResult } from '../devices.constants';

import { useChannelPropertyAddForm } from './useChannelPropertyAddForm';

const mockAdd = vi.fn();

vi.mock('./useChannels', () => ({
	useChannels: () => ({
		channels: {
			value: [{ id: 'channel-1', name: 'Channel 1', category: DevicesChannelCategory.light }],
		},
		fetchChannels: vi.fn().mockResolvedValue(undefined),
		areLoading: { value: false },
	}),
}));

vi.mock('../../../common', () => ({
	injectStoresManager: () => ({
		getStore: () => ({
			findForChannel: () => [],
			add: mockAdd,
		}),
	}),
	useFlashMessage: () => ({
		success: vi.fn(),
		error: vi.fn(),
	}),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

describe('useChannelPropertyAddForm', () => {
	let form: ReturnType<typeof useChannelPropertyAddForm>;

	beforeEach(() => {
		form = useChannelPropertyAddForm('property-123', 'channel-123');
		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;
	});

	it('initializes the form with provided id and channelId', () => {
		expect(form.model.id).toBe('property-123');
		expect(form.model.channel).toBe('channel-123');
		expect(form.formResult.value).toBe(FormResult.NONE);
		expect(form.formChanged.value).toBe(false);
	});

	it('should mark form as changed when model updates', async () => {
		expect(form.formChanged.value).toBe(false);

		form.model.name = 'New Device';
		await nextTick();

		expect(form.formChanged.value).toBe(true);
	});

	it('should submit and call store add method', async () => {
		form.model.name = 'name';
		form.model.category = DevicesChannelPropertyCategory.generic;

		await form.submit();

		expect(mockAdd).toHaveBeenCalledWith({
			id: 'property-123',
			channelId: 'channel-123',
			draft: false,
			data: {
				category: DevicesChannelPropertyCategory.generic,
				name: 'name',
				dataType: 'unknown',
				format: null,
				invalid: null,
				permissions: [],
				step: null,
				unit: null,
			},
		});
		expect(form.formResult.value).toBe(FormResult.OK);
	});
});
