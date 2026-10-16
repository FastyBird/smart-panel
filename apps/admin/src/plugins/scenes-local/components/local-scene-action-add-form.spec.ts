import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { backendKey } from '../../../common/services/backend';
import { socketsKey } from '../../../common/services/sockets';
import type { IChannel, IChannelProperty, IDevice } from '../../../modules/devices';
import { SceneCategory } from '../../../modules/scenes/scenes.constants';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';

import LocalSceneActionAddForm from './local-scene-action-add-form.vue';

const mockDevices = ref<IDevice[]>([]);
const mockChannels = ref<IChannel[]>([]);
const mockProperties = ref<IChannelProperty[]>([]);
const mockBackend = { GET: vi.fn() };
const mockSockets = { on: vi.fn(), off: vi.fn() };
const mountForm = (sceneCategory?: SceneCategory) =>
	mount(LocalSceneActionAddForm, {
		props: { id: 'action-1', sceneId: 'scene-1', sceneCategory },
		global: {
			provide: { [backendKey as symbol]: mockBackend, [socketsKey as symbol]: mockSockets },
			stubs: { Icon: true, IconWithChild: true },
		},
	});
const mockFetchDevices = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../modules/devices', async () => {
	const actual = await vi.importActual('../../../modules/devices');

	return {
		...actual,
		useDevices: () => ({
			devices: mockDevices,
			fetchDevices: mockFetchDevices,
			areLoading: ref(false),
			loaded: ref(true),
		}),
		useChannels: () => ({
			channels: mockChannels,
			fetchChannels: vi.fn().mockResolvedValue(undefined),
			areLoading: ref(false),
		}),
		useChannelsProperties: () => ({
			properties: mockProperties,
			fetchProperties: vi.fn().mockResolvedValue(undefined),
			areLoading: ref(false),
		}),
	};
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

describe('LocalSceneActionAddForm.vue', () => {
	beforeEach(() => {
		mockDevices.value = [];
		mockChannels.value = [];
		mockProperties.value = [];
		vi.clearAllMocks();
		mockBackend.GET.mockResolvedValue({ data: undefined });
	});

	it('does not offer a hidden device', () => {
		mockDevices.value = [
			{ id: 'visible', name: 'Visible device', category: DevicesModuleDeviceCategory.generic, hidden: false } as IDevice,
			{ id: 'concealed', name: 'Concealed device', category: DevicesModuleDeviceCategory.generic, hidden: true } as IDevice,
		];

		const wrapper = mountForm();

		const options = wrapper.findAllComponents({ name: 'ElOption' });

		expect(options.map((option) => option.props('value'))).toEqual(['visible']);
		expect(mockBackend.GET).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	it('does not offer a hidden device among recommended options either', () => {
		mockDevices.value = [
			{ id: 'visible', name: 'Visible device', category: DevicesModuleDeviceCategory.lighting, hidden: false } as IDevice,
			{ id: 'concealed', name: 'Concealed device', category: DevicesModuleDeviceCategory.lighting, hidden: true } as IDevice,
		];

		const wrapper = mountForm(SceneCategory.lighting);

		const options = wrapper.findAllComponents({ name: 'ElOption' });

		expect(options.map((option) => option.props('value'))).toEqual(['visible']);
		expect(mockBackend.GET).not.toHaveBeenCalled();
		wrapper.unmount();
	});
	it.each([true, false])(
		'uses injected dependencies and real group controls for group=%s while retaining ordinary writable controls',
		async (group) => {
			mockDevices.value = [
				{
					id: 'device',
					name: 'Cover',
					category: DevicesModuleDeviceCategory.generic,
					type: group ? 'virtual' : 'physical',
					mode: group ? 'actuator_group' : undefined,
					hidden: false,
				} as unknown as IDevice,
			];
			mockChannels.value = [{ id: 'cover', device: 'device', name: 'Cover' } as IChannel];
			mockProperties.value = [
				{
					id: 'command',
					channel: 'cover',
					name: 'Command',
					category: 'command',
					dataType: 'enum',
					format: ['open', 'stop'],
					permissions: ['wo'],
				} as IChannelProperty,
				{
					id: 'status',
					channel: 'cover',
					name: 'Status',
					category: 'status',
					dataType: 'enum',
					format: ['stopped'],
					permissions: ['ro'],
				} as IChannelProperty,
			];
			mockBackend.GET.mockResolvedValue({
				data: {
					data: {
						profile: 'cover',
						common_capabilities: [
							{ category: 'command', access: 'wo' },
							{ category: 'status', access: 'ro' },
						],
						operations: [
							{ operation: 'open', commandable: true, members: [] },
							{ operation: 'stop', commandable: false, members: [{ source_identity: 'member', reasons: ['tag_unavailable'] }] },
						],
					},
				},
			});
			const wrapper = mountForm();
			const select = async (name: string, value: string) => {
				const control = wrapper.findAllComponents({ name: 'ElSelect' }).find((control) => control.props('name') === name)!;
				expect(control).toBeDefined();
				control.vm.$emit('update:modelValue', value);
				control.vm.$emit('change', value);
				await flushPromises();
			};
			await select('deviceId', 'device');
			await select('channelId', 'cover');
			const propertySelect = wrapper.findAllComponents({ name: 'ElSelect' }).find((control) => control.props('name') === 'propertyId')!;
			expect(propertySelect.findAllComponents({ name: 'ElOption' }).map((option) => option.props('value'))).toEqual(['command']);
			await select('propertyId', 'command');
			const valueSelect = wrapper.findAllComponents({ name: 'ElSelect' }).find((control) => control.props('name') === 'value')!;
			expect(valueSelect.findAllComponents({ name: 'ElOption' }).map((option) => option.props('value'))).toEqual(group ? ['open'] : ['open', 'stop']);
			if (group) {
				expect(mockBackend.GET).toHaveBeenCalledWith('/plugins/devices-virtual/producers/light-groups/{id}', { params: { path: { id: 'cover' } } });
				expect(wrapper.findComponent({ name: 'ElAlert' }).text()).toContain('stop / member: tag_unavailable');
			} else {
				expect(mockBackend.GET).not.toHaveBeenCalled();
				expect(wrapper.findComponent({ name: 'ElAlert' }).exists()).toBe(false);
			}
			wrapper.unmount();
			expect(mockSockets.off).toHaveBeenCalledTimes(3);
		}
	);
});
