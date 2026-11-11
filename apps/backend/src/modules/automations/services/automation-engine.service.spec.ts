import { DataSource, Repository } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { ConfigService } from '../../config/services/config.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import {
	AUTOMATIONS_MODULE_NAME,
	AutomationMode,
	AutomationRunStatus,
	AutomationStatus,
	EventType,
} from '../automations.constants';
import { AutomationsNotFoundException, AutomationsNotTriggerableException } from '../automations.exceptions';
import { AutomationEntity } from '../entities/automations.entity';
import { DELAY_NODE_TYPE } from '../nodes/delay.node-type';
import {
	ENGINE_ACTION_TYPE,
	ENGINE_PLUGIN_TRIGGER_TYPE,
	ENGINE_TEST_PLUGIN,
	ENGINE_TRIGGER_TYPE,
	EngineHarness,
	Graph,
	flush,
	graph,
	node,
} from '../testing/engine-harness';
import { FakeTrackerClock } from '../testing/fake-tracker-clock';

import { AutomationEngineService } from './automation-engine.service';
import { AutomationRunService } from './automation-run.service';
import { AutomationNodeTypeRegistryService } from './node-type-registry.service';
import { AutomationStateTrackerService } from './state-tracker.service';

describe('AutomationEngineService', () => {
	const ID = '11111111-1111-4111-8111-111111111111';
	const OTHER_ID = '22222222-2222-4222-8222-222222222222';

	let clock: FakeTrackerClock;
	let harness: EngineHarness;
	let rows: Map<string, AutomationEntity>;
	let missing: Set<string>;
	let pluginEnabled: boolean;
	let emitted: { event: string; payload: AutomationEntity }[];
	let notifications: { notify: jest.Mock; resolve: jest.Mock };
	let tracker: { reference: jest.Mock };
	let releaseReference: jest.Mock;
	let runService: AutomationRunService;
	let service: AutomationEngineService;

	const simple = graph([node('t', ENGINE_TRIGGER_TYPE), node('a', ENGINE_ACTION_TYPE)], ['t:out>a']);
	const delayed = graph(
		[node('t', ENGINE_TRIGGER_TYPE), node('wait', DELAY_NODE_TYPE, { seconds: 120 }), node('off', ENGINE_ACTION_TYPE)],
		['t:out>wait', 'wait:out>off'],
	);

	const entity = (automationGraph: Graph, overrides: Partial<AutomationEntity> = {}): AutomationEntity =>
		Object.assign(new AutomationEntity(), {
			id: ID,
			name: 'Hallway light',
			description: null,
			icon: null,
			enabled: true,
			spaceId: null,
			mode: AutomationMode.RESTART,
			graph: automationGraph,
			revision: 1,
			status: AutomationStatus.OK,
			lastTriggeredAt: null,
			lastRunStatus: null,
			...overrides,
		});

	const store = (automation: AutomationEntity): AutomationEntity => {
		rows.set(automation.id, automation);

		return automation;
	};

	/** What AutomationsService does on a save: write the row, bump the revision, emit */
	const save = (changes: Partial<AutomationEntity>, id = ID): AutomationEntity => {
		const current = rows.get(id);

		if (!current) throw new Error('nothing to save');

		const saved = Object.assign(new AutomationEntity(), current, changes, { revision: current.revision + 1 });

		if (current.status === AutomationStatus.SUSPENDED) saved.status = AutomationStatus.OK;

		rows.set(id, saved);
		service.handleAutomationUpdated(saved);

		return saved;
	};

	const settle = async (): Promise<void> => {
		await flush();
		await service.settled();
		await flush();
	};

	const fire = async (key = 'default'): Promise<void> => {
		harness.fire(key);
		await settle();
	};

	beforeEach(() => {
		clock = new FakeTrackerClock();
		harness = new EngineHarness(clock);
		rows = new Map();
		missing = new Set();
		pluginEnabled = true;
		emitted = [];
		releaseReference = jest.fn();

		const registry = new AutomationNodeTypeRegistryService();

		for (const nodeType of harness.nodeTypes()) registry.register(nodeType);

		const repository = {
			find: jest.fn(() => Promise.resolve([...rows.values()].map((row) => Object.assign(new AutomationEntity(), row)))),
			findOneBy: jest.fn(({ id }: { id: string }) => {
				const row = rows.get(id);

				return Promise.resolve(row ? Object.assign(new AutomationEntity(), row) : null);
			}),
			findOne: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve(rows.get(where.id) ?? null)),
			existsBy: jest.fn(({ id }: { id: string }) => Promise.resolve(rows.has(id))),
			update: jest.fn(({ id, revision }: { id: string; revision?: number }, changes: Partial<AutomationEntity>) => {
				const row = rows.get(id);

				if (!row || (revision !== undefined && row.revision !== revision)) return Promise.resolve({ affected: 0 });

				Object.assign(row, changes);

				return Promise.resolve({ affected: 1 });
			}),
		} as unknown as Repository<AutomationEntity>;

		const dataSource = {
			getRepository: jest.fn((target: unknown) => ({
				existsBy: ({ id }: { id: string }) =>
					Promise.resolve(target === AutomationEntity ? rows.has(id) : !missing.has(id)),
			})),
		} as unknown as DataSource;

		const eventEmitter = {
			emit: jest.fn((event: string, payload: AutomationEntity) => {
				emitted.push({ event, payload });

				return true;
			}),
		} as unknown as EventEmitter2;

		const configService = {
			getModuleConfig: jest.fn(() => ({ enabled: true })),
			getPluginConfig: jest.fn((type: string) => {
				if (type !== ENGINE_TEST_PLUGIN) throw new Error('unknown plugin');

				return { enabled: pluginEnabled };
			}),
		} as unknown as ConfigService;

		notifications = { notify: jest.fn(() => Promise.resolve(null)), resolve: jest.fn(() => Promise.resolve(true)) };
		tracker = { reference: jest.fn(() => releaseReference) };
		runService = new AutomationRunService(repository, eventEmitter);

		service = new AutomationEngineService(
			repository,
			dataSource,
			registry,
			tracker as unknown as AutomationStateTrackerService,
			configService,
			notifications as unknown as NotificationsService,
			eventEmitter,
			runService,
			clock,
		);
	});

	afterEach(async () => {
		await service.stop();
	});

	it('is a managed service of the automations module', () => {
		expect(service.owner).toEqual({ kind: 'module', type: AUTOMATIONS_MODULE_NAME });
		expect(service.serviceId).toBe('engine');
		expect(service.getState()).toBe('stopped');
	});

	describe('start', () => {
		it('loads the stored automations and arms the enabled ones', async () => {
			store(entity(simple));
			store(entity(simple, { id: OTHER_ID, enabled: false }));

			await service.start();

			expect(service.getState()).toBe('started');
			expect(await service.isHealthy()).toBe(true);
			expect(service.runtime(ID)).toMatchObject({ status: 'ok', armed: true });
			expect(service.runtime(OTHER_ID)).toMatchObject({ status: 'ok', armed: false });
			expect(harness.activeSubscriptions()).toBe(1);
			expect(emitted).toEqual([]);
		});

		it('marks an automation invalid when one of its node types is no longer registered', async () => {
			store(entity(graph([node('t', ENGINE_TRIGGER_TYPE), node('gone', 'plugin.removed')], ['t:out>gone'])));

			await service.start();
			await settle();

			expect(rows.get(ID)?.status).toBe(AutomationStatus.INVALID);
			expect(service.runtime(ID)).toMatchObject({
				status: 'invalid',
				armed: false,
				problems: [{ code: 'unknown_node_type', node_id: 'gone' }],
			});
			expect(emitted.map((item) => [item.event, item.payload.status])).toEqual([
				[EventType.AUTOMATION_UPDATED, AutomationStatus.INVALID],
			]);
		});

		it('marks an automation invalid when something it refers to no longer exists', async () => {
			missing.add('scene-1');
			store(
				entity(
					graph(
						[
							node('t', ENGINE_TRIGGER_TYPE),
							node('run', ENGINE_ACTION_TYPE, { references: [{ kind: 'scene', id: 'scene-1' }] }),
						],
						['t:out>run'],
					),
				),
			);

			await service.start();
			await settle();

			expect(rows.get(ID)?.status).toBe(AutomationStatus.INVALID);
			expect(service.runtime(ID)?.problems).toEqual([
				{ code: 'missing_reference', message: 'The scene this block refers to no longer exists.', node_id: 'run' },
			]);
		});

		it('heals an automation stored as invalid once it can run again', async () => {
			store(entity(simple, { status: AutomationStatus.INVALID }));

			await service.start();
			await settle();

			expect(rows.get(ID)?.status).toBe(AutomationStatus.OK);
			expect(service.runtime(ID)).toMatchObject({ status: 'ok', armed: true });
		});

		it('keeps what the overload guard stopped suspended across a restart and raises the issue again', async () => {
			store(entity(simple, { status: AutomationStatus.SUSPENDED }));

			await service.start();
			await settle();

			expect(service.runtime(ID)).toMatchObject({ status: 'suspended', armed: false });
			expect(harness.subscribed).toBe(0);
			expect(notifications.notify).toHaveBeenCalledTimes(1);
			expect(emitted).toEqual([]);
		});

		it('keeps the last-seen value of referenced properties in the state tracker', async () => {
			store(
				entity(
					graph(
						[
							node('t', ENGINE_TRIGGER_TYPE),
							node('a', ENGINE_ACTION_TYPE, {
								references: [
									{ kind: 'property', id: 'property-1' },
									{ kind: 'device', id: 'device-1' },
								],
							}),
						],
						['t:out>a'],
					),
				),
			);

			await service.start();

			expect(tracker.reference).toHaveBeenCalledTimes(1);
			expect(tracker.reference).toHaveBeenCalledWith('property-1');

			await service.stop();

			expect(releaseReference).toHaveBeenCalledTimes(1);
		});
	});

	describe('following saves', () => {
		beforeEach(async () => {
			await service.start();
		});

		it('arms an automation when it is created enabled', async () => {
			service.handleAutomationCreated(store(entity(simple)));
			await settle();

			expect(service.runtime(ID)).toMatchObject({ status: 'ok', armed: true });

			await fire();

			expect(harness.calls).toEqual(['a']);
		});

		it('drops the subscriptions when it is disabled and rebuilds them when it is enabled again', async () => {
			service.handleAutomationCreated(store(entity(simple)));
			await settle();

			save({ enabled: false });
			await settle();

			expect(harness.activeSubscriptions()).toBe(0);
			expect(service.runtime(ID)).toMatchObject({ armed: false });

			save({ enabled: true });
			await settle();

			expect(harness.activeSubscriptions()).toBe(1);
		});

		it('cancels active runs when the graph changes, and leaves them alone when only the name does', async () => {
			service.handleAutomationCreated(store(entity(delayed)));
			await settle();
			await fire();

			save({ name: 'Renamed' });
			await settle();

			expect(service.runtime(ID)).toMatchObject({ activeRuns: 1, revision: 2 });
			expect(harness.subscribed).toBe(1);

			save({ graph: simple });
			await settle();

			expect(service.runtime(ID)).toMatchObject({ activeRuns: 0, revision: 3 });
			expect(rows.get(ID)?.lastRunStatus).toBe(AutomationRunStatus.CANCELLED);
		});

		it('ignores an event that carries a revision it already holds', async () => {
			service.handleAutomationCreated(store(entity(delayed)));
			await settle();
			await fire();

			// The engine's own write, or the run bookkeeping: same revision
			service.handleAutomationUpdated(entity(simple, { enabled: false }));
			await settle();

			expect(service.runtime(ID)).toMatchObject({ armed: true, activeRuns: 1 });
		});

		it('removes a deleted automation and marks the automations that refer to it invalid', async () => {
			service.handleAutomationCreated(store(entity(simple)));
			service.handleAutomationCreated(
				store(
					entity(
						graph(
							[
								node('t', ENGINE_TRIGGER_TYPE, { key: 'other' }),
								node('a', ENGINE_ACTION_TYPE, { references: [{ kind: 'automation', id: ID }] }),
							],
							['t:out>a'],
						),
						{ id: OTHER_ID },
					),
				),
			);
			await settle();

			rows.delete(ID);
			service.handleAutomationDeleted({ id: ID });
			await settle();

			expect(service.runtime(ID)).toBeUndefined();
			expect(rows.get(OTHER_ID)?.status).toBe(AutomationStatus.INVALID);
			expect(harness.activeSubscriptions()).toBe(0);
		});

		it('drops everything when the module is reset', async () => {
			service.handleAutomationCreated(store(entity(delayed)));
			await settle();
			await fire();

			rows.clear();
			service.handleModuleReset();
			await settle();

			expect(service.runtime(ID)).toBeUndefined();
			expect(harness.activeSubscriptions()).toBe(0);
			expect(clock.pending()).toBe(0);
		});

		it('survives payloads that are not automations', async () => {
			service.handleAutomationCreated(null);
			service.handleAutomationUpdated({} as AutomationEntity);
			service.handleAutomationDeleted(null);
			await settle();

			expect(service.getState()).toBe('started');
		});
	});

	describe('runs', () => {
		beforeEach(async () => {
			store(entity(simple));
			await service.start();
		});

		it('records when the automation was last triggered and how the run ended, without moving the revision', async () => {
			await fire();

			expect(rows.get(ID)).toMatchObject({
				lastRunStatus: AutomationRunStatus.COMPLETED,
				lastTriggeredAt: expect.any(Date) as Date,
				revision: 1,
			});
			expect(emitted.map((item) => item.event)).toEqual([EventType.AUTOMATION_UPDATED]);

			// The event of that write comes back over the bus and changes nothing
			service.handleAutomationUpdated(emitted[0].payload);
			await settle();

			expect(service.runtime(ID)).toMatchObject({ armed: true, triggers: { started: 1 } });
			expect(emitted).toHaveLength(1);
		});

		it('records a run that parks before it ends', async () => {
			save({ graph: delayed });
			await settle();
			await fire();

			expect(rows.get(ID)).toMatchObject({ lastTriggeredAt: expect.any(Date) as Date, lastRunStatus: null });

			clock.advanceSeconds(120);
			await settle();

			expect(rows.get(ID)?.lastRunStatus).toBe(AutomationRunStatus.COMPLETED);
		});

		it('ends active runs as interrupted when the engine stops', async () => {
			save({ graph: delayed });
			await settle();
			await fire();

			await service.stop();

			expect(service.getState()).toBe('stopped');
			expect(rows.get(ID)?.lastRunStatus).toBe(AutomationRunStatus.INTERRUPTED);
			expect(harness.activeSubscriptions()).toBe(0);
			expect(clock.pending()).toBe(0);
			expect(service.runtime(ID)).toBeUndefined();
		});

		it('asks the action policy before every action', async () => {
			service.setActionPolicy(() => ({ allow: false, reason: 'Not from an automation.' }));

			await fire();

			expect(harness.calls).toEqual([]);
			expect(rows.get(ID)?.lastRunStatus).toBe(AutomationRunStatus.FAILED);

			service.setActionPolicy(undefined);
			await fire();

			expect(harness.calls).toEqual(['a']);
		});
	});

	describe('overload guard', () => {
		beforeEach(async () => {
			store(entity(simple));
			await service.start();

			for (let run = 0; run < 31; run += 1) harness.fire();

			await settle();
		});

		it('stores the suspension and raises a notification with a link to the automation', () => {
			expect(rows.get(ID)?.status).toBe(AutomationStatus.SUSPENDED);
			expect(service.runtime(ID)).toMatchObject({ status: 'suspended', armed: false });
			expect(notifications.notify).toHaveBeenCalledTimes(1);
			expect(notifications.notify).toHaveBeenCalledWith(
				expect.objectContaining({
					source: AUTOMATIONS_MODULE_NAME,
					kind: 'issue',
					key: `automation-suspended:${ID}`,
					severity: 'warning',
					title: 'Automation "Hallway light" was suspended',
					actions: [{ type: 'link', label: 'Open automation', url: `/automations/${ID}`, primary: true }],
				}),
			);
			expect(emitted.some((item) => item.payload.status === AutomationStatus.SUSPENDED)).toBe(true);
		});

		it('refuses a manual run while suspended', async () => {
			await expect(service.triggerOrThrow(ID)).rejects.toMatchObject({ code: 'suspended' });
		});

		it('resumes when the automation is saved and resolves the notification', async () => {
			save({ name: 'Fixed' });
			await settle();

			expect(rows.get(ID)?.status).toBe(AutomationStatus.OK);
			expect(service.runtime(ID)).toMatchObject({ status: 'ok', armed: true });
			expect(notifications.resolve).toHaveBeenCalledWith(AUTOMATIONS_MODULE_NAME, `automation-suspended:${ID}`);
		});

		it('resolves the notification when the suspended automation is deleted', async () => {
			rows.delete(ID);
			service.handleAutomationDeleted({ id: ID });
			await settle();

			expect(notifications.resolve).toHaveBeenCalledWith(AUTOMATIONS_MODULE_NAME, `automation-suspended:${ID}`);
		});
	});

	describe('a status write that waited while the automation was saved', () => {
		it('does not land on the newer revision', async () => {
			store(entity(simple));
			await service.start();

			// The guard suspends revision 1 and queues the write; the save commits revision 2 before it runs
			for (let run = 0; run < 31; run += 1) harness.fire();

			expect(service.runtime(ID)).toMatchObject({ status: 'suspended', revision: 1 });
			expect(rows.get(ID)?.status).toBe(AutomationStatus.OK);

			save({ name: 'Fixed' });
			await settle();

			expect(rows.get(ID)).toMatchObject({ revision: 2, status: AutomationStatus.OK });
			expect(service.runtime(ID)).toMatchObject({ status: 'ok', armed: true, revision: 2 });
			expect(emitted.some((item) => item.payload.status === AutomationStatus.SUSPENDED)).toBe(false);
		});
	});

	describe('invalidation', () => {
		it('stores the status of every automation that referred to what was removed', async () => {
			store(
				entity(
					graph(
						[
							node('t', ENGINE_TRIGGER_TYPE),
							node('a', ENGINE_ACTION_TYPE, { references: [{ kind: 'device', id: 'device-1' }] }),
						],
						['t:out>a'],
					),
				),
			);
			store(entity(simple, { id: OTHER_ID }));
			await service.start();

			const hit = await service.invalidateReferences(
				(reference) => reference.kind === 'device' && reference.id === 'device-1',
			);
			await settle();

			expect(hit).toEqual([ID]);
			expect(rows.get(ID)?.status).toBe(AutomationStatus.INVALID);
			expect(rows.get(OTHER_ID)?.status).toBe(AutomationStatus.OK);
			expect(service.runtime(ID)).toMatchObject({ armed: false, problems: [{ node_id: 'a' }] });
		});

		it('resolves the suspension issue of a suspended automation that becomes invalid', async () => {
			store(
				entity(
					graph(
						[
							node('t', ENGINE_TRIGGER_TYPE),
							node('a', ENGINE_ACTION_TYPE, { references: [{ kind: 'device', id: 'device-1' }] }),
						],
						['t:out>a'],
					),
				),
			);
			await service.start();

			for (let run = 0; run < 31; run += 1) harness.fire();

			await settle();

			expect(rows.get(ID)?.status).toBe(AutomationStatus.SUSPENDED);
			expect(notifications.notify).toHaveBeenCalledTimes(1);
			expect(notifications.resolve).not.toHaveBeenCalled();

			await service.invalidateReferences((reference) => reference.kind === 'device' && reference.id === 'device-1');
			await settle();

			expect(rows.get(ID)?.status).toBe(AutomationStatus.INVALID);
			expect(service.runtime(ID)).toMatchObject({ status: 'invalid', armed: false });
			expect(notifications.notify).toHaveBeenCalledTimes(1);
			expect(notifications.resolve).toHaveBeenCalledTimes(1);
			expect(notifications.resolve).toHaveBeenCalledWith(AUTOMATIONS_MODULE_NAME, `automation-suspended:${ID}`);
		});

		it('does nothing while the engine is stopped', async () => {
			expect(await service.invalidateReferences(() => true)).toEqual([]);
		});
	});

	describe('manual run', () => {
		it('starts a run and answers with its id', async () => {
			store(entity(simple));
			await service.start();

			const outcome = await service.triggerOrThrow(ID);
			await settle();

			expect(outcome).toMatchObject({ outcome: 'started', runId: expect.any(String) as string });
			expect(harness.calls).toEqual(['a']);
		});

		it('throws when the automation does not exist', async () => {
			await service.start();

			await expect(service.triggerOrThrow(ID)).rejects.toBeInstanceOf(AutomationsNotFoundException);
		});

		it('throws when the run is refused, with the reason', async () => {
			store(entity(simple, { enabled: false }));
			await service.start();

			await expect(service.triggerOrThrow(ID)).rejects.toBeInstanceOf(AutomationsNotTriggerableException);
			await expect(service.triggerOrThrow(ID)).rejects.toMatchObject({
				code: 'disabled',
				message: 'The automation is disabled.',
			});
		});

		it('refuses a node that is not a trigger', async () => {
			store(entity(simple));
			await service.start();

			await expect(service.triggerOrThrow(ID, 'a')).rejects.toMatchObject({ code: 'not_a_trigger' });
		});

		it('is refused while the engine is stopped', async () => {
			store(entity(simple));

			await expect(service.triggerOrThrow(ID)).rejects.toMatchObject({ code: 'not_running' });
		});
	});

	describe('owning plugin', () => {
		const pluginGraph = graph([node('t', ENGINE_PLUGIN_TRIGGER_TYPE), node('a', ENGINE_ACTION_TYPE)], ['t:out>a']);

		it('arms a trigger only while the plugin it belongs to is enabled, and follows configuration changes', async () => {
			pluginEnabled = false;
			store(entity(pluginGraph));
			await service.start();

			expect(service.runtime(ID)).toMatchObject({ status: 'ok', armedTriggers: 0 });

			pluginEnabled = true;
			service.handleConfigUpdated();
			await settle();

			expect(service.runtime(ID)).toMatchObject({ armedTriggers: 1 });

			pluginEnabled = false;
			service.handleConfigUpdated();
			await settle();

			expect(service.runtime(ID)).toMatchObject({ armedTriggers: 0 });
		});
	});

	it('ignores the bus while it is stopped', async () => {
		service.handleAutomationCreated(store(entity(simple)));
		service.handleConfigUpdated();
		service.handleModuleReset();
		await flush();

		expect(harness.subscribed).toBe(0);
		expect(service.runtime(ID)).toBeUndefined();
	});

	it('can be started again after it was stopped', async () => {
		store(entity(simple));

		await service.start();
		await service.stop();
		await service.start();
		await fire();

		expect(harness.calls).toEqual(['a']);
		expect(harness.activeSubscriptions()).toBe(1);
	});
});
