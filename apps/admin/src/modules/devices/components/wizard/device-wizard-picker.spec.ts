import { computed, defineComponent } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import type { IDeviceWizardDefinition } from '../../devices.types';

import DeviceWizardPicker from './device-wizard-picker.vue';

const mocks = vi.hoisted(() => ({ disabled: new Set<string>(), only: null as string | null }));

const Flow = defineComponent({ template: '<div />' });

const definitions: Record<string, IDeviceWizardDefinition> = {
	shelly: {
		selection: { kind: 'integration', icon: 'mdi:lightning-bolt', order: 20, description: 'shelly.description', badge: 'shelly.badge' },
		component: Flow,
	},
	zigbee: { selection: { kind: 'integration', icon: 'mdi:zigbee', order: 10, description: 'zigbee.description' }, component: Flow },
	virtual: {
		selection: { kind: 'section', order: 10, section: { label: 'virtual.section', description: 'virtual.sectionDescription' } },
		variants: [
			{ id: 'group', label: 'virtual.group', description: 'virtual.groupDescription', icon: 'mdi:lightbulb-group', component: Flow },
			{ id: 'thermostat', label: 'virtual.thermostat', description: 'virtual.thermostatDescription', icon: 'mdi:thermostat', component: Flow },
		],
	},
};

const labels: Record<string, string> = { shelly: 'Shelly', zigbee: 'Zigbee2MQTT', virtual: 'Virtual' };

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

vi.mock('../../../../common', async () => {
	const { defineComponent: define } = await import('vue');

	return {
		// Renders the options as buttons, and chooses a lone option at once, as the real picker does
		TypePicker: define({
			name: 'TypePicker',
			props: ['options', 'modelValue', 'visible', 'title'],
			emits: ['update:modelValue', 'update:visible'],
			mounted() {
				if (this.options.length === 1) {
					this.$emit('update:modelValue', this.options[0].id);
					this.$emit('update:visible', false);
				}
			},
			template: `<div data-test-id="picker"><button v-for="option in options" :key="option.id" :data-option-id="option.id" @click="$emit('update:modelValue', option.id); $emit('update:visible', false)">{{ option.name }}</button><button data-test-id="dismiss" @click="$emit('update:visible', false)" /></div>`,
		}),
	};
});

vi.mock('../../composables/useDevicesPlugins', () => ({
	useDevicesPlugins: () => ({
		wizardOptions: computed(() =>
			Object.keys(definitions)
				.filter((type) => mocks.only === null || mocks.only === type)
				.map((type) => ({ value: type, label: labels[type], description: `${type} plugin`, disabled: mocks.disabled.has(type) }))
		),
		getWizard: (type: string) => definitions[type],
		getByPluginType: (type: string) => ({ name: labels[type], icon: { small: 'mdi:devices' } }),
	}),
}));

const render = (visible = true) => mount(DeviceWizardPicker, { props: { visible } });

const options = (wrapper: ReturnType<typeof render>) =>
	wrapper.getComponent({ name: 'TypePicker' }).props('options') as { id: string; name: string; badge?: string; description?: string; icon: string }[];

describe('DeviceWizardPicker', () => {
	beforeEach(() => {
		mocks.disabled.clear();
		mocks.only = null;
	});

	it('mounts the picker only while it is open', () => {
		expect(render(false).find('[data-test-id="picker"]').exists()).toBe(false);
		expect(render().find('[data-test-id="picker"]').exists()).toBe(true);
	});

	it('builds a tile per wizard from its icon, name, description, order and badge: integrations first, then sections', () => {
		const wrapper = render();

		expect(options(wrapper).map((option) => option.id)).toEqual(['zigbee', 'shelly', 'virtual:group', 'virtual:thermostat']);
		expect(options(wrapper)[1]).toEqual(
			expect.objectContaining({ icon: 'mdi:lightning-bolt', name: 'Shelly', description: 'shelly.description', badge: 'shelly.badge' })
		);
		// Every wizard of a plugin with several is its own tile, badged with the plugin
		expect(options(wrapper)[2]).toEqual(
			expect.objectContaining({
				icon: 'mdi:lightbulb-group',
				name: 'virtual.group',
				description: 'virtual.groupDescription',
				badge: 'Virtual',
			})
		);
	});

	it('leaves out the wizards of a disabled plugin', () => {
		mocks.disabled.add('virtual');

		expect(options(render()).map((option) => option.id)).toEqual(['zigbee', 'shelly']);
	});

	it('hands the chosen wizard, with its variant, to the host without reporting a dismissal', async () => {
		const wrapper = render();

		await wrapper.get('[data-option-id="virtual:thermostat"]').trigger('click');

		expect(wrapper.emitted('choose')).toEqual([
			[{ name: 'devices_module-devices_wizard', params: { type: 'virtual' }, query: { variant: 'thermostat' } }],
		]);
		expect(wrapper.emitted('update:visible')).toBeUndefined();
	});

	it('reports a dismissal when closed without a choice', async () => {
		const wrapper = render();

		await wrapper.get('[data-test-id="dismiss"]').trigger('click');

		expect(wrapper.emitted('update:visible')).toEqual([[false]]);
		expect(wrapper.emitted('choose')).toBeUndefined();
	});

	it('opens the only wizard straight away', async () => {
		mocks.only = 'zigbee';

		const wrapper = render();
		await flushPromises();

		expect(wrapper.emitted('choose')).toEqual([[{ name: 'devices_module-devices_wizard', params: { type: 'zigbee' } }]]);
		expect(wrapper.emitted('update:visible')).toBeUndefined();
	});
});
