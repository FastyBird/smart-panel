import { type Ref, nextTick, reactive, ref } from 'vue';

import type { FormInstance } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { FormResult } from '../../config';
import type { ISystemConfigEditForm } from '../schemas/config.types';

import SystemConfigForm from './system-config-form.vue';

const useConfigModuleEditFormMock = vi.fn();

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../config', async () => {
	const actual = await vi.importActual('../../config');

	return {
		...actual,
		useConfigModuleEditForm: () => useConfigModuleEditFormMock(),
	};
});

describe('SystemConfigForm', () => {
	let model: ISystemConfigEditForm;
	let formEl: Ref<FormInstance | undefined>;

	beforeEach(() => {
		model = reactive({
			type: 'system-module',
			enabled: true,
			language: 'en_US',
			timezone: 'Europe/Prague',
			latitude: null,
			longitude: null,
			timeFormat: '24h',
			numberFormat: 'comma_dot',
			temperatureUnit: 'celsius',
			windSpeedUnit: 'ms',
			pressureUnit: 'hpa',
			precipitationUnit: 'mm',
			distanceUnit: 'km',
			logLevels: ['info'],
			houseMode: 'home',
			updateChannel: 'auto',
		}) as unknown as ISystemConfigEditForm;

		formEl = ref(undefined);

		useConfigModuleEditFormMock.mockReset().mockReturnValue({
			formEl,
			model,
			formChanged: ref(false),
			submit: vi.fn().mockResolvedValue('saved'),
			formResult: ref(FormResult.NONE),
		});
	});

	const mountForm = () => {
		const wrapper = mount(SystemConfigForm, { props: { config: { type: 'system-module', enabled: true } } });
		const validateField = vi.spyOn(formEl.value as FormInstance, 'validateField').mockResolvedValue(true);

		return { wrapper, validateField };
	};

	const enter = async (wrapper: ReturnType<typeof mountForm>['wrapper'], name: 'latitude' | 'longitude', value: string): Promise<void> => {
		await wrapper.find(`input[name="${name}"]`).setValue(value);
		await nextTick();
		await flushPromises();
	};

	// Each coordinate is valid only together with the other one, so the rule of one depends on the value
	// of the other: changing either must check both, or an error stays on the one that was not touched
	it.each(['latitude', 'longitude'] as const)('checks both coordinates again when the %s changes', async (name) => {
		const { wrapper, validateField } = mountForm();

		await enter(wrapper, name, '45');

		expect(validateField).toHaveBeenCalledWith(['latitude', 'longitude']);
	});

	it('checks both coordinates again when they are cleared', async () => {
		const { wrapper, validateField } = mountForm();

		await enter(wrapper, 'latitude', '45');
		validateField.mockClear();

		await enter(wrapper, 'latitude', '');

		expect(validateField).toHaveBeenCalledWith(['latitude', 'longitude']);
	});

	it('does not check anything while the coordinates stay as they are', async () => {
		const { validateField } = mountForm();

		model.timezone = 'Europe/London';
		await nextTick();
		await flushPromises();

		expect(validateField).not.toHaveBeenCalled();
	});
});
