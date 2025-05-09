import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IHomeAssistantDiscoveredDevice } from '../store/home-assistant-discovered-devices.store.types';

import { useDiscoveredDevice } from './useDiscoveredDevice';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useDiscoveredDevice', () => {
	const deviceId = 'device-1';

	let data: Record<string, IHomeAssistantDiscoveredDevice>;
	let semaphore: Ref;
	let get: Mock;
	let mockStore: {
		$id: string;
		get: Mock;
		data: Ref;
		semaphore: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		data = {
			[deviceId]: {
				id: deviceId,
			} as IHomeAssistantDiscoveredDevice,
		};

		semaphore = ref({
			fetching: {
				item: [],
				items: [],
			},
		});

		get = vi.fn();

		mockStore = {
			$id: 'devices',
			get,
			data: ref(data),
			semaphore,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return the correct device by ID', () => {
		const { device } = useDiscoveredDevice({ id: deviceId });

		expect(device.value).toEqual(data[deviceId]);
	});

	it('should return null if device ID is not found', () => {
		const { device } = useDiscoveredDevice({ id: 'nonexistent' });

		expect(device.value).toBeNull();
	});

	it('should call get()', async () => {
		const { fetchDevice } = useDiscoveredDevice({ id: deviceId });

		await fetchDevice();

		expect(get).toHaveBeenCalledWith({ id: deviceId });
	});

	it('should return isLoading = true if fetching by ID', () => {
		semaphore.value.fetching.item.push(deviceId);

		const { isLoading } = useDiscoveredDevice({ id: deviceId });

		expect(isLoading.value).toBe(true);
	});

	it('should return isLoading = false if device is already loaded', () => {
		const { isLoading } = useDiscoveredDevice({ id: deviceId });

		expect(isLoading.value).toBe(false);
	});

	it('should return isLoading = true if device is missing and items are loading', () => {
		semaphore.value.fetching.items.push('all');

		const { isLoading } = useDiscoveredDevice({ id: 'unknown' });

		expect(isLoading.value).toBeTruthy();
	});
});
