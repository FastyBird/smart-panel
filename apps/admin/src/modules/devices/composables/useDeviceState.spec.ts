import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { DevicesChannelCategory, DevicesChannelPropertyCategory } from '../../../openapi';
import { ConnectionState } from '../devices.constants';
import type { IDevice } from '../store/devices.store.types';

import { useDeviceState } from './useDeviceState';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');
	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useDeviceState', () => {
	const deviceId = 'device-1';
	const channelId = 'channel-1';

	let findForDevice: Mock;
	let findForChannel: Mock;
	let mockChannelsStore: {
		$id: string;
		findForDevice: Mock;
	};
	let mockPropertiesStore: {
		$id: string;
		findForChannel: Mock;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		findForDevice = vi.fn();
		findForChannel = vi.fn();

		mockChannelsStore = {
			$id: 'channels',
			findForDevice,
		};

		mockPropertiesStore = {
			$id: 'channel-properties',
			findForChannel,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: (key: symbol) => {
				if (key.description?.includes('ChannelsPropertiesStore')) return mockPropertiesStore;
				if (key.description?.includes('ChannelsStore')) return mockChannelsStore;
				throw new Error('Unknown store');
			},
		});
	});

	it('returns UNKNOWN if no channel is found', () => {
		findForDevice.mockReturnValue([]);

		const { state } = useDeviceState({ device: { id: deviceId } as IDevice });

		expect(state.value).toBe(ConnectionState.UNKNOWN);
	});

	it('returns UNKNOWN if no status property is found', () => {
		findForDevice.mockReturnValue([{ id: channelId, category: DevicesChannelCategory.device_information }]);
		findForChannel.mockReturnValue([]);

		const { state } = useDeviceState({ device: { id: deviceId } as IDevice });

		expect(state.value).toBe(ConnectionState.UNKNOWN);
	});

	it('returns UNKNOWN if property value is invalid', () => {
		findForDevice.mockReturnValue([{ id: channelId, category: DevicesChannelCategory.device_information }]);
		findForChannel.mockReturnValue([{ id: 'prop-1', category: DevicesChannelPropertyCategory.status, value: 'invalid_status' }]);

		const { state } = useDeviceState({ device: { id: deviceId } as IDevice });

		expect(state.value).toBe(ConnectionState.UNKNOWN);
	});

	it('returns proper connection state if value is valid', () => {
		findForDevice.mockReturnValue([{ id: channelId, category: DevicesChannelCategory.device_information }]);
		findForChannel.mockReturnValue([{ id: 'prop-1', category: DevicesChannelPropertyCategory.status, value: ConnectionState.CONNECTED }]);

		const { state } = useDeviceState({ device: { id: deviceId } as IDevice });

		expect(state.value).toBe(ConnectionState.CONNECTED);
	});

	it('returns isReady = true for READY, CONNECTED, or RUNNING states', () => {
		findForDevice.mockReturnValue([{ id: channelId, category: DevicesChannelCategory.device_information }]);
		findForChannel.mockReturnValue([{ id: 'prop-1', category: DevicesChannelPropertyCategory.status, value: ConnectionState.READY }]);

		const { isReady } = useDeviceState({ device: { id: deviceId } as IDevice });

		expect(isReady.value).toBe(true);
	});

	it('returns isReady = false for other states', () => {
		findForDevice.mockReturnValue([{ id: channelId, category: DevicesChannelCategory.device_information }]);
		findForChannel.mockReturnValue([{ id: 'prop-1', category: DevicesChannelPropertyCategory.status, value: ConnectionState.DISCONNECTED }]);

		const { isReady } = useDeviceState({ device: { id: deviceId } as IDevice });

		expect(isReady.value).toBe(false);
	});
});
