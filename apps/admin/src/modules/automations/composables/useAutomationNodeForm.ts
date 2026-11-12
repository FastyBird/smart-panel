import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ZodType } from 'zod';

import { setConfigValue } from '../automations.config-schema';
import type { IAutomationNodeFormProps } from '../components/canvas/automation-node-form.types';
import { AUTOMATION_SAFETY_ISSUE_CODE } from '../nodes/nodes.constants';
import { checkNodeConfig, isValidationKey } from '../nodes/nodes.schemas';
import type { IAutomationGraphIssue } from '../store/automations.store.types';

import type { IUseAutomationNodeForm } from './types';
import { useAutomationNodePresentation } from './useAutomationNodePresentation';

type Emit = (event: 'update:config', config: Record<string, unknown>, field: string) => void;

const isAbout = (issue: IAutomationGraphIssue, path: string): boolean =>
	typeof issue.field === 'string' && (issue.field === path || issue.field.startsWith(`${path}.`));

/**
 * What the form of a built-in card shares: changing the configuration a few fields at a time, and the
 * problems of a field - what the schema of the card finds at once, and what the backend reported on the
 * last save or check. The refusal of an unsafe write and the warnings are kept apart, so a form can show
 * them as what they are rather than as a red field.
 */
export const useAutomationNodeForm = (
	props: Readonly<Required<Pick<IAutomationNodeFormProps, 'config' | 'fieldErrors' | 'issues'>>>,
	emit: Emit,
	schema: ZodType | null
): IUseAutomationNodeForm => {
	const { t } = useI18n();

	const { issueText } = useAutomationNodePresentation();

	const problems = computed<Record<string, string[]>>((): Record<string, string[]> => (schema ? checkNodeConfig(schema, props.config) : {}));

	/**
	 * Sets the fields given and leaves the others; a field set to nothing is left out of the configuration.
	 */
	const update = (patch: Record<string, unknown>, field: string): void => {
		let next = props.config;

		for (const [key, value] of Object.entries(patch)) {
			next = setConfigValue(next, key, value);
		}

		emit('update:config', next, field);
	};

	const errorsAt = (path: string): string[] => {
		const errors = new Set<string>();

		for (const issue of props.issues) {
			if (issue.severity === 'error' && issue.code !== AUTOMATION_SAFETY_ISSUE_CODE && isAbout(issue, path)) {
				errors.add(issueText(issue));
			}
		}

		// A host that hands over only the errors by key, without the issues
		if (props.issues.length === 0 && !path.includes('.')) {
			for (const error of props.fieldErrors[path] ?? []) errors.add(error);
		}

		for (const [problemPath, keys] of Object.entries(problems.value)) {
			if (problemPath === path || problemPath.startsWith(`${path}.`)) {
				for (const key of keys) errors.add(isValidationKey(key) ? t(key) : key);
			}
		}

		return [...errors];
	};

	const errorText = (path: string): string | undefined => {
		const errors = errorsAt(path);

		return errors.length > 0 ? errors.join(' ') : undefined;
	};

	const warningsAt = (path: string): IAutomationGraphIssue[] =>
		props.issues.filter((issue) => issue.severity === 'warning' && issue.code !== AUTOMATION_SAFETY_ISSUE_CODE && isAbout(issue, path));

	const refusalsAt = (path: string): IAutomationGraphIssue[] =>
		props.issues.filter((issue) => issue.code === AUTOMATION_SAFETY_ISSUE_CODE && isAbout(issue, path));

	return {
		update,
		errorsAt,
		errorText,
		warningsAt,
		refusalsAt,
	};
};
