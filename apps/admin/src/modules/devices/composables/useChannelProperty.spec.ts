import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IChannelProperty } from '../store/channels.properties.store.types';

import { useChannelProperty } from './useChannelProperty';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useChannelProperty', () => {
	const channelId = 'channel-1';
	const propertyId = 'property-1';

	let data: Record<string, IChannelProperty>;
	let semaphore: Ref;
	let get: Mock;
	let mockStore: {
		get: Mock;
		$id: string;
		data: Ref;
		semaphore: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		data = {
			[propertyId]: {
				id: propertyId,
				draft: false,
			} as IChannelProperty,
		};

		semaphore = ref({
			fetching: {
				item: [],
				items: [],
			},
		});

		get = vi.fn();

		mockStore = {
			$id: 'channel-properties',
			get,
			data: ref(data),
			semaphore,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return the correct property by ID', () => {
		const { property } = useChannelProperty({ channelId, id: propertyId });

		expect(property.value).toEqual(data[propertyId]);
	});

	it('should return null if property ID is not found', () => {
		const { property } = useChannelProperty({ channelId, id: 'nonexistent' });

		expect(property.value).toBeNull();
	});

	it('should call get() only if property is not a draft', async () => {
		const { fetchProperty } = useChannelProperty({ channelId, id: propertyId });

		await fetchProperty();

		expect(get).toHaveBeenCalledWith({ id: propertyId, channelId });
	});

	it('should not call get() if property is a draft', async () => {
		data[propertyId].draft = true;

		const { fetchProperty } = useChannelProperty({ channelId, id: propertyId });

		await fetchProperty();

		expect(get).not.toHaveBeenCalled();
	});

	it('should return isLoading = true if fetching item includes ID', () => {
		semaphore.value.fetching.item.push(propertyId);

		const { isLoading } = useChannelProperty({ channelId, id: propertyId });

		expect(isLoading.value).toBe(true);
	});

	it('should return isLoading = false if property is already loaded', () => {
		const { isLoading } = useChannelProperty({ channelId, id: propertyId });

		expect(isLoading.value).toBe(false);
	});

	it('should return isLoading = true if items include channelId or "all"', () => {
		semaphore.value.fetching.items.push(channelId);

		const { isLoading } = useChannelProperty({ channelId, id: 'nonexistent' });

		expect(isLoading.value).toBe(true);

		semaphore.value.fetching.items = ['all'];

		const { isLoading: isLoadingAll } = useChannelProperty({ channelId, id: 'nonexistent' });

		expect(isLoadingAll.value).toBe(true);
	});
});
