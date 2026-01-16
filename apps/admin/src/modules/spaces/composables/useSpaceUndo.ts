import { ref, computed, type ComputedRef, type Ref, watch } from 'vue';

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
	isLoading: Ref<boolean>;
	isExecuting: Ref<boolean>;
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
	const isLoading = ref(false);
	const isExecuting = ref(false);
	const error = ref<string | null>(null);

	const undoState = computed(() => undoStateData.value);
	const canUndo = computed(() => undoStateData.value?.canUndo ?? false);
	const isLightingUndo = computed(() => undoStateData.value?.intentCategory === 'lighting');
	const isClimateUndo = computed(() => undoStateData.value?.intentCategory === 'climate');

	const remainingSeconds = computed(() => {
		const state = undoStateData.value;
		if (!state?.expiresInSeconds || !state?.capturedAt) return null;

		const elapsed = Math.floor((Date.now() - state.capturedAt.getTime()) / 1000);
		const remaining = state.expiresInSeconds - elapsed;
		return remaining > 0 ? remaining : 0;
	});

	const fetchUndoState = async (): Promise<IUndoState | null> => {
		const currentSpaceId = spaceId.value;
		if (!currentSpaceId) return null;

		isLoading.value = true;
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

			return undoStateData.value;
		} catch (e) {
			// Only update error if spaceId hasn't changed during the fetch
			if (spaceId.value === currentSpaceId) {
				error.value = e instanceof Error ? e.message : 'Unknown error';
			}
			return null;
		} finally {
			// Only update loading if spaceId hasn't changed during the fetch
			if (spaceId.value === currentSpaceId) {
				isLoading.value = false;
			}
		}
	};

	const executeUndo = async (): Promise<IUndoResult | null> => {
		if (!spaceId.value) return null;

		isExecuting.value = true;
		error.value = null;

		try {
			const { data, error: apiError } = await backend.client.POST(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/intents/undo`,
				{
					params: { path: { id: spaceId.value } },
				}
			);

			if (apiError || !data) {
				throw new Error('Failed to execute undo');
			}

			// Clear undo state after execution
			undoStateData.value = null;

			return {
				success: data.data.success ?? false,
				restoredDevices: data.data.restored_devices ?? 0,
				failedDevices: data.data.failed_devices ?? 0,
				message: data.data.message ?? '',
			};
		} catch (e) {
			error.value = e instanceof Error ? e.message : 'Unknown error';
			return null;
		} finally {
			isExecuting.value = false;
		}
	};

	const invalidateUndoState = () => {
		undoStateData.value = null;
	};

	// Clear undo state when space ID changes
	watch(spaceId, () => {
		undoStateData.value = null;
		error.value = null;
		isLoading.value = false;
		isExecuting.value = false;
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
