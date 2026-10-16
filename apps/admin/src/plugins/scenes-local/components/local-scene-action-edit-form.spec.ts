import { ref } from 'vue';

import { ElAlert } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import LocalSceneActionEditForm from './local-scene-action-edit-form.vue';

vi.mock('vue-i18n', async (original) => ({ ...(await original<typeof import('vue-i18n')>()), useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../../modules/devices', () => ({
	DevicesException: Error,
	useDevices: () => ({
		devices: ref([{ id: 'group', name: 'Cover group', type: 'virtual' }]),
		fetchDevices: vi.fn(),
		areLoading: ref(false),
		loaded: ref(true),
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

describe('local scene action edit form', () => {
	it('renders the imported Element Plus alert and qualified group refusal in the actual edit form', async () => {
		const warn = vi.fn();
		const wrapper = mount(LocalSceneActionEditForm, {
			props: {
				sceneId: 'scene',
				action: {
					id: 'action',
					type: 'scenes-local',
					deviceId: 'group',
					channelId: 'cover',
					propertyId: 'command',
					value: 'stop',
					enabled: true,
				} as never,
			},
			global: { config: { warnHandler: warn }, stubs: { Icon: true, IconWithChild: true } },
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
});
