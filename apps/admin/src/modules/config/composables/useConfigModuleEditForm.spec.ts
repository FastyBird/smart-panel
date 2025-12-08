import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { CONFIG_MODULE_NAME, CONFIG_MODULE_MODULE_TYPE, FormResult } from '../config.constants';
import { ConfigValidationException } from '../config.exceptions';
import { ConfigModuleEditFormSchema } from '../schemas/modules.schemas';
import { ConfigModuleSchema } from '../store/config-modules.store.schemas';

import { useConfigModuleEditForm } from './useConfigModuleEditForm';

const TestConfigModuleSchema = ConfigModuleSchema.extend({
	value: z.string(),
});

type ITestConfigModuleSchema = z.infer<typeof TestConfigModuleSchema>;

const TestConfigModuleEditFormSchema = ConfigModuleEditFormSchema.extend({
	value: z.string(),
});

type ITestConfigModuleEditForm = z.infer<typeof TestConfigModuleEditFormSchema>;

const mockConfig: ITestConfigModuleSchema = {
	type: 'test-module',
	enabled: true,
	value: 'test-value',
} as ITestConfigModuleSchema;

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

const mockModuleList = [
	{
		type: 'test-module',
		name: 'Test Module',
		description: 'Description',
		elements: [
			{
				type: CONFIG_MODULE_MODULE_TYPE,
				schemas: {
					moduleConfigSchema: TestConfigModuleSchema,
					moduleConfigEditFormSchema: TestConfigModuleEditFormSchema,
				},
			},
		],
		modules: [CONFIG_MODULE_NAME],
	},
];

vi.mock('./useModule', () => ({
	useModule: () => ({
		module: {
			value: mockModuleList.find((m) => m.type === 'test-module'),
		},
	}),
}));

describe('useConfigModuleEditForm', () => {
	beforeEach(() => {
		mockEdit.mockClear();
		mockSuccess.mockClear();
		mockError.mockClear();
	});

	it('initializes model with module config data', () => {
		const form = useConfigModuleEditForm<ITestConfigModuleEditForm>({ config: mockConfig });

		expect(form.model.type).toBe(mockConfig.type);
		expect(form.model.value).toBe(mockConfig.value);
	});

	it('sets formChanged to true if field is edited', async () => {
		const form = useConfigModuleEditForm<ITestConfigModuleEditForm>({ config: mockConfig });

		form.model.value = 'Updated';
		await nextTick();

		expect(form.formChanged.value).toBe(true);
	});

	it('throws validation error if form is invalid', async () => {
		const form = useConfigModuleEditForm<ITestConfigModuleEditForm>({ config: mockConfig });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(false),
		} as unknown as FormInstance;

		await expect(form.submit()).rejects.toThrow(ConfigValidationException);
	});

	it('submits and edits if module config', async () => {
		const config = { ...mockConfig, enabled: true };
		const form = useConfigModuleEditForm<ITestConfigModuleEditForm>({ config });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		mockEdit.mockResolvedValue(config);

		await form.submit();

		expect(mockEdit).toHaveBeenCalled();
		expect(mockSuccess).toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.OK);
	});

	it('clears form result after timeout', async () => {
		vi.useFakeTimers();
		const form = useConfigModuleEditForm<ITestConfigModuleEditForm>({ config: mockConfig });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		mockEdit.mockResolvedValue(mockConfig);

		await form.submit();

		expect(form.formResult.value).toBe(FormResult.OK);

		vi.advanceTimersByTime(2000);

		expect(form.formResult.value).toBe(FormResult.NONE);

		vi.useRealTimers();
	});
});

