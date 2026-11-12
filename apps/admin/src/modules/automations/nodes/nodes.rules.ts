/*
 * What the editor itself warns about, beyond what the backend reports on save.
 */
import type { IAutomationGraph, IAutomationGraphIssue } from '../store/automations.store.types';

import { AUTOMATION_SELF_TRIGGER_ISSUE_CODE, AutomationBuiltInNodeType } from './nodes.constants';

// The writes with their place in the configuration, which an issue names; what is not a write is skipped
const writesOf = (config: Record<string, unknown>): [Record<string, unknown>, number][] =>
	Array.isArray(config.writes)
		? config.writes.flatMap((write: unknown, index: number): [Record<string, unknown>, number][] =>
				typeof write === 'object' && write !== null ? [[write as Record<string, unknown>, index]] : []
			)
		: [];

/**
 * An action that sets a value one of the automation's own triggers watches starts the automation again
 * with every run: a loop the rate guard ends by suspending the automation (ADR 0003, decision 8). It may
 * be meant - a value set back after a while - so it is a warning, one per write, on the action and the
 * trigger together.
 */
export const findSelfTriggeringWrites = (graph: Pick<IAutomationGraph, 'nodes'>): IAutomationGraphIssue[] => {
	const watchedBy = new Map<string, string[]>();

	for (const node of graph.nodes) {
		if (node.type !== AutomationBuiltInNodeType.DEVICE_PROPERTY_CHANGED || typeof node.config.property_id !== 'string') {
			continue;
		}

		watchedBy.set(node.config.property_id, [...(watchedBy.get(node.config.property_id) ?? []), node.id]);
	}

	if (watchedBy.size === 0) {
		return [];
	}

	const issues: IAutomationGraphIssue[] = [];

	for (const node of graph.nodes) {
		if (node.type !== AutomationBuiltInNodeType.DEVICE_PROPERTY_SET) {
			continue;
		}

		for (const [write, index] of writesOf(node.config)) {
			const triggers = typeof write.property_id === 'string' ? watchedBy.get(write.property_id) : undefined;

			if (!triggers) {
				continue;
			}

			issues.push({
				severity: 'warning',
				code: AUTOMATION_SELF_TRIGGER_ISSUE_CODE,
				message: 'This action sets a value a trigger of the same automation watches, so every run can start the automation again.',
				blocking: false,
				node_id: node.id,
				node_ids: [node.id, ...triggers],
				field: `writes.${index}.property_id`,
			});
		}
	}

	return issues;
};
