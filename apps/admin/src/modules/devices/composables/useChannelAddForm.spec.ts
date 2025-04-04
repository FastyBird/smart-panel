import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesChannelCategory } from '../../../openapi';
import { FormResult } from '../devices.constants';

import { useChannelAddForm } from './useChannelAddForm';

const mockAdd = vi.fn();

vi.mock('./useDevices', () => ({
	useDevices: () => ({
		devices: {
			value: [{ id: 'device-1', name: 'Device 1', category: DevicesChannelCategory.light }],
		},
		fetchDevices: vi.fn().mockResolvedValue(undefined),
		areLoading: { value: false },
	}),
}));

vi.mock('../../../common', () => ({
	injectStoresManager: () => ({
		getStore: () => ({
			findForDevice: () => [],
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

describe('useChannelAddForm', () => {
	let form: ReturnType<typeof useChannelAddForm>;

	beforeEach(() => {
		form = useChannelAddForm({ id: 'channel-123', deviceId: 'device-123' });
		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;
	});

	it('initializes the form with provided id and deviceId', () => {
		expect(form.model.id).toBe('channel-123');
		expect(form.model.device).toBe('device-123');
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
		form.model.category = DevicesChannelCategory.generic;

		await form.submit();

		expect(mockAdd).toHaveBeenCalledWith({
			id: 'channel-123',
			deviceId: 'device-123',
			draft: false,
			data: {
				category: DevicesChannelCategory.generic,
				name: 'name',
				description: null,
			},
		});
		expect(form.formResult.value).toBe(FormResult.OK);
	});
});
