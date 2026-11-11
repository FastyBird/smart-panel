import { DataSource, Repository } from 'typeorm';

import {
	AUTOMATION_RUNS_KEPT_PER_AUTOMATION,
	AUTOMATION_RUNS_RETENTION_DAYS,
	AutomationRunRecordStatus,
} from '../automations.constants';
import { RunRecord, RunStatus } from '../engine/run-walker';
import { AutomationRunEntity } from '../entities/automation-runs.entity';
import { AutomationEntity } from '../entities/automations.entity';

import { AutomationRunHistoryService, createAutomationRunRow } from './automation-run-history.service';

describe('AutomationRunHistoryService', () => {
	const STARTED_AT = Date.UTC(2026, 10, 11, 7, 30);
	const DAY_IN_MS = 24 * 60 * 60 * 1000;

	let dataSource: DataSource;
	let automations: Repository<AutomationEntity>;
	let runs: Repository<AutomationRunEntity>;
	let service: AutomationRunHistoryService;
	let automationId: string;
	let otherId: string;

	const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

	const record = (n: number, status: RunStatus = 'completed', overrides: Partial<RunRecord> = {}): RunRecord => ({
		id: uuid(n),
		automationId,
		revision: 2,
		trigger: { nodeId: 't', data: { value: true }, manual: false },
		startedAt: STARTED_AT + n * 1000,
		...(status === 'running' ? {} : { finishedAt: STARTED_AT + n * 1000 + 40, durationMs: 40 }),
		status,
		steps: [
			{
				seq: 1,
				at: STARTED_AT + n * 1000 + 3,
				elapsedMs: 3,
				nodeId: 'c',
				type: 'test.condition',
				kind: 'condition',
				via: 'e1',
				state: 'done',
				output: 'no',
				observed: { value: null },
				reason: 'The device is offline.',
			},
		],
		...overrides,
	});

	const store = (n: number, status: RunStatus = 'completed', overrides: Partial<RunRecord> = {}): Promise<void> =>
		service.store(createAutomationRunRow(record(n, status, overrides)));

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [AutomationEntity, AutomationRunEntity],
			synchronize: true,
		});
		await dataSource.initialize();

		automations = dataSource.getRepository(AutomationEntity);
		runs = dataSource.getRepository(AutomationRunEntity);
		service = new AutomationRunHistoryService(runs);

		automationId = (await automations.save(automations.create({ name: 'Hallway light' }))).id;
		otherId = (await automations.save(automations.create({ name: 'Night light' }))).id;
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	it('stores a run with its trace and reads it back', async () => {
		await store(1, 'failed', { endReason: 'The run was stopped after 1000 steps.' });

		const run = await service.findOne(uuid(1));

		expect(run).toMatchObject({
			id: uuid(1),
			automationId,
			revision: 2,
			status: AutomationRunRecordStatus.FAILED,
			triggerNodeId: 't',
			manual: false,
			durationMs: 40,
			endReason: 'The run was stopped after 1000 steps.',
			trace: {
				trigger: { node_id: 't', manual: false, data: { value: true } },
				steps: [
					{
						seq: 1,
						node_id: 'c',
						kind: 'condition',
						via: 'e1',
						state: 'done',
						output: 'no',
						observed: { value: null },
						reason: 'The device is offline.',
					},
				],
				truncated: false,
			},
		});
		expect(new Date(run.startedAt).getTime()).toBe(STARTED_AT + 1000);
		expect(new Date(run.finishedAt).getTime()).toBe(STARTED_AT + 1040);
	});

	it('answers null for a run that is not stored', async () => {
		await expect(service.findOne(uuid(404))).resolves.toBeNull();
	});

	it('lists the runs of one automation newest first and without their traces', async () => {
		await store(1);
		await store(3);
		await store(2, 'cancelled');
		await store(9, 'completed', { automationId: otherId });

		const listed = await service.findAllForAutomation(automationId);

		expect(listed.map((run) => [run.id, run.status])).toEqual([
			[uuid(3), 'completed'],
			[uuid(2), 'cancelled'],
			[uuid(1), 'completed'],
		]);
		expect(listed.every((run) => (run as Partial<AutomationRunEntity>).trace === undefined)).toBe(true);
		await expect(service.findAllForAutomation(uuid(404))).resolves.toEqual([]);
	});

	it('rewrites the marker of a run that parked when the run ends', async () => {
		await store(1, 'running');

		expect(await service.findOne(uuid(1))).toMatchObject({ status: 'running', finishedAt: null, durationMs: null });

		await store(1, 'completed');

		expect(await runs.count()).toBe(1);
		expect(await service.findOne(uuid(1))).toMatchObject({ status: 'completed', durationMs: 40 });
	});

	it('keeps the last runs of an automation only, and counts every automation by itself', async () => {
		for (let n = 1; n <= AUTOMATION_RUNS_KEPT_PER_AUTOMATION + 3; n += 1) {
			await store(n);
		}

		await store(1000, 'completed', { automationId: otherId });

		const kept = await service.findAllForAutomation(automationId);

		expect(kept).toHaveLength(AUTOMATION_RUNS_KEPT_PER_AUTOMATION);
		expect(kept[0].id).toBe(uuid(AUTOMATION_RUNS_KEPT_PER_AUTOMATION + 3));
		expect(kept.at(-1)?.id).toBe(uuid(4));
		await expect(service.findAllForAutomation(otherId)).resolves.toHaveLength(1);
	});

	it('drops the oldest run whenever it was written', async () => {
		for (let n = 2; n <= AUTOMATION_RUNS_KEPT_PER_AUTOMATION + 1; n += 1) {
			await store(n);
		}

		// A run that started before all of them and ended last
		await store(1);

		const kept = await service.findAllForAutomation(automationId);

		expect(kept).toHaveLength(AUTOMATION_RUNS_KEPT_PER_AUTOMATION);
		expect(kept.map((run) => run.id)).not.toContain(uuid(1));
	});

	describe('runs a restart cut off', () => {
		it('ends every run still marked as running as interrupted, without an end time', async () => {
			await store(1, 'completed');
			await store(2, 'running');
			await store(3, 'running', { automationId: otherId });

			const interrupted = await service.interruptRunning();

			expect(interrupted.map((run) => [run.id, run.automationId, run.status, run.endReason])).toEqual([
				[uuid(2), automationId, 'interrupted', 'backend_restarted'],
				[uuid(3), otherId, 'interrupted', 'backend_restarted'],
			]);
			expect(await service.findOne(uuid(2))).toMatchObject({
				status: 'interrupted',
				endReason: 'backend_restarted',
				finishedAt: null,
				durationMs: null,
				// What the run did before it was cut off is still there
				trace: { steps: [{ node_id: 'c' }] },
			});
			expect(await service.findOne(uuid(1))).toMatchObject({ status: 'completed', endReason: null });
		});

		it('finds nothing the second time', async () => {
			await store(2, 'running');

			await service.interruptRunning();

			await expect(service.interruptRunning()).resolves.toEqual([]);
		});
	});

	it('deletes the runs that are older than the retention period', async () => {
		const now = new Date(STARTED_AT + AUTOMATION_RUNS_RETENTION_DAYS * DAY_IN_MS);

		await store(-1);
		await store(1);
		await store(2, 'running');

		await expect(service.pruneExpired(now)).resolves.toBe(1);

		expect((await service.findAllForAutomation(automationId)).map((run) => run.id)).toEqual([uuid(2), uuid(1)]);
		await expect(service.pruneExpired(now)).resolves.toBe(0);
	});

	it('loses the runs of an automation with the automation', async () => {
		await store(1);
		await store(2, 'completed', { automationId: otherId });

		await automations.delete({ id: automationId });

		expect((await runs.find()).map((run) => run.id)).toEqual([uuid(2)]);
		await expect(store(3)).rejects.toThrow(/FOREIGN KEY/);
	});

	it('clears the history', async () => {
		await store(1);

		await service.clear();

		expect(await runs.count()).toBe(0);
	});
});
