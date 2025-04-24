import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FormResult } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi';

import { useThirdPartyDeviceAddForm } from './useThirdPartyDeviceAddForm';

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

describe('useThirdPartyDeviceAddForm', () => {
	let form: ReturnType<typeof useThirdPartyDeviceAddForm>;

	beforeEach(() => {
		form = useThirdPartyDeviceAddForm({ id: 'device-123' });
		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;
	});

	it('should initialize with default values', () => {
		expect(form.model.id).toBe('device-123');
		expect(form.model.type).toBe('third-party');
		expect(form.model.name).toBe('');
		expect(form.model.serviceAddress).toBe('');
		expect(form.model.category).toBe(DevicesModuleDeviceCategory.generic);
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
				type: 'third-party',
				category: DevicesModuleDeviceCategory.generic,
				name: '',
				description: null,
				serviceAddress: '',
			},
		});
		expect(form.formResult.value).toBe(FormResult.OK);
	});
});
