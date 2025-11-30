import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigModuleSystemLog_levels, ConfigModuleDataSystemType } from '../../../openapi.constants';
import { FormResult } from '../config.constants';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';

import { useConfigSystemEditForm } from './useConfigSystemEditForm';

const mockConfig = {
	type: ConfigModuleDataSystemType.system,
	logLevels: [ConfigModuleSystemLog_levels.info, ConfigModuleSystemLog_levels.warn, ConfigModuleSystemLog_levels.error],
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

describe('useConfigSystemEditForm', () => {
	beforeEach(() => {
		mockEdit.mockClear();
		mockSuccess.mockClear();
		mockError.mockClear();
		mockInfo.mockClear();
	});

	it('initializes model with config data', () => {
		const form = useConfigSystemEditForm({ config: mockConfig });

		expect(form.model.logLevels).toStrictEqual([
			ConfigModuleSystemLog_levels.info,
			ConfigModuleSystemLog_levels.warn,
			ConfigModuleSystemLog_levels.error,
		]);
	});

	it('sets formChanged to true when model changes', async () => {
		const form = useConfigSystemEditForm({ config: mockConfig });

		form.model.logLevels = [ConfigModuleSystemLog_levels.debug];
		await nextTick();

		expect(form.formChanged.value).toBe(true);
	});

	it('throws if form is invalid', async () => {
		const form = useConfigSystemEditForm({ config: mockConfig });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(false),
		} as unknown as FormInstance;

		await expect(form.submit()).rejects.toThrow(ConfigValidationException);
	});

	it('submits and edits successfully', async () => {
		const form = useConfigSystemEditForm({ config: mockConfig });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		await form.submit();

		expect(mockEdit).toHaveBeenCalledWith({
			data: {
				logLevels: form.model.logLevels,
			},
		});

		expect(mockSuccess).toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.OK);
	});

	it('handles edit failure with custom message', async () => {
		mockEdit.mockRejectedValueOnce(new ConfigApiException('API error', 500));

		const form = useConfigSystemEditForm({
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
