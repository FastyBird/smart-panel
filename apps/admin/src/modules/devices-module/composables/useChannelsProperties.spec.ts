import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IChannelProperty } from '../store';

import { useChannelsProperties } from './useChannelsProperties';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useChannelsProperties', () => {
	const channelId = 'channel-1';

	let data: Record<string, IChannelProperty>;
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

		data = {
			'property-1': { id: 'property-1', channel: channelId } as IChannelProperty,
			'property-2': { id: 'property-2', channel: 'channel-2' } as IChannelProperty,
		};

		semaphore = ref({
			fetching: {
				items: [],
			},
		});

		firstLoad = ref([]);

		fetch = vi.fn();
		findAll = vi.fn(() => Object.values(data));

		mockStore = {
			$id: 'channel-properties',
			fetch,
			findAll,
			semaphore,
			firstLoad,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return all properties if no channelId is provided', () => {
		const { properties } = useChannelsProperties(undefined as unknown as string);

		expect(properties.value).toHaveLength(2);
	});

	it('should return only properties matching the channel ID', () => {
		const { properties } = useChannelsProperties(channelId);

		expect(properties.value).toEqual([{ id: 'property-1', channel: channelId }]);
	});

	it('should call fetchProperties', async () => {
		const { fetchProperties } = useChannelsProperties(channelId);

		await fetchProperties();

		expect(fetch).toHaveBeenCalledWith({ channelId });
	});

	it('should return areLoading = true if fetching includes channelId', () => {
		semaphore.value.fetching.items.push(channelId);

		const { areLoading } = useChannelsProperties(channelId);

		expect(areLoading.value).toBe(true);
	});

	it('should return areLoading = false if firstLoad includes channelId', () => {
		firstLoad.value.push(channelId);

		const { areLoading } = useChannelsProperties(channelId);

		expect(areLoading.value).toBe(false);
	});

	it('should return loaded = true if firstLoad includes channelId', () => {
		firstLoad.value.push(channelId);

		const { loaded } = useChannelsProperties(channelId);

		expect(loaded.value).toBe(true);
	});

	it('should return loaded = false if firstLoad does not include channelId', () => {
		const { loaded } = useChannelsProperties(channelId);

		expect(loaded.value).toBe(false);
	});
});
