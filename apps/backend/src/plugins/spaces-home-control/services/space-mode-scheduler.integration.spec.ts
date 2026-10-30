import { randomUUID } from 'node:crypto';
import { EntitySubscriberInterface, InsertEvent, TransactionCommitEvent } from 'typeorm';

import { SchedulerRegistry } from '@nestjs/schedule';

import { ConfigService } from '../../../modules/config/services/config.service';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { domainResult } from '../activity/activity-result.utils';
import { ActivityDomain, ActivityDomainStatus, ActivityMode } from '../activity/space-activity.constants';
import { RoomSpaceEntity } from '../entities/room-space.entity';
import { SpaceActivityStateEntity } from '../entities/space-activity-state.entity';
import { SpaceModeScheduleEntity } from '../entities/space-mode-schedule.entity';
import { ScheduleRuntimeStatus } from '../models/space-mode-schedule.model';
import { ScheduleEntry } from '../schedule/space-mode-schedule.types';

import { activityTestDatabase, deferred } from './activity-test-support';
import { SpaceModeScheduleConfigService } from './space-mode-schedule-config.service';
import { SpaceModeSchedulerService } from './space-mode-scheduler.service';
import { SpaceModeService } from './space-mode.service';

jest.setTimeout(30_000);

describe('durable space scheduling through the real activity admission', () => {
	let h: Awaited<ReturnType<typeof activityTestDatabase>>;
	let schedules: SpaceModeScheduleConfigService;
	let scheduler: SpaceModeSchedulerService;
	let jobs: SchedulerRegistry;
	let modes: SpaceModeService;
	let run: jest.Mock;
	let readConfig: jest.Mock;
	const clock = (iso: string) => jest.setSystemTime(new Date(iso));
	const entry = (time: string, mode = ActivityMode.WORK): ScheduleEntry => ({
		id: randomUUID(),
		mode,
		time,
		days_of_week: [0, 1, 2, 3, 4, 5, 6],
		enabled: true,
	});
	const save = async (entries: ScheduleEntry[], timezone = 'UTC') => {
		const current = await schedules.get(h.room.id);
		return schedules.update(h.room.id, { expected_revision: current.revision, enabled: true, timezone, entries });
	};
	beforeEach(async () => {
		h = await activityTestDatabase();
		run = jest.fn((domain: ActivityDomain) =>
			Promise.resolve(domainResult(domain, ActivityDomainStatus.NO_TARGETS, 'test')),
		);
		modes = new SpaceModeService(h.database, h.configs, { run } as never, h.events);
		readConfig = jest.fn(() => ({ timezone: 'UTC' }));
		schedules = new SpaceModeScheduleConfigService(
			h.database,
			h.configs,
			h.lifecycle,
			{ getModuleConfig: readConfig } as unknown as ConfigService,
			h.events,
		);
		schedules.onModuleInit();
		await h.database.transaction((manager) => h.lifecycle.reconcile(h.room, manager));
		jobs = new SchedulerRegistry();
		scheduler = new SpaceModeSchedulerService(h.database, schedules, modes, jobs, h.events);
		jest.useFakeTimers({
			doNotFake: [
				'nextTick',
				'setImmediate',
				'clearImmediate',
				'setTimeout',
				'clearTimeout',
				'performance',
				'hrtime',
				'queueMicrotask',
			],
		});
		clock('2026-11-02T08:59:00Z');
		await scheduler.start();
	});
	afterEach(async () => {
		await scheduler.stop();
		schedules.onModuleDestroy();
		jest.restoreAllMocks();
		jest.useRealTimers();
		await h.database.destroy();
	});

	it('aligns its managed job to wall-minute boundaries and removes it on stop', async () => {
		await scheduler.stop();
		clock('2026-11-02T08:59:47Z');
		await scheduler.start();
		expect(jobs.getCronJob('spaceModeSchedules').nextDate().toJSDate().toISOString()).toBe('2026-11-02T09:00:00.000Z');
		expect(await scheduler.isHealthy()).toBe(true);
		await scheduler.stop();
		expect(jobs.getCronJobs().size).toBe(0);
	});

	it('refuses duplicate startup before touching the existing job or its durable occurrence claim', async () => {
		const originalJob = jobs.getCronJob('spaceModeSchedules');
		await h.database
			.getRepository(SpaceModeScheduleEntity)
			.update(
				{ spaceId: h.room.id },
				{ cursor: Date.parse('2026-11-02T08:58:00Z'), pendingOccurrenceId: randomUUID(), lastAttemptStatus: 'claimed' },
			);
		const original = await schedules.get(h.room.id);
		const duplicate = new SpaceModeSchedulerService(h.database, schedules, modes, jobs, h.events);
		try {
			await expect(duplicate.start()).rejects.toThrow();
			expect(jobs.getCronJob('spaceModeSchedules')).toBe(originalJob);
			expect(await schedules.get(h.room.id)).toEqual(original);
			await duplicate.stop();
			expect(jobs.getCronJob('spaceModeSchedules')).toBe(originalJob);
			expect(await scheduler.isHealthy()).toBe(true);
		} finally {
			await duplicate.stop();
		}
	});

	it('starts disabled, saves a weekly plan with CAS, and does not activate on save', async () => {
		expect(await schedules.get(h.room.id)).toMatchObject({ enabled: false, entries: [], revision: 1 });
		const saved = await save([entry('09:00')]);
		expect(saved).toMatchObject({ enabled: true, revision: 2 });
		await expect(
			schedules.update(h.room.id, { expected_revision: 1, enabled: false, timezone: 'UTC', entries: [] }),
		).rejects.toThrow('revision');
		expect(run).not.toHaveBeenCalled();
	});

	it('activates one real occurrence once despite duplicate and concurrent ticks', async () => {
		await save([entry('09:00')]);
		clock('2026-11-02T09:00:10Z');
		await Promise.all([scheduler.runCycle(), scheduler.runCycle()]);
		await scheduler.runCycle();
		expect(run).toHaveBeenCalledTimes(5);
		expect((await modes.getActiveMode(h.room.id)).activityActor).toMatch(/^schedule:/);
		expect(await modes.getActiveMode(h.room.id)).toMatchObject({
			selectedActivityMode: ActivityMode.WORK,
		});
		expect(await scheduler.getScheduleState(h.room.id)).toMatchObject({
			manual_override: false,
			last_attempt_status: 'started',
		});
	});

	it('keeps house-timezone read failures unavailable without consuming or activating the due minute', async () => {
		await save([entry('09:00')]);
		await h.database.getRepository(SpaceModeScheduleEntity).update({ spaceId: h.room.id }, { timezone: null });
		const before = await schedules.get(h.room.id);
		readConfig.mockImplementation(() => {
			throw new Error('Configuration unavailable');
		});
		clock('2026-11-02T09:00:01Z');
		await scheduler.runCycle();
		expect(run).not.toHaveBeenCalled();
		expect((await schedules.get(h.room.id)).cursor).toBe(before.cursor);
		expect(await scheduler.getScheduleState(h.room.id)).toMatchObject({
			status: 'unavailable',
			timezone: null,
			current: null,
			next: null,
		});
		readConfig.mockReturnValue({ timezone: 'UTC' });
		await scheduler.runCycle();
		expect(run).toHaveBeenCalledTimes(5);
		expect(await scheduler.getScheduleState(h.room.id)).toMatchObject({
			status: 'running',
			timezone: 'UTC',
			last_attempt_status: 'started',
		});
	});

	it('lets a later room trigger while original work is pending, skips only that room, and joins it on stop', async () => {
		const rooms = h.database.getRepository(RoomSpaceEntity);
		const room = await rooms.save(rooms.create({ name: 'Second room' }));
		await h.database.transaction((manager) => h.lifecycle.reconcile(room, manager));
		await save([entry('09:00'), entry('09:01')]);
		await schedules.update(room.id, {
			expected_revision: 1,
			enabled: true,
			timezone: 'UTC',
			entries: [entry('09:01')],
		});
		const entered = deferred<void>(),
			release = deferred<void>();
		run.mockImplementation(async (domain: ActivityDomain, _config: unknown, _identity: unknown, spaceId: string) => {
			if (spaceId === h.room.id) {
				entered.resolve();
				await release.promise;
			}
			return domainResult(domain, ActivityDomainStatus.NO_TARGETS, 'test');
		});
		let stopped: Promise<void> | undefined;
		try {
			clock('2026-11-02T09:00:01Z');
			await jobs.getCronJob('spaceModeSchedules').fireOnTick();
			await entered.promise;
			expect(run).toHaveBeenCalledTimes(5);
			clock('2026-11-02T09:01:01Z');
			await scheduler.runCycle();
			expect(run).toHaveBeenCalledTimes(10);
			expect((await modes.getActiveMode(room.id)).activityActor).toMatch(/^schedule:/);
			expect(await scheduler.isHealthy()).toBe(true);
			await scheduler.runCycle();
			expect(run).toHaveBeenCalledTimes(10);
			let joined = false;
			stopped = scheduler.stop().then(() => {
				joined = true;
			});
			await Promise.resolve();
			expect(joined).toBe(false);
		} finally {
			release.resolve();
			await stopped;
		}
		expect(jobs.getCronJobs().size).toBe(0);
	});

	it('retains manual selection until the next future trigger', async () => {
		await save([entry('09:00'), entry('18:00', ActivityMode.AWAY)]);
		clock('2026-11-02T09:00:05Z');
		await scheduler.runCycle();
		clock('2026-11-02T10:00:00Z');
		await modes.activateMode(h.room.id, ActivityMode.RELAX, 1, 'user:operator');
		expect(await scheduler.getScheduleState(h.room.id)).toMatchObject({ manual_override: true });
		clock('2026-11-02T17:00:00Z');
		await scheduler.runCycle();
		expect((await modes.getActiveMode(h.room.id)).selectedActivityMode).toBe(ActivityMode.RELAX);
		clock('2026-11-02T18:00:02Z');
		await scheduler.runCycle();
		expect((await modes.getActiveMode(h.room.id)).selectedActivityMode).toBe(ActivityMode.AWAY);
		expect((await scheduler.getScheduleState(h.room.id)).manual_override).toBe(false);
	});

	it('does not let a late tick replace a manual request made after the nominal trigger', async () => {
		await save([entry('09:00')]);
		clock('2026-11-02T09:00:10Z');
		await modes.activateMode(h.room.id, ActivityMode.RELAX, 1, 'display:operator');
		clock('2026-11-02T09:00:20Z');
		await scheduler.runCycle();
		expect(run).toHaveBeenCalledTimes(5);
		expect((await modes.getActiveMode(h.room.id)).selectedActivityMode).toBe(ActivityMode.RELAX);
		expect(await scheduler.getScheduleState(h.room.id)).toMatchObject({
			manual_override: true,
			last_attempt_status: 'conflict',
		});
	});

	it('fences a reserved occurrence when a manual selection wins the asynchronous lookup', async () => {
		await save([entry('09:00')]);
		clock('2026-11-02T09:00:01Z');
		const started = deferred<void>(),
			finish = deferred<void>();
		const available = (id: string) => h.configs.list(id);
		jest.spyOn(modes, 'getAvailableModes').mockImplementationOnce(async (id) => {
			started.resolve();
			await finish.promise;
			return available(id);
		});
		const cycle = scheduler.runCycle();
		await started.promise;
		clock('2026-11-02T09:00:02Z');
		await modes.activateMode(h.room.id, ActivityMode.SLEEP, 1, 'user:newer');
		finish.resolve();
		await cycle;
		expect(run).toHaveBeenCalledTimes(5);
		expect((await modes.getActiveMode(h.room.id)).selectedActivityMode).toBe(ActivityMode.SLEEP);
	});

	it.each(['disable', 'delete', 'stop'] as const)('refuses a reserved occurrence after %s', async (kind) => {
		await save([entry('09:00')]);
		clock('2026-11-02T09:00:01Z');
		const started = deferred<void>(),
			finish = deferred<void>();
		const available = (id: string) => h.configs.list(id);
		jest.spyOn(modes, 'getAvailableModes').mockImplementationOnce(async (id) => {
			started.resolve();
			await finish.promise;
			return available(id);
		});
		const cycle = scheduler.runCycle();
		await started.promise;
		let stopped: Promise<void> | undefined;
		if (kind === 'disable') {
			const row = await schedules.get(h.room.id);
			await schedules.update(h.room.id, {
				expected_revision: row.revision,
				enabled: false,
				timezone: row.timezone,
				entries: row.entries,
			});
		} else if (kind === 'delete') await h.database.manager.delete(SpaceEntity, { id: h.room.id });
		else {
			stopped = scheduler.stop();
			await Promise.resolve();
		}
		finish.resolve();
		await cycle;
		await stopped;
		expect(run).not.toHaveBeenCalled();
	});

	it('evaluates the current plan on restart without replaying missed activation', async () => {
		await save([entry('09:00'), entry('18:00', ActivityMode.AWAY)]);
		await scheduler.stop();
		clock('2026-11-02T12:00:00Z');
		await scheduler.start();
		await scheduler.runCycle();
		expect(await scheduler.getScheduleState(h.room.id)).toMatchObject({
			current: { mode: ActivityMode.WORK },
			next: { mode: ActivityMode.AWAY },
		});
		expect(run).not.toHaveBeenCalled();
		clock('2026-11-02T18:00:01Z');
		await scheduler.runCycle();
		expect(run).toHaveBeenCalledTimes(5);
	});

	it('deduplicates an autumn fold and inhibits a backward clock without erasing its watermark', async () => {
		await scheduler.stop();
		clock('2026-10-25T00:29:00Z');
		await scheduler.start();
		// A new fixture date precedes the default startup watermark, so set up a fresh dormant row.
		await h.database
			.getRepository(SpaceModeScheduleEntity)
			.update({ spaceId: h.room.id }, { cursor: Date.parse('2026-10-25T00:29:00Z') });
		await save([entry('02:30')], 'Europe/Prague');
		clock('2026-10-25T00:30:01Z');
		await scheduler.runCycle();
		clock('2026-10-25T01:30:01Z');
		await scheduler.runCycle();
		expect(run).toHaveBeenCalledTimes(5);
		clock('2026-10-25T00:30:02Z');
		await scheduler.runCycle();
		expect(run).toHaveBeenCalledTimes(5);
		expect((await scheduler.getScheduleState(h.room.id)).status).toBe(ScheduleRuntimeStatus.CLOCK_UNCERTAIN);
	});

	it('retains an explicit manual clear until the next future trigger', async () => {
		await save([entry('09:00'), entry('18:00', ActivityMode.AWAY)]);
		clock('2026-11-02T09:00:05Z');
		await scheduler.runCycle();
		const state = await modes.getActiveMode(h.room.id);
		clock('2026-11-02T10:00:00Z');
		await modes.deactivateMode(h.room.id, state.activationId, 'display:manual');
		expect((await scheduler.getScheduleState(h.room.id)).manual_override).toBe(true);
		clock('2026-11-02T17:59:00Z');
		await scheduler.runCycle();
		expect((await modes.getActiveMode(h.room.id)).selectedActivityMode).toBeNull();
		clock('2026-11-02T18:00:01Z');
		await scheduler.runCycle();
		expect((await modes.getActiveMode(h.room.id)).selectedActivityMode).toBe(ActivityMode.AWAY);
	});

	it('rolls back activity admission when its minute expires before native COMMIT', async () => {
		await save([entry('09:00')]);
		const subscriber: EntitySubscriberInterface = {
			afterInsert(event: InsertEvent<SpaceActivityStateEntity>) {
				if (event.entity instanceof SpaceActivityStateEntity) clock('2026-11-02T09:01:00Z');
			},
		};
		h.database.subscribers.push(subscriber);
		try {
			clock('2026-11-02T09:00:01Z');
			await scheduler.runCycle();
			expect(run).not.toHaveBeenCalled();
			expect(await modes.getActiveMode(h.room.id)).toBeNull();
			expect((await schedules.get(h.room.id)).lastAttemptStatus).not.toBe('started');
		} finally {
			h.database.subscribers.splice(h.database.subscribers.indexOf(subscriber), 1);
		}
	});

	it.each(['after-write', 'before-commit'] as const)(
		'refuses configuration invalidation %s and does not dispatch',
		async (phase) => {
			await save([entry('09:00')]);
			let inserted = false;
			const invalidate = async (manager: InsertEvent<SpaceActivityStateEntity>['manager']) => {
				await manager.update(SpaceModeScheduleEntity, { spaceId: h.room.id }, { enabled: false, revision: 3 });
			};
			const subscriber: EntitySubscriberInterface = {
				async afterInsert(event: InsertEvent<SpaceActivityStateEntity>) {
					if (!(event.entity instanceof SpaceActivityStateEntity)) return;
					inserted = true;
					if (phase === 'after-write') await invalidate(event.manager);
				},
				async beforeTransactionCommit(event: TransactionCommitEvent) {
					if (phase !== 'before-commit' || !inserted) return;
					inserted = false;
					try {
						await invalidate(event.manager);
					} catch {
						/* Refusal stays attached to the original native operation. */
					}
				},
			};
			h.database.subscribers.push(subscriber);
			try {
				clock('2026-11-02T09:00:01Z');
				await scheduler.runCycle();
				expect(run).not.toHaveBeenCalled();
				expect(await modes.getActiveMode(h.room.id)).toBeNull();
				expect(await schedules.get(h.room.id)).toMatchObject({ enabled: true, revision: 2 });
			} finally {
				h.database.subscribers.splice(h.database.subscribers.indexOf(subscriber), 1);
			}
		},
	);

	it('rejects ambiguous overlapping entries and invalid timezones before persistence', async () => {
		await expect(save([entry('09:00'), entry('09:00', ActivityMode.SLEEP)])).rejects.toThrow('same local trigger');
		await expect(save([entry('09:00')], 'not/a-zone')).rejects.toThrow('timezone');
		expect((await schedules.get(h.room.id)).revision).toBe(1);
	});
});
