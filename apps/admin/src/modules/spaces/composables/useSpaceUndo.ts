import { ref, computed, type ComputedRef, type Ref, watch, onUnmounted } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SPACES_MODULE_PREFIX } from '../spaces.constants';
import type { ISpace } from '../store';

// ============================================
// UNDO TYPES
// ============================================

export type IntentCategory = 'lighting' | 'climate';

export interface IUndoState {
	canUndo: boolean;
	actionDescription: string | null;
	intentCategory: IntentCategory | null;
	capturedAt: Date | null;
	expiresInSeconds: number | null;
}

export interface IUndoResult {
	success: boolean;
	restoredDevices: number;
	failedDevices: number;
	message: string;
}

export interface IUseSpaceUndo {
	undoState: ComputedRef<IUndoState | null>;
	isLoading: ComputedRef<boolean>;
	isExecuting: ComputedRef<boolean>;
	error: Ref<string | null>;
	canUndo: ComputedRef<boolean>;
	isLightingUndo: ComputedRef<boolean>;
	isClimateUndo: ComputedRef<boolean>;
	remainingSeconds: ComputedRef<number | null>;
	fetchUndoState: () => Promise<IUndoState | null>;
	executeUndo: () => Promise<IUndoResult | null>;
	invalidateUndoState: () => void;
}

export const useSpaceUndo = (spaceId: Ref<ISpace['id'] | undefined>): IUseSpaceUndo => {
	const backend = useBackend();

	const undoStateData = ref<IUndoState | null>(null);
	// Use counters to handle concurrent/stale requests correctly
	const loadingCount = ref(0);
	const executingCount = ref(0);
	const isLoading = computed(() => loadingCount.value > 0);
	const isExecuting = computed(() => executingCount.value > 0);
	const error = ref<string | null>(null);

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
	const canUndo = computed(() => undoStateData.value?.canUndo ?? false);
	const isLightingUndo = computed(() => undoStateData.value?.intentCategory === 'lighting');
	const isClimateUndo = computed(() => undoStateData.value?.intentCategory === 'climate');

	const remainingSeconds = computed(() => {
		const state = undoStateData.value;
		if (!state || state.expiresInSeconds == null || state.capturedAt == null) return null;

		const elapsed = Math.floor((now.value - state.capturedAt.getTime()) / 1000);
		const remaining = state.expiresInSeconds - elapsed;

		return remaining > 0 ? remaining : 0;
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

		loadingCount.value++;
		error.value = null;

		try {
			const { data, error: apiError } = await backend.client.GET(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/undo`,
				{
					params: { path: { id: currentSpaceId } },
				}
			);

			if (apiError || !data) {
				throw new Error('Failed to fetch undo state');
			}

			// Only update state if spaceId hasn't changed during the fetch
			if (spaceId.value !== currentSpaceId) {
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
			// Only update error if spaceId hasn't changed during the fetch
			if (spaceId.value === currentSpaceId) {
				error.value = e instanceof Error ? e.message : 'Unknown error';
			}
			return null;
		} finally {
			// Only update loading if spaceId hasn't changed during the fetch
			// Guard against going negative if watch handler reset the counter while request was in flight
			if (spaceId.value === currentSpaceId && loadingCount.value > 0) {
				loadingCount.value--;
			}
		}
	};

	const executeUndo = async (): Promise<IUndoResult | null> => {
		const currentSpaceId = spaceId.value;
		if (!currentSpaceId) return null;

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

			// Only update state if spaceId hasn't changed during the request
			if (spaceId.value !== currentSpaceId) {
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
			// Only update error if spaceId hasn't changed during the request
			if (spaceId.value === currentSpaceId) {
				error.value = e instanceof Error ? e.message : 'Unknown error';
			}
			return null;
		} finally {
			// Only update loading if spaceId hasn't changed during the request
			// Guard against going negative if watch handler reset the counter while request was in flight
			if (spaceId.value === currentSpaceId && executingCount.value > 0) {
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
