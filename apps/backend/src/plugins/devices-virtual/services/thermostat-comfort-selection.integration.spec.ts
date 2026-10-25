import { plainToInstance } from 'class-transformer';
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto, { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { EntityManager } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';

import {
	SqliteCommitGuardReceipt,
	SqliteDataSource,
	observeSqliteOuterOutcome,
} from '../../../common/database/sqlite-data-source';
import { DeviceCategory } from '../../../modules/devices/devices.constants';
import * as ledgerJson from '../../../modules/devices/services/climate-automation-ledger.utils';
import { captureCreation } from '../../../modules/devices/services/creation-capture';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { ConfigureThermostatComfortDto, CreateThermostatOverrideDto } from '../dto/thermostat-comfort.dto';
import { VirtualDeviceEntity, VirtualDeviceMode } from '../entities/devices-virtual.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualThermostatOwnershipSubscriber } from '../subscribers/virtual-thermostat-ownership.subscriber';

import { thermostatComfortSelection } from './thermostat-comfort-selection';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { VirtualThermostatComfortService } from './virtual-thermostat-comfort.service';
import { ThermostatComfortConfiguration } from './virtual-thermostat-comfort.utils';
import { THERMOSTAT_CONFIG_CHANGED } from './virtual-thermostat-config.service';

interface NativeConnection {
	all(query: string, parameters: unknown[], callback: (error: Error | null, rows?: unknown[]) => void): unknown;
}
const gate = () => {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};
const configuration = (): ThermostatComfortConfiguration => ({
	heating_range: { minimum: 10, maximum: 30 },
	cooling_range: null,
	presets: [
		{ preset: 'comfort', setpoints: { heating_setpoint: 23, cooling_setpoint: null } },
		{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } },
		{ preset: 'away', setpoints: { heating_setpoint: 12, cooling_setpoint: null } },
	],
	selected_preset: null,
	user_off: false,
	automation_enabled: false,
	temporary_override: null,
});

const definition = () => ({
	heating_range: { minimum: 11, maximum: 29 },
	cooling_range: null,
	presets: [
		{ preset: 'eco' as const, setpoints: { heating_setpoint: 18, cooling_setpoint: null } },
		{ preset: 'comfort' as const, setpoints: { heating_setpoint: 24, cooling_setpoint: null } },
	],
});
const definedConfiguration = (): ThermostatComfortConfiguration => ({
	heating_range: { minimum: 11, maximum: 29 },
	cooling_range: null,
	presets: [
		{ preset: 'eco', setpoints: { heating_setpoint: 18, cooling_setpoint: null } },
		{ preset: 'comfort', setpoints: { heating_setpoint: 24, cooling_setpoint: null } },
	],
	selected_preset: null,
	user_off: false,
	automation_enabled: false,
	automation_baseline: null,
	temporary_override: null,
});
describe('manual thermostat selection: reserved native intent', () => {
	let database: SqliteDataSource;
	let lock: DeviceStructureLockService;
	let graph: VirtualDependencyGraphService;
	let claims: VirtualThermostatClaimsService;
	let comfort: VirtualThermostatComfortService;
	let events: EventEmitter2;
	let directory: string;
	let id: string;
	let wall: number;
	let monotonic: number;
	const sources: SqliteDataSource[] = [];
	const services: VirtualThermostatClaimsService[] = [];
	const row = () => database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
	const fence = async () => ({
		expected_revision: (await row()).revision,
		expected_graph_revision: await graph.revision(),
	});
	const native = () => Reflect.get(database.driver, 'databaseConnection') as NativeConnection;
	async function open(synchronize = false) {
		const source = new SqliteDataSource({
			type: 'sqlite',
			database: path.join(directory, 'selection.sqlite'),
			entities: [__dirname + '/../../../**/*.entity.ts'],
			synchronize,
		});
		sources.push(source);
		return source.initialize();
	}
	async function attach(source: SqliteDataSource) {
		const structure = new DeviceStructureLockService();
		const dependency = new VirtualDependencyGraphService(source);
		const emitter = new EventEmitter2();
		const ownership = new VirtualThermostatClaimsService(
			source,
			structure,
			dependency,
			new PropertyCommandAdmissionRegistryService(),
			emitter,
		);
		services.push(ownership);
		await new VirtualThermostatOwnershipSubscriber(source, ownership).onApplicationBootstrap();
		await ownership.onApplicationBootstrap();
		return {
			lock: structure,
			graph: dependency,
			claims: ownership,
			events: emitter,
			comfort: new VirtualThermostatComfortService(source, structure, dependency, ownership, emitter),
		};
	}
	beforeEach(async () => {
		wall = Date.UTC(2026, 9, 25);
		monotonic = 100;
		jest.spyOn(Date, 'now').mockImplementation(() => wall);
		jest.spyOn(performance, 'now').mockImplementation(() => monotonic);
		directory = mkdtempSync(path.join(tmpdir(), 'selection-native-'));
		database = await open(true);
		({ lock, graph, claims, comfort, events } = await attach(database));
		id = randomUUID();
		await database.manager.insert(VirtualDeviceEntity, {
			id,
			name: 'Manual intent',
			enabled: true,
			category: DeviceCategory.THERMOSTAT,
			mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
		});
		await database.manager.insert(VirtualThermostatConfigEntity, {
			controllerId: id,
			ownerDeviceId: id,
			revision: 1,
			schemaVersion: 1,
			requestedMode: 'heat',
			locked: false,
			comfort: configuration(),
			policy: {
				heatingSetpoint: 20,
				coolingSetpoint: null,
				coldTolerance: 0.5,
				hotTolerance: 0.5,
				neutralMargin: 1,
				minimumOffMs: 0,
				changeoverMs: 0,
				floor: null,
			},
			contactOpeningMs: 0,
			contactClosingMs: 0,
			configuredAt: new Date(wall),
		});
	});
	afterEach(async () => {
		jest.restoreAllMocks();
		for (const service of services.splice(0)) service.onModuleDestroy();
		for (const source of sources.splice(0)) if (source.isInitialized) await source.destroy();
		if (directory) rmSync(directory, { recursive: true, force: true });
	});

	it('rejects a genuinely deleted/recreated UUID with a retained FK-null configuration', async () => {
		const input = await fence();
		await database.manager.delete(VirtualDeviceEntity, { id });
		await database.manager.insert(VirtualDeviceEntity, {
			id,
			name: 'Successor',
			category: DeviceCategory.THERMOSTAT,
			enabled: true,
			mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
		});
		expect((await row()).ownerDeviceId).toBeNull();
		await expect(comfort.select(id, input, 'eco', false)).rejects.toThrow('detached');
		expect((await row()).revision).toBe(input.expected_revision);
		expect(await graph.revision()).toBe(input.expected_graph_revision);
	});

	it.each(['selection', 'definition'] as const)(
		'rejects lost UPDATE and wrong postimage for %s before native submission',
		async (kind) => {
			const before = await fence();
			const dispatch = jest.spyOn(native(), 'all');
			await database.query(
				'CREATE TRIGGER ignore_selection BEFORE UPDATE ON devices_virtual_thermostat_configs BEGIN SELECT RAISE(IGNORE); END',
			);
			const write = () =>
				kind === 'selection' ? comfort.select(id, before, 'eco', false) : comfort.configure(id, before, definition());
			await expect(write()).rejects.toThrow('conditional update');
			expect(dispatch.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
			await database.query('DROP TRIGGER ignore_selection');
			await database.query(
				"CREATE TRIGGER change_selection AFTER UPDATE ON devices_virtual_thermostat_configs BEGIN UPDATE devices_virtual_thermostat_configs SET comfort = json_set(NEW.comfort, '$.user_off', json('true')) WHERE controllerId = NEW.controllerId; END",
			);
			await expect(write()).rejects.toThrow('postimage');
			expect((await row()).comfort).toEqual(configuration());
			expect(await fence()).toEqual(before);
		},
	);

	it('captures direct dispatch before fence getters and snapshots each primitive fence once', async () => {
		const before = await fence();
		let reads = 0;
		const get = captureCreation(comfort, ['get']).values.get;
		const replacement = jest.fn((controller: string) => get.call(comfort, controller));
		try {
			await expect(
				comfort.select(
					id,
					{
						get expected_revision() {
							reads++;
							comfort.get = replacement;
							return before.expected_revision;
						},
						get expected_graph_revision() {
							reads++;
							return before.expected_graph_revision;
						},
					},
					'eco',
					false,
				),
			).rejects.toThrow('dispatch expired');
			expect(reads).toBe(2);
			expect(replacement).not.toHaveBeenCalled();
		} finally {
			comfort.get = get;
		}
		expect(await fence()).toEqual(before);
	});

	it('serializes a real independent writer through reservation, then retains A while durable B wins', async () => {
		const otherSource = await open();
		const other = await attach(otherSource);
		expect(other.lock).not.toBe(lock);
		expect(Reflect.get(otherSource.driver, 'databaseConnection')).not.toBe(native());
		const reserved = gate(),
			releaseA = gate(),
			bAttempted = gate(),
			aAck = gate(),
			releaseFinal = gate();
		const input = await fence();
		const order: string[] = [];
		let holding = false;
		let bDone = false;
		database.subscribers.push({
			afterQuery: async (event) => {
				if (!holding && event.query.startsWith('INSERT OR IGNORE INTO "devices_virtual_graph_revision"')) {
					holding = true;
					order.push('A-reserved');
					reserved.resolve();
					await releaseA.promise;
				}
			},
		});
		otherSource.subscribers.push({
			beforeQuery: (event) => {
				if (event.query.startsWith('INSERT OR IGNORE INTO "devices_virtual_graph_revision"')) bAttempted.resolve();
			},
			afterTransactionCommit: () => {
				order.push('B-ACK');
			},
		});
		const currentGet = comfort.get.bind(comfort) as VirtualThermostatComfortService['get'];
		const finalGet = jest.spyOn(comfort, 'get').mockImplementation(async (controller) => {
			order.push('A-final-get');
			aAck.resolve();
			await releaseFinal.promise;
			return currentGet(controller);
		});
		const a = comfort.select(id, input, 'eco', false);
		let b: Promise<void> | undefined;
		try {
			await Promise.race([reserved.promise, a]);
			b = other.lock.runExclusive(async () => {
				await other.graph.withStructuralWrite(async (manager) => {
					order.push('B-reserved');
					const current = await manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
					current.comfort.selected_preset = 'away';
					current.policy.heatingSetpoint = 21;
					current.revision++;
					await manager.save(current);
				});
				bDone = true;
			});
			await bAttempted.promise;
			expect(bDone).toBe(false);
			expect(order).not.toContain('B-reserved');
			releaseA.resolve();
			await Promise.race([aAck.promise, a]);
			await b;
			expect(bDone).toBe(true);
			releaseFinal.resolve();
			const result = await a;
			expect(result).toEqual({
				controller: id,
				revision: 2,
				graph_revision: input.expected_graph_revision + 1,
				configuration: { ...configuration(), selected_preset: 'eco' },
				effective: {
					source: 'preset',
					preset: 'eco',
					heating_setpoint: 17,
					cooling_setpoint: null,
					override_id: null,
					expires_at: null,
				},
				clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit',
			});
			expect(finalGet).toHaveBeenCalledTimes(1);
			expect((await row()).revision).toBe(3);
			expect((await row()).comfort.selected_preset).toBe('away');
			expect((await currentGet(id)).effective).toMatchObject({
				source: 'preset',
				preset: 'away',
				heating_setpoint: 12,
			});
			expect(order.indexOf('B-reserved')).toBeGreaterThan(order.indexOf('A-reserved'));
		} finally {
			releaseA.resolve();
			releaseFinal.resolve();
			await Promise.allSettled([a, ...(b !== undefined ? [b] : [])]);
		}
	});

	it.each(['dispatch', 'source', 'owner', 'owner-accessor'] as const)(
		'refuses expired original %s at the actual COMMIT seam with zero submission',
		async (kind) => {
			const input = await fence();
			const originalGet = captureCreation(comfort, ['get']).values.get;
			const sourceDescriptor = Object.getOwnPropertyDescriptor(database, 'isInitialized');
			const contextDescriptor = Object.getOwnPropertyDescriptor(lock, 'context');
			let getterCalls = 0;
			let originalContext: { active: boolean } | undefined;
			const dispatch = jest.spyOn(native(), 'all');
			database.subscribers.push({
				beforeQuery: (event) => {
					// Expire only COMMIT admission; inherited rollback reconciliation still owns cleanup.
					if (event.query === 'ROLLBACK') {
						if (originalContext) originalContext.active = true;
						Object.defineProperty(lock, 'context', contextDescriptor);
					}
					if (event.query !== 'COMMIT') return;
					if (kind === 'dispatch') comfort.get = () => Promise.reject(new Error('successor must not execute'));
					if (kind === 'source')
						Object.defineProperty(database, 'isInitialized', { ...sourceDescriptor, value: false });
					if (kind === 'owner-accessor')
						Object.defineProperty(lock, 'context', {
							configurable: true,
							get: () => {
								getterCalls++;
								throw new Error('replacement getter must not execute');
							},
						});
					if (kind === 'owner') {
						originalContext = (Reflect.get(lock, 'context') as AsyncLocalStorage<{ active: boolean }>).getStore();
						originalContext.active = false;
					}
				},
			});
			try {
				await expect(comfort.select(id, input, 'eco', false)).rejects.toMatchObject({
					driverError: { name: 'SqliteCommitGuardRefusedError' },
				});
				expect(dispatch.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
			} finally {
				comfort.get = originalGet;
				Object.defineProperty(database, 'isInitialized', sourceDescriptor);
				Object.defineProperty(lock, 'context', contextDescriptor);
			}
			expect((await row()).revision).toBe(1);
			expect(await graph.revision()).toBe(input.expected_graph_revision);
			expect(getterCalls).toBe(0);
		},
	);

	it.each(['selection', 'definition'] as const)(
		'rejects %s UNKNOWN at native callback without normal changed/get despite durable commit',
		async (kind) => {
			const connection = native(),
				all = connection.all.bind(connection) as NativeConnection['all'];
			const cause = new Error('native acknowledgement unavailable');
			let receipt: SqliteCommitGuardReceipt;
			database.subscribers.push({
				beforeTransactionCommit: (event) => {
					receipt = observeSqliteOuterOutcome(event.manager);
				},
			});
			jest.spyOn(connection, 'all').mockImplementation(function (sql, parameters, callback) {
				return all(sql, parameters, function (error, rows) {
					callback.call(this, sql === 'COMMIT' && !error ? cause : error, rows);
				});
			});
			const notified = jest.fn();
			events.on(THERMOSTAT_CONFIG_CHANGED, notified);
			const get = jest.spyOn(comfort, 'get');
			await expect(
				kind === 'selection'
					? comfort.select(id, await fence(), 'eco', false)
					: comfort.configure(id, await fence(), definition()),
			).rejects.toMatchObject({ driverError: cause });
			expect(receipt.outcome).toBe('unknown');
			expect(notified).not.toHaveBeenCalled();
			expect(get).not.toHaveBeenCalled();
			expect((await row()).revision).toBe(2);
			expect((await row()).comfort.selected_preset).toBe(kind === 'selection' ? 'eco' : null);
		},
	);

	it.each(['subscriber', 'release', 'definition-subscriber'] as const)(
		'retains ACK/result and the exact falsy awaited %s error independently',
		async (phase) => {
			const pinned = thermostatComfortSelection.pin(database);
			const input =
				phase === 'definition-subscriber'
					? pinned.definitionInput(id, await fence(), definition())
					: pinned.input(id, await fence(), 'eco', false);
			let ownerCurrent = () => false;
			const operation = pinned.operation(
				input,
				() => ownerCurrent(),
				() => true,
			);
			database.subscribers.push({
				afterTransactionCommit: (event) => {
					if (phase !== 'release') throw JSON.parse('false') as unknown;
					const lease = Reflect.get(event.queryRunner, 'lease') as { release: () => void };
					const release = lease.release;
					lease.release = () => {
						lease.release = release;
						release();
						throw JSON.parse('false') as unknown;
					};
				},
			});
			await expect(
				lock.runExclusive(async () => {
					ownerCurrent = AsyncLocalStorage.bind(() => lock.hasCurrentStructuralLease());
					await graph.withComfortSelectionWrite(
						operation.write,
						input.expected_graph_revision,
						operation.admit,
						operation.accepted,
					);
				}),
			).rejects.toBe(false);
			expect(operation.settlement.outcome).toBe('committed');
			if (phase === 'definition-subscriber') expect(operation.settlement.result.value).toEqual(definedResult(input));
			else
				expect(operation.settlement.result.value).toMatchObject({
					revision: 2,
					configuration: { selected_preset: 'eco' },
				});
			expect(Object.isFrozen(operation.settlement.result.value.configuration.presets[0].setpoints)).toBe(true);
			expect((await row()).revision).toBe(2);
			const get = jest.spyOn(comfort, 'get');
			const notified = jest.fn();
			events.on(THERMOSTAT_CONFIG_CHANGED, notified);
			await expect(
				phase === 'definition-subscriber'
					? comfort.configure(id, await fence(), definition())
					: comfort.select(id, await fence(), 'away', false),
			).rejects.toBe(false);
			expect(get).not.toHaveBeenCalled();
			expect(notified).not.toHaveBeenCalled();
			expect((await row()).revision).toBe(3);
		},
	);

	it('drains an actual failed coordinator child before native submission, preserving its falsy cause', async () => {
		let child: Promise<unknown> | undefined;
		database.subscribers.push({
			beforeQuery: (event) => {
				if (event.query === 'COMMIT') {
					child = event.manager.query('SELECT selection_child_failure');
					void child.catch(() => undefined);
				} else if (event.query === 'SELECT selection_child_failure') throw JSON.parse('0') as unknown;
			},
		});
		const dispatch = jest.spyOn(native(), 'all');
		await expect(comfort.select(id, await fence(), 'eco', false)).rejects.toMatchObject({
			driverError: { name: 'SqliteCommitGuardRefusedError', cause: 0 },
		});
		expect(child).toBeDefined();
		await expect(child).rejects.toBe(0);
		expect(dispatch.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
		expect((await row()).revision).toBe(1);
	});

	it('keeps mandatory original changed and final maintenance after admission pins expire following ACK', async () => {
		const original = captureCreation(comfort, ['get']).values.get;
		const successor = jest.fn(() => Promise.reject(new Error('successor get must not be adopted')));
		const refreshed = jest.spyOn(claims, 'refresh');
		const notified = jest.fn();
		events.on(THERMOSTAT_CONFIG_CHANGED, notified);
		database.subscribers.push({
			afterTransactionCommit: () => {
				comfort.get = successor;
			},
		});
		try {
			const result = await comfort.select(id, await fence(), 'eco', false);
			expect(result.revision).toBe(2);
			expect(refreshed.mock.calls.length).toBeGreaterThanOrEqual(2);
			expect(notified).toHaveBeenCalledWith(id);
			expect(successor).not.toHaveBeenCalled();
		} finally {
			comfort.get = original;
		}
	});

	it('keeps original final settlement after a post-ACK settle replacement with an active override', async () => {
		await comfort.override(
			id,
			await fence(),
			{ preset: 'comfort', setpoints: null, expires_at: new Date(wall + 1000).toISOString() },
			'operator',
		);
		const input = await fence();
		const configurationAtAdmission = (await row()).comfort;
		const override = configurationAtAdmission.temporary_override;
		const original = captureCreation(comfort, ['settle']).values.settle;
		const originalSettle = jest.spyOn(comfort, 'settle');
		const finalGet = jest.spyOn(comfort, 'get');
		const successor = jest.fn(() => Promise.resolve());
		const notified = jest.fn();
		events.on(THERMOSTAT_CONFIG_CHANGED, notified);
		let replaced = false;
		database.subscribers.push({
			afterTransactionCommit: () => {
				if (replaced) return;
				replaced = true;
				comfort.settle = successor;
				wall += 1000;
				monotonic += 1000;
			},
		});
		try {
			const result = await comfort.select(id, input, 'eco', false);
			const current = await row();
			// This maintenance oracle must also fail against the exact original 6361369 service.
			expect(current.comfort.temporary_override.status).toBe('expired');
			expect(current.revision).toBe(input.expected_revision + 2);
			expect(successor).not.toHaveBeenCalled();
			expect(originalSettle).toHaveBeenCalledTimes(2);
			expect(finalGet).toHaveBeenCalledTimes(1);
			expect(notified.mock.calls).toEqual([[id], [id]]);
			expect(result).toEqual({
				controller: id,
				revision: input.expected_revision + 1,
				graph_revision: input.expected_graph_revision + 1,
				configuration: { ...configurationAtAdmission, selected_preset: 'eco' },
				effective: {
					heating_setpoint: 23,
					cooling_setpoint: null,
					source: 'override',
					preset: 'comfort',
					override_id: override.id,
					expires_at: override.expires_at,
				},
				clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit',
			});
		} finally {
			comfort.settle = original;
		}
	});

	it.each(['selection', 'definition', 'override', 'cancel'] as const)(
		'runs real ownership reconciliation and direct durable invariance for %s with notification retry',
		async (kind) => {
			if (kind === 'cancel') await comfort.override(id, await fence(), requestOverride(), 'original');
			await database.manager.insert(VirtualThermostatActuatorClaimEntity, {
				id: randomUUID(),
				controllerId: id,
				physicalIdentity: 'reserved-fixture',
				role: 'heating',
				state: 'missing',
				sourcePropertyId: null,
				sourcePropertyIdentity: 'retained-property',
				sourceDeviceId: null,
				sourceDeviceIdentity: 'retained-device',
				contractFingerprint: 'retained-contract',
				leaseSeconds: 30,
				revision: 1,
			});
			const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId: id });
			// Retained, unarmed records make direct-write invariance non-vacuous; no installation is activated.
			await database.query(
				`INSERT INTO devices_virtual_thermostat_sources
			(id,controllerId,role,sourcePropertyIdentity,contractFingerprint,maximumAgeSeconds)
			VALUES (?,?,'ambient','retained-source','retained-source-contract',60)`,
				[randomUUID(), id],
			);
			await database.query(
				`INSERT INTO devices_virtual_thermostat_member_protection
			(claimId,revision,sourcePropertyIdentity,physicalPropertyIdentity,contractFingerprint,maximumAgeSeconds)
			VALUES (?,4,'floor-source','physical-floor','floor-contract',30)`,
				[claim.id],
			);
			await database.query(
				`INSERT INTO devices_virtual_thermostat_cooling_dependencies
			(claimId,revision,dewPointIdentity,dewPointFingerprint,surfaceIdentity,physicalSurfaceIdentity,surfaceFingerprint,maximumAgeSeconds)
			VALUES (?,5,'dew-point','dew-contract','surface','physical-surface','surface-contract',30)`,
				[claim.id],
			);
			await database.query(
				`INSERT INTO devices_virtual_thermostat_recoveries
			(id,controllerId,claimId,physicalIdentity,previousPropertyIdentity,restoredPropertyId,actorId,reason,disconnectionAcknowledged,configurationRevision,claimRevision,createdAt)
			VALUES (?,?,?,'reserved-fixture','old-property','restored-property','operator','retained recovery',1,1,1,CURRENT_TIMESTAMP)`,
				[randomUUID(), id, claim.id],
			);
			await database.query(
				`INSERT INTO devices_virtual_thermostat_command_journal
			(id,controllerId,claimId,claimRevision,configurationRevision,decisionRevision,action,status,preparedAt)
			VALUES (?,?,?,1,1,7,'on','unknown',CURRENT_TIMESTAMP)`,
				[randomUUID(), id, claim.id],
			);
			await database.query(
				`INSERT INTO devices_virtual_thermostat_installation_audit
			(id,claimId,revision,action,actorId,occurredAt,snapshot)
			VALUES (?,?,3,'revoked','operator',CURRENT_TIMESTAMP,'{"retained":"unarmed"}')`,
				[randomUUID(), claim.id],
			);
			await database.query(`INSERT INTO devices_module_climate_automation_sources
			(generationId,ownerId,producerKey,subjectId,generationIndex,revision,isCurrent,state,evidence,evidenceDigest)
			VALUES ('retained-generation','retained-owner','activity:v1','retained-subject',3,2,1,'PENDING','{"retained":true}','retained-digest')`);
			await database.query(
				`INSERT INTO devices_module_climate_automation_slots
			(controllerId,providerKey,controllerIncarnation,slotRevision,manualGeneration,manualCounter,manualHold,state,legacyDigest)
			VALUES (?,'virtual-thermostat:v1','retained-incarnation',11,'retained-manual',7,1,'LEGACY','retained-legacy')`,
				[id],
			);
			claims.recordQualification({
				physicalIdentity: claim.physicalIdentity,
				upstreamWritersExcluded: true,
				opposedOutputsInterlocked: false,
				profile: {
					evidenceId: 'software-fixture-only',
					revision: 1,
					deviceId: 'fixture',
					firmware: 'fixture',
					model: 'SNSW-001P16EU',
					componentId: 0,
					releaseOrderingQualified: true,
					independentProtectionQualified: true,
					testedLeaseSeconds: { min: 1, max: 60 },
				},
			});
			expect(claims.qualification(claim, false)).not.toBeNull();
			const tables = (
				await database.query<{ name: string }[]>(
					"SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'devices_virtual_thermostat_%' OR name LIKE 'devices_module_climate_automation_%') ORDER BY name",
				)
			)
				.map(({ name }) => name)
				.filter((name) => name !== 'devices_virtual_thermostat_configs');
			const snapshot = async (manager: Pick<EntityManager, 'query'>): Promise<Record<string, unknown>> => {
				const records: Record<string, unknown> = {};
				for (const table of tables)
					records[table] = await manager.query<unknown[]>(`SELECT * FROM "${table}" ORDER BY rowid`);
				return records;
			};
			const before = await snapshot(database.manager);
			const beforeConfig = await row();
			const invalidated = jest.spyOn(claims, 'invalidate'),
				revoked = jest.spyOn(claims, 'revokeAllQualifications');
			const realRefresh = claims.refresh.bind(claims) as VirtualThermostatClaimsService['refresh'];
			const refresh = jest.spyOn(claims, 'refresh').mockImplementation(realRefresh);
			let seam: Record<string, unknown> | undefined;
			database.subscribers.push({
				beforeQuery: async (event) => {
					if (event.query === 'COMMIT') seam = await snapshot(event.manager);
				},
			});
			const failure = () => {
				throw new Error('listener pending');
			};
			events.on(THERMOSTAT_CONFIG_CHANGED, failure);
			const input = await fence();
			const result =
				kind === 'selection'
					? await comfort.select(id, input, 'eco', false)
					: kind === 'definition'
						? await comfort.configure(id, input, definition())
						: kind === 'override'
							? await comfort.override(id, input, requestOverride(), 'operator')
							: await comfort.cancel(id, input, beforeConfig.comfort.temporary_override.id);
			expect(seam).toEqual(before);
			expect(invalidated).toHaveBeenCalled();
			expect(revoked).toHaveBeenCalled();
			expect(claims.qualification(claim, false)).toBeNull();
			expect(refresh.mock.calls.length).toBeGreaterThanOrEqual(2);
			events.off(THERMOSTAT_CONFIG_CHANGED, failure);
			const notified = jest.fn();
			events.on(THERMOSTAT_CONFIG_CHANGED, notified);
			refresh.mockRejectedValueOnce(false);
			await comfort.settle(id); // existing caught failure keeps retry pending
			await comfort.settle(id);
			expect(notified).toHaveBeenCalledWith(id);
			expect((await row()).revision).toBe(result.revision);
			expect(await snapshot(database.manager)).toEqual(before);
			expect({ ...(await row()), comfort: beforeConfig.comfort, revision: beforeConfig.revision }).toEqual(
				beforeConfig,
			);
		},
	);

	it.each(['expire', 'uncertain', 'active'] as const)(
		'keeps final get %s maintenance while returning the reserved active override intent',
		async (kind) => {
			await comfort.override(
				id,
				await fence(),
				{ preset: 'comfort', setpoints: null, expires_at: new Date(wall + 1000).toISOString() },
				'operator',
			);
			const input = await fence();
			const original = (await row()).comfort.temporary_override;
			const changed = () => {
				if (kind === 'expire') {
					wall += 1000;
					monotonic += 1000;
				} else if (kind === 'uncertain') wall--;
				else {
					wall++;
					monotonic++;
				}
			};
			events.once(THERMOSTAT_CONFIG_CHANGED, changed);
			const result = await comfort.select(id, input, 'eco', false);
			expect(result.revision).toBe(input.expected_revision + 1);
			expect(result.configuration.temporary_override).toEqual(original);
			expect(result.effective).toMatchObject({ source: 'override', preset: 'comfort', heating_setpoint: 23 });
			const current = await row();
			if (kind === 'active') {
				expect(comfort.isCurrent(current)).toBe(true);
				expect(current.revision).toBe(result.revision);
				expect(current.comfort.temporary_override.wall_watermark_ms).toBe(wall);
			} else {
				expect(current.revision).toBe(result.revision + 1);
				expect(current.comfort.temporary_override.status).toBe(kind === 'expire' ? 'expired' : 'clock_uncertain');
			}
		},
	);

	it('keeps independently committed pre-settle expiry when selection becomes stale', async () => {
		await comfort.override(
			id,
			await fence(),
			{ preset: 'eco', setpoints: null, expires_at: new Date(wall + 1000).toISOString() },
			'operator',
		);
		const input = await fence();
		wall += 1000;
		monotonic += 1000;
		await expect(comfort.select(id, input, 'comfort', false)).rejects.toThrow('revision');
		expect((await row()).revision).toBe(input.expected_revision + 1);
		expect((await row()).comfort).toMatchObject({ selected_preset: null, temporary_override: { status: 'expired' } });
	});

	it('rejects the exact final-get error after ACK without replay and detaches retained nested values', async () => {
		const input = await fence();
		const failure = new Error('final maintenance failed');
		const final = jest.spyOn(comfort, 'get').mockRejectedValueOnce(failure);
		await expect(comfort.select(id, input, 'eco', false)).rejects.toBe(failure);
		expect(final).toHaveBeenCalledTimes(1);
		expect((await row()).revision).toBe(2);
		final.mockRestore();
		await comfort.override(
			id,
			await fence(),
			{ preset: 'comfort', setpoints: null, expires_at: new Date(wall + 1000).toISOString() },
			'operator',
		);
		let retained: ThermostatComfortConfiguration | undefined;
		const detach = ledgerJson.ownedJson;
		jest.spyOn(ledgerJson, 'ownedJson').mockImplementation((value) => {
			const result = detach(value);
			retained = (value as { configuration: ThermostatComfortConfiguration }).configuration;
			return result;
		});
		database.subscribers.push({
			beforeTransactionCommit: () => {
				expect(retained).toBeDefined();
				retained.presets[0].setpoints.heating_setpoint = 29;
				retained.temporary_override.resolved_setpoints.heating_setpoint = 28;
			},
		});
		const pinned = thermostatComfortSelection.pin(database);
		const next = await fence();
		const operation = pinned.operation(
			pinned.input(id, next, 'away', false),
			AsyncLocalStorage.bind(() => true),
			() => true,
		);
		await lock.runExclusive(() =>
			graph.withComfortSelectionWrite(
				operation.write,
				next.expected_graph_revision,
				operation.admit,
				operation.accepted,
			),
		);
		const first = operation.copy();
		first.configuration.presets[0].setpoints.heating_setpoint = 29;
		const second = operation.copy();
		expect(second.configuration.presets[0].setpoints.heating_setpoint).toBe(23);
		expect(second.configuration.temporary_override.resolved_setpoints.heating_setpoint).toBe(23);
		expect(retained.temporary_override.resolved_setpoints.heating_setpoint).toBe(28);
		expect((await row()).comfort.presets[0].setpoints.heating_setpoint).toBe(23);
	});

	it('refuses nested savepoint and foreign managers before their reservation', async () => {
		const pinned = thermostatComfortSelection.pin(database);
		const operation = pinned.operation(
			pinned.input(id, await fence(), 'eco', false),
			() => true,
			() => true,
		);
		expect(() => operation.admit(database.manager)).toThrow('coordinated scoped manager');
		await expect(
			database.transaction((manager) => manager.transaction((nested) => Promise.resolve(operation.admit(nested)))),
		).rejects.toThrow('exact open outer manager');
		expect((await row()).revision).toBe(1);
	});
	const definedResult = (
		input: { expected_revision: number; expected_graph_revision: number },
		configuration = definedConfiguration(),
	) => ({
		controller: id,
		revision: input.expected_revision + 1,
		graph_revision: input.expected_graph_revision + 1,
		configuration,
		effective: {
			heating_setpoint: 20,
			cooling_setpoint: null,
			source: configuration.user_off ? 'user_off' : 'manual',
			preset: null,
			override_id: null,
			expires_at: null,
		},
		clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit',
	});

	it.each(['DTO', 'plain'] as const)(
		'owns %s input before await; later valid nested mutations cannot change full admitted A',
		async (kind) => {
			const input = await fence();
			const plain = {
				...input,
				...definition(),
				automation_enabled: undefined,
			};
			const dto = kind === 'DTO' ? plainToInstance(ConfigureThermostatComfortDto, plain) : plain;
			if (kind === 'DTO') {
				expect(dto).toBeInstanceOf(ConfigureThermostatComfortDto);
				expect(Object.getPrototypeOf(dto.heating_range)).not.toBe(Object.prototype);
			}
			const held = gate();
			const original = comfort.settle.bind(comfort) as VirtualThermostatComfortService['settle'];
			jest.spyOn(comfort, 'settle').mockImplementationOnce(async (controller) => {
				await held.promise;
				await original(controller);
			});
			const a = comfort.configure(id, dto, dto);
			dto.presets[0].setpoints.heating_setpoint = 19;
			dto.heating_range.minimum = 12;
			dto.presets.reverse();
			held.resolve();
			const result = await a;
			expect({ row: (await row()).comfort, response: result }).toEqual({
				row: definedConfiguration(),
				response: definedResult(input),
			});
		},
	);

	it('reads aliased known fields once without enumerating unrelated getters', async () => {
		const input = await fence(),
			counts = { heating: 0, cooling: 0, range: 0 };
		const setpoints = {
			get heating_setpoint() {
				counts.heating++;
				return 18;
			},
			get cooling_setpoint(): number | null {
				counts.cooling++;
				return null;
			},
		};
		const payload = {
			...input,
			get heating_range() {
				counts.range++;
				return { minimum: 0, maximum: 30 };
			},
			cooling_range: null,
			presets: [
				{ preset: 'eco' as const, setpoints },
				{ preset: 'comfort' as const, setpoints },
			],
			get unrelated() {
				throw new Error('must not enumerate');
			},
			automation_enabled: null,
		};
		const result = await comfort.configure(id, payload, payload);
		expect(counts).toEqual({ heating: 1, cooling: 1, range: 1 });
		expect(result.configuration.heating_range.minimum).toBe(0);
		expect(result.configuration.presets.map((entry) => entry.setpoints.heating_setpoint)).toEqual([18, 18]);
	});

	it.each([undefined, null, false, 0, ''])(
		'propagates exact getter cause %p before maintenance/transaction',
		async (cause) => {
			const input = await fence(),
				before = await row();
			const settle = jest.spyOn(comfort, 'settle');
			const payload = {
				...definition(),
				get heating_range(): { minimum: number; maximum: number } {
					throw cause as unknown;
				},
			};
			await expect(comfort.configure(id, input, payload)).rejects.toBe(cause);
			expect(settle).not.toHaveBeenCalled();
			expect(await row()).toEqual(before);
			expect(await fence()).toEqual(input);
		},
	);

	it.each(['runComfortIntent', 'get'] as const)('pins original %s before nested input getters', async (key) => {
		const input = await fence(),
			original = Reflect.get(comfort, key) as unknown;
		const successor = jest.fn();
		const payload = {
			...definition(),
			get heating_range() {
				Reflect.set(comfort, key, successor);
				return { minimum: 11, maximum: 29 };
			},
		};
		try {
			await expect(comfort.configure(id, input, payload)).rejects.toThrow('dispatch expired');
			expect(successor).not.toHaveBeenCalled();
		} finally {
			Reflect.set(comfort, key, original);
		}
		expect(await fence()).toEqual(input);
	});

	it('refuses malformed selected shapes and unsafe fences before maintenance, plus stored capacities', async () => {
		const input = await fence(),
			settle = jest.spyOn(comfort, 'settle');
		for (const payload of [
			{ ...definition(), heating_range: undefined },
			{ ...definition(), heating_range: { minimum: NaN, maximum: 30 } },
			{ ...definition(), automation_enabled: 1 },
			{ ...definition(), presets: new Array(1) },
			{
				...definition(),
				presets: [{ preset: 'eco', setpoints: { heating_setpoint: undefined, cooling_setpoint: null } }],
			},
		])
			await expect(comfort.configure(id, input, payload as ReturnType<typeof definition>)).rejects.toThrow(
				'Invalid thermostat',
			);
		for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
			await expect(comfort.configure(id, { ...input, expected_revision: invalid }, definition())).rejects.toThrow(
				'revision fences',
			);
		for (const invalid of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1])
			await expect(comfort.configure(id, { ...input, expected_graph_revision: invalid }, definition())).rejects.toThrow(
				'revision fences',
			);
		expect(settle).not.toHaveBeenCalled();
		expect(await fence()).toEqual(input);
		const pinned = thermostatComfortSelection.pin(database);
		expect(() =>
			pinned.operation(
				{ kind: 'unknown' } as never,
				() => true,
				() => true,
			),
		).toThrow('intent kind');
		await database.manager.update(
			VirtualThermostatConfigEntity,
			{ controllerId: id },
			{ revision: Number.MAX_SAFE_INTEGER },
		);
		await expect(comfort.configure(id, await fence(), definition())).rejects.toThrow('overflowed');
		await database.query('UPDATE devices_virtual_graph_revision SET revision = ?', [Number.MAX_SAFE_INTEGER]);
		await expect(comfort.configure(id, await fence(), definition())).rejects.toThrow('overflow');
	});

	it.each(['omitted', 'undefined', 'null'] as const)(
		'defaults automation false on first definition for %s',
		async (flag) => {
			await database.manager.update(VirtualThermostatConfigEntity, { controllerId: id }, { comfort: null });
			const input = await fence();
			const payload =
				flag === 'omitted' ? definition() : { ...definition(), automation_enabled: flag === 'null' ? null : undefined };
			expect(await comfort.configure(id, input, payload)).toEqual(definedResult(input));
			expect((await row()).comfort).toEqual(definedConfiguration());
		},
	);

	it.each(['omitted', 'undefined', 'null', 'true', 'false'] as const)(
		'preserves exact baseline/nullish semantics for %s',
		async (flag) => {
			const baseline = { preset: 'away' as const, setpoints: null, actor_id: 'retained-actor', revision: 7 };
			await database.manager.update(
				VirtualThermostatConfigEntity,
				{ controllerId: id },
				{
					requestedMode: 'off',
					comfort: { ...configuration(), automation_enabled: flag !== 'true', automation_baseline: baseline },
				},
			);
			const input = await fence();
			const payload = {
				...definition(),
				presets: [
					...definition().presets,
					{ preset: 'away' as const, setpoints: { heating_setpoint: 13, cooling_setpoint: null } },
				],
			};
			const flagValue = flag === 'null' ? null : flag === 'true' ? true : flag === 'false' ? false : undefined;
			const request = flag === 'omitted' ? payload : { ...payload, automation_enabled: flagValue };
			if (flag === 'false') request.presets.pop(); // baseline-only name may be removed only after clearing
			const result = await comfort.configure(id, input, request);
			const expected = {
				...definedConfiguration(),
				presets:
					flag === 'false'
						? definedConfiguration().presets
						: [
								...definedConfiguration().presets,
								{ preset: 'away' as const, setpoints: { heating_setpoint: 13, cooling_setpoint: null } },
							],
				automation_enabled: flag !== 'false',
				automation_baseline: flag === 'false' ? null : baseline,
			};
			expect(result.configuration).toEqual(expected);
			expect((await row()).comfort).toEqual(expected);
			expect(result.effective).toEqual({
				source: flag === 'false' ? 'manual' : 'automation',
				preset: flag === 'false' ? null : 'away',
				heating_setpoint: flag === 'false' ? 20 : 13,
				cooling_setpoint: null,
				override_id: null,
				expires_at: null,
			});
		},
	);

	it.each(['active', 'clock_uncertain', 'expired', 'cancelled'] as const)(
		'retains complete %s override without re-resolving edited or removed names',
		async (status) => {
			const override = {
				id: randomUUID(),
				source: 'panel' as const,
				actor_id: 'original-actor',
				revision: 9,
				created_at: new Date(wall).toISOString(),
				expires_at: new Date(wall + 10000).toISOString(),
				original_duration_ms: 10000,
				wall_watermark_ms: wall,
				preset: 'comfort' as const,
				setpoints: null,
				resolved_setpoints: { heating_setpoint: 23, cooling_setpoint: null },
				status,
				terminated_at: status === 'expired' || status === 'cancelled' ? new Date(wall).toISOString() : null,
			};
			await database.manager.update(
				VirtualThermostatConfigEntity,
				{ controllerId: id },
				{ comfort: { ...configuration(), temporary_override: override } },
			);
			for (const presets of [definition().presets, definition().presets.slice(0, 1)]) {
				const input = await fence();
				const result = await comfort.configure(id, input, { ...definition(), presets });
				expect(result.configuration).toEqual({ ...definedConfiguration(), presets, temporary_override: override });
				expect((await row()).comfort).toEqual({ ...definedConfiguration(), presets, temporary_override: override });
				expect(result.effective.heating_setpoint).toBe(status === 'active' || status === 'clock_uncertain' ? 23 : 20);
			}
			if (status === 'active' || status === 'clock_uncertain')
				await expect(
					comfort.configure(id, await fence(), {
						...definition(),
						heating_range: { minimum: 11, maximum: 22 },
						presets: [],
					}),
				).rejects.toThrow('setpoint_range');
		},
	);

	it('allows first definitions/empty presets and preserves OFF default versus existing false; validates reserved policy', async () => {
		for (const requestedMode of ['off', 'heat'] as const) {
			await database.manager.update(
				VirtualThermostatConfigEntity,
				{ controllerId: id },
				{ comfort: null, requestedMode },
			);
			const result = await comfort.configure(id, await fence(), { ...definition(), presets: [] });
			expect(result.configuration).toEqual({
				...definedConfiguration(),
				presets: [],
				user_off: requestedMode === 'off',
			});
		}
		await database.manager.update(
			VirtualThermostatConfigEntity,
			{ controllerId: id },
			{ requestedMode: 'off', comfort: { ...configuration(), selected_preset: 'away' } },
		);
		const input = await fence();
		await expect(comfort.configure(id, input, definition())).rejects.toThrow('invalid_preset');
		await database.manager.update(VirtualThermostatConfigEntity, { controllerId: id }, { comfort: configuration() });
		for (const payload of [
			{ ...definition(), heating_range: { minimum: 21, maximum: 30 } },
			{ ...definition(), cooling_range: { minimum: 10, maximum: 30 } },
			{
				...definition(),
				presets: [{ preset: 'eco' as const, setpoints: { heating_setpoint: 18, cooling_setpoint: 25 } }],
			},
		])
			await expect(comfort.configure(id, input, payload)).rejects.toThrow();
		expect(await fence()).toEqual(input);
		await database.manager.update(VirtualThermostatConfigEntity, { controllerId: id }, { comfort: configuration() });
		const result = await comfort.configure(id, input, definition());
		expect(result.configuration.user_off).toBe(false);
		const current = await row();
		await database.manager.update(
			VirtualThermostatConfigEntity,
			{ controllerId: id },
			{ policy: { ...current.policy, coolingSetpoint: 25 } },
		);
		await expect(
			comfort.configure(id, await fence(), {
				heating_range: { minimum: 10, maximum: 30 },
				cooling_range: { minimum: 10, maximum: 30 },
				presets: [{ preset: 'eco', setpoints: { heating_setpoint: 24, cooling_setpoint: 24 } }],
			}),
		).rejects.toThrow('overlapping_setpoints');
	});

	it('keeps definition original final settle after ACK replacement/time advance, historical A, and exact final error', async () => {
		await comfort.override(
			id,
			await fence(),
			{ preset: 'comfort', setpoints: null, expires_at: new Date(wall + 1000).toISOString() },
			'operator',
		);
		const input = await fence(),
			override = (await row()).comfort.temporary_override;
		const original = captureCreation(comfort, ['settle']).values.settle;
		const settle = jest.spyOn(comfort, 'settle'),
			get = jest.spyOn(comfort, 'get'),
			successor = jest.fn(() => Promise.resolve());
		let advanced = false;
		database.subscribers.push({
			afterTransactionCommit: () => {
				if (!advanced) {
					advanced = true;
					comfort.settle = successor;
					wall += 1000;
					monotonic += 1000;
				}
			},
		});
		try {
			const result = await comfort.configure(id, input, definition());
			expect((await row()).comfort.temporary_override.status).toBe('expired');
			expect((await row()).revision).toBe(input.expected_revision + 2);
			expect(successor).not.toHaveBeenCalled();
			expect(settle).toHaveBeenCalledTimes(2);
			expect(get).toHaveBeenCalledTimes(1);
			expect(result).toEqual({
				...definedResult(input, { ...definedConfiguration(), temporary_override: override }),
				effective: {
					source: 'override',
					preset: 'comfort',
					heating_setpoint: 23,
					cooling_setpoint: null,
					override_id: override.id,
					expires_at: override.expires_at,
				},
			});
		} finally {
			comfort.settle = original;
		}
		get.mockRestore();
		const failure = false,
			final = jest.spyOn(comfort, 'get').mockRejectedValueOnce(failure),
			next = await fence();
		await expect(comfort.configure(id, next, definition())).rejects.toBe(failure);
		expect(final).toHaveBeenCalledTimes(1);
		expect((await row()).revision).toBe(next.expected_revision + 1);
	});
	// P06c oracles use fixed seed/request/clock values and an independently issued server UUID.
	const aId = 'd175660a-a4c6-48ac-9abb-251908c9bda1';
	const bId = 'b775660a-a4c6-48ac-9abb-251908c9bdb2';
	type LocalMap = NonNullable<Parameters<typeof thermostatComfortSelection.pin>[2]>;
	const localMap = (service = comfort) => Reflect.get(service, 'leases') as LocalMap;
	const requestOverride = (duration = 1000) => ({
		preset: 'comfort' as const,
		setpoints: null,
		expires_at: new Date(wall + duration).toISOString(),
	});
	const recordOverride = (revision: number, identity = aId, start = wall, duration = 1000) => ({
		id: identity,
		source: 'user' as const,
		actor_id: 'operator',
		revision,
		preset: 'comfort' as const,
		setpoints: null,
		created_at: new Date(start).toISOString(),
		expires_at: new Date(start + duration).toISOString(),
		original_duration_ms: duration,
		wall_watermark_ms: start,
		resolved_setpoints: { heating_setpoint: 23, cooling_setpoint: null },
		status: 'active' as const,
		terminated_at: null,
	});
	const lifecycleResult = (input: Awaited<ReturnType<typeof fence>>, configured: ThermostatComfortConfiguration) => {
		const active = ['active', 'clock_uncertain'].includes(configured.temporary_override?.status)
			? configured.temporary_override
			: null;
		return {
			controller: id,
			revision: input.expected_revision + 1,
			graph_revision: input.expected_graph_revision + 1,
			configuration: configured,
			effective: {
				source: configured.user_off ? 'user_off' : active ? 'override' : 'manual',
				preset: active?.preset ?? null,
				heating_setpoint: active?.resolved_setpoints.heating_setpoint ?? 20,
				cooling_setpoint: null,
				override_id: active?.id ?? null,
				expires_at: active?.expires_at ?? null,
			},
			clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit',
		};
	};

	it.each(['plain', 'DTO'] as const)(
		'owns override %s aliases once before await and ignores unrelated fields',
		async (kind) => {
			const input = await fence(),
				reads = { revision: 0, graph: 0, heat: 0, cool: 0 };
			const plain = {
				...input,
				preset: null,
				setpoints: { heating_setpoint: 0, cooling_setpoint: null },
				expires_at: new Date(wall + 1000).toISOString(),
			};
			const dto = kind === 'DTO' ? plainToInstance(CreateThermostatOverrideDto, plain) : plain;
			Object.defineProperties(dto, {
				expected_revision: {
					get: () => {
						reads.revision++;
						return input.expected_revision;
					},
				},
				expected_graph_revision: {
					get: () => {
						reads.graph++;
						return input.expected_graph_revision;
					},
				},
				unrelated: {
					get: () => {
						throw new Error('not a supported field');
					},
				},
			});
			let target = 0;
			Object.defineProperties(dto.setpoints, {
				heating_setpoint: {
					get: () => {
						reads.heat++;
						return target;
					},
				},
				cooling_setpoint: {
					get: () => {
						reads.cool++;
						return null;
					},
				},
			});
			await database.manager.update(
				VirtualThermostatConfigEntity,
				{ controllerId: id },
				{ comfort: { ...configuration(), heating_range: { minimum: 0, maximum: 30 } } },
			);
			jest.spyOn(crypto, 'randomUUID').mockReturnValue(aId);
			const hold = gate(),
				original = comfort.settle.bind(comfort) as VirtualThermostatComfortService['settle'];
			jest.spyOn(comfort, 'settle').mockImplementationOnce(async (controller) => {
				await hold.promise;
				await original(controller);
			});
			const pending = comfort.override(id, dto, dto, 'operator');
			target = 1;
			dto.expires_at = new Date(wall + 2000).toISOString();
			hold.resolve();
			const expected = {
				...recordOverride(2),
				preset: null,
				setpoints: { heating_setpoint: 0, cooling_setpoint: null },
				resolved_setpoints: { heating_setpoint: 0, cooling_setpoint: null },
			};
			expect(await pending).toEqual(
				lifecycleResult(input, {
					...configuration(),
					heating_range: { minimum: 0, maximum: 30 },
					temporary_override: expected,
				}),
			);
			expect((await row()).comfort.temporary_override).toEqual(expected);
			expect(reads).toEqual({ revision: 1, graph: 1, heat: 1, cool: 1 });
		},
	);

	it.each([undefined, null, false, 0, ''])('keeps exact new-kind getter cause %p before maintenance', async (cause) => {
		const input = await fence(),
			settle = jest.spyOn(comfort, 'settle');
		await expect(
			comfort.override(
				id,
				input,
				{
					...requestOverride(),
					get setpoints(): null {
						throw cause as unknown;
					},
				},
				'operator',
			),
		).rejects.toBe(cause);
		await expect(
			comfort.cancel(
				id,
				{
					get expected_revision(): number {
						throw cause as unknown;
					},
					expected_graph_revision: input.expected_graph_revision,
				},
				aId,
			),
		).rejects.toBe(cause);
		expect(settle).not.toHaveBeenCalled();
		expect(await fence()).toEqual(input);
	});

	it.each(['now', 'parse', 'iso', 'mono', 'uuid', 'set', 'get', 'delete'] as const)(
		'captures new-kind %s dispatch before getters',
		async (key) => {
			const map = localMap();
			const target =
				key === 'now' || key === 'parse'
					? Date
					: key === 'iso'
						? Date.prototype
						: key === 'mono'
							? performance
							: key === 'uuid'
								? crypto
								: map;
			const field = key === 'iso' ? 'toISOString' : key === 'mono' ? 'now' : key === 'uuid' ? 'randomUUID' : key;
			const descriptor = Object.getOwnPropertyDescriptor(target, field);
			const replacement = jest.fn(() => {
				throw new Error('successor must not execute');
			});
			const input = await fence(),
				settle = jest.spyOn(comfort, 'settle');
			const swapped = {
				get expected_revision() {
					Object.defineProperty(target, field, { configurable: true, value: replacement });
					return input.expected_revision;
				},
				expected_graph_revision: input.expected_graph_revision,
			};
			try {
				await expect(
					key === 'delete'
						? comfort.cancel(id, swapped, aId)
						: comfort.override(id, swapped, requestOverride(), 'operator'),
				).rejects.toThrow('expired');
				expect(replacement).not.toHaveBeenCalled();
				expect(settle).not.toHaveBeenCalled();
			} finally {
				if (descriptor) Object.defineProperty(target, field, descriptor);
				else Reflect.deleteProperty(target, field);
			}
			expect(await fence()).toEqual(input);
		},
	);

	it('does not add irrelevant clock or Map checks to selection/definition or monotonic/UUID checks to cancel', async () => {
		const input = await fence(),
			map = localMap(),
			date = Object.getOwnPropertyDescriptor(Date, 'now'),
			mono = Object.getOwnPropertyDescriptor(performance, 'now');
		const replacement = () => {
			throw new Error('irrelevant dispatch');
		};
		Object.defineProperty(map, 'set', { configurable: true, get: replacement });
		Object.defineProperty(Date, 'now', { configurable: true, get: replacement });
		try {
			const pin = thermostatComfortSelection.pin(database); // old pin(database) compatibility
			expect(pin.current()).toBe(true);
			pin.input(id, input, 'eco', false);
			pin.definitionInput(id, input, definition());
		} finally {
			Reflect.deleteProperty(map, 'set');
			Object.defineProperty(Date, 'now', date);
		}
		await comfort.override(id, await fence(), requestOverride(), 'operator');
		const uncertain = await row();
		uncertain.comfort.temporary_override.status = 'clock_uncertain';
		await database.manager.update(VirtualThermostatConfigEntity, { controllerId: id }, { comfort: uncertain.comfort });
		Object.defineProperty(performance, 'now', { configurable: true, get: replacement });
		try {
			await comfort.cancel(id, await fence(), (await row()).comfort.temporary_override.id);
		} finally {
			if (mono) Object.defineProperty(performance, 'now', mono);
			else Reflect.deleteProperty(performance, 'now');
		}
	});

	it.each([1, 7 * 86400000, 0, -1, 7 * 86400000 + 1])('keeps exact absolute-duration boundary %p', async (duration) => {
		jest.spyOn(crypto, 'randomUUID').mockReturnValue(aId);
		const input = await fence();
		if (duration > 0 && duration <= 7 * 86400000) {
			expect(await comfort.override(id, input, requestOverride(duration), 'operator')).toEqual(
				lifecycleResult(input, { ...configuration(), temporary_override: recordOverride(2, aId, wall, duration) }),
			);
			expect(localMap().get(id).deadline).toBe(monotonic + duration);
		} else {
			await expect(comfort.override(id, input, requestOverride(duration), 'operator')).rejects.toThrow('seven days');
			expect(await fence()).toEqual(input);
		}
	});

	it('samples wall only in the reserved phase and monotonic after UUID resolution; normalizes timezone without renewal', async () => {
		const start = wall,
			initial = monotonic,
			input = await fence();
		let reserved = false;
		const issuance = jest.spyOn(crypto, 'randomUUID').mockImplementation(() => {
			expect(reserved).toBe(true);
			monotonic = initial + 50;
			return aId;
		});
		database.subscribers.push({
			afterQuery: (event) => {
				if (/SELECT.*FROM "devices_module_devices" "owner"/.test(event.query)) {
					reserved = true;
					wall = start + 100;
				}
			},
		});
		const result = await comfort.override(
			id,
			input,
			{ preset: 'comfort', setpoints: null, expires_at: '2026-10-25T02:00:01+02:00' },
			'operator',
		);
		expect(reserved).toBe(true);
		expect(issuance).toHaveBeenCalledTimes(1);
		expect(result).toEqual(
			lifecycleResult(input, { ...configuration(), temporary_override: recordOverride(2, aId, start + 100, 900) }),
		);
		expect(localMap().get(id).deadline).toBe(initial + 50 + 900);
	});

	it('lets queue delay expire the absolute request without renewing it at entry or ACK', async () => {
		const entered = gate(),
			release = gate(),
			input = await fence(),
			request = requestOverride();
		const owner = lock.runExclusive(async () => {
			entered.resolve();
			await release.promise;
		});
		await entered.promise;
		const a = comfort.override(id, input, request, 'operator');
		wall += 1000;
		monotonic += 1000;
		release.resolve();
		try {
			await expect(a).rejects.toThrow('seven days');
			expect(await fence()).toEqual(input);
		} finally {
			release.resolve();
			await Promise.allSettled([a, owner]);
		}
	});

	it.each([NaN, Infinity, -Infinity])(
		'refuses isolated nonfinite creation birth %p before A UPDATE/COMMIT/install',
		async (fault) => {
			const input = await fence();
			let birth = false,
				sampled = 0,
				reserved = false;
			jest.spyOn(crypto, 'randomUUID').mockImplementation(() => {
				expect(reserved).toBe(true);
				birth = true;
				return aId;
			});
			jest.spyOn(performance, 'now').mockImplementation(() => {
				if (birth) {
					birth = false;
					sampled++;
					return fault;
				}
				return monotonic;
			});
			const queries: string[] = [];
			database.subscribers.push({
				beforeQuery: (event) => {
					queries.push(event.query);
				},
				afterQuery: (event) => {
					if (/SELECT.*FROM "devices_module_devices" "owner"/.test(event.query)) reserved = true;
				},
			});
			const set = jest.spyOn(localMap(), 'set');
			await expect(comfort.override(id, input, requestOverride(), 'operator')).rejects.toThrow('initial clock');
			expect(sampled).toBe(1);
			expect(queries.filter((sql) => sql === 'COMMIT')).toEqual([]);
			expect(queries.filter((sql) => /^UPDATE "devices_virtual_thermostat_configs"/.test(sql))).toEqual([]);
			expect(set).not.toHaveBeenCalled();
			expect(await fence()).toEqual(input);
			expect((await row()).comfort).toEqual(configuration());
		},
	);

	it('accounts for an independent initial expiry even when the subsequent creation birth refuses', async () => {
		await comfort.override(id, await fence(), requestOverride(), 'old');
		const old = (await row()).comfort.temporary_override;
		wall += 1000;
		monotonic += 1000;
		const input = { expected_revision: 3, expected_graph_revision: (await graph.revision()) + 1 };
		let birth = false;
		jest.spyOn(crypto, 'randomUUID').mockImplementation(() => {
			birth = true;
			return aId;
		});
		jest.spyOn(performance, 'now').mockImplementation(() => {
			if (birth) {
				birth = false;
				return NaN;
			}
			return monotonic;
		});
		await expect(comfort.override(id, input, requestOverride(), 'operator')).rejects.toThrow('initial clock');
		expect((await row()).comfort.temporary_override).toEqual({
			...old,
			status: 'expired',
			terminated_at: new Date(wall).toISOString(),
		});
		expect(await fence()).toEqual(input);
		expect(localMap().has(id)).toBe(false);
	});

	it('has no premature current lease while real native ACK is held and never renews the initial deadline', async () => {
		jest.spyOn(crypto, 'randomUUID').mockReturnValue(aId);
		const input = await fence(),
			expected = lifecycleResult(input, { ...configuration(), temporary_override: recordOverride(2) });
		const connection = native(),
			all = connection.all.bind(connection) as NativeConnection['all'],
			held = gate();
		let acknowledge: (() => void) | undefined, proposed: VirtualThermostatConfigEntity;
		database.subscribers.push({
			beforeTransactionCommit: async (event) => {
				proposed = await event.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
			},
		});
		jest.spyOn(connection, 'all').mockImplementation(function (sql, parameters, callback) {
			return all(sql, parameters, function (error, rows) {
				if (sql === 'COMMIT' && !error && !acknowledge) {
					acknowledge = () => {
						callback.call(this, error, rows);
					};
					held.resolve();
				} else callback.call(this, error, rows);
			});
		});
		const a = comfort.override(id, input, requestOverride(), 'operator');
		try {
			await Promise.race([held.promise, a]);
			expect(proposed.comfort.temporary_override.id).toBe(aId);
			expect(comfort.isCurrent(proposed)).toBe(false);
			expect(localMap().has(id)).toBe(false);
			wall += 200;
			monotonic += 200;
			acknowledge();
			expect(await a).toEqual(expected);
			expect(localMap().get(id).deadline).toBe(1100);
			expect(Object.isFrozen(localMap().get(id))).toBe(false);
			expect(comfort.isCurrent(await row())).toBe(true);
			wall++;
			monotonic++;
			expect(comfort.isCurrent(await row())).toBe(true);
			expect(localMap().get(id).watermark).toBe(wall);
			await comfort.settle(id);
			expect((await row()).comfort.temporary_override.wall_watermark_ms).toBe(wall);
		} finally {
			acknowledge?.();
			await Promise.allSettled([a]);
		}
	});

	it.each(['active', 'clock_uncertain'] as const)(
		'cancels exact %s metadata using original system Date, independent of duration clock and creation revision',
		async (status) => {
			jest.spyOn(crypto, 'randomUUID').mockReturnValue(aId);
			await comfort.override(id, await fence(), requestOverride(), 'operator');
			await comfort.select(id, await fence(), null, false);
			const before = await row(),
				old = before.comfort.temporary_override;
			expect(old.revision).toBe(2);
			expect(localMap().get(id).revision).toBe(3);
			if (status === 'clock_uncertain') {
				old.status = status;
				old.resolved_setpoints.heating_setpoint = 99;
				await database.manager.update(VirtualThermostatConfigEntity, { controllerId: id }, { comfort: before.comfort });
				localMap().clear();
			}
			const input = await fence(),
				system = wall + 12345,
				originalDate = Date;
			class SystemDate extends originalDate {
				constructor(value: string | number = system) {
					super(value);
				}
			}
			const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Date');
			Object.defineProperty(globalThis, 'Date', { ...descriptor, value: SystemDate });
			try {
				const terminal = {
					...old,
					status: 'cancelled' as const,
					terminated_at: new originalDate(system).toISOString(),
				};
				expect(await comfort.cancel(id, input, aId)).toEqual(
					lifecycleResult(input, { ...configuration(), temporary_override: terminal }),
				);
				expect((await row()).comfort.temporary_override).toEqual(terminal);
				expect(localMap().has(id)).toBe(false);
			} finally {
				Object.defineProperty(globalThis, 'Date', descriptor);
			}
		},
	);

	it('retains cancellation mismatch/terminal/stale refusals and independent initial expiry', async () => {
		jest.spyOn(crypto, 'randomUUID').mockReturnValue(aId);
		await comfort.override(id, await fence(), requestOverride(), 'operator');
		const input = await fence();
		await expect(comfort.cancel(id, input, bId)).rejects.toThrow('Override identity/state changed');
		await expect(comfort.cancel(id, { ...input, expected_revision: 1 }, aId)).rejects.toThrow('revision');
		await expect(
			comfort.cancel(id, { ...input, expected_graph_revision: input.expected_graph_revision - 1 }, aId),
		).rejects.toThrow('graph revision');
		wall += 1000;
		monotonic += 1000;
		await expect(comfort.cancel(id, input, aId)).rejects.toThrow('revision');
		expect((await row()).comfort.temporary_override.status).toBe('expired');
		await expect(comfort.cancel(id, await fence(), aId)).rejects.toThrow('Override identity/state changed');
		await comfort.override(id, await fence(), requestOverride(), 'operator');
		await comfort.cancel(id, await fence(), aId);
		await expect(comfort.cancel(id, await fence(), aId)).rejects.toThrow('Override identity/state changed');
	});

	it.each(['override', 'cancel'] as const)(
		'rejects %s refusal/UNKNOWN/ACK-awaited errors with no initial local action',
		async (kind) => {
			for (const phase of ['refused', 'unknown', 'subscriber', 'release'] as const) {
				if (kind === 'cancel') await comfort.override(id, await fence(), requestOverride(), 'old');
				const input = await fence(),
					map = localMap(),
					reference = map.get(id),
					subscribers = [...database.subscribers];
				const connection = native(),
					all = connection.all.bind(connection) as NativeConnection['all'];
				const failure = new Error('native acknowledgement unavailable');
				if (phase === 'unknown')
					jest.spyOn(connection, 'all').mockImplementation(function (sql, parameters, callback) {
						return all(sql, parameters, function (error, rows) {
							callback.call(this, sql === 'COMMIT' && !error ? failure : error, rows);
						});
					});
				database.subscribers.push({
					beforeQuery: (event) => {
						if (phase === 'refused' && event.query === 'COMMIT') Reflect.set(database, 'isInitialized', false);
						if (event.query === 'ROLLBACK') Reflect.set(database, 'isInitialized', true);
					},
					afterTransactionCommit: (event) => {
						if (phase === 'subscriber') throw JSON.parse('false') as unknown;
						if (phase === 'release') {
							const lease = Reflect.get(event.queryRunner, 'lease') as { release: () => void };
							const release = lease.release;
							lease.release = () => {
								lease.release = release;
								release();
								throw JSON.parse('0') as unknown;
							};
						}
					},
				});
				const pinned = thermostatComfortSelection.pin(database, kind, map);
				const captured =
					kind === 'override'
						? pinned.overrideInput(id, input, requestOverride(), 'operator', 'user')
						: pinned.cancelInput(id, input, reference.id);
				let owner = () => false;
				const operation = pinned.operation(
					captured,
					() => owner(),
					() => true,
				);
				const execute = lock.runExclusive(async () => {
					owner = AsyncLocalStorage.bind(() => lock.hasCurrentStructuralLease());
					operation.captureSlot();
					await graph.withComfortSelectionWrite(
						operation.write,
						input.expected_graph_revision,
						operation.admit,
						operation.accepted,
					);
					operation.accepted();
					operation.localAction();
				});
				try {
					if (phase === 'subscriber' || phase === 'release')
						await expect(execute).rejects.toBe(phase === 'subscriber' ? false : 0);
					else
						await expect(execute).rejects.toMatchObject({
							driverError: phase === 'unknown' ? failure : { name: 'SqliteCommitGuardRefusedError' },
						});
					expect(operation.settlement.localAction).toBeUndefined();
					expect(map.get(id)).toBe(reference);
					expect(operation.settlement.outcome).toBe(
						phase === 'refused' ? 'refused' : phase === 'unknown' ? 'unknown' : 'committed',
					);
					if (phase !== 'refused') expect(operation.settlement.result.value.revision).toBe(input.expected_revision + 1);
				} finally {
					Reflect.set(database, 'isInitialized', true);
					database.subscribers.splice(0, database.subscribers.length, ...subscribers);
					jest.restoreAllMocks();
					jest.spyOn(Date, 'now').mockImplementation(() => wall);
					jest.spyOn(performance, 'now').mockImplementation(() => monotonic);
					await Promise.allSettled([execute]);
				}
			}
		},
	);

	it.each(['override', 'cancel'] as const)(
		'returns full historical %s A after completed independent B, preserving B identity and its separate lease',
		async (kind) => {
			const otherSource = await open(),
				other = await attach(otherSource);
			expect(other.lock).not.toBe(lock);
			expect(localMap(other.comfort)).not.toBe(localMap());
			expect(Reflect.get(otherSource.driver, 'databaseConnection')).not.toBe(native());
			jest.spyOn(crypto, 'randomUUID').mockReturnValue(aId);
			if (kind === 'cancel') await comfort.override(id, await fence(), requestOverride(), 'operator');
			const old = kind === 'cancel' ? recordOverride(2) : null,
				input = await fence();
			const originalDate = Date,
				system = new Date('2026-10-25T00:00:00Z'),
				descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Date');
			class FixedDate extends originalDate {
				constructor(value: string | number = system.getTime()) {
					super(value);
				}
			}
			Object.defineProperty(globalThis, 'Date', { ...descriptor, value: FixedDate });
			const expected = lifecycleResult(input, {
				...configuration(),
				temporary_override:
					kind === 'override'
						? recordOverride(2)
						: { ...old, status: 'cancelled', terminated_at: system.toISOString() },
			});
			const original = comfort.get.bind(comfort) as VirtualThermostatComfortService['get'];
			let successes = 0;
			const final = jest.spyOn(comfort, 'get').mockImplementation(async (controller, settle) => {
				jest.spyOn(crypto, 'randomUUID').mockReturnValue(bId);
				await other.comfort.override(
					id,
					await fence(),
					{
						preset: null,
						setpoints: { heating_setpoint: 19, cooling_setpoint: null },
						expires_at: new Date(wall + 2000).toISOString(),
					},
					'B',
					'panel',
				);
				successes++;
				return original(controller, settle);
			});
			try {
				const result =
					kind === 'override'
						? await comfort.override(id, input, requestOverride(), 'operator')
						: await comfort.cancel(id, input, aId);
				expect(successes).toBe(1);
				expect(result).toEqual(expected);
				expect(final).toHaveBeenCalledTimes(1);
				const current = await row();
				expect(current.revision).toBe(input.expected_revision + 2);
				expect(current.comfort.temporary_override).toEqual({
					...recordOverride(input.expected_revision + 2, bId, wall, 2000),
					preset: null,
					setpoints: { heating_setpoint: 19, cooling_setpoint: null },
					resolved_setpoints: { heating_setpoint: 19, cooling_setpoint: null },
					source: 'panel',
					actor_id: 'B',
				});
				expect(other.comfort.isCurrent(current)).toBe(true);
				expect(comfort.isCurrent(current)).toBe(true);
			} finally {
				Object.defineProperty(globalThis, 'Date', descriptor);
			}
		},
	);

	it.each(['override', 'cancel'] as const)(
		'has no delayed %s local action after same-service B at release/final-get',
		async (kind) => {
			jest.spyOn(crypto, 'randomUUID').mockReturnValue(aId);
			if (kind === 'cancel') await comfort.override(id, await fence(), requestOverride(), 'operator');
			const input = await fence(),
				original = comfort.get.bind(comfort) as VirtualThermostatComfortService['get'];
			let successes = 0;
			jest.spyOn(comfort, 'get').mockImplementation(async (controller, settle) => {
				if (!successes) {
					successes++;
					jest.spyOn(crypto, 'randomUUID').mockReturnValue(bId);
					await comfort.override(id, await fence(), requestOverride(2000), 'B');
				}
				return original(controller, settle);
			});
			const result =
				kind === 'override'
					? await comfort.override(id, input, requestOverride(), 'operator')
					: await comfort.cancel(id, input, aId);
			expect(result.revision).toBe(input.expected_revision + 1);
			expect(successes).toBe(1);
			const current = await row();
			expect(current.comfort.temporary_override.id).toBe(bId);
			expect(localMap().get(id).id).toBe(bId);
			expect(comfort.isCurrent(current)).toBe(true);
		},
	);

	it.each(['map', 'slot', 'revision', 'watermark', 'absent'] as const)(
		'guards the original cancellation %s slot at initial action, before final maintenance can mask it',
		async (change) => {
			jest.spyOn(crypto, 'randomUUID').mockReturnValue(aId);
			await comfort.override(id, await fence(), requestOverride(), 'operator');
			const map = localMap(),
				old = map.get(id),
				input = await fence();
			const replacement = { ...old, revision: old.revision + 10, deadline: old.deadline + 1 };
			const successor = new Map([[id, replacement]]);
			let seam = false;
			let originalAtSeam: ReturnType<LocalMap['get']>, successorAtSeam: ReturnType<LocalMap['get']>;
			database.subscribers.push({
				afterTransactionCommit: () => {
					if (change === 'map') Reflect.set(comfort, 'leases', successor);
					if (change === 'slot') map.set(id, replacement);
					if (change === 'revision') old.revision++;
					if (change === 'watermark') old.watermark++;
					if (change === 'absent') map.delete(id);
				},
			});
			events.once(THERMOSTAT_CONFIG_CHANGED, () => {
				seam = true;
				originalAtSeam = map.get(id);
				successorAtSeam = successor.get(id);
			});
			const get = jest.spyOn(comfort, 'get'),
				changed = jest.spyOn(claims, 'invalidate');
			await comfort.cancel(id, input, aId);
			expect(seam).toBe(true);
			if (change === 'map') expect(successorAtSeam).toBe(replacement);
			if (change === 'slot') expect(originalAtSeam).toBe(replacement);
			if (change === 'revision') expect(originalAtSeam).toBe(old);
			if (change === 'watermark' || change === 'absent' || change === 'map') expect(originalAtSeam).toBeUndefined();
			expect(get).toHaveBeenCalledTimes(1);
			expect(changed).toHaveBeenCalled();
			// Controlled dispatch/lifetime substitution, not a cross-process shared Map.
		},
	);

	it.each(['override', 'cancel'] as const)(
		'retains committed %s evidence and exact partially-acting falsy Map failure',
		async (kind) => {
			jest.spyOn(crypto, 'randomUUID').mockReturnValue(aId);
			if (kind === 'cancel') await comfort.override(id, await fence(), requestOverride(), 'operator');
			const input = await fence(),
				map = localMap(),
				key = kind === 'override' ? 'set' : 'delete';
			let afterAck = false;
			const set = map.set.bind(map) as LocalMap['set'],
				remove = map.delete.bind(map) as LocalMap['delete'];
			if (key === 'set')
				jest.spyOn(map, 'set').mockImplementation((controller, lease) => {
					set(controller, lease);
					if (afterAck) throw JSON.parse('false') as unknown;
					return map;
				});
			else
				jest.spyOn(map, 'delete').mockImplementation((controller) => {
					const result = remove(controller);
					if (afterAck) throw JSON.parse('false') as unknown;
					return result;
				});
			const pinned = thermostatComfortSelection.pin(database, kind, map),
				captured =
					kind === 'override'
						? pinned.overrideInput(id, input, requestOverride(), 'operator', 'user')
						: pinned.cancelInput(id, input, aId);
			let owner = () => false;
			const operation = pinned.operation(
				captured,
				() => owner(),
				() => true,
			);
			database.subscribers.push({
				afterTransactionCommit: () => {
					afterAck = true;
				},
			});
			await expect(
				lock.runExclusive(async () => {
					owner = AsyncLocalStorage.bind(() => lock.hasCurrentStructuralLease());
					operation.captureSlot();
					await graph.withComfortSelectionWrite(
						operation.write,
						input.expected_graph_revision,
						operation.admit,
						operation.accepted,
					);
					operation.accepted();
					operation.localAction();
				}),
			).rejects.toBe(false);
			expect(operation.settlement.outcome).toBe('committed');
			expect(operation.settlement.result.value.revision).toBe(input.expected_revision + 1);
			expect(operation.settlement.localFailure).toEqual({ cause: false });
			expect(operation.settlement.localAction.stage).toBe(kind === 'override' ? 'installing' : 'deleting');
			expect(map.has(id)).toBe(kind === 'override');
			expect((await row()).revision).toBe(input.expected_revision + 1);
		},
	);

	it('retains new override historical A through original final-settle replacement and expiry; rejects exact final error', async () => {
		jest.spyOn(crypto, 'randomUUID').mockReturnValue(aId);
		const input = await fence(),
			expected = lifecycleResult(input, { ...configuration(), temporary_override: recordOverride(2) });
		const original = captureCreation(comfort, ['settle']).values.settle,
			settle = jest.spyOn(comfort, 'settle'),
			get = jest.spyOn(comfort, 'get'),
			successor = jest.fn(() => Promise.resolve());
		let advanced = false;
		database.subscribers.push({
			afterTransactionCommit: () => {
				if (!advanced) {
					advanced = true;
					comfort.settle = successor;
					wall += 1000;
					monotonic += 1000;
				}
			},
		});
		try {
			expect(await comfort.override(id, input, requestOverride(), 'operator')).toEqual(expected);
			expect((await row()).revision).toBe(3);
			expect((await row()).comfort.temporary_override.status).toBe('expired');
			expect(successor).not.toHaveBeenCalled();
			expect(settle).toHaveBeenCalledTimes(2);
			expect(get).toHaveBeenCalledTimes(1);
		} finally {
			comfort.settle = original;
			get.mockRestore();
		}
		const failure = false,
			final = jest.spyOn(comfort, 'get').mockRejectedValueOnce(failure),
			next = await fence();
		await expect(comfort.override(id, next, requestOverride(), 'operator')).rejects.toBe(failure);
		expect(final).toHaveBeenCalledTimes(1);
		expect((await row()).revision).toBe(next.expected_revision + 1);
	});
	it.each([
		['override', 'slot'],
		['cancel', 'slot'],
		['override', 'map'],
		['cancel', 'map'],
	] as const)(
		'keeps an independently created B lease at the initial %s %s substitution seam',
		async (kind, substitution) => {
			// B has its own handle/lock/Map. Copying its lease into A below is an explicit lifetime control.
			const otherSource = await open(),
				other = await attach(otherSource);
			jest.spyOn(crypto, 'randomUUID').mockReturnValue(aId);
			if (kind === 'cancel') await comfort.override(id, await fence(), requestOverride(), 'operator');
			const map = localMap(),
				input = await fence();
			let installed = false,
				observed = false,
				bSuccess = 0;
			let initialLease: ReturnType<LocalMap['get']>, initialCurrent: boolean;
			let bRow: VirtualThermostatConfigEntity, bLease: ReturnType<LocalMap['get']>;
			database.subscribers.push({
				afterTransactionCommit: async () => {
					if (installed) return;
					installed = true;
					jest.spyOn(crypto, 'randomUUID').mockReturnValue(bId);
					const current = await otherSource.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
						controllerId: id,
					});
					await other.comfort.override(
						id,
						{ expected_revision: current.revision, expected_graph_revision: await other.graph.revision() },
						requestOverride(2000),
						'B',
					);
					bSuccess++;
					bRow = await otherSource.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
					bLease = localMap(other.comfort).get(id);
					expect(other.comfort.isCurrent(bRow)).toBe(true);
					if (substitution === 'map') Reflect.set(comfort, 'leases', new Map([[id, bLease]]));
					else map.set(id, bLease);
				},
			});
			const get = jest.spyOn(comfort, 'get');
			events.once(THERMOSTAT_CONFIG_CHANGED, () => {
				observed = true;
				initialLease = localMap().get(id);
				initialCurrent = comfort.isCurrent(bRow);
			});
			const result =
				kind === 'override'
					? await comfort.override(id, input, requestOverride(), 'operator')
					: await comfort.cancel(id, input, aId);
			expect(observed).toBe(true);
			expect(initialLease).toBe(bLease);
			expect(initialCurrent).toBe(true);
			expect(bSuccess).toBe(1);
			expect(get).toHaveBeenCalledTimes(1);
			expect(result.revision).toBe(input.expected_revision + 1);
			expect((await row()).comfort.temporary_override.id).toBe(bId);
			expect(localMap().get(id)).toBe(bLease);
			expect(comfort.isCurrent(await row())).toBe(true);
		},
	);

	it('owns override input validation, XOR/branches and safe fences without changing reserved whole-comfort policy', async () => {
		const input = await fence(),
			payload = requestOverride(),
			settle = jest.spyOn(comfort, 'settle');
		for (const invalid of [undefined, NaN, Infinity, '20'])
			await expect(
				comfort.override(
					id,
					input,
					{ ...payload, preset: null, setpoints: { heating_setpoint: invalid as number, cooling_setpoint: null } },
					'operator',
				),
			).rejects.toThrow('setpoint_range');
		for (const actor of ['', null, false])
			await expect(comfort.override(id, input, payload, actor as string)).rejects.toThrow('identified actor');
		await expect(comfort.override(id, input, payload, 'operator', 'automation' as never)).rejects.toThrow(
			'identified actor',
		);
		for (const kind of ['override', 'cancel'])
			for (const bad of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
				const unsafe = { ...input, expected_graph_revision: bad };
				await expect(
					kind === 'override' ? comfort.override(id, unsafe, payload, 'operator') : comfort.cancel(id, unsafe, aId),
				).rejects.toThrow('revision fences');
			}
		expect(settle).not.toHaveBeenCalled();
		for (const request of [
			{ ...payload, setpoints: { heating_setpoint: 19, cooling_setpoint: null } },
			{ ...payload, preset: null, setpoints: null },
			{ ...payload, preset: null, setpoints: { heating_setpoint: 31, cooling_setpoint: null } },
			{ ...payload, preset: null, setpoints: { heating_setpoint: 19, cooling_setpoint: 25 } },
			{ ...payload, expires_at: '2026-10-25T00:00:01' },
		])
			await expect(comfort.override(id, input, request, 'operator')).rejects.toThrow();
		await database.manager.update(
			VirtualThermostatConfigEntity,
			{ controllerId: id },
			{ comfort: { ...configuration(), presets: [] } },
		);
		await expect(comfort.override(id, input, payload, 'operator')).rejects.toThrow('preset or setpoints are missing');
		await database.manager.update(VirtualThermostatConfigEntity, { controllerId: id }, { comfort: null });
		await expect(comfort.override(id, input, payload, 'operator')).rejects.toThrow('Configure explicit comfort');
		await database.manager.update(
			VirtualThermostatConfigEntity,
			{ controllerId: id },
			{ comfort: configuration(), locked: true },
		);
		await expect(comfort.override(id, input, payload, 'operator')).rejects.toThrow('locked');
		await database.manager.update(
			VirtualThermostatConfigEntity,
			{ controllerId: id },
			{ locked: false, revision: Number.MAX_SAFE_INTEGER },
		);
		await expect(comfort.override(id, await fence(), payload, 'operator')).rejects.toThrow('overflowed');
	});

	it.each(['uuid', 'monotonic'] as const)(
		'propagates exact falsy %s dispatch failure at creation resolution',
		async (dispatch) => {
			const input = await fence();
			let birth = false;
			jest.spyOn(crypto, 'randomUUID').mockImplementation(() => {
				if (dispatch === 'uuid') throw JSON.parse('false') as unknown;
				birth = true;
				return aId;
			});
			jest.spyOn(performance, 'now').mockImplementation(() => {
				if (birth) throw JSON.parse('0') as unknown;
				return monotonic;
			});
			await expect(comfort.override(id, input, requestOverride(), 'operator')).rejects.toBe(
				dispatch === 'uuid' ? false : 0,
			);
			expect(await fence()).toEqual(input);
			expect(localMap().has(id)).toBe(false);
		},
	);

	it.each(['override', 'cancel'] as const)(
		'has no service initial %s action on ACK plus awaited subscriber failure',
		async (kind) => {
			jest.spyOn(crypto, 'randomUUID').mockReturnValue(aId);
			if (kind === 'cancel') await comfort.override(id, await fence(), requestOverride(), 'operator');
			const input = await fence(),
				map = localMap(),
				reference = map.get(id),
				get = jest.spyOn(comfort, 'get');
			let receipt: SqliteCommitGuardReceipt;
			database.subscribers.push({
				beforeTransactionCommit: (event) => {
					receipt = observeSqliteOuterOutcome(event.manager);
				},
				afterTransactionCommit: () => {
					throw JSON.parse('false') as unknown;
				},
			});
			await expect(
				kind === 'override'
					? comfort.override(id, input, requestOverride(), 'operator')
					: comfort.cancel(id, input, aId),
			).rejects.toBe(false);
			expect(receipt.outcome).toBe('committed');
			expect(map.get(id)).toBe(reference);
			expect(get).not.toHaveBeenCalled();
			expect((await row()).revision).toBe(input.expected_revision + 1);
		},
	);
	it('retains exact undefined from the original post-ACK Map get with committed result and honest stage', async () => {
		const input = await fence(),
			map = localMap();
		let afterAck = false;
		const original = map.get.bind(map) as LocalMap['get'];
		jest.spyOn(map, 'get').mockImplementation((controller) => {
			if (afterAck) throw undefined as unknown;
			return original(controller);
		});
		const pin = thermostatComfortSelection.pin(database, 'override', map);
		let owner = () => false;
		const operation = pin.operation(
			pin.overrideInput(id, input, requestOverride(), 'operator', 'user'),
			() => owner(),
			() => true,
		);
		database.subscribers.push({
			afterTransactionCommit: () => {
				afterAck = true;
			},
		});
		await expect(
			lock.runExclusive(async () => {
				owner = AsyncLocalStorage.bind(() => lock.hasCurrentStructuralLease());
				operation.captureSlot();
				await graph.withComfortSelectionWrite(
					operation.write,
					input.expected_graph_revision,
					operation.admit,
					operation.accepted,
				);
				operation.accepted();
				operation.localAction();
			}),
		).rejects.toBeUndefined();
		expect(operation.settlement.outcome).toBe('committed');
		expect(operation.settlement.result.value.revision).toBe(2);
		expect(operation.settlement.localFailure).toEqual({ cause: undefined });
		expect(operation.settlement.localAction.stage).toBe('checking');
	});
});
