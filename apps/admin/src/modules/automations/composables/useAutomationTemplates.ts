import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectStoresManager } from '../../../common';
import { AutomationTemplateParameterType } from '../automations.constants';
import { automationTemplatesStoreKey } from '../store/keys';
import type { IAutomationTemplate, IAutomationTemplateParameter } from '../store/templates.store.types';

import type { IUseAutomationTemplates } from './types';

/**
 * The templates a new automation can be created from, and the words they are shown with. Names, descriptions and
 * questions come translated for the templates the admin knows and in the backend's English for the rest, such as
 * the templates a user added to the configuration directory.
 */
export const useAutomationTemplates = (): IUseAutomationTemplates => {
	const storesManager = injectStoresManager();

	const templatesStore = storesManager.getStore(automationTemplatesStoreKey);

	const { t, te } = useI18n();

	const loadFailed = ref<boolean>(false);

	const text = (key: string, fallback: string): string => (te(key) ? t(key) : fallback);

	const itemKey = (template: Pick<IAutomationTemplate, 'id'>): string => `automations.templates.items.${template.id}`;

	const templateName = (template: IAutomationTemplate): string => text(`${itemKey(template)}.name`, template.name);

	const templateDescription = (template: IAutomationTemplate): string => text(`${itemKey(template)}.description`, template.description);

	const parameterKey = (template: IAutomationTemplate, parameter: IAutomationTemplateParameter): string =>
		`${itemKey(template)}.parameters.${parameter.id}`;

	const parameterLabel = (template: IAutomationTemplate, parameter: IAutomationTemplateParameter): string =>
		text(`${parameterKey(template, parameter)}.label`, parameter.label);

	const parameterDescription = (template: IAutomationTemplate, parameter: IAutomationTemplateParameter): string | null => {
		const key = `${parameterKey(template, parameter)}.description`;

		return te(key) ? t(key) : parameter.description;
	};

	// A text default is a text a person reads, such as the title of a notification, so it is translated too
	const parameterDefault = (template: IAutomationTemplate, parameter: IAutomationTemplateParameter): number | string | null => {
		if (parameter.type === AutomationTemplateParameterType.text && typeof parameter.default === 'string') {
			return text(`${parameterKey(template, parameter)}.default`, parameter.default);
		}

		return parameter.default;
	};

	const templates = computed<IAutomationTemplate[]>((): IAutomationTemplate[] =>
		[...templatesStore.findAll()].sort((a, b) => templateName(a).localeCompare(templateName(b)))
	);

	const loading = computed<boolean>((): boolean => templatesStore.fetching());

	const loaded = computed<boolean>((): boolean => templatesStore.firstLoadFinished());

	const fetchTemplates = async (): Promise<void> => {
		loadFailed.value = false;

		try {
			await templatesStore.fetch();
		} catch {
			loadFailed.value = true;
		}
	};

	return {
		templates,
		loading,
		loaded,
		loadFailed,
		fetchTemplates,
		templateName,
		templateDescription,
		parameterLabel,
		parameterDescription,
		parameterDefault,
	};
};
