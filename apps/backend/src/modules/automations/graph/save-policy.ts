/**
 * Decides which issues of a graph stop it from being saved. Framework-free (ADR 0003, decision 15).
 *
 * Issues fall into two groups:
 *
 * - structural: the graph could not be run whatever is done to its nodes - a node type that is not
 *   available, an edge on a port that does not exist, an edge into a trigger, a cycle, a duplicate edge.
 *   These always stop a save. So does an action that would reduce safety - unlock, disarm or open - which
 *   an automation may not hold even as a draft.
 * - completeness: the graph is drawn correctly but is not finished - a node whose configuration is not
 *   valid, or no trigger at all. These stop a save only when the automation would be enabled by it, so a
 *   half-drawn or half-configured canvas can be kept as a disabled draft and enabling it requires a
 *   complete graph.
 *
 * Warnings never stop a save.
 */
import {
	AutomationGraphIssue,
	AutomationGraphIssueCode,
	AutomationGraphSafetyCheck,
	validateGraph,
} from './graph-validator';
import { AutomationNodeTypeLookup } from './node-type';

export const AUTOMATION_GRAPH_COMPLETENESS_ISSUE_CODES: ReadonlySet<string> = new Set<AutomationGraphIssueCode>([
	AutomationGraphIssueCode.INVALID_CONFIG,
	AutomationGraphIssueCode.NO_TRIGGER,
]);

export interface AutomationGraphSaveOptions {
	/** Whether the automation would be enabled once saved */
	enabled: boolean;
	/** Judges what every action of the graph would do; left out, nothing is judged */
	safety?: AutomationGraphSafetyCheck;
}

export interface AutomationGraphSaveIssue extends AutomationGraphIssue {
	/** Whether this issue stops the save it was checked for */
	blocking: boolean;
}

export interface AutomationGraphSaveCheck {
	/** Whether the graph can be saved; false when at least one issue is blocking */
	valid: boolean;
	issues: AutomationGraphSaveIssue[];
}

/**
 * An error that is not known to be a completeness issue is treated as structural, so a rule added later
 * stops a save unless it is deliberately listed above.
 */
export const isBlockingGraphIssue = (issue: AutomationGraphIssue, options: AutomationGraphSaveOptions): boolean => {
	if (issue.severity !== 'error') {
		return false;
	}

	return AUTOMATION_GRAPH_COMPLETENESS_ISSUE_CODES.has(issue.code) ? options.enabled : true;
};

export const applyGraphSavePolicy = (
	issues: AutomationGraphIssue[],
	options: AutomationGraphSaveOptions,
): AutomationGraphSaveCheck => {
	const marked = issues.map((issue) => ({ ...issue, blocking: isBlockingGraphIssue(issue, options) }));

	return { valid: !marked.some((issue) => issue.blocking), issues: marked };
};

export const checkGraphForSave = async (
	graph: unknown,
	lookup: AutomationNodeTypeLookup,
	options: AutomationGraphSaveOptions,
): Promise<AutomationGraphSaveCheck> =>
	applyGraphSavePolicy(await validateGraph(graph, lookup, { safety: options.safety }), options);
