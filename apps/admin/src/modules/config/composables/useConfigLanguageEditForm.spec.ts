import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigModuleLanguageLanguage, ConfigModuleLanguageTime_format, ConfigModuleDataLanguageType } from '../../../openapi.constants';
import { FormResult } from '../config.constants';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';

import { useConfigLanguageEditForm } from './useConfigLanguageEditForm';

const mockConfig = {
	type: ConfigModuleDataLanguageType.language,
	language: ConfigModuleLanguageLanguage.en_US,
	timezone: 'Europe/Prague',
	timeFormat: ConfigModuleLanguageTime_format.Value24h,
};

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
	};
});

describe('useConfigLanguageEditForm', () => {
	beforeEach(() => {
		mockEdit.mockClear();
		mockSuccess.mockClear();
		mockError.mockClear();
		mockInfo.mockClear();
	});

	it('initializes model with config data', () => {
		const form = useConfigLanguageEditForm({ config: mockConfig });

		expect(form.model.language).toBe(ConfigModuleLanguageLanguage.en_US);
		expect(form.model.timezone).toBe('Europe/Prague');
		expect(form.model.timeFormat).toBe(ConfigModuleLanguageTime_format.Value24h);
	});

	it('sets formChanged to true when model changes', async () => {
		const form = useConfigLanguageEditForm({ config: mockConfig });

		form.model.language = ConfigModuleLanguageLanguage.cs_CZ;
		await nextTick();

		expect(form.formChanged.value).toBe(true);
	});

	it('throws if form is invalid', async () => {
		const form = useConfigLanguageEditForm({ config: mockConfig });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(false),
		} as unknown as FormInstance;

		await expect(form.submit()).rejects.toThrow(ConfigValidationException);
	});

	it('submits and edits successfully', async () => {
		const form = useConfigLanguageEditForm({ config: mockConfig });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		await form.submit();

		expect(mockEdit).toHaveBeenCalledWith({
			data: {
				language: form.model.language,
				timezone: form.model.timezone,
				timeFormat: form.model.timeFormat,
			},
		});

		expect(mockSuccess).toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.OK);
	});

	it('handles edit failure with custom message', async () => {
		mockEdit.mockRejectedValueOnce(new ConfigApiException('API error', 500));

		const form = useConfigLanguageEditForm({
			config: mockConfig,
			messages: {
				error: 'Something went wrong!',
			},
		});

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		await expect(form.submit()).rejects.toThrow(ConfigApiException);

		expect(mockError).toHaveBeenCalledWith('Something went wrong!');
		expect(form.formResult.value).toBe(FormResult.ERROR);
	});
});
