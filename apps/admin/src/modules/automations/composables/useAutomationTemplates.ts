import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectStoresManager } from '../../../common';
import { AutomationTemplateParameterType, AutomationTemplateSource } from '../automations.constants';
import { automationTemplatesStoreKey } from '../store/keys';
import type { IAutomationTemplate, IAutomationTemplateParameter } from '../store/templates.store.types';

import type { IUseAutomationTemplates } from './types';

/**
 * The templates a new automation can be created from, and the words they are shown with. Names, descriptions and
 * questions come translated for the built-in templates the admin knows and in the backend's English for the rest:
 * the templates a user added to the configuration directory, also one that replaces a built-in template by its
 * id - its texts and defaults can say something else than those of the built-in one.
 */
export const useAutomationTemplates = (): IUseAutomationTemplates => {
	const storesManager = injectStoresManager();

	const templatesStore = storesManager.getStore(automationTemplatesStoreKey);

	const { t, te } = useI18n();

	const loadFailed = ref<boolean>(false);

	const translated = (template: IAutomationTemplate, key: string): string | null =>
		template.source === AutomationTemplateSource.builtin && te(key) ? t(key) : null;

	const text = (template: IAutomationTemplate, key: string, fallback: string): string => translated(template, key) ?? fallback;

	const itemKey = (template: Pick<IAutomationTemplate, 'id'>): string => `automations.templates.items.${template.id}`;

	const templateName = (template: IAutomationTemplate): string => text(template, `${itemKey(template)}.name`, template.name);

	const templateDescription = (template: IAutomationTemplate): string => text(template, `${itemKey(template)}.description`, template.description);

	const parameterKey = (template: IAutomationTemplate, parameter: IAutomationTemplateParameter): string =>
		`${itemKey(template)}.parameters.${parameter.id}`;

	const parameterLabel = (template: IAutomationTemplate, parameter: IAutomationTemplateParameter): string =>
		text(template, `${parameterKey(template, parameter)}.label`, parameter.label);

	const parameterDescription = (template: IAutomationTemplate, parameter: IAutomationTemplateParameter): string | null => {
		return translated(template, `${parameterKey(template, parameter)}.description`) ?? parameter.description;
	};

	// A text default is a text a person reads, such as the title of a notification, so it is translated too
	const parameterDefault = (template: IAutomationTemplate, parameter: IAutomationTemplateParameter): number | string | null => {
		if (parameter.type === AutomationTemplateParameterType.text && typeof parameter.default === 'string') {
			return text(template, `${parameterKey(template, parameter)}.default`, parameter.default);
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
