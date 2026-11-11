import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { DevicesModbusPluginDataType, DevicesModbusPluginRegisterType } from '../../../../openapi.constants';
import type { ModbusPoint, ModbusPointBinding } from '../../lib/points';

import ModbusPointEditor from './modbus-point-editor.vue';

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return {
		...actual,
		useI18n: () => ({
			t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
		}),
	};
});

const binding = (address: number): ModbusPointBinding => ({
	registerType: DevicesModbusPluginRegisterType.coil,
	address,
	dataType: DevicesModbusPluginDataType.bool,
	bit: null,
	byteOrder: null,
	wordOrder: null,
	scale: 1,
	offset: 0,
	invert: false,
	valueMap: null,
	writeFunction: null,
	pollIntervalMs: null,
});

const relay = (): ModbusPoint => ({
	key: 'p1',
	name: 'Relay 1',
	channelCategory: 'switcher',
	channelIdentifier: 'relay_1',
	propertyCategory: 'on',
	propertyIdentifier: null,
	propertyName: null,
	format: null,
	dataType: 'bool',
	permissions: ['rw'],
	staticValue: null,
	unit: null,
	read: binding(2),
	write: binding(2),
});

const mountEditor = () =>
	mount(ModbusPointEditor, {
		props: { visible: true, point: relay(), notation: 'pdu', capabilityEditable: true },
		global: {
			stubs: {
				ElDialog: { template: '<div><slot /><slot name="footer" /></div>' },
			},
		},
	});

describe('ModbusPointEditor', () => {
	it('offers the bit only on the read binding and drops a copied bit from the write binding on save', async () => {
		const bitRead: ModbusPointBinding = { ...binding(4), registerType: DevicesModbusPluginRegisterType.holding_register, bit: 3 };
		const wrapper = mount(ModbusPointEditor, {
			props: { visible: true, point: { ...relay(), read: bitRead, write: { ...bitRead } }, notation: 'pdu', capabilityEditable: true },
			global: { stubs: { ElDialog: { template: '<div><slot /><slot name="footer" /></div>' } } },
		});
		await flushPromises();

		const bitLabels = wrapper
			.findAllComponents({ name: 'ElFormItem' })
			.filter((item) => item.props('label') === 'devicesModbusPlugin.wizard.points.columns.bit');

		expect(bitLabels).toHaveLength(1);

		await wrapper.find('[data-test-id="point-editor-save"]').trigger('click');

		const saved = wrapper.emitted('save')?.[0]?.[0] as ModbusPoint;

		expect(saved.read?.bit).toBe(3);
		expect(saved.write?.bit).toBeNull();
	}, 15_000);

	it('starts a recreated write binding at the address typed for the read binding, not at its old address', async () => {
		const wrapper = mountEditor();
		await flushPromises();

		const capability = () => wrapper.findAllComponents({ name: 'ElSelect' })[0];

		capability().vm.$emit('update:model-value', 'binary_input.state');
		await flushPromises();

		expect(wrapper.find('input[name="writeAddress"]').exists()).toBe(false);

		await wrapper.find('input[name="readAddress"]').setValue('7');

		capability().vm.$emit('update:model-value', 'switcher.on');
		await flushPromises();

		expect((wrapper.find('input[name="writeAddress"]').element as HTMLInputElement).value).toBe('7');

		await wrapper.find('[data-test-id="point-editor-save"]').trigger('click');

		const saved = wrapper.emitted('save')?.[0]?.[0] as ModbusPoint;

		expect(saved.read?.address).toBe(7);
		expect(saved.write?.address).toBe(7);
	}, 15_000);

	it('refuses to save a coil read as uint16 and shows why', async () => {
		const wrapper = mountEditor();
		await flushPromises();

		const dataTypeItem = () =>
			wrapper.findAllComponents({ name: 'ElFormItem' }).find((item) => item.props('label') === 'devicesModbusPlugin.wizard.points.columns.dataType')!;

		dataTypeItem().findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', DevicesModbusPluginDataType.uint16);
		await flushPromises();

		expect(dataTypeItem().props('error')).toBe('devicesModbusPlugin.wizard.points.errors.bitTableBool');
		expect(wrapper.find('[data-test-id="point-editor-save"]').attributes('disabled')).toBeDefined();

		await wrapper.find('[data-test-id="point-editor-save"]').trigger('click');

		expect(wrapper.emitted('save')).toBeUndefined();
	}, 15_000);

	it('refuses to save a value map combined with invert', async () => {
		const mapped: ModbusPointBinding = {
			...binding(4),
			registerType: DevicesModbusPluginRegisterType.holding_register,
			dataType: DevicesModbusPluginDataType.uint16,
			invert: true,
			valueMap: [
				{ raw: 0, value: false },
				{ raw: 1, value: true },
			],
		};
		const wrapper = mount(ModbusPointEditor, {
			props: { visible: true, point: { ...relay(), read: mapped, write: null, permissions: ['ro'] }, notation: 'pdu', capabilityEditable: true },
			global: { stubs: { ElDialog: { template: '<div><slot /><slot name="footer" /></div>' } } },
		});
		await flushPromises();

		const invertItem = wrapper
			.findAllComponents({ name: 'ElFormItem' })
			.find((item) => item.props('label') === 'devicesModbusPlugin.wizard.points.columns.invert')!;

		expect(invertItem.props('error')).toBe('devicesModbusPlugin.wizard.points.errors.valueMapInvert');
		expect(wrapper.find('[data-test-id="point-editor-save"]').attributes('disabled')).toBeDefined();
	}, 15_000);
});
