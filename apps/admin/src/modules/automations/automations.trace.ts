/*
 * What a run did, laid over the canvas (design § Editor, "Test and trace"). A run - live or replayed from
 * the history - is a read-only overlay: it is read from the steps of a trace and never touches the graph
 * being drawn. Everything here is pure, so the canvas, the view and the tests share one reading of a trace.
 */
import { AutomationNodeKind, AutomationRunRecordStatus, AutomationRunStepState } from './automations.constants';
import type { IAutomationGraph } from './store/automations.store.types';
import type { IAutomationRun, IAutomationRunStep, IAutomationRunStepResult } from './store/runs.store.types';

/**
 * How a card took part in a run:
 *  - `reached`: the run is at the card and it has not answered yet - a Delay it waits on, or a card a live
 *    run has just got to. In a run that is over it is where the run stopped waiting.
 *  - `passed`: the card did its part and the run went on through the output it took.
 *  - `failed`: an action that did not do what it was asked to, timed out, was refused, or took `error`.
 *  - `skipped`: the run ended before the card finished or was executed.
 */
export type AutomationRunNodeState = 'reached' | 'passed' | 'failed' | 'skipped';

export interface IAutomationRunNodeOverlay {
	nodeId: string;
	state: AutomationRunNodeState;
	kind: IAutomationRunStep['kind'];
	// The outputs the card took, in the order it took them (several when the run reached it more than once)
	outputs: string[];
	// What a condition saw, as text; null when the step reported nothing
	observed: string | null;
	// Why the card took the output it took, or was not executed - in the backend's English
	reason: string | null;
	// What an action answered
	result: IAutomationRunStepResult | null;
	refused: boolean;
	timedOut: boolean;
	// The run waits on this card (a Delay), or waited on it when it stopped
	parked: boolean;
	delayMs: number | null;
	// How many times the run reached the card
	visits: number;
	// Milliseconds from the start of the run to the last time it reached the card
	elapsedMs: number;
}

export interface IAutomationRunOverlay {
	nodes: Record<string, IAutomationRunNodeOverlay>;
	// The edges the run went along: it arrived on them, or their source took the output they leave
	takenEdges: string[];
	// Nodes the trace names that are not on the canvas any more: the flow was changed since the run
	missingNodeIds: string[];
	// The card the run reached last
	lastNodeId: string | null;
}

/**
 * Why a run needs a word of explanation, and the card it is about.
 *  - `interrupted`: the run was stopped before it ended - by a restart, or the engine stopping - and the
 *    card is where it was waiting;
 *  - `failed`: an action failed and nothing handled its error;
 *  - `cancelled`: the run was cancelled - triggered again, the automation saved or disabled.
 */
export type AutomationRunAttentionKind = 'interrupted' | 'failed' | 'cancelled';

export interface IAutomationRunAttention {
	kind: AutomationRunAttentionKind;
	nodeId: string | null;
	endReason: string | null;
}

const OBSERVED_MAX_LENGTH = 80;

const FAILING_OUTPUTS = ['error', 'timeout'];

const truncate = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const formatScalar = (value: unknown): string => {
	if (value === null) {
		return '–';
	}

	if (typeof value === 'string') {
		return value;
	}

	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}

	try {
		return JSON.stringify(value) ?? '';
	} catch {
		return '';
	}
};

/**
 * What a condition observed, as one short line. A value is shown as it is; an object (a time window saw
 * the time, the weekday and the timezone) as its fields; anything long is cut.
 */
export const formatObservedValue = (value: unknown, max: number = OBSERVED_MAX_LENGTH): string => {
	if (Array.isArray(value)) {
		return truncate(value.map(formatScalar).join(', '), max);
	}

	if (typeof value === 'object' && value !== null) {
		const entries = Object.entries(value as Record<string, unknown>);

		if (entries.length === 1 && entries[0]?.[0] === 'value') {
			return truncate(formatScalar(entries[0][1]), max);
		}

		return truncate(entries.map(([key, item]) => `${key}: ${formatScalar(item)}`).join(', '), max);
	}

	return truncate(formatScalar(value), max);
};

/**
 * How one step of a run went for its card.
 */
export const stepState = (step: IAutomationRunStep): AutomationRunNodeState => {
	if (step.state === AutomationRunStepState.cancelled || step.after_cancel === true) {
		return 'skipped';
	}

	if (step.timed_out === true || step.result?.success === false || (typeof step.output === 'string' && FAILING_OUTPUTS.includes(step.output))) {
		return 'failed';
	}

	// An action that was refused takes `error` and is caught above; a card of a disabled plugin is passed by
	if (step.refused === true) {
		return step.kind === AutomationNodeKind.action ? 'failed' : 'skipped';
	}

	if (step.state === AutomationRunStepState.parked || typeof step.output !== 'string') {
		return 'reached';
	}

	return 'passed';
};

/**
 * Of two reports of the same step (the same `seq`), the one to keep. A step is reported again when it
 * changes, and the only step that changes is a Delay: from waiting (`parked`) to how it went on. A step is
 * therefore never taken back to waiting; otherwise the report that came last is kept.
 */
export const newerRunStep = (held: IAutomationRunStep | undefined, incoming: IAutomationRunStep): IAutomationRunStep =>
	held && held.state !== AutomationRunStepState.parked && incoming.state === AutomationRunStepState.parked ? held : incoming;

const bySeq = (steps: IAutomationRunStep[]): IAutomationRunStep[] => [...steps].sort((a, b) => a.seq - b.seq);

/**
 * Reads the steps of a run - all of a stored trace, or as many as a live run has sent so far - into what
 * each card and each edge of the canvas shows. A card the run reached more than once shows its last visit;
 * a failure on any visit stays shown, as it is what the user is looking for.
 */
export const mapTraceToOverlay = (graph: Pick<IAutomationGraph, 'nodes' | 'edges'>, steps: IAutomationRunStep[]): IAutomationRunOverlay => {
	const nodeIds = new Set(graph.nodes.map((node) => node.id));

	const nodes: Record<string, IAutomationRunNodeOverlay> = {};
	const missing = new Set<string>();

	// The outputs each card took and went on from, for the edges that leave them
	const followed = new Map<string, Set<string>>();
	const arrivedOn = new Set<string>();

	const ordered = bySeq(steps);

	for (const step of ordered) {
		if (typeof step.via === 'string') {
			arrivedOn.add(step.via);
		}

		if (!nodeIds.has(step.node_id)) {
			missing.add(step.node_id);

			continue;
		}

		const state = stepState(step);
		const held = nodes[step.node_id];

		const outputs = [...(held?.outputs ?? [])];

		if (typeof step.output === 'string' && !outputs.includes(step.output)) {
			outputs.push(step.output);
		}

		// An output taken after the run ended was not followed
		if (typeof step.output === 'string' && state !== 'skipped') {
			const taken = followed.get(step.node_id) ?? new Set<string>();

			taken.add(step.output);
			followed.set(step.node_id, taken);
		}

		// The failure stays what the card shows: a later visit that went well does not hide it
		if (held?.state === 'failed' && state !== 'failed') {
			nodes[step.node_id] = { ...held, outputs, parked: false, visits: held.visits + 1, elapsedMs: step.elapsed_ms };

			continue;
		}

		nodes[step.node_id] = {
			nodeId: step.node_id,
			state,
			kind: step.kind,
			outputs,
			observed: step.observed !== undefined ? formatObservedValue(step.observed) : (held?.observed ?? null),
			reason: step.reason ?? step.result?.reason ?? null,
			result: step.result ?? null,
			refused: step.refused === true || step.result?.refused === true,
			timedOut: step.timed_out === true,
			parked: step.state === AutomationRunStepState.parked,
			delayMs: step.delay_ms ?? held?.delayMs ?? null,
			visits: (held?.visits ?? 0) + 1,
			elapsedMs: step.elapsed_ms,
		};
	}

	const takenEdges = graph.edges
		.filter((edge) => arrivedOn.has(edge.id) || (followed.get(edge.source)?.has(edge.source_port) ?? false))
		.map((edge) => edge.id);

	const last = ordered.at(-1);

	return {
		nodes,
		takenEdges,
		missingNodeIds: [...missing],
		lastNodeId: last?.node_id ?? null,
	};
};

/**
 * Of a failed run, the card it failed on: the failure nothing handled. A card whose failing output leads on
 * in the graph recovered (its `error` output is connected), and a later card is the one the run failed on.
 * Without the graph, the last failure is the one the run ended on. A run that failed for another reason (it
 * reached the step limit) and has no unhandled failure is pointed at the last card it reached.
 */
const findFailedNodeId = (steps: IAutomationRunStep[], graph: Pick<IAutomationGraph, 'edges'> | undefined): string | null => {
	const failed = steps.filter((step) => stepState(step) === 'failed');

	const unhandled = graph
		? failed.find(
				(step) => typeof step.output !== 'string' || !graph.edges.some((edge) => edge.source === step.node_id && edge.source_port === step.output)
			)
		: failed.at(-1);

	return unhandled?.node_id ?? steps.at(-1)?.node_id ?? null;
};

/**
 * Of a run that ended in a way that needs explaining, what happened and the card it is about. A run that
 * completed, or is still running, needs none. The graph, when given, tells a failure the flow handled from
 * one it did not.
 */
export const findRunAttention = (
	run: Pick<IAutomationRun, 'status' | 'endReason'>,
	runSteps: IAutomationRunStep[],
	graph?: Pick<IAutomationGraph, 'edges'>
): IAutomationRunAttention | null => {
	const steps = bySeq(runSteps);

	switch (run.status) {
		case AutomationRunRecordStatus.interrupted: {
			// Where it was waiting: the last Delay it parked on and never got past
			const parked = [...steps].reverse().find((step) => step.state === AutomationRunStepState.parked);
			const waiting =
				parked && !steps.some((step) => step.node_id === parked.node_id && step.seq > parked.seq && step.state !== AutomationRunStepState.parked);

			return {
				kind: 'interrupted',
				nodeId: waiting ? parked.node_id : (steps.at(-1)?.node_id ?? null),
				endReason: run.endReason,
			};
		}

		case AutomationRunRecordStatus.failed:
			return {
				kind: 'failed',
				nodeId: findFailedNodeId(steps, graph),
				endReason: run.endReason,
			};

		case AutomationRunRecordStatus.cancelled:
			return {
				kind: 'cancelled',
				nodeId:
					steps.find((step) => stepState(step) === 'skipped')?.node_id ??
					steps.find((step) => step.state === AutomationRunStepState.parked)?.node_id ??
					steps.at(-1)?.node_id ??
					null,
				endReason: run.endReason,
			};

		default:
			return null;
	}
};

/**
 * The node a problem of an invalid automation is about: the node it names, the first of several, or the
 * node an edge leaves.
 */
export const problemNodeId = (
	problem: { node_id?: string; node_ids?: string[]; edge_id?: string },
	graph: Pick<IAutomationGraph, 'nodes' | 'edges'>
): string | null => {
	const candidates = [problem.node_id, ...(problem.node_ids ?? []), graph.edges.find((edge) => edge.id === problem.edge_id)?.source];

	return candidates.find((id): id is string => typeof id === 'string' && graph.nodes.some((node) => node.id === id)) ?? null;
};
