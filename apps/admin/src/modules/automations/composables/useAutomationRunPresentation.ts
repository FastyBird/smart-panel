import { useI18n } from 'vue-i18n';

import {
	AUTOMATION_RUN_CANCEL_REASONS,
	AUTOMATION_RUN_INTERRUPT_REASONS,
	AUTOMATION_TRIGGER_REFUSALS,
	AutomationNodeKind,
	type AutomationRunRecordStatus,
	type AutomationTriggerOutcome,
	type AutomationTriggerRefusal,
} from '../automations.constants';
import type { IAutomationRunAttention, IAutomationRunNodeOverlay } from '../automations.trace';
import { formatDuration } from '../nodes/nodes.summaries';
import type { IAutomationGraph } from '../store/automations.store.types';
import type { IAutomationNodeType } from '../store/node-types.store.types';
import type { IAutomationRuntimeProblem } from '../store/runs.store.types';

import type { IUseAutomationRunPresentation } from './types';
import { useAutomationNodePresentation } from './useAutomationNodePresentation';

const PREFIX = 'automations.runs';

// The outputs a card takes when all went as it should: saying so on the card adds nothing
const PLAIN_OUTPUTS = ['out', 'done'];

// A reason that is a code (`automation_updated`) rather than a sentence
const END_REASON_CODE = /^[a-z][a-z0-9_]*$/;

/**
 * How a run is put into words: its status, what each card did in it, and - for what went wrong - what
 * happened in plain words. The reasons the backend gives are in English and are shown as they come.
 */
export const useAutomationRunPresentation = (): IUseAutomationRunPresentation => {
	const { t, te, locale } = useI18n();

	const { portLabel, issueText, nodeTitle } = useAutomationNodePresentation();

	const runStatusLabel = (status: AutomationRunRecordStatus): string => t(`${PREFIX}.statuses.${status}`);

	const durationText = (ms: number): string => {
		if (ms < 1000) {
			return t(`${PREFIX}.texts.milliseconds`, { count: Math.max(0, Math.round(ms)) });
		}

		return formatDuration(Math.round(ms / 1000), t);
	};

	// In the language of the application, which is not always the one of the browser
	const dateText = (date: Date): string => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'medium' }).format(date);

	const outputText = (overlay: IAutomationRunNodeOverlay): string | null => {
		const output = overlay.outputs.at(-1);

		return typeof output === 'string' && !PLAIN_OUTPUTS.includes(output) ? t(`${PREFIX}.nodes.output`, { output: portLabel(output) }) : null;
	};

	const join = (...parts: (string | null)[]): string => parts.filter((part): part is string => part !== null && part !== '').join(' ');

	const nodeRunText = (overlay: IAutomationRunNodeOverlay, ended: boolean): string => {
		const reason = overlay.reason;

		switch (overlay.state) {
			case 'skipped':
				return overlay.refused
					? reason
						? t(`${PREFIX}.nodes.refused`, { reason })
						: t(`${PREFIX}.nodes.refusedNoReason`)
					: t(`${PREFIX}.nodes.skipped`);

			case 'failed':
				if (overlay.timedOut) {
					return t(`${PREFIX}.nodes.timedOut`);
				}

				if (overlay.refused) {
					return reason ? t(`${PREFIX}.nodes.refused`, { reason }) : t(`${PREFIX}.nodes.refusedNoReason`);
				}

				return reason ? t(`${PREFIX}.nodes.failed`, { reason }) : t(`${PREFIX}.nodes.failedNoReason`);

			case 'reached':
				if (overlay.parked) {
					if (ended) {
						return t(`${PREFIX}.nodes.waitingStopped`);
					}

					return overlay.delayMs !== null ? t(`${PREFIX}.nodes.waiting`, { duration: durationText(overlay.delayMs) }) : t(`${PREFIX}.nodes.running`);
				}

				return t(`${PREFIX}.nodes.running`);

			default:
				break;
		}

		switch (overlay.kind) {
			case AutomationNodeKind.trigger:
				return t(`${PREFIX}.nodes.started`);

			case AutomationNodeKind.condition:
				return join(overlay.observed !== null ? t(`${PREFIX}.nodes.observed`, { value: overlay.observed }) : reason, outputText(overlay));

			case AutomationNodeKind.action:
				return join(t(`${PREFIX}.nodes.done`), outputText(overlay));

			default:
				return overlay.delayMs !== null
					? t(`${PREFIX}.nodes.waited`, { duration: durationText(overlay.delayMs) })
					: (outputText(overlay) ?? t(`${PREFIX}.nodes.done`));
		}
	};

	// A code the engine ends runs with is put into words; a reason the backend wrote out is shown as it is
	const endCause = (prefix: string, endReason: string | null, codes: readonly string[]): string => {
		if (endReason !== null && codes.includes(endReason)) {
			return t(`${PREFIX}.explanations.${prefix}.${endReason}`);
		}

		if (endReason !== null && endReason.trim() !== '' && !END_REASON_CODE.test(endReason)) {
			return endReason;
		}

		return t(`${PREFIX}.explanations.${prefix}.unknown`);
	};

	const attentionText = (attention: IAutomationRunAttention): string => {
		switch (attention.kind) {
			case 'interrupted':
				return t(`${PREFIX}.explanations.interrupted.text`, {
					cause: endCause('interruptedCauses', attention.endReason, AUTOMATION_RUN_INTERRUPT_REASONS),
				});

			case 'cancelled':
				return t(`${PREFIX}.explanations.cancelled.text`, { cause: endCause('cancelledCauses', attention.endReason, AUTOMATION_RUN_CANCEL_REASONS) });

			default:
				// A run can fail without an action failing - it reached the step limit - and then the backend says why
				return attention.endReason !== null && attention.endReason.trim() !== ''
					? t(`${PREFIX}.explanations.failed.stopped`, { reason: attention.endReason })
					: t(`${PREFIX}.explanations.failed.text`);
		}
	};

	const problemText = (problem: Pick<IAutomationRuntimeProblem, 'code' | 'message'>): string => {
		const key = `${PREFIX}.problems.${problem.code}`;

		return te(key) ? t(key) : issueText(problem);
	};

	const refusalText = (refusal: AutomationTriggerRefusal | null): string =>
		refusal !== null && AUTOMATION_TRIGGER_REFUSALS.includes(refusal) ? t(`${PREFIX}.refusals.${refusal}`) : t(`${PREFIX}.refusals.unknown`);

	// The name of a card of the graph; null for one that is not in it (any more)
	const nodeLabel = (nodeId: string, graph: Pick<IAutomationGraph, 'nodes'>, nodeTypes: IAutomationNodeType[]): string | null => {
		const node = graph.nodes.find((item) => item.id === nodeId);

		return node ? nodeTitle(node.type, nodeTypes.find((nodeType) => nodeType.type === node.type) ?? null) : null;
	};

	const outcomeText = (outcome: AutomationTriggerOutcome): string => t(`${PREFIX}.outcomes.${outcome}`);

	return {
		runStatusLabel,
		durationText,
		dateText,
		nodeRunText,
		attentionText,
		problemText,
		refusalText,
		outcomeText,
		nodeLabel,
	};
};
