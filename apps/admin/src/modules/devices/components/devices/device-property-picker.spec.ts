import { type ComputedRef, computed, h, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import {
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
	DevicesModuleDeviceCategory,
} from '../../../../openapi.constants';
import type { IChannelProperty } from '../../store/channels.properties.store.types';
import type { IChannel } from '../../store/channels.store.types';
import type { IDevice } from '../../store/devices.store.types';

import type { IDevicePropertyPickerProps } from './device-property-picker.types';
import DevicePropertyPicker from './device-property-picker.vue';

const mockDevices = ref<IDevice[]>([]);
const mockChannels = ref<IChannel[]>([]);
const mockProperties = ref<IChannelProperty[]>([]);
const mockDevicesLoaded = ref<boolean>(true);
const mockFetchDevices = vi.fn();
const mockFetchChannels = vi.fn();
const mockFetchProperties = vi.fn();

let channelsDeviceId: ComputedRef<string> | undefined;
let propertiesChannelId: ComputedRef<string | undefined> | undefined;

vi.mock('../../composables/composables', () => ({
	useDevices: () => ({
		devices: mockDevices,
		fetchDevices: mockFetchDevices,
		areLoading: ref(false),
		loaded: mockDevicesLoaded,
	}),
	useChannels: ({ deviceId }: { deviceId: ComputedRef<string> }) => {
		channelsDeviceId = deviceId;

		return { channels: mockChannels, fetchChannels: mockFetchChannels, areLoading: ref(false) };
	},
	useChannelsProperties: ({ channelId }: { channelId: ComputedRef<string | undefined> }) => {
		propertiesChannelId = channelId;

		// As the real composable: the properties of the given channel, or all of them without one
		const properties = computed<IChannelProperty[]>(() =>
			mockProperties.value.filter((item) => !channelId.value || item.channel === channelId.value)
		);

		return { properties, fetchProperties: mockFetchProperties, areLoading: ref(false) };
	},
}));

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

const device = (overrides: Partial<IDevice>): IDevice =>
	({ id: 'device', name: 'Device', category: DevicesModuleDeviceCategory.generic, hidden: false, ...overrides }) as IDevice;

const channel = (overrides: Partial<IChannel>): IChannel => ({ id: 'channel', device: 'device', name: 'Channel', ...overrides }) as IChannel;

const property = (overrides: Partial<IChannelProperty>): IChannelProperty =>
	({
		id: 'property',
		channel: 'channel',
		name: 'Property',
		category: 'generic',
		dataType: DevicesModuleChannelPropertyDataType.string,
		permissions: [DevicesModuleChannelPropertyPermissions.rw],
		...overrides,
	}) as IChannelProperty;

const mountPicker = (props: Partial<IDevicePropertyPickerProps> = {}, slots: Record<string, () => unknown> = {}): VueWrapper =>
	mount(DevicePropertyPicker, {
		props: { deviceId: '', channelId: null, propertyId: null, ...props },
		slots,
	});

const findSelect = (wrapper: VueWrapper, name: string) => {
	const select = wrapper.findAllComponents({ name: 'ElSelect' }).find((control) => control.props('name') === name);

	expect(select).toBeDefined();

	return select!;
};

const optionValues = (wrapper: VueWrapper): unknown[] => wrapper.findAllComponents({ name: 'ElOption' }).map((option) => option.props('value'));

const optionLabels = (wrapper: VueWrapper): unknown[] => wrapper.findAllComponents({ name: 'ElOption' }).map((option) => option.props('label'));

const pick = async (wrapper: VueWrapper, name: string, value: string): Promise<void> => {
	const select = findSelect(wrapper, name);

	select.vm.$emit('update:modelValue', value);
	select.vm.$emit('change', value);

	await flushPromises();
};

describe('DevicePropertyPicker', (): void => {
	beforeEach((): void => {
		mockDevices.value = [];
		mockChannels.value = [];
		mockProperties.value = [];
		mockDevicesLoaded.value = true;
		channelsDeviceId = undefined;
		propertiesChannelId = undefined;

		vi.clearAllMocks();

		mockFetchDevices.mockResolvedValue(undefined);
		mockFetchChannels.mockResolvedValue(undefined);
		mockFetchProperties.mockResolvedValue(undefined);
	});

	describe('devices', (): void => {
		it('offers the visible devices sorted by name regardless of the letter case', (): void => {
			mockDevices.value = [
				device({ id: 'c', name: 'charlie' }),
				device({ id: 'hidden', name: 'Alpha hidden', hidden: true }),
				device({ id: 'b', name: 'Bravo' }),
				device({ id: 'a', name: 'alpha' }),
			];

			const wrapper = mountPicker();

			expect(optionValues(findSelect(wrapper, 'deviceId'))).toEqual(['a', 'b', 'c']);
			expect(findSelect(wrapper, 'deviceId').props('disabled')).toBe(false);
		});

		it('disables the device select when there is no device to offer', (): void => {
			const wrapper = mountPicker();

			expect(findSelect(wrapper, 'deviceId').props('disabled')).toBe(true);
		});

		it('offers only the recommended devices until all devices are asked for', async (): Promise<void> => {
			mockDevices.value = [
				device({ id: 'light', name: 'Light', category: DevicesModuleDeviceCategory.lighting }),
				device({ id: 'sensor', name: 'Sensor', category: DevicesModuleDeviceCategory.sensor }),
			];

			const wrapper = mountPicker({ recommendedCategories: [DevicesModuleDeviceCategory.lighting] });

			expect(optionValues(findSelect(wrapper, 'deviceId'))).toEqual(['light']);
			expect(wrapper.findAllComponents({ name: 'ElOptionGroup' })).toHaveLength(0);

			await wrapper.setProps({ showAllDevices: true });

			const groups = wrapper.findAllComponents({ name: 'ElOptionGroup' });

			expect(groups.map((group) => group.props('label'))).toEqual([
				'devicesModule.fields.propertyPicker.device.groups.recommended',
				'devicesModule.fields.propertyPicker.device.groups.other',
			]);
			expect(optionValues(groups[0] as VueWrapper)).toEqual(['light']);
			expect(optionValues(groups[1] as VueWrapper)).toEqual(['sensor']);
		});

		it('offers the other devices when none is of a recommended category', (): void => {
			mockDevices.value = [device({ id: 'sensor', name: 'Sensor', category: DevicesModuleDeviceCategory.sensor })];

			const wrapper = mountPicker({ recommendedCategories: [DevicesModuleDeviceCategory.lighting] });

			expect(optionValues(findSelect(wrapper, 'deviceId'))).toEqual(['sensor']);
		});

		it('renders the device label slot in place of the default title', (): void => {
			const wrapper = mountPicker({}, { 'device-label': () => h('span', { class: 'custom-label' }, 'Custom label') });

			expect(wrapper.find('.custom-label').text()).toBe('Custom label');
			expect(wrapper.find('[class*="device--custom-label"]').exists()).toBe(true);
		});
	});

	describe('channels and properties', (): void => {
		beforeEach((): void => {
			mockDevices.value = [device({})];
			mockChannels.value = [
				channel({ id: 'writable', name: 'writable channel' }),
				channel({ id: 'readable', name: 'Readable channel' }),
				channel({ id: 'event', name: 'Event channel' }),
			];
			mockProperties.value = [
				property({ id: 'rw', channel: 'writable', name: 'Level', dataType: DevicesModuleChannelPropertyDataType.uchar }),
				property({
					id: 'wo',
					channel: 'writable',
					name: 'command',
					dataType: DevicesModuleChannelPropertyDataType.enum,
					permissions: [DevicesModuleChannelPropertyPermissions.wo],
				}),
				property({
					id: 'ro',
					channel: 'readable',
					name: 'Temperature',
					dataType: DevicesModuleChannelPropertyDataType.float,
					permissions: [DevicesModuleChannelPropertyPermissions.ro],
				}),
				property({
					id: 'ev',
					channel: 'event',
					name: 'Pressed',
					dataType: DevicesModuleChannelPropertyDataType.bool,
					permissions: [DevicesModuleChannelPropertyPermissions.ev],
				}),
			];
		});

		it('offers every channel and property when no filter is set', (): void => {
			const wrapper = mountPicker({ deviceId: 'device', channelId: 'writable' });

			expect(optionValues(findSelect(wrapper, 'channelId'))).toEqual(['event', 'readable', 'writable']);
			expect(optionValues(findSelect(wrapper, 'propertyId'))).toEqual(['wo', 'rw']);
		});

		it('offers only the writable properties and the channels having one', (): void => {
			const wrapper = mountPicker({ deviceId: 'device', channelId: 'writable', access: 'writable' });

			expect(optionValues(findSelect(wrapper, 'channelId'))).toEqual(['writable']);
			expect(optionValues(findSelect(wrapper, 'propertyId'))).toEqual(['wo', 'rw']);
		});

		it('offers only the readable properties and the channels having one', (): void => {
			const wrapper = mountPicker({ deviceId: 'device', channelId: 'readable', access: 'readable' });

			expect(optionValues(findSelect(wrapper, 'channelId'))).toEqual(['readable', 'writable']);
			expect(optionValues(findSelect(wrapper, 'propertyId'))).toEqual(['ro']);
		});

		it('offers only the properties of the given data types', (): void => {
			const wrapper = mountPicker({
				deviceId: 'device',
				channelId: 'readable',
				dataTypes: [DevicesModuleChannelPropertyDataType.float, DevicesModuleChannelPropertyDataType.bool],
			});

			expect(optionValues(findSelect(wrapper, 'channelId'))).toEqual(['event', 'readable']);
			expect(optionValues(findSelect(wrapper, 'propertyId'))).toEqual(['ro']);
		});

		it('combines the custom property filter with the access filter', (): void => {
			const wrapper = mountPicker({
				deviceId: 'device',
				channelId: 'writable',
				access: 'writable',
				propertyFilter: (item: IChannelProperty): boolean => item.id !== 'wo',
			});

			expect(optionValues(findSelect(wrapper, 'propertyId'))).toEqual(['rw']);
		});

		it('keeps the sibling channels on offer when one channel is picked', (): void => {
			// The properties composable hands over the picked channel alone; the siblings must not go with it
			const wrapper = mountPicker({ deviceId: 'device', channelId: 'writable', access: 'readable' });

			expect(optionValues(findSelect(wrapper, 'channelId'))).toEqual(['readable', 'writable']);
		});

		it('keeps a channel whose properties are not loaded yet on offer', (): void => {
			mockProperties.value = mockProperties.value.filter((item) => item.channel !== 'readable');

			const wrapper = mountPicker({ deviceId: 'device', channelId: 'writable', access: 'writable' });

			expect(optionValues(findSelect(wrapper, 'channelId'))).toEqual(['readable', 'writable']);
		});

		it('offers every channel while no property is loaded yet', (): void => {
			mockProperties.value = [];

			const wrapper = mountPicker({ deviceId: 'device', access: 'writable' });

			expect(optionValues(findSelect(wrapper, 'channelId'))).toEqual(['event', 'readable', 'writable']);
		});

		it('labels a property without a name with its translated category', (): void => {
			mockProperties.value = [property({ id: 'unnamed', channel: 'writable', name: null, category: 'brightness' } as Partial<IChannelProperty>)];

			const wrapper = mountPicker({ deviceId: 'device', channelId: 'writable' });

			expect(optionLabels(findSelect(wrapper, 'propertyId'))).toEqual(['devicesModule.categories.channelsProperties.brightness']);
		});

		it('disables the channel and property selects until their parent is picked', async (): Promise<void> => {
			const wrapper = mountPicker();

			expect(findSelect(wrapper, 'channelId').props('disabled')).toBe(true);
			expect(findSelect(wrapper, 'propertyId').props('disabled')).toBe(true);

			await wrapper.setProps({ deviceId: 'device' });

			expect(findSelect(wrapper, 'channelId').props('disabled')).toBe(false);
			expect(findSelect(wrapper, 'propertyId').props('disabled')).toBe(true);

			await wrapper.setProps({ channelId: 'writable' });

			expect(findSelect(wrapper, 'propertyId').props('disabled')).toBe(false);
		});

		it('tells there is nothing to pick from in the placeholders', (): void => {
			mockChannels.value = [];
			mockProperties.value = [];

			const wrapper = mountPicker({ deviceId: 'device', channelId: 'writable' });

			expect(findSelect(wrapper, 'channelId').props('placeholder')).toBe('devicesModule.fields.propertyPicker.channel.empty');
			expect(findSelect(wrapper, 'propertyId').props('placeholder')).toBe('devicesModule.fields.propertyPicker.property.empty');
		});
	});

	describe('selection', (): void => {
		it('passes the selection to the selects and to the channels and properties composables', async (): Promise<void> => {
			const wrapper = mountPicker({ deviceId: 'device', channelId: 'channel', propertyId: 'property' });

			expect(findSelect(wrapper, 'deviceId').props('modelValue')).toBe('device');
			expect(findSelect(wrapper, 'channelId').props('modelValue')).toBe('channel');
			expect(findSelect(wrapper, 'propertyId').props('modelValue')).toBe('property');
			expect(channelsDeviceId?.value).toBe('device');
			expect(propertiesChannelId?.value).toBe('channel');

			await wrapper.setProps({ deviceId: 'other-device', channelId: null });

			expect(channelsDeviceId?.value).toBe('other-device');
			expect(propertiesChannelId?.value).toBeUndefined();
		});

		it('clears the channel and the property when a device is picked', async (): Promise<void> => {
			const wrapper = mountPicker({ deviceId: 'device', channelId: 'channel', propertyId: 'property' });

			await pick(wrapper, 'deviceId', 'other-device');

			expect(wrapper.emitted('update:deviceId')).toEqual([['other-device']]);
			expect(wrapper.emitted('update:channelId')).toEqual([[null]]);
			expect(wrapper.emitted('update:propertyId')).toEqual([[null]]);
			expect(wrapper.emitted('change')).toEqual([['device']]);
		});

		it('clears the property when a channel is picked', async (): Promise<void> => {
			const wrapper = mountPicker({ deviceId: 'device', channelId: 'channel', propertyId: 'property' });

			await pick(wrapper, 'channelId', 'other-channel');

			expect(wrapper.emitted('update:deviceId')).toBeUndefined();
			expect(wrapper.emitted('update:channelId')).toEqual([['other-channel']]);
			expect(wrapper.emitted('update:propertyId')).toEqual([[null]]);
			expect(wrapper.emitted('change')).toEqual([['channel']]);
		});

		it('reports a picked property', async (): Promise<void> => {
			const wrapper = mountPicker({ deviceId: 'device', channelId: 'channel' });

			await pick(wrapper, 'propertyId', 'property');

			expect(wrapper.emitted('update:channelId')).toBeUndefined();
			expect(wrapper.emitted('update:propertyId')).toEqual([['property']]);
			expect(wrapper.emitted('change')).toEqual([['property']]);
		});
	});

	describe('loading', (): void => {
		it('fetches the devices only when they are not loaded yet', async (): Promise<void> => {
			mountPicker();
			await flushPromises();

			expect(mockFetchDevices).not.toHaveBeenCalled();

			mockDevicesLoaded.value = false;

			mountPicker();
			await flushPromises();

			expect(mockFetchDevices).toHaveBeenCalledTimes(1);
		});

		it('fetches nothing else while no device is picked', async (): Promise<void> => {
			mountPicker();
			await flushPromises();

			expect(mockFetchChannels).not.toHaveBeenCalled();
			expect(mockFetchProperties).not.toHaveBeenCalled();
		});

		it('fetches the channels and the properties of an initial selection', async (): Promise<void> => {
			mountPicker({ deviceId: 'device', channelId: 'channel', propertyId: 'property' });
			await flushPromises();

			expect(mockFetchChannels).toHaveBeenCalledTimes(1);
			expect(mockFetchProperties).toHaveBeenCalledTimes(1);
		});

		it('fetches the channels and the properties whenever the selection changes', async (): Promise<void> => {
			const wrapper = mountPicker();

			await wrapper.setProps({ deviceId: 'device' });
			await flushPromises();

			expect(mockFetchChannels).toHaveBeenCalledTimes(1);
			expect(mockFetchProperties).not.toHaveBeenCalled();

			await wrapper.setProps({ channelId: 'channel' });
			await flushPromises();

			expect(mockFetchProperties).toHaveBeenCalledTimes(1);

			await wrapper.setProps({ channelId: null });
			await flushPromises();

			expect(mockFetchProperties).toHaveBeenCalledTimes(1);
		});
	});

	describe('form binding', (): void => {
		it('uses the default field names and texts', (): void => {
			const wrapper = mountPicker();

			expect(wrapper.findAllComponents({ name: 'ElFormItem' }).map((item) => item.props('prop'))).toEqual(['deviceId', 'channelId', 'propertyId']);
			expect(wrapper.findAllComponents({ name: 'ElFormItem' }).map((item) => item.find('.el-form-item__label').text())).toEqual([
				'devicesModule.fields.propertyPicker.device.title',
				'devicesModule.fields.propertyPicker.channel.title',
				'devicesModule.fields.propertyPicker.property.title',
			]);
			expect(wrapper.findAllComponents({ name: 'ElSelect' }).map((select) => select.props('placeholder'))).toEqual([
				'devicesModule.fields.propertyPicker.device.placeholder',
				'devicesModule.fields.propertyPicker.channel.placeholder',
				'devicesModule.fields.propertyPicker.property.placeholder',
			]);
		});

		it('uses the given field names and texts', (): void => {
			const wrapper = mountPicker({
				deviceProp: 'device',
				channelProp: 'channel',
				propertyProp: 'property',
				texts: { deviceTitle: 'Source device', channelPlaceholder: 'Pick a channel' },
			});

			expect(wrapper.findAllComponents({ name: 'ElFormItem' }).map((item) => item.props('prop'))).toEqual(['device', 'channel', 'property']);
			expect(wrapper.findAllComponents({ name: 'ElSelect' }).map((select) => select.props('name'))).toEqual(['device', 'channel', 'property']);
			expect(wrapper.findAllComponents({ name: 'ElFormItem' }).map((item) => item.find('.el-form-item__label').text())).toEqual([
				'Source device',
				'devicesModule.fields.propertyPicker.channel.title',
				'devicesModule.fields.propertyPicker.property.title',
			]);
			expect(findSelect(wrapper, 'channel').props('placeholder')).toBe('Pick a channel');
		});
	});
});
