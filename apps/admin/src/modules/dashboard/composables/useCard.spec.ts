import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { ICard } from '../store';

import { useCard } from './useCard';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useCard', () => {
	const fakeCardId = 'card-1';
	const fakePageId = 'page-1';
	let data: Record<string, ICard>;
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
			[fakeCardId]: {
				id: fakeCardId,
				page: fakePageId,
				draft: false,
			} as ICard,
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
			$id: 'cards',
			data: ref(data),
			semaphore,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return a card by ID', () => {
		const { card } = useCard(fakeCardId, fakePageId);

		expect(card.value).toEqual(data[fakeCardId]);
	});

	it('should indicate loading when fetching item by ID', () => {
		semaphore.value.fetching.item.push(fakeCardId);

		const { isLoading } = useCard(fakeCardId, fakePageId);

		expect(isLoading.value).toBe(true);
	});

	it('should indicate loading when item not found and fetching for page', () => {
		semaphore.value.fetching.items.push(fakePageId);

		const { isLoading } = useCard('nonexistent', fakePageId);

		expect(isLoading.value).toBe(true);
	});

	it('should not call fetch if item is a draft', async () => {
		data[fakeCardId].draft = true;

		const { fetchCard } = useCard(fakeCardId, fakePageId);

		await fetchCard();

		expect(get).not.toHaveBeenCalled();
	});

	it('should call fetch if item is not a draft', async () => {
		data[fakeCardId].draft = false;

		const { fetchCard } = useCard(fakeCardId, fakePageId);

		await fetchCard();

		expect(get).toHaveBeenCalledWith({ id: fakeCardId, pageId: fakePageId });
	});
});
