import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IHomeAssistantState } from '../store/home-assistant-states.store.types';

import { useState } from './useState';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useState', () => {
	const entityId = 'entity-identifier';

	let data: Record<string, IHomeAssistantState>;
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
			[entityId]: {
				entityId,
			} as IHomeAssistantState,
		};

		semaphore = ref({
			fetching: {
				item: [],
				items: [],
			},
		});

		get = vi.fn();

		mockStore = {
			$id: 'states',
			get,
			data: ref(data),
			semaphore,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return the correct state by entity ID', () => {
		const { state } = useState({ entityId });

		expect(state.value).toEqual(data[entityId]);
	});

	it('should return null if state entity ID is not found', () => {
		const { state } = useState({ entityId: 'nonexistent' });

		expect(state.value).toBeNull();
	});

	it('should call get()', async () => {
		const { fetchState } = useState({ entityId });

		await fetchState();

		expect(get).toHaveBeenCalledWith({ entityId });
	});

	it('should return isLoading = true if fetching by entity ID', () => {
		semaphore.value.fetching.item.push(entityId);

		const { isLoading } = useState({ entityId });

		expect(isLoading.value).toBe(true);
	});

	it('should return isLoading = false if state is already loaded', () => {
		const { isLoading } = useState({ entityId });

		expect(isLoading.value).toBe(false);
	});

	it('should return isLoading = true if state is missing and items are loading', () => {
		semaphore.value.fetching.items.push('all');

		const { isLoading } = useState({ entityId: 'unknown' });

		expect(isLoading.value).toBeTruthy();
	});
});
