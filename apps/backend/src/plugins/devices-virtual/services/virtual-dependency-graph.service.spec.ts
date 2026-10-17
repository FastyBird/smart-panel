import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EntityManager } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { ClimateAutomationParticipant, ClimateAutomationParticipantImage, ClimateAutomationProvider, climateAutomationJson, climateAutomationCanonical } from '../../../modules/devices/contracts/climate-automation.contract';
import { ClimateAutomationWriterService } from '../../../modules/devices/services/climate-automation-writer.service';
import { ClimateAutomationRegistryService } from '../../../modules/devices/services/climate-automation.registry.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { VirtualGraphRevisionEntity } from '../entities/virtual-producer.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualProducerStateService } from './virtual-producer-state.service';

const gate = () => {
	let resolve: () => void = () => { throw new Error('Barrier not initialized'); };
	const promise = new Promise<void>((done) => { resolve = done; });
	return { promise, resolve: () => resolve() };
};
const id = '6d236055-8740-4f86-93bf-1fb7e1effaa7';

// New specification, not four inherited graph cases. All B cases are UNEXECUTED source drafts.
describe('dormant reserved graph and acknowledged observed-revision validation', () => {
	let directory: string, database: SqliteDataSource, peer: SqliteDataSource;
	let registry: ClimateAutomationRegistryService, writer: ClimateAutomationWriterService, graph: VirtualDependencyGraphService;
	let owner: { dispose: () => void }, provider: ClimateAutomationProvider;
	const config = new ConfigService({ FB_CLI: 'off' });
	const read = async (manager: EntityManager): Promise<ClimateAutomationParticipantImage | null> => {
		const rows = await manager.query<{ revision: number; document: string }[]>('SELECT revision,document FROM test_graph_participant WHERE id=?', [id]);
		const row = rows[0]; if (!row) return null;
		const parsed: unknown = JSON.parse(row.document);
		return { controllerId: id, documentVersion: 1, controllerRevision: row.revision,
			configuration: climateAutomationJson(parsed), comfort: {}, structural: climateAutomationJson(parsed), legacyBaseline: null };
	};
	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'vd1458-b-graph-'));
		database = await new SqliteDataSource({ type: 'sqlite', database: join(directory, 'own.sqlite'), synchronize: true, entities: [__dirname + '/../../../**/*.entity.ts'] }).initialize();
		peer = await new SqliteDataSource({ type: 'sqlite', database: join(directory, 'own.sqlite'), entities: [__dirname + '/../../../**/*.entity.ts'] }).initialize();
		await database.manager.insert(VirtualGraphRevisionEntity, { id: 1, revision: 0 });
		await database.query('CREATE TABLE test_graph_participant (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, document TEXT NOT NULL)');
		registry = new ClimateAutomationRegistryService(); writer = new ClimateAutomationWriterService(database, new DeviceStructureLockService(), registry, config);
		graph = new VirtualDependencyGraphService(database, config, writer);
		const participant: ClimateAutomationParticipant = {
			version: 1, graph,
			readInManager: (manager, turn) => { writer.assertParticipantTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ']); return read(manager); },
			normalizeInManager: async (manager, turn, _kind, desired, before) => {
				writer.assertParticipantTurn(manager, turn, ['NORMALIZE']);
				return { controllerId: id, documentVersion: 1, configuration: desired, structural: desired, comfort: before.comfort, legacyBaseline: before.legacyBaseline };
			},
			applyInManager: async (manager, turn, before, next) => {
				writer.assertParticipantTurn(manager, turn, ['APPLY']);
				const result = await manager.createQueryBuilder().update('test_graph_participant').set({ revision: next.controllerRevision, document: climateAutomationCanonical(next.configuration) })
					.where('id=:id AND revision=:revision', { id, revision: before.controllerRevision }).execute();
				if (result.affected !== 1) throw new Error('Unexpected TEST participant CAS failure');
			},
		};
		provider = { participantV1: participant,
			readControllerInManager: async (manager) => { const image = await read(manager); return image ? { controllerRevision: image.controllerRevision, graphRevision: await graph.revision(manager), evidence: climateAutomationJson(image), legacyBaseline: null } : null; },
			validateSelectionInManager: async () => true,
			createControllerInManager: async (manager) => { await manager.query('INSERT INTO test_graph_participant VALUES (?,1,?)', [id, '{}']); },
		};
		const registration = registry.registerProviderOwned('test-graph:v1', provider); if (!registration) throw new Error('Missing actual provider owner'); owner = registration;
		await writer.runReserved(async (manager, scope) => writer.initializeSlot(manager, scope, { providerKey: 'test-graph:v1', controllerId: id,
			expected: await writer.readSlot(manager, scope, id), configuration: {} }));
	});
	afterEach(async () => { registry.onModuleDestroy(); jest.restoreAllMocks(); await peer.destroy(); await database.destroy(); await rm(directory, { recursive: true, force: true }); });
	const change = () => writer.runReserved(async (manager, scope) => writer.replaceController(manager, scope, { kind: 'replace-configuration:v1', providerKey: 'test-graph:v1', controllerId: id,
		expected: await writer.readParticipant(manager, scope, { providerKey: 'test-graph:v1', controllerId: id }), desiredDocument: { member: 1 } }));

	it('refuses a forged turn BEFORE graph query, with no missing-singleton ensure', async () => {
		const query = jest.spyOn(database.manager, 'findOneBy');
		await expect(graph.readReservedGraph(database.manager, { toJSON: () => ({}) })).rejects.toThrow();
		expect(query).not.toHaveBeenCalled(); expect(await graph.revision()).toBe(0);
	});
	it('refuses the actual legacy mutating producer-state listener before ANY callback or guarded metadata publication', async () => {
		const producers = new PropertyProducerRegistryService(new EventEmitter2());
		const state = new VirtualProducerStateService(database, producers, graph, new EventEmitter2(), config);
		await state.onModuleInit();
		const register = jest.spyOn(producers, 'register'), invalidate = jest.spyOn(producers, 'invalidate'), remove = jest.spyOn(producers, 'remove');
		const readonly = jest.fn(() => Promise.resolve()); graph.observeGuardedValidation(readonly);
		try {
			await expect(change()).rejects.toMatchObject({ commitOutcome: 'committed' });
			expect(register).not.toHaveBeenCalled(); expect(invalidate).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
			expect(readonly).not.toHaveBeenCalled(); expect(graph.isValidated()).toBe(false); expect(await graph.revision()).toBe(1);
		} finally { state.onModuleDestroy(); }
	});
	it('rejects a successor committed BEFORE its original snapshot rather than publishing successor metadata on old behalf', async () => {
		const entered = gate(), release = gate();
		const original = graph.validateAcknowledgedGraph;
		const observed = jest.spyOn(graph, 'validateAcknowledgedGraph').mockImplementation(async (job, ticket, revision) => {
			expect(JSON.stringify(job)).toBe('{}'); expect(JSON.stringify(ticket)).toBe('{}');
			entered.resolve(); await release.promise;
			const call: { call: (receiver: VirtualDependencyGraphService, ...args: Parameters<VirtualDependencyGraphService['validateAcknowledgedGraph']>) => ReturnType<VirtualDependencyGraphService['validateAcknowledgedGraph']> } = original;
			return call.call(graph, job, ticket, revision);
		});
		const readonly = jest.fn(() => Promise.resolve()); graph.observeGuardedValidation(readonly);
		const operation = change(); const rejected = expect(operation).rejects.toMatchObject({ commitOutcome: 'committed' });
		await entered.promise;
		await peer.query('UPDATE devices_virtual_graph_revision SET revision=2 WHERE id=1');
		release.resolve(); await rejected;
		expect(observed).toHaveBeenCalledTimes(1); expect(readonly).not.toHaveBeenCalled(); expect(graph.isRevisionCurrent(2)).toBe(false);
	});
	it.each(['foreign-only', 'newer-local-validation'])( 'does not falsely publish or clobber successor %s when an original readonly listener is held', async (schedule) => {
		const entered = gate(), release = gate(); graph.observeGuardedValidation(async () => { entered.resolve(); await release.promise; });
		const operation = change(); const rejected = expect(operation).rejects.toMatchObject({ commitOutcome: 'committed' });
		await entered.promise;
		const peerGraph = new VirtualDependencyGraphService(peer, config);
		await peerGraph.withStructuralWrite(() => Promise.resolve());
		if (schedule === 'newer-local-validation') { await graph.refreshQuarantine(); expect(graph.isRevisionCurrent(2)).toBe(true); }
		release.resolve(); await rejected;
		expect(graph.isRevisionCurrent(1)).toBe(false);
		expect(graph.isRevisionCurrent(2)).toBe(schedule === 'newer-local-validation');
	});
	it.each(['owner-ABA', 'listener-options'])( 'rejects original %s replacement during a listener without fresh rescue', async (boundary) => {
		const entered = gate(), release = gate(); const options = { requiresActivation: true };
		const ordinary = jest.fn(() => Promise.resolve()); graph.observeValidation(ordinary, options);
		graph.observeGuardedValidation(async () => { entered.resolve(); await release.promise; });
		const operation = change(); const rejected = expect(operation).rejects.toMatchObject({ commitOutcome: 'committed' });
		await entered.promise;
		if (boundary === 'owner-ABA') { owner.dispose(); expect(registry.registerProviderOwned('test-graph:v1', provider)).not.toBeNull(); }
		else options.requiresActivation = false;
		release.resolve(); await rejected;
		expect(ordinary).not.toHaveBeenCalled(); expect(graph.isValidated()).toBe(false);
	});
	it('demonstrates finite observed-revision proof, not continuous foreign-process authority', async () => {
		expect((await change()).outcome).toBe('applied'); expect(graph.isRevisionCurrent(1)).toBe(true);
		await peer.query('UPDATE devices_virtual_graph_revision SET revision=2 WHERE id=1');
		// Local cache still remembers observed1: callers MUST NOT treat that as continuous database authority.
		expect(graph.isRevisionCurrent(1)).toBe(true); expect(await graph.revision()).toBe(2);
	});
	it('keeps ordinary singleton initialization, revision preincrement and postcommit listener behavior independent', async () => {
		await database.manager.delete(VirtualGraphRevisionEntity, { id: 1 });
		const listener = jest.fn(() => Promise.resolve()); graph.observeValidation(listener);
		const value = Object.freeze({ original: true });
		expect(await graph.withStructuralWrite(() => Promise.resolve(value))).toBe(value);
		expect(await graph.revision()).toBe(1); expect(listener).toHaveBeenCalledTimes(1); expect(graph.isRevisionCurrent(1)).toBe(true);
		await expect(graph.withStructuralWrite(() => Promise.resolve(), 0)).rejects.toThrow('revision changed');
		expect(await graph.revision()).toBe(1);
	});
});
