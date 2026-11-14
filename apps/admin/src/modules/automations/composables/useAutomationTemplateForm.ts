import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { AutomationTemplateParameterType } from '../automations.constants';
import type { IAutomationDraft } from '../automations.drafts';
import { AutomationsGraphInvalidException, AutomationsTemplateParametersException } from '../automations.exceptions';
import { automationTemplatesStoreKey } from '../store/keys';
import type { IAutomationTemplate, IAutomationTemplateIssue, IAutomationTemplateParameter } from '../store/templates.store.types';

import type { AutomationTemplatePropertyAnswer, IUseAutomationTemplateForm, IUseAutomationTemplateFormProps } from './types';
import { useAutomationTemplates } from './useAutomationTemplates';

const PROPERTY_FIELDS = ['device_id', 'channel_id', 'property_id'] as const;

const isFilled = (parameter: IAutomationTemplateParameter, value: unknown): boolean => {
	switch (parameter.type) {
		case AutomationTemplateParameterType.property:
			return (
				typeof value === 'object' &&
				value !== null &&
				PROPERTY_FIELDS.every(
					(field) => typeof (value as Record<string, unknown>)[field] === 'string' && (value as Record<string, unknown>)[field] !== ''
				)
			);
		case AutomationTemplateParameterType.text:
			return typeof value === 'string' && value.trim() !== '';
		default:
			return typeof value === 'number' && Number.isFinite(value);
	}
};

/**
 * The answers to the questions of one template, and the draft of a new automation they generate. The backend
 * checks the answers and the graph they lead to; what it refuses is shown at the question it is about. Nothing
 * is stored: the draft is what the new automation starts from.
 */
export const useAutomationTemplateForm = ({ template }: IUseAutomationTemplateFormProps): IUseAutomationTemplateForm => {
	const storesManager = injectStoresManager();

	const templatesStore = storesManager.getStore(automationTemplatesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const { templateName, parameterDefault } = useAutomationTemplates();

	const answers = ref<Record<string, unknown>>({});

	const issues = ref<IAutomationTemplateIssue[]>([]);

	const submitting = ref<boolean>(false);

	const reset = (next: IAutomationTemplate | null): void => {
		issues.value = [];

		const initial: Record<string, unknown> = {};

		for (const parameter of next?.parameters ?? []) {
			if (parameter.type === AutomationTemplateParameterType.property) {
				initial[parameter.id] = { device_id: null, channel_id: null, property_id: null };
			} else {
				initial[parameter.id] = parameterDefault(next as IAutomationTemplate, parameter) ?? undefined;
			}
		}

		answers.value = initial;
	};

	watch(
		(): IAutomationTemplate | null => template.value,
		(next: IAutomationTemplate | null): void => reset(next),
		{ immediate: true }
	);

	// What the backend said about a question no longer holds once it is answered again
	const forget = (parameterId: IAutomationTemplateParameter['id']): void => {
		const field = `parameters.${parameterId}`;

		issues.value = issues.value.filter((issue) => issue.field !== field && !issue.field.startsWith(`${field}.`));
	};

	const setAnswer = (parameterId: IAutomationTemplateParameter['id'], value: unknown): void => {
		answers.value = { ...answers.value, [parameterId]: value };

		forget(parameterId);
	};

	const setPropertyAnswer = (parameterId: IAutomationTemplateParameter['id'], patch: Partial<AutomationTemplatePropertyAnswer>): void => {
		const current = (answers.value[parameterId] ?? {}) as AutomationTemplatePropertyAnswer;

		const next: AutomationTemplatePropertyAnswer = { ...current };

		for (const field of PROPERTY_FIELDS) {
			if (field in patch) {
				next[field] = patch[field] ?? null;
			}
		}

		setAnswer(parameterId, next);
	};

	const propertyAnswer = (parameterId: IAutomationTemplateParameter['id']): AutomationTemplatePropertyAnswer => {
		const value = (answers.value[parameterId] ?? {}) as Partial<AutomationTemplatePropertyAnswer>;

		return { device_id: value.device_id ?? null, channel_id: value.channel_id ?? null, property_id: value.property_id ?? null };
	};

	const errorsAt = (parameterId: IAutomationTemplateParameter['id']): string[] => {
		const field = `parameters.${parameterId}`;

		return issues.value.filter((issue) => issue.field === field || issue.field.startsWith(`${field}.`)).map((issue) => issue.reason);
	};

	// Questions the backend refused that the form shows nowhere else, such as one the template does not ask
	const otherErrors = computed<string[]>((): string[] => {
		const asked = template.value?.parameters.map((parameter) => `parameters.${parameter.id}`) ?? [];

		return issues.value
			.filter((issue) => !asked.some((field) => issue.field === field || issue.field.startsWith(`${field}.`)))
			.map((issue) => issue.reason);
	});

	const complete = computed<boolean>((): boolean => {
		const current = template.value;

		return current !== null && current.parameters.every((parameter) => isFilled(parameter, answers.value[parameter.id]));
	});

	const submit = async (): Promise<IAutomationDraft | null> => {
		const current = template.value;

		if (current === null || submitting.value) {
			return null;
		}

		submitting.value = true;
		issues.value = [];

		try {
			const parameters: Record<string, unknown> = {};

			for (const parameter of current.parameters) {
				const value = answers.value[parameter.id];

				if (value !== undefined && value !== null) {
					parameters[parameter.id] = value;
				}
			}

			const draft = await templatesStore.generate({ id: current.id, parameters });

			// The name the form starts with is the one the template is shown with
			return { name: templateName(current), mode: draft.mode, graph: draft.graph };
		} catch (error: unknown) {
			if (error instanceof AutomationsTemplateParametersException) {
				issues.value = error.issues;

				flashMessage.error(t('automations.templates.messages.invalidAnswers'));
			} else if (error instanceof AutomationsGraphInvalidException) {
				flashMessage.error(t('automations.templates.messages.invalidGraph'));
			} else {
				flashMessage.error(t('automations.templates.messages.notGenerated'));
			}

			return null;
		} finally {
			submitting.value = false;
		}
	};

	return {
		answers,
		issues,
		submitting,
		complete,
		otherErrors,
		setAnswer,
		setPropertyAnswer,
		propertyAnswer,
		errorsAt,
		submit,
		reset: (): void => reset(template.value),
	};
};
