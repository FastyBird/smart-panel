import { describe, expect, it, vi } from 'vitest';

import type { IAutomationRunAttention } from '../automations.trace';

import { useAutomationRunPresentation } from './useAutomationRunPresentation';

const PREFIX = 'automations.runs.explanations';

const translated: Record<string, string> = {
	[`${PREFIX}.failed.text`]: 'An action failed.',
	[`${PREFIX}.failed.stopped`]: 'The run did not finish. {reason}',
	[`${PREFIX}.cancelled.text`]: 'Cancelled: {cause}',
	[`${PREFIX}.cancelledCauses.restarted`]: 'triggered again.',
	[`${PREFIX}.cancelledCauses.automation_updated`]: 'saved with changes.',
	[`${PREFIX}.cancelledCauses.automation_disabled`]: 'disabled.',
	[`${PREFIX}.cancelledCauses.automation_invalid`]: 'cannot run.',
	[`${PREFIX}.cancelledCauses.suspended`]: 'suspended.',
	[`${PREFIX}.cancelledCauses.unknown`]: 'unknown.',
	[`${PREFIX}.interrupted.text`]: 'Interrupted. {cause}',
	[`${PREFIX}.interruptedCauses.engine_stopped`]: 'Engine stopped.',
	[`${PREFIX}.interruptedCauses.unknown`]: 'Unknown.',
};

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string, params: Record<string, string> = {}) =>
			Object.entries(params).reduce((text, [name, value]) => text.replace(`{${name}}`, value), translated[key] ?? key),
		te: (key: string) => key in translated,
		locale: { value: 'en-US' },
	}),
}));

const attention = (kind: IAutomationRunAttention['kind'], endReason: string | null): IAutomationRunAttention => ({ kind, nodeId: null, endReason });

describe('useAutomationRunPresentation', (): void => {
	const { attentionText } = useAutomationRunPresentation();

	it('says an action failed only for a failed run the backend gave no reason for', (): void => {
		expect(attentionText(attention('failed', null))).toBe('An action failed.');
	});

	it('shows why a run stopped by the step limit failed', (): void => {
		expect(attentionText(attention('failed', 'The run was stopped after 1000 steps.'))).toBe(
			'The run did not finish. The run was stopped after 1000 steps.'
		);
	});

	it('names the cause of each cancellation the engine reports', (): void => {
		expect(attentionText(attention('cancelled', 'automation_updated'))).toBe('Cancelled: saved with changes.');
		expect(attentionText(attention('cancelled', 'automation_disabled'))).toBe('Cancelled: disabled.');
		expect(attentionText(attention('cancelled', 'automation_invalid'))).toBe('Cancelled: cannot run.');
		expect(attentionText(attention('cancelled', 'suspended'))).toBe('Cancelled: suspended.');
		expect(attentionText(attention('cancelled', 'restarted'))).toBe('Cancelled: triggered again.');
	});

	it('shows a reason the backend described in words, and a general cause for a code it does not know', (): void => {
		expect(attentionText(attention('cancelled', 'The device went away.'))).toBe('Cancelled: The device went away.');
		expect(attentionText(attention('cancelled', 'something_new'))).toBe('Cancelled: unknown.');
		expect(attentionText(attention('cancelled', null))).toBe('Cancelled: unknown.');
		// A cause known for a cancellation is not one an interruption has words for
		expect(attentionText(attention('interrupted', 'automation_updated'))).toBe('Interrupted. Unknown.');
		expect(attentionText(attention('interrupted', 'engine_stopped'))).toBe('Interrupted. Engine stopped.');
	});
});
