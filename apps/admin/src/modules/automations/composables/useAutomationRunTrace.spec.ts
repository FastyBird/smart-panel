import { effectScope, nextTick, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises } from '@vue/test-utils';

import { AutomationNodeKind, AutomationRunRecordStatus, CommandHandlerName, CommandType, EventType } from '../automations.constants';
import type { IAutomationGraph } from '../store/automations.store.types';
import { useAutomationRunsStore } from '../store/runs.store';

import type { IUseAutomationLiveRun, IUseAutomationRunTrace } from './types';
import { useAutomationLiveRun } from './useAutomationLiveRun';
import { mergeRunSteps, useAutomationRunTrace } from './useAutomationRunTrace';

type Handler = (...args: unknown[]) => void;

const mocks = vi.hoisted(() => ({
	handlers: new Map<string, Set<(...args: unknown[]) => void>>(),
	socket: { connected: true } as { connected: boolean; on?: unknown; off?: unknown },
	sendCommand: vi.fn(),
	backend: { GET: vi.fn(), POST: vi.fn() },
	store: null as unknown,
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	mocks.socket.on = (event: string, handler: Handler): void => {
		const set = mocks.handlers.get(event) ?? new Set<Handler>();

		set.add(handler);
		mocks.handlers.set(event, set);
	};
	mocks.socket.off = (event: string, handler: Handler): void => {
		mocks.handlers.get(event)?.delete(handler);
	};

	return {
		...actual,
		useBackend: () => ({ client: mocks.backend }),
		useSockets: () => ({ sockets: mocks.socket, sendCommand: mocks.sendCommand }),
		useLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), log: vi.fn(), fatal: vi.fn() }),
		injectStoresManager: () => ({ getStore: () => mocks.store }),
		logger: { error: vi.fn(), info: vi.fn(), warning: vi.fn(), log: vi.fn(), debug: vi.fn() },
	};
});

const automationId = '5b4b8bf0-3d1f-4a3b-8e0a-6a1c2d3e4f50';
const runId = 'a1f0c1d2-0000-4000-8000-000000000001';
const otherRunId = 'a1f0c1d2-0000-4000-8000-000000000002';

const graph: IAutomationGraph = {
	version: 1,
	nodes: [
		{ id: 'n1', type: 'manual.start', position: { x: 0, y: 0 }, config: {} },
		{ id: 'n2', type: 'flow.delay', position: { x: 300, y: 0 }, config: { seconds: 60 } },
		{ id: 'n3', type: 'notification.send', position: { x: 600, y: 0 }, config: {} },
	],
	edges: [
		{ id: 'e1', source: 'n1', source_port: 'out', target: 'n2', target_port: 'in' },
		{ id: 'e2', source: 'n2', source_port: 'done', target: 'n3', target_port: 'in' },
	],
};

const emit = (event: string, ...args: unknown[]): void => {
	for (const handler of mocks.handlers.get(event) ?? []) {
		handler(...args);
	}
};

const stepRes = (seq: number, nodeId: string, kind: AutomationNodeKind, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
	seq,
	at: '2026-11-11T07:30:00.000Z',
	elapsed_ms: seq,
	node_id: nodeId,
	type: graph.nodes.find((node) => node.id === nodeId)?.type,
	kind,
	state: 'done',
	...extra,
});

const sendStep = (step: Record<string, unknown>, run: string = runId, automation: string = automationId): void => {
	emit('event', { event: EventType.RUN_STEP, payload: { automation_id: automation, run_id: run, step } });
};

const runRes = (id: string, status: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
	id,
	automation_id: automationId,
	revision: 1,
	status,
	trigger_node_id: 'n1',
	manual: true,
	started_at: '2026-11-11T07:30:00.000Z',
	finished_at: status === 'running' ? null : '2026-11-11T07:31:00.000Z',
	duration_ms: status === 'running' ? null : 60_000,
	end_reason: null,
	...extra,
});

describe('useAutomationLiveRun', (): void => {
	let scope: ReturnType<typeof effectScope>;

	beforeEach((): void => {
		mocks.handlers.clear();
		mocks.socket.connected = true;
		mocks.sendCommand.mockReset().mockResolvedValue(true);
	});

	afterEach((): void => {
		scope?.stop();
	});

	const create = (): IUseAutomationLiveRun => {
		scope = effectScope();

		return scope.run(() => useAutomationLiveRun({ id: automationId })) as IUseAutomationLiveRun;
	};

	it('watches the automation while it is open, again after a reconnect, and stops when it is left', async (): Promise<void> => {
		const live = create();

		await flushPromises();

		expect(mocks.sendCommand).toHaveBeenCalledWith(
			CommandType.WATCH_AUTOMATION,
			{ automation_id: automationId },
			CommandHandlerName.WATCH_AUTOMATION
		);
		expect(live.watching.value).toBe(true);

		emit('disconnect');

		expect(live.watching.value).toBe(false);

		emit('connect');
		await flushPromises();

		expect(mocks.sendCommand).toHaveBeenCalledTimes(2);
		expect(live.watching.value).toBe(true);

		scope.stop();
		await flushPromises();

		expect(mocks.sendCommand).toHaveBeenLastCalledWith(
			CommandType.UNWATCH_AUTOMATION,
			{ automation_id: automationId },
			CommandHandlerName.UNWATCH_AUTOMATION
		);
		expect(mocks.handlers.get('event')?.size ?? 0).toBe(0);
	});

	it('waits for the socket before it watches, and stops watching when left before the answer came', async (): Promise<void> => {
		mocks.socket.connected = false;

		create();

		expect(mocks.sendCommand).not.toHaveBeenCalled();

		let answer: (value: true) => void = () => {};

		mocks.sendCommand.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

		emit('connect');
		scope.stop();

		answer(true);
		await flushPromises();

		expect(mocks.sendCommand).toHaveBeenLastCalledWith(CommandType.UNWATCH_AUTOMATION, expect.anything(), CommandHandlerName.UNWATCH_AUTOMATION);
	});

	it('keeps the steps of each run in order, once each, and only for this automation', async (): Promise<void> => {
		const live = create();

		sendStep(stepRes(2, 'n2', AutomationNodeKind.flow, { state: 'parked', delay_ms: 60_000 }));
		sendStep(stepRes(1, 'n1', AutomationNodeKind.trigger, { output: 'out' }));
		sendStep(stepRes(1, 'n1', AutomationNodeKind.trigger, { output: 'out' }));
		sendStep(stepRes(1, 'n1', AutomationNodeKind.trigger, { output: 'out' }), otherRunId, 'another-automation');
		sendStep({ seq: 'broken' });
		emit('event', { event: 'AutomationsModule.Run.Started', payload: { id: runId } });

		expect(live.stepsOf(runId).map((step) => step.seq)).toEqual([1, 2]);
		expect(live.stepsOf(otherRunId)).toEqual([]);
		expect(live.latestRunId.value).toBe(runId);
	});

	it('takes the newer state of a step it has, as a Delay that let the run go on', (): void => {
		const live = create();

		sendStep(stepRes(2, 'n2', AutomationNodeKind.flow, { state: 'parked', delay_ms: 60_000 }));
		sendStep(stepRes(2, 'n2', AutomationNodeKind.flow, { state: 'done', output: 'done', delay_ms: 60_000 }));
		// A step is never taken back to waiting
		sendStep(stepRes(2, 'n2', AutomationNodeKind.flow, { state: 'parked', delay_ms: 60_000 }));

		expect(live.stepsOf(runId).map((step) => [step.seq, step.state])).toEqual([[2, 'done']]);
	});

	it('keeps the steps of the last few runs only', (): void => {
		const live = create();

		const ids = Array.from({ length: 7 }, (_, index) => `a1f0c1d2-0000-4000-8000-00000000001${index}`);

		for (const id of ids) {
			sendStep(stepRes(1, 'n1', AutomationNodeKind.trigger, { output: 'out' }), id);
		}

		expect(live.stepsOf(ids[0] as string)).toEqual([]);
		expect(live.stepsOf(ids[6] as string)).toHaveLength(1);
	});
});

describe('mergeRunSteps', (): void => {
	it('takes every step once, the stored one over the live one', (): void => {
		const live = [stepRes(1, 'n1', AutomationNodeKind.trigger, { output: 'out' }), stepRes(2, 'n2', AutomationNodeKind.flow, { state: 'parked' })];
		const stored = [stepRes(2, 'n2', AutomationNodeKind.flow, { state: 'parked', delay_ms: 60_000 })];

		const merged = mergeRunSteps(stored as never, live as never);

		expect(merged.map((step) => step.seq)).toEqual([1, 2]);
		expect(merged[1]?.delay_ms).toBe(60_000);
	});

	it('does not take a stored step that waits over a live one that went on', (): void => {
		const live = [stepRes(2, 'n2', AutomationNodeKind.flow, { state: 'done', output: 'done' })];
		const stored = [stepRes(2, 'n2', AutomationNodeKind.flow, { state: 'parked', delay_ms: 60_000 })];

		expect(mergeRunSteps(stored as never, live as never)[0]).toMatchObject({ state: 'done', output: 'done' });
	});
});

describe('useAutomationRunTrace', (): void => {
	let scope: ReturnType<typeof effectScope>;

	beforeEach((): void => {
		setActivePinia(createPinia());

		mocks.store = useAutomationRunsStore();
		mocks.handlers.clear();
		mocks.socket.connected = true;
		mocks.sendCommand.mockReset().mockResolvedValue(true);
		mocks.backend.GET.mockReset();
		mocks.backend.POST.mockReset();
	});

	afterEach((): void => {
		scope?.stop();
	});

	const create = async (): Promise<IUseAutomationRunTrace> => {
		scope = effectScope();

		const trace = scope.run(() => useAutomationRunTrace({ id: automationId, graph: ref(graph) })) as IUseAutomationRunTrace;

		mocks.backend.GET.mockResolvedValueOnce({ data: { data: [] }, error: undefined, response: { status: 200 } });

		await trace.fetchRuns();

		return trace;
	};

	const store = (): ReturnType<typeof useAutomationRunsStore> => mocks.store as ReturnType<typeof useAutomationRunsStore>;

	it('follows a test run live, then shows what it stored once it is over', async (): Promise<void> => {
		const trace = await create();

		mocks.backend.POST.mockResolvedValueOnce({
			data: { data: { automation_id: automationId, started: true, outcome: 'started', run_id: runId, reason: null } },
			error: undefined,
			response: { status: 200 },
		});

		// The first step can arrive before the answer that names the run
		sendStep(stepRes(1, 'n1', AutomationNodeKind.trigger, { output: 'out' }));

		const result = await trace.test('n1');

		expect(result.runId).toBe(runId);
		expect(trace.shown.value).toMatchObject({ runId, source: 'live', ended: false, run: null, attention: null });
		expect(trace.shown.value?.overlay.nodes.n1?.state).toBe('passed');

		sendStep(stepRes(2, 'n2', AutomationNodeKind.flow, { via: 'e1', state: 'parked', delay_ms: 60_000 }));
		store().onEvent({ data: runRes(runId, 'running') });
		await nextTick();

		// Still running: nothing is read, the steps come live
		expect(mocks.backend.GET).toHaveBeenCalledTimes(1);
		expect(trace.shown.value?.overlay.nodes.n2).toMatchObject({ state: 'reached', parked: true });
		expect(trace.shown.value?.overlay.takenEdges).toEqual(['e1']);

		mocks.backend.GET.mockResolvedValueOnce({
			data: {
				data: {
					...runRes(runId, 'interrupted', { end_reason: 'engine_stopped' }),
					trace: {
						trigger: { node_id: 'n1', manual: true, data: {} },
						steps: [
							stepRes(1, 'n1', AutomationNodeKind.trigger, { output: 'out' }),
							stepRes(2, 'n2', AutomationNodeKind.flow, { via: 'e1', state: 'parked', delay_ms: 60_000 }),
						],
						truncated: false,
					},
				},
			},
			error: undefined,
			response: { status: 200 },
		});

		store().onEvent({ data: runRes(runId, 'interrupted', { end_reason: 'engine_stopped' }) });
		await flushPromises();

		expect(mocks.backend.GET).toHaveBeenLastCalledWith('/modules/automations/runs/{runId}', { params: { path: { runId } } });
		expect(trace.shown.value).toMatchObject({
			ended: true,
			attention: { kind: 'interrupted', nodeId: 'n2', endReason: 'engine_stopped' },
			loading: false,
			failed: false,
		});
		expect(trace.shown.value?.run?.status).toBe(AutomationRunRecordStatus.interrupted);
	});

	it('does not lay a run over the canvas when no run was started', async (): Promise<void> => {
		const trace = await create();

		mocks.backend.POST.mockResolvedValueOnce({
			data: { data: { automation_id: automationId, started: false, outcome: 'dropped', run_id: null, reason: 'Too many runs.' } },
			error: undefined,
			response: { status: 200 },
		});

		await trace.test();

		expect(trace.shown.value).toBeNull();
	});

	it('replays a past run from its trace, and says when the trace cannot be read', async (): Promise<void> => {
		const trace = await create();

		mocks.backend.GET.mockResolvedValueOnce({
			data: {
				data: {
					...runRes(runId, 'completed'),
					trace: {
						trigger: { node_id: 'n1', manual: true, data: {} },
						steps: [stepRes(1, 'n1', AutomationNodeKind.trigger, { output: 'out' })],
						truncated: true,
					},
				},
			},
			error: undefined,
			response: { status: 200 },
		});

		trace.replay(runId);
		await flushPromises();

		expect(trace.shown.value).toMatchObject({ runId, source: 'replay', ended: true, truncated: true, attention: null });
		expect(trace.shown.value?.overlay.takenEdges).toEqual(['e1']);

		mocks.backend.GET.mockResolvedValueOnce({ data: undefined, error: { error: { message: 'Gone' } }, response: { status: 404 } });

		trace.replay(otherRunId);
		await flushPromises();

		expect(trace.shown.value).toMatchObject({ runId: otherRunId, failed: true, loading: false });

		// Not read again on its own; picked again, it is
		await nextTick();

		expect(mocks.backend.GET).toHaveBeenCalledTimes(3);

		mocks.backend.GET.mockResolvedValueOnce({ data: undefined, error: { error: { message: 'Gone' } }, response: { status: 404 } });

		trace.close();
		trace.replay(otherRunId);
		await flushPromises();

		expect(mocks.backend.GET).toHaveBeenCalledTimes(4);

		trace.close();

		expect(trace.shown.value).toBeNull();
	});

	it('follows a run a trigger started while the view is open, but not over a run being replayed', async (): Promise<void> => {
		const trace = await create();

		sendStep(stepRes(1, 'n1', AutomationNodeKind.trigger, { output: 'out' }), runId);
		await nextTick();

		expect(trace.shown.value).toMatchObject({ runId, source: 'live' });

		// The run followed is still going: another one does not take its place
		sendStep(stepRes(1, 'n1', AutomationNodeKind.trigger, { output: 'out' }), otherRunId);
		await nextTick();

		expect(trace.shown.value?.runId).toBe(runId);

		mocks.backend.GET.mockResolvedValue({ data: undefined, error: undefined, response: { status: 500 } });

		trace.replay(runId);

		const third = 'a1f0c1d2-0000-4000-8000-000000000003';

		sendStep(stepRes(1, 'n1', AutomationNodeKind.trigger, { output: 'out' }), third);
		await nextTick();

		expect(trace.shown.value).toMatchObject({ runId, source: 'replay' });
	});

	it('follows a run that started while the run followed was ending, once that one is over', async (): Promise<void> => {
		const trace = await create();

		mocks.backend.GET.mockResolvedValue({ data: undefined, error: undefined, response: { status: 500 } });

		sendStep(stepRes(1, 'n1', AutomationNodeKind.trigger, { output: 'out' }), runId);
		store().onEvent({ data: runRes(runId, 'running') });
		await nextTick();

		expect(trace.shown.value).toMatchObject({ runId, source: 'live' });

		// The next run sends its steps before the end of the first one is announced
		sendStep(stepRes(1, 'n1', AutomationNodeKind.trigger, { output: 'out' }), otherRunId);
		await nextTick();

		expect(trace.shown.value?.runId).toBe(runId);

		store().onEvent({ data: runRes(runId, 'completed') });
		await nextTick();

		expect(trace.shown.value).toMatchObject({ runId: otherRunId, source: 'live' });
	});

	it('does not follow a waiting run once the run followed ends, after it was closed or another run was picked', async (): Promise<void> => {
		const trace = await create();

		mocks.backend.GET.mockResolvedValue({ data: undefined, error: undefined, response: { status: 500 } });

		sendStep(stepRes(1, 'n1', AutomationNodeKind.trigger, { output: 'out' }), runId);
		store().onEvent({ data: runRes(runId, 'running') });
		await nextTick();

		sendStep(stepRes(1, 'n1', AutomationNodeKind.trigger, { output: 'out' }), otherRunId);
		await nextTick();

		trace.close();
		await nextTick();

		store().onEvent({ data: runRes(runId, 'completed') });
		await nextTick();

		expect(trace.shown.value).toBeNull();
	});

	it('reads what a running run stored after a reconnect, and goes on with the steps that come live', async (): Promise<void> => {
		const trace = await create();

		mocks.backend.POST.mockResolvedValueOnce({
			data: { data: { automation_id: automationId, started: true, outcome: 'started', run_id: runId, reason: null } },
			error: undefined,
			response: { status: 200 },
		});

		await trace.test();

		sendStep(stepRes(1, 'n1', AutomationNodeKind.trigger, { output: 'out' }));
		sendStep(stepRes(2, 'n2', AutomationNodeKind.flow, { via: 'e1', state: 'parked', delay_ms: 60_000 }));
		store().onEvent({ data: runRes(runId, 'running') });
		await nextTick();

		expect(mocks.backend.GET).toHaveBeenCalledTimes(1);

		emit('disconnect');

		// While the socket was down the Delay let the run go on, and the run parked again
		mocks.backend.GET.mockResolvedValueOnce({
			data: {
				data: {
					...runRes(runId, 'running'),
					trace: {
						trigger: { node_id: 'n1', manual: true, data: {} },
						steps: [
							stepRes(1, 'n1', AutomationNodeKind.trigger, { output: 'out' }),
							stepRes(2, 'n2', AutomationNodeKind.flow, { via: 'e1', state: 'done', output: 'done', delay_ms: 60_000 }),
							stepRes(3, 'n3', AutomationNodeKind.action, { via: 'e2', state: 'done', output: 'done', result: { success: true } }),
						],
						truncated: false,
					},
				},
			},
			error: undefined,
			response: { status: 200 },
		});

		emit('connect');
		await flushPromises();

		expect(mocks.backend.GET).toHaveBeenLastCalledWith('/modules/automations/runs/{runId}', { params: { path: { runId } } });
		expect(trace.shown.value?.overlay.nodes.n2?.state).toBe('passed');
		expect(trace.shown.value?.overlay.nodes.n3?.state).toBe('passed');
		expect(trace.shown.value).toMatchObject({ ended: false, failed: false });

		// A run that has not stored anything yet is simply followed live
		emit('disconnect');

		mocks.backend.GET.mockResolvedValueOnce({ data: undefined, error: { error: { message: 'Gone' } }, response: { status: 404 } });

		emit('connect');
		await flushPromises();

		expect(trace.shown.value).toMatchObject({ runId, ended: false, failed: false });
		expect(trace.shown.value?.overlay.nodes.n3?.state).toBe('passed');
	});

	it('says when the history cannot be read', async (): Promise<void> => {
		scope = effectScope();

		const trace = scope.run(() => useAutomationRunTrace({ id: automationId, graph: ref(graph) })) as IUseAutomationRunTrace;

		mocks.backend.GET.mockResolvedValueOnce({ data: undefined, error: { error: { message: 'Down' } }, response: { status: 500 } });

		await trace.fetchRuns();

		expect(trace.runsLoadFailed.value).toBe(true);

		mocks.backend.GET.mockResolvedValueOnce({ data: { data: [runRes(runId, 'completed')] }, error: undefined, response: { status: 200 } });

		await trace.fetchRuns();

		expect(trace.runsLoadFailed.value).toBe(false);
		expect(trace.runs.value.map((run) => run.id)).toEqual([runId]);
	});
});
