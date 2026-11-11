import { type ComputedRef, computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { AutomationMode } from '../automations.constants';

import type { IModeOption } from './types';

/**
 * The run modes an automation can have, with the text explaining each.
 */
export const useAutomationModes = (): { modeOptions: ComputedRef<IModeOption[]> } => {
	const { t } = useI18n();

	const modeOptions = computed<IModeOption[]>((): IModeOption[] =>
		Object.values(AutomationMode).map((mode) => ({
			value: mode,
			label: t(`automations.modes.${mode}.title`),
			description: t(`automations.modes.${mode}.description`),
		}))
	);

	return { modeOptions };
};
