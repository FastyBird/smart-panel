import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { DASHBOARD_MODULE_NAME, FormResult } from '../dashboard.constants';
import { DashboardValidationException } from '../dashboard.exceptions';
import { DataSourceEditFormSchema } from '../schemas/dataSources.schemas';
import { DataSourceSchema } from '../store/data-sources.store.schemas';

import { useDataSourceEditForm } from './useDataSourceEditForm';

const TestDataSourceSchema = DataSourceSchema.extend({
	value: z.string(),
});

type ITestDataSourceSchema = z.infer<typeof TestDataSourceSchema>;

const TestDataSourceEditFormSchema = DataSourceEditFormSchema.extend({
	value: z.string(),
});

type ITestDataSourceEditForm = z.infer<typeof TestDataSourceEditFormSchema>;

const mockDataSource: ITestDataSourceSchema = {
	id: uuid().toString(),
	type: 'test-type',
	value: 'test-value',
	draft: true,
} as ITestDataSourceSchema;

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
					dataSourceSchema: TestDataSourceSchema,
					dataSourceEditFormSchema: TestDataSourceEditFormSchema,
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

describe('useDataSourceEditForm', () => {
	beforeEach(() => {
		mockEdit.mockClear();
		mockSave.mockClear();
		mockSuccess.mockClear();
		mockError.mockClear();
	});

	it('initializes model with data source data', () => {
		const form = useDataSourceEditForm<ITestDataSourceEditForm>({ dataSource: mockDataSource });

		expect(form.model.id).toBe(mockDataSource.id);
		expect(form.model.value).toBe(mockDataSource.value);
	});

	it('sets formChanged to true if field is edited', async () => {
		const form = useDataSourceEditForm<ITestDataSourceEditForm>({ dataSource: mockDataSource });

		form.model.value = 'Updated';
		await nextTick();

		expect(form.formChanged.value).toBe(true);
	});

	it('throws validation error if form is invalid', async () => {
		const form = useDataSourceEditForm<ITestDataSourceEditForm>({ dataSource: mockDataSource });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(false),
		} as unknown as FormInstance;

		await expect(form.submit()).rejects.toThrow(DashboardValidationException);
	});

	it('submits and saves if data source is a draft', async () => {
		const form = useDataSourceEditForm<ITestDataSourceEditForm>({ dataSource: mockDataSource });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		await form.submit();

		expect(mockEdit).toHaveBeenCalledWith({
			id: mockDataSource.id,
			data: {
				id: mockDataSource.id,
				type: 'test-type',
				value: mockDataSource.value,
			},
		});
		expect(mockSave).toHaveBeenCalledWith({ id: mockDataSource.id });
		expect(mockSuccess).toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.OK);
	});

	it('submits and edits if data source is not a draft', async () => {
		const dataSource = { ...mockDataSource, draft: false };
		const form = useDataSourceEditForm<ITestDataSourceEditForm>({ dataSource });

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
