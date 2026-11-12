import { defineComponent } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { DevicesModuleChannelPropertyCategory, DevicesModuleChannelPropertyDataType } from '../../../../openapi.constants';
import { AutomationNodeKind } from '../../automations.constants';
import type { AutomationLookupProperty } from '../../nodes/nodes.summaries';
import type { IAutomationGraphIssue } from '../../store/automations.store.types';
import type { IAutomationNodeType } from '../../store/node-types.store.types';

import AutomationDevicePropertyChangedForm from './automation-device-property-changed-form.vue';
import AutomationDevicePropertyCompareForm from './automation-device-property-compare-form.vue';
import AutomationDevicePropertySetForm from './automation-device-property-set-form.vue';
import AutomationDurationInput from './automation-duration-input.vue';
import AutomationNotificationSendForm from './automation-notification-send-form.vue';
import AutomationPropertyValueInput from './automation-property-value-input.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
		te: () => false,
	}),
}));

const property = (overrides: Partial<AutomationLookupProperty>): AutomationLookupProperty => ({
	id: 'p',
	name: null,
	category: DevicesModuleChannelPropertyCategory.generic,
	unit: null,
	dataType: DevicesModuleChannelPropertyDataType.string,
	format: null,
	step: null,
	permissions: [],
	...overrides,
});

const PROPERTIES: AutomationLookupProperty[] = [
	property({ id: 'p-locked', category: DevicesModuleChannelPropertyCategory.locked, dataType: DevicesModuleChannelPropertyDataType.bool }),
	property({ id: 'p-temperature', category: DevicesModuleChannelPropertyCategory.temperature, dataType: DevicesModuleChannelPropertyDataType.float }),
	property({ id: 'p-detected', category: DevicesModuleChannelPropertyCategory.detected, dataType: DevicesModuleChannelPropertyDataType.bool }),
	property({
		id: 'p-position',
		category: DevicesModuleChannelPropertyCategory.position,
		dataType: DevicesModuleChannelPropertyDataType.uchar,
		format: [0, 100],
	}),
	property({ id: 'p-label', category: DevicesModuleChannelPropertyCategory.generic, dataType: DevicesModuleChannelPropertyDataType.string }),
	property({
		id: 'p-status',
		category: DevicesModuleChannelPropertyCategory.status,
		dataType: DevicesModuleChannelPropertyDataType.enum,
		format: ['locked', 'unlocked', 'jammed'],
	}),
];

vi.mock('../../composables/useAutomationNodeLookups', () => ({
	useAutomationNodeLookups: () => ({
		device: (id: string) =>
			({ 'd-lock': { name: 'Front door', category: 'lock' }, 'd-door': { name: 'Garage', category: 'door' } })[id] ?? {
				name: 'Sensor',
				category: 'sensor',
			},
		channel: (id: string) =>
			({ 'c-lock': { name: 'Lock', category: 'lock' }, 'c-door': { name: 'Door', category: 'door' } })[id] ?? { name: 'Sensor', category: 'sensor' },
		property: (id: string) => PROPERTIES.find((item) => item.id === id) ?? null,
		scene: () => null,
		ensureDevices: async () => undefined,
		ensureScenes: async () => undefined,
	}),
}));

// The picker reads the devices from their stores; here it only has to report what is picked
const DevicePropertyPicker = defineComponent({
	name: 'DevicePropertyPicker',
	props: {
		deviceId: { type: String, default: null },
		channelId: { type: String, default: null },
		propertyId: { type: String, default: null },
		access: { type: String, default: undefined },
		propertyFilter: { type: Function, default: undefined },
		deviceProp: { type: String, default: undefined },
		channelProp: { type: String, default: undefined },
		propertyProp: { type: String, default: undefined },
	},
	emits: ['update:deviceId', 'update:channelId', 'update:propertyId', 'change'],
	template: '<div data-test-id="picker-stub" />',
});

const nodeType = (type: string, kind: AutomationNodeKind, configSchema: Record<string, unknown> = { type: 'object' }): IAutomationNodeType => ({
	type,
	kind,
	name: type,
	description: '',
	ports: { inputs: [], outputs: [] },
	configSchema,
});

const issue = (overrides: Partial<IAutomationGraphIssue>): IAutomationGraphIssue => ({
	severity: 'error',
	code: 'invalid_config',
	message: 'Not valid.',
	blocking: true,
	node_id: 'n1',
	...overrides,
});

const lockWrite = { device_id: 'd-lock', channel_id: 'c-lock', property_id: 'p-locked' };

describe('automation card forms', (): void => {
	let wrapper: VueWrapper;

	const mountForm = async (component: unknown, props: Record<string, unknown>): Promise<void> => {
		wrapper = mount(component as Parameters<typeof mount>[0], {
			props,
			global: { stubs: { DevicePropertyPicker, Icon: true } },
		});

		await flushPromises();
	};

	const lastConfig = (): Record<string, unknown> => {
		const events = wrapper.emitted('update:config') ?? [];

		return events[events.length - 1]?.[0] as Record<string, unknown>;
	};

	// The options of the select inside the element; they are teleported out of it, so they are found
	// through the component, not the markup
	const optionValues = (selector: string): unknown[] =>
		wrapper
			.find(selector)
			.findComponent({ name: 'ElSelect' })
			.findAllComponents({ name: 'ElOption' })
			.map((option) => option.props('value'));

	afterEach((): void => {
		wrapper.unmount();
	});

	describe('set device value', (): void => {
		const set = nodeType('device.property.set', AutomationNodeKind.action);

		it('does not offer the value that would unlock a lock', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertySetForm, { nodeType: set, config: { writes: [{ ...lockWrite }] } });

			expect(optionValues('[data-test-write="0"] [data-test-id="value-boolean"]')).toEqual([true]);
		});

		it('leaves out the enum values that would unlock, and names a value that still would', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertySetForm, {
				nodeType: set,
				config: { writes: [{ ...lockWrite, property_id: 'p-status', value: 'unlocked' }] },
			});

			expect(optionValues('[data-test-write="0"] [data-test-field="writes.0.value"]')).toEqual(['locked', 'jammed']);
			expect(wrapper.find('[data-test-id="value-unsafe"]').text()).toContain('automations.editor.safety.kinds.unlock');
		});

		it('shows the refusal of the backend on the value it is about', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertySetForm, {
				nodeType: set,
				config: {
					writes: [
						{ device_id: 'd-1', channel_id: 'c-1', property_id: 'p-temperature', value: 1 },
						{ ...lockWrite, value: false },
					],
				},
				issues: [issue({ code: 'safety_reducing_action', field: 'writes.1.value', message: 'An automation can not unlock a lock.' })],
			});

			expect(wrapper.find('[data-test-write="0"] [data-test-id="write-refused"]').exists()).toBe(false);

			const refusal = wrapper.find('[data-test-write="1"] [data-test-id="write-refused"]');

			expect(refusal.text()).toContain('automations.editor.safety.refused');
			expect(refusal.text()).toContain('An automation can not unlock a lock.');
		});

		it('shows the warning about a value its own trigger watches', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertySetForm, {
				nodeType: set,
				config: { writes: [{ ...lockWrite, value: true }] },
				issues: [issue({ severity: 'warning', code: 'self_triggering_write', field: 'writes.0.property_id', message: 'Loops.' })],
			});

			expect(wrapper.find('[data-test-write="0"] [data-test-id="write-warning"]').exists()).toBe(true);
		});

		it('starts with one value to fill in and sets it once a device is picked', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertySetForm, { nodeType: set, config: {} });

			expect(wrapper.findAll('[data-test-write]')).toHaveLength(1);

			wrapper.findComponent(DevicePropertyPicker).vm.$emit('update:deviceId', 'd-lock');

			expect(lastConfig()).toEqual({ writes: [{ device_id: 'd-lock' }] });
		});

		it('adds and removes values', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertySetForm, { nodeType: set, config: { writes: [{ ...lockWrite, value: true }] } });

			await wrapper.find('[data-test-id="add-write"]').trigger('click');

			expect(wrapper.findAll('[data-test-write]')).toHaveLength(2);

			await wrapper.find('[data-test-write="1"] [data-test-id="remove-write"]').trigger('click');

			expect(lastConfig()).toEqual({ writes: [{ ...lockWrite, value: true }] });
			expect(wrapper.findAll('[data-test-write]')).toHaveLength(1);
		});

		it('sets an empty text, which is a value of its own', async (): Promise<void> => {
			const write = { device_id: 'd-1', channel_id: 'c-1', property_id: 'p-label' };

			await mountForm(AutomationDevicePropertySetForm, { nodeType: set, config: { writes: [{ ...write, value: 'Hello' }] } });

			wrapper.find('[data-test-write="0"]').findComponent(AutomationPropertyValueInput).find('input').setValue('');

			expect(lastConfig()).toEqual({ writes: [{ ...write, value: '' }] });
		});

		it('keeps a stored value out of the range taken until it is edited', async (): Promise<void> => {
			// A door opened by an automation saved before; the backend refuses it on save, and the form says why
			await mountForm(AutomationDevicePropertySetForm, {
				nodeType: set,
				config: { writes: [{ device_id: 'd-door', channel_id: 'c-door', property_id: 'p-position', value: 50 }] },
			});

			expect(wrapper.emitted('update:config')).toBeUndefined();
			expect(wrapper.find('[data-test-id="value-unsafe"]').exists()).toBe(true);
		});

		it('keeps each value at its place in the configuration, past an entry that is not a value', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertySetForm, {
				nodeType: set,
				config: { writes: [null, { ...lockWrite, value: false }] },
				issues: [issue({ code: 'safety_reducing_action', field: 'writes.1.value', message: 'An automation can not unlock a lock.' })],
			});

			expect(wrapper.findAll('[data-test-write]')).toHaveLength(2);
			expect(wrapper.find('[data-test-write="1"] [data-test-id="write-refused"]').text()).toContain('An automation can not unlock a lock.');

			wrapper.find('[data-test-write="1"]').findComponent(AutomationPropertyValueInput).vm.$emit('update:modelValue', true);

			expect(lastConfig()).toEqual({ writes: [null, { ...lockWrite, value: true }] });
		});

		it('shows an entry that is not a value at its place, to be removed or replaced', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertySetForm, {
				nodeType: set,
				config: { writes: [null, { ...lockWrite, value: false }] },
			});

			expect(wrapper.findAll('[data-test-write]')).toHaveLength(2);
			expect(wrapper.find('[data-test-write="0"] [data-test-id="write-malformed"]').exists()).toBe(true);
			expect(wrapper.find('[data-test-write="1"] [data-test-id="write-malformed"]').exists()).toBe(false);

			await wrapper.find('[data-test-write="0"] [data-test-id="remove-write"]').trigger('click');

			expect(lastConfig()).toEqual({ writes: [{ ...lockWrite, value: false }] });
		});

		it('replaces an entry that is not a value by the property picked in its place', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertySetForm, { nodeType: set, config: { writes: [null, { ...lockWrite, value: false }] } });

			wrapper.find('[data-test-write="0"]').findComponent(DevicePropertyPicker).vm.$emit('update:deviceId', 'd-1');

			expect(lastConfig()).toEqual({ writes: [{ device_id: 'd-1' }, { ...lockWrite, value: false }] });
		});

		it('takes a list in place of a value for an entry that is not one, and replaces it whole', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertySetForm, { nodeType: set, config: { writes: [[123]] } });

			expect(wrapper.find('[data-test-write="0"]').text()).toContain('automations.editor.fields.set.malformed');

			wrapper.find('[data-test-write="0"]').findComponent(DevicePropertyPicker).vm.$emit('update:deviceId', 'd-1');

			expect(lastConfig()).toEqual({ writes: [{ device_id: 'd-1' }] });
		});

		it('lets a single entry that is not a value be removed', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertySetForm, { nodeType: set, config: { writes: [null] } });

			expect(wrapper.findAll('[data-test-write]')).toHaveLength(1);

			await wrapper.find('[data-test-write="0"] [data-test-id="remove-write"]').trigger('click');

			expect(lastConfig()).toEqual({});
		});

		it('shows every entry when all of them are not values, the limit reached', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertySetForm, { nodeType: set, config: { writes: Array.from({ length: 20 }, () => null) } });

			expect(wrapper.findAll('[data-test-write]')).toHaveLength(20);
			expect(wrapper.findAll('[data-test-id="remove-write"]')).toHaveLength(20);
			expect(wrapper.find('[data-test-id="add-write"]').attributes('disabled')).toBeDefined();
		});

		it('shows a problem of a value that no field of its row is about on that row, once', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertySetForm, {
				nodeType: set,
				config: { writes: [{ ...lockWrite, value: true, extra: true }] },
				issues: [issue({ field: 'writes.0', message: 'This value is broken.' })],
			});

			const rowErrors = wrapper
				.find('[data-test-write="0"]')
				.findAll('[data-test-id="write-errors"]')
				.map((error) => error.text());

			expect(rowErrors).toEqual(['This value is broken.', 'automations.editor.validation.unknownField']);
			expect(wrapper.text().split('automations.editor.validation.unknownField')).toHaveLength(2);
			expect(wrapper.text().split('This value is broken.')).toHaveLength(2);
		});

		it('drops a value the newly picked property can not hold', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertySetForm, {
				nodeType: set,
				config: { writes: [{ device_id: 'd-1', channel_id: 'c-1', property_id: 'p-temperature', value: 21 }] },
			});

			wrapper.findComponent(DevicePropertyPicker).vm.$emit('update:propertyId', 'p-detected');

			expect(lastConfig()).toEqual({ writes: [{ device_id: 'd-1', channel_id: 'c-1', property_id: 'p-detected' }] });
		});
	});

	describe('device value changes', (): void => {
		const changed = nodeType('device.property.changed', AutomationNodeKind.trigger);

		it('offers a threshold only for a property that holds a number', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertyChangedForm, {
				nodeType: changed,
				config: { device_id: 'd-1', channel_id: 'c-1', property_id: 'p-detected' },
			});

			expect(optionValues('[data-test-field="mode"]')).toEqual(['any', 'to', 'from', 'fromTo']);

			await wrapper.setProps({ config: { device_id: 'd-1', channel_id: 'c-1', property_id: 'p-temperature' } });

			expect(optionValues('[data-test-field="mode"]')).toContain('above');
		});

		it('keeps only what the new way to start uses', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertyChangedForm, {
				nodeType: changed,
				config: { device_id: 'd-1', channel_id: 'c-1', property_id: 'p-temperature', above: 25, hysteresis: 1, for_seconds: 60 },
			});

			wrapper.find('[data-test-field="mode"]').findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', 'below');

			expect(lastConfig()).toEqual({ device_id: 'd-1', channel_id: 'c-1', property_id: 'p-temperature', below: 25, hysteresis: 1, for_seconds: 60 });

			wrapper.find('[data-test-field="mode"]').findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', 'from');

			expect(lastConfig()).toEqual({ device_id: 'd-1', channel_id: 'c-1', property_id: 'p-temperature' });
		});

		const target = { device_id: 'd-1', channel_id: 'c-1', property_id: 'p-temperature' };

		const chooseMode = (mode: string): void => {
			wrapper.find('[data-test-field="mode"]').findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', mode);
		};

		const enter = (field: string, value: unknown): void => {
			wrapper.find(`[data-test-field="${field}"]`).findComponent(AutomationPropertyValueInput).vm.$emit('update:modelValue', value);
		};

		// The editor hands back what the form emitted, as it does with every edit
		const handBack = async (): Promise<void> => {
			await wrapper.setProps({ config: lastConfig() });
		};

		const lastInvalid = (): unknown => (wrapper.emitted('update:invalid') ?? []).at(-1)?.[0];

		it('keeps a way to start that takes two values while they are entered one by one', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertyChangedForm, { nodeType: changed, config: { ...target } });

			chooseMode('fromTo');
			await handBack();

			enter('from', 18);
			await handBack();

			expect(wrapper.find('[data-test-field="mode"]').findComponent({ name: 'ElSelect' }).props('modelValue')).toBe('fromTo');
			expect(wrapper.find('[data-test-field="to"]').exists()).toBe(true);

			enter('to', 22);
			await handBack();

			expect(lastConfig()).toEqual({ ...target, from: 18, to: 22 });
		});

		it('keeps the editor from saving while the way to start chosen lacks its value', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertyChangedForm, { nodeType: changed, config: { ...target } });

			expect(lastInvalid()).toBe(false);

			chooseMode('to');
			await handBack();

			// Saved now, the trigger would start on any change
			expect(lastInvalid()).toBe(true);

			enter('to', 21);
			await handBack();

			expect(lastInvalid()).toBe(false);

			// A value cleared again leaves the way to start chosen, and unfinished
			enter('to', undefined);
			await handBack();

			expect(wrapper.find('[data-test-field="to"]').exists()).toBe(true);
			expect(lastInvalid()).toBe(true);
		});

		it('takes a threshold that is null for one not entered, as the backend does', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertyChangedForm, { nodeType: changed, config: { ...target, above: null } });

			// Saved as it is, the trigger starts on any change
			expect(wrapper.find('[data-test-field="mode"]').findComponent({ name: 'ElSelect' }).props('modelValue')).toBe('any');

			chooseMode('above');
			await handBack();

			expect(lastInvalid()).toBe(true);
		});

		it('keeps the way to start chosen while the graph is handed over again unchanged', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertyChangedForm, { nodeType: changed, config: { ...target } });

			chooseMode('fromTo');
			await handBack();

			enter('from', 18);
			await handBack();

			// A card moved: the editor reads the whole graph again, every configuration a new object
			await wrapper.setProps({ config: { ...target, from: 18 } });
			await wrapper.setProps({ config: { ...target, from: 18 } });

			expect(wrapper.find('[data-test-field="mode"]').findComponent({ name: 'ElSelect' }).props('modelValue')).toBe('fromTo');
			expect(wrapper.find('[data-test-field="to"]').exists()).toBe(true);
			expect(lastInvalid()).toBe(true);

			// An undo that changes the configuration is read again
			await wrapper.setProps({ config: { ...target } });

			expect(wrapper.find('[data-test-field="mode"]').findComponent({ name: 'ElSelect' }).props('modelValue')).toBe('any');
			expect(lastInvalid()).toBe(false);
		});

		it('follows a configuration changed from outside, back to any change', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertyChangedForm, { nodeType: changed, config: { ...target, to: 21 } });

			// An undo, say
			await wrapper.setProps({ config: { ...target } });

			expect(wrapper.find('[data-test-field="mode"]').findComponent({ name: 'ElSelect' }).props('modelValue')).toBe('any');
			expect(wrapper.find('[data-test-field="to"]').exists()).toBe(false);
			expect(lastInvalid()).toBe(false);
		});

		it('does not change a stored hysteresis below zero when it is shown', async (): Promise<void> => {
			const config = { device_id: 'd-1', channel_id: 'c-1', property_id: 'p-temperature', above: 25, hysteresis: -1 };

			await mountForm(AutomationDevicePropertyChangedForm, { nodeType: changed, config });

			expect(wrapper.emitted('update:config')).toBeUndefined();

			// An undo back to it does not change it either
			await wrapper.setProps({ config: { ...config, hysteresis: 1 } });
			await wrapper.setProps({ config });
			await flushPromises();

			expect(wrapper.emitted('update:config')).toBeUndefined();
		});

		it('shows the problems of a field as it is filled in', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertyChangedForm, {
				nodeType: changed,
				config: { device_id: 'd-1', channel_id: 'c-1', property_id: 'p-temperature', above: 25, hysteresis: -1 },
			});

			// The form item shows its error after a short delay
			await vi.waitFor((): void =>
				expect(wrapper.find('[data-test-field="hysteresis"]').text()).toContain('automations.editor.validation.hysteresis')
			);
		});
	});

	describe('device value is', (): void => {
		const compare = nodeType('device.property.compare', AutomationNodeKind.condition);

		it('offers the comparisons the property can take', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertyCompareForm, {
				nodeType: compare,
				config: { device_id: 'd-1', channel_id: 'c-1', property_id: 'p-detected' },
			});

			expect(optionValues('[data-test-field="operator"]')).toEqual(['eq', 'neq']);
		});

		it('follows the table of the backend', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertyCompareForm, {
				nodeType: nodeType('device.property.compare', AutomationNodeKind.condition, { 'x-operators-by-value-kind': { number: ['eq', 'between'] } }),
				config: { device_id: 'd-1', channel_id: 'c-1', property_id: 'p-temperature' },
			});

			expect(optionValues('[data-test-field="operator"]')).toEqual(['eq', 'between']);
		});

		it('drops the operands another operator does not use', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertyCompareForm, {
				nodeType: compare,
				config: { device_id: 'd-1', channel_id: 'c-1', property_id: 'p-temperature', operator: 'gt', value: 21 },
			});

			wrapper.find('[data-test-field="operator"]').findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', 'between');

			expect(lastConfig()).toEqual({ device_id: 'd-1', channel_id: 'c-1', property_id: 'p-temperature', operator: 'between' });
		});

		it('says which entry of a list of numbers is not a number', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertyCompareForm, {
				nodeType: compare,
				config: { device_id: 'd-1', channel_id: 'c-1', property_id: 'p-temperature', operator: 'in', values: [10] },
			});

			wrapper.find('[data-test-field="values"]').findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', [10, '20x']);

			expect(lastConfig()).toEqual({ device_id: 'd-1', channel_id: 'c-1', property_id: 'p-temperature', operator: 'in', values: [10] });

			await vi.waitFor((): void =>
				expect(wrapper.find('[data-test-field="values"]').text()).toContain('automations.editor.fields.compare.values.notNumber')
			);

			// Gone with the next entry that is one
			wrapper.find('[data-test-field="values"]').findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', [10, '20']);

			expect(lastConfig()).toEqual(expect.objectContaining({ values: [10, 20] }));

			await vi.waitFor((): void =>
				expect(wrapper.find('[data-test-field="values"]').text()).not.toContain('automations.editor.fields.compare.values.notNumber')
			);
		});

		it('names a first entry that is not a number over the list being empty', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertyCompareForm, {
				nodeType: compare,
				config: { device_id: 'd-1', channel_id: 'c-1', property_id: 'p-temperature', operator: 'in', values: [] },
			});

			wrapper.find('[data-test-field="values"]').findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', ['20x']);

			expect(lastConfig()).not.toHaveProperty('values');

			await vi.waitFor((): void =>
				expect(wrapper.find('[data-test-field="values"]').text()).toContain('automations.editor.fields.compare.values.notNumber')
			);
		});

		it('drops an operator the newly picked property can not be compared with', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertyCompareForm, {
				nodeType: compare,
				config: { device_id: 'd-1', channel_id: 'c-1', property_id: 'p-temperature', operator: 'gt', value: 21 },
			});

			wrapper.findComponent(DevicePropertyPicker).vm.$emit('update:propertyId', 'p-detected');

			expect(lastConfig()).toEqual({ device_id: 'd-1', channel_id: 'c-1', property_id: 'p-detected' });
		});
	});

	describe('every card form', (): void => {
		it('disables the whole form, the device picked included, while the editor can not take edits', async (): Promise<void> => {
			const forms: [unknown, string, Record<string, unknown>][] = [
				[AutomationDevicePropertySetForm, 'device.property.set', { writes: [{ ...lockWrite }] }],
				[AutomationDevicePropertyChangedForm, 'device.property.changed', { ...lockWrite }],
				[AutomationDevicePropertyCompareForm, 'device.property.compare', { ...lockWrite }],
				[AutomationNotificationSendForm, 'notification.send', {}],
			];

			for (const [component, type, config] of forms) {
				await mountForm(component, { nodeType: nodeType(type, AutomationNodeKind.action), config, disabled: true });

				expect(wrapper.findComponent({ name: 'ElForm' }).props('disabled'), type).toBe(true);

				wrapper.unmount();
			}

			// Left mounted for the unmount after each test
			await mountForm(AutomationNotificationSendForm, { nodeType: nodeType('notification.send', AutomationNodeKind.action), config: {} });
		});
	});

	describe('duration', (): void => {
		it('keeps a duration within its limit when the unit is changed', async (): Promise<void> => {
			await mountForm(AutomationDurationInput, { modelValue: 120, max: 3600 });

			wrapper.find('[data-test-id="duration-unit"]').findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', 'hours');

			expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([3600]);
		});
		it.each([
			['none at all', 0, 3600],
			['a part of a second', 1.5, 3600],
			['longer than taken', 7200, 3600],
		])('does not change a stored duration of %s when it is shown', async (_name: string, seconds: number, max: number): Promise<void> => {
			await mountForm(AutomationDurationInput, { modelValue: seconds, max });

			expect(wrapper.emitted('update:modelValue')).toBeUndefined();

			// An undo back to it does not change it either
			await wrapper.setProps({ modelValue: 60 });
			await wrapper.setProps({ modelValue: seconds });

			expect(wrapper.emitted('update:modelValue')).toBeUndefined();
		});
	});

	describe('value', (): void => {
		it('does not change a stored number out of the range of the property when it is shown', async (): Promise<void> => {
			await mountForm(AutomationPropertyValueInput, {
				modelValue: 150,
				property: { dataType: DevicesModuleChannelPropertyDataType.uchar, format: [0, 100], step: null },
			});

			expect(wrapper.emitted('update:modelValue')).toBeUndefined();
			expect(wrapper.find('[data-test-id="value-out-of-range"]').exists()).toBe(true);

			// An undo back to it does not change it either
			await wrapper.setProps({ modelValue: 50 });
			await wrapper.setProps({ modelValue: 150 });

			expect(wrapper.emitted('update:modelValue')).toBeUndefined();
		});
	});

	describe('send notification', (): void => {
		it('shows the hint under the message as text', async (): Promise<void> => {
			await mountForm(AutomationNotificationSendForm, { nodeType: nodeType('notification.send', AutomationNodeKind.action), config: {} });

			expect(wrapper.find('[data-test-field="message"] .el-text').text()).toBe('automations.editor.fields.notification.hint');
		});
	});
});
