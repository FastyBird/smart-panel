import { ref, computed, type ComputedRef, type Ref, watch } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SPACES_MODULE_PREFIX } from '../spaces.constants';
import type { ISpace } from '../store';

import type { components } from '../../../openapi';

type CoversStateData = components['schemas']['SpacesModuleDataCoversState'];

/**
 * Covers state for a space, including position and role breakdown.
 */
export interface ICoversState {
	/** Whether the space has any window coverings */
	hasCovers: boolean;
	/** Average position across all covers (0-100, 0=closed, 100=open) */
	averagePosition: number | null;
	/** Whether any covers are open (position > 0) */
	anyOpen: boolean;
	/** Whether all covers are closed (position = 0) */
	allClosed: boolean;
	/** Total number of window covering devices in the space */
	devicesCount: number;
	/** Count of covers by role */
	coversByRole: Record<string, number>;
}

/**
 * Return type for the useSpaceCoversState composable.
 */
export interface IUseSpaceCoversState {
	/** Current covers state, or null if not yet fetched */
	coversState: ComputedRef<ICoversState | null>;
	/** Whether a fetch request is in progress */
	isLoading: ComputedRef<boolean>;
	/** Error message from the last failed request */
	error: Ref<string | null>;
	/** Fetch covers state from the API */
	fetchCoversState: () => Promise<ICoversState | null>;
	/** Whether the space has any covers */
	hasCovers: ComputedRef<boolean>;
	/** Whether any covers are open */
	anyOpen: ComputedRef<boolean>;
	/** Whether all covers are closed */
	allClosed: ComputedRef<boolean>;
}

const transformCoversState = (data: CoversStateData): ICoversState => {
	return {
		hasCovers: data.has_covers ?? false,
		averagePosition: data.average_position ?? null,
		anyOpen: data.any_open ?? false,
		allClosed: data.all_closed ?? true,
		devicesCount: data.devices_count ?? 0,
		coversByRole: data.covers_by_role ?? {},
	};
};

/**
 * Composable for fetching and managing covers state for a space.
 *
 * Provides reactive access to covers state including position data
 * and per-role breakdowns. State is automatically cleared when
 * the space ID changes and stale requests are properly handled.
 *
 * @param spaceId - Reactive reference to the space ID
 * @returns Covers state, loading/error states, and convenience computed properties
 *
 * @example
 * ```ts
 * const spaceId = ref('space-123');
 * const { coversState, isLoading, fetchCoversState, allClosed } = useSpaceCoversState(spaceId);
 *
 * await fetchCoversState();
 * if (allClosed.value) {
 *   console.log('All covers are closed');
 * }
 * ```
 */
export const useSpaceCoversState = (spaceId: Ref<ISpace['id'] | undefined>): IUseSpaceCoversState => {
	const backend = useBackend();

	const coversStateData = ref<ICoversState | null>(null);
	// Use counter to handle concurrent/stale requests correctly
	const loadingCount = ref(0);
	const isLoading = computed(() => loadingCount.value > 0);
	const error = ref<string | null>(null);
	// Generation counter to distinguish requests across space navigation cycles
	let spaceGeneration = 0;

	const coversState = computed(() => coversStateData.value);

	const hasCovers = computed(() => coversStateData.value?.hasCovers ?? false);
	const anyOpen = computed(() => coversStateData.value?.anyOpen ?? false);
	const allClosed = computed(() => coversStateData.value?.allClosed ?? true);

	const fetchCoversState = async (): Promise<ICoversState | null> => {
		const currentSpaceId = spaceId.value;
		if (!currentSpaceId) return null;

		// Capture generation to detect stale requests even when returning to same space
		const requestGeneration = spaceGeneration;
		loadingCount.value++;
		error.value = null;

		try {
			const { data, error: apiError } = await backend.client.GET(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/covers`,
				{
					params: { path: { id: currentSpaceId } },
				}
			);

			if (apiError || !data) {
				throw new Error('Failed to fetch covers state');
			}

			// Only update state if this request is still current (same space and generation)
			if (spaceId.value !== currentSpaceId || spaceGeneration !== requestGeneration) {
				return null;
			}

			coversStateData.value = transformCoversState(data.data);
			return coversStateData.value;
		} catch (e) {
			// Only update error if this request is still current
			if (spaceId.value === currentSpaceId && spaceGeneration === requestGeneration) {
				error.value = e instanceof Error ? e.message : 'Unknown error';
			}
			return null;
		} finally {
			// Only update loading if this request is still current
			// Guard against going negative if watch handler reset the counter while request was in flight
			if (spaceId.value === currentSpaceId && spaceGeneration === requestGeneration && loadingCount.value > 0) {
				loadingCount.value--;
			}
		}
	};

	// Clear state when space ID changes
	watch(spaceId, () => {
		// Increment generation to invalidate any in-flight requests
		spaceGeneration++;
		coversStateData.value = null;
		error.value = null;
		loadingCount.value = 0;
	});

	return {
		coversState,
		isLoading,
		error,
		fetchCoversState,
		hasCovers,
		anyOpen,
		allClosed,
	};
};
