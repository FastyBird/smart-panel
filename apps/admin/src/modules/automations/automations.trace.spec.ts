import { describe, expect, it } from 'vitest';

import { AutomationNodeKind, AutomationRunRecordStatus, AutomationRunStepState } from './automations.constants';
import { findRunAttention, formatObservedValue, mapTraceToOverlay, problemNodeId, stepState } from './automations.trace';
import type { IAutomationGraph } from './store/automations.store.types';
import type { IAutomationRunStep } from './store/runs.store.types';

// When motion is detected and it is dark, turn the light on, wait, then notify; a failure is reported
const graph: IAutomationGraph = {
	version: 1,
	nodes: [
		{ id: 't1', type: 'device.property.changed', position: { x: 0, y: 0 }, config: {} },
		{ id: 'c1', type: 'device.property.compare', position: { x: 300, y: 0 }, config: {} },
		{ id: 'a1', type: 'device.property.set', position: { x: 600, y: 0 }, config: {} },
		{ id: 'd1', type: 'flow.delay', position: { x: 900, y: 0 }, config: { seconds: 60 } },
		{ id: 'a2', type: 'notification.send', position: { x: 1200, y: 0 }, config: {} },
		{ id: 'a3', type: 'notification.send', position: { x: 900, y: 200 }, config: {} },
		{ id: 'a4', type: 'scene.run', position: { x: 600, y: 200 }, config: {} },
	],
	edges: [
		{ id: 'e1', source: 't1', source_port: 'out', target: 'c1', target_port: 'in' },
		{ id: 'e2', source: 'c1', source_port: 'yes', target: 'a1', target_port: 'in' },
		{ id: 'e3', source: 'c1', source_port: 'no', target: 'a4', target_port: 'in' },
		{ id: 'e4', source: 'a1', source_port: 'done', target: 'd1', target_port: 'in' },
		{ id: 'e5', source: 'a1', source_port: 'error', target: 'a3', target_port: 'in' },
		{ id: 'e6', source: 'd1', source_port: 'done', target: 'a2', target_port: 'in' },
	],
};

let seq = 0;

const step = (nodeId: string, kind: AutomationNodeKind, overrides: Partial<IAutomationRunStep> = {}): IAutomationRunStep => {
	seq += 1;

	return {
		seq,
		at: new Date(Date.UTC(2026, 10, 11, 7, 30, 0, seq * 10)).toISOString(),
		elapsed_ms: seq * 10,
		node_id: nodeId,
		type: graph.nodes.find((node) => node.id === nodeId)?.type ?? 'unknown',
		kind,
		state: AutomationRunStepState.done,
		...overrides,
	};
};

const reset = (): void => {
	seq = 0;
};

describe('stepState', (): void => {
	it('reads a step that went as it should as passed', (): void => {
		reset();

		expect(stepState(step('t1', AutomationNodeKind.trigger, { output: 'out' }))).toBe('passed');
		expect(stepState(step('c1', AutomationNodeKind.condition, { output: 'no', observed: 12 }))).toBe('passed');
		expect(stepState(step('a1', AutomationNodeKind.action, { output: 'done', result: { success: true } }))).toBe('passed');
	});

	it('reads a failed, timed out or refused action, or an error output, as failed', (): void => {
		reset();

		expect(stepState(step('a1', AutomationNodeKind.action, { output: 'error', result: { success: false, reason: 'Offline' } }))).toBe('failed');
		expect(stepState(step('a1', AutomationNodeKind.action, { output: 'error', timed_out: true }))).toBe('failed');
		expect(stepState(step('a1', AutomationNodeKind.action, { output: 'error', refused: true }))).toBe('failed');
		expect(stepState(step('a1', AutomationNodeKind.action, { result: { success: false } }))).toBe('failed');
		expect(stepState(step('d1', AutomationNodeKind.flow, { output: 'timeout' }))).toBe('failed');
	});

	it('reads a step the run never finished as skipped', (): void => {
		reset();

		expect(stepState(step('a1', AutomationNodeKind.action, { state: AutomationRunStepState.cancelled }))).toBe('skipped');
		expect(stepState(step('a1', AutomationNodeKind.action, { output: 'done', after_cancel: true, result: { success: true } }))).toBe('skipped');
		// A card of a disabled plugin is passed by, it did not fail
		expect(stepState(step('c1', AutomationNodeKind.condition, { refused: true, output: 'no' }))).toBe('skipped');
	});

	it('reads a card the run waits at, or has not heard back from yet, as reached', (): void => {
		reset();

		expect(stepState(step('d1', AutomationNodeKind.flow, { state: AutomationRunStepState.parked, delay_ms: 60_000 }))).toBe('reached');
		expect(stepState(step('a1', AutomationNodeKind.action))).toBe('reached');
	});
});

describe('formatObservedValue', (): void => {
	it('shows a value as it is', (): void => {
		expect(formatObservedValue(21.5)).toBe('21.5');
		expect(formatObservedValue(true)).toBe('true');
		expect(formatObservedValue('heat')).toBe('heat');
		expect(formatObservedValue(null)).toBe('–');
		expect(formatObservedValue({ value: 18 })).toBe('18');
	});

	it('shows an object as its fields and a list as its items', (): void => {
		expect(formatObservedValue({ time: '12:00', weekday: 1, timezone: 'Europe/Prague' })).toBe('time: 12:00, weekday: 1, timezone: Europe/Prague');
		expect(formatObservedValue([1, 'two', { three: 3 }])).toBe('1, two, {"three":3}');
	});

	it('cuts what is too long for a card', (): void => {
		const text = formatObservedValue('x'.repeat(200), 20);

		expect(text).toHaveLength(20);
		expect(text.endsWith('…')).toBe(true);
	});
});

describe('mapTraceToOverlay', (): void => {
	it('marks the cards a run passed, with what each saw and answered, and the edges it went along', (): void => {
		reset();

		const overlay = mapTraceToOverlay(graph, [
			step('t1', AutomationNodeKind.trigger, { output: 'out' }),
			step('c1', AutomationNodeKind.condition, { via: 'e1', output: 'yes', observed: { value: 12 } }),
			step('a1', AutomationNodeKind.action, { via: 'e2', output: 'done', result: { success: true } }),
		]);

		expect(Object.keys(overlay.nodes)).toEqual(['t1', 'c1', 'a1']);
		expect(overlay.nodes.c1).toMatchObject({ state: 'passed', kind: AutomationNodeKind.condition, outputs: ['yes'], observed: '12', visits: 1 });
		expect(overlay.nodes.a1).toMatchObject({ state: 'passed', result: { success: true }, outputs: ['done'] });
		// The edge an output leads along is taken even before the card behind it answers
		expect(overlay.takenEdges).toEqual(['e1', 'e2', 'e4']);
		expect(overlay.lastNodeId).toBe('a1');
		expect(overlay.missingNodeIds).toEqual([]);
	});

	it('leaves the branch that was not taken unmarked', (): void => {
		reset();

		const overlay = mapTraceToOverlay(graph, [
			step('t1', AutomationNodeKind.trigger, { output: 'out' }),
			step('c1', AutomationNodeKind.condition, { via: 'e1', output: 'no', observed: 600, reason: 'Not below 50' }),
			step('a4', AutomationNodeKind.action, { via: 'e3', output: 'done', result: { success: true } }),
		]);

		expect(overlay.takenEdges).toEqual(['e1', 'e3']);
		expect(overlay.nodes.c1).toMatchObject({ outputs: ['no'], observed: '600', reason: 'Not below 50' });
		expect(overlay.nodes.a1).toBeUndefined();
	});

	it('shows a failed action with its reason, and the error branch it took', (): void => {
		reset();

		const overlay = mapTraceToOverlay(graph, [
			step('t1', AutomationNodeKind.trigger, { output: 'out' }),
			step('c1', AutomationNodeKind.condition, { via: 'e1', output: 'yes', observed: 12 }),
			step('a1', AutomationNodeKind.action, { via: 'e2', output: 'error', result: { success: false, reason: 'The device is offline.' } }),
			step('a3', AutomationNodeKind.action, { via: 'e5', output: 'done', result: { success: true } }),
		]);

		expect(overlay.nodes.a1).toMatchObject({ state: 'failed', reason: 'The device is offline.', result: { success: false } });
		expect(overlay.takenEdges).toEqual(['e1', 'e2', 'e5']);
	});

	it('shows a Delay the run waits on, and what it did once the run went on', (): void => {
		reset();

		const parked = [
			step('t1', AutomationNodeKind.trigger, { output: 'out' }),
			step('c1', AutomationNodeKind.condition, { via: 'e1', output: 'yes', observed: 12 }),
			step('a1', AutomationNodeKind.action, { via: 'e2', output: 'done', result: { success: true } }),
			step('d1', AutomationNodeKind.flow, { via: 'e4', state: AutomationRunStepState.parked, delay_ms: 60_000 }),
		];

		const waiting = mapTraceToOverlay(graph, parked);

		expect(waiting.nodes.d1).toMatchObject({ state: 'reached', parked: true, delayMs: 60_000 });
		expect(waiting.takenEdges).not.toContain('e6');

		const done = mapTraceToOverlay(graph, [
			...parked,
			step('d1', AutomationNodeKind.flow, { output: 'done' }),
			step('a2', AutomationNodeKind.action, { via: 'e6', output: 'done', result: { success: true } }),
		]);

		expect(done.nodes.d1).toMatchObject({ state: 'passed', parked: false, delayMs: 60_000, visits: 2 });
		expect(done.takenEdges).toContain('e6');
	});

	it('does not follow an output a card took after the run had ended', (): void => {
		reset();

		const overlay = mapTraceToOverlay(graph, [
			step('t1', AutomationNodeKind.trigger, { output: 'out' }),
			step('c1', AutomationNodeKind.condition, { via: 'e1', output: 'yes', observed: 12 }),
			step('a1', AutomationNodeKind.action, { via: 'e2', output: 'done', after_cancel: true, result: { success: true } }),
		]);

		expect(overlay.nodes.a1?.state).toBe('skipped');
		expect(overlay.takenEdges).toEqual(['e1', 'e2']);
	});

	it('keeps a failure shown when the run reached the card again and it went well', (): void => {
		reset();

		const overlay = mapTraceToOverlay(graph, [
			step('a1', AutomationNodeKind.action, { output: 'error', result: { success: false, reason: 'Busy' } }),
			step('a1', AutomationNodeKind.action, { output: 'done', result: { success: true } }),
		]);

		expect(overlay.nodes.a1).toMatchObject({ state: 'failed', reason: 'Busy', outputs: ['error', 'done'], visits: 2 });
		// Both outputs were followed
		expect(overlay.takenEdges).toEqual(['e4', 'e5']);
	});

	it('reads the steps in the order the run took them, whatever order they arrived in', (): void => {
		reset();

		const first = step('t1', AutomationNodeKind.trigger, { output: 'out' });
		const second = step('c1', AutomationNodeKind.condition, { via: 'e1', output: 'yes', observed: 1 });

		expect(mapTraceToOverlay(graph, [second, first]).lastNodeId).toBe('c1');
	});

	it('names the cards a run reached that are not on the canvas any more', (): void => {
		reset();

		const overlay = mapTraceToOverlay(graph, [
			step('t1', AutomationNodeKind.trigger, { output: 'out' }),
			step('gone', AutomationNodeKind.action, { via: 'e-gone', output: 'done', result: { success: true } }),
		]);

		expect(overlay.missingNodeIds).toEqual(['gone']);
		expect(overlay.nodes.gone).toBeUndefined();
		expect(overlay.lastNodeId).toBe('gone');
	});

	it('lays nothing over a run without steps', (): void => {
		expect(mapTraceToOverlay(graph, [])).toEqual({ nodes: {}, takenEdges: [], missingNodeIds: [], lastNodeId: null });
	});
});

describe('findRunAttention', (): void => {
	it('needs no explanation for a run that completed or is still running', (): void => {
		reset();

		const steps = [step('t1', AutomationNodeKind.trigger, { output: 'out' })];

		expect(findRunAttention({ status: AutomationRunRecordStatus.completed, endReason: null }, steps)).toBeNull();
		expect(findRunAttention({ status: AutomationRunRecordStatus.running, endReason: null }, steps)).toBeNull();
	});

	it('points an interrupted run at the Delay it was waiting on', (): void => {
		reset();

		const steps = [
			step('t1', AutomationNodeKind.trigger, { output: 'out' }),
			step('a1', AutomationNodeKind.action, { output: 'done', result: { success: true } }),
			step('d1', AutomationNodeKind.flow, { state: AutomationRunStepState.parked, delay_ms: 60_000 }),
		];

		expect(findRunAttention({ status: AutomationRunRecordStatus.interrupted, endReason: 'backend_restarted' }, steps)).toEqual({
			kind: 'interrupted',
			nodeId: 'd1',
			endReason: 'backend_restarted',
		});
	});

	it('points an interrupted run that was not waiting at the last card it reached', (): void => {
		reset();

		const steps = [
			step('d1', AutomationNodeKind.flow, { state: AutomationRunStepState.parked, delay_ms: 1000 }),
			step('d1', AutomationNodeKind.flow, { output: 'done' }),
			step('a2', AutomationNodeKind.action, { output: 'done', result: { success: true } }),
		];

		expect(findRunAttention({ status: AutomationRunRecordStatus.interrupted, endReason: 'engine_stopped' }, steps)?.nodeId).toBe('a2');
	});

	it('points a failed run at the card that failed', (): void => {
		reset();

		const steps = [
			step('t1', AutomationNodeKind.trigger, { output: 'out' }),
			step('a1', AutomationNodeKind.action, { output: 'error', result: { success: false, reason: 'Offline' } }),
		];

		expect(findRunAttention({ status: AutomationRunRecordStatus.failed, endReason: null }, steps)).toEqual({
			kind: 'failed',
			nodeId: 'a1',
			endReason: null,
		});
	});

	it('points a failed run at the failure nothing handled, not at one its error output recovered from', (): void => {
		reset();

		const steps = [
			step('t1', AutomationNodeKind.trigger, { output: 'out' }),
			step('c1', AutomationNodeKind.condition, { output: 'yes' }),
			step('a1', AutomationNodeKind.action, { via: 'e2', output: 'error', result: { success: false, reason: 'Offline' } }),
			step('a3', AutomationNodeKind.action, { via: 'e5', output: 'error', result: { success: false, reason: 'No recipients' } }),
		];

		const run = { status: AutomationRunRecordStatus.failed, endReason: null };

		expect(findRunAttention(run, steps, graph)?.nodeId).toBe('a3');
		// Without the graph, the last failure is the one the run ended on
		expect(findRunAttention(run, steps)?.nodeId).toBe('a3');
	});

	it('points a run stopped by the step limit at the last card it reached', (): void => {
		reset();

		const steps = [
			step('t1', AutomationNodeKind.trigger, { output: 'out' }),
			step('a1', AutomationNodeKind.action, { via: 'e2', output: 'error', result: { success: false, reason: 'Offline' } }),
			step('a3', AutomationNodeKind.action, { via: 'e5', output: 'done', result: { success: true } }),
		];

		expect(findRunAttention({ status: AutomationRunRecordStatus.failed, endReason: 'The run was stopped after 1000 steps.' }, steps, graph)).toEqual({
			kind: 'failed',
			nodeId: 'a3',
			endReason: 'The run was stopped after 1000 steps.',
		});
	});

	it('points a cancelled run at the card it did not finish', (): void => {
		reset();

		const steps = [
			step('t1', AutomationNodeKind.trigger, { output: 'out' }),
			step('d1', AutomationNodeKind.flow, { state: AutomationRunStepState.parked, delay_ms: 60_000 }),
			step('d1', AutomationNodeKind.flow, { state: AutomationRunStepState.cancelled }),
		];

		expect(findRunAttention({ status: AutomationRunRecordStatus.cancelled, endReason: 'restarted' }, steps)).toEqual({
			kind: 'cancelled',
			nodeId: 'd1',
			endReason: 'restarted',
		});
	});

	it('has no card to point at for a run without steps', (): void => {
		expect(findRunAttention({ status: AutomationRunRecordStatus.interrupted, endReason: null }, [])?.nodeId).toBeNull();
	});
});

describe('problemNodeId', (): void => {
	it('finds the node a problem names, the first of several, or the node an edge leaves', (): void => {
		expect(problemNodeId({ node_id: 'a1' }, graph)).toBe('a1');
		expect(problemNodeId({ node_ids: ['missing', 'c1', 'a1'] }, graph)).toBe('c1');
		expect(problemNodeId({ edge_id: 'e5' }, graph)).toBe('a1');
	});

	it('finds none for a problem about the graph as a whole or about a node that is gone', (): void => {
		expect(problemNodeId({}, graph)).toBeNull();
		expect(problemNodeId({ node_id: 'gone' }, graph)).toBeNull();
	});
});
