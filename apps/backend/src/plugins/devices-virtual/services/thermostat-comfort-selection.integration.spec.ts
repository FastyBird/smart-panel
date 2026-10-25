import { plainToInstance } from 'class-transformer';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
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
import { ConfigureThermostatComfortDto } from '../dto/thermostat-comfort.dto';
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

	it.each(['selection', 'definition'] as const)(
		'runs real ownership reconciliation and direct durable invariance for %s with notification retry',
		async (kind) => {
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
					: await comfort.configure(id, input, definition());
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
});
