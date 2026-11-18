import { computed, reactive, ref } from 'vue';

import AsyncValidator, { type Rules } from 'async-validator';
import { type FormInstance } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { DevicesModbusPluginFraming } from '../../../../openapi.constants';
import type { IUseModbusEndpointForm } from '../../composables/useModbusEndpointForm';
import type { IModbusEndpoint } from '../../store/endpoints.types';

import ModbusEndpointForm from './modbus-endpoint-form.vue';

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

const formState = (submit: () => Promise<IModbusEndpoint>): IUseModbusEndpointForm =>
	({
		model: reactive({
			name: 'Gateway',
			host: '10.0.0.5',
			port: 502,
			framing: DevicesModbusPluginFraming.tcp,
			connectTimeoutMs: 2000,
			requestTimeoutMs: 1000,
			interRequestDelayMs: 0,
			maxInFlight: 1,
			enabled: true,
		}),
		fieldErrors: reactive({}),
		formAlert: ref(null),
		submitting: ref(false),
		maxInFlightDisabled: computed(() => false),
		requiredFilled: computed(() => true),
		setFraming: vi.fn(),
		submit,
	}) as unknown as IUseModbusEndpointForm;

describe('ModbusEndpointForm', () => {
	it('keeps required numeric fields localized and blocks saving until the value is corrected', async () => {
		const submit = vi.fn(async () => ({ id: 'e1' }) as IModbusEndpoint);
		const wrapper = mount(ModbusEndpointForm, { props: { form: formState(submit) } });
		// Keep the real validation rules and model, while bypassing Element Plus's CommonJS
		// default-export mismatch under Vitest SSR (also isolated in sign-in-form.spec.ts).
		const form = wrapper.getComponent({ name: 'ElForm' });
		const Schema = (AsyncValidator as unknown as { default?: typeof AsyncValidator }).default ?? AsyncValidator;
		const validate = vi.spyOn(form.vm.$.exposed as FormInstance, 'validate').mockImplementation(async () => {
			await new Schema(form.props('rules') as Rules).validate(form.props('model'));
			return true;
		});
		const port = wrapper.findAllComponents({ name: 'ElFormItem' }).find((field) => field.props('prop') === 'port')!;
		expect(port.props('required')).toBe(true);
		port.getComponent({ name: 'ElInputNumber' }).vm.$emit('update:modelValue', null);
		await flushPromises();
		await wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(submit).not.toHaveBeenCalled();
		await expect(validate.mock.results[0]!.value).rejects.toMatchObject({
			fields: { port: [expect.objectContaining({ message: 'devicesModule.wizard.validation.numberRange' })] },
		});
		port.getComponent({ name: 'ElInputNumber' }).vm.$emit('update:modelValue', 502);
		await flushPromises();
		await wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(submit).toHaveBeenCalledTimes(1);
		validate.mockRestore();
		wrapper.unmount();
	});
	it('locks the fields while a save is pending, so no edit is made that the request would not carry', async () => {
		let finish!: (endpoint: IModbusEndpoint) => void;
		const submit = vi.fn(() => new Promise<IModbusEndpoint>((resolve) => (finish = resolve)));

		const wrapper = mount(ModbusEndpointForm, { props: { form: formState(submit) } });
		const form = () => wrapper.findComponent({ name: 'ElForm' });

		expect(form().props('disabled')).toBe(false);

		const saving = (wrapper.vm as unknown as { submit: () => Promise<void> }).submit();
		await flushPromises();

		expect(submit).toHaveBeenCalledTimes(1);
		expect(form().props('disabled')).toBe(true);
		expect(wrapper.find('input[name="host"]').attributes('disabled')).toBeDefined();

		finish({ id: 'e1' } as IModbusEndpoint);
		await saving;
		await flushPromises();

		expect(form().props('disabled')).toBe(false);
		expect(wrapper.emitted('saved')).toHaveLength(1);
	}, 15_000);
});
