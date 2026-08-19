import { createPinia, setActivePinia } from 'pinia';

import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SpacesModuleCreateSpaceCategory, SpacesModuleCreateSpaceType } from '../../../openapi.constants';

import { useSpacesStore } from './spaces.store';

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({
			client: backendClient,
		}),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: () => 'Some error',
	};
});

const keptId = uuid().toString();
const removedId = uuid().toString();

const spaceResponse = (id: string, name: string): Record<string, unknown> => ({
	id,
	name,
	description: null,
	type: SpacesModuleCreateSpaceType.room,
	category: SpacesModuleCreateSpaceCategory.living_room,
	icon: null,
	display_order: 0,
	parent_id: null,
	suggestions_enabled: false,
	created_at: '2024-03-01T12:00:00Z',
	updated_at: null,
});

describe('Spaces store', () => {
	let store: ReturnType<typeof useSpacesStore>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useSpacesStore();

		vi.clearAllMocks();
	});

	describe('refresh contract', () => {
		it('reports itself unloaded before anything is fetched', () => {
			expect(store.isLoaded()).toBe(false);
		});

		it('reports itself loaded after a fetch, even when the collection came back empty', async () => {
			backendClient.GET.mockResolvedValueOnce({ data: { data: [] }, error: undefined });

			await store.fetch();

			// An empty collection is still a loaded one - a space created during sleep has to be
			// picked up, so this must not read as "nothing to refresh".
			expect(store.isLoaded()).toBe(true);
		});

		it('reports itself loaded when only a detail route populated it', async () => {
			// `/space/:id/plugin` populates a single entity through get(), never touching fetch()
			// and so never setting firstLoad. Gating on that flag alone skipped the space on screen.
			backendClient.GET.mockResolvedValueOnce({ data: { data: spaceResponse(keptId, 'Kept') }, error: undefined });

			await store.get({ id: keptId });

			expect(store.firstLoadFinished()).toBe(false);
			expect(store.isLoaded()).toBe(true);
		});

		it('re-reads the collection when refreshed', async () => {
			backendClient.GET.mockResolvedValueOnce({ data: { data: [spaceResponse(keptId, 'Kept')] }, error: undefined });

			await store.refresh();

			expect(store.findById(keptId)).not.toBeNull();
		});
	});

	it('drops spaces the server no longer returns', async () => {
		backendClient.GET.mockResolvedValueOnce({
			data: { data: [spaceResponse(keptId, 'Kept'), spaceResponse(removedId, 'Removed')] },
			error: undefined,
		});

		await store.fetch();

		expect(store.findAll()).toHaveLength(2);

		// A space deleted while the browser was asleep: its event was missed, so the reconnect
		// re-fetch is the only thing that can retire it.
		backendClient.GET.mockResolvedValueOnce({
			data: { data: [spaceResponse(keptId, 'Kept')] },
			error: undefined,
		});

		await store.fetch();

		expect(store.findAll()).toHaveLength(1);
		expect(store.findById(removedId)).toBeNull();
		expect(store.findById(keptId)).not.toBeNull();
	});

	describe('bulkRemove', () => {
		const seed = async (): Promise<void> => {
			backendClient.GET.mockResolvedValueOnce({
				data: { data: [spaceResponse(keptId, 'Kept'), spaceResponse(removedId, 'Removed')] },
				error: undefined,
			});

			await store.fetch();
		};

		it('sends the whole selection in one request and drops what the backend removed', async () => {
			await seed();

			backendClient.POST.mockResolvedValueOnce({ data: { data: { succeeded: [removedId], failed: [] } }, error: undefined });

			const result = await store.bulkRemove({ ids: [keptId, removedId] });

			expect(backendClient.POST).toHaveBeenCalledTimes(1);
			expect(backendClient.POST).toHaveBeenCalledWith('/modules/spaces/spaces/bulk-remove', {
				body: { data: { ids: [keptId, removedId] } },
			});
			expect(result).toEqual({ succeeded: [removedId], failed: [] });
			expect(store.findById(removedId)).toBeNull();
			expect(store.findById(keptId)).not.toBeNull();
		});

		it('drops drafts locally and never asks the backend about them', async () => {
			await seed();

			store.set({ id: removedId, data: { draft: true } });

			const result = await store.bulkRemove({ ids: [removedId] });

			expect(backendClient.POST).not.toHaveBeenCalled();
			expect(result).toEqual({ succeeded: [removedId], failed: [] });
			expect(store.findById(removedId)).toBeNull();
		});

		it('reports a rejected request as a failure and keeps the selection', async () => {
			await seed();

			backendClient.POST.mockResolvedValueOnce({ data: undefined, error: { message: 'Nope' } });

			await expect(store.bulkRemove({ ids: [keptId] })).rejects.toThrow('Failed to remove spaces');

			expect(store.findById(keptId)).not.toBeNull();
			expect(store.semaphore.deleting).not.toContain(keptId);
		});
	});


	// The semaphore used to be `{ ...defaultSemaphore }` - a spread that copies the
	// object but not its arrays - so a push leaked onto the module-level constant
	// and the next pinia started with it. This pins that a fresh store starts clean
	// even after a previous one has pushed.
	describe('semaphore isolation', () => {
		it('does not carry semaphore state into the next store instance', () => {
			// Reach the semaphore the way an in-flight action does, then leave it as a
			// completed action would.
			store.semaphore.deleting.push(removedId);
			store.semaphore.deleting = store.semaphore.deleting.filter((id) => id !== removedId);

			store.semaphore.creating.push(keptId);

			setActivePinia(createPinia());

			const fresh = useSpacesStore();

			expect(fresh.semaphore.deleting).toEqual([]);
			expect(fresh.semaphore.creating).toEqual([]);
			expect(fresh.semaphore.updating).toEqual([]);
			expect(fresh.semaphore.fetching.item).toEqual([]);
		});
	});

});
