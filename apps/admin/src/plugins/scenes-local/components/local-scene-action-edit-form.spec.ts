import { ref } from 'vue';

import { ElAlert, ElForm, ElResult } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { IconWithChild } from '../../../common';

import LocalSceneActionEditForm from './local-scene-action-edit-form.vue';

const groupDevice = { id: 'group', name: 'Cover group', type: 'virtual' };
const mockDevices = ref<(typeof groupDevice)[]>([groupDevice]);
const mockDevicesLoaded = ref<boolean>(true);
const mockFetchDevices = vi.fn();

vi.mock('vue-i18n', async (original) => ({ ...(await original<typeof import('vue-i18n')>()), useI18n: () => ({ t: (key: string) => key }) }));
// The device property picker reads the composables from their own module, so that is the one to mock
vi.mock('../../../modules/devices/composables/composables', async (original) => ({
	...(await original<typeof import('../../../modules/devices/composables/composables')>()),
	useDevices: () => ({
		devices: mockDevices,
		fetchDevices: mockFetchDevices,
		areLoading: ref(false),
		loaded: mockDevicesLoaded,
	}),
	useChannels: () => ({ channels: ref([{ id: 'cover', device: 'group', name: 'Covers' }]), fetchChannels: vi.fn(), areLoading: ref(false) }),
	useChannelsProperties: () => ({
		properties: ref([{ id: 'command', channel: 'cover', name: 'Command', category: 'command', dataType: 'enum', format: ['open', 'stop'] }]),
		fetchProperties: vi.fn(),
		areLoading: ref(false),
	}),
}));
vi.mock('../../devices-virtual/composables/useGroupSceneControls', () => ({
	useGroupSceneControls: () => ({
		isGroup: ref(true),
		diagnostics: ref(['stop: tag_unavailable']),
		allowed: (_property: unknown, value?: unknown) => value !== 'stop',
	}),
}));

const action = {
	id: 'action',
	type: 'scenes-local',
	deviceId: 'group',
	channelId: 'cover',
	propertyId: 'command',
	value: 'stop',
	enabled: true,
} as never;

describe('local scene action edit form', () => {
	beforeEach(() => {
		mockDevices.value = [groupDevice];
		mockDevicesLoaded.value = true;
		mockFetchDevices.mockReset();
	});

	it('loads the devices itself when they were not loaded yet, as the empty state hides the picker', async () => {
		mockDevices.value = [];
		mockDevicesLoaded.value = false;
		mockFetchDevices.mockImplementation((): Promise<void> => {
			mockDevices.value = [groupDevice];
			mockDevicesLoaded.value = true;

			return Promise.resolve();
		});
		const wrapper = mount(LocalSceneActionEditForm, { props: { sceneId: 'scene', action } });
		await flushPromises();
		expect(mockFetchDevices).toHaveBeenCalledTimes(1);
		expect(wrapper.findComponent(ElResult).exists()).toBe(false);
		expect(wrapper.findComponent(ElForm).exists()).toBe(true);
		wrapper.unmount();
	});

	it('renders the imported Element Plus alert and qualified group refusal in the actual edit form', async () => {
		const warn = vi.fn();
		const wrapper = mount(LocalSceneActionEditForm, {
			props: {
				sceneId: 'scene',
				action,
			},
			global: { config: { warnHandler: warn } },
		});
		await flushPromises();
		const alert = wrapper.findComponent(ElAlert);
		expect(alert.exists()).toBe(true);
		expect(alert.props('description')).toBe('stop: tag_unavailable');
		expect(alert.text()).toContain('stop: tag_unavailable');
		expect(wrapper.find('el-alert').exists()).toBe(false);
		expect(warn.mock.calls.flat().join(' ')).not.toContain('Failed to resolve component');
		wrapper.unmount();
	});

	it('renders only the empty state, with its real icon components resolved, when there are no devices', async () => {
		mockDevices.value = [];
		const warn = vi.fn();
		// Deliberately no Icon / IconWithChild stubs: a stub would resolve the tag even if the component forgot to import it.
		const wrapper = mount(LocalSceneActionEditForm, {
			props: { sceneId: 'scene', action },
			global: { config: { warnHandler: warn } },
		});
		await flushPromises();
		const result = wrapper.findComponent(ElResult);
		expect(result.exists()).toBe(true);
		expect(result.text()).toContain('scenesLocalPlugin.messages.noDevices');
		expect(result.findComponent(IconWithChild).exists()).toBe(true);
		expect(wrapper.find('icon-with-child').exists()).toBe(false);
		expect(wrapper.find('icon').exists()).toBe(false);
		expect(wrapper.findComponent(ElForm).exists()).toBe(false);
		expect(warn.mock.calls.flat().join(' ')).not.toContain('Failed to resolve component');
		wrapper.unmount();
	});
});
