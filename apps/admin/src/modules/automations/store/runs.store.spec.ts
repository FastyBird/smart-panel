import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AutomationRunRecordStatus, AutomationStatus, AutomationTriggerOutcome } from '../automations.constants';
import { AutomationsApiException, AutomationsTriggerRefusedException } from '../automations.exceptions';

import { mergeAutomationRun, useAutomationRunsStore } from './runs.store';
import type { IAutomationRun } from './runs.store.types';
import { transformAutomationRunResponse, transformAutomationRunStep, transformAutomationRuntimeResponse } from './runs.transformers';

const mockBackendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: vi.fn(() => ({
			client: mockBackendClient,
		})),
		logger: {
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		},
	};
});

const automationId = '5b4b8bf0-3d1f-4a3b-8e0a-6a1c2d3e4f50';
const otherAutomationId = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

const runIds = ['a1f0c1d2-0000-4000-8000-000000000001', 'a1f0c1d2-0000-4000-8000-000000000002', 'a1f0c1d2-0000-4000-8000-000000000003'];

const trace = {
	trigger: { node_id: 'n1', manual: true, data: {} },
	steps: [
		{ seq: 1, at: '2026-11-11T07:30:00.000Z', elapsed_ms: 0, node_id: 'n1', type: 'manual.start', kind: 'trigger', state: 'done', output: 'out' },
		{
			seq: 2,
			at: '2026-11-11T07:30:00.010Z',
			elapsed_ms: 10,
			node_id: 'n2',
			type: 'device.property.compare',
			kind: 'condition',
			via: 'e1',
			state: 'done',
			output: 'yes',
			observed: { brightness_value: 12 },
		},
	],
	truncated: false,
};

const runRes = (index: number, overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
	id: runIds[index],
	created_at: '2026-11-11T07:30:00.000Z',
	updated_at: null,
	automation_id: automationId,
	revision: 3,
	status: 'completed',
	trigger_node_id: 'n1',
	manual: true,
	started_at: `2026-11-11T07:3${index}:00.000Z`,
	finished_at: `2026-11-11T07:3${index}:01.000Z`,
	duration_ms: 1000,
	end_reason: null,
	...overrides,
});

const deferred = <T>(): { promise: Promise<T>; resolve: (value: T) => void } => {
	let resolve: (value: T) => void = () => {};

	const promise = new Promise<T>((res) => {
		resolve = res;
	});

	return { promise, resolve };
};

describe('runs transformers', (): void => {
	it('converts a run to the store format and keeps its trace as received', (): void => {
		const run = transformAutomationRunResponse({ ...runRes(0), trace });

		expect(run).toMatchObject({
			id: runIds[0],
			automationId,
			status: AutomationRunRecordStatus.completed,
			triggerNodeId: 'n1',
			durationMs: 1000,
			endReason: null,
		});
		expect(run.startedAt).toBeInstanceOf(Date);
		// What a condition observed belongs to its node type: its keys are not rewritten
		expect(run.trace?.steps[1]?.observed).toEqual({ brightness_value: 12 });
		expect(run.trace?.steps[1]?.elapsed_ms).toBe(10);
	});

	it('gives a listed run no trace', (): void => {
		expect(transformAutomationRunResponse(runRes(0)).trace).toBeNull();
	});

	it('drops a live step it cannot read instead of failing', (): void => {
		expect(transformAutomationRunStep(trace.steps[0])).toMatchObject({ seq: 1, node_id: 'n1' });
		expect(transformAutomationRunStep({ seq: 'one' })).toBeNull();
	});

	it('reads what explains the status of an automation', (): void => {
		const runtime = transformAutomationRuntimeResponse({
			automation_id: automationId,
			loaded: true,
			status: 'invalid',
			armed: false,
			armed_triggers: 0,
			active_runs: 0,
			triggers: { started: 0, ignored: 0, dropped: 0 },
			last_skipped: { outcome: 'ignored', reason: 'Busy', node_id: 'n1', at: '2026-11-11T07:30:00.000Z' },
			problems: [{ code: 'missing_reference', message: 'Gone.', node_id: 'n2' }],
			suspended_reason: null,
		});

		expect(runtime).toEqual({
			automationId,
			loaded: true,
			status: AutomationStatus.invalid,
			problems: [{ code: 'missing_reference', message: 'Gone.', node_id: 'n2' }],
			suspendedReason: null,
		});
	});
});

describe('mergeAutomationRun', (): void => {
	const run = (status: AutomationRunRecordStatus, withTrace = false): IAutomationRun =>
		transformAutomationRunResponse({ ...runRes(0, { status }), ...(withTrace ? { trace } : {}) });

	it('never takes a run that ended back to running', (): void => {
		const ended = run(AutomationRunRecordStatus.interrupted);

		expect(mergeAutomationRun(ended, run(AutomationRunRecordStatus.running))).toBe(ended);
		expect(mergeAutomationRun(run(AutomationRunRecordStatus.running), ended)).toBe(ended);
	});

	it('keeps the trace held for the same moment of the run, and lets go of it once the run moved on', (): void => {
		const traced = run(AutomationRunRecordStatus.running, true);

		expect(mergeAutomationRun(traced, run(AutomationRunRecordStatus.running)).trace).toEqual(traced.trace);
		expect(mergeAutomationRun(traced, run(AutomationRunRecordStatus.completed)).trace).toBeNull();
	});
});

describe('Automation runs store', (): void => {
	let store: ReturnType<typeof useAutomationRunsStore>;

	beforeEach((): void => {
		setActivePinia(createPinia());

		store = useAutomationRunsStore();

		vi.clearAllMocks();
	});

	it('reads the history of an automation, newest first', async (): Promise<void> => {
		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [runRes(0), runRes(2), runRes(1)] }, error: undefined, response: { status: 200 } });

		const runs = await store.fetch({ automationId });

		expect(mockBackendClient.GET).toHaveBeenCalledWith('/modules/automations/automations/{id}/runs', { params: { path: { id: automationId } } });
		expect(runs.map((run) => run.id)).toEqual([runIds[2], runIds[1], runIds[0]]);
		expect(store.findForAutomation(automationId)).toEqual(runs);
		expect(store.firstLoadFinished(automationId)).toBe(true);
		expect(store.firstLoadFinished(otherAutomationId)).toBe(false);
		expect(store.isLoaded()).toBe(true);
	});

	it('throws when the history cannot be read', async (): Promise<void> => {
		mockBackendClient.GET.mockResolvedValueOnce({ data: undefined, error: { error: { message: 'Down' } }, response: { status: 500 } });

		await expect(store.fetch({ automationId })).rejects.toBeInstanceOf(AutomationsApiException);
		expect(store.fetching(automationId)).toBe(false);
	});

	it('keeps a run an event brought while the list was on its way', async (): Promise<void> => {
		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [] }, error: undefined, response: { status: 200 } });

		await store.fetch({ automationId });

		const pending = deferred<unknown>();

		mockBackendClient.GET.mockReturnValueOnce(pending.promise);

		const fetching = store.fetch({ automationId, fresh: true });

		// Started and ended after the list was asked for, so the list does not have it
		store.onEvent({ data: runRes(1, { status: 'running', finished_at: null, duration_ms: null }) });
		store.onEvent({ data: runRes(1) });

		pending.resolve({ data: { data: [runRes(0)] }, error: undefined, response: { status: 200 } });

		const runs = await fetching;

		expect(runs.map((run) => [run.id, run.status])).toEqual([
			[runIds[1], AutomationRunRecordStatus.completed],
			[runIds[0], AutomationRunRecordStatus.completed],
		]);
	});

	it('keeps the runs events brought while the first list of the automation was on its way', async (): Promise<void> => {
		const pending = deferred<unknown>();

		mockBackendClient.GET.mockReturnValueOnce(pending.promise);

		const fetching = store.fetch({ automationId });

		// The list was served before these runs started and ended
		store.onEvent({ data: runRes(1, { status: 'running', finished_at: null, duration_ms: null }) });
		store.onEvent({ data: runRes(1) });
		store.onEvent({ data: runRes(2, { status: 'running', finished_at: null, duration_ms: null }) });

		pending.resolve({
			data: { data: [runRes(0), runRes(2, { status: 'running', finished_at: null, duration_ms: null })] },
			error: undefined,
			response: { status: 200 },
		});

		const runs = await fetching;

		expect(runs.map((run) => [run.id, run.status])).toEqual([
			[runIds[2], AutomationRunRecordStatus.running],
			[runIds[1], AutomationRunRecordStatus.completed],
			[runIds[0], AutomationRunRecordStatus.completed],
		]);
	});

	it('does not keep the runs of an automation whose first list failed or that was removed meanwhile', async (): Promise<void> => {
		mockBackendClient.GET.mockResolvedValueOnce({ data: undefined, error: { error: { message: 'Down' } }, response: { status: 500 } });

		const failing = store.fetch({ automationId });

		store.onEvent({ data: runRes(1) });

		await expect(failing).rejects.toBeInstanceOf(AutomationsApiException);

		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [runRes(0)] }, error: undefined, response: { status: 200 } });

		await store.fetch({ automationId });

		expect(store.findForAutomation(automationId).map((run) => run.id)).toEqual([runIds[0]]);
	});

	it('lets go of the trace of a running run once a list says it has ended', async (): Promise<void> => {
		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [] }, error: undefined, response: { status: 200 } });

		await store.fetch({ automationId });

		mockBackendClient.GET.mockResolvedValueOnce({
			data: { data: { ...runRes(0, { status: 'running', finished_at: null, duration_ms: null }), trace } },
			error: undefined,
			response: { status: 200 },
		});

		await store.get({ id: runIds[0] as string });

		// The run ended while the socket was down: only the list read after the reconnect knows
		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [runRes(0)] }, error: undefined, response: { status: 200 } });

		await store.refresh();

		expect(store.findById(runIds[0] as string)).toMatchObject({ status: AutomationRunRecordStatus.completed, trace: null });
		expect(store.traces.has(runIds[0] as string)).toBe(false);
	});

	it('reads a run again when it ended while its read was on its way', async (): Promise<void> => {
		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [] }, error: undefined, response: { status: 200 } });

		await store.fetch({ automationId });

		const pending = deferred<unknown>();

		mockBackendClient.GET.mockReturnValueOnce(pending.promise);

		const getting = store.get({ id: runIds[0] as string });

		store.onEvent({ data: runRes(0) });

		const completed = { ...runRes(0), trace };

		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: completed }, error: undefined, response: { status: 200 } });

		pending.resolve({
			data: { data: { ...runRes(0, { status: 'running', finished_at: null, duration_ms: null }), trace } },
			error: undefined,
			response: { status: 200 },
		});

		const run = await getting;

		expect(mockBackendClient.GET).toHaveBeenCalledTimes(3);
		expect(run).toMatchObject({ status: AutomationRunRecordStatus.completed });
		expect(run.trace?.steps).toHaveLength(2);
		expect(store.findById(runIds[0] as string)?.trace).not.toBeNull();
		expect(store.getting(runIds[0] as string)).toBe(false);
	});

	it('reads a run again only once, even when the backend still says it is running', async (): Promise<void> => {
		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [] }, error: undefined, response: { status: 200 } });

		await store.fetch({ automationId });

		const running = { ...runRes(0, { status: 'running', finished_at: null, duration_ms: null }), trace };
		const pending = deferred<unknown>();

		mockBackendClient.GET.mockReturnValueOnce(pending.promise);
		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: running }, error: undefined, response: { status: 200 } });

		const getting = store.get({ id: runIds[0] as string });

		store.onEvent({ data: runRes(0) });

		pending.resolve({ data: { data: running }, error: undefined, response: { status: 200 } });

		await getting;

		expect(mockBackendClient.GET).toHaveBeenCalledTimes(3);
		expect(store.findById(runIds[0] as string)).toMatchObject({ status: AutomationRunRecordStatus.completed, trace: null });
	});

	it('does not take a run back to running when the list is older than the event that ended it', async (): Promise<void> => {
		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [] }, error: undefined, response: { status: 200 } });

		await store.fetch({ automationId });

		const pending = deferred<unknown>();

		mockBackendClient.GET.mockReturnValueOnce(pending.promise);

		const fetching = store.fetch({ automationId, fresh: true });

		store.onEvent({ data: runRes(0, { status: 'interrupted', end_reason: 'backend_restarted' }) });

		pending.resolve({
			data: { data: [runRes(0, { status: 'running', finished_at: null, duration_ms: null })] },
			error: undefined,
			response: { status: 200 },
		});

		await fetching;

		expect(store.findById(runIds[0] as string)?.status).toBe(AutomationRunRecordStatus.interrupted);
	});

	it('adds the runs announced by events to a history that was read, and to no other', async (): Promise<void> => {
		expect(store.onEvent({ data: runRes(0) })).toBeNull();
		expect(store.findForAutomation(automationId)).toEqual([]);
		expect(store.firstLoadFinished(automationId)).toBe(false);

		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [] }, error: undefined, response: { status: 200 } });

		await store.fetch({ automationId });

		store.onEvent({ data: runRes(1, { status: 'running', finished_at: null, duration_ms: null }) });

		expect(store.findForAutomation(automationId).map((run) => run.status)).toEqual([AutomationRunRecordStatus.running]);

		store.onEvent({ data: runRes(1) });

		expect(store.findForAutomation(automationId).map((run) => run.status)).toEqual([AutomationRunRecordStatus.completed]);

		// What cannot be read is ignored
		expect(store.onEvent({ data: { id: 'x' } })).toBeNull();
	});

	it('reads a run with its trace, and reads it again once the run moved on', async (): Promise<void> => {
		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [] }, error: undefined, response: { status: 200 } });

		await store.fetch({ automationId });

		mockBackendClient.GET.mockResolvedValueOnce({
			data: { data: { ...runRes(0, { status: 'running', finished_at: null, duration_ms: null }), trace } },
			error: undefined,
			response: { status: 200 },
		});

		const run = await store.get({ id: runIds[0] as string });

		expect(mockBackendClient.GET).toHaveBeenLastCalledWith('/modules/automations/runs/{runId}', { params: { path: { runId: runIds[0] } } });
		expect(run.trace?.steps).toHaveLength(2);
		expect(store.findById(runIds[0] as string)?.trace).not.toBeNull();
		// The history holds no traces
		expect(store.findForAutomation(automationId)[0]?.trace).toBeNull();

		store.onEvent({ data: runRes(0) });

		// The trace held is the one of a run that was still going
		expect(store.findById(runIds[0] as string)).toMatchObject({ status: AutomationRunRecordStatus.completed, trace: null });
	});

	it('says when a run has no record yet', async (): Promise<void> => {
		mockBackendClient.GET.mockResolvedValueOnce({
			data: undefined,
			error: { error: { message: 'Requested run does not exist' } },
			response: { status: 404 },
		});

		await expect(store.get({ id: runIds[0] as string })).rejects.toMatchObject({ code: 404 });
		expect(store.getting(runIds[0] as string)).toBe(false);
	});

	it('starts a run by hand, at the trigger given', async (): Promise<void> => {
		mockBackendClient.POST.mockResolvedValueOnce({
			data: { data: { automation_id: automationId, started: true, outcome: 'started', run_id: runIds[0], reason: null } },
			error: undefined,
			response: { status: 200 },
		});

		const pending = store.trigger({ automationId, nodeId: 'n1' });

		expect(store.triggering(automationId)).toBe(true);

		await expect(pending).resolves.toEqual({
			automationId,
			started: true,
			outcome: AutomationTriggerOutcome.started,
			runId: runIds[0],
			reason: null,
		});
		expect(mockBackendClient.POST).toHaveBeenCalledWith('/modules/automations/automations/{id}/trigger', {
			params: { path: { id: automationId } },
			body: { data: { node_id: 'n1' } },
		});
		expect(store.triggering(automationId)).toBe(false);

		mockBackendClient.POST.mockResolvedValueOnce({
			data: { data: { automation_id: automationId, started: false, outcome: 'ignored', run_id: null, reason: 'A run is already active.' } },
			error: undefined,
			response: { status: 200 },
		});

		await expect(store.trigger({ automationId })).resolves.toMatchObject({ started: false, outcome: AutomationTriggerOutcome.ignored });
		expect(mockBackendClient.POST).toHaveBeenLastCalledWith('/modules/automations/automations/{id}/trigger', {
			params: { path: { id: automationId } },
			body: {},
		});
	});

	it('tells why the backend refused to start a run', async (): Promise<void> => {
		mockBackendClient.POST.mockResolvedValueOnce({
			data: undefined,
			error: { error: { message: 'The automation is disabled.', details: { code: 'disabled' } } },
			response: { status: 422 },
		});

		const refused = await store.trigger({ automationId }).catch((error: unknown) => error);

		expect(refused).toBeInstanceOf(AutomationsTriggerRefusedException);
		expect(refused).toMatchObject({ reason: 'disabled', code: 422 });

		mockBackendClient.POST.mockResolvedValueOnce({
			data: undefined,
			error: { error: { message: 'Nope.', details: { code: 'something_new' } } },
			response: { status: 422 },
		});

		await expect(store.trigger({ automationId })).rejects.toMatchObject({ reason: null });

		mockBackendClient.POST.mockRejectedValueOnce(new Error('Network'));

		const failed = await store.trigger({ automationId }).catch((error: unknown) => error);

		expect(failed).toBeInstanceOf(AutomationsApiException);
		expect(failed).not.toBeInstanceOf(AutomationsTriggerRefusedException);
	});

	it('reads what the engine says about an automation', async (): Promise<void> => {
		mockBackendClient.GET.mockResolvedValueOnce({
			data: {
				data: {
					automation_id: automationId,
					loaded: true,
					status: 'suspended',
					armed: false,
					armed_triggers: 0,
					active_runs: 0,
					triggers: { started: 31, ignored: 0, dropped: 0 },
					last_skipped: null,
					problems: [],
					suspended_reason: 'More than 30 runs in a minute.',
				},
			},
			error: undefined,
			response: { status: 200 },
		});

		await store.fetchRuntime({ automationId });

		expect(store.findRuntime(automationId)).toMatchObject({ status: AutomationStatus.suspended, suspendedReason: 'More than 30 runs in a minute.' });
	});

	it('keeps what the latest read of the engine says, whatever order the reads are answered in', async (): Promise<void> => {
		const runtimeRes = (status: string): Record<string, unknown> => ({
			data: {
				data: {
					automation_id: automationId,
					loaded: true,
					status,
					armed: false,
					armed_triggers: 0,
					active_runs: 0,
					triggers: { started: 0, ignored: 0, dropped: 0 },
					last_skipped: null,
					problems: status === 'invalid' ? [{ code: 'no_trigger', message: 'No trigger.' }] : [],
					suspended_reason: null,
				},
			},
			error: undefined,
			response: { status: 200 },
		});

		const older = deferred<unknown>();
		const newer = deferred<unknown>();

		mockBackendClient.GET.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

		const first = store.fetchRuntime({ automationId });
		const second = store.fetchRuntime({ automationId });

		newer.resolve(runtimeRes('invalid'));
		await second;

		// Served before the automation became invalid, and answered last
		older.resolve(runtimeRes('ok'));
		await first;

		expect(store.findRuntime(automationId)).toMatchObject({ status: AutomationStatus.invalid, problems: [{ code: 'no_trigger' }] });
	});

	it('keeps no mark of a run of an automation whose history it does not hold', (): void => {
		const set = vi.spyOn(Map.prototype, 'set');

		try {
			store.onEvent({ data: { ...runRes(1, { status: 'running', finished_at: null, duration_ms: null }), automation_id: otherAutomationId } });

			expect(set.mock.calls.some(([key]) => key === runIds[1])).toBe(false);
		} finally {
			set.mockRestore();
		}
	});

	it('lets go of the marks of what came while a first list was on its way when the list fails', async (): Promise<void> => {
		const pending = deferred<unknown>();

		mockBackendClient.GET.mockReturnValueOnce(pending.promise);

		const fetching = store.fetch({ automationId });

		store.onEvent({ data: runRes(1, { status: 'running', finished_at: null, duration_ms: null }) });

		const remove = vi.spyOn(Map.prototype, 'delete');

		try {
			pending.resolve({ data: undefined, error: undefined, response: { status: 500 } });

			await expect(fetching).rejects.toThrow();

			expect(remove.mock.calls.some(([key]) => key === runIds[1])).toBe(true);
		} finally {
			remove.mockRestore();
		}
	});

	it('lets go of the marks of what came while a first list was on its way when the automation is gone', async (): Promise<void> => {
		const pending = deferred<unknown>();

		mockBackendClient.GET.mockReturnValueOnce(pending.promise);

		const fetching = store.fetch({ automationId });

		store.onEvent({ data: runRes(1, { status: 'running', finished_at: null, duration_ms: null }) });

		store.unset({ automationId });

		const remove = vi.spyOn(Map.prototype, 'delete');

		try {
			pending.resolve({ data: { data: [runRes(0)] }, error: undefined, response: { status: 200 } });

			await fetching;

			expect(remove.mock.calls.some(([key]) => key === runIds[1])).toBe(true);
		} finally {
			remove.mockRestore();
		}
	});

	it('forgets the runs of an automation that is gone, and every run on a reset', async (): Promise<void> => {
		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [runRes(0)] }, error: undefined, response: { status: 200 } });

		await store.fetch({ automationId });

		const pending = deferred<unknown>();

		mockBackendClient.GET.mockReturnValueOnce(pending.promise);

		const fetching = store.fetch({ automationId, fresh: true });

		store.unset({ automationId });

		pending.resolve({ data: { data: [runRes(1)] }, error: undefined, response: { status: 200 } });

		await fetching;

		// The answer is about an automation that is gone
		expect(store.findForAutomation(automationId)).toEqual([]);
		expect(store.firstLoadFinished(automationId)).toBe(false);

		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [runRes(0)] }, error: undefined, response: { status: 200 } });

		await store.fetch({ automationId });

		store.reset();

		expect(store.findForAutomation(automationId)).toEqual([]);
		expect(store.findById(runIds[0] as string)).toBeNull();
		expect(store.isLoaded()).toBe(false);
	});

	it('reads again every history it holds after a reconnect', async (): Promise<void> => {
		mockBackendClient.GET.mockResolvedValue({ data: { data: [] }, error: undefined, response: { status: 200 } });

		await store.fetch({ automationId });
		await store.fetch({ automationId: otherAutomationId });

		mockBackendClient.GET.mockClear();

		await store.refresh();

		expect(mockBackendClient.GET).toHaveBeenCalledTimes(2);
	});
});
