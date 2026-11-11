import { Repository } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { AutomationRunStatus, EventType } from '../automations.constants';
import { RunRecord, RunStatus } from '../engine/run-walker';
import { AutomationEntity } from '../entities/automations.entity';

import { AutomationRunService } from './automation-run.service';

describe('AutomationRunService', () => {
	const ID = '11111111-1111-4111-8111-111111111111';
	const STARTED_AT = Date.UTC(2026, 10, 11, 7, 30);

	let stored: Partial<AutomationEntity> | null;
	let update: jest.Mock;
	let emit: jest.Mock;
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

		service = new AutomationRunService(
			{
				update,
				findOne: jest.fn(() => Promise.resolve(stored ? { ...stored } : null)),
				findOneBy: jest.fn(() => Promise.resolve(stored)),
			} as unknown as Repository<AutomationEntity>,
			{ emit } as unknown as EventEmitter2,
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

	it('writes nothing when the trace of a run is complete', async () => {
		service.runSettled(record('completed'));
		await service.settled();

		expect(update).not.toHaveBeenCalled();
	});
});
