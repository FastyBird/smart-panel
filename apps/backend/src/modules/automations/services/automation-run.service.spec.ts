import { Repository } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { AutomationRunStatus, EventType } from '../automations.constants';
import { RunRecord, RunStatus, RunStep } from '../engine/run-walker';
import { AutomationEntity } from '../entities/automations.entity';

import { AutomationRunHistoryService, AutomationRunRow } from './automation-run-history.service';
import { AutomationRunService } from './automation-run.service';

describe('AutomationRunService', () => {
	const ID = '11111111-1111-4111-8111-111111111111';
	const STARTED_AT = Date.UTC(2026, 10, 11, 7, 30);

	let stored: Partial<AutomationEntity> | null;
	let update: jest.Mock;
	let emit: jest.Mock;
	let rows: AutomationRunRow[];
	let leftover: Partial<AutomationRunRow>[];
	let history: { store: jest.Mock; interruptRunning: jest.Mock; pruneExpired: jest.Mock };
	let service: AutomationRunService;

	const record = (status: RunStatus, overrides: Partial<RunRecord> = {}): RunRecord => ({
		id: 'run-1',
		automationId: ID,
		revision: 4,
		trigger: { nodeId: 't', data: {}, manual: false },
		startedAt: STARTED_AT,
		status,
		steps: [],
		...overrides,
	});

	beforeEach(() => {
		stored = { id: ID, revision: 4, lastTriggeredAt: null, lastRunStatus: null };
		update = jest.fn((_where: { id: string }, changes: Partial<AutomationEntity>) => {
			if (!stored) return Promise.resolve({ affected: 0 });

			Object.assign(stored, changes);

			return Promise.resolve({ affected: 1 });
		});
		emit = jest.fn();
		rows = [];
		leftover = [];
		history = {
			store: jest.fn((row: AutomationRunRow) => {
				rows.push(row);

				return Promise.resolve();
			}),
			interruptRunning: jest.fn(() => Promise.resolve(leftover)),
			pruneExpired: jest.fn(() => Promise.resolve(0)),
		};

		service = new AutomationRunService(
			{
				update,
				findOne: jest.fn(() => Promise.resolve(stored ? { ...stored } : null)),
				findOneBy: jest.fn(() => Promise.resolve(stored)),
				existsBy: jest.fn(() => Promise.resolve(stored !== null)),
			} as unknown as Repository<AutomationEntity>,
			{ emit } as unknown as EventEmitter2,
			history as unknown as AutomationRunHistoryService,
		);
	});

	it.each([
		['completed', AutomationRunStatus.COMPLETED],
		['failed', AutomationRunStatus.FAILED],
		['cancelled', AutomationRunStatus.CANCELLED],
		['interrupted', AutomationRunStatus.INTERRUPTED],
	] as const)(
		'records a run that ended as %s with one write and announces the automation',
		async (status, expected) => {
			service.runStarted(record('running'));
			service.runEnded(record(status));
			await service.settled();

			expect(update).toHaveBeenCalledTimes(1);
			expect(update).toHaveBeenCalledWith(
				{ id: ID },
				{ lastTriggeredAt: new Date(STARTED_AT), lastRunStatus: expected },
			);
			expect(stored).toMatchObject({ revision: 4 });
			expect(emit).toHaveBeenCalledWith(EventType.AUTOMATION_UPDATED, stored);
		},
	);

	it('records when a parked run was triggered before it ends', async () => {
		service.runParked(record('running'));
		await service.settled();

		expect(update).toHaveBeenCalledWith({ id: ID }, { lastTriggeredAt: new Date(STARTED_AT) });
		expect(stored?.lastRunStatus).toBeNull();
	});

	it('keeps the writes in the order the runs reported them', async () => {
		service.runParked(record('running'));
		service.runEnded(record('cancelled'));
		service.runEnded(record('completed', { id: 'run-2', startedAt: STARTED_AT + 1000 }));
		await service.settled();

		expect(update).toHaveBeenCalledTimes(3);
		expect(stored).toMatchObject({
			lastRunStatus: AutomationRunStatus.COMPLETED,
			lastTriggeredAt: new Date(STARTED_AT + 1000),
		});
	});

	it('keeps the newest trigger time when parallel runs end out of the order they started in', async () => {
		const older = record('completed', { id: 'run-1', startedAt: STARTED_AT });
		const newer = record('failed', { id: 'run-2', startedAt: STARTED_AT + 1000 });

		// Run 2 started later and ended first
		service.runEnded(newer);
		service.runEnded(older);
		await service.settled();

		expect(update).toHaveBeenNthCalledWith(
			1,
			{ id: ID },
			{ lastTriggeredAt: new Date(STARTED_AT + 1000), lastRunStatus: AutomationRunStatus.FAILED },
		);
		expect(update).toHaveBeenNthCalledWith(2, { id: ID }, { lastRunStatus: AutomationRunStatus.COMPLETED });
		expect(stored).toMatchObject({
			lastTriggeredAt: new Date(STARTED_AT + 1000),
			lastRunStatus: AutomationRunStatus.COMPLETED,
		});
	});

	it('does not move the trigger time back when an older run parks late, and compares a stored string', async () => {
		stored = { ...stored, lastTriggeredAt: new Date(STARTED_AT + 1000).toISOString() };

		service.runParked(record('running'));
		await service.settled();

		expect(update).not.toHaveBeenCalled();
		expect(emit).not.toHaveBeenCalled();
	});

	it('announces nothing for an automation that was deleted meanwhile', async () => {
		stored = null;

		service.runEnded(record('completed'));
		await service.settled();

		expect(emit).not.toHaveBeenCalled();
	});

	it('survives a write that fails and carries on with the next one', async () => {
		update.mockRejectedValueOnce(new Error('SQLITE_BUSY'));

		service.runEnded(record('failed'));
		service.runEnded(record('completed', { id: 'run-2' }));
		await service.settled();

		expect(stored?.lastRunStatus).toBe(AutomationRunStatus.COMPLETED);
		expect(emit).toHaveBeenCalledTimes(1);
	});

	describe('run history', () => {
		const step = (overrides: Partial<RunStep> = {}): RunStep => ({
			seq: 1,
			at: STARTED_AT + 5,
			elapsedMs: 5,
			nodeId: 'a',
			type: 'test.action',
			kind: 'action',
			via: 'e1',
			state: 'done',
			output: 'done',
			result: { success: true },
			...overrides,
		});

		const finished = (status: RunStatus, overrides: Partial<RunRecord> = {}): RunRecord =>
			record(status, { finishedAt: STARTED_AT + 40, durationMs: 40, steps: [step()], ...overrides });

		const events = (type: EventType): unknown[] =>
			(emit.mock.calls as [string, unknown][])
				.filter(([event]) => event === (type as string))
				.map(([, payload]) => payload);

		it('announces a run when it starts and writes nothing', async () => {
			service.runStarted(record('running'));
			await service.settled();

			expect(events(EventType.RUN_STARTED)).toEqual([
				{
					id: 'run-1',
					automation_id: ID,
					revision: 4,
					status: 'running',
					trigger_node_id: 't',
					manual: false,
					started_at: new Date(STARTED_AT).toISOString(),
					finished_at: null,
					duration_ms: null,
					end_reason: null,
				},
			]);
			expect(history.store).not.toHaveBeenCalled();
			expect(update).not.toHaveBeenCalled();
		});

		it('stores a run that never parked once, when its trace is complete, and announces it', async () => {
			const run = finished('completed');

			service.runStarted(run);
			service.runEnded(run);
			await service.settled();

			expect(history.store).not.toHaveBeenCalled();

			service.runSettled(run);
			await service.settled();

			expect(history.store).toHaveBeenCalledTimes(1);
			expect(rows[0]).toEqual({
				id: 'run-1',
				automationId: ID,
				revision: 4,
				status: 'completed',
				triggerNodeId: 't',
				manual: false,
				startedAt: new Date(STARTED_AT),
				finishedAt: new Date(STARTED_AT + 40),
				durationMs: 40,
				endReason: null,
				trace: {
					trigger: { node_id: 't', manual: false, data: {} },
					steps: [
						{
							seq: 1,
							at: new Date(STARTED_AT + 5).toISOString(),
							elapsed_ms: 5,
							node_id: 'a',
							type: 'test.action',
							kind: 'action',
							via: 'e1',
							state: 'done',
							output: 'done',
							result: { success: true },
						},
					],
					truncated: false,
				},
			});
			expect(events(EventType.RUN_COMPLETED)).toEqual([
				expect.objectContaining({ id: 'run-1', automation_id: ID, status: 'completed', duration_ms: 40 }),
			]);
		});

		it('writes the marker of a run when it parks, with the trace up to there', async () => {
			const run = record('running', {
				steps: [step({ kind: 'flow', state: 'parked', output: undefined, result: undefined, delayMs: 60_000 })],
			});

			service.runParked(run);

			// What happens to the run after it parked is not part of the marker
			run.steps[0].state = 'done';
			run.status = 'completed';

			await service.settled();

			expect(rows).toHaveLength(1);
			expect(rows[0]).toMatchObject({
				id: 'run-1',
				status: 'running',
				finishedAt: null,
				durationMs: null,
				trace: { steps: [{ node_id: 'a', state: 'parked', delay_ms: 60_000 }] },
			});
			expect(events(EventType.RUN_COMPLETED)).toEqual([]);
		});

		it('rewrites the marker when the parked run ends', async () => {
			const run = record('running');

			service.runParked(run);
			Object.assign(run, {
				status: 'cancelled',
				endReason: 'restarted',
				finishedAt: STARTED_AT + 900,
				durationMs: 900,
			});
			service.runEnded(run);
			service.runSettled(run);
			await service.settled();

			expect(rows.map((row) => [row.id, row.status, row.endReason])).toEqual([
				['run-1', 'running', null],
				['run-1', 'cancelled', 'restarted'],
			]);
		});

		it('rewrites the marker every time the run parks, so it shows the Delay the run is parked on now', async () => {
			const run = record('running', {
				steps: [step({ nodeId: 'one', kind: 'flow', state: 'parked', output: undefined, result: undefined })],
			});

			service.runParked(run);
			await service.settled();

			// The first Delay lets the run go on, and the second one parks it again
			run.steps[0].state = 'done';
			run.steps.push(
				step({ seq: 2, nodeId: 'two', kind: 'flow', state: 'parked', output: undefined, result: undefined }),
			);
			service.runParked(run);
			await service.settled();

			expect(history.store).toHaveBeenCalledTimes(2);
			expect(rows[1]).toMatchObject({
				status: 'running',
				trace: {
					steps: [
						{ node_id: 'one', state: 'done' },
						{ node_id: 'two', state: 'parked' },
					],
				},
			});
			// The automation was written when the run first parked; a later park only stores the marker
			expect(update).toHaveBeenCalledTimes(1);
		});

		it('keeps no run of an automation that was deleted meanwhile, and still says that the run is over', async () => {
			stored = null;

			service.runParked(record('running'));
			service.runSettled(finished('cancelled'));
			await service.settled();

			expect(history.store).not.toHaveBeenCalled();
			expect(events(EventType.RUN_COMPLETED)).toHaveLength(1);
		});

		it('says that a run is over even when it could not be stored, and carries on', async () => {
			history.store.mockRejectedValueOnce(new Error('SQLITE_FULL'));

			service.runSettled(finished('completed'));
			service.runSettled(finished('failed', { id: 'run-2' }));
			await service.settled();

			expect(events(EventType.RUN_COMPLETED)).toHaveLength(2);
			expect(rows.map((row) => row.id)).toEqual(['run-2']);
		});

		it('flushes a run that ended while one of its nodes is still executing, and writes it again when it settles', async () => {
			const run = finished('interrupted', { endReason: 'engine_stopped', steps: [] });

			service.runEnded(run);
			service.flush();
			await service.settled();

			expect(rows).toHaveLength(1);
			expect(rows[0]).toMatchObject({ status: 'interrupted', endReason: 'engine_stopped', trace: { steps: [] } });

			// Nothing is left to flush
			service.flush();
			await service.settled();

			expect(rows).toHaveLength(1);

			run.steps.push(step({ afterCancel: true }));
			service.runSettled(run);
			await service.settled();

			expect(rows).toHaveLength(2);
			expect(rows[1].trace.steps).toEqual([expect.objectContaining({ node_id: 'a', after_cancel: true })]);
			// The run was announced as over when it was flushed, and only then
			expect(events(EventType.RUN_COMPLETED)).toEqual([
				expect.objectContaining({ id: 'run-1', status: 'interrupted' }),
			]);
		});

		it('does not flush a run whose trace is complete', async () => {
			const run = finished('completed');

			service.runEnded(run);
			service.runSettled(run);
			service.flush();
			await service.settled();

			expect(history.store).toHaveBeenCalledTimes(1);
		});

		it('waits for a write that was asked for while it was waiting', async () => {
			const run = finished('cancelled');

			service.runEnded(run);

			const waiting = service.settled();

			// As the walker does for a cancelled run: the trace is complete a moment after the run ended
			await Promise.resolve();
			service.runSettled(run);
			await waiting;

			expect(history.store).toHaveBeenCalledTimes(1);
		});

		describe('runs a restart cut off', () => {
			it('ends them and the last run status of their automation', async () => {
				stored = { ...stored, lastTriggeredAt: new Date(STARTED_AT), lastRunStatus: null };
				leftover = [{ id: 'run-1', automationId: ID, startedAt: new Date(STARTED_AT) }];

				await expect(service.interruptLeftoverRuns()).resolves.toBe(1);

				expect(history.interruptRunning).toHaveBeenCalledTimes(1);
				expect(update).toHaveBeenCalledWith({ id: ID }, { lastRunStatus: AutomationRunStatus.INTERRUPTED });
				expect(emit).not.toHaveBeenCalled();
			});

			it('leaves the last run status alone when a later run has ended since', async () => {
				stored = {
					...stored,
					lastTriggeredAt: new Date(STARTED_AT + 60_000),
					lastRunStatus: AutomationRunStatus.COMPLETED,
				};
				leftover = [{ id: 'run-1', automationId: ID, startedAt: new Date(STARTED_AT).toISOString() }];

				await expect(service.interruptLeftoverRuns()).resolves.toBe(1);

				expect(update).not.toHaveBeenCalled();
			});

			it('does nothing when no run was left running, and survives a history that can not be read', async () => {
				await expect(service.interruptLeftoverRuns()).resolves.toBe(0);

				history.interruptRunning.mockRejectedValueOnce(new Error('SQLITE_ERROR: no such table'));

				await expect(service.interruptLeftoverRuns()).resolves.toBe(0);
				expect(update).not.toHaveBeenCalled();
			});
		});

		it('removes expired runs behind the writes that are waiting, and survives a failure', async () => {
			history.pruneExpired.mockResolvedValueOnce(3).mockRejectedValueOnce(new Error('SQLITE_BUSY'));

			service.pruneExpiredRuns();
			service.pruneExpiredRuns();
			await service.settled();

			expect(history.pruneExpired).toHaveBeenCalledTimes(2);
		});

		it('passes every step to the listener that is set, and to nobody otherwise', () => {
			const run = finished('running');
			const seen: [RunRecord, RunStep][] = [];

			service.runStep(run, run.steps[0]);
			service.setStepListener((stepRecord, stepped) => seen.push([stepRecord, stepped]));
			service.runStep(run, run.steps[0]);
			service.setStepListener(undefined);
			service.runStep(run, run.steps[0]);

			expect(seen).toEqual([[run, run.steps[0]]]);
		});
	});
});
