import { computed, defineComponent } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { DevicesModuleChannelPropertyCategory, DevicesModuleChannelPropertyDataType } from '../../../../openapi.constants';
import { AutomationNodeKind } from '../../automations.constants';
import type { AutomationLookupProperty } from '../../nodes/nodes.summaries';
import type { IAutomationNodeType } from '../../store/node-types.store.types';

import AutomationAutomationTargetForm from './automation-automation-target-form.vue';
import AutomationDeviceButtonPressedForm from './automation-device-button-pressed-form.vue';
import AutomationDeviceConnectionChangedForm from './automation-device-connection-changed-form.vue';
import AutomationHouseModeIsForm from './automation-house-mode-is-form.vue';
import AutomationSecurityArmForm from './automation-security-arm-form.vue';
import AutomationSecurityStateChangedForm from './automation-security-state-changed-form.vue';
import AutomationSunEventForm from './automation-sun-event-form.vue';
import AutomationWaitUntilForm from './automation-wait-until-form.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
		te: () => false,
	}),
}));

vi.mock('vue-router', async (importOriginal) => ({
	...(await importOriginal<typeof import('vue-router')>()),
	useRoute: () => ({ params: { id: 'a-edited' } }),
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
	property({ id: 'p-temperature', category: DevicesModuleChannelPropertyCategory.temperature, dataType: DevicesModuleChannelPropertyDataType.float }),
	property({ id: 'p-detected', category: DevicesModuleChannelPropertyCategory.detected, dataType: DevicesModuleChannelPropertyDataType.bool }),
	property({ id: 'p-button', dataType: DevicesModuleChannelPropertyDataType.enum, format: ['press', 'long_press', 'double_press'] }),
	property({ id: 'p-other-button', dataType: DevicesModuleChannelPropertyDataType.enum, format: ['press', 'triple_press'] }),
];

vi.mock('../../composables/useAutomationNodeLookups', () => ({
	useAutomationNodeLookups: () => ({
		device: () => ({ name: 'Device', category: 'sensor' }),
		channel: (id: string) => ({ name: 'Channel', category: id === 'c-alarm' ? 'alarm' : 'generic' }),
		property: (id: string) => PROPERTIES.find((item) => item.id === id) ?? null,
		scene: () => null,
		automation: () => null,
		ensureDevices: async () => undefined,
		ensureScenes: async () => undefined,
		ensureAutomations: async () => undefined,
	}),
}));

vi.mock('../../../devices/composables/useDevices', () => ({
	useDevices: () => ({
		devices: computed(() => [
			{ id: 'd-2', name: 'Window' },
			{ id: 'd-1', name: 'Door' },
		]),
		areLoading: computed(() => false),
	}),
}));

vi.mock('../../composables/useAutomations', () => ({
	useAutomations: () => ({
		automations: computed(() => [
			{ id: 'a-edited', name: 'This one' },
			{ id: 'a-other', name: 'Other one' },
		]),
		areLoading: computed(() => false),
	}),
}));

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
	emits: ['update:deviceId', 'update:channelId', 'update:propertyId'],
	template: '<div data-test-id="picker-stub" />',
});

const nodeType = (type: string, kind: AutomationNodeKind): IAutomationNodeType => ({
	type,
	kind,
	name: type,
	description: '',
	ports: { inputs: [], outputs: [] },
	configSchema: { type: 'object' },
});

const target = { device_id: 'd-1', channel_id: 'c-1' };

describe('automation card forms of the second catalogue', (): void => {
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

	const select = (field: string) => wrapper.find(`[data-test-field="${field}"]`).findComponent({ name: 'ElSelect' });

	const optionValues = (field: string): unknown[] =>
		select(field)
			.findAllComponents({ name: 'ElOption' })
			.map((option) => option.props('value'));

	afterEach((): void => {
		wrapper.unmount();
	});

	describe('wait until', (): void => {
		const wait = nodeType('flow.wait-until', AutomationNodeKind.flow);

		it('offers a threshold only for a property that holds a number', async (): Promise<void> => {
			await mountForm(AutomationWaitUntilForm, { nodeType: wait, config: { ...target, property_id: 'p-detected' } });

			expect(optionValues('mode')).toEqual(['to']);

			await wrapper.setProps({ config: { ...target, property_id: 'p-temperature' } });

			expect(optionValues('mode')).toEqual(['to', 'above', 'below']);
		});

		it('keeps only what the state chosen uses, and the threshold from above to below', async (): Promise<void> => {
			await mountForm(AutomationWaitUntilForm, {
				nodeType: wait,
				config: { ...target, property_id: 'p-temperature', above: 20, timeout_seconds: 60 },
			});

			select('mode').vm.$emit('update:modelValue', 'below');

			expect(lastConfig()).toEqual({ ...target, property_id: 'p-temperature', below: 20, timeout_seconds: 60 });

			select('mode').vm.$emit('update:modelValue', 'to');

			expect(lastConfig()).toEqual({ ...target, property_id: 'p-temperature', timeout_seconds: 60 });
		});

		it('drops a threshold when a property that holds no number is picked', async (): Promise<void> => {
			await mountForm(AutomationWaitUntilForm, { nodeType: wait, config: { ...target, property_id: 'p-temperature', above: 20 } });

			wrapper.findComponent(DevicePropertyPicker).vm.$emit('update:propertyId', 'p-detected');

			expect(lastConfig()).toEqual({ ...target, property_id: 'p-detected' });
		});
	});

	describe('sunrise or sunset', (): void => {
		it('leaves out an offset of zero, which is the event itself', async (): Promise<void> => {
			await mountForm(AutomationSunEventForm, {
				nodeType: nodeType('sun.event', AutomationNodeKind.trigger),
				config: { event: 'sunset', offset_minutes: 30 },
			});

			wrapper.find('[data-test-field="offset_minutes"]').findComponent({ name: 'ElInputNumber' }).vm.$emit('update:modelValue', 0);

			expect(lastConfig()).toEqual({ event: 'sunset' });

			wrapper.find('[data-test-field="offset_minutes"]').findComponent({ name: 'ElInputNumber' }).vm.$emit('update:modelValue', -45);

			expect(lastConfig()).toEqual({ event: 'sunset', offset_minutes: -45 });
		});

		it('shows the problem of an offset beyond six hours', async (): Promise<void> => {
			await mountForm(AutomationSunEventForm, {
				nodeType: nodeType('sun.event', AutomationNodeKind.trigger),
				config: { event: 'sunset', offset_minutes: 400 },
			});

			// The form item shows its error after a short delay
			await vi.waitFor((): void =>
				expect(wrapper.find('[data-test-field="offset_minutes"]').text()).toContain('automations.editor.validation.offset')
			);
		});
	});

	describe('button is pressed', (): void => {
		const button = nodeType('device.button.pressed', AutomationNodeKind.trigger);

		it('offers only properties that report presses', async (): Promise<void> => {
			await mountForm(AutomationDeviceButtonPressedForm, { nodeType: button, config: {} });

			const filter = wrapper.findComponent(DevicePropertyPicker).props('propertyFilter') as (property: unknown) => boolean;

			expect(filter({ permissions: ['ev'] })).toBe(true);
			expect(filter({ permissions: ['ro'] })).toBe(true);
			expect(filter({ permissions: ['rw'] })).toBe(false);
		});

		it('offers the presses a button lists, and every press when none is picked', async (): Promise<void> => {
			await mountForm(AutomationDeviceButtonPressedForm, { nodeType: button, config: { ...target, property_id: 'p-button', events: ['press'] } });

			expect(optionValues('events')).toEqual(['press', 'long_press', 'double_press']);

			select('events').vm.$emit('update:modelValue', []);

			expect(lastConfig()).toEqual({ ...target, property_id: 'p-button' });
		});

		it('keeps only the presses the newly picked button reports too', async (): Promise<void> => {
			await mountForm(AutomationDeviceButtonPressedForm, {
				nodeType: button,
				config: { ...target, property_id: 'p-button', events: ['press', 'long_press'] },
			});

			wrapper.findComponent(DevicePropertyPicker).vm.$emit('update:propertyId', 'p-other-button');

			expect(lastConfig()).toEqual({ ...target, property_id: 'p-other-button', events: ['press'] });
		});
	});

	describe('device goes offline or online', (): void => {
		it('lists the devices by name and leaves out the direction for either way', async (): Promise<void> => {
			await mountForm(AutomationDeviceConnectionChangedForm, {
				nodeType: nodeType('device.connection.changed', AutomationNodeKind.trigger),
				config: { device_id: 'd-1', to: 'offline' },
			});

			expect(optionValues('device_id')).toEqual(['d-1', 'd-2']);
			expect(optionValues('to')).toHaveLength(3);

			select('to').vm.$emit('update:modelValue', optionValues('to')[0]);

			expect(lastConfig()).toEqual({ device_id: 'd-1' });
		});
	});

	describe('house mode is', (): void => {
		it('keeps the modes in their order, and none as not configured', async (): Promise<void> => {
			await mountForm(AutomationHouseModeIsForm, { nodeType: nodeType('house-mode.is', AutomationNodeKind.condition), config: {} });

			wrapper.findComponent({ name: 'ElCheckboxGroup' }).vm.$emit('update:modelValue', ['night', 'home']);

			expect(lastConfig()).toEqual({ modes: ['home', 'night'] });

			wrapper.findComponent({ name: 'ElCheckboxGroup' }).vm.$emit('update:modelValue', []);

			expect(lastConfig()).toEqual({});
		});
	});

	describe('security state changes', (): void => {
		const changed = nodeType('security.state.changed', AutomationNodeKind.trigger);

		it('offers the states of the state watched', async (): Promise<void> => {
			await mountForm(AutomationSecurityStateChangedForm, { nodeType: changed, config: { kind: 'alarm' } });

			expect(optionValues('to').slice(1)).toEqual(['idle', 'pending', 'triggered', 'silenced']);
		});

		it('drops a state of the other kind when the kind changes', async (): Promise<void> => {
			await mountForm(AutomationSecurityStateChangedForm, { nodeType: changed, config: { kind: 'armed', from: 'disarmed', to: 'armed_away' } });

			wrapper.find('[data-test-field="kind"]').findComponent({ name: 'ElRadioGroup' }).vm.$emit('update:modelValue', 'alarm');

			expect(lastConfig()).toEqual({ kind: 'alarm' });
		});
	});

	describe('arm alarm', (): void => {
		it('never offers to disarm, and points only at the armed state of an alarm', async (): Promise<void> => {
			await mountForm(AutomationSecurityArmForm, { nodeType: nodeType('security.arm', AutomationNodeKind.action), config: {} });

			expect(optionValues('armed_state')).toEqual(['armed_home', 'armed_away', 'armed_night']);

			const picker = wrapper.findComponent(DevicePropertyPicker);
			const filter = picker.props('propertyFilter') as (property: unknown) => boolean;

			expect(picker.props('access')).toBe('writable');
			expect(filter({ category: 'state', channel: 'c-alarm' })).toBe(true);
			expect(filter({ category: 'state', channel: 'c-1' })).toBe(false);
			expect(filter({ category: 'on', channel: 'c-alarm' })).toBe(false);
		});
	});

	describe('automation actions', (): void => {
		it('do not offer the automation being edited', async (): Promise<void> => {
			await mountForm(AutomationAutomationTargetForm, { nodeType: nodeType('automation.disable', AutomationNodeKind.action), config: {} });

			expect(optionValues('automation_id')).toEqual(['a-other']);
			expect(wrapper.text()).toContain('automations.editor.fields.automation.hints.disable');
		});
	});
});
