import { computed, ref, type Ref } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager, useSockets } from '../../../common';
import { DevicesModuleChannelCategory, DevicesModuleChannelPropertyPermissions } from '../../../openapi.constants';
import { EventType } from '../devices.constants';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';
import type { IDevice } from '../store/devices.store.types';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../store/keys';

import type { IUseDeviceControl } from './types';

interface IUseDeviceControlProps {
	id: IDevice['id'];
}

const DEBOUNCE_DELAY = 300;

export const useDeviceControl = ({ id }: IUseDeviceControlProps): IUseDeviceControl => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);
	const channelsStore = storesManager.getStore(channelsStoreKey);
	const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const { data: devicesData, semaphore: devicesSemaphore } = storeToRefs(devicesStore);
	const { data: channelsData, semaphore: channelsSemaphore, firstLoad: channelsFirstLoad } = storeToRefs(channelsStore);

	const { sendCommand } = useSockets();

	// Debounce timers for each property
	const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	// Pending values (for optimistic updates)
	const pendingValues: Ref<Record<string, string | number | boolean | null>> = ref({});

	// Loading state for each property
	const loadingProperties: Ref<Record<string, boolean>> = ref({});

	const device = computed<IDevice | null>((): IDevice | null => {
		if (id === null) {
			return null;
		}

		return id in devicesData.value ? devicesData.value[id] : null;
	});

	const channels = computed<IChannel[]>((): IChannel[] => {
		return Object.values(channelsData.value).filter((channel) => {
			// Filter out device_information channel and channels not belonging to this device
			return channel.device === id && channel.category !== DevicesModuleChannelCategory.device_information;
		});
	});

	const controllableChannels = computed<IChannel[]>((): IChannel[] => {
		// Return channels that have at least one writable property
		return channels.value.filter((channel) => {
			const properties = channelsPropertiesStore.findForChannel(channel.id);

			return properties.some(
				(property) =>
					property.permissions.includes(DevicesModuleChannelPropertyPermissions.rw) ||
					property.permissions.includes(DevicesModuleChannelPropertyPermissions.wo)
			);
		});
	});

	const hasControllableProperties = computed<boolean>((): boolean => {
		return controllableChannels.value.length > 0;
	});

	const getPropertiesForChannel = (channelId: IChannel['id']): IChannelProperty[] => {
		return channelsPropertiesStore.findForChannel(channelId);
	};

	const isPropertyWritable = (property: IChannelProperty): boolean => {
		return (
			property.permissions.includes(DevicesModuleChannelPropertyPermissions.rw) ||
			property.permissions.includes(DevicesModuleChannelPropertyPermissions.wo)
		);
	};

	const getPropertyValue = (propertyId: IChannelProperty['id']): string | number | boolean | null => {
		// Return pending value if exists
		if (propertyId in pendingValues.value) {
			return pendingValues.value[propertyId];
		}

		const property = channelsPropertiesStore.findById(propertyId);

		return property?.value ?? null;
	};

	const isPropertyLoading = (propertyId: IChannelProperty['id']): boolean => {
		return loadingProperties.value[propertyId] ?? false;
	};

	const setPropertyValue = async (
		channelId: IChannel['id'],
		propertyId: IChannelProperty['id'],
		value: string | number | boolean | null
	): Promise<boolean> => {
		const property = channelsPropertiesStore.findById(propertyId);

		if (!property) {
			return false;
		}

		// Clear existing debounce timer for this property
		if (debounceTimers[propertyId]) {
			clearTimeout(debounceTimers[propertyId]);
		}

		// Set optimistic value immediately
		pendingValues.value[propertyId] = value;

		// Return a promise that resolves after debounce and command execution
		return new Promise((resolve) => {
			debounceTimers[propertyId] = setTimeout(async () => {
				loadingProperties.value[propertyId] = true;

				try {
					const result = await sendCommand(
						EventType.CHANNEL_PROPERTY_SET,
						{
							properties: [
								{
									device: id,
									channel: channelId,
									property: propertyId,
									value: value,
								},
							],
						},
						'DevicesModule.Internal.SetPropertyValue'
					);

					if (result !== true) {
						// Revert optimistic update on failure
						delete pendingValues.value[propertyId];
						resolve(false);
					} else {
						// Success - remove pending value (real value will come from WS event)
						delete pendingValues.value[propertyId];
						resolve(true);
					}
				} catch {
					// Revert optimistic update on error
					delete pendingValues.value[propertyId];
					resolve(false);
				} finally {
					loadingProperties.value[propertyId] = false;
					delete debounceTimers[propertyId];
				}
			}, DEBOUNCE_DELAY);
		});
	};

	const fetchDevice = async (): Promise<void> => {
		const item = id in devicesData.value ? devicesData.value[id] : null;

		if (item?.draft) {
			return;
		}

		await devicesStore.get({ id });
	};

	const fetchChannels = async (): Promise<void> => {
		await channelsStore.fetch({ deviceId: id });
	};

	const fetchProperties = async (): Promise<void> => {
		const channelsList = Object.values(channelsData.value).filter((channel) => channel.device === id);

		for (const channel of channelsList) {
			await channelsPropertiesStore.fetch({ channelId: channel.id });
		}
	};

	const isLoading = computed<boolean>((): boolean => {
		if (devicesSemaphore.value.fetching.item.includes(id)) {
			return true;
		}

		if (channelsSemaphore.value.fetching.items.includes(id)) {
			return true;
		}

		return false;
	});

	const areChannelsLoaded = computed<boolean>((): boolean => {
		return channelsFirstLoad.value.includes(id);
	});

	return {
		device,
		channels,
		controllableChannels,
		hasControllableProperties,
		isLoading,
		areChannelsLoaded,
		fetchDevice,
		fetchChannels,
		fetchProperties,
		getPropertiesForChannel,
		isPropertyWritable,
		getPropertyValue,
		isPropertyLoading,
		setPropertyValue,
	};
};
