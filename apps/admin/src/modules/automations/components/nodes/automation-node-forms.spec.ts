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
		id: 'p-status',
		category: DevicesModuleChannelPropertyCategory.status,
		dataType: DevicesModuleChannelPropertyDataType.enum,
		format: ['locked', 'unlocked', 'jammed'],
	}),
];

vi.mock('../../composables/useAutomationNodeLookups', () => ({
	useAutomationNodeLookups: () => ({
		device: (id: string) => (id === 'd-lock' ? { name: 'Front door', category: 'lock' } : { name: 'Sensor', category: 'sensor' }),
		channel: (id: string) => (id === 'c-lock' ? { name: 'Lock', category: 'lock' } : { name: 'Sensor', category: 'sensor' }),
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

		it('follows a configuration changed from outside, back to any change', async (): Promise<void> => {
			await mountForm(AutomationDevicePropertyChangedForm, { nodeType: changed, config: { ...target, to: 21 } });

			// An undo, say
			await wrapper.setProps({ config: { ...target } });

			expect(wrapper.find('[data-test-field="mode"]').findComponent({ name: 'ElSelect' }).props('modelValue')).toBe('any');
			expect(wrapper.find('[data-test-field="to"]').exists()).toBe(false);
			expect(lastInvalid()).toBe(false);
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

	describe('send notification', (): void => {
		it('shows the hint under the message as text', async (): Promise<void> => {
			await mountForm(AutomationNotificationSendForm, { nodeType: nodeType('notification.send', AutomationNodeKind.action), config: {} });

			expect(wrapper.find('[data-test-field="message"] .el-text').text()).toBe('automations.editor.fields.notification.hint');
		});
	});
});
