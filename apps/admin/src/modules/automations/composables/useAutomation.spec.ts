import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IAutomation } from '../store/automations.store.types';

import { useAutomation } from './useAutomation';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

const automationId = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a01';

describe('useAutomation', () => {
	let mockStore: {
		get: Mock;
		data: Ref<Map<string, IAutomation>>;
		semaphore: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		mockStore = {
			get: vi.fn(),
			data: ref(new Map()),
			semaphore: ref({ fetching: { items: false, item: [] } }),
		};

		(injectStoresManager as Mock).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('returns null for an automation that is not in the store', () => {
		const { automation } = useAutomation({ id: automationId });

		expect(automation.value).toBeNull();
	});

	it('follows the automation in the store', () => {
		const { automation } = useAutomation({ id: automationId });

		mockStore.data.value.set(automationId, { id: automationId, name: 'Hallway motion light' } as IAutomation);

		expect(automation.value?.name).toBe('Hallway motion light');
	});

	it('reads the automation on its own', async () => {
		const { fetchAutomation } = useAutomation({ id: automationId });

		await fetchAutomation();

		expect(mockStore.get).toHaveBeenCalledWith({ id: automationId });
	});

	it('is loading while the automation is being read', () => {
		mockStore.semaphore.value.fetching.item = [automationId];

		const { isLoading } = useAutomation({ id: automationId });

		expect(isLoading.value).toBe(true);
	});

	it('is loading while the list is being read and the automation is not known yet', () => {
		mockStore.semaphore.value.fetching.items = true;

		const { isLoading } = useAutomation({ id: automationId });

		expect(isLoading.value).toBe(true);

		mockStore.data.value.set(automationId, { id: automationId, name: 'Hallway motion light' } as IAutomation);

		expect(isLoading.value).toBe(false);
	});
});
