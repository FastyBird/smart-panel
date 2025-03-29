import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesDeviceCategory } from '../../../openapi';
import { FormResult } from '../devices.constants';

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

describe('useDeviceAddForm', () => {
	let form: ReturnType<typeof useDeviceAddForm>;

	beforeEach(() => {
		form = useDeviceAddForm('device-123', 'test-plugin');
		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;
	});

	it('should initialize with default values', () => {
		expect(form.model.id).toBe('device-123');
		expect(form.model.type).toBe('test-plugin');
		expect(form.model.name).toBe('');
		expect(form.model.category).toBe(DevicesDeviceCategory.generic);
	});

	it('should mark form as changed when model updates', async () => {
		expect(form.formChanged.value).toBe(false);

		form.model.name = 'New Device';
		await nextTick();

		expect(form.formChanged.value).toBe(true);
	});

	it('should submit and call store add method', async () => {
		await form.submit();

		expect(mockAdd).toHaveBeenCalledWith({
			id: 'device-123',
			draft: false,
			data: {
				type: 'test-plugin',
				category: DevicesDeviceCategory.generic,
				name: '',
				description: null,
			},
		});
		expect(form.formResult.value).toBe(FormResult.OK);
	});
});
