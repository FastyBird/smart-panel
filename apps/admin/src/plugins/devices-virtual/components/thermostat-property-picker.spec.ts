import { nextTick } from 'vue';

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';

import ThermostatPropertyPicker from './thermostat-property-picker.vue';

const mocks = vi.hoisted(() => {
	const requests: Array<{ id: string; resolve: (result: unknown) => void }> = [];
	return {
		requests,
		get: vi.fn((_: string, options: { params: { path: { id: string } } }) => new Promise((resolve) => {
			requests.push({ id: options.params.path.id, resolve });
		})),
	};
});

const devicesStore = {
	firstLoadFinished: vi.fn(() => true),
	findAll: vi.fn(() => [{ id: 'device-a', name: 'A' }, { id: 'device-b', name: 'B' }]),
	fetch: vi.fn(),
};
const channelsStore = {
	findById: vi.fn(() => null),
	findForDevice: vi.fn(() => []),
	get: vi.fn(async ({ id }: { id: string }) => ({ id, name: id, device: `device-${id.slice(-1)}` })),
	fetch: vi.fn(),
};
const propertiesStore = {
	findById: vi.fn(() => null),
	findForChannel: vi.fn(() => []),
	get: vi.fn(async ({ id, channelId }: { id: string; channelId: string }) => ({ id, channel: channelId, name: id, category: 'temperature', dataType: 'float' })),
	fetch: vi.fn(async () => []),
};

vi.mock('../../../common', () => ({
	injectStoresManager: () => ({
		getStore: (key: symbol) => {
			if (key === devicesStoreKey) return devicesStore;
			if (key === channelsStoreKey) return channelsStore;
			if (key === channelsPropertiesStoreKey) return propertiesStore;
			throw new Error('Unexpected store');
		},
	}),
	useBackend: () => ({ client: { GET: mocks.get } }),
}));

const binding = (property: string, suffix: string) => ({
	data: { data: { property, channel: `channel-${suffix}`, device: `device-${suffix}` } },
});
const mounted = (id: string) => mount(ThermostatPropertyPicker, {
	props: { modelValue: id, kind: 'setting' },
	global: { stubs: { ElSelect: true, ElOption: true, ElText: true } },
});
const selected = (wrapper: ReturnType<typeof mounted>) => wrapper.findAllComponents({ name: 'ElSelect' })
	.map((select) => select.props('modelValue'));

beforeEach(() => {
	mocks.requests.length = 0;
	vi.clearAllMocks();
});

describe('thermostat property picker', () => {
	it('resolves a saved property with bounded direct lookups and its owning channel', async () => {
		const wrapper = mounted('property-a');
		await flushPromises();
		expect(mocks.requests).toHaveLength(1);
		mocks.requests[0].resolve(binding('property-a', 'a'));
		await flushPromises();
		expect(channelsStore.get).toHaveBeenCalledWith({ id: 'channel-a' });
		expect(propertiesStore.get).toHaveBeenCalledWith({ id: 'property-a', channelId: 'channel-a' });
		expect(selected(wrapper).slice(0, 2)).toEqual(['device-a', 'channel-a']);
		expect(channelsStore.fetch).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	it('discards an old A response after A to B to A and clears a deleted property', async () => {
		const wrapper = mounted('property-a');
		await flushPromises();
		await wrapper.setProps({ modelValue: 'property-b' });
		await wrapper.setProps({ modelValue: 'property-a' });
		expect(mocks.requests.map((request) => request.id)).toEqual(['property-a', 'property-b', 'property-a']);
		mocks.requests[2].resolve(binding('property-a', 'a'));
		await flushPromises();
		mocks.requests[0].resolve(binding('property-a', 'b'));
		mocks.requests[1].resolve(binding('property-b', 'b'));
		await flushPromises();
		expect(selected(wrapper).slice(0, 2)).toEqual(['device-a', 'channel-a']);
		await wrapper.setProps({ modelValue: 'deleted-property' });
		await nextTick();
		mocks.requests[3].resolve({ data: undefined });
		await flushPromises();
		expect(selected(wrapper).slice(0, 2)).toEqual([null, null]);
		wrapper.unmount();
	});

	it('does not apply a binding from the previous owner', async () => {
		const wrapper = mount(ThermostatPropertyPicker, {
			props: { modelValue: 'property-a', ownerDeviceId: 'device-a', kind: 'setting' },
			global: { stubs: { ElSelect: true, ElOption: true, ElText: true } },
		});
		await flushPromises();
		await wrapper.setProps({ ownerDeviceId: 'device-b' });
		mocks.requests[0].resolve(binding('property-a', 'a'));
		await flushPromises();
		expect(channelsStore.get).not.toHaveBeenCalled();
		mocks.requests[1].resolve(binding('property-a', 'b'));
		await flushPromises();
		expect(selected(wrapper).slice(0, 2)).toEqual(['device-b', 'channel-b']);
		wrapper.unmount();
	});
});
