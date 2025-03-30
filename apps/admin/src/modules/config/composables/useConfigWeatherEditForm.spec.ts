import type { FormInstance } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigWeatherType, ConfigWeatherUnit, PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type } from '../../../openapi';
import { FormResult } from '../config.constants';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';

import { useConfigWeatherEditForm } from './useConfigWeatherEditForm';

const mockConfig = {
	type: ConfigWeatherType.weather,
	location: 'Prague',
	locationType: PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type.city_name,
	unit: ConfigWeatherUnit.celsius,
	openWeatherApiKey: null,
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

vi.mock('../../../common', () => ({
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
}));

describe('useConfigWeatherEditForm', () => {
	beforeEach(() => {
		mockEdit.mockClear();
		mockSuccess.mockClear();
		mockError.mockClear();
		mockInfo.mockClear();
	});

	it('initializes model with config data', () => {
		const form = useConfigWeatherEditForm(mockConfig);

		expect(form.model.location).toBe('Prague');
		expect(form.model.locationType).toBe(PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type.city_name);
		expect(form.model.unit).toBe(ConfigWeatherUnit.celsius);
		expect(form.model.openWeatherApiKey).toBe('');
	});

	it('sets formChanged to true when model changes', async () => {
		const form = useConfigWeatherEditForm(mockConfig);

		form.model.unit = ConfigWeatherUnit.fahrenheit;
		await Promise.resolve();

		expect(form.formChanged.value).toBe(true);
	});

	it('throws if form is invalid', async () => {
		const form = useConfigWeatherEditForm(mockConfig);

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(false),
		} as unknown as FormInstance;

		await expect(form.submit()).rejects.toThrow(ConfigValidationException);
	});

	it('submits and edits successfully', async () => {
		const form = useConfigWeatherEditForm(mockConfig);

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		await form.submit();

		expect(mockEdit).toHaveBeenCalledWith({
			data: {
				location: form.model.location,
				locationType: form.model.locationType,
				unit: form.model.unit,
				openWeatherApiKey: null,
			},
		});

		expect(mockSuccess).toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.OK);
	});

	it('handles edit failure with custom message', async () => {
		mockEdit.mockRejectedValueOnce(new ConfigApiException('API error', 500));

		const form = useConfigWeatherEditForm(mockConfig, {
			error: 'Something went wrong!',
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
