import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { CONFIG_MODULE_NAME, FormResult } from '../config.constants';
import { ConfigValidationException } from '../config.exceptions';
import { ConfigPluginEditFormSchema } from '../schemas/plugins.schemas';
import { ConfigPluginSchema } from '../store/config-plugins.store.schemas';

import { useConfigPluginEditForm } from './useConfigPluginEditForm';

const TestConfigPluginSchema = ConfigPluginSchema.extend({
	value: z.string(),
});

type ITestConfigPluginSchema = z.infer<typeof TestConfigPluginSchema>;

const TestConfigPluginEditFormSchema = ConfigPluginEditFormSchema.extend({
	value: z.string(),
});

type ITestConfigPluginEditForm = z.infer<typeof TestConfigPluginEditFormSchema>;

const mockConfig: ITestConfigPluginSchema = {
	type: 'test-plugin',
	value: 'test-value',
} as ITestConfigPluginSchema;

const mockEdit = vi.fn();

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
				type: 'test-plugin',
				schemas: {
					pluginConfigSchema: TestConfigPluginSchema,
					pluginConfigEditFormSchema: TestConfigPluginEditFormSchema,
				},
			},
		],
		isCore: false,
		modules: [CONFIG_MODULE_NAME],
	},
];

vi.mock('./usePlugins', () => ({
	usePlugins: () => ({
		getByName: (name: string) => mockPluginList.find((p) => p.type === name),
	}),
}));

describe('useConfigPluginEditForm', () => {
	beforeEach(() => {
		mockEdit.mockClear();
		mockSuccess.mockClear();
		mockError.mockClear();
	});

	it('initializes model with plugin config data', () => {
		const form = useConfigPluginEditForm<ITestConfigPluginEditForm>({ config: mockConfig });

		expect(form.model.type).toBe(mockConfig.type);
		expect(form.model.value).toBe(mockConfig.value);
	});

	it('sets formChanged to true if field is edited', async () => {
		const form = useConfigPluginEditForm<ITestConfigPluginEditForm>({ config: mockConfig });

		form.model.value = 'Updated';
		await nextTick();

		expect(form.formChanged.value).toBe(true);
	});

	it('throws validation error if form is invalid', async () => {
		const form = useConfigPluginEditForm<ITestConfigPluginEditForm>({ config: mockConfig });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(false),
		} as unknown as FormInstance;

		await expect(form.submit()).rejects.toThrow(ConfigValidationException);
	});

	it('submits and edits if plugin config', async () => {
		const config = { ...mockConfig, draft: false };
		const form = useConfigPluginEditForm<ITestConfigPluginEditForm>({ config });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		await form.submit();

		expect(mockEdit).toHaveBeenCalled();
		expect(mockSuccess).toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.OK);
	});
});
