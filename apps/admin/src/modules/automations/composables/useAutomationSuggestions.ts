import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { z } from 'zod';

import { MODULES_PREFIX } from '../../../app.constants';
import { logger, useBackend, useFlashMessage } from '../../../common';
import { BuddySuggestionFeedback, BuddySuggestionType } from '../../../openapi.constants';
import { BUDDY_MODULE_PREFIX } from '../../buddy/buddy.constants';
import type { IAutomationDraft } from '../automations.drafts';
import { AutomationTemplateDraftSchema } from '../store/templates.store.schemas';

import type { IAutomationSuggestion, IUseAutomationSuggestions } from './types';

// A suggestion as the buddy module lists it; only the automation ones are read, and only their draft is needed
const SuggestionResponseSchema = z.object({
	id: z.string().nonempty(),
	type: z.string(),
	title: z.string(),
	reason: z.string(),
	space_id: z.string().nullable().optional(),
	metadata: z
		.object({
			draft: z.unknown(),
		})
		.passthrough()
		.nullable()
		.optional(),
});

// Shared by the list, which offers the suggestions, and the add form, which tells the backend one was taken up
const suggestions = ref<IAutomationSuggestion[]>([]);
const loading = ref<boolean>(false);
const answering = ref<IAutomationSuggestion['id'][]>([]);
// Answered while this page is open: a list read before the answer arrived must not bring them back
const answered = new Set<IAutomationSuggestion['id']>();

let pendingFetch: Promise<void> | null = null;

const parseSuggestion = (item: unknown): IAutomationSuggestion | null => {
	const parsed = SuggestionResponseSchema.safeParse(item);

	if (!parsed.success || parsed.data.type !== BuddySuggestionType.pattern_automation_create) {
		return null;
	}

	const draft = AutomationTemplateDraftSchema.safeParse(parsed.data.metadata?.draft);

	if (!draft.success) {
		logger.error('Schema validation failed with:', draft.error);

		return null;
	}

	return {
		id: parsed.data.id,
		title: parsed.data.title,
		reason: parsed.data.reason,
		spaceId: parsed.data.space_id ?? null,
		draft: draft.data,
	};
};

/**
 * The automations Buddy suggests for routines it noticed. Each one carries the draft of the automation - a time
 * trigger and the device values the routine sets - which opens in the editor the way a template draft does. Nothing
 * is created until the administrator saves it, and the suggestion is marked applied only once its flow is first saved
 * in the editor. Dismissing one tells Buddy not to offer it again.
 *
 * Read from the buddy module, which may be disabled or not answer: there are then simply no suggestions.
 */
export const useAutomationSuggestions = (): IUseAutomationSuggestions => {
	const backend = useBackend();

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const fetchSuggestions = (): Promise<void> => {
		if (pendingFetch !== null) {
			return pendingFetch;
		}

		pendingFetch = (async (): Promise<void> => {
			loading.value = true;

			try {
				const { data: responseData } = await backend.client.GET(`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/suggestions`);

				const items: unknown[] = Array.isArray(responseData?.data) ? responseData.data : [];

				suggestions.value = items.map(parseSuggestion).filter((item): item is IAutomationSuggestion => item !== null && !answered.has(item.id));
			} catch {
				// Suggestions are an extra: without the buddy module the list is just not offered any
				suggestions.value = [];
			} finally {
				loading.value = false;
			}
		})().finally((): void => {
			pendingFetch = null;
		});

		return pendingFetch;
	};

	const sendFeedback = async (id: IAutomationSuggestion['id'], feedback: BuddySuggestionFeedback): Promise<boolean> => {
		answering.value = [...answering.value, id];

		try {
			const { error } = await backend.client.POST(`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/suggestions/{id}/feedback`, {
				params: { path: { id } },
				body: { data: { feedback } },
			});

			if (error) {
				return false;
			}

			answered.add(id);

			suggestions.value = suggestions.value.filter((suggestion) => suggestion.id !== id);

			return true;
		} catch {
			return false;
		} finally {
			answering.value = answering.value.filter((item) => item !== id);
		}
	};

	const dismiss = async (id: IAutomationSuggestion['id']): Promise<void> => {
		if (!(await sendFeedback(id, BuddySuggestionFeedback.dismissed))) {
			flashMessage.error(t('automations.suggestions.messages.notDismissed'));
		}
	};

	// The automation is saved by then; a suggestion that could not be marked only stays offered until it expires
	const markApplied = async (id: IAutomationSuggestion['id']): Promise<void> => {
		if (!(await sendFeedback(id, BuddySuggestionFeedback.applied))) {
			logger.warn(`The automation suggestion ${id} could not be marked as applied.`);
		}
	};

	const toDraft = (suggestion: IAutomationSuggestion): IAutomationDraft => ({
		name: suggestion.draft.name,
		mode: suggestion.draft.mode,
		graph: suggestion.draft.graph,
		spaceId: suggestion.spaceId,
		suggestionId: suggestion.id,
	});

	return {
		suggestions: computed<IAutomationSuggestion[]>((): IAutomationSuggestion[] => suggestions.value),
		loading: computed<boolean>((): boolean => loading.value),
		answering: computed<IAutomationSuggestion['id'][]>((): IAutomationSuggestion['id'][] => answering.value),
		fetchSuggestions,
		dismiss,
		markApplied,
		toDraft,
	};
};
