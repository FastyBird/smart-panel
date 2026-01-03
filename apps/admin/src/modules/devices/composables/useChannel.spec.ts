import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IChannel } from '../store/channels.store.types';

import { useChannel } from './useChannel';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useChannel', () => {
	const fakeId = 'channel-1';
	let data: Record<string, IChannel>;
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
			[fakeId]: {
				id: fakeId,
				draft: false,
			} as IChannel,
		};

		semaphore = ref({
			fetching: {
				item: [],
				items: [],
			},
		});

		get = vi.fn();

		mockStore = {
			get,
			$id: 'channels',
			data: ref(data),
			semaphore,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return a channel by ID', () => {
		const { channel } = useChannel({ id: fakeId });

		expect(channel.value).toEqual(data[fakeId]);
	});

	it('should indicate loading when fetching item by ID', () => {
		semaphore.value.fetching.item.push(fakeId);

		const { isLoading } = useChannel({ id: fakeId });

		expect(isLoading.value).toBe(true);
	});

	it('should indicate loading when item not found and fetching all', () => {
		semaphore.value.fetching.items.push('all');

		const { isLoading } = useChannel({ id: 'nonexistent' });

		expect(isLoading.value).toBe(true);
	});

	it('should not call fetch if item is a draft', async () => {
		data[fakeId]!.draft = true;

		const { fetchChannel } = useChannel({ id: fakeId });

		await fetchChannel();

		expect(get).not.toHaveBeenCalled();
	});

	it('should call fetch if item is not a draft', async () => {
		data[fakeId]!.draft = false;

		const { fetchChannel } = useChannel({ id: fakeId });

		await fetchChannel();

		expect(get).toHaveBeenCalledWith({ id: fakeId });
	});
});
