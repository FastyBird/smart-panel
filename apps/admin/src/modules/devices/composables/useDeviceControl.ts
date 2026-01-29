import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';

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
const PENDING_VALUE_TIMEOUT = 10000; // Clear pending values after 10 seconds as failsafe

export const useDeviceControl = ({ id }: IUseDeviceControlProps): IUseDeviceControl => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);
	const channelsStore = storesManager.getStore(channelsStoreKey);
	const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const { data: devicesData, semaphore: devicesSemaphore } = storeToRefs(devicesStore);
	const { data: channelsData, semaphore: channelsSemaphore, firstLoad: channelsFirstLoad } = storeToRefs(channelsStore);
	const { semaphore: propertiesSemaphore, firstLoad: propertiesFirstLoad } = storeToRefs(channelsPropertiesStore);

	const { sendCommand } = useSockets();

	// Debounce timers for each property
	const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	// Resolve callbacks for debounced promises (to resolve when cancelled)
	const debounceResolvers: Record<string, (value: boolean) => void> = {};

	// Pending value cleanup timers
	const pendingValueTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	// Pending values (for optimistic updates)
	const pendingValues: Ref<Record<string, string | number | boolean | null>> = ref({});

	// Loading state for each property
	const loadingProperties: Ref<Record<string, boolean>> = ref({});

	const device = computed<IDevice | null>((): IDevice | null => {
		if (id === null) {
			return null;
		}

		return devicesData.value[id] ?? null;
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
		const pendingValue = pendingValues.value[propertyId];
		if (pendingValue !== undefined) {
			return pendingValue;
		}

		const property = channelsPropertiesStore.findById(propertyId);

		return property?.value?.value ?? null;
	};

	const isPropertyLoading = (propertyId: IChannelProperty['id']): boolean => {
		return loadingProperties.value[propertyId] ?? false;
	};

	const clearPendingValue = (propertyId: IChannelProperty['id'], expectedValue?: string | number | boolean | null): void => {
		// Only clear if expectedValue matches current pending value (or no expected value specified)
		if (expectedValue !== undefined) {
			const currentPending = pendingValues.value[propertyId];

			// Don't clear if user has set a newer value while command was in-flight
			if (currentPending !== expectedValue && String(currentPending) !== String(expectedValue)) {
				return;
			}
		}

		delete pendingValues.value[propertyId];

		if (pendingValueTimers[propertyId]) {
			clearTimeout(pendingValueTimers[propertyId]);
			delete pendingValueTimers[propertyId];
		}
	};

	const schedulePendingValueCleanup = (propertyId: IChannelProperty['id'], expectedValue: string | number | boolean | null): void => {
		// Clear any existing cleanup timer
		if (pendingValueTimers[propertyId]) {
			clearTimeout(pendingValueTimers[propertyId]);
		}

		// Set a failsafe timeout to clear pending value (only if it still matches)
		pendingValueTimers[propertyId] = setTimeout(() => {
			const currentPending = pendingValues.value[propertyId];

			// Only clear if the pending value hasn't changed
			if (currentPending === expectedValue || String(currentPending) === String(expectedValue)) {
				delete pendingValues.value[propertyId];
			}

			delete pendingValueTimers[propertyId];
		}, PENDING_VALUE_TIMEOUT);
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

		// Clear existing debounce timer and resolve its promise
		if (debounceTimers[propertyId]) {
			clearTimeout(debounceTimers[propertyId]);
			delete debounceTimers[propertyId];

			// Resolve the previous promise as cancelled (false) so it doesn't hang
			if (debounceResolvers[propertyId]) {
				debounceResolvers[propertyId](false);
				delete debounceResolvers[propertyId];
			}
		}

		// Set optimistic value immediately
		pendingValues.value[propertyId] = value;

		// Return a promise that resolves after debounce and command execution
		return new Promise((resolve) => {
			// Store the resolve callback so it can be called if cancelled
			debounceResolvers[propertyId] = resolve;

			const timerId = setTimeout(async () => {
				// Clear the resolver reference since we're now executing
				delete debounceResolvers[propertyId];

				loadingProperties.value[propertyId] = true;

				try {
					const result = await sendCommand(
						EventType.CHANNEL_PROPERTY_SET,
						{
							context: {
								origin: 'admin',
							},
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
						// Revert optimistic update on failure (only if value hasn't changed)
						clearPendingValue(propertyId, value);
						resolve(false);
					} else {
						// Success - keep pending value until store updates (WS event)
						// Schedule cleanup as failsafe in case WS event never arrives
						schedulePendingValueCleanup(propertyId, value);
						resolve(true);
					}
				} catch {
					// Revert optimistic update on error (only if value hasn't changed)
					clearPendingValue(propertyId, value);
					resolve(false);
				} finally {
					loadingProperties.value[propertyId] = false;
					// Only delete if this is still the current timer (not overwritten by newer call)
					if (debounceTimers[propertyId] === timerId) {
						delete debounceTimers[propertyId];
					}
				}
			}, DEBOUNCE_DELAY);

			debounceTimers[propertyId] = timerId;
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
		// Device is loading
		if (devicesSemaphore.value.fetching.item.includes(id)) {
			return true;
		}

		// Channels are loading
		if (channelsSemaphore.value.fetching.items.includes(id)) {
			return true;
		}

		// Any channel's properties are still loading
		for (const channel of channels.value) {
			if (propertiesSemaphore.value.fetching.items.includes(channel.id)) {
				return true;
			}
		}

		return false;
	});

	const areChannelsLoaded = computed<boolean>((): boolean => {
		return channelsFirstLoad.value.includes(id);
	});

	const arePropertiesLoaded = computed<boolean>((): boolean => {
		// Not loaded if channels aren't loaded yet
		if (!areChannelsLoaded.value) {
			return false;
		}

		// Check if all channels have their properties loaded
		for (const channel of channels.value) {
			if (!propertiesFirstLoad.value.includes(channel.id)) {
				return false;
			}
		}

		return true;
	});

	// Watch for store value changes and clear pending values when they match
	watch(
		() => {
			// Create a map of property values from the store for all pending properties
			const storeValues: Record<string, string | number | boolean | null> = {};

			for (const propertyId of Object.keys(pendingValues.value)) {
				const property = channelsPropertiesStore.findById(propertyId);

				if (property) {
					storeValues[propertyId] = property.value?.value ?? null;
				}
			}

			return storeValues;
		},
		(storeValues) => {
			// Clear pending values that now match the store
			for (const [propertyId, pendingValue] of Object.entries(pendingValues.value)) {
				const storeValue = storeValues[propertyId];

				// Compare values (handle type coercion for booleans/numbers)
				if (storeValue === pendingValue || String(storeValue) === String(pendingValue)) {
					clearPendingValue(propertyId);
				}
			}
		},
		{ deep: true }
	);

	// Cleanup all timers and resolve pending promises on unmount
	onBeforeUnmount(() => {
		// Clear all debounce timers and resolve their promises
		for (const propertyId of Object.keys(debounceTimers)) {
			clearTimeout(debounceTimers[propertyId]);
			delete debounceTimers[propertyId];

			// Resolve any pending promises so they don't hang
			if (debounceResolvers[propertyId]) {
				debounceResolvers[propertyId](false);
				delete debounceResolvers[propertyId];
			}
		}

		// Clear all pending value cleanup timers
		for (const propertyId of Object.keys(pendingValueTimers)) {
			clearTimeout(pendingValueTimers[propertyId]);
			delete pendingValueTimers[propertyId];
		}
	});

	return {
		device,
		channels,
		controllableChannels,
		hasControllableProperties,
		isLoading,
		areChannelsLoaded,
		arePropertiesLoaded,
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
