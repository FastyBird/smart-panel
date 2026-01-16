import { ref, computed, type ComputedRef, type Ref, watch, onUnmounted } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SPACES_MODULE_PREFIX } from '../spaces.constants';
import type { ISpace } from '../store';

// ============================================
// UNDO TYPES
// ============================================

/** Category of intent that can be undone */
export type IntentCategory = 'lighting' | 'climate';

/**
 * Current undo state for a space.
 */
export interface IUndoState {
	/** Whether an undo operation is available */
	canUndo: boolean;
	/** Human-readable description of the action that can be undone */
	actionDescription: string | null;
	/** Category of the intent (lighting or climate) */
	intentCategory: IntentCategory | null;
	/** When the state was captured */
	capturedAt: Date | null;
	/** Time window in seconds during which undo is available */
	expiresInSeconds: number | null;
}

/**
 * Result of an undo operation.
 */
export interface IUndoResult {
	/** Whether the undo executed successfully */
	success: boolean;
	/** Number of devices restored to previous state */
	restoredDevices: number;
	/** Number of devices that failed to restore */
	failedDevices: number;
	/** Human-readable result message */
	message: string;
}

/**
 * Return type for the useSpaceUndo composable.
 */
export interface IUseSpaceUndo {
	/** Current undo state, or null if not yet fetched */
	undoState: ComputedRef<IUndoState | null>;
	/** Whether a fetch request is in progress */
	isLoading: ComputedRef<boolean>;
	/** Whether an undo execution is in progress */
	isExecuting: ComputedRef<boolean>;
	/** Error message from the last failed request */
	error: Ref<string | null>;
	/** Whether undo is available and not expired */
	canUndo: ComputedRef<boolean>;
	/** Whether the undoable action is a lighting intent */
	isLightingUndo: ComputedRef<boolean>;
	/** Whether the undoable action is a climate intent */
	isClimateUndo: ComputedRef<boolean>;
	/** Seconds remaining until undo expires, or null if not available */
	remainingSeconds: ComputedRef<number | null>;
	/** Fetch undo state from the API */
	fetchUndoState: () => Promise<IUndoState | null>;
	/** Execute the undo operation */
	executeUndo: () => Promise<IUndoResult | null>;
	/** Clear cached undo state (call after executing a new intent) */
	invalidateUndoState: () => void;
}

/**
 * Composable for managing undo state for space intents.
 *
 * Provides access to the current undo state, including a countdown timer
 * showing remaining time until the undo window expires. The timer updates
 * every second while an undo is available.
 *
 * After executing an intent via `useSpaceIntents`, call `fetchUndoState()`
 * to refresh the undo state and show the undo option to users.
 *
 * @param spaceId - Reactive reference to the space ID
 * @returns Undo state, countdown timer, and undo execution methods
 *
 * @example
 * ```ts
 * const spaceId = ref('space-123');
 * const { canUndo, remainingSeconds, executeUndo, fetchUndoState } = useSpaceUndo(spaceId);
 *
 * // After executing an intent, refresh undo state
 * await fetchUndoState();
 *
 * // Show undo button with countdown
 * if (canUndo.value) {
 *   console.log(`Undo available for ${remainingSeconds.value}s`);
 *   await executeUndo();
 * }
 * ```
 */
export const useSpaceUndo = (spaceId: Ref<ISpace['id'] | undefined>): IUseSpaceUndo => {
	const backend = useBackend();

	const undoStateData = ref<IUndoState | null>(null);
	// Use counters to handle concurrent/stale requests correctly
	const loadingCount = ref(0);
	const executingCount = ref(0);
	const isLoading = computed(() => loadingCount.value > 0);
	const isExecuting = computed(() => executingCount.value > 0);
	const error = ref<string | null>(null);
	// Generation counter to distinguish requests across space navigation cycles
	let spaceGeneration = 0;

	// Reactive timestamp for countdown timer - updates every second
	const now = ref(Date.now());
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let isUnmounted = false;

	const startTimer = () => {
		// Prevent starting timer after component unmount (async operations may complete after unmount)
		if (timerInterval || isUnmounted) return;
		timerInterval = setInterval(() => {
			now.value = Date.now();
		}, 1000);
	};

	const stopTimer = () => {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	};

	const undoState = computed(() => undoStateData.value);
	const isLightingUndo = computed(() => undoStateData.value?.intentCategory === 'lighting');
	const isClimateUndo = computed(() => undoStateData.value?.intentCategory === 'climate');

	const remainingSeconds = computed(() => {
		const state = undoStateData.value;
		if (!state || state.expiresInSeconds == null || state.capturedAt == null) return null;

		const elapsed = Math.floor((now.value - state.capturedAt.getTime()) / 1000);
		const remaining = state.expiresInSeconds - elapsed;

		return remaining > 0 ? remaining : 0;
	});

	// Check if undo is still valid (not expired) - matches Dart isValid getter
	const canUndo = computed(() => {
		const state = undoStateData.value;
		if (!state?.canUndo) return false;
		const remaining = remainingSeconds.value;
		return remaining === null || remaining > 0;
	});

	// Stop timer when countdown reaches zero (side effects belong in watch, not computed)
	watch(remainingSeconds, (value) => {
		if (value === 0) {
			stopTimer();
		}
	});

	const fetchUndoState = async (): Promise<IUndoState | null> => {
		const currentSpaceId = spaceId.value;
		if (!currentSpaceId) return null;

		// Capture generation to detect stale requests even when returning to same space
		const requestGeneration = spaceGeneration;
		loadingCount.value++;
		error.value = null;

		try {
			const { data, error: apiError } = await backend.client.GET(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/undo`,
				{
					params: { path: { id: currentSpaceId } },
				}
			);

			if (apiError) {
				throw new Error('Failed to fetch undo state');
			}

			// Only update state if this request is still current (same space and generation)
			if (spaceId.value !== currentSpaceId || spaceGeneration !== requestGeneration) {
				return null;
			}

			// Handle null response (no undo state available)
			if (!data || data.data === null) {
				undoStateData.value = null;
				stopTimer();
				return null;
			}

			undoStateData.value = {
				canUndo: data.data.can_undo ?? false,
				actionDescription: data.data.action_description ?? null,
				intentCategory: (data.data.intent_category as IntentCategory) ?? null,
				capturedAt: data.data.captured_at ? new Date(data.data.captured_at) : null,
				expiresInSeconds: data.data.expires_in_seconds ?? null,
			};

			// Start countdown timer if undo is available
			if (undoStateData.value.canUndo && undoStateData.value.expiresInSeconds) {
				now.value = Date.now();
				startTimer();
			} else {
				stopTimer();
			}

			return undoStateData.value;
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

	const executeUndo = async (): Promise<IUndoResult | null> => {
		const currentSpaceId = spaceId.value;
		if (!currentSpaceId) return null;

		// Capture generation to detect stale requests even when returning to same space
		const requestGeneration = spaceGeneration;
		executingCount.value++;
		error.value = null;

		try {
			const { data, error: apiError } = await backend.client.POST(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/intents/undo`,
				{
					params: { path: { id: currentSpaceId } },
				}
			);

			if (apiError || !data) {
				throw new Error('Failed to execute undo');
			}

			// Only update state if this request is still current (same space and generation)
			if (spaceId.value !== currentSpaceId || spaceGeneration !== requestGeneration) {
				return null;
			}

			// Clear undo state after execution
			undoStateData.value = null;
			stopTimer();

			return {
				success: data.data.success ?? false,
				restoredDevices: data.data.restored_devices ?? 0,
				failedDevices: data.data.failed_devices ?? 0,
				message: data.data.message ?? '',
			};
		} catch (e) {
			// Only update error if this request is still current
			if (spaceId.value === currentSpaceId && spaceGeneration === requestGeneration) {
				error.value = e instanceof Error ? e.message : 'Unknown error';
			}
			return null;
		} finally {
			// Only update loading if this request is still current
			// Guard against going negative if watch handler reset the counter while request was in flight
			if (spaceId.value === currentSpaceId && spaceGeneration === requestGeneration && executingCount.value > 0) {
				executingCount.value--;
			}
		}
	};

	const invalidateUndoState = () => {
		undoStateData.value = null;
		stopTimer();
	};

	// Clear undo state when space ID changes
	watch(spaceId, () => {
		// Increment generation to invalidate any in-flight requests
		spaceGeneration++;
		undoStateData.value = null;
		error.value = null;
		loadingCount.value = 0;
		executingCount.value = 0;
		stopTimer();
	});

	// Clean up timer on unmount and prevent new timers from being created
	onUnmounted(() => {
		isUnmounted = true;
		stopTimer();
	});

	return {
		undoState,
		isLoading,
		isExecuting,
		error,
		canUndo,
		isLightingUndo,
		isClimateUndo,
		remainingSeconds,
		fetchUndoState,
		executeUndo,
		invalidateUndoState,
	};
};
