import { randomUUID } from 'node:crypto';
import { EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';

import { SchedulerRegistry } from '@nestjs/schedule';

import { domainResult } from '../activity/activity-result.utils';
import { ActivityDomain, ActivityDomainStatus, ActivityMode } from '../activity/space-activity.constants';
import { SpaceOccupancyEntity } from '../entities/space-occupancy.entity';
import { OccupancyStatus } from '../occupancy/space-occupancy.types';

import { activityTestDatabase, deferred } from './activity-test-support';
import { SpaceModeService } from './space-mode.service';
import { SpaceOccupancyConfigService } from './space-occupancy-config.service';
import { SpaceOccupancyInputsService } from './space-occupancy-inputs.service';
import { SpaceOccupancyService } from './space-occupancy.service';

jest.setTimeout(30_000);

describe('occupancy through original SQLite activity admission', () => {
	let h: Awaited<ReturnType<typeof activityTestDatabase>>;
	let configs: SpaceOccupancyConfigService;
	let runtime: SpaceOccupancyService;
	let modes: SpaceModeService;
	let input: OccupancyStatus;
	let live: boolean;
	let tick: number;
	let inputs: { list: jest.Mock; capture: jest.Mock };
	let run: jest.Mock;
	const sensor = randomUUID();
	const advance = (ms: number) => {
		tick += ms;
		jest.setSystemTime(Date.now() + ms);
	};
	const get = () => configs.get(h.room.id);
	const save = async (occupiedMode: ActivityMode | null = ActivityMode.WORK) =>
		configs.update(h.room.id, {
			expectedRevision: (await get()).revision,
			enabled: true,
			vacancyTimeoutSeconds: 30,
			maximumAgeSeconds: 120,
			sensorPropertyIds: [sensor],
			occupiedMode,
			vacantMode: ActivityMode.AWAY,
		});
	beforeEach(async () => {
		h = await activityTestDatabase();
		input = OccupancyStatus.UNKNOWN;
		live = true;
		tick = 0;
		inputs = {
			list: jest.fn(() => Promise.resolve([{ propertyId: sensor, deviceId: randomUUID(), label: 'Motion' }])),
			capture: jest.fn(() => {
				const status = input;
				return Promise.resolve({ status, isCurrent: () => live && input === status });
			}),
		};
		configs = new SpaceOccupancyConfigService(
			h.database,
			h.configs,
			h.lifecycle,
			inputs as unknown as SpaceOccupancyInputsService,
			h.events,
		);
		configs.onModuleInit();
		await h.database.transaction((manager) => h.lifecycle.reconcile(h.room, manager));
		run = jest.fn((domain: ActivityDomain) =>
			Promise.resolve(domainResult(domain, ActivityDomainStatus.NO_TARGETS, 'test')),
		);
		modes = new SpaceModeService(h.database, h.configs, { run } as never, h.events, undefined, undefined, configs);
		runtime = new SpaceOccupancyService(
			h.database,
			configs,
			inputs as unknown as SpaceOccupancyInputsService,
			h.configs,
			modes,
			new SchedulerRegistry(),
			() => tick,
		);
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'performance', 'hrtime'] });
		jest.setSystemTime(new Date('2026-11-02T12:00:00Z'));
		await runtime.start();
	});
	afterEach(async () => {
		await runtime.stop();
		configs.onModuleDestroy();
		h.configs.onModuleDestroy();
		jest.useRealTimers();
		await h.database.destroy();
	});
	it('starts dormant, validates CAS and foreign sensors, and saving never activates a mode', async () => {
		expect(await get()).toMatchObject({ enabled: false, sensorPropertyIds: [], vacancyTimeoutSeconds: 900 });
		await save();
		expect(run).not.toHaveBeenCalled();
		await expect(configs.update(h.room.id, { ...(await get()), expectedRevision: 1 })).rejects.toThrow();
		await expect(
			configs.update(h.room.id, { ...(await get()), expectedRevision: 2, sensorPropertyIds: [randomUUID()] }),
		).rejects.toThrow('sensor');
	});
	it('goes occupied, waits the full vacancy delay, activates once and restores the prior mode', async () => {
		await modes.activateMode(h.room.id, ActivityMode.WORK, 1, 'user');
		await save(null);
		await configs.clearManual(h.room.id, (await get()).revision);
		input = OccupancyStatus.OCCUPIED;
		await runtime.runCycle();
		expect((await modes.getActiveMode(h.room.id))?.selectedActivityMode).toBe(ActivityMode.WORK);
		input = OccupancyStatus.VACANT;
		await runtime.runCycle();
		advance(29_999);
		await runtime.runCycle();
		expect((await modes.getActiveMode(h.room.id))?.selectedActivityMode).toBe(ActivityMode.WORK);
		advance(1);
		await runtime.runCycle();
		expect((await modes.getActiveMode(h.room.id))?.selectedActivityMode).toBe(ActivityMode.AWAY);
		const calls = run.mock.calls.length;
		await runtime.runCycle();
		expect(run).toHaveBeenCalledTimes(calls);
		input = OccupancyStatus.OCCUPIED;
		await runtime.runCycle();
		expect((await modes.getActiveMode(h.room.id))?.selectedActivityMode).toBe(ActivityMode.WORK);
	});
	it('unknown input resets vacancy time; startup never carries an elapsed timeout', async () => {
		await save();
		input = OccupancyStatus.VACANT;
		await runtime.runCycle();
		advance(29_000);
		input = OccupancyStatus.UNKNOWN;
		await runtime.runCycle();
		advance(50_000);
		input = OccupancyStatus.VACANT;
		await runtime.runCycle();
		expect(run).not.toHaveBeenCalled();
		await runtime.stop();
		await runtime.start();
		advance(60_000);
		await runtime.runCycle();
		expect(run).not.toHaveBeenCalled();
		advance(30_000);
		await runtime.runCycle();
		expect((await modes.getActiveMode(h.room.id))?.selectedActivityMode).toBe(ActivityMode.AWAY);
	});
	it('manual selection and clear pause automation until explicit revision-checked resume', async () => {
		await save();
		await modes.activateMode(h.room.id, ActivityMode.RELAX, 1, 'user');
		expect((await get()).manualOverride).toBe(true);
		input = OccupancyStatus.VACANT;
		await runtime.runCycle();
		advance(60_000);
		await runtime.runCycle();
		expect((await modes.getActiveMode(h.room.id))?.selectedActivityMode).toBe(ActivityMode.RELAX);
		await configs.clearManual(h.room.id, (await get()).revision);
		input = OccupancyStatus.OCCUPIED;
		await runtime.runCycle();
		expect((await modes.getActiveMode(h.room.id))?.selectedActivityMode).toBe(ActivityMode.WORK);
		const activity = await modes.getActiveMode(h.room.id);
		await modes.deactivateMode(h.room.id, activity.activationId, 'user');
		expect((await get()).manualOverride).toBe(true);
	});
	it('restores an empty previous selection without creating a manual override', async () => {
		await save(null);
		input = OccupancyStatus.VACANT;
		await runtime.runCycle();
		advance(30_000);
		await runtime.runCycle();
		expect((await modes.getActiveMode(h.room.id))?.selectedActivityMode).toBe(ActivityMode.AWAY);
		input = OccupancyStatus.OCCUPIED;
		await runtime.runCycle();
		expect((await modes.getActiveMode(h.room.id))?.selectedActivityMode).toBeNull();
		expect((await get()).manualOverride).toBe(false);
	});
	it('rejects a stale resume after a newer manual selection', async () => {
		await save();
		await modes.activateMode(h.room.id, ActivityMode.WORK, 1, 'first-user');
		const held = await get();
		await modes.activateMode(h.room.id, ActivityMode.RELAX, 1, 'second-user');
		await expect(configs.clearManual(h.room.id, held.revision)).rejects.toThrow('revision');
		expect((await get()).manualOverride).toBe(true);
		await configs.clearManual(h.room.id, (await get()).revision);
		expect((await get()).manualOverride).toBe(false);
	});
	it('a stale asynchronous observation cannot activate after disable', async () => {
		await save();
		input = OccupancyStatus.OCCUPIED;
		const gate = deferred<void>();
		const entered = deferred<void>();
		inputs.capture.mockImplementationOnce(async () => {
			entered.resolve();
			await gate.promise;
			return { status: input, isCurrent: () => live };
		});
		const check = runtime.runCycle();
		await entered.promise;
		await h.database
			.getRepository(SpaceOccupancyEntity)
			.update({ spaceId: h.room.id }, { enabled: false, revision: 3 });
		gate.resolve();
		await check;
		expect(run).not.toHaveBeenCalled();
	});
	it('native COMMIT refuses input invalidation during the activity write', async () => {
		await save();
		input = OccupancyStatus.OCCUPIED;
		const invalidate = (event: InsertEvent<unknown> | UpdateEvent<unknown>) => {
			if (event.metadata.tableName === 'spaces_module_space_roles') live = false;
		};
		const subscriber: EntitySubscriberInterface = { afterInsert: invalidate, afterUpdate: invalidate };
		h.database.subscribers.push(subscriber);
		await runtime.runCycle();
		expect(run).not.toHaveBeenCalled();
		expect(await modes.getActiveMode(h.room.id)).toBeNull();
		expect((await get()).lastAttemptStatus).toBe('failed');
	});
});
