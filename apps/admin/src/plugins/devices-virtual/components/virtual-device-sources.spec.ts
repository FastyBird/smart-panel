import { computed, reactive } from 'vue';

import { v4 as uuid } from 'uuid';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import type { IChannel, IDevice } from '../../../modules/devices';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleDeviceCategory,
	DevicesModuleDeviceConnectionStatus,
	DevicesVirtualPluginValueOrigin,
} from '../../../openapi.constants';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import type { IVirtualChannelProperty } from '../store/channels.properties.store.types';

import VirtualDeviceSources from './virtual-device-sources.vue';

const backendClient = {
	GET: vi.fn(),
	PATCH: vi.fn(),
	POST: vi.fn(),
};

const logger = {
	debug: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
};

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`),
	}),
}));

const routerPush = vi.fn().mockResolvedValue(undefined);

// Spreads the real module rather than replacing it outright: `'../../../common'` is mocked below with
// `vi.importActual`, and its own `common/services/router.ts` needs the real `createRouter` export to
// exist, not just `useRouter`.
vi.mock('vue-router', async () => {
	const actual = await vi.importActual('vue-router');

	return {
		...actual,
		useRouter: () => ({ push: routerPush }),
	};
});

const VIRTUAL_DEVICE_ID = 'device-virtual';
const CHANNEL_ID = 'channel-switcher';

// Reassigned per test by `mountSources`; the fake stores below close over these bindings rather than
// fixed fixtures so each test can shape its own channel/property graph without redefining the stores.
let channels: IChannel[] = [];
// Reactive, because the panel now *watches* the links these carry: a websocket update repointing or
// orphaning a projection has to reach the component the way the real store's reactive data would,
// rather than only being observed the next time something else re-renders.
const properties: IVirtualChannelProperty[] = reactive([]);

const channelsStore = {
	findForDevice: (deviceId: string): IChannel[] => channels.filter((channel) => channel.device === deviceId),
	findById: (id: string): IChannel | null => channels.find((channel) => channel.id === id) ?? null,
	fetch: vi.fn(async (payload: { deviceId?: string }) => channels.filter((channel) => !payload.deviceId || channel.device === payload.deviceId)),
};

const propertiesStore = {
	findForChannel: (channelId: string): IVirtualChannelProperty[] => properties.filter((property) => property.channel === channelId),
	// `findById`/`fetch` are only ever exercised by the remap dialog mounted as a child (see
	// `devicesStore` below) — the sources panel itself only ever reads `findForChannel`.
	findById: (id: string): IVirtualChannelProperty | null => properties.find((property) => property.id === id) ?? null,
	fetch: vi.fn(async (payload: { channelId: string }) => properties.filter((property) => property.channel === payload.channelId)),
};

// Minimal fixture the remap dialog needs when a warning's "Remap" button opens it as a child — the
// sources panel itself never reads this store.
const devicesStore = {
	findAll: (): IDevice[] => [],
	findById: (): IDevice | null => null,
	fetch: vi.fn(async () => []),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: () => ({
			// Keyed explicitly, same as the wizard mapping step's fixture: a store neither this component
			// nor the remap dialog it can open declares a dependency on should fail loudly rather than
			// silently hand back the wrong one.
			getStore: (key: symbol) => {
				if (key === channelsStoreKey) {
					return channelsStore;
				}

				if (key === channelsPropertiesStoreKey) {
					return propertiesStore;
				}

				if (key === devicesStoreKey) {
					return devicesStore;
				}

				throw new Error('Unexpected store requested by the sources panel');
			},
		}),
		useBackend: () => ({ client: backendClient }),
		useLogger: () => logger,
	};
});

const device = {
	id: VIRTUAL_DEVICE_ID,
	name: 'Hall switch (split)',
	type: DEVICES_VIRTUAL_TYPE,
	category: DevicesModuleDeviceCategory.switcher,
	hidden: false,
	draft: false,
} as unknown as IDevice;

const respondWith = (data: unknown[]): { data: { data: unknown[] }; error: undefined } => ({ data: { data }, error: undefined });

const sourceDeviceResponse = (id: string, name: string): Record<string, unknown> => ({
	id,
	type: 'shelly-ng',
	category: DevicesModuleDeviceCategory.switcher,
	identifier: null,
	name,
	description: null,
	enabled: true,
	hidden: false,
	room_id: null,
	zone_ids: [],
	status: { online: true, status: DevicesModuleDeviceConnectionStatus.connected, last_changed: null },
	created_at: '2024-03-01T12:00:00Z',
	updated_at: null,
	controls: [],
	channels: [],
});

const mounted: { unmount: () => void }[] = [];

const mountSources = (fixtures: { channels?: IChannel[]; properties?: Partial<IVirtualChannelProperty>[] } = {}) => {
	channels = fixtures.channels ?? [
		{ id: CHANNEL_ID, device: VIRTUAL_DEVICE_ID, name: 'Switch', category: DevicesModuleChannelCategory.switcher } as unknown as IChannel,
	];

	// Every field an orphan check does not care about gets a harmless default, so a test only has to
	// state the fields its scenario is actually about — `id`, `valueOrigin` and `sourceProperty` in the
	// brief's own example.
	properties.length = 0;
	properties.push(
		...(fixtures.properties ?? []).map(
		(property, index) =>
			({
				id: `property-${index}`,
				channel: CHANNEL_ID,
				name: null,
				category: DevicesModuleChannelPropertyCategory.on,
				valueOrigin: DevicesVirtualPluginValueOrigin.source,
				sourceProperty: null,
				...property,
			}) as unknown as IVirtualChannelProperty
		)
	);

	const wrapper = mount(VirtualDeviceSources, {
		props: { device },
	});

	// Tracked so `afterEach` can tear it down. The panel watches the shared `properties` fixture now, so
	// a wrapper left mounted from an earlier test keeps reacting to the next test's fixtures and fires
	// its own fetches into the shared mock.
	mounted.push(wrapper);

	return {
		wrapper,
		warnings: computed(() => wrapper.vm.warnings),
		sourceDevices: computed(() => wrapper.vm.sourceDevices),
		loading: computed(() => wrapper.vm.loading),
		loadError: computed(() => wrapper.vm.loadError),
	};
};

describe('VirtualDeviceSources', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		backendClient.GET.mockResolvedValue(respondWith([]));
	});

	afterEach(() => {
		while (mounted.length > 0) {
			mounted.pop()?.unmount();
		}
	});

	it('flags an orphaned property and offers to remap it', () => {
		const { warnings } = mountSources({ properties: [{ id: 'p', valueOrigin: DevicesVirtualPluginValueOrigin.source, sourceProperty: null }] });

		expect(warnings.value).toHaveLength(1);
		expect(warnings.value[0].action).toBe('remap');
	});

	it('does not flag a local property that never had a source', () => {
		const { warnings } = mountSources({ properties: [{ id: 'p', valueOrigin: DevicesVirtualPluginValueOrigin.local, sourceProperty: null }] });

		expect(warnings.value).toHaveLength(0);
	});

	it('does not flag a property whose source is still linked', () => {
		const { warnings } = mountSources({
			properties: [{ id: 'p', valueOrigin: DevicesVirtualPluginValueOrigin.source, sourceProperty: 'still-linked-property' }],
		});

		expect(warnings.value).toHaveLength(0);
	});

	it('carries the spec channel and property of the orphaned slot', () => {
		const { warnings } = mountSources({ properties: [{ id: 'p', valueOrigin: DevicesVirtualPluginValueOrigin.source, sourceProperty: null }] });

		expect(warnings.value[0]).toMatchObject({
			propertyId: 'p',
			specChannel: DevicesModuleChannelCategory.switcher,
			specProperty: DevicesModuleChannelPropertyCategory.on,
		});
	});

	it('lists the fetched source devices', async () => {
		backendClient.GET.mockResolvedValue(respondWith([sourceDeviceResponse(uuid(), 'Hall relay')]));

		const { wrapper, sourceDevices, loading, loadError } = mountSources();

		await flushPromises();

		expect(backendClient.GET).toHaveBeenCalledWith(
			`/plugins/${'devices-virtual'}/devices/{id}/source-devices`,
			expect.objectContaining({ params: { path: { id: VIRTUAL_DEVICE_ID } } })
		);
		expect(loading.value).toBe(false);
		expect(loadError.value).toBeNull();
		expect(sourceDevices.value.map((entry) => entry.name)).toEqual(['Hall relay']);
		expect(wrapper.get('[data-test-id="sources-list"]').text()).toContain('Hall relay');
	});

	it('shows an empty state, not an error, when the device draws from nothing', async () => {
		backendClient.GET.mockResolvedValue(respondWith([]));

		const { wrapper, loadError, sourceDevices } = mountSources();

		await flushPromises();

		expect(loadError.value).toBeNull();
		expect(sourceDevices.value).toHaveLength(0);
		expect(wrapper.find('[data-test-id="sources-empty"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="sources-error"]').exists()).toBe(false);
	});

	it('shows an error, not an empty state, when the source-devices call fails', async () => {
		backendClient.GET.mockResolvedValue({ data: undefined, error: { error: { details: [{ reason: 'Device not found' }] } } });

		const { wrapper, loadError, sourceDevices } = mountSources();

		await flushPromises();

		expect(loadError.value).toBe('Device not found');
		expect(sourceDevices.value).toHaveLength(0);
		expect(wrapper.find('[data-test-id="sources-empty"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="sources-error"]').exists()).toBe(true);
	});

	it('retries the fetch when the retry button is clicked', async () => {
		backendClient.GET.mockResolvedValueOnce({
			data: undefined,
			error: { error: { details: [{ reason: 'Device not found' }] } },
		}).mockResolvedValueOnce(respondWith([sourceDeviceResponse(uuid(), 'Hall relay')]));

		const { wrapper, loadError, sourceDevices } = mountSources();

		await flushPromises();

		expect(loadError.value).toBe('Device not found');

		await wrapper.get('[data-test-id="sources-retry"]').trigger('click');
		await flushPromises();

		expect(backendClient.GET).toHaveBeenCalledTimes(2);
		expect(loadError.value).toBeNull();
		expect(sourceDevices.value.map((entry) => entry.name)).toEqual(['Hall relay']);
	});

	it('opens the remap dialog for the warned property', async () => {
		const { wrapper, warnings } = mountSources({
			properties: [{ id: 'p', valueOrigin: DevicesVirtualPluginValueOrigin.source, sourceProperty: null }],
		});

		expect(wrapper.findComponent({ name: 'VirtualDeviceRemapDialog' }).exists()).toBe(false);

		await wrapper.get(`[data-test-id="remap-${warnings.value[0].propertyId}"]`).trigger('click');

		expect(wrapper.findComponent({ name: 'VirtualDeviceRemapDialog' }).exists()).toBe(true);
		expect(wrapper.findComponent({ name: 'VirtualDeviceRemapDialog' }).props('propertyId')).toBe('p');
	});

	it('closes the remap dialog when it emits close', async () => {
		const { wrapper, warnings } = mountSources({
			properties: [{ id: 'p', valueOrigin: DevicesVirtualPluginValueOrigin.source, sourceProperty: null }],
		});

		await wrapper.get(`[data-test-id="remap-${warnings.value[0].propertyId}"]`).trigger('click');

		expect(wrapper.findComponent({ name: 'VirtualDeviceRemapDialog' }).exists()).toBe(true);

		await wrapper.findComponent({ name: 'VirtualDeviceRemapDialog' }).vm.$emit('close');
		await flushPromises();

		expect(wrapper.findComponent({ name: 'VirtualDeviceRemapDialog' }).exists()).toBe(false);
	});

	// The property store update clears the orphan warning on its own, but this list is a separate
	// snapshot from the source-devices endpoint: without refetching, a device the remap just linked
	// stays listed as absent until the whole detail page is reloaded.
	// `sourceDevices` is a snapshot from the source-devices endpoint; `warnings` is live from the store.
	// The backend announces a projection that lost its source, so the two drift apart on their own: the
	// warning appears while the list beside it still presents the deleted source as backing this device.
	it('reloads the source devices when a projection loses its source', async () => {
		const { warnings } = mountSources({
			properties: [{ id: 'p', valueOrigin: DevicesVirtualPluginValueOrigin.source, sourceProperty: 'source-1' }],
		});

		await flushPromises();

		expect(warnings.value).toHaveLength(0);

		const callsBefore = (backendClient.GET as Mock).mock.calls.length;

		// What the websocket delivers once the backend announces the orphaning.
		properties[0] = { ...properties[0], sourceProperty: null } as IVirtualChannelProperty;

		await flushPromises();

		expect(warnings.value).toHaveLength(1);
		expect((backendClient.GET as Mock).mock.calls.length).toBeGreaterThan(callsBefore);
	});

	// The other direction, where there is no warning to notice: a remap performed elsewhere repoints a
	// projection at a different device, which belongs in this list and would otherwise never appear.
	it('reloads the source devices when a projection is repointed elsewhere', async () => {
		mountSources({
			properties: [{ id: 'p', valueOrigin: DevicesVirtualPluginValueOrigin.source, sourceProperty: 'source-1' }],
		});

		await flushPromises();

		const callsBefore = (backendClient.GET as Mock).mock.calls.length;

		properties[0] = { ...properties[0], sourceProperty: 'source-2' } as IVirtualChannelProperty;

		await flushPromises();

		expect((backendClient.GET as Mock).mock.calls.length).toBeGreaterThan(callsBefore);
	});

	// The mount fetch already answers this question; the channels and properties arriving afterwards
	// must not spend a second request asking it again.
	it('does not refetch while the links it is watching are only settling into place', async () => {
		mountSources({
			properties: [{ id: 'p', valueOrigin: DevicesVirtualPluginValueOrigin.source, sourceProperty: 'source-1' }],
		});

		await flushPromises();

		expect((backendClient.GET as Mock).mock.calls.length).toBe(1);
	});

	it('reloads the source devices after a successful remap', async () => {
		const { wrapper, warnings } = mountSources({
			properties: [{ id: 'p', valueOrigin: DevicesVirtualPluginValueOrigin.source, sourceProperty: null }],
		});

		await flushPromises();

		const callsBeforeRemap = (backendClient.GET as Mock).mock.calls.length;

		await wrapper.get(`[data-test-id="remap-${warnings.value[0].propertyId}"]`).trigger('click');
		await wrapper.findComponent({ name: 'VirtualDeviceRemapDialog' }).vm.$emit('remapped');
		await flushPromises();

		expect(wrapper.findComponent({ name: 'VirtualDeviceRemapDialog' }).exists()).toBe(false);
		expect((backendClient.GET as Mock).mock.calls.length).toBeGreaterThan(callsBeforeRemap);
	});
});
