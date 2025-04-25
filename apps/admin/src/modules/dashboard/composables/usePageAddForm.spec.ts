import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DASHBOARD_MODULE_NAME, FormResult } from '../dashboard.constants';

import { usePageAddForm } from './usePageAddForm';

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

const mockPluginList = [
	{
		type: 'test-plugin',
		source: 'source',
		name: 'Test Plugin',
		description: 'Description',
		links: {
			documentation: '',
			devDocumentation: '',
			bugsTracking: '',
		},
		isCore: false,
		modules: [DASHBOARD_MODULE_NAME],
	},
];

vi.mock('./usePagesPlugins', () => ({
	usePagesPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.type === type),
	}),
}));

describe('usePageAddForm', () => {
	let form: ReturnType<typeof usePageAddForm>;

	const pageId = uuid().toString();

	beforeEach(() => {
		form = usePageAddForm({ id: pageId, type: 'test-plugin' });
		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;
	});

	it('should initialize with default values', () => {
		expect(form.model.id).toBe(pageId);
		expect(form.model.type).toBe('test-plugin');
		expect(form.model.title).toBe('');
		expect(form.model.order).toBe(0);
	});

	it('should mark form as changed when model updates', async () => {
		expect(form.formChanged.value).toBe(false);

		form.model.title = 'New Page';
		await nextTick();

		expect(form.formChanged.value).toBe(true);
	});

	it('should submit and call store add method', async () => {
		form.model.title = 'New Page';

		await form.submit();

		expect(mockAdd).toHaveBeenCalledWith({
			id: pageId,
			draft: false,
			data: {
				id: pageId,
				type: 'test-plugin',
				title: 'New Page',
				order: 0,
				icon: null,
			},
		});
		expect(form.formResult.value).toBe(FormResult.OK);
	});
});
