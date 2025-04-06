import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { ITile } from '../store/tiles.store.types';

import { useTile } from './useTile';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useTile', () => {
	const pageId = 'page-1';
	const tileId = 'tile-1';

	let data: Record<string, ITile>;
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
			[tileId]: {
				id: tileId,
				page: pageId,
				draft: false,
			} as ITile,
		};

		semaphore = ref({
			fetching: {
				item: [],
				items: [],
			},
		});

		get = vi.fn();

		mockStore = {
			$id: 'tiles',
			get,
			data: ref(data),
			semaphore,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return the correct tile by ID', () => {
		const { tile } = useTile({ parent: 'page', pageId, id: tileId });

		expect(tile.value).toEqual(data[tileId]);
	});

	it('should return null if tile ID is not found', () => {
		const { tile } = useTile({ parent: 'page', pageId, id: 'nonexistent' });

		expect(tile.value).toBeNull();
	});

	it('should call get() only if tile is not a draft', async () => {
		const { fetchTile } = useTile({ parent: 'page', pageId, id: tileId });

		await fetchTile();

		expect(get).toHaveBeenCalledWith({ parent: 'page', id: tileId, pageId });
	});

	it('should not call get() if tile is a draft', async () => {
		data[tileId].draft = true;

		const { fetchTile } = useTile({ parent: 'page', pageId, id: tileId });

		await fetchTile();

		expect(get).not.toHaveBeenCalled();
	});

	it('should return isLoading = true if fetching item includes ID', () => {
		semaphore.value.fetching.item.push(tileId);

		const { isLoading } = useTile({ parent: 'page', pageId, id: tileId });

		expect(isLoading.value).toBe(true);
	});

	it('should return isLoading = false if tile is already loaded', () => {
		const { isLoading } = useTile({ parent: 'page', pageId, id: tileId });

		expect(isLoading.value).toBe(false);
	});

	it('should return isLoading = true if items include pageId', () => {
		semaphore.value.fetching.items.push(pageId);

		const { isLoading } = useTile({ parent: 'page', pageId, id: 'nonexistent' });

		expect(isLoading.value).toBe(true);
	});
});
