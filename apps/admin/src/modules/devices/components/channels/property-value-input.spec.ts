import { describe, expect, it, vi } from 'vitest';

import { type VueWrapper, mount } from '@vue/test-utils';

import { DevicesModuleChannelPropertyDataType } from '../../../../openapi.constants';

import type { IPropertyValueInputProps } from './property-value-input.types';
import PropertyValueInput from './property-value-input.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

type Property = NonNullable<IPropertyValueInputProps['property']>;

const property = (overrides: Partial<Property>): Property => ({
	dataType: DevicesModuleChannelPropertyDataType.string,
	format: null,
	step: null,
	...overrides,
});

const mountInput = (props: Partial<IPropertyValueInputProps> = {}): VueWrapper => mount(PropertyValueInput, { props: { modelValue: '', ...props } });

describe('PropertyValueInput', (): void => {
	describe('boolean property', (): void => {
		const bool = property({ dataType: DevicesModuleChannelPropertyDataType.bool });

		it('renders a switch', (): void => {
			const wrapper = mountInput({ property: bool, modelValue: false });

			expect(wrapper.findComponent({ name: 'ElSwitch' }).exists()).toBe(true);
			expect(wrapper.findComponent({ name: 'ElInput' }).exists()).toBe(false);
		});

		it.each([
			[true, true],
			['true', true],
			[1, true],
			[false, false],
			['false', false],
			[0, false],
			['', false],
			[null, false],
		])('reads %j as %s', (modelValue, expected): void => {
			const wrapper = mountInput({ property: bool, modelValue });

			expect(wrapper.findComponent({ name: 'ElSwitch' }).props('modelValue')).toBe(expected);
		});

		it('emits the switched value', (): void => {
			const wrapper = mountInput({ property: bool, modelValue: false });

			wrapper.findComponent({ name: 'ElSwitch' }).vm.$emit('update:modelValue', true);

			expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
		});
	});

	describe('enum property', (): void => {
		const enumeration = property({ dataType: DevicesModuleChannelPropertyDataType.enum, format: ['open', 'close', 'stop'] });

		it('renders a select offering the format values', (): void => {
			const wrapper = mountInput({ property: enumeration, modelValue: 'close' });

			const select = wrapper.findComponent({ name: 'ElSelect' });

			expect(select.props('modelValue')).toBe('close');
			expect(select.props('name')).toBe('value');
			expect(wrapper.findAllComponents({ name: 'ElOption' }).map((option) => option.props('value'))).toEqual(['open', 'close', 'stop']);
		});

		it('offers only the values passing the option filter', (): void => {
			const wrapper = mountInput({ property: enumeration, optionFilter: (value: string): boolean => value !== 'stop' });

			expect(wrapper.findAllComponents({ name: 'ElOption' }).map((option) => option.props('value'))).toEqual(['open', 'close']);
		});

		it('ignores the format values which are not strings', (): void => {
			const wrapper = mountInput({ property: property({ dataType: DevicesModuleChannelPropertyDataType.enum, format: ['open', 1, null] }) });

			expect(wrapper.findAllComponents({ name: 'ElOption' }).map((option) => option.props('value'))).toEqual(['open']);
		});

		it('emits the selected value', (): void => {
			const wrapper = mountInput({ property: enumeration });

			wrapper.findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', 'open');

			expect(wrapper.emitted('update:modelValue')).toEqual([['open']]);
		});

		it.each([[null], [[]], [[1, 2]]])('renders a text input for the format %j', (format): void => {
			const wrapper = mountInput({ property: property({ dataType: DevicesModuleChannelPropertyDataType.enum, format }) });

			expect(wrapper.findComponent({ name: 'ElSelect' }).exists()).toBe(false);
			expect(wrapper.findComponent({ name: 'ElInput' }).exists()).toBe(true);
		});
	});

	describe('numeric property', (): void => {
		it.each([
			DevicesModuleChannelPropertyDataType.char,
			DevicesModuleChannelPropertyDataType.uchar,
			DevicesModuleChannelPropertyDataType.short,
			DevicesModuleChannelPropertyDataType.ushort,
			DevicesModuleChannelPropertyDataType.int,
			DevicesModuleChannelPropertyDataType.uint,
			DevicesModuleChannelPropertyDataType.float,
		])('renders a number input for %s', (dataType): void => {
			const wrapper = mountInput({ property: property({ dataType }), modelValue: 5 });

			expect(wrapper.findComponent({ name: 'ElInputNumber' }).exists()).toBe(true);
		});

		it('takes the limits from the format and the step from the property', (): void => {
			const wrapper = mountInput({
				property: property({ dataType: DevicesModuleChannelPropertyDataType.float, format: [10, 30], step: 0.5 }),
				modelValue: 21,
			});

			const input = wrapper.findComponent({ name: 'ElInputNumber' });

			expect(input.props('min')).toBe(10);
			expect(input.props('max')).toBe(30);
			expect(input.props('step')).toBe(0.5);
			expect(input.props('modelValue')).toBe(21);
			expect(input.props('name')).toBe('value');
		});

		it('leaves the limits open and steps by one without a format and a step', (): void => {
			const unlimited = mountInput({ property: property({ dataType: DevicesModuleChannelPropertyDataType.int }), modelValue: 1 });
			const limited = mountInput({ property: property({ dataType: DevicesModuleChannelPropertyDataType.int, format: [0, 100] }), modelValue: 1 });
			const lowerOnly = mountInput({ property: property({ dataType: DevicesModuleChannelPropertyDataType.int, format: [5, null] }), modelValue: 5 });

			// Without a limit the number input keeps its own defaults
			expect(unlimited.findComponent({ name: 'ElInputNumber' }).props('min')).not.toBe(limited.findComponent({ name: 'ElInputNumber' }).props('min'));
			expect(unlimited.findComponent({ name: 'ElInputNumber' }).props('max')).not.toBe(limited.findComponent({ name: 'ElInputNumber' }).props('max'));
			expect(unlimited.findComponent({ name: 'ElInputNumber' }).props('step')).toBe(1);
			expect(lowerOnly.findComponent({ name: 'ElInputNumber' }).props('min')).toBe(5);
			expect(lowerOnly.findComponent({ name: 'ElInputNumber' }).props('max')).toBe(unlimited.findComponent({ name: 'ElInputNumber' }).props('max'));
		});

		it.each([
			['12.5', 12.5],
			['', 0],
			['abc', 0],
			[null, 0],
			[true, 0],
		])('reads %j as %d', (modelValue, expected): void => {
			const wrapper = mountInput({ property: property({ dataType: DevicesModuleChannelPropertyDataType.float }), modelValue });

			expect(wrapper.findComponent({ name: 'ElInputNumber' }).props('modelValue')).toBe(expected);
		});

		it('emits the entered number', (): void => {
			const wrapper = mountInput({ property: property({ dataType: DevicesModuleChannelPropertyDataType.int }), modelValue: 1 });

			wrapper.findComponent({ name: 'ElInputNumber' }).vm.$emit('update:modelValue', 7);

			expect(wrapper.emitted('update:modelValue')).toEqual([[7]]);
		});
	});

	describe('other property', (): void => {
		it.each([
			[property({ dataType: DevicesModuleChannelPropertyDataType.string })],
			[property({ dataType: DevicesModuleChannelPropertyDataType.unknown })],
			[undefined],
			[null],
		])('renders a text input for %j', (item): void => {
			const wrapper = mountInput({ property: item, modelValue: 'text' });

			const input = wrapper.findComponent({ name: 'ElInput' });

			expect(input.exists()).toBe(true);
			expect(input.props('modelValue')).toBe('text');
			expect(wrapper.findComponent({ name: 'ElSwitch' }).exists()).toBe(false);
			expect(wrapper.findComponent({ name: 'ElSelect' }).exists()).toBe(false);
			expect(wrapper.findComponent({ name: 'ElInputNumber' }).exists()).toBe(false);
		});

		it.each([
			[42, '42'],
			[false, 'false'],
			[null, ''],
			[undefined, ''],
		])('shows %j as "%s"', (modelValue, expected): void => {
			const wrapper = mountInput({ modelValue });

			expect(wrapper.findComponent({ name: 'ElInput' }).props('modelValue')).toBe(expected);
		});

		it('emits the entered text', (): void => {
			const wrapper = mountInput();

			wrapper.findComponent({ name: 'ElInput' }).vm.$emit('update:modelValue', 'hello');

			expect(wrapper.emitted('update:modelValue')).toEqual([['hello']]);
		});
	});

	it('uses the default placeholder and name unless given', (): void => {
		const defaults = mountInput();
		const custom = mountInput({ placeholder: 'Enter a value', name: 'target' });

		expect(defaults.findComponent({ name: 'ElInput' }).props('placeholder')).toBe('devicesModule.fields.propertyValue.placeholder');
		expect(defaults.find('input').attributes('name')).toBe('value');
		expect(custom.findComponent({ name: 'ElInput' }).props('placeholder')).toBe('Enter a value');
		expect(custom.find('input').attributes('name')).toBe('target');
	});
});
