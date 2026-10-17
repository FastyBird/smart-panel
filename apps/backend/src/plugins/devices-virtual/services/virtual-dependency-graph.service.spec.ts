import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EntityManager, EntitySubscriberInterface, QueryRunner } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	ClimateAutomationParticipant,
	ClimateAutomationParticipantImage,
	ClimateAutomationProvider,
	climateAutomationCanonical,
	climateAutomationJson,
} from '../../../modules/devices/contracts/climate-automation.contract';
import { ClimateAutomationWriterService } from '../../../modules/devices/services/climate-automation-writer.service';
import { ClimateAutomationRegistryService } from '../../../modules/devices/services/climate-automation.registry.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { EventType, ChannelCategory, DataTypeType, DeviceCategory, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { VirtualDeviceEntity, VirtualChannelEntity, VirtualChannelPropertyEntity, VirtualDeviceMode, VirtualValueOrigin } from '../entities/devices-virtual.entity';
import { VirtualAggregateConfigEntity, VirtualAggregateOperator, VirtualAggregateProfile, VirtualGraphRevisionEntity } from '../entities/virtual-producer.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualProducerStateService } from './virtual-producer-state.service';

const gate = () => {
	let resolve: () => void = () => {
		throw new Error('Barrier not initialized');
	};
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve: () => resolve() };
};
const id = '6d236055-8740-4f86-93bf-1fb7e1effaa7';

// New specification, not four inherited graph cases. All B cases are UNEXECUTED source drafts.
describe('dormant reserved graph and acknowledged observed-revision validation', () => {
	let directory: string, database: SqliteDataSource, peer: SqliteDataSource;
	let registry: ClimateAutomationRegistryService,
		writer: ClimateAutomationWriterService,
		graph: VirtualDependencyGraphService;
	let owner: { dispose: () => void }, provider: ClimateAutomationProvider;
	const config = new ConfigService({ FB_CLI: 'off' });
	const read = async (manager: EntityManager): Promise<ClimateAutomationParticipantImage | null> => {
		const rows = await manager.query<{ revision: number; document: string }[]>(
			'SELECT revision,document FROM test_graph_participant WHERE id=?',
			[id],
		);
		const row = rows[0];
		if (!row) return null;
		const parsed: unknown = JSON.parse(row.document);
		return {
			controllerId: id,
			documentVersion: 1,
			controllerRevision: row.revision,
			configuration: climateAutomationJson(parsed),
			comfort: {},
			structural: climateAutomationJson(parsed),
			legacyBaseline: null,
		};
	};
	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'vd1458-b-graph-'));
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: join(directory, 'own.sqlite'),
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		peer = await new SqliteDataSource({
			type: 'sqlite',
			database: join(directory, 'own.sqlite'),
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		await database.manager.insert(VirtualGraphRevisionEntity, { id: 1, revision: 0 });
		await database.query(
			'CREATE TABLE test_graph_participant (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, document TEXT NOT NULL)',
		);
		registry = new ClimateAutomationRegistryService();
		writer = new ClimateAutomationWriterService(database, new DeviceStructureLockService(), registry, config);
		graph = new VirtualDependencyGraphService(database, config, writer);
		const participant: ClimateAutomationParticipant = {
			version: 1,
			graph,
			readInManager: (manager, turn) => {
				writer.assertParticipantTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ']);
				return read(manager);
			},
			normalizeInManager: async (manager, turn, _kind, desired, before) => {
				writer.assertParticipantTurn(manager, turn, ['NORMALIZE']);
				return Promise.resolve({
					controllerId: id,
					documentVersion: 1,
					configuration: desired,
					structural: desired,
					comfort: before.comfort,
					legacyBaseline: before.legacyBaseline,
				});
			},
			planGraphReplacementInManager: async (manager, turn) => {
				writer.assertParticipantTurn(manager, turn, ['NORMALIZE']);
				return Promise.resolve({ ownedOutputIds: [], beforeEdges: [], replacementEdges: [] });
			},
			applyInManager: async (manager, turn, before, next) => {
				writer.assertParticipantTurn(manager, turn, ['APPLY']);
				const result = await manager
					.createQueryBuilder()
					.update('test_graph_participant')
					.set({ revision: next.controllerRevision, document: climateAutomationCanonical(next.configuration) })
					.where('id=:id AND revision=:revision', { id, revision: before.controllerRevision })
					.execute();
				if (result.affected !== 1) throw new Error('Unexpected TEST participant CAS failure');
			},
		};
		provider = {
			participantV1: participant,
			readControllerInManager: async (manager) => {
				const image = await read(manager);
				return image
					? {
							controllerRevision: image.controllerRevision,
							graphRevision: await graph.revision(manager),
							evidence: climateAutomationJson(image),
							legacyBaseline: null,
						}
					: null;
			},
			validateSelectionInManager: () => Promise.resolve(true),
			createControllerInManager: async (manager) => {
				await manager.query('INSERT INTO test_graph_participant VALUES (?,1,?)', [id, '{}']);
			},
		};
		const registration = registry.registerProviderOwned('test-graph:v1', provider);
		if (!registration) throw new Error('Missing actual provider owner');
		owner = registration;
		await writer.runReserved(async (manager, scope) =>
			writer.initializeSlot(manager, scope, {
				providerKey: 'test-graph:v1',
				controllerId: id,
				expected: await writer.readSlot(manager, scope, id),
				configuration: {},
			}),
		);
	});
	afterEach(async () => {
		registry.onModuleDestroy();
		jest.restoreAllMocks();
		await peer.destroy();
		await database.destroy();
		await rm(directory, { recursive: true, force: true });
	});
	const change = () =>
		writer.runReserved(async (manager, scope) =>
			writer.replaceController(manager, scope, {
				kind: 'replace-configuration:v1',
				providerKey: 'test-graph:v1',
				controllerId: id,
				expected: await writer.readParticipant(manager, scope, { providerKey: 'test-graph:v1', controllerId: id }),
				desiredDocument: { member: 1 },
			}),
		);

	const seedPublisherOutput = async () => {
		const device = Object.assign(new VirtualDeviceEntity(), { id: uuid(), name: 'TEST publisher', category: DeviceCategory.SENSOR, mode: VirtualDeviceMode.SENSOR_AGGREGATE });
		const channel = Object.assign(new VirtualChannelEntity(), { id: uuid(), device, name: 'TEST temperature', category: ChannelCategory.TEMPERATURE });
		const property = Object.assign(new VirtualChannelPropertyEntity(), { id: uuid(), channel, category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT, permissions: [PermissionType.READ_ONLY], valueOrigin: VirtualValueOrigin.DERIVED });
		await database.manager.insert(VirtualDeviceEntity, device);
		await database.manager.insert(VirtualChannelEntity, channel);
		await database.manager.insert(VirtualChannelPropertyEntity, property);
		return property;
	};
	const corruptProfile = async (property: VirtualChannelPropertyEntity) => {
		await database.manager.insert(VirtualAggregateConfigEntity, Object.assign(new VirtualAggregateConfigEntity(), {
			outputPropertyId: property.id, profile: VirtualAggregateProfile.HUMIDITY, operator: VirtualAggregateOperator.MEAN,
			minimumValidInputs: 1, maximumAgeSeconds: 300, revision: 1,
		}));
	};

	it('refuses a forged turn BEFORE graph query, with no missing-singleton ensure', async () => {
		const query = jest.spyOn(database.manager, 'findOneBy');
		await expect(graph.readReservedGraph(database.manager, { toJSON: () => ({}) })).rejects.toThrow();
		expect(query).not.toHaveBeenCalled();
		expect(await graph.revision()).toBe(0);
	});
	it('refuses the actual legacy mutating producer-state listener before ANY callback or guarded metadata publication', async () => {
		const producers = new PropertyProducerRegistryService(new EventEmitter2());
		const state = new VirtualProducerStateService(database, producers, graph, new EventEmitter2(), config);
		await state.onModuleInit();
		const legacyProperty = await seedPublisherOutput();
		const legacy = jest.fn(async () => {
			const actual = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: legacyProperty.id });
			state.installUnavailable(actual, 1);
		});
		const stopLegacy = graph.observeValidation(legacy);
		const register = jest.spyOn(producers, 'register'),
			invalidate = jest.spyOn(producers, 'invalidate'),
			remove = jest.spyOn(producers, 'remove');
		const readonly = jest.fn(() => Promise.resolve());
		graph.observeGuardedValidation(readonly);
		try {
			await expect(change()).rejects.toMatchObject({ commitOutcome: 'committed' });
			expect(register).not.toHaveBeenCalled();
			expect(invalidate).not.toHaveBeenCalled();
			expect(remove).not.toHaveBeenCalled();
			expect(readonly).not.toHaveBeenCalled();
			expect(legacy).not.toHaveBeenCalled();
			expect(graph.isValidated()).toBe(false);
			expect(await graph.revision()).toBe(1);
		} finally {
			stopLegacy();
			state.onModuleDestroy();
			producers.onModuleDestroy();
		}
	});
	it('rejects a successor committed BEFORE its original snapshot rather than publishing successor metadata on old behalf', async () => {
		const entered = gate(),
			release = gate();
		const originalMethods: {
			readonly validateAcknowledgedGraph: (
				...args: Parameters<VirtualDependencyGraphService['validateAcknowledgedGraph']>
			) => ReturnType<VirtualDependencyGraphService['validateAcknowledgedGraph']>;
		} = graph;
		const original = originalMethods.validateAcknowledgedGraph;
		const observed = jest
			.spyOn(graph, 'validateAcknowledgedGraph')
			.mockImplementation(async (job, ticket, revision) => {
				expect(JSON.stringify(job)).toBe('{}');
				expect(JSON.stringify(ticket)).toBe('{}');
				entered.resolve();
				await release.promise;
				const call: {
					call: (
						receiver: VirtualDependencyGraphService,
						...args: Parameters<VirtualDependencyGraphService['validateAcknowledgedGraph']>
					) => ReturnType<VirtualDependencyGraphService['validateAcknowledgedGraph']>;
				} = original;
				return call.call(graph, job, ticket, revision);
			});
		const readonly = jest.fn(() => Promise.resolve());
		graph.observeGuardedValidation(readonly);
		const operation = change();
		const rejected = expect(operation).rejects.toMatchObject({ commitOutcome: 'committed' });
		await entered.promise;
		await peer.query('UPDATE devices_virtual_graph_revision SET revision=2 WHERE id=1');
		release.resolve();
		await rejected;
		expect(observed).toHaveBeenCalledTimes(1);
		expect(readonly).not.toHaveBeenCalled();
		expect(graph.isRevisionCurrent(2)).toBe(false);
	});
	it.each(['foreign-only', 'newer-local-validation'])(
		'does not falsely publish or clobber successor %s when an original readonly listener is held',
		async (schedule) => {
			const entered = gate(),
				release = gate();
			graph.observeGuardedValidation(async () => {
				entered.resolve();
				await release.promise;
			});
			const operation = change();
			const rejected = expect(operation).rejects.toMatchObject({ commitOutcome: 'committed' });
			await entered.promise;
			const peerGraph = new VirtualDependencyGraphService(peer, config);
			await peerGraph.withStructuralWrite(() => Promise.resolve());
			if (schedule === 'newer-local-validation') {
				await graph.refreshQuarantine();
				expect(graph.isRevisionCurrent(2)).toBe(true);
			}
			release.resolve();
			await rejected;
			expect(graph.isRevisionCurrent(1)).toBe(false);
			expect(graph.isRevisionCurrent(2)).toBe(schedule === 'newer-local-validation');
		},
	);
	it.each(['owner-ABA', 'listener-options'])(
		'rejects original %s replacement during a listener without fresh rescue',
		async (boundary) => {
			const entered = gate(),
				release = gate();
			const options = { requiresActivation: true };
			const ordinary = jest.fn(() => Promise.resolve());
			graph.observeValidation(ordinary, options);
			graph.observeGuardedValidation(async () => {
				entered.resolve();
				await release.promise;
			});
			const operation = change();
			const rejected = expect(operation).rejects.toMatchObject({ commitOutcome: 'committed' });
			await entered.promise;
			if (boundary === 'owner-ABA') {
				owner.dispose();
				expect(registry.registerProviderOwned('test-graph:v1', provider)).not.toBeNull();
			} else options.requiresActivation = false;
			release.resolve();
			await rejected;
			expect(ordinary).not.toHaveBeenCalled();
			expect(graph.isValidated()).toBe(false);
		},
	);
	it('demonstrates finite observed-revision proof, not continuous foreign-process authority', async () => {
		expect((await change()).outcome).toBe('applied');
		expect(graph.isRevisionCurrent(1)).toBe(true);
		await peer.query('UPDATE devices_virtual_graph_revision SET revision=2 WHERE id=1');
		// Local cache still remembers observed1: callers MUST NOT treat that as continuous database authority.
		expect(graph.isRevisionCurrent(1)).toBe(true);
		expect(await graph.revision()).toBe(2);
	});
	it('keeps ordinary singleton initialization, revision preincrement and postcommit listener behavior independent', async () => {
		await database.manager.delete(VirtualGraphRevisionEntity, { id: 1 });
		const listener = jest.fn(() => Promise.resolve());
		graph.observeValidation(listener);
		const value = Object.freeze({ original: true });
		expect(await graph.withStructuralWrite(() => Promise.resolve(value))).toBe(value);
		expect(await graph.revision()).toBe(1);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(graph.isRevisionCurrent(1)).toBe(true);
		await expect(graph.withStructuralWrite(() => Promise.resolve(), 0)).rejects.toThrow('revision changed');
		expect(await graph.revision()).toBe(1);
	});

	describe('real owned producer staging and acknowledged publication', () => {
		it('converts actual producer state separately from the retained unconverted-legacy refusal', async () => {
			const events = new EventEmitter2(), producers = new PropertyProducerRegistryService(events);
			const state = new VirtualProducerStateService(database, producers, graph, events, config);
			try {
				await state.onModuleInit();
				expect((await change()).outcome).toBe('applied');
				expect(graph.isRevisionCurrent(1)).toBe(true);
				expect(state.readPublicationReport()).toMatchObject({ installed: true, attempted: 0, completed: 0, terminal: 'complete' });
				expect(producers.readOwnedOperationCounts()).toEqual({ activeBatches: 0, observedIds: 0 });
			} finally { state.onModuleDestroy(); producers.onModuleDestroy(); }
		});

		// R1 correction: real nonempty no-config catalog, never a fabricated ready guard.
		it('renews an owned unquarantined derived fallback for real bootstrap and each later ready generation', async () => {
			const row = await seedPublisherOutput();
			const events = new EventEmitter2(), producers = new PropertyProducerRegistryService(events);
			const observations = jest.spyOn(producers, 'beginObservedBatch');
			const state = new VirtualProducerStateService(database, producers, graph, events, config);
			try {
				await state.onModuleInit();
				const initialGuard = observations.mock.calls.at(-1)?.[2];
				if (!initialGuard) throw new Error('Missing actual initialization guard');
				expect(initialGuard.isCurrent()).toBe(false);
				expect(producers.read(row.id)?.producer?.reasons).toEqual(['graph_validation_pending']);
				await graph.onApplicationBootstrap();
				const bootstrapGuard = observations.mock.calls.at(-1)?.[2];
				if (!bootstrapGuard) throw new Error('Missing actual bootstrap guard');
				expect(graph.isValidated()).toBe(true);
				expect(bootstrapGuard).not.toBe(initialGuard);
				expect(initialGuard.isCurrent()).toBe(false);
				expect(bootstrapGuard.isCurrent()).toBe(true);
				expect(producers.read(row.id)?.producer?.reasons).toEqual(['runtime_unavailable']);
				graph.invalidateValidation();
				expect(bootstrapGuard.isCurrent()).toBe(false);
				expect(producers.read(row.id)?.producer?.reasons).toEqual(['graph_validation_pending']);
				await graph.refreshQuarantine();
				const refreshedGuard = observations.mock.calls.at(-1)?.[2];
				if (!refreshedGuard) throw new Error('Missing actual refreshed guard');
				expect(graph.isValidated()).toBe(true);
				expect(refreshedGuard).not.toBe(bootstrapGuard);
				expect(initialGuard.isCurrent()).toBe(false);
				expect(bootstrapGuard.isCurrent()).toBe(false);
				expect(refreshedGuard.isCurrent()).toBe(true);
				expect(producers.read(row.id)?.producer?.reasons).toEqual(['runtime_unavailable']);
			} finally { state.onModuleDestroy(); producers.onModuleDestroy(); }
		});

		it('a held older refresh cannot revive its fallback or clobber the successor ready fallback', async () => {
			const row = await seedPublisherOutput();
			const events = new EventEmitter2(), producers = new PropertyProducerRegistryService(events);
			const observations = jest.spyOn(producers, 'beginObservedBatch');
			const state = new VirtualProducerStateService(database, producers, graph, events, config);
			const entered = gate(), release = gate();
			let stop: (() => void) | undefined, pending: Promise<void> | undefined, observed: Promise<void> | undefined;
			try {
				await state.onModuleInit();
				await graph.onApplicationBootstrap();
				stop = graph.observeValidation(async () => { entered.resolve(); await release.promise; }, { requiresActivation: false });
				pending = graph.refreshQuarantine();
				observed = pending.catch(() => undefined);
				await entered.promise;
				const olderGuard = observations.mock.calls.at(-1)?.[2];
				if (!olderGuard) throw new Error('Missing actual held refresh guard');
				expect(olderGuard.isCurrent()).toBe(false);
				expect(producers.read(row.id)?.producer?.reasons).toEqual(['graph_validation_pending']);
				stop();
				await graph.refreshQuarantine();
				const successorGuard = observations.mock.calls.at(-1)?.[2];
				if (!successorGuard) throw new Error('Missing actual successor guard');
				expect(successorGuard).not.toBe(olderGuard);
				expect(graph.isValidated()).toBe(true);
				expect(successorGuard.isCurrent()).toBe(true);
				expect(olderGuard.isCurrent()).toBe(false);
				expect(producers.read(row.id)?.producer?.reasons).toEqual(['runtime_unavailable']);
				release.resolve(); await pending;
				expect(graph.isValidated()).toBe(true);
				expect(successorGuard.isCurrent()).toBe(true);
				expect(olderGuard.isCurrent()).toBe(false);
				expect(producers.read(row.id)?.producer?.reasons).toEqual(['runtime_unavailable']);
			} finally { stop?.(); release.resolve(); await observed; state.onModuleDestroy(); producers.onModuleDestroy(); }
		});

		it('bootstrap and later fallback refresh leave an independently registered runtime B lease unchanged', async () => {
			const row = await seedPublisherOutput();
			const events = new EventEmitter2(), producers = new PropertyProducerRegistryService(events);
			const state = new VirtualProducerStateService(database, producers, graph, events, config);
			try {
				await state.onModuleInit();
				const b = producers.register(row, 1);
				const version = producers.version(b), originalState = producers.read(row.id);
				const notified = jest.fn();
				events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, notified);
				await graph.onApplicationBootstrap();
				expect(graph.isValidated()).toBe(true);
				expect(producers.isCurrent(b)).toBe(true);
				expect(producers.isAvailable(b)).toBe(true);
				expect(producers.version(b)).toBe(version);
				expect(producers.read(row.id)).toEqual(originalState);
				await graph.refreshQuarantine();
				expect(graph.isValidated()).toBe(true);
				expect(producers.isCurrent(b)).toBe(true);
				expect(producers.isAvailable(b)).toBe(true);
				expect(producers.version(b)).toBe(version);
				expect(producers.read(row.id)).toEqual(originalState);
				expect(notified).not.toHaveBeenCalled();
			} finally { state.onModuleDestroy(); producers.onModuleDestroy(); }
		});

		it('prepared guard opens only SAME generation ready, old generation never revives and unload closes it', async () => {
			const row = await seedPublisherOutput(); await corruptProfile(row);
			const events = new EventEmitter2(), producers = new PropertyProducerRegistryService(events);
			const state = new VirtualProducerStateService(database, producers, graph, events, config);
			try {
				await state.onModuleInit();
				const observed: string[][] = [];
				events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, () => observed.push(producers.read(row.id)?.producer?.reasons ?? []));
				await change();
				expect(observed).toEqual([['graph_validation_pending'], ['graph_validation_pending']]);
				expect(producers.read(row.id)?.producer?.reasons).toEqual(['graph_quarantined']);
				const originalLifecycle = graph.captureOwnedPublicationLifecycle();
				graph.invalidateValidation();
				expect(originalLifecycle.guard.isCurrent()).toBe(false);
				await graph.refreshQuarantine();
				expect(originalLifecycle.guard.isCurrent()).toBe(false);
				expect(producers.read(row.id)?.producer?.reasons).toEqual(['graph_quarantined']);
				state.onModuleDestroy();
				expect(producers.read(row.id)?.producer?.quality).toBe('unavailable');
			} finally { state.onModuleDestroy(); producers.onModuleDestroy(); }
		});

		it('actual peer revision change during readonly stage refuses before any owned install/applied view', async () => {
			const events = new EventEmitter2(), producers = new PropertyProducerRegistryService(events);
			const install = jest.spyOn(producers, 'installPreparedNoEvents');
			const state = new VirtualProducerStateService(database, producers, graph, events, config);
			const entered = gate(), release = gate();
			try {
				await state.onModuleInit(); install.mockClear();
				graph.observeGuardedValidation(async () => { entered.resolve(); await release.promise; });
				const operation = change();
				const rejected = expect(operation).rejects.toMatchObject({ commitOutcome: 'committed' });
				await entered.promise;
				await peer.query('UPDATE devices_virtual_graph_revision SET revision=2 WHERE id=1');
				release.resolve(); await rejected;
				expect(install).not.toHaveBeenCalled();
				expect(state.readPublicationReport()).toMatchObject({ installed: false, attempted: 0, completed: 0 });
				expect(graph.isRevisionCurrent(2)).toBe(false);
			} finally { release.resolve(); state.onModuleDestroy(); producers.onModuleDestroy(); }
		});

		it('installed maps survive partial Q delivery while actual ACK late P remains exact COMMITTED primary', async () => {
			const row = await seedPublisherOutput(); await corruptProfile(row);
			const events = new EventEmitter2(), producers = new PropertyProducerRegistryService(events);
			const state = new VirtualProducerStateService(database, producers, graph, events, config);
			const primary = new Error('TEST late P');
			let runner: QueryRunner | undefined, threw = false, delivered = 0;
			const subscriber: EntitySubscriberInterface<object> = {
				beforeQuery(event) { if (/UPDATE\s+"?test_graph_participant/i.test(event.query)) runner = event.queryRunner; },
				afterTransactionCommit(event) { if (!threw && runner && event.queryRunner === runner) { threw = true; throw primary; } },
			};
			try {
				await state.onModuleInit();
				events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, () => { delivered++; });
				events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, () => { throw new Error('PRIVATE Q'); });
				database.subscribers.push(subscriber);
				let failure: unknown;
				try { await change(); } catch (error) { failure = error; }
				expect(failure).toMatchObject({ commitOutcome: 'committed', cause: primary });
				if (!(failure instanceof Error)) throw new Error('Expected real COMMITTED error');
				expect(failure.cause).toBe(primary);
				expect(threw).toBe(true);
				expect(delivered).toBe(1);
				expect(state.readPublicationReport()).toEqual({ installed: true, attempted: 1, completed: 0, terminal: 'notification_rejected' });
				expect(graph.isValidated()).toBe(false);
				expect(await graph.revision()).toBe(1);
				expect((await database.query<{ revision: number }[]>('SELECT revision FROM test_graph_participant WHERE id=?', [id]))[0].revision).toBe(2);
				expect(JSON.stringify(failure)).not.toContain('PRIVATE Q');
			} finally { const index = database.subscribers.indexOf(subscriber); if (index >= 0) database.subscribers.splice(index, 1); state.onModuleDestroy(); producers.onModuleDestroy(); }
		});

		it('ordinary nonactivation sees pending metadata and a real watched-slot mutation prevents stale ready', async () => {
			const row = await seedPublisherOutput(); await corruptProfile(row);
			const events = new EventEmitter2(), producers = new PropertyProducerRegistryService(events);
			const state = new VirtualProducerStateService(database, producers, graph, events, config);
			try {
				await state.onModuleInit();
				let called = false;
				graph.observeValidation(() => {
					called = true;
					expect(graph.isQuarantined(row.id)).toBe(true);
					expect(graph.capturePublishGuard()()).toBe(false);
					producers.register(row, 2);
					return Promise.resolve();
				});
				await expect(graph.refreshQuarantine()).rejects.toThrow('incomplete');
				expect(called).toBe(true);
				expect(graph.isValidated()).toBe(false);
				expect(state.readPublicationReport()?.installed).toBe(true);
			} finally { state.onModuleDestroy(); producers.onModuleDestroy(); }
		});

		it('held initialization cannot install after original service destruction or register again', async () => {
			const events = new EventEmitter2(), producers = new PropertyProducerRegistryService(events);
			const install = jest.spyOn(producers, 'installPreparedNoEvents');
			const state = new VirtualProducerStateService(database, producers, graph, events, config);
			const entered = gate(), release = gate(); let held = false;
			const subscriber: EntitySubscriberInterface<object> = { async beforeQuery(event) {
				if (!held && /SELECT/i.test(event.query) && event.query.includes('channels_properties')) {
					held = true; entered.resolve(); await release.promise;
				}
			} };
			database.subscribers.push(subscriber);
			try {
				const initialization = state.onModuleInit();
				const observed = initialization.catch(() => undefined);
				await entered.promise;
				state.onModuleDestroy(); release.resolve(); await observed;
				expect(install).not.toHaveBeenCalled();
				await expect(state.onModuleInit()).rejects.toThrow('unavailable');
				expect(producers.readOwnedOperationCounts()).toEqual({ activeBatches: 0, observedIds: 0 });
			} finally { release.resolve(); const index = database.subscribers.indexOf(subscriber); if (index >= 0) database.subscribers.splice(index, 1); state.onModuleDestroy(); producers.onModuleDestroy(); }
		});

		it('explicit CLI state lifecycle has zero registry owner/DB work and required missing registry refuses', async () => {
			const events = new EventEmitter2(), producers = new PropertyProducerRegistryService(events);
			const acquire = jest.spyOn(producers, 'acquireOwnedPublisher');
			const state = new VirtualProducerStateService(database, producers, graph, events, new ConfigService({ FB_CLI: 'on' }));
			const transaction = jest.spyOn(database, 'transaction');
			try {
				await state.onModuleInit();
				expect(acquire).not.toHaveBeenCalled(); expect(transaction).not.toHaveBeenCalled();
				const realOwner = producers.acquireOwnedPublisher('virtual-producer-state:v1', events);
				if (!realOwner) throw new Error('Missing actual registry owner');
				expect(() => graph.observeOwnedStaging(undefined, realOwner, Object.freeze({ version: 1, stage: state.stageOwned }), state, { requiresActivation: false })).toThrow();
			} finally { state.onModuleDestroy(); producers.onModuleDestroy(); }
		});
		it('old held owned job never overwrites a newer ordinary ready generation or its last report', async () => {
			const events = new EventEmitter2(), producers = new PropertyProducerRegistryService(events);
			const state = new VirtualProducerStateService(database, producers, graph, events, config);
			const entered = gate(), release = gate();
			try {
				await state.onModuleInit();
				graph.observeGuardedValidation(async () => { entered.resolve(); await release.promise; });
				const operation = change(), rejected = expect(operation).rejects.toMatchObject({ commitOutcome: 'committed' });
				await entered.promise;
				await graph.refreshQuarantine();
				expect(graph.isRevisionCurrent(1)).toBe(true);
				const newer = state.readPublicationReport();
				expect(newer?.terminal).toBe('complete');
				release.resolve(); await rejected;
				expect(graph.isRevisionCurrent(1)).toBe(true);
				expect(state.readPublicationReport()).toBe(newer);
			} finally { release.resolve(); state.onModuleDestroy(); producers.onModuleDestroy(); }
		});

		it('replacement of the original actual stage method cannot recapture through the new method', async () => {
			const events = new EventEmitter2(), producers = new PropertyProducerRegistryService(events);
			const state = new VirtualProducerStateService(database, producers, graph, events, config);
			try {
				await state.onModuleInit();
				const replacement = jest.spyOn(state, 'stageOwned');
				await expect(change()).rejects.toMatchObject({ commitOutcome: 'committed' });
				expect(replacement).not.toHaveBeenCalled();
				expect(graph.isValidated()).toBe(false);
				replacement.mockRestore();
			} finally { state.onModuleDestroy(); producers.onModuleDestroy(); }
		});

		it('actual published role options are immutable and cannot change category while a readonly callback is held', async () => {
			const events = new EventEmitter2(), producers = new PropertyProducerRegistryService(events);
			const registration = jest.spyOn(graph, 'observeOwnedStaging');
			const state = new VirtualProducerStateService(database, producers, graph, events, config);
			const entered = gate(), release = gate();
			try {
				await state.onModuleInit();
				const options = registration.mock.calls[0][4];
				expect(Object.isFrozen(options)).toBe(true);
				graph.observeGuardedValidation(async () => { entered.resolve(); await release.promise; });
				const operation = change();
				await entered.promise;
				expect(Reflect.set(options, 'requiresActivation', true)).toBe(false);
				release.resolve(); expect((await operation).outcome).toBe('applied');
				expect(options.requiresActivation).toBe(false);
			} finally { release.resolve(); state.onModuleDestroy(); producers.onModuleDestroy(); }
		});

		it('pins original mutable registration option VALUE rather than accepting a role change during await', async () => {
			const events = new EventEmitter2(), producers = new PropertyProducerRegistryService(events);
			const original = graph.observeOwnedStaging;
			const mutableOptions: { requiresActivation: false } = { requiresActivation: false };
			// A valid mutable caller-options object is allowed by the internal readonly input contract.
			// The real method/owner/stager still execute; only options storage differs from the production frozen literal.
			jest.spyOn(graph, 'observeOwnedStaging').mockImplementation((registry, owner, capability, receiver) =>
				original.call(graph, registry, owner, capability, receiver, mutableOptions));
			const state = new VirtualProducerStateService(database, producers, graph, events, config);
			const entered = gate(), release = gate();
			try {
				await state.onModuleInit();
				graph.observeGuardedValidation(async () => { entered.resolve(); await release.promise; });
				const operation = change(), rejected = expect(operation).rejects.toMatchObject({ commitOutcome: 'committed' });
				await entered.promise;
				expect(Reflect.set(mutableOptions, 'requiresActivation', true)).toBe(true);
				release.resolve(); await rejected;
				expect(state.readPublicationReport()).toMatchObject({ installed: false, attempted: 0, completed: 0 });
				expect(graph.isValidated()).toBe(false);
			} finally { release.resolve(); state.onModuleDestroy(); producers.onModuleDestroy(); }
		});

	});

});
