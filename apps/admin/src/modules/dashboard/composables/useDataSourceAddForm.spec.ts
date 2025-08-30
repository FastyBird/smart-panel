import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { DASHBOARD_MODULE_NAME, FormResult } from '../dashboard.constants';
import { DataSourceAddFormSchema } from '../schemas/dataSources.schemas';

import { useDataSourceAddForm } from './useDataSourceAddForm';

const TestDataSourceAddFormSchema = DataSourceAddFormSchema.extend({
	value: z.string(),
});

type ITestDataSourceAddForm = z.infer<typeof TestDataSourceAddFormSchema>;

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
		elements: [
			{
				type: 'test-type',
				schemas: {
					dataSourceAddFormSchema: TestDataSourceAddFormSchema,
				},
			},
		],
		isCore: false,
		modules: [DASHBOARD_MODULE_NAME],
	},
];

vi.mock('./useDataSourcesPlugins', () => ({
	useDataSourcesPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.elements.find((el) => el.type === type)),
	}),
}));

describe('useDataSourceAddForm', () => {
	let form: ReturnType<typeof useDataSourceAddForm<ITestDataSourceAddForm>>;

	const dataSourceId = uuid().toString();

	beforeEach(() => {
		form = useDataSourceAddForm<ITestDataSourceAddForm>({ id: dataSourceId, type: 'test-type', parent: 'page', parentId: 'page-id' });
		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;
	});

	it('should initialize with default values', () => {
		expect(form.model.id).toBe(dataSourceId);
		expect(form.model.type).toBe('test-type');
	});

	it('should mark form as changed when model updates', async () => {
		expect(form.formChanged.value).toBe(false);

		form.model.value = 'Some value';
		await nextTick();

		expect(form.formChanged.value).toBe(true);
	});

	it('should submit and call store add method', async () => {
		form.model.value = 'Some value';

		await form.submit();

		expect(mockAdd).toHaveBeenCalledWith({
			id: dataSourceId,
			draft: false,
			parent: {
				id: 'page-id',
				type: 'page',
			},
			data: {
				id: dataSourceId,
				type: 'test-type',
				value: 'Some value',
			},
		});
		expect(form.formResult.value).toBe(FormResult.OK);
	});
});
