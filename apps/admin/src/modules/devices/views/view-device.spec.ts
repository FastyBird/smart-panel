/* eslint-disable vue/one-component-per-file */
import { type App, defineComponent, nextTick, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, shallowMount } from '@vue/test-utils';

import type { IPluginOptions } from '../../../app.types';
import { PluginsManager } from '../../../common/services/plugins';
import { DEVICES_VIRTUAL_TYPE } from '../../../plugins/devices-virtual/devices-virtual.constants';
import DevicesVirtualPlugin from '../../../plugins/devices-virtual/devices-virtual.plugin';
import { RouteNames } from '../devices.constants';
import type { IDevice } from '../store/devices.store.types';

import ViewDevice from './view-device.vue';

const mocks = vi.hoisted(() => ({
	device: undefined as unknown as { value: IDevice | null },
	fetch: vi.fn(),
	pluginsManager: undefined as unknown as PluginsManager,
}));

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('vue-meta', () => ({ useMeta: () => ({ meta: {} }) }));
vi.mock('vue-router', () => ({
	useRoute: () => ({ name: RouteNames.DEVICE, path: '/devices/test', matched: [] }),
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), resolve: vi.fn((route) => route) }),
}));

vi.mock('../../../common', async () => {
	const { defineComponent, h, ref: vueRef } = await import('vue');
	const stub = defineComponent({
		setup:
			(_, { slots }) =>
			() =>
				h('div', slots.default?.()),
	});
	return {
		injectPluginsManager: () => mocks.pluginsManager,
		AppBar: stub,
		AppBarButton: stub,
		AppBarHeading: stub,
		AppBreadcrumbs: stub,
		EntityNotFound: stub,
		IconWithChild: stub,
		ViewError: stub,
		ViewHeader: stub,
		AppBarButtonAlign: { LEFT: 'left', RIGHT: 'right' },
		useBreakpoints: () => ({ isMDDevice: vueRef(true), isLGDevice: vueRef(false) }),
		useFlashMessage: () => ({ error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
		useUuid: () => ({ validate: () => true }),
	};
});

vi.mock('../components/components', async () => {
	const { defineComponent } = await import('vue');
	const stub = defineComponent({ template: '<div />' });
	return { ChannelDetail: stub, DeviceDetail: defineComponent({ name: 'DeviceDetail', template: '<div />' }), DeviceLogs: stub };
});
vi.mock('../../../plugins/devices-virtual/components/virtual-device-sources.vue', async () => {
	const { defineComponent } = await import('vue');
	return { default: defineComponent({ name: 'VirtualDeviceSources', props: { device: { type: Object, required: true } }, template: '<div />' }) };
});
vi.mock('../index', async () => ({
	DEVICES_MODULE_NAME: 'devices-module',
	RouteNames: { DEVICES: 'devices_module-devices' },
	...(await import('../schemas/devices.schemas')),
	...(await import('../store/devices.store.schemas')),
	...(await import('../store/channels.store.schemas')),
	...(await import('../store/channels.properties.store.schemas')),
}));
vi.mock('../../../plugins/devices-virtual/components/components', async () => {
	const { defineComponent } = await import('vue');
	const stub = defineComponent({ template: '<div />' });
	return { VirtualDeviceAddForm: stub, VirtualDeviceEditForm: stub };
});
vi.mock('../../config', () => ({ useConfigPlugins: () => ({ enabled: () => false }) }));
vi.mock('../devices.mapping', () => ({ deviceChannelsSpecificationOrder: {} }));
vi.mock('../composables/composables', async () => ({
	useDevicesPlugins: (await import('../composables/useDevicesPlugins')).useDevicesPlugins,
	useDevice: () => ({ device: mocks.device, isLoading: ref(false), fetchDevice: mocks.fetch }),
	useDeviceValidation: () => ({ issues: ref([]), fetchValidation: mocks.fetch }),
	useDeviceLogs: () => ({
		alertCount: ref(0),
		hasAlerts: ref(false),
		fetchLogs: mocks.fetch,
		live: ref(false),
		logs: [],
		hasMore: false,
		isLoading: false,
	}),
	useDeviceSpecification: () => ({ canAddAnotherChannel: ref(false) }),
	useChannels: () => ({ channels: ref([]), fetchChannels: mocks.fetch }),
	useDeviceControls: () => ({ controls: ref([]), fetchControls: mocks.fetch }),
	useChannelsActions: () => ({ remove: vi.fn() }),
	useChannelsPropertiesActions: () => ({ remove: vi.fn() }),
}));

const device = (type: string, id = 'device-id'): IDevice => ({ id, type, name: 'Device', category: 'lighting' }) as IDevice;
const mountView = () => shallowMount(ViewDevice, { props: { id: 'device-id' } });

describe('ViewDevice plugin detail section mount gate', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetch.mockResolvedValue(undefined);
		mocks.pluginsManager = new PluginsManager();
		DevicesVirtualPlugin.install(
			{} as App,
			{
				i18n: { global: { getLocaleMessage: () => ({}), setLocaleMessage: vi.fn() } },
				router: { getRoutes: () => [] },
			} as unknown as IPluginOptions
		);
		mocks.device = ref<IDevice | null>(device(DEVICES_VIRTUAL_TYPE));
	});

	it('mounts the virtual sources section for an existing virtual device even with the plugin disabled', async () => {
		const wrapper = mountView();
		await flushPromises();
		const section = wrapper.findComponent({ name: 'VirtualDeviceSources' });
		expect(section.exists()).toBe(true);
		expect(section.props('device')).toEqual(mocks.device.value);
	});

	it.each(['devices-shelly-ng', 'devices-home-assistant'])('does not mount virtual sources for %s', async (type) => {
		mocks.device.value = device(type);
		const wrapper = mountView();
		await flushPromises();
		expect(wrapper.findComponent({ name: 'VirtualDeviceSources' }).exists()).toBe(false);
		expect(wrapper.findComponent({ name: 'DeviceDetail' }).exists()).toBe(true);
	});

	it('renders an arbitrary plugin section using its device-type metadata', async () => {
		const registered = mocks.pluginsManager.getPlugins()[0]!;
		mocks.pluginsManager.addPlugin(Symbol('custom-detail'), {
			...registered,
			type: 'custom-plugin',
			elements: [
				{ type: 'custom-device', components: { deviceDetailSection: defineComponent({ name: 'CustomDetailSection', template: '<div />' }) } },
			],
		});
		mocks.device.value = device('custom-device');
		const wrapper = mountView();
		await flushPromises();
		expect(wrapper.findComponent({ name: 'CustomDetailSection' }).exists()).toBe(true);
		expect(wrapper.findComponent({ name: 'VirtualDeviceSources' }).exists()).toBe(false);
	});

	it('renders the shared detail card and tabs when the device plugin is absent', async () => {
		mocks.pluginsManager = new PluginsManager();
		const wrapper = mountView();
		await flushPromises();
		expect(wrapper.findComponent({ name: 'VirtualDeviceSources' }).exists()).toBe(false);
		expect(wrapper.findComponent({ name: 'DeviceDetail' }).exists()).toBe(true);
		expect(wrapper.findComponent({ name: 'ElTabs' }).exists()).toBe(true);
	});

	it('unmounts the virtual section when the reactive device is replaced by a physical device', async () => {
		const wrapper = mountView();
		await flushPromises();
		expect(wrapper.findComponent({ name: 'VirtualDeviceSources' }).exists()).toBe(true);
		mocks.device.value = device('devices-shelly-ng');
		await nextTick();
		expect(wrapper.findComponent({ name: 'VirtualDeviceSources' }).exists()).toBe(false);
	});
});
