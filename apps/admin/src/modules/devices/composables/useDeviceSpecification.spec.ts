import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { DevicesChannelCategory, DevicesDeviceCategory } from '../../../openapi';
import { DevicesException } from '../devices.exceptions';

import { useDeviceSpecification } from './useDeviceSpecification';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useDeviceSpecification', () => {
	const deviceId = 'device-1';
	let mockDevicesStore: {
		findById: Mock;
	};
	let mockChannelsStore: {
		findForDevice: Mock;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		mockDevicesStore = {
			findById: vi.fn(),
		};

		mockChannelsStore = {
			findForDevice: vi.fn(),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: (key: symbol) => {
				if (key.description?.includes('ChannelsStore')) return mockChannelsStore;
				if (key.description?.includes('DevicesStore')) return mockDevicesStore;
				throw new Error('Unknown store');
			},
		});
	});

	it('should return true for canAddAnotherChannel when device is null', () => {
		mockDevicesStore.findById.mockReturnValue(null);

		const { canAddAnotherChannel } = useDeviceSpecification({ id: deviceId });

		expect(canAddAnotherChannel.value).toBe(true);
	});

	it('should return true if there are remaining allowed categories', () => {
		mockDevicesStore.findById.mockReturnValue({
			id: deviceId,
			category: DevicesDeviceCategory.lighting,
		});

		mockChannelsStore.findForDevice.mockReturnValue([{ id: '1', category: DevicesChannelCategory.light }]);

		const { canAddAnotherChannel } = useDeviceSpecification({ id: deviceId });

		expect(canAddAnotherChannel.value).toBe(true); // electrical_power etc. still available
	});

	it('should return false if all allowed categories are used and no multiples', () => {
		mockDevicesStore.findById.mockReturnValue({
			id: deviceId,
			category: DevicesDeviceCategory.alarm,
		});

		mockChannelsStore.findForDevice.mockReturnValue([
			{ id: '1', category: DevicesChannelCategory.device_information },
			{ id: '2', category: DevicesChannelCategory.alarm },
		]);

		const { canAddAnotherChannel } = useDeviceSpecification({ id: deviceId });

		expect(canAddAnotherChannel.value).toBe(false);
	});

	it('should return true if there are multiples allowed (even if all required/optional used)', () => {
		mockDevicesStore.findById.mockReturnValue({
			id: deviceId,
			category: DevicesDeviceCategory.sensor,
		});

		mockChannelsStore.findForDevice.mockReturnValue([{ id: '1', category: DevicesChannelCategory.device_information }]);

		const { canAddAnotherChannel } = useDeviceSpecification({ id: deviceId });

		expect(canAddAnotherChannel.value).toBe(true); // `sensor` has `multiple` allowed
	});

	it('should throw if device not found for missingRequiredChannels', () => {
		mockDevicesStore.findById.mockReturnValue(null);

		const { missingRequiredChannels } = useDeviceSpecification({ id: deviceId });

		expect(() => missingRequiredChannels.value).toThrow(DevicesException);
	});

	it('should return list of missing required channels', () => {
		mockDevicesStore.findById.mockReturnValue({
			id: deviceId,
			category: DevicesDeviceCategory.lighting,
		});

		mockChannelsStore.findForDevice.mockReturnValue([{ id: '1', category: DevicesChannelCategory.device_information }]);

		const { missingRequiredChannels } = useDeviceSpecification({ id: deviceId });

		expect(missingRequiredChannels.value).toContain(DevicesChannelCategory.light);
	});
});
