import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IChannel } from '../store';

import { useChannels } from './useChannels';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useChannels', () => {
	const deviceId = 'device-1';

	let mockData: Record<string, IChannel>;
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
			'channel-1': { id: 'channel-1', device: deviceId } as IChannel,
			'channel-2': { id: 'channel-2', device: 'device-2' } as IChannel,
		};

		semaphore = ref({
			fetching: {
				items: [],
			},
		});

		firstLoad = ref([]);

		fetch = vi.fn();
		findAll = vi.fn(() => Object.values(mockData));

		mockStore = {
			$id: 'channels',
			fetch,
			findAll,
			semaphore,
			firstLoad,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('returns all channels when no deviceId is passed', () => {
		const { channels } = useChannels();

		expect(channels.value).toHaveLength(2);
	});

	it('returns only channels for a specific device', () => {
		const { channels } = useChannels(deviceId);

		expect(channels.value).toEqual([{ id: 'channel-1', device: deviceId }]);
	});

	it('calls fetchChannels correctly', async () => {
		const { fetchChannels } = useChannels(deviceId);

		await fetchChannels();

		expect(fetch).toHaveBeenCalledWith({ deviceId });
	});

	it('indicates loading when fetching includes deviceId', () => {
		semaphore.value.fetching.items.push(deviceId);

		const { areLoading } = useChannels(deviceId);

		expect(areLoading.value).toBe(true);
	});

	it('does not indicate loading after firstLoad includes deviceId', () => {
		firstLoad.value.push(deviceId);

		const { areLoading } = useChannels(deviceId);

		expect(areLoading.value).toBe(false);
	});

	it('returns loaded = true when firstLoad includes deviceId', () => {
		firstLoad.value.push(deviceId);

		const { loaded } = useChannels(deviceId);

		expect(loaded.value).toBe(true);
	});

	it('returns loaded = false when firstLoad does not include deviceId', () => {
		const { loaded } = useChannels(deviceId);

		expect(loaded.value).toBe(false);
	});
});
