import { randomUUID } from 'node:crypto';
import { EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';

import { SchedulerRegistry } from '@nestjs/schedule';

import { AutomationActionNodeType, AutomationNodeConfig } from '../../../modules/automations/graph/node-type';
import { runContext } from '../../../modules/automations/testing/node-fixtures';
import { ConfigService } from '../../../modules/config/services/config.service';
import { domainResult } from '../activity/activity-result.utils';
import {
	ActivityActivationStatus,
	ActivityDomain,
	ActivityDomainStatus,
	ActivityMode,
} from '../activity/space-activity.constants';
import { SpaceAutomationEventsService } from '../automations/space-automation-events.service';
import { SpaceAutomationNodeTypesService } from '../automations/space-automation-node-types.service';
import { SPACE_MODE_SET_NODE_TYPE } from '../automations/space-mode-set.node-type';
import { OccupancyStatus } from '../occupancy/space-occupancy.types';
import { ScheduleEntry } from '../schedule/space-mode-schedule.types';

import { activityTestDatabase, deferred } from './activity-test-support';
import { SpaceIntentService } from './space-intent.service';
import { SpaceModeScheduleConfigService } from './space-mode-schedule-config.service';
import { SpaceModeSchedulerService } from './space-mode-scheduler.service';
import { SpaceModeService } from './space-mode.service';
import { SpaceOccupancyConfigService } from './space-occupancy-config.service';
import { SpaceOccupancyInputsService } from './space-occupancy-inputs.service';
import { SpaceOccupancyService } from './space-occupancy.service';

jest.setTimeout(30_000);

type Harness = Awaited<ReturnType<typeof activityTestDatabase>>;

const noTargets = (domain: ActivityDomain) =>
	Promise.resolve(domainResult(domain, ActivityDomainStatus.NO_TARGETS, 'test'));

/** The "Set space mode" card wired to the real mode service, as the plugin registers it */
const setModeCard = (modes: SpaceModeService, h: Harness, occupancy: SpaceOccupancyService) =>
	new SpaceAutomationNodeTypesService(
		new SpaceAutomationEventsService(),
		occupancy,
		modes,
		h.configs,
		{} as SpaceIntentService,
	)
		.create()
		.find(
			(nodeType) => nodeType.type === SPACE_MODE_SET_NODE_TYPE,
		) as unknown as AutomationActionNodeType<AutomationNodeConfig>;

describe('activity mode set by an automation, through the real SQLite admission', () => {
	describe('with occupancy', () => {
		let h: Harness;
		let configs: SpaceOccupancyConfigService;
		let runtime: SpaceOccupancyService;
		let modes: SpaceModeService;
		let run: jest.Mock;
		let input: OccupancyStatus;
		let tick: number;
		const sensor = randomUUID();

		const advance = (ms: number) => {
			tick += ms;
			jest.setSystemTime(Date.now() + ms);
		};
		const occupancy = () => configs.get(h.room.id);
		const active = () => modes.getActiveMode(h.room.id);
		const setMode = (mode: ActivityMode, runId = 'run-1') =>
			setModeCard(modes, h, runtime).execute({ space_id: h.room.id, mode }, runContext({ runId }));
		const enableOccupancy = async (occupiedMode: ActivityMode | null, vacantMode: ActivityMode | null) => {
			await configs.update(h.room.id, {
				expectedRevision: (await occupancy()).revision,
				enabled: true,
				vacancyTimeoutSeconds: 30,
				maximumAgeSeconds: 120,
				sensorPropertyIds: [sensor],
				occupiedMode,
				vacantMode,
			});
		};

		beforeEach(async () => {
			h = await activityTestDatabase();
			input = OccupancyStatus.UNKNOWN;
			tick = 0;
			const inputs = {
				list: jest.fn(() => Promise.resolve([{ propertyId: sensor, deviceId: randomUUID(), label: 'Motion' }])),
				capture: jest.fn(() => {
					const status = input;

					return Promise.resolve({ status, isCurrent: () => input === status });
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
			run = jest.fn(noTargets);
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

		it('selects the mode as the automation run without pausing occupancy', async () => {
			await enableOccupancy(ActivityMode.WORK, ActivityMode.AWAY);
			const before = await occupancy();

			expect(await setMode(ActivityMode.RELAX)).toEqual({ success: true });

			expect(await active()).toMatchObject({
				selectedActivityMode: ActivityMode.RELAX,
				activityStatus: ActivityActivationStatus.ACTIVE,
				activityActor: 'automation:automation-1:run-1',
			});
			expect(await occupancy()).toMatchObject({ manualOverride: false, revision: before.revision });
		});

		it('lets the room becoming vacant apply the vacant mode, and restores the automation mode on re-occupancy', async () => {
			await enableOccupancy(null, ActivityMode.AWAY);
			input = OccupancyStatus.OCCUPIED;
			await runtime.runCycle();

			expect(await setMode(ActivityMode.RELAX)).toEqual({ success: true });

			input = OccupancyStatus.VACANT;
			await runtime.runCycle();
			advance(30_000);
			await runtime.runCycle();

			expect(await active()).toMatchObject({ selectedActivityMode: ActivityMode.AWAY, activityActor: 'occupancy' });

			input = OccupancyStatus.OCCUPIED;
			await runtime.runCycle();

			expect((await active())?.selectedActivityMode).toBe(ActivityMode.RELAX);
			expect((await occupancy()).manualOverride).toBe(false);
		});

		it('keeps an automation mode chosen while the room was vacant when the room is occupied again', async () => {
			await enableOccupancy(null, ActivityMode.AWAY);
			await modes.activateMode(h.room.id, ActivityMode.WORK, 1, 'user:operator');
			await configs.clearManual(h.room.id, (await occupancy()).revision);
			input = OccupancyStatus.VACANT;
			await runtime.runCycle();
			advance(30_000);
			await runtime.runCycle();

			expect((await active())?.selectedActivityMode).toBe(ActivityMode.AWAY);
			expect(await setMode(ActivityMode.SLEEP)).toEqual({ success: true });

			input = OccupancyStatus.OCCUPIED;
			await runtime.runCycle();

			// The vacancy activation no longer owns the selection, so it is not restored over the automation
			expect((await active())?.selectedActivityMode).toBe(ActivityMode.SLEEP);
		});

		it('never overwrites a selection made after the one the automation read', async () => {
			const read = await active();

			await modes.activateMode(h.room.id, ActivityMode.WORK, 1, 'user:operator');

			await expect(
				modes.activateMode(h.room.id, ActivityMode.SLEEP, 1, 'automation:automation-1:run-1', undefined, undefined, {
					previousActivationId: read?.activationId ?? null,
					isCurrent: () => true,
				}),
			).rejects.toThrow('superseded');
			expect((await active())?.selectedActivityMode).toBe(ActivityMode.WORK);
		});

		it('takes the error output while another activation of the space is running', async () => {
			const release = deferred<void>();
			const entered = deferred<void>();

			run.mockImplementationOnce(async (domain: ActivityDomain) => {
				entered.resolve();
				await release.promise;

				return noTargets(domain);
			});

			const manual = modes.activateMode(h.room.id, ActivityMode.WORK, 1, 'user:operator');

			await entered.promise;

			expect(await setMode(ActivityMode.SLEEP)).toEqual({
				success: false,
				reason: 'The space mode was not set: Space activity activation is in progress; retry after completion',
			});

			release.resolve();
			await manual;

			expect((await active())?.selectedActivityMode).toBe(ActivityMode.WORK);
		});

		it('writes nothing for a run cancelled before the selection is written', async () => {
			await expect(
				modes.activateMode(h.room.id, ActivityMode.SLEEP, 1, 'automation:automation-1:run-1', undefined, undefined, {
					previousActivationId: null,
					isCurrent: () => false,
				}),
			).rejects.toThrow('cancelled');
			expect(await active()).toBeNull();
			expect(run).not.toHaveBeenCalled();
		});

		it.each([
			['over no selection', false],
			['over an existing selection', true],
		])(
			'commits nothing for a run cancelled after admission but before COMMIT, %s',
			async (_label: string, existing: boolean) => {
				if (existing) {
					await enableOccupancy(ActivityMode.WORK, ActivityMode.AWAY);
					await setMode(ActivityMode.WORK, 'run-0');
				}

				const before = await active();
				const controller = new AbortController();
				// The run is cancelled while the selection is being written, after the early check admitted it
				const cancel = (event: InsertEvent<unknown> | UpdateEvent<unknown>) => {
					if (event.metadata.tableName === 'spaces_module_space_roles') controller.abort();
				};
				const subscriber: EntitySubscriberInterface = { afterInsert: cancel, afterUpdate: cancel };

				h.database.subscribers.push(subscriber);

				try {
					const result = await setModeCard(modes, h, runtime).execute(
						{ space_id: h.room.id, mode: ActivityMode.SLEEP },
						runContext({ runId: 'run-2', signal: controller.signal }),
					);

					expect(result).toEqual({
						success: false,
						reason: 'The space mode was not set: The automation run was cancelled before the mode was selected',
					});
				} finally {
					h.database.subscribers.splice(h.database.subscribers.indexOf(subscriber), 1);
				}

				expect(controller.signal.aborted).toBe(true);
				expect(await active()).toEqual(before);
				expect(run).toHaveBeenCalledTimes(existing ? 5 : 0);
			},
		);

		it('refuses an automation admission that does not name the automation run as the actor', async () => {
			await expect(
				modes.activateMode(h.room.id, ActivityMode.SLEEP, 1, 'user:operator', undefined, undefined, {
					previousActivationId: null,
					isCurrent: () => true,
				}),
			).rejects.toThrow('actor');
			expect(await active()).toBeNull();
		});
	});

	describe('with a schedule', () => {
		let h: Harness;
		let schedules: SpaceModeScheduleConfigService;
		let scheduler: SpaceModeSchedulerService;
		let modes: SpaceModeService;
		const clock = (iso: string) => jest.setSystemTime(new Date(iso));
		const entry = (time: string, mode: ActivityMode): ScheduleEntry => ({
			id: randomUUID(),
			mode,
			time,
			days_of_week: [0, 1, 2, 3, 4, 5, 6],
			enabled: true,
		});
		const setMode = (mode: ActivityMode) =>
			setModeCard(modes, h, {} as SpaceOccupancyService).execute({ space_id: h.room.id, mode }, runContext());

		beforeEach(async () => {
			h = await activityTestDatabase();
			modes = new SpaceModeService(h.database, h.configs, { run: jest.fn(noTargets) } as never, h.events);
			schedules = new SpaceModeScheduleConfigService(
				h.database,
				h.configs,
				h.lifecycle,
				{ getModuleConfig: jest.fn(() => ({ timezone: 'UTC' })) } as unknown as ConfigService,
				h.events,
			);
			schedules.onModuleInit();
			await h.database.transaction((manager) => h.lifecycle.reconcile(h.room, manager));
			scheduler = new SpaceModeSchedulerService(h.database, schedules, modes, new SchedulerRegistry(), h.events);
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
			const current = await schedules.get(h.room.id);
			await schedules.update(h.room.id, {
				expected_revision: current.revision,
				enabled: true,
				timezone: 'UTC',
				entries: [entry('09:00', ActivityMode.WORK), entry('18:00', ActivityMode.AWAY)],
			});
		});

		afterEach(async () => {
			await scheduler.stop();
			schedules.onModuleDestroy();
			jest.restoreAllMocks();
			jest.useRealTimers();
			await h.database.destroy();
		});

		it('does not show an automation selection as a manual one, and the next schedule trigger overrides it', async () => {
			clock('2026-11-02T09:00:05Z');
			await scheduler.runCycle();
			clock('2026-11-02T10:00:00Z');

			expect(await setMode(ActivityMode.RELAX)).toEqual({ success: true });
			expect(await scheduler.getScheduleState(h.room.id)).toMatchObject({ manual_override: false });

			clock('2026-11-02T18:00:02Z');
			await scheduler.runCycle();

			expect(await modes.getActiveMode(h.room.id)).toMatchObject({ selectedActivityMode: ActivityMode.AWAY });
			expect((await modes.getActiveMode(h.room.id)).activityActor).toMatch(/^schedule:/);
		});

		it('lets an automation change the mode a schedule selected: the last automatic writer wins', async () => {
			clock('2026-11-02T09:00:05Z');
			await scheduler.runCycle();

			expect((await modes.getActiveMode(h.room.id)).selectedActivityMode).toBe(ActivityMode.WORK);

			clock('2026-11-02T09:30:00Z');

			expect(await setMode(ActivityMode.SLEEP)).toEqual({ success: true });
			expect((await modes.getActiveMode(h.room.id)).selectedActivityMode).toBe(ActivityMode.SLEEP);
		});
	});
});
