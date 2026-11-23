import { defineComponent, h, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import SceneActionRow from './scene-action-row.vue';

const devices = ref<{ id: string; name: string; category: string }[]>([]);
const channels = ref<{ id: string; name: string }[]>([]);
const properties = ref<{ id: string; name: string | null; category: string }[]>([]);
const fetchChannels = vi.fn().mockResolvedValue(undefined);
const fetchProperties = vi.fn().mockResolvedValue(undefined);

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../../common', async () => ({
	DomainIcon: (await import('../../../../common/components/domain-icon.vue')).default,
	StatusTag: (await import('../../../../common/components/status-tag.vue')).default,
	deviceCategoryDomain: (await import('../../../../common/components/domain-icon.utils')).deviceCategoryDomain,
}));

vi.mock('../../../devices', () => ({
	useDevices: () => ({ devices, fetchDevices: vi.fn().mockResolvedValue(undefined), loaded: ref(true) }),
	useChannels: () => ({ channels, fetchChannels }),
	useChannelsProperties: () => ({ properties, fetchProperties }),
}));

const ValueChip = defineComponent({
	name: 'ValueChip',
	props: { action: { type: Object, required: true } },
	setup: (props) => (): ReturnType<typeof h> => h('span', { class: 'chip' }, String((props.action as { value: unknown }).value)),
});

const action = (overrides: Record<string, unknown> = {}) => ({
	id: 'action-1',
	type: 'local',
	enabled: true,
	configuration: {},
	deviceId: 'device-1',
	channelId: 'channel-1',
	propertyId: 'property-1',
	value: 40,
	...overrides,
});

const mountRow = async (overrides: Record<string, unknown> = {}) => {
	const wrapper = mount(SceneActionRow, {
		props: { action: action(overrides) as never, card: ValueChip, label: 'Device Property Action' },
		global: {
			stubs: {
				ElTooltip: { template: '<slot />' },
				ElDropdown: { name: 'ElDropdown', emits: ['command'], template: '<div><slot /><slot name="dropdown" /></div>' },
				ElDropdownMenu: { template: '<div><slot /></div>' },
				ElDropdownItem: { template: '<div v-bind="$attrs"><slot /></div>' },
			},
		},
	});

	await flushPromises();

	return wrapper;
};

describe('SceneActionRow', () => {
	beforeEach(() => {
		devices.value = [{ id: 'device-1', name: 'Living room lamp', category: 'lighting' }];
		channels.value = [{ id: 'channel-1', name: 'Light' }];
		properties.value = [{ id: 'property-1', name: 'Brightness', category: 'brightness' }];
		vi.clearAllMocks();
	});

	it('draws the device, its path, its domain and the plugin value chip', async () => {
		const wrapper = await mountRow();

		expect(wrapper.find('[data-test-id="scene-action-row-title"]').text()).toBe('Living room lamp');
		expect(wrapper.find('[data-test-id="scene-action-row-path"]').text()).toBe('Light › Brightness');
		expect(wrapper.find('[data-test-id="domain-icon"]').attributes('data-domain')).toBe('lights');
		expect(wrapper.find('.chip').text()).toBe('40');
		expect(wrapper.find('[data-test-id="scene-action-row-missing"]').exists()).toBe(false);
	});

	it('leaves out a channel named like its device', async () => {
		channels.value = [{ id: 'channel-1', name: 'Living room lamp' }];

		const wrapper = await mountRow();

		expect(wrapper.find('[data-test-id="scene-action-row-path"]').text()).toBe('Brightness');
	});

	it('flags an action whose device was deleted, without fetching its channels', async () => {
		devices.value = [];

		const wrapper = await mountRow();

		expect(wrapper.find('[data-test-id="scene-action-row-title"]').text()).toBe('scenes.actions.unknownDevice');
		expect(wrapper.find('[data-test-id="scene-action-row-missing"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="domain-icon"]').exists()).toBe(false);
		expect(fetchChannels).not.toHaveBeenCalled();
	});

	it('flags an action whose property was deleted', async () => {
		properties.value = [];

		const wrapper = await mountRow();

		expect(wrapper.find('[data-test-id="scene-action-row-path"]').text()).toBe('Light › scenes.actions.unknownProperty');
		expect(wrapper.find('[data-test-id="scene-action-row-missing"]').exists()).toBe(true);
	});

	it('reads the target an older action keeps in its configuration', async () => {
		const wrapper = await mountRow({
			deviceId: undefined,
			channelId: undefined,
			propertyId: undefined,
			configuration: { device_id: 'device-1', channel_id: 'channel-1', property_id: 'property-1' },
		});

		expect(wrapper.find('[data-test-id="scene-action-row-title"]').text()).toBe('Living room lamp');
	});

	it('titles an action without a device by its plugin', async () => {
		const wrapper = await mountRow({ deviceId: undefined, channelId: undefined, propertyId: undefined });

		expect(wrapper.find('[data-test-id="scene-action-row-title"]').text()).toBe('Device Property Action');
		expect(wrapper.find('[data-test-id="scene-action-row-path"]').exists()).toBe(false);
	});

	it('asks the host to edit or delete the action', async () => {
		const wrapper = await mountRow();

		await wrapper.find('[data-test-id="edit-scene-action"]').trigger('click');
		wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'remove');

		expect(wrapper.emitted('edit')).toHaveLength(1);
		expect(wrapper.emitted('remove')).toHaveLength(1);
	});
});
