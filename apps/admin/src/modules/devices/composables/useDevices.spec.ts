import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IDevice } from '../store/devices.store.types';

import { useDevices } from './useDevices';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useDevices', () => {
	let mockData: Record<string, IDevice>;
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
			'device-1': { id: 'device-1', draft: false } as IDevice,
			'device-2': { id: 'device-2', draft: true } as IDevice,
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

	it('should return only non-draft devices', () => {
		const { devices } = useDevices();

		expect(devices.value).toEqual([{ id: 'device-1', draft: false }]);
	});

	it('should call fetchDevices', async () => {
		const { fetchDevices } = useDevices();

		await fetchDevices();

		expect(fetch).toHaveBeenCalled();
	});

	it('should return areLoading = true if fetching.items is truthy', () => {
		semaphore.value.fetching.items = ['all'];

		const { areLoading } = useDevices();

		expect(areLoading.value).toBe(true);
	});

	it('should return areLoading = false if firstLoad is true', () => {
		firstLoad.value = true;

		const { areLoading } = useDevices();

		expect(areLoading.value).toBe(false);
	});

	it('should return loaded = true if firstLoad is true', () => {
		firstLoad.value = true;

		const { loaded } = useDevices();

		expect(loaded.value).toBe(true);
	});

	it('should return loaded = false if firstLoad is false', () => {
		firstLoad.value = false;

		const { loaded } = useDevices();

		expect(loaded.value).toBe(false);
	});
});
