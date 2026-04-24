import { ref, computed, type ComputedRef, type Ref, watch } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SPACES_MODULE_PREFIX } from '../../../modules/spaces/spaces.constants';
import type { ISpace } from '../../../modules/spaces/store';

import type { SpacesModuleSuggestionFeedbackSchema } from '../../../openapi.constants';
import { SpacesModuleSuggestionType } from '../../../openapi.constants';



// ============================================
// SUGGESTION TYPES
// ============================================

/** Type of suggestion provided by the backend */
export type SuggestionType = `${SpacesModuleSuggestionType}`;
/** User feedback on a suggestion */
export type SuggestionFeedback = `${SpacesModuleSuggestionFeedbackSchema['feedback']}`;

/**
 * A smart suggestion for the space based on context (time, occupancy, etc.).
 */
export interface ISuggestion {
	/** Type of suggestion (e.g., lighting_relax) */
	type: SuggestionType;
	/** Human-readable suggestion title */
	title: string;
	/** Explanation of why this suggestion is made */
	reason: string | null;
	/** The intent type this suggestion would execute */
	intentType: string;
	/** The intent mode parameter, if applicable (e.g., lighting mode) */
	intentMode: string | null;
}

/**
 * Result of submitting feedback on a suggestion.
 */
export interface ISuggestionFeedbackResult {
	/** Whether the feedback was submitted successfully */
	success: boolean;
	/** Whether the suggested intent was executed (when applied) */
	intentExecuted: boolean;
}

/**
 * Return type for the useSpaceSuggestion composable.
 */
export interface IUseSpaceSuggestion {
	/** Current suggestion, or null if none available */
	suggestion: ComputedRef<ISuggestion | null>;
	/** Whether a fetch request is in progress */
	isLoading: ComputedRef<boolean>;
	/** Whether a feedback submission is in progress */
	isSubmitting: ComputedRef<boolean>;
	/** Error message from the last failed request */
	error: Ref<string | null>;
	/** Whether a suggestion is available */
	hasSuggestion: ComputedRef<boolean>;
	/** Fetch suggestion from the API */
	fetchSuggestion: () => Promise<ISuggestion | null>;
	/** Apply the suggestion (executes the suggested intent) */
	applySuggestion: () => Promise<ISuggestionFeedbackResult | null>;
	/** Dismiss the suggestion without applying */
	dismissSuggestion: () => Promise<ISuggestionFeedbackResult | null>;
	/** Clear the cached suggestion */
	clearSuggestion: () => void;
}

/**
 * Composable for fetching and managing smart suggestions for a space.
 *
 * The backend analyzes context (time of day, occupancy, etc.) to provide
 * intelligent suggestions like switching lighting modes. Users can apply
 * or dismiss suggestions, and their feedback helps improve future suggestions.
 *
 * @param spaceId - Reactive reference to the space ID
 * @returns Suggestion data, loading states, and feedback methods
 *
 * @example
 * ```ts
 * const spaceId = ref('space-123');
 * const { suggestion, hasSuggestion, applySuggestion, dismissSuggestion } = useSpaceSuggestion(spaceId);
 *
 * await fetchSuggestion();
 *
 * if (hasSuggestion.value) {
 *   console.log(`Suggestion: ${suggestion.value?.title}`);
 *   // User accepts suggestion
 *   await applySuggestion();
 * }
 * ```
 */
export const useSpaceSuggestion = (spaceId: Ref<ISpace['id'] | undefined>): IUseSpaceSuggestion => {
	const backend = useBackend();

	const suggestionData = ref<ISuggestion | null>(null);
	// Use counters to handle concurrent/stale requests correctly
	const loadingCount = ref(0);
	const submittingCount = ref(0);
	const isLoading = computed(() => loadingCount.value > 0);
	const isSubmitting = computed(() => submittingCount.value > 0);
	const error = ref<string | null>(null);
	// Generation counter to distinguish requests across space navigation cycles
	let spaceGeneration = 0;

	const suggestion = computed(() => suggestionData.value);
	const hasSuggestion = computed(() => suggestionData.value !== null);

	const fetchSuggestion = async (): Promise<ISuggestion | null> => {
		const currentSpaceId = spaceId.value;
		if (!currentSpaceId) return null;

		// Capture generation to detect stale requests even when returning to same space
		const requestGeneration = spaceGeneration;
		loadingCount.value++;
		error.value = null;

		try {
			const { data, error: apiError } = await backend.client.GET(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/suggestion`,
				{
					params: { path: { id: currentSpaceId } },
				}
			);

			if (apiError) {
				throw new Error('Failed to fetch suggestion');
			}

			// Only update state if this request is still current (same space and generation)
			if (spaceId.value !== currentSpaceId || spaceGeneration !== requestGeneration) {
				return null;
			}

			if (!data || data.data === null) {
				suggestionData.value = null;
				return null;
			}

			suggestionData.value = {
				type: data.data.type as SuggestionType,
				title: data.data.title ?? '',
				reason: data.data.reason ?? null,
				intentType: data.data.intent_type ?? 'set_mode',
				intentMode: data.data.intent_mode ?? null,
			};

			return suggestionData.value;
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

	const submitFeedback = async (feedback: SuggestionFeedback): Promise<ISuggestionFeedbackResult | null> => {
		const currentSpaceId = spaceId.value;
		if (!currentSpaceId || !suggestionData.value) return null;

		// Capture generation to detect stale requests even when returning to same space
		const requestGeneration = spaceGeneration;
		submittingCount.value++;
		error.value = null;

		try {
			const { data, error: apiError } = await backend.client.POST(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/suggestion/feedback`,
				{
					params: { path: { id: currentSpaceId } },
					body: {
						data: {
							suggestion_type:
								suggestionData.value.type as SpacesModuleSuggestionType,
							feedback: feedback as SpacesModuleSuggestionFeedbackSchema['feedback'],
						},
					},
				}
			);

			if (apiError || !data) {
				throw new Error('Failed to submit suggestion feedback');
			}

			// Only update state if this request is still current (same space and generation)
			if (spaceId.value !== currentSpaceId || spaceGeneration !== requestGeneration) {
				return null;
			}

			// Clear the suggestion after feedback
			suggestionData.value = null;

			return {
				success: data.data.success ?? false,
				intentExecuted: data.data.intent_executed ?? false,
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
			if (spaceId.value === currentSpaceId && spaceGeneration === requestGeneration && submittingCount.value > 0) {
				submittingCount.value--;
			}
		}
	};

	const applySuggestion = () => submitFeedback('applied');
	const dismissSuggestion = () => submitFeedback('dismissed');

	const clearSuggestion = () => {
		suggestionData.value = null;
	};

	// Clear suggestion when space ID changes
	watch(spaceId, () => {
		// Increment generation to invalidate any in-flight requests
		spaceGeneration++;
		suggestionData.value = null;
		error.value = null;
		loadingCount.value = 0;
		submittingCount.value = 0;
	});

	return {
		suggestion,
		isLoading,
		isSubmitting,
		error,
		hasSuggestion,
		fetchSuggestion,
		applySuggestion,
		dismissSuggestion,
		clearSuggestion,
	};
};
