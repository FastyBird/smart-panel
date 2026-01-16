import { ref, computed, type ComputedRef, type Ref, watch } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SPACES_MODULE_PREFIX } from '../spaces.constants';
import type { ISpace } from '../store';

import {
	SpacesModuleSuggestionFeedbackSuggestion_type,
	SpacesModuleSuggestionFeedbackFeedback,
} from '../../../openapi';

import type { LightingMode } from './useSpaceIntents';

// ============================================
// SUGGESTION TYPES
// ============================================

export type SuggestionType = `${SpacesModuleSuggestionFeedbackSuggestion_type}`;
export type SuggestionFeedback = `${SpacesModuleSuggestionFeedbackFeedback}`;

export interface ISuggestion {
	type: SuggestionType;
	title: string;
	reason: string | null;
	lightingMode: LightingMode | null;
}

export interface ISuggestionFeedbackResult {
	success: boolean;
	intentExecuted: boolean;
}

export interface IUseSpaceSuggestion {
	suggestion: ComputedRef<ISuggestion | null>;
	isLoading: Ref<boolean>;
	isSubmitting: Ref<boolean>;
	error: Ref<string | null>;
	hasSuggestion: ComputedRef<boolean>;
	fetchSuggestion: () => Promise<ISuggestion | null>;
	applySuggestion: () => Promise<ISuggestionFeedbackResult | null>;
	dismissSuggestion: () => Promise<ISuggestionFeedbackResult | null>;
	clearSuggestion: () => void;
}

export const useSpaceSuggestion = (spaceId: Ref<ISpace['id'] | undefined>): IUseSpaceSuggestion => {
	const backend = useBackend();

	const suggestionData = ref<ISuggestion | null>(null);
	const isLoading = ref(false);
	const isSubmitting = ref(false);
	const error = ref<string | null>(null);

	const suggestion = computed(() => suggestionData.value);
	const hasSuggestion = computed(() => suggestionData.value !== null);

	const fetchSuggestion = async (): Promise<ISuggestion | null> => {
		const currentSpaceId = spaceId.value;
		if (!currentSpaceId) return null;

		isLoading.value = true;
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

			// Only update state if spaceId hasn't changed during the fetch
			if (spaceId.value !== currentSpaceId) {
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
				lightingMode: (data.data.lighting_mode as LightingMode) ?? null,
			};

			return suggestionData.value;
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

	const submitFeedback = async (feedback: SuggestionFeedback): Promise<ISuggestionFeedbackResult | null> => {
		if (!spaceId.value || !suggestionData.value) return null;

		isSubmitting.value = true;
		error.value = null;

		try {
			const { data, error: apiError } = await backend.client.POST(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/suggestion/feedback`,
				{
					params: { path: { id: spaceId.value } },
					body: {
						data: {
							suggestion_type:
								suggestionData.value.type as SpacesModuleSuggestionFeedbackSuggestion_type,
							feedback: feedback as SpacesModuleSuggestionFeedbackFeedback,
						},
					},
				}
			);

			if (apiError || !data) {
				throw new Error('Failed to submit suggestion feedback');
			}

			// Clear the suggestion after feedback
			suggestionData.value = null;

			return {
				success: data.data.success ?? false,
				intentExecuted: data.data.intent_executed ?? false,
			};
		} catch (e) {
			error.value = e instanceof Error ? e.message : 'Unknown error';
			return null;
		} finally {
			isSubmitting.value = false;
		}
	};

	const applySuggestion = () => submitFeedback('applied');
	const dismissSuggestion = () => submitFeedback('dismissed');

	const clearSuggestion = () => {
		suggestionData.value = null;
	};

	// Clear suggestion when space ID changes
	watch(spaceId, () => {
		suggestionData.value = null;
		error.value = null;
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
