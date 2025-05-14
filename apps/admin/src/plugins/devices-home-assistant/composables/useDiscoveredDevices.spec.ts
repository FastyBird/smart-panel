import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IHomeAssistantDiscoveredDevice } from '../store/home-assistant-discovered-devices.store.types';

import { useDiscoveredDevices } from './useDiscoveredDevices';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useDiscoveredDevices', () => {
	let mockData: Record<string, IHomeAssistantDiscoveredDevice>;
	let semaphore: Ref;
	let firstLoad: Ref;
	let fetch: Mock;
	let findAll: Mock;
	let mockStore: {
		$id: string;
		fetch: Mock;
		findAll: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		mockData = {
			'device-1': { id: 'device-1' } as IHomeAssistantDiscoveredDevice,
			'device-2': { id: 'device-2' } as IHomeAssistantDiscoveredDevice,
		};

		semaphore = ref({
			fetching: {
				items: false,
			},
		});

		firstLoad = ref(false);
		fetch = vi.fn();
		findAll = vi.fn(() => Object.values(mockData));

		mockStore = {
			$id: 'devices',
			fetch,
			findAll,
			semaphore,
			firstLoad,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return devices', () => {
		const { devices } = useDiscoveredDevices();

		expect(devices.value).toEqual([{ id: 'device-1' }, { id: 'device-2' }]);
	});

	it('should call fetchDiscoveredDevices', async () => {
		const { fetchDiscoveredDevices } = useDiscoveredDevices();

		await fetchDiscoveredDevices();

		expect(fetch).toHaveBeenCalled();
	});

	it('should return areLoading = true if fetching.items is truthy', () => {
		semaphore.value.fetching.items = ['all'];

		const { areLoading } = useDiscoveredDevices();

		expect(areLoading.value).toBe(true);
	});

	it('should return areLoading = false if firstLoad is true', () => {
		firstLoad.value = true;

		const { areLoading } = useDiscoveredDevices();

		expect(areLoading.value).toBe(false);
	});

	it('should return loaded = true if firstLoad is true', () => {
		firstLoad.value = true;

		const { loaded } = useDiscoveredDevices();

		expect(loaded.value).toBe(true);
	});

	it('should return loaded = false if firstLoad is false', () => {
		firstLoad.value = false;

		const { loaded } = useDiscoveredDevices();

		expect(loaded.value).toBe(false);
	});
});
