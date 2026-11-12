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
	longPressMs: null,
});

const relay = (): ModbusPoint => ({
	key: 'p1',
	name: 'Relay 1',
	channelId: null,
	propertyId: null,
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

	it('moves the address text to the table of a new kind, so Modicon notation keeps the new table', async () => {
		const input: ModbusPoint = {
			...relay(),
			channelCategory: 'binary_input',
			propertyCategory: 'state',
			permissions: ['ro'],
			read: { ...binding(7), registerType: DevicesModbusPluginRegisterType.discrete_input },
			write: null,
		};
		const wrapper = mount(ModbusPointEditor, {
			props: { visible: true, point: input, notation: 'modicon', capabilityEditable: true },
			global: { stubs: { ElDialog: { template: '<div><slot /><slot name="footer" /></div>' } } },
		});
		await flushPromises();

		expect((wrapper.find('input[name="readAddress"]').element as HTMLInputElement).value).toBe('10008');

		wrapper.findAllComponents({ name: 'ElSelect' })[0].vm.$emit('update:model-value', 'temperature.temperature');
		await flushPromises();

		expect((wrapper.find('input[name="readAddress"]').element as HTMLInputElement).value).toBe('30008');

		await wrapper.find('[data-test-id="point-editor-save"]').trigger('click');

		const saved = wrapper.emitted('save')?.[0]?.[0] as ModbusPoint;

		expect(saved).toMatchObject({ channelCategory: 'temperature', dataType: 'float', unit: '°C' });
		expect(saved.read).toMatchObject({
			registerType: DevicesModbusPluginRegisterType.input_register,
			address: 7,
			dataType: DevicesModbusPluginDataType.int16,
		});
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

	const mountPoint = (point: ModbusPoint) =>
		mount(ModbusPointEditor, {
			props: { visible: true, point, notation: 'pdu', capabilityEditable: true },
			global: { stubs: { ElDialog: { template: '<div><slot /><slot name="footer" /></div>' } } },
		});

	const itemByLabel = (wrapper: ReturnType<typeof mountPoint>, column: string) =>
		wrapper.findAllComponents({ name: 'ElFormItem' }).filter((item) => item.props('label') === `devicesModbusPlugin.wizard.points.columns.${column}`);

	const temperature = (): ModbusPoint => ({
		...relay(),
		channelCategory: 'temperature',
		propertyCategory: 'temperature',
		dataType: 'float',
		permissions: ['ro'],
		unit: '°C',
		read: { ...binding(5), registerType: DevicesModbusPluginRegisterType.input_register, dataType: DevicesModbusPluginDataType.int16, scale: 0.1 },
		write: null,
	});

	const buttonPoint = (longPressMs: number | null = null): ModbusPoint => ({
		...relay(),
		channelCategory: 'button',
		propertyCategory: 'event',
		dataType: 'enum',
		permissions: ['ev'],
		format: ['press', 'long_press', 'down', 'up'],
		read: { ...binding(3), registerType: DevicesModbusPluginRegisterType.discrete_input, longPressMs },
		write: null,
	});

	it('edits scale, offset and unit of a temperature point, offering the numeric data types only', async () => {
		const wrapper = mountPoint(temperature());
		await flushPromises();

		expect(itemByLabel(wrapper, 'scale')).toHaveLength(1);
		expect(itemByLabel(wrapper, 'offset')).toHaveLength(1);
		expect(itemByLabel(wrapper, 'unit')).toHaveLength(1);

		const dataTypes = itemByLabel(wrapper, 'dataType')[0]
			.findAllComponents({ name: 'ElOption' })
			.map((option) => option.props('value'));

		expect(dataTypes).toEqual(['int16', 'uint16', 'int32', 'uint32', 'float32']);

		const registerTypes = itemByLabel(wrapper, 'registerType')[0]
			.findAllComponents({ name: 'ElOption' })
			.map((option) => option.props('value'));

		expect(registerTypes).toEqual(['input_register', 'holding_register']);

		await wrapper.find('input[name="pointUnit"]').setValue('K');
		await wrapper.find('[data-test-id="point-editor-save"]').trigger('click');

		expect((wrapper.emitted('save')?.[0]?.[0] as ModbusPoint).unit).toBe('K');
	}, 15_000);

	it('treats an enum template point on a discrete input with a value map as neither bool nor number', async () => {
		const mode: ModbusPoint = {
			...relay(),
			channelCategory: 'heater',
			propertyCategory: 'mode',
			dataType: 'enum',
			permissions: ['ro'],
			format: ['eco', 'comfort'],
			read: {
				...binding(6),
				registerType: DevicesModbusPluginRegisterType.discrete_input,
				valueMap: [
					{ raw: 0, value: 'eco' },
					{ raw: 1, value: 'comfort' },
				],
			},
			write: null,
		};
		const wrapper = mountPoint(mode);
		await flushPromises();

		const optionsOf = (column: string) =>
			itemByLabel(wrapper, column)[0]
				.findAllComponents({ name: 'ElOption' })
				.map((option) => option.props('value'));

		expect(itemByLabel(wrapper, 'dataType')[0].props('error')).toBeUndefined();
		expect(optionsOf('dataType')).toContain(DevicesModbusPluginDataType.bool);
		expect(optionsOf('registerType')).toContain(DevicesModbusPluginRegisterType.discrete_input);
		expect(itemByLabel(wrapper, 'unit')).toHaveLength(0);
		expect(wrapper.find('[data-test-id="point-editor-save"]').attributes('disabled')).toBeUndefined();
	}, 15_000);

	it('keeps the coil option of a number point read from a coil', async () => {
		const point = temperature();
		point.read = { ...binding(5), registerType: DevicesModbusPluginRegisterType.coil };
		const wrapper = mountPoint(point);
		await flushPromises();

		const registerTypes = itemByLabel(wrapper, 'registerType')[0]
			.findAllComponents({ name: 'ElOption' })
			.map((option) => option.props('value'));

		expect(registerTypes).toEqual(['coil', 'input_register', 'holding_register']);
	}, 15_000);

	it('refuses to save a zero scale', async () => {
		const point = temperature();
		point.read!.scale = 0;
		const wrapper = mountPoint(point);
		await flushPromises();

		expect(itemByLabel(wrapper, 'scale')[0].props('error')).toBe('devicesModbusPlugin.wizard.points.errors.scaleZero');
		expect(wrapper.find('[data-test-id="point-editor-save"]').attributes('disabled')).toBeDefined();
	}, 15_000);

	it('offers a long press time for a button event only, between 100 and 10000 ms', async () => {
		const wrapper = mountPoint(buttonPoint());
		await flushPromises();

		const field = itemByLabel(wrapper, 'longPressMs');

		expect(field).toHaveLength(1);

		const input = field[0].findComponent({ name: 'ElInputNumber' });

		expect(input.props()).toMatchObject({ min: 100, max: 10000, step: 100, precision: 0, placeholder: '800' });

		expect(itemByLabel(mountPoint(relay()), 'longPressMs')).toHaveLength(0);
		expect(itemByLabel(mountPoint(temperature()), 'longPressMs')).toHaveLength(0);
	}, 15_000);

	it('saves the long press time, and an empty one as the default', async () => {
		const wrapper = mountPoint(buttonPoint(1200));
		await flushPromises();

		await wrapper.find('[data-test-id="point-editor-save"]').trigger('click');

		expect((wrapper.emitted('save')?.[0]?.[0] as ModbusPoint).read?.longPressMs).toBe(1200);

		const cleared = mountPoint(buttonPoint(1200));
		await flushPromises();

		itemByLabel(cleared, 'longPressMs')[0].findComponent({ name: 'ElInputNumber' }).vm.$emit('update:modelValue', null);
		await flushPromises();
		await cleared.find('[data-test-id="point-editor-save"]').trigger('click');

		expect((cleared.emitted('save')?.[0]?.[0] as ModbusPoint).read?.longPressMs).toBeNull();
	}, 15_000);

	it('keeps the channel of a saved valve point, so its static type sibling stays with it', async () => {
		const valve: ModbusPoint = { ...relay(), channelCategory: 'valve', channelIdentifier: 'valve_1', name: 'Valve 1' };
		const wrapper = mountPoint(valve);
		await flushPromises();

		await wrapper.find('input[name="pointName"]').setValue('Garden valve');
		await wrapper.find('[data-test-id="point-editor-save"]').trigger('click');

		expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
			channelCategory: 'valve',
			propertyCategory: 'on',
			channelIdentifier: 'valve_1',
			name: 'Garden valve',
		});
	}, 15_000);

	it('keeps an existing channel on its category: other capabilities are disabled and refused', async () => {
		const wrapper = mount(ModbusPointEditor, {
			props: {
				visible: true,
				point: { ...relay(), channelId: 'c1', propertyId: 'p1' },
				notation: 'pdu',
				capabilityEditable: true,
				lockedChannelCategory: 'switcher',
			},
			global: { stubs: { ElDialog: { template: '<div><slot /><slot name="footer" /></div>' } } },
		});
		await flushPromises();

		const capability = wrapper.findAllComponents({ name: 'ElSelect' })[0];
		const disabled = Object.fromEntries(
			capability.findAllComponents({ name: 'ElOption' }).map((option) => [option.props('value'), option.props('disabled')])
		);

		expect(disabled['switcher.on']).toBe(false);
		expect(disabled['valve.on']).toBe(true);
		expect(disabled['binary_input.state']).toBe(true);
		expect(wrapper.find('[data-test-id="point-editor-capability-locked"]').exists()).toBe(true);

		capability.vm.$emit('update:model-value', 'binary_input.state');
		await flushPromises();
		await wrapper.find('[data-test-id="point-editor-save"]').trigger('click');

		expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({ channelCategory: 'switcher', propertyCategory: 'on', channelId: 'c1' });
	}, 15_000);
});
