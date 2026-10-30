/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method */
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { useContainer } from 'class-validator';
import { AsyncLocalStorage } from 'node:async_hooks';
import { EntityManager, EntitySubscriberInterface, QueryRunner, RemoveEvent } from 'typeorm';
import { SqliteDriver } from 'typeorm/driver/sqlite/SqliteDriver';
import { v4 as uuid } from 'uuid';

import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createProtectionProbe } from '../../../../test/support/thermostat-protection-fixture';
import { realThermostatGuardFixture } from '../../../../test/support/thermostat-real-guard-fixture';
import {
	SqliteCommitGuardReceipt,
	SqliteDataSource,
	isSqliteTransactionActive,
} from '../../../common/database/sqlite-data-source';
import {
	ClimateAutomationDeletionCapture,
	ClimateAutomationLedgerScope,
	ClimateAutomationMutationOutcome,
} from '../../../modules/devices/contracts/climate-automation.contract';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import {
	ClimateAutomationDeletionEntity,
	ClimateAutomationSlotEntity,
} from '../../../modules/devices/entities/climate-automation.entity';
import { DeviceZoneEntity } from '../../../modules/devices/entities/device-zone.entity';
import {
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../../../modules/devices/entities/devices.entity';
import { ChannelsTypeMapperService } from '../../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../../modules/devices/services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { ClimateAutomationLedgerService } from '../../../modules/devices/services/climate-automation-ledger.service';
import { ClimateAutomationRegistryService } from '../../../modules/devices/services/climate-automation.registry.service';
import { ControllerPublicationContext } from '../../../modules/devices/services/controller-publication-context';
import {
	CreationSettlement,
	DeviceCreationContext,
	DeviceCreationSettlementError,
} from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { DeviceZonesService } from '../../../modules/devices/services/device-zones.service';
import { DevicesTypeMapperService } from '../../../modules/devices/services/devices-type-mapper.service';
import { DevicesControlsService } from '../../../modules/devices/services/devices.controls.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { PropertyCommandWindowService } from '../../../modules/devices/services/property-command-window.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { getPropertyMetadata } from '../../../modules/devices/utils/schema.utils';
import { DeviceExistsConstraintValidator } from '../../../modules/devices/validators/device-exists-constraint.validator';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { CreateVirtualChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateVirtualChannelDto } from '../dto/create-channel.dto';
import { CreateVirtualDeviceDto } from '../dto/create-device.dto';
import { CreateVirtualThermostatProducerDto } from '../dto/thermostat-authoring.dto';
import { UpdateVirtualChannelPropertyDto } from '../dto/update-channel-property.dto';
import { UpdateVirtualChannelDto } from '../dto/update-channel.dto';
import { UpdateVirtualDeviceDto } from '../dto/update-device.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { ThermostatCoolingDependencyEntity } from '../entities/thermostat-cooling-dependency.entity';
import { ThermostatMemberProtectionEntity } from '../entities/thermostat-member-protection.entity';
import { VirtualGraphRevisionEntity } from '../entities/virtual-producer.entity';
import {
	VirtualThermostatBranchRuntimeEntity,
	VirtualThermostatCommandEntity,
	VirtualThermostatRuntimeEntity,
} from '../entities/virtual-thermostat-runtime.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatSourceEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualIndexMaintenanceListener } from '../listeners/virtual-index-maintenance.listener';
import { VirtualCreatedThermostatModel } from '../models/thermostat-authoring-response.model';
import { VirtualThermostatConfigurationModel } from '../models/thermostat-response.model';
import { VirtualThermostatOwnershipSubscriber } from '../subscribers/virtual-thermostat-ownership.subscriber';
import { CategoryAllowedConstraintValidator } from '../validators/category-allowed-constraint.validator';
import { DeviceIsVirtualConstraintValidator } from '../validators/device-is-virtual-constraint.validator';

import { initializeThermostatCreationCatalog } from './thermostat-creation-catalog';
import { RetainedOriginalCreatedResponse, thermostatCreationResponse } from './thermostat-creation-response';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualDevicesService } from './virtual-devices.service';
import { VirtualDewPointConfigService } from './virtual-dew-point-config.service';
import { DEW_POINT_FORMULA } from './virtual-dew-point.utils';
import { VirtualPropertyIndexService } from './virtual-property-index.service';
import { VirtualThermostatAuthoringService } from './virtual-thermostat-authoring.service';
import {
	THERMOSTAT_AUTOMATION_PROVIDER,
	VirtualThermostatAutomationService,
} from './virtual-thermostat-automation.service';
import { ThermostatInstalledQualification, VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { VirtualThermostatComfortService } from './virtual-thermostat-comfort.service';
import { THERMOSTAT_CONFIG_CHANGED, VirtualThermostatConfigService } from './virtual-thermostat-config.service';
import { VirtualThermostatInputsService } from './virtual-thermostat-inputs.service';
import { ThermostatRuntimeJournal, readThermostatRecreationHistory } from './virtual-thermostat-runtime-ownership';
import { VirtualThermostatRuntimeService } from './virtual-thermostat-runtime.service';

jest.setTimeout(30000);

function responseWire(data: VirtualCreatedThermostatModel): unknown {
	return JSON.parse(
		JSON.stringify(
			instanceToPlain(data, {
				excludeExtraneousValues: true,
				exposeUnsetFields: false,
				ignoreDecorators: false,
				groups: ['api'],
				enableCircularCheck: true,
			}),
		),
	) as unknown;
}
function expectImmutableResponse(value: unknown): void {
	if (value === null || typeof value !== 'object') {
		expect(typeof value).not.toBe('function');
		return;
	}
	expect(value).not.toBeInstanceOf(Date);
	expect(Object.isFrozen(value)).toBe(true);
	expect([Object.prototype, Array.prototype, null]).toContain(Object.getPrototypeOf(value));
	for (const entry of Object.values(value)) expectImmutableResponse(entry);
}
// Inject only AFTER the original owning finalizer actually releases this exact lease.
// Intermediate finally calls retain their original behavior and do not receive the fault.
function failAfterOwnedRelease(runner: QueryRunner, cause: unknown): void {
	const coordinated = runner as QueryRunner & { releaseIfSettled: () => void };
	const lease = Reflect.get(runner, 'lease') as { active: boolean };
	const original = coordinated.releaseIfSettled;
	const fault = jest.spyOn(coordinated, 'releaseIfSettled').mockImplementation(function (this: typeof coordinated) {
		const active = lease.active;
		original.call(this);
		if (active && !lease.active) {
			fault.mockRestore();
			throw cause;
		}
	});
}

describe('atomic virtual thermostat authoring', () => {
	let database: SqliteDataSource;
	let authoring: VirtualThermostatAuthoringService;
	let registry: PropertyCommandAdmissionRegistryService;
	let claims: VirtualThermostatClaimsService;
	let configs: VirtualThermostatConfigService;
	let devices: DevicesService;
	let deviceMapper: DevicesTypeMapperService;
	let channels: ChannelsService;
	let zones: DeviceZonesService;
	let events: EventEmitter2;
	let propertyMapper: ChannelsPropertiesTypeMapperService;
	let properties: ChannelsPropertiesService;
	let lock: DeviceStructureLockService;
	let graph: VirtualDependencyGraphService;
	let ambientId: string;
	let relayId: string;
	let relayDeviceId: string;
	const publications: EventType[] = [];
	let values: PropertyValueService;

	// EF02 candidate ownership: gates release before dynamic joins; no cancellation claim.
	let queuedOwner: ReturnType<typeof queuedCustody> | undefined;
	function queuedCustody() {
		const jobs = new Set<Promise<unknown>>(),
			releases: Array<() => void> = [],
			undo: Array<() => void> = [];
		const quiet: Array<() => boolean> = [],
			failures: Array<{ cause: unknown }> = [];
		let loops = 0,
			abandoned = false,
			joined = false,
			quarantined = false,
			refused = false,
			nativeClosed = false,
			cleanup: Promise<void> | undefined;
		let abandon!: () => void, fail!: (box: { cause: unknown }) => void;
		const stopped = new Promise<void>((resolve) => {
			abandon = resolve;
		});
		const failed = new Promise<{ cause: unknown }>((resolve) => {
			fail = resolve;
		});
		function gate() {
			let release!: () => void;
			const promise = new Promise<void>((resolve) => {
				release = resolve;
			});
			releases.push(release);
			return { promise, release };
		}
		function retain<T>(job: Promise<T>, loop = false): Promise<T> {
			jobs.add(job);
			void job.catch((cause: unknown) => {
				if (loop) {
					failures.push({ cause });
					fail({ cause });
				}
			});
			if (loop && ++loops > 16) {
				const box = { cause: new Error('STOP: original loop cap exceeded') };
				failures.push(box);
				fail(box);
			}
			return job;
		}
		function check() {
			if (abandoned) throw new Error('STOP: abandoned fixture');
		}
		function own(receiver: object, key: PropertyKey, expected: unknown, restore: () => void) {
			undo.push(() => {
				if (Reflect.get(receiver, key) !== expected) throw new Error('STOP: original observer replaced');
				restore();
			});
		}
		async function step<T>(issue: () => Promise<T>): Promise<T> {
			check();
			const value = await retain(issue());
			check();
			return value;
		}
		async function wait(signal: Promise<void>, request: Promise<unknown>) {
			check();
			await Promise.race([
				signal,
				request.then(() => {
					throw new Error('STOP: request settled before signal');
				}),
				failed.then((box) => {
					throw box.cause;
				}),
				stopped.then(() => {
					throw new Error('STOP: abandoned wait');
				}),
			]);
			check();
		}
		function finish() {
			// eslint-disable-next-line @typescript-eslint/no-misused-promises -- Inspect cached promise identity without awaiting.
			if (cleanup) return cleanup;
			abandoned = true;
			abandon();
			for (const release of releases) release();
			return (cleanup = (async () => {
				let size = -1;
				while (size !== jobs.size) {
					size = jobs.size;
					await Promise.allSettled([...jobs]);
				}
				try {
					if (quiet.some((probe) => !probe())) failures.push({ cause: new Error('STOP: unsafe listener work') });
				} catch (cause) {
					failures.push({ cause });
				}
				if (failures.length) return; // Quarantine: no restoration, disposal or native close.
				for (const restore of [...undo].reverse()) {
					try {
						restore();
					} catch (cause) {
						failures.push({ cause });
					}
				}
				joined = failures.length === 0;
			})());
		}
		return {
			gate,
			step,
			wait,
			check,
			quiet,
			retain,
			finish,
			own,
			undo,
			failures,
			quarantine() {
				quarantined = true;
			},
			refuse() {
				refused = true;
				quarantined = true;
			},
			get quarantined() {
				return quarantined;
			},
			finishTeardown() {
				nativeClosed = true;
				if (refused) throw new Error('STOP: late teardown after fixture refusal');
				quarantined = false;
			},
			get nativeClosed() {
				return nativeClosed;
			},
			get abandoned() {
				return abandoned;
			},
			get joined() {
				return joined;
			},
		};
	}

	it.each(['prior', 'publication-b', 'control-falsy', 'ordinary'] as const)(
		'EF02 candidate queued controller: %s',
		async (scenario) => {
			const owner = queuedCustody();
			queuedOwner = owner;
			let primary: { cause: unknown } | undefined;
			try {
				const automationRegistry = new ClimateAutomationRegistryService();
				owner.undo.push(() => automationRegistry.onModuleDestroy());
				const ledger = new ClimateAutomationLedgerService(database, lock, automationRegistry);
				graph = new VirtualDependencyGraphService(database, undefined, ledger);
				const automation = new VirtualThermostatAutomationService(database, automationRegistry, ledger, graph, lock);
				claims.onModuleDestroy();
				claims = new VirtualThermostatClaimsService(database, lock, graph, registry, events);
				await owner.step(() => claims.onApplicationBootstrap());
				configs = new VirtualThermostatConfigService(
					database,
					lock,
					graph,
					claims,
					events,
					values,
					undefined,
					automation,
				);
				devices = new DevicesService(
					database.getRepository(DeviceEntity),
					database.getRepository(SpaceEntity),
					deviceMapper,
					channels,
					properties,
					new DevicesControlsService(database.getRepository(DeviceControlEntity), database, events),
					zones,
					lock,
					database,
					events,
					ledger,
				);
				authoring = new VirtualThermostatAuthoringService(
					database,
					lock,
					graph,
					devices,
					new DeviceValidationService(devices),
					configs,
				);
				const ownership = new VirtualThermostatOwnershipSubscriber(database, claims);
				owner.undo.push(() => {
					const position = database.subscribers.indexOf(ownership);
					if (position < 0) throw new Error('Original ownership subscriber missing');
					database.subscribers.splice(position, 1);
				});
				await owner.step(() => ownership.onApplicationBootstrap());
				owner.undo.push(() => automation.onModuleDestroy());
				automation.onModuleInit();
				await owner.step(() => automation.onApplicationBootstrap());
				const input = request(relayId),
					id = input.device.id;
				const ordinary = scenario === 'ordinary',
					fault = scenario === 'control-falsy';
				if (ordinary)
					await owner.step(() =>
						database.manager.insert(ShellyNgDeviceEntity, {
							id,
							name: 'Ordinary',
							identifier: 'ordinary-' + id,
							category: DeviceCategory.SWITCHER,
							enabled: true,
							canonicalMac: '000000000099',
						}),
					);
				else await owner.step(() => authoring.create(input));
				await owner.step(() =>
					lock.runExclusive(() =>
						database.manager.update(
							VirtualThermostatActuatorClaimEntity,
							{ controllerId: id },
							{ state: 'released', releasedAt: new Date() },
						),
					),
				);
				// EMPTY/terminal claim seed supplies no physical OFF evidence.
				const controlId = uuid();
				await owner.step(() =>
					database.manager.insert(DeviceControlEntity, { id: controlId, name: 'candidate', device: { id } }),
				);
				const captures: Array<Awaited<ReturnType<typeof ledger.captureControllerDeletion>>> = [];
				const capture = ledger.captureControllerDeletion.bind(ledger) as typeof ledger.captureControllerDeletion;
				const captureSpy = jest.spyOn(ledger, 'captureControllerDeletion').mockImplementation(async (...args) => {
					const original = await owner.retain(capture(...args));
					captures.push(original);
					return original;
				});
				owner.own(ledger, 'captureControllerDeletion', captureSpy, captureSpy.mockRestore);
				if (ordinary) {
					const seen: unknown[] = [],
						observe = () => {
							seen.push(ControllerPublicationContext.current());
						};
					events.on(EventType.DEVICE_DELETED, observe);
					owner.undo.push(() => {
						events.off(EventType.DEVICE_DELETED, observe);
					});
					await owner.step(() => devices.remove(id));
					expect(captures).toHaveLength(1);
					expect(captures[0]).toEqual(expect.any(Function));
					expect(captures[0].hasControllerSlot).toBeUndefined();
					expect(await owner.step(() => database.manager.count(ClimateAutomationSlotEntity))).toBe(0);
					expect(await owner.step(() => database.manager.count(ClimateAutomationDeletionEntity))).toBe(0);
					expect(seen).toEqual([undefined]);
					expect(await owner.step(() => database.manager.findOneBy(DeviceEntity, { id }))).toBeNull();
					expect(await owner.step(() => database.manager.findOneBy(DeviceControlEntity, { id: controlId }))).toBeNull();
					return;
				}
				const initial = await owner.step(() =>
					database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id }),
				);
				const childProperties = await owner.step(() =>
					database.manager.find(ChannelPropertyEntity, {
						where: { channel: { device: { id } } },
						relations: ['channel'],
					}),
				);
				const childChannels = await owner.step(() =>
					database.manager.find(ChannelEntity, { where: { device: { id } } }),
				);
				const imageTypes = [
					DeviceEntity,
					ChannelEntity,
					ChannelPropertyEntity,
					DeviceControlEntity,
					VirtualThermostatConfigEntity,
					VirtualThermostatActuatorClaimEntity,
					ClimateAutomationSlotEntity,
					ClimateAutomationDeletionEntity,
				];
				const image = () =>
					owner.step(() =>
						Promise.all(
							imageTypes.map(async (type) => {
								const rows = await owner.retain(
									database.query<unknown[]>('SELECT * FROM "' + database.getMetadata(type).tableName + '"'),
								);
								return rows.map((row) => JSON.stringify(row)).sort();
							}),
						),
					);
				const before = await image();
				let borrowed:
					| {
							manager: EntityManager;
							receipt: SqliteCommitGuardReceipt;
							current: () => boolean;
							scope?: ClimateAutomationLedgerScope;
					  }
					| undefined;
				const admit = ledger.inAdmittedManager.bind(ledger) as typeof ledger.inAdmittedManager;
				const admitSpy = jest
					.spyOn(ledger, 'inAdmittedManager')
					.mockImplementation(
						<T>(
							manager: EntityManager,
							receipt: SqliteCommitGuardReceipt,
							work: (scope: ClimateAutomationLedgerScope) => Promise<T>,
						): Promise<T> => {
							expect(borrowed).toBeUndefined();
							borrowed = { manager, receipt, current: lock.captureExclusiveOwner() };
							expect(receipt.outcome).toBe('pending');
							return owner.retain(admit(manager, receipt, work));
						},
					);
				owner.own(ledger, 'inAdmittedManager', admitSpy, admitSpy.mockRestore);
				const native: string[] = [],
					removedTables = imageTypes.slice(0, 4).map((type) => database.getMetadata(type).tableName);
				const subscriber = {
					afterRemove(event: RemoveEvent<unknown>) {
						if (!removedTables.includes(event.metadata.tableName)) return;
						if (!borrowed) throw new Error('Missing original borrowed manager');
						expect(event.manager).toBe(borrowed.manager);
						expect(event.queryRunner).toBe(borrowed.manager.queryRunner);
						expect(event.queryRunner.isTransactionActive).toBe(true);
						expect((event.queryRunner as QueryRunner & { transactionDepth: number }).transactionDepth).toBe(1);
						expect(borrowed.receipt.outcome).toBe('pending');
						expect(borrowed.current()).toBe(true);
						const scope = ledger.currentScope(event.manager);
						borrowed.scope ??= scope;
						expect(scope).toBe(borrowed.scope);
						native.push(event.metadata.tableName);
					},
				};
				database.subscribers.push(subscriber);
				owner.undo.push(() => {
					const position = database.subscribers.indexOf(subscriber);
					if (position < 0) throw new Error('Original subscriber missing');
					database.subscribers.splice(position, 1);
				});
				const index = new VirtualPropertyIndexService(database.getRepository(VirtualChannelPropertyEntity), graph);
				const virtual = new VirtualDevicesService(
					properties,
					channels,
					devices,
					{} as never,
					{} as never,
					graph,
					database,
				);
				const listener = new VirtualIndexMaintenanceListener(
					index,
					// eslint-disable-next-line @typescript-eslint/require-await -- Preserve the no-op status promise contract.
					{ recompute: async () => undefined } as never,
					devices,
					virtual,
					properties,
					lock,
					events,
					database,
					database.getRepository(DeviceEntity),
					graph,
				);
				const held = owner.gate(),
					read = owner.gate(),
					entered = owner.gate(),
					priorGate = owner.gate();
				const bGate = owner.gate(),
					enqueued = owner.gate(),
					following = owner.gate();
				const rebuild = index.rebuild.bind(index) as typeof index.rebuild;
				let first = true;
				const indexSpy = jest.spyOn(index, 'rebuild').mockImplementation(async () => {
					const result = await owner.retain(rebuild());
					if (first) {
						first = false;
						read.release();
						await held.promise;
					}
					return result;
				});
				owner.own(index, 'rebuild', indexSpy, indexSpy.mockRestore);
				const loops = listener as unknown as { runRebuildLoop(): Promise<void> };
				const loop = loops.runRebuildLoop.bind(listener) as typeof loops.runRebuildLoop;
				const loopSpy = jest.spyOn(loops, 'runRebuildLoop').mockImplementation(() => owner.retain(loop(), true));
				owner.own(loops, 'runRebuildLoop', loopSpy, loopSpy.mockRestore);
				const state = listener as unknown as {
					running: boolean;
					pending: boolean;
					repairTimer: unknown;
					pendingCompletions: unknown[];
				};
				owner.quiet.push(
					() =>
						!state.running &&
						!state.pending &&
						!state.repairTimer &&
						!state.pendingCompletions.length &&
						!isSqliteTransactionActive(database),
				);
				const observed: Array<ControllerPublicationContext | undefined> = [],
					order: Array<{ kind: EventType; id: string }> = [];
				for (const kind of [
					EventType.CHANNEL_PROPERTY_DELETED,
					EventType.CHANNEL_DELETED,
					EventType.DEVICE_CONTROL_DELETED,
					EventType.DEVICE_DELETED,
				]) {
					const handler = (entity: { id: string }) => {
						expect(a).toBeDefined();
						expect(ControllerPublicationContext.current()).toBe(a);
						expect(a?.isEligible()).toBe(false);
						observed.push(ControllerPublicationContext.current());
						order.push({ kind, id: entity.id });
						if (kind === EventType.DEVICE_CONTROL_DELETED) {
							if (fault) {
								// eslint-disable-next-line @typescript-eslint/only-throw-error -- Preserve the original emit-time falsy cause.
								throw undefined;
							}
							return;
						}
						listener.handleSourceDeleted();
					};
					events.on(kind, handler);
					owner.undo.push(() => {
						events.off(kind, handler);
					});
				}
				const b = new ControllerPublicationContext(() => true),
					bReady = owner.gate();
				const priorBody = async () => {
					await owner.retain(
						lock.runExclusive(async () => {
							entered.release();
							await priorGate.promise;
						}),
					);
					if (scenario === 'publication-b') {
						expect(ControllerPublicationContext.current()).toBe(b);
						expect(lock.hasCurrentStructuralLease()).toBe(false);
						bReady.release();
						await bGate.promise;
					}
				};
				const prior = owner.retain(
					scenario === 'publication-b' ? ControllerPublicationContext.complete(() => b.run(priorBody)) : priorBody(),
				);
				await owner.wait(entered.promise, prior);
				const originalLock = lock.runExclusive.bind(lock) as typeof lock.runExclusive;
				let a: ControllerPublicationContext | undefined;
				const enqueueSpy = jest.spyOn(lock, 'runExclusive').mockImplementation((work) => {
					const result = originalLock(work);
					if (!a) {
						a = ControllerPublicationContext.current();
						enqueued.release();
					}
					return result;
				});
				owner.own(lock, 'runExclusive', enqueueSpy, enqueueSpy.mockRestore);
				let settlement = 0;
				const removal = owner.retain(devices.remove(id));
				void removal.then(
					() => {
						settlement++;
					},
					() => {
						settlement++;
					},
				);
				await owner.wait(enqueued.promise, removal);
				expect(observed).toEqual([]);
				// eslint-disable-next-line @typescript-eslint/no-floating-promises -- Exact promise is retained and observed by the fixture owner.
				owner.retain(
					// eslint-disable-next-line @typescript-eslint/require-await -- Keep the original Promise-shaped structural probe.
					lock.runExclusive(async () => {
						following.release();
					}),
				);
				priorGate.release();
				await owner.wait(read.promise, removal);
				if (scenario === 'publication-b') await owner.wait(bReady.promise, prior);
				await owner.wait(following.promise, removal);
				expect(a).toBeDefined();
				expect(a).not.toBe(b);
				expect(observed.length).toBeGreaterThan(0);
				expect(observed.every((publication) => publication === a)).toBe(true);
				expect(a?.facts().some((fact) => fact.name === 'virtual-index.pass' && !fact.settled)).toBe(true);
				expect(b.facts()).toEqual([]);
				expect(settlement).toBe(0);
				held.release();
				bGate.release();
				let failure: { cause: unknown } | undefined;
				try {
					await owner.step(() => removal);
				} catch (cause) {
					failure = { cause };
				}
				if (!borrowed) throw new Error('Missing original borrowed receipt');
				expect(settlement).toBe(1);
				expect(captures).toHaveLength(1);
				expect(captures[0]).not.toBeNull();
				expect(borrowed.receipt.outcome).toBe(fault ? 'rolled_back' : 'committed');
				const at = (kind: EventType, key: string) =>
					order.findIndex((event) => event.kind === kind && event.id === key);
				const controlAt = at(EventType.DEVICE_CONTROL_DELETED, controlId);
				expect(controlAt).toBeGreaterThan(-1);
				for (const property of childProperties) {
					const channelId = typeof property.channel === 'string' ? property.channel : property.channel.id;
					expect(at(EventType.CHANNEL_PROPERTY_DELETED, property.id)).toBeGreaterThan(-1);
					expect(at(EventType.CHANNEL_PROPERTY_DELETED, property.id)).toBeLessThan(
						at(EventType.CHANNEL_DELETED, channelId),
					);
				}
				for (const channel of childChannels) expect(at(EventType.CHANNEL_DELETED, channel.id)).toBeLessThan(controlAt);
				expect(native.filter((table) => table === removedTables[2])).toHaveLength(childProperties.length);
				expect(native.filter((table) => table === removedTables[1])).toHaveLength(childChannels.length);
				expect(native.filter((table) => table === removedTables[3])).toHaveLength(1);
				expect(native.filter((table) => table === removedTables[0])).toHaveLength(fault ? 0 : 1);
				expect(order).toHaveLength(childProperties.length + childChannels.length + (fault ? 1 : 2));
				if (fault) {
					expect(failure).toEqual({ cause: undefined });
					expect(await image()).toEqual(before);
				} else {
					expect(failure).toBeUndefined();
					expect(order[order.length - 1]).toEqual({ kind: EventType.DEVICE_DELETED, id });
					expect(await owner.step(() => database.manager.findOneBy(DeviceEntity, { id }))).toBeNull();
					expect(
						(
							await owner.step(() =>
								database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id }),
							)
						).ownerDeviceId,
					).toBeNull();
					const slot = await owner.step(() =>
						database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id }),
					);
					const proof = await owner.step(() =>
						database.manager.findOneByOrFail(ClimateAutomationDeletionEntity, { controllerId: id }),
					);
					expect(slot.manualHold).toBe(true);
					expect(slot.slotRevision).toBeGreaterThan(initial.slotRevision);
					expect(proof).toMatchObject({
						controllerIncarnation: initial.controllerIncarnation,
						slotRevision: slot.slotRevision,
						consumedByIncarnation: null,
						consumedSlotRevision: null,
					});
					expect(JSON.parse(proof.nativeDeviceEvidence)).toEqual(JSON.parse(proof.deviceEvidence));
					expect(JSON.parse(proof.nativeConfigurationEvidence)).toEqual(JSON.parse(proof.configurationEvidence));
				}
			} catch (cause) {
				primary = { cause };
			} finally {
				await owner.finish();
			}
			if (primary) throw primary.cause;
			expect(owner.failures).toEqual([]);
		},
	);
	beforeEach(async () => {
		if (queuedOwner && (!queuedOwner.joined || !queuedOwner.nativeClosed || queuedOwner.quarantined)) {
			queuedOwner.refuse();
			throw new Error('STOP: prior fixture quarantined');
		}
		queuedOwner = undefined;
		publications.length = 0;
		jest.clearAllMocks();
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		await database.transaction((manager) => initializeThermostatCreationCatalog(manager, true));
		events = new EventEmitter2();
		values = new PropertyValueService(
			{} as never,
			new PropertyValueSourceRegistryService(),
			new PropertyValueLockService(database),
			new PropertyProducerRegistryService(),
			events,
		);
		jest.spyOn(values, 'write').mockResolvedValue(true);
		jest.spyOn(values, 'readLatest').mockResolvedValue(null);
		for (const event of [
			EventType.DEVICE_CREATED,
			EventType.CHANNEL_CREATED,
			EventType.CHANNEL_PROPERTY_CREATED,
			EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED,
		])
			events.on(event, () => publications.push(event));
		lock = new DeviceStructureLockService();
		graph = new VirtualDependencyGraphService(database);
		registry = new PropertyCommandAdmissionRegistryService();
		claims = new VirtualThermostatClaimsService(database, lock, graph, registry, events);
		configs = new VirtualThermostatConfigService(database, lock, graph, claims, events, values);
		deviceMapper = new DevicesTypeMapperService();
		const channelMapper = new ChannelsTypeMapperService();
		propertyMapper = new ChannelsPropertiesTypeMapperService();
		propertyMapper.registerMapping({
			type: 'virtual',
			class: VirtualChannelPropertyEntity,
			createDto: CreateVirtualChannelPropertyDto,
			updateDto: UpdateVirtualChannelPropertyDto,
			beforeCreate: async (property, channelId, manager) => {
				await virtual.assertChannelOwnerIsVirtual(channelId, manager);
				await virtual.assertDerivedOutputSupported(property, channelId, manager);
				virtual.assertValueOriginPairSupported(property);
				virtual.assertOwnedPropertyNotWritable(property);
			},
		});
		channelMapper.registerMapping({
			type: 'virtual',
			class: VirtualChannelEntity,
			createDto: CreateVirtualChannelDto,
			updateDto: UpdateVirtualChannelDto,
		});
		deviceMapper.registerMapping({
			type: 'virtual',
			class: VirtualDeviceEntity,
			createDto: CreateVirtualDeviceDto,
			updateDto: UpdateVirtualDeviceDto,
		});
		properties = new ChannelsPropertiesService(
			database.getRepository(ChannelPropertyEntity),
			propertyMapper,
			{} as never,
			new PropertyValueSourceRegistryService(),
			lock,
			{} as never,
			new PropertyCommandWindowService(),
			database,
			events,
		);
		channels = new ChannelsService(
			database.getRepository(ChannelEntity),
			channelMapper,
			properties,
			{} as never,
			lock,
			database,
			events,
		);
		zones = new DeviceZonesService(
			database.getRepository(DeviceZoneEntity),
			database.getRepository(DeviceEntity),
			database.getRepository(SpaceEntity),
			events,
		);
		devices = new DevicesService(
			database.getRepository(DeviceEntity),
			database.getRepository(SpaceEntity),
			deviceMapper,
			channels,
			properties,
			{} as never,
			zones,
			lock,
			database,
			events,
		);
		const virtual = new VirtualDevicesService(properties, channels, devices, {} as never, {} as never, graph, database);
		useContainer(
			{
				get: <T>(type: new () => T): T => {
					if (type === (CategoryAllowedConstraintValidator as never))
						return new CategoryAllowedConstraintValidator(virtual) as T;
					if (type === (DeviceIsVirtualConstraintValidator as never))
						return new DeviceIsVirtualConstraintValidator(virtual) as T;
					if (type === (DeviceExistsConstraintValidator as never))
						return new DeviceExistsConstraintValidator(devices) as T;
					return new type();
				},
			},
			{ fallbackOnErrors: true },
		);
		authoring = new VirtualThermostatAuthoringService(
			database,
			lock,
			graph,
			devices,
			new DeviceValidationService(devices),
			configs,
		);
		await claims.onApplicationBootstrap();
		const sensorDevice = uuid(),
			sensorChannel = uuid();
		ambientId = uuid();
		await database
			.getRepository(DeviceEntity)
			.insert({ id: sensorDevice, name: 'Sensor', category: DeviceCategory.SENSOR, enabled: true });
		await database.getRepository(ChannelEntity).insert({
			id: sensorChannel,
			device: sensorDevice,
			name: 'Temperature',
			category: ChannelCategory.TEMPERATURE,
		} as never);
		await database.getRepository(ChannelPropertyEntity).insert({
			id: ambientId,
			channel: sensorChannel,
			identifier: 'temperature',
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			unit: '°C',
			permissions: [PermissionType.READ_ONLY],
		} as never);
		relayId = await actuator();
		publications.length = 0;
	});
	afterEach(async () => {
		if (queuedOwner && (!queuedOwner.joined || queuedOwner.quarantined)) {
			queuedOwner.refuse();
			void queuedOwner.finish();
			throw new Error('STOP: fixture quarantined; ROOT disposition required');
		}
		const queuedTeardown = { owner: queuedOwner, database };
		queuedTeardown.owner?.quarantine();
		jest.restoreAllMocks();
		claims?.onModuleDestroy();
		if (database?.isInitialized) await database.destroy();
		jest.useRealTimers();
		useContainer({ get: <T>(type: new () => T) => new type() }, { fallbackOnErrors: true });
		if (queuedTeardown.owner) {
			expect(queuedOwner).toBe(queuedTeardown.owner);
			expect(database).toBe(queuedTeardown.database);
			expect(queuedTeardown.database.isInitialized).toBe(false);
			queuedTeardown.owner.finishTeardown();
		}
	});
	async function actuator(existingDevice?: string, mac = 'A8032ABE5084') {
		const device = existingDevice ?? uuid(),
			channel = uuid(),
			property = uuid();
		if (!existingDevice) {
			relayDeviceId = device;
			await database.getRepository(ShellyNgDeviceEntity).insert({
				id: device,
				name: 'Relay',
				identifier: 'shellyplus1pm-' + uuid(),
				category: DeviceCategory.SWITCHER,
				enabled: true,
				canonicalMac: mac,
			});
		}
		await database.getRepository(ShellyNgChannelEntity).insert({
			id: channel,
			device,
			name: 'Switch',
			identifier: existingDevice ? 'switch:00' : 'switch:0',
			category: ChannelCategory.SWITCHER,
		} as never);
		await database.getRepository(ShellyNgChannelPropertyEntity).insert({
			id: property,
			channel,
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		} as never);
		return property;
	}
	const request = (relay: string, coolingRelay?: string): CreateVirtualThermostatProducerDto => {
		const settings: { setting: string; property: string }[] = [];
		const property = (channel: ChannelCategory, category: PropertyCategory, setting?: string) => {
			const metadata = getPropertyMetadata(channel, category);
			const id = uuid();
			if (setting) settings.push({ setting, property: id });
			return {
				id,
				type: 'virtual',
				identifier: category,
				category,
				data_type: metadata.data_type,
				permissions: [PermissionType.READ_ONLY],
				value_origin: VirtualValueOrigin.LOCAL,
				format: metadata.format,
			};
		};
		const channel = (category: ChannelCategory, properties: ReturnType<typeof property>[]) => ({
			id: uuid(),
			type: 'virtual',
			identifier: category,
			name: category,
			category,
			properties,
		});
		return plainToInstance(CreateVirtualThermostatProducerDto, {
			device: {
				id: uuid(),
				type: 'virtual',
				name: 'Draft thermostat',
				category: DeviceCategory.THERMOSTAT,
				mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
				channels: [
					channel(ChannelCategory.TEMPERATURE, [property(ChannelCategory.TEMPERATURE, PropertyCategory.TEMPERATURE)]),
					channel(ChannelCategory.THERMOSTAT, [
						property(ChannelCategory.THERMOSTAT, PropertyCategory.LOCKED, 'locked'),
					]),
					channel(
						ChannelCategory.DEVICE_INFORMATION,
						[
							PropertyCategory.MANUFACTURER,
							PropertyCategory.MODEL,
							PropertyCategory.SERIAL_NUMBER,
							PropertyCategory.STATUS,
						].map((category) => property(ChannelCategory.DEVICE_INFORMATION, category)),
					),
					channel(ChannelCategory.HEATER, [
						property(ChannelCategory.HEATER, PropertyCategory.ON, 'heating_enabled'),
						property(ChannelCategory.HEATER, PropertyCategory.TEMPERATURE, 'heating_setpoint'),
						property(ChannelCategory.HEATER, PropertyCategory.STATUS),
					]),
					...(coolingRelay
						? [
								channel(ChannelCategory.COOLER, [
									property(ChannelCategory.COOLER, PropertyCategory.ON, 'cooling_enabled'),
									property(ChannelCategory.COOLER, PropertyCategory.TEMPERATURE, 'cooling_setpoint'),
									property(ChannelCategory.COOLER, PropertyCategory.STATUS),
								]),
							]
						: []),
				],
			},
			configuration: {
				schema_version: 1,
				expected_revision: 0,
				requested_mode: 'off',
				policy: {
					heatingSetpoint: 20,
					coolingSetpoint: coolingRelay ? 25 : null,
					coldTolerance: 0.5,
					hotTolerance: 0.5,
					neutralMargin: 1,
					minimumOffMs: 0,
					changeoverMs: 0,
					floor: null,
				},
				contact_opening_ms: 0,
				contact_closing_ms: 0,
				sources: [{ role: 'ambient', source_property: ambientId, maximum_age_seconds: 300 }],
				actuators: [
					{ role: 'heating', source_property: relay, lease_seconds: 30 },
					...(coolingRelay ? [{ role: 'cooling', source_property: coolingRelay, lease_seconds: 30 }] : []),
				],
				settings,
			},
		});
	};

	it.each([
		{ collision: false, enabled: true },
		{ collision: false, enabled: false },
		{ collision: true, enabled: true },
	])(
		'creates EMPTY in the original catalog unit and refuses prior incarnation collision=$collision enabled=$enabled',
		async ({ collision, enabled }) => {
			const automationRegistry = new ClimateAutomationRegistryService();
			const ledger = new ClimateAutomationLedgerService(database, lock, automationRegistry);
			graph = new VirtualDependencyGraphService(database, undefined, ledger);
			const automation = new VirtualThermostatAutomationService(database, automationRegistry, ledger, graph, lock);
			claims.onModuleDestroy();
			claims = new VirtualThermostatClaimsService(database, lock, graph, registry, events);
			await claims.onApplicationBootstrap();
			configs = new VirtualThermostatConfigService(
				database,
				lock,
				graph,
				claims,
				events,
				values,
				undefined,
				automation,
			);
			authoring = new VirtualThermostatAuthoringService(
				database,
				lock,
				graph,
				devices,
				new DeviceValidationService(devices),
				configs,
			);
			automation.onModuleInit();
			const input = request(relayId);
			input.device.enabled = enabled;
			const controllerId = input.device.id;
			const prior = {
				controllerId,
				providerKey: THERMOSTAT_AUTOMATION_PROVIDER,
				controllerIncarnation: uuid(),
				slotRevision: 7,
				manualGeneration: uuid(),
				manualCounter: 8,
				manualHold: false,
				state: 'EMPTY' as const,
				ownerId: null,
				baselineId: null,
				generationId: null,
				candidateId: null,
				bundleId: null,
				selection: null,
				installEvidence: null,
				legacyDigest: null,
			};
			try {
				if (collision) {
					await database.manager.insert(ClimateAutomationSlotEntity, prior);
					await expect(authoring.create(input)).rejects.toThrow();
					expect(await database.manager.findOneBy(VirtualDeviceEntity, { id: controllerId })).toBeNull();
					expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(0);
					expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(0);
					expect(publications).toEqual([]);
					expect({
						...(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })),
					}).toEqual(prior);
				} else {
					const result = await authoring.create(input);
					const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
					expect(slot).toMatchObject({
						providerKey: THERMOSTAT_AUTOMATION_PROVIDER,
						state: 'EMPTY',
						slotRevision: 1,
						manualCounter: 1,
						manualHold: false,
						installEvidence: null,
					});
					expect(slot.controllerIncarnation).toMatch(/^[0-9a-f-]{36}$/);
					const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
					expect((await database.manager.findOneByOrFail(VirtualDeviceEntity, { id: controllerId })).enabled).toBe(
						enabled,
					);
					expect(config.comfort?.automation_enabled ?? false).toBe(false);
					expect(config.comfort?.automation_baseline ?? null).toBeNull();
					expect((await automation.resolve(database.manager, config)).isCurrent()).toBe(false);
					expect(JSON.stringify(responseWire(result))).not.toContain(slot.controllerIncarnation);
					expect(publications).toContain(EventType.DEVICE_CREATED);
				}
			} finally {
				automation.onModuleDestroy();
				automationRegistry.onModuleDestroy();
			}
		},
	);

	it.each([
		'success',
		'slot_birth',
		'delete_rollback',
		'native_preimage',
		'lost_cas',
		'concurrent',
		'stale_tombstone',
		'retained_row_changed',
		'raw_delete',
		'provider_replaced',
		'runtime_history',
		'history_unresolved',
		'history_terminal_without_off',
		'history_reservation',
		'history_row_drift',
		'history_postimage',
		'history_rollback',
		'history_lost_cas',
		'history_concurrent',
		'history_overflow',
		'history_old_runtime',
	] as const)('recreates only an exact native deletion through the original authoring unit: %s', async (scenario) => {
		const automationRegistry = new ClimateAutomationRegistryService();
		const ledger = new ClimateAutomationLedgerService(database, lock, automationRegistry);
		graph = new VirtualDependencyGraphService(database, undefined, ledger);
		const automation = new VirtualThermostatAutomationService(database, automationRegistry, ledger, graph, lock);
		claims.onModuleDestroy();
		claims = new VirtualThermostatClaimsService(database, lock, graph, registry, events);
		await claims.onApplicationBootstrap();
		configs = new VirtualThermostatConfigService(database, lock, graph, claims, events, values, undefined, automation);
		devices = new DevicesService(
			database.getRepository(DeviceEntity),
			database.getRepository(SpaceEntity),
			deviceMapper,
			channels,
			properties,
			{} as never,
			zones,
			lock,
			database,
			events,
			ledger,
		);
		authoring = new VirtualThermostatAuthoringService(
			database,
			lock,
			graph,
			devices,
			new DeviceValidationService(devices),
			configs,
		);
		const ownership = new VirtualThermostatOwnershipSubscriber(database, claims);
		await ownership.onApplicationBootstrap();
		automation.onModuleInit();
		await automation.onApplicationBootstrap();
		const input = request(relayId);
		const id = input.device.id;
		const deletionEvents: unknown[] = [];
		const deletionListener = (device: DeviceEntity) => {
			if (device.id !== id) return;
			deletionEvents.push({ device, transactionActive: isSqliteTransactionActive(database) });
		};
		events.on(EventType.DEVICE_DELETED, deletionListener);
		try {
			await authoring.create(input);
			const initial = {
				...(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id })),
			};
			if (scenario === 'provider_replaced') {
				let entered: () => void, release: () => void;
				const started = new Promise<void>((resolve) => {
					entered = resolve;
				});
				const held = new Promise<void>((resolve) => {
					release = resolve;
				});
				let captured = false;
				const subscriber: EntitySubscriberInterface = {
					afterQuery: async (event) => {
						if (
							!captured &&
							event.query.startsWith('SELECT') &&
							event.query.includes('devices_module_climate_automation_slots')
						) {
							captured = true;
							entered();
							await held;
						}
					},
				};
				database.subscribers.push(subscriber);
				const original = ledger.captureControllerDeletion(id);
				const successorProvider = new VirtualThermostatAutomationService(
					database,
					automationRegistry,
					ledger,
					graph,
					lock,
				);
				try {
					await started;
					automation.onModuleDestroy();
					successorProvider.onModuleInit();
					release();
					await expect(original).rejects.toThrow();
					expect({
						...(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id })),
					}).toEqual(initial);
					expect(await database.manager.count(ClimateAutomationDeletionEntity)).toBe(0);
					expect(await database.manager.findOneBy(VirtualDeviceEntity, { id })).not.toBeNull();
				} finally {
					release();
					await Promise.allSettled([original]);
					successorProvider.onModuleDestroy();
					database.subscribers.splice(database.subscribers.indexOf(subscriber), 1);
				}
				return;
			}
			const oldDeletion = await ledger.captureControllerDeletion(id);
			// The fixture starts deletion from a terminal reservation. This does not assert physical OFF qualification.
			await lock.runExclusive(() =>
				database.manager.update(
					VirtualThermostatActuatorClaimEntity,
					{ controllerId: id },
					{ state: 'released', releasedAt: new Date() },
				),
			);
			let priorHistory: { runtime: object[]; branches: object[]; commands: object[] } | undefined;
			const oldJournal = new ThermostatRuntimeJournal(database, lock);
			let oldRuntime: VirtualThermostatRuntimeEntity | undefined;
			if (scenario === 'runtime_history' || scenario.startsWith('history_')) {
				const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
					controllerId: id,
				});
				await lock.runExclusive(() =>
					database.transaction(async (manager) => {
						await manager.insert(VirtualThermostatRuntimeEntity, {
							controllerId: id,
							decisionRevision: scenario === 'history_overflow' ? Number.MAX_SAFE_INTEGER : 7,
							configurationRevision: 1,
							floorLatched: true,
							heuristicHold: null,
							previousDemand: 'heat',
							reasons: ['retained_history'],
							evaluatedAt: new Date(),
						});
						await manager.insert(VirtualThermostatBranchRuntimeEntity, {
							claimId: claim.id,
							activity: 'unknown',
							lastVerifiedOffAt: null,
							releaseProofId: null,
							releaseAttempts: 0,
							nextReleaseAt: null,
							fault: 'retained diagnostic',
							floorLatched: null,
						});
						// A cancelled, never-dispatched request is history, not qualified OFF or actuation evidence.
						await manager.insert(VirtualThermostatCommandEntity, {
							id: uuid(),
							controllerId: id,
							claimId: claim.id,
							claimRevision: claim.revision,
							configurationRevision: 1,
							decisionRevision: scenario === 'history_overflow' ? Number.MAX_SAFE_INTEGER : 7,
							action: 'on',
							status:
								scenario === 'history_unresolved'
									? 'unknown'
									: scenario === 'history_terminal_without_off'
										? 'confirmed'
										: 'cancelled',
							preparedAt: new Date(),
							dispatchedAt: scenario === 'history_terminal_without_off' ? new Date() : null,
							settledAt: new Date(),
							proofId: null,
							fault: 'never submitted',
						});
					}),
				);
				if (scenario === 'history_reservation')
					await database.manager.update(VirtualThermostatActuatorClaimEntity, { id: claim.id }, { state: 'releasing' });
				priorHistory = {
					runtime: await database.query<object[]>('SELECT * FROM devices_virtual_thermostat_runtime'),
					branches: await database.query<object[]>('SELECT * FROM devices_virtual_thermostat_branch_runtime'),
					commands: await database.query<object[]>('SELECT * FROM devices_virtual_thermostat_command_journal'),
				};
			}
			if (scenario === 'history_old_runtime') {
				oldRuntime = await database.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, { controllerId: id });
				await oldJournal.captureRuntimeRow(database.manager, oldRuntime);
			}
			if (scenario === 'history_reservation') {
				// The existing actual ownership subscriber refuses before native deletion itself.
				await expect(devices.remove(id)).rejects.toThrow('Thermostat actuator is reserved');
				expect(await database.manager.count(ClimateAutomationDeletionEntity)).toBe(0);
				expect({
					...(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id })),
				}).toEqual(initial);
				expect(await database.manager.findOneBy(VirtualDeviceEntity, { id })).not.toBeNull();
				expect(await database.query('SELECT * FROM devices_virtual_thermostat_runtime')).toEqual(priorHistory.runtime);
				expect(await database.query('SELECT * FROM devices_virtual_thermostat_branch_runtime')).toEqual(
					priorHistory.branches,
				);
				expect(await database.query('SELECT * FROM devices_virtual_thermostat_command_journal')).toEqual(
					priorHistory.commands,
				);
				return;
			}
			if (scenario === 'delete_rollback')
				await database.query(`CREATE TEMP TRIGGER fail_original_delete AFTER DELETE ON devices_module_devices
					WHEN OLD.id = '${id}' BEGIN SELECT RAISE(ABORT, 'original deletion failure'); END`);
			if (scenario === 'native_preimage')
				await database.query(`CREATE TEMP TRIGGER alter_original_delete BEFORE DELETE ON devices_module_devices
					WHEN OLD.id = '${id}' BEGIN UPDATE devices_virtual_thermostat_configs SET revision=revision+1 WHERE controllerId=OLD.id; END`);
			if (scenario === 'delete_rollback' || scenario === 'native_preimage') {
				await expect(devices.remove(id)).rejects.toThrow(
					scenario === 'delete_rollback'
						? 'original deletion failure'
						: 'Thermostat automation provenance or selection is unavailable.',
				);
				expect(deletionEvents).toEqual([]);
				expect(await database.manager.count(ClimateAutomationDeletionEntity)).toBe(0);
				expect({
					...(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id })),
				}).toEqual(initial);
				expect(await database.manager.findOneBy(VirtualDeviceEntity, { id })).not.toBeNull();
				expect(
					(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).revision,
				).toBe(1);
				return;
			}
			if (scenario === 'raw_delete') {
				await lock.runExclusive(() => database.manager.delete(DeviceEntity, { id }));
				expect(await database.manager.count(ClimateAutomationDeletionEntity)).toBe(0);
				const unproven = request(relayId);
				unproven.device.id = id;
				await expect(authoring.create(unproven)).rejects.toThrow('Private climate ledger conflict: stale');
				expect({
					...(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id })),
				}).toEqual(initial);
				expect(await database.manager.findOneBy(VirtualDeviceEntity, { id })).toBeNull();
				return;
			}
			const capturedFinishes: jest.Mock[] = [];
			let recapture: jest.SpyInstance | undefined;
			if (scenario === 'slot_birth') {
				await database.manager.delete(ClimateAutomationSlotEntity, { controllerId: id });
				const capture: ClimateAutomationLedgerService['captureControllerDeletion'] =
					ledger.captureControllerDeletion.bind(ledger);
				let calls = 0;
				recapture = jest.spyOn(ledger, 'captureControllerDeletion').mockImplementation(async (controllerId) => {
					expect(lock.hasCurrentStructuralLease()).toBe(false);
					const original = await capture(controllerId);
					if (++calls === 1) await database.manager.insert(ClimateAutomationSlotEntity, initial);
					if (!original) return original;
					const finish = jest.fn((outcome: ClimateAutomationMutationOutcome) => original.finish(outcome));
					capturedFinishes.push(finish);
					return Object.freeze(
						Object.assign((...args: Parameters<ClimateAutomationDeletionCapture>) => original(...args), {
							finish,
							hasControllerSlot: original.hasControllerSlot,
						}),
					);
				});
			}
			try {
				await devices.remove(id);
				if (scenario === 'slot_birth') {
					expect(recapture).toHaveBeenCalledTimes(2);
					expect(capturedFinishes).toHaveLength(2);
					expect(capturedFinishes[0]).toHaveBeenCalledTimes(1);
					expect(capturedFinishes[0]).toHaveBeenCalledWith('rolled_back');
					expect(capturedFinishes[1]).toHaveBeenCalledTimes(1);
					expect(capturedFinishes[1]).toHaveBeenCalledWith('committed');
				}
			} finally {
				recapture?.mockRestore();
			}
			expect(deletionEvents).toMatchObject([{ transactionActive: false }]);
			const deleted = {
				...(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id })),
			};
			const proof = {
				...(await database.manager.findOneByOrFail(ClimateAutomationDeletionEntity, { controllerId: id })),
			};
			expect(deleted.manualHold).toBe(true);
			expect(deleted.slotRevision).toBeGreaterThan(initial.slotRevision);
			expect(proof).toMatchObject({
				controllerIncarnation: initial.controllerIncarnation,
				slotRevision: deleted.slotRevision,
				consumedByIncarnation: null,
				consumedSlotRevision: null,
			});
			expect(JSON.parse(proof.nativeDeviceEvidence)).toEqual(JSON.parse(proof.deviceEvidence));
			expect(JSON.parse(proof.nativeConfigurationEvidence)).toEqual(JSON.parse(proof.configurationEvidence));
			expect(await database.manager.findOneBy(VirtualDeviceEntity, { id })).toBeNull();
			expect(
				(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).ownerDeviceId,
			).toBeNull();
			const successor = request(relayId);
			successor.device.id = id;
			publications.length = 0;
			if (scenario === 'stale_tombstone' || scenario === 'retained_row_changed') {
				if (scenario === 'stale_tombstone')
					await database.manager.update(
						ClimateAutomationDeletionEntity,
						{ deletionId: proof.deletionId },
						{ slotRevision: proof.slotRevision + 1 },
					);
				else await database.manager.update(VirtualThermostatConfigEntity, { controllerId: id }, { revision: 2 });
				const beforeAttempt = {
					...(await database.manager.findOneByOrFail(ClimateAutomationDeletionEntity, {
						deletionId: proof.deletionId,
					})),
				};
				await expect(authoring.create(successor)).rejects.toThrow(
					scenario === 'stale_tombstone'
						? 'Private climate ledger conflict: stale'
						: 'Thermostat automation provenance or selection is unavailable.',
				);
				expect({
					...(await database.manager.findOneByOrFail(ClimateAutomationDeletionEntity, {
						deletionId: proof.deletionId,
					})),
				}).toEqual(beforeAttempt);
				expect({
					...(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id })),
				}).toEqual(deleted);
				expect(await database.manager.findOneBy(VirtualDeviceEntity, { id })).toBeNull();
				expect(publications).toEqual([]);
				return;
			}
			const assertRetainedHistory = async () => {
				if (!priorHistory) return;
				expect(await database.query('SELECT * FROM devices_virtual_thermostat_runtime')).toEqual(priorHistory.runtime);
				expect(await database.query('SELECT * FROM devices_virtual_thermostat_branch_runtime')).toEqual(
					priorHistory.branches,
				);
				expect(await database.query('SELECT * FROM devices_virtual_thermostat_command_journal')).toEqual(
					priorHistory.commands,
				);
			};
			if (
				[
					'history_unresolved',
					'history_terminal_without_off',
					'history_reservation',
					'history_row_drift',
					'history_postimage',
					'history_rollback',
					'history_overflow',
				].includes(scenario)
			) {
				let crossed = false;
				const subscriber: EntitySubscriberInterface = {
					beforeQuery: async (event) => {
						if (
							scenario !== 'history_row_drift' ||
							crossed ||
							!event.query.startsWith('UPDATE "devices_virtual_thermostat_runtime"')
						)
							return;
						crossed = true;
						await event.queryRunner.manager.query(
							'UPDATE devices_virtual_thermostat_runtime SET decisionRevision=decisionRevision+1 WHERE controllerId=?',
							[id],
						);
					},
					afterQuery: async (event) => {
						if (
							scenario !== 'history_postimage' ||
							crossed ||
							!event.query.startsWith('UPDATE "devices_virtual_thermostat_runtime"')
						)
							return;
						crossed = true;
						await event.queryRunner.manager.query(
							'UPDATE devices_virtual_thermostat_command_journal SET fault=? WHERE controllerId=?',
							['foreign listener', id],
						);
					},
					beforeInsert: (event) => {
						if (
							scenario === 'history_rollback' &&
							event.entity instanceof VirtualDeviceEntity &&
							event.entity.id === id
						) {
							crossed = true;
							throw new Error('original recreation catalog failure');
						}
					},
				};
				database.subscribers.push(subscriber);
				try {
					await expect(authoring.create(successor)).rejects.toThrow(
						scenario === 'history_rollback'
							? 'original recreation catalog failure'
							: scenario === 'history_postimage'
								? 'Retained thermostat runtime history changed'
								: 'Retained thermostat history is not eligible for fresh creation',
					);
					if (['history_row_drift', 'history_postimage', 'history_rollback'].includes(scenario))
						expect(crossed).toBe(true);
					await assertRetainedHistory();
					expect({
						...(await database.manager.findOneByOrFail(ClimateAutomationDeletionEntity, { controllerId: id })),
					}).toEqual(proof);
					expect({
						...(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id })),
					}).toEqual(deleted);
					expect(await database.manager.findOneBy(VirtualDeviceEntity, { id })).toBeNull();
					expect(
						await database.query('SELECT * FROM devices_virtual_thermostat_configs WHERE controllerId=?', [id]),
					).toEqual([{ ...(JSON.parse(proof.nativeConfigurationEvidence) as object), ownerDeviceId: null }]);
					expect(publications).toEqual([]);
				} finally {
					database.subscribers.splice(database.subscribers.indexOf(subscriber), 1);
				}
				return;
			}
			if (scenario === 'lost_cas' || scenario === 'history_lost_cas') {
				await database.query(`CREATE TEMP TRIGGER consume_original_before_cas AFTER UPDATE ON devices_virtual_thermostat_configs
						WHEN OLD.ownerDeviceId IS NULL AND NEW.ownerDeviceId IS NOT NULL AND NEW.controllerId = '${id}' BEGIN UPDATE devices_module_climate_automation_deletions
						SET consumedByIncarnation='foreign', consumedSlotRevision=slotRevision+1 WHERE controllerId=NEW.controllerId; END`);
				await expect(authoring.create(successor)).rejects.toThrow('Private climate ledger conflict: stale');
				await assertRetainedHistory();
				expect({
					...(await database.manager.findOneByOrFail(ClimateAutomationDeletionEntity, { controllerId: id })),
				}).toEqual(proof);
				expect({
					...(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id })),
				}).toEqual(deleted);
				expect(await database.manager.findOneBy(VirtualDeviceEntity, { id })).toBeNull();
				expect(
					(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).ownerDeviceId,
				).toBeNull();
				expect(publications).toEqual([]);
				return;
			}
			const priorConfigurationRevision = (
				await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })
			).revision;
			if (scenario === 'concurrent' || scenario === 'history_concurrent') {
				const other = request(relayId);
				other.device.id = id;
				const results = await Promise.allSettled([authoring.create(successor), authoring.create(other)]);
				expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
				expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
			} else await authoring.create(successor);
			const next = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id });

			expect(next).toMatchObject({
				state: 'EMPTY',
				manualHold: false,
				slotRevision: deleted.slotRevision + 1,
				manualCounter: deleted.manualCounter + 1,
				ownerId: null,
				baselineId: null,
				generationId: null,
				installEvidence: null,
			});
			expect(next.controllerIncarnation).not.toBe(initial.controllerIncarnation);
			expect(next.manualGeneration).not.toBe(deleted.manualGeneration);
			const staleDelete = jest.fn(() => Promise.resolve());
			await expect(ledger.runReserved((manager, scope) => oldDeletion(manager, scope, staleDelete))).rejects.toThrow();
			expect(staleDelete).not.toHaveBeenCalled();
			expect({
				...(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id })),
			}).toEqual({ ...next });
			expect(await database.manager.findOneBy(VirtualDeviceEntity, { id })).not.toBeNull();
			const retained = await database.manager.findOneByOrFail(ClimateAutomationDeletionEntity, {
				deletionId: proof.deletionId,
			});
			expect(retained).toMatchObject({
				...proof,
				controllerEvidence: retained.controllerEvidence,
				consumedByIncarnation: next.controllerIncarnation,
				consumedSlotRevision: next.slotRevision,
			});
			const archived = JSON.parse(retained.controllerEvidence) as {
				priorControllerEvidence: string;
				recreationArchive: { history: unknown };
			};
			expect(archived.priorControllerEvidence).toBe(proof.controllerEvidence);
			if (priorHistory) {
				expect(archived.recreationArchive.history).toEqual(priorHistory);
				expect(await database.query('SELECT * FROM devices_virtual_thermostat_branch_runtime')).toEqual(
					priorHistory.branches,
				);
				expect(await database.query('SELECT * FROM devices_virtual_thermostat_command_journal')).toEqual(
					priorHistory.commands,
				);
				expect(
					await database.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, { controllerId: id }),
				).toMatchObject({
					decisionRevision: 8,
					configurationRevision: 2,
					previousDemand: 'off',
					heuristicHold: null,
					floorLatched: false,
					reasons: [],
				});
			}
			if (oldRuntime) {
				const successorRuntime = await database.query('SELECT * FROM devices_virtual_thermostat_runtime');
				oldRuntime.previousDemand = 'heat';
				oldRuntime.decisionRevision += 1;
				await expect(oldJournal.persistRuntimeRows([oldRuntime])).rejects.toThrow(
					'Original thermostat command journal image required',
				);
				expect(await database.query('SELECT * FROM devices_virtual_thermostat_runtime')).toEqual(successorRuntime);
				expect(await database.query('SELECT * FROM devices_virtual_thermostat_command_journal')).toEqual(
					priorHistory.commands,
				);
				expect({
					...(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id })),
				}).toEqual({ ...next });
			}
			const configuration = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
			expect(configuration.revision).toBe(priorConfigurationRevision + 2);
			const freshClaims = await database.manager.findBy(VirtualThermostatActuatorClaimEntity, {
				controllerId: id,
				state: 'reserved',
			});
			expect(freshClaims).toHaveLength(1);
			expect(freshClaims[0].qualificationGeneration).toMatch(/^[0-9a-f-]{36}$/);
			expect(claims.qualification(freshClaims[0], false)).toBeNull();
			expect(configuration.comfort?.automation_enabled ?? false).toBe(false);
			expect(configuration.comfort?.automation_baseline ?? null).toBeNull();
			expect(publications.filter((event) => event === EventType.DEVICE_CREATED)).toHaveLength(1);
		} finally {
			events.off(EventType.DEVICE_DELETED, deletionListener);
			automation.onModuleDestroy();
			automationRegistry.onModuleDestroy();
		}
	});

	it('recreates a used controller only after its original guarded software release and retains the native history', async () => {
		const automationRegistry = new ClimateAutomationRegistryService();
		const ledger = new ClimateAutomationLedgerService(database, lock, automationRegistry);
		graph = new VirtualDependencyGraphService(database, undefined, ledger);
		const automation = new VirtualThermostatAutomationService(database, automationRegistry, ledger, graph, lock);
		claims.onModuleDestroy();
		claims = new VirtualThermostatClaimsService(database, lock, graph, registry, events);
		await graph.onApplicationBootstrap();
		await claims.onApplicationBootstrap();
		configs = new VirtualThermostatConfigService(database, lock, graph, claims, events, values, undefined, automation);
		devices = new DevicesService(
			database.getRepository(DeviceEntity),
			database.getRepository(SpaceEntity),
			deviceMapper,
			channels,
			properties,
			{} as never,
			zones,
			lock,
			database,
			events,
			ledger,
		);
		authoring = new VirtualThermostatAuthoringService(
			database,
			lock,
			graph,
			devices,
			new DeviceValidationService(devices),
			configs,
		);
		const ownership = new VirtualThermostatOwnershipSubscriber(database, claims);
		await ownership.onApplicationBootstrap();
		automation.onModuleInit();
		await automation.onApplicationBootstrap();
		const input = request(relayId);
		input.configuration.requestedMode = 'heat';
		const id = input.device.id;
		await authoring.create(input);
		const producers = new PropertyProducerRegistryService(events);
		const qualifications = new Map<string, ThermostatInstalledQualification>();
		const fixture = await realThermostatGuardFixture(database, events, producers, qualifications);
		const comfort = new VirtualThermostatComfortService(database, lock, graph, claims, events, automation);
		const runtime = new VirtualThermostatRuntimeService(
			database,
			lock,
			claims,
			new VirtualThermostatInputsService(database, fixture.values),
			fixture.transport,
			fixture.values,
			producers,
			events,
			graph,
			comfort,
			new NestConfigService(),
			undefined,
			automation,
		);
		let captureEntered: (() => void) | undefined;
		const originalCapture = runtime.capturePredecessors.bind(
			runtime,
		) as VirtualThermostatRuntimeService['capturePredecessors'];
		jest.spyOn(runtime, 'capturePredecessors').mockImplementation((controllerId) => {
			const completion = originalCapture(controllerId);
			captureEntered?.();
			return completion;
		});
		let releaseFence: (() => void) | undefined;
		const issued: Promise<unknown>[] = [];
		const qualify = async () => {
			for (const claim of await database.manager.findBy(VirtualThermostatActuatorClaimEntity, { controllerId: id })) {
				if (claim.state !== 'released')
					claims.recordQualification({
						...qualifications.get(claim.physicalIdentity),
						qualificationGeneration: claim.qualificationGeneration,
					});
			}
		};
		try {
			await qualify();
			await fixture.report(ambientId, 16);
			await fixture.report(relayId, false);
			await runtime.onApplicationBootstrap();
			for (let phase = 0; phase < 3; phase++) {
				await runtime.requestInstalled(id);
				await fixture.flushTelemetry();
			}
			expect(fixture.controls.sends).toContainEqual({ property: relayId, on: true });
			const originalSlot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id });
			const configuration = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
			await configs.requestRelease(id, configuration.revision);
			await qualify();
			let fenceEntered: () => void;
			const entered = new Promise<void>((resolve) => {
				fenceEntered = resolve;
			});
			const held = new Promise<void>((resolve) => {
				releaseFence = resolve;
			});
			fixture.controls.beforeFence = async () => {
				fenceEntered();
				await held;
			};
			const originalRelease = runtime.requestInstalled(id);
			issued.push(originalRelease);
			await entered;
			const captured = new Promise<void>((resolve) => {
				captureEntered = resolve;
			});
			let deletionSettled = false;
			const deletion = devices.remove(id).finally(() => {
				deletionSettled = true;
			});
			issued.push(deletion);
			await captured;
			// Exact original OFF work remains joined outside both owners it needs.
			await lock.runExclusive(() =>
				database.transaction(async (manager) => {
					expect(await manager.findOneBy(VirtualDeviceEntity, { id })).not.toBeNull();
					expect(await manager.count(ClimateAutomationDeletionEntity)).toBe(0);
				}),
			);
			expect(deletionSettled).toBe(false);
			releaseFence();
			await originalRelease;
			await deletion;
			captureEntered = undefined;
			fixture.controls.beforeFence = null;
			const originalClaim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
				controllerId: id,
			});
			expect(originalClaim).toMatchObject({
				state: 'released',
				releaseEvidence: { outputConfirmedOff: true, pendingOnDrained: true },
			});
			const before = await readThermostatRecreationHistory(database.manager, id);
			expect(before.commands.length).toBeGreaterThan(0);
			expect(before.branches.length).toBe(1);
			expect(before.runtime.length).toBe(1);
			const successor = request(relayId);
			successor.device.id = id;
			successor.configuration.requestedMode = 'heat';
			const originalOnCount = fixture.controls.sends.filter((send) => send.on).length;
			let archivedPreimage: Awaited<ReturnType<typeof readThermostatRecreationHistory>> | undefined;
			const archiveObserver: EntitySubscriberInterface = {
				beforeQuery: async (event) => {
					if (
						!archivedPreimage &&
						event.query.startsWith('UPDATE "devices_module_climate_automation_deletions"') &&
						event.query.includes('"controllerEvidence" =')
					) {
						archivedPreimage = await readThermostatRecreationHistory(event.queryRunner.manager, id);
					}
				},
			};
			database.subscribers.push(archiveObserver);
			try {
				await authoring.create(successor);
			} finally {
				database.subscribers.splice(database.subscribers.indexOf(archiveObserver), 1);
			}
			const next = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id });
			expect(next.controllerIncarnation).not.toBe(originalSlot.controllerIncarnation);
			expect(next.slotRevision).toBeGreaterThan(originalSlot.slotRevision);
			const proof = await database.manager.findOneByOrFail(ClimateAutomationDeletionEntity, { controllerId: id });
			const archive = JSON.parse(proof.controllerEvidence) as { recreationArchive: { history: unknown } };
			expect(archivedPreimage).toBeDefined();
			expect(archive.recreationArchive.history).toEqual(archivedPreimage);
			expect(archivedPreimage.commands).toEqual(before.commands);
			expect(archivedPreimage.branches).toEqual(before.branches);
			const after = await readThermostatRecreationHistory(database.manager, id);
			// Creation publishes normally: successor OFF diagnostics can append new rows.
			// Every historical byte remains unchanged; no successor row may adopt an old claim.
			const oldCommandIds = new Set(before.commands.map((row) => row.id));
			const oldClaimIds = new Set(before.branches.map((row) => row.claimId));
			expect(after.commands.filter((row) => oldCommandIds.has(row.id))).toEqual(before.commands);
			expect(after.branches.filter((row) => oldClaimIds.has(row.claimId))).toEqual(before.branches);
			const fresh = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
				controllerId: id,
				state: 'reserved',
			});
			expect(fresh.id).not.toBe(originalClaim.id);
			expect(
				after.commands
					.filter((row) => !oldCommandIds.has(row.id))
					.every((row) => row.claimId === fresh.id && row.action === 'off'),
			).toBe(true);
			expect(fresh.qualificationGeneration).not.toBe(originalClaim.qualificationGeneration);
			expect(claims.qualification(fresh, false)).toBeNull();
			claims.recordQualification({
				...qualifications.get(originalClaim.physicalIdentity),
				qualificationGeneration: originalClaim.qualificationGeneration,
			});
			expect(claims.qualification(fresh, false)).toBeNull();
			await runtime.requestInstalled(id);
			await fixture.flushTelemetry();
			expect(fixture.controls.sends.filter((send) => send.on)).toHaveLength(originalOnCount);
			await qualify();
			await fixture.report(ambientId, 16);
			await fixture.report(relayId, false);
			for (let phase = 0; phase < 3; phase++) {
				await runtime.requestInstalled(id);
				await fixture.flushTelemetry();
			}
			expect(fixture.controls.sends.filter((send) => send.on).length).toBeGreaterThan(originalOnCount);
			expect(fixture.controls.errors).toEqual([]);
		} finally {
			releaseFence?.();
			await Promise.allSettled(issued);
			runtime.onModuleDestroy();
			await runtime.capturePredecessors(id);
			await runtime.flush();
			await fixture.dispose();
			producers.onModuleDestroy();
			automation.onModuleDestroy();
			automationRegistry.onModuleDestroy();
			jest.useRealTimers();
		}
	});

	it('previews metadata without changing catalog, claim epoch, ON admission or publications', async () => {
		const input = request(relayId);
		const epoch = registry.capture();
		const target = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: relayId },
			relations: ['channel', 'channel.device'],
		});
		const admission = {
			property: target,
			channel: target.channel as ChannelEntity,
			device: (target.channel as ChannelEntity).device as DeviceEntity,
			value: true,
		};
		await registry.assertAllowed(admission);
		const preview = await authoring.preview(input);
		expect(preview.readiness).toBe('draft');
		expect(epoch.isCurrent()).toBe(true);
		await registry.assertAllowed(admission);
		expect(
			await database.manager.count(VirtualDeviceEntity, { where: { mode: VirtualDeviceMode.CLIMATE_CONTROLLER } }),
		).toBe(0);
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(0);
		expect(publications).toEqual([]);
		expect(values.write).not.toHaveBeenCalled();
	});

	it('resolves a saved property directly to its channel and device', async () => {
		const property = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: ambientId },
			relations: ['channel', 'channel.device'],
		});
		const channel = property.channel as ChannelEntity;
		expect(await authoring.propertyBinding(ambientId)).toEqual({
			property: ambientId,
			channel: channel.id,
			device: (channel.device as DeviceEntity).id,
		});
		expect(await authoring.propertyBinding(uuid())).toBeNull();
	});

	it('commits the owner and canonical reservation together and rejects a second UUID alias', async () => {
		const first = request(relayId);
		const callerBefore = JSON.stringify(first);
		const created = await authoring.create(first);
		expect(JSON.stringify(first)).toBe(callerBefore);
		expect(created.device.id).toBe(first.device.id);
		expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(1);
		const alias = await actuator(relayDeviceId);
		const second = request(alias);
		publications.length = 0;
		await expect(authoring.create(second)).rejects.toThrow('Canonical physical actuator is already reserved');
		expect(
			await database.manager.count(VirtualDeviceEntity, { where: { mode: VirtualDeviceMode.CLIMATE_CONTROLLER } }),
		).toBe(1);
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(1);
		expect(publications).toEqual([]);
	});

	it.each(['value write', 'claims refresh', 'event publication', 'device hydration'])(
		'returns the persisted thermostat when post-commit %s fails',
		async (failure) => {
			const input = request(relayId);
			if (failure === 'value write') jest.spyOn(values, 'write').mockRejectedValueOnce(new Error('value write failed'));
			if (failure === 'claims refresh')
				jest.spyOn(claims, 'refresh').mockRejectedValueOnce(new Error('refresh failed'));
			if (failure === 'event publication')
				jest.spyOn(events, 'emit').mockImplementation((event: string | symbol, ...args: unknown[]) => {
					if (event === THERMOSTAT_CONFIG_CHANGED) throw new Error('publication failed');
					return Boolean(EventEmitter2.prototype.emit.call(events, event, ...args));
				});
			if (failure === 'device hydration')
				jest.spyOn(devices, 'findOne').mockRejectedValueOnce(new Error('hydration failed'));
			const created = await authoring.create(input);
			expect(created.device.id).toBe(input.device.id);
			expect(created.device.channels).toHaveLength(input.device.channels.length);
			expect(created.configuration.controller).toBe(input.device.id);
			expect(created.configuration.revision).toBe(1);
			expect(created.configuration.actuators).toEqual([
				expect.objectContaining({ source_property: relayId, state: 'reserved', revision: 1 }),
			]);
			expect(created.configuration.readiness).toBe('draft');
			const settingId = input.configuration.settings.find(
				(setting) => setting.setting === 'heating_enabled',
			).propertyId;
			const committedSetting = created.device.channels
				.flatMap((channel) => channel.properties)
				.find((property) => property.id === settingId);
			expect(committedSetting?.permissions).toEqual([PermissionType.READ_WRITE]);
			expect((await database.manager.findOneByOrFail(ChannelPropertyEntity, { id: settingId })).permissions).toEqual([
				PermissionType.READ_WRITE,
			]);
			expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
			expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(1);
			expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(1);
		},
	);

	it.each(['catalog', 'configuration', 'hydration'] as const)(
		'selects the entire original response after a real %s rejection and still finishes later phases',
		async (phase) => {
			const input = request(relayId),
				cause = phase === 'configuration' ? undefined : phase === 'hydration' ? false : new Error('catalog');
			let originalDevice: VirtualDeviceEntity, originalWire: unknown;
			let originalConfiguration: VirtualThermostatConfigurationModel;
			const stages: string[] = [];
			let finalHydration = false;
			database.subscribers.push({
				afterLoad(entity) {
					if (entity instanceof VirtualDeviceEntity && entity.id === input.device.id) originalDevice = entity;
				},
			});
			const snapshot = configs.snapshot.bind(configs) as VirtualThermostatConfigService['snapshot'];
			jest.spyOn(configs, 'snapshot').mockImplementation(async (...args) => {
				originalConfiguration = await snapshot(...args);
				originalWire = responseWire(
					Object.assign(new VirtualCreatedThermostatModel(), {
						device: originalDevice,
						configuration: originalConfiguration,
					}),
				);
				stages.push('snapshot');
				return originalConfiguration;
			});
			const mapping = propertyMapper.getMapping('virtual');
			mapping.afterCreate = async () => {
				stages.push('catalog');
				if (phase === 'catalog') {
					// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Exact unknown rejection.
					return Promise.reject(cause);
				}
			};
			propertyMapper.registerMapping(mapping);
			const afterCommit = configs.afterCommit.bind(configs) as VirtualThermostatConfigService['afterCommit'];
			jest.spyOn(configs, 'afterCommit').mockImplementation(async (...args) => {
				stages.push('configuration');
				finalHydration = true;
				const result = await afterCommit(...args);
				// These were captured before ACK and must no longer alias settlement or fallback.
				originalDevice.name = 'shared entity mutated';
				(originalDevice.createdAt as Date).setFullYear(2000);
				originalConfiguration.reasons.push('shared configuration mutated');
				if (phase === 'configuration') {
					// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Falsy rejection by presence.
					return Promise.reject(cause);
				}
				return result;
			});
			const find = devices.findOne.bind(devices) as DevicesService['findOne'];
			jest.spyOn(devices, 'findOne').mockImplementation(async (...args) => {
				if (finalHydration) stages.push('hydration');
				const result = await find(...args);
				if (finalHydration && result) result.name = 'later successful candidate';
				if (finalHydration && phase === 'hydration') {
					// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Falsy rejection by presence.
					return Promise.reject(cause);
				}
				return result;
			});
			const run = DeviceCreationContext.runPinned;
			let settlement: CreationSettlement<RetainedOriginalCreatedResponse>;
			jest.spyOn(DeviceCreationContext, 'runPinned').mockImplementation((...args) => {
				settlement = args[4] as CreationSettlement<RetainedOriginalCreatedResponse>;
				return run(...args);
			});
			const created = await authoring.create(input);
			expect(responseWire(created)).toEqual(originalWire);
			originalDevice.channels[0].properties[0].permissions.push(PermissionType.READ_WRITE);
			originalConfiguration.policy.heatingSetpoint = 99;
			expect(responseWire(created)).toEqual(originalWire);
			expect(stages.filter((stage) => stage !== 'catalog')).toEqual(['snapshot', 'configuration', 'hydration']);
			expect(stages.filter((stage) => stage === 'catalog')).toHaveLength(
				input.device.channels.reduce((count, channel) => count + channel.properties.length, 0),
			);
			expect(settlement.outcome).toBe('committed');
			expect(settlement.legacyPublicationFailure?.cause).toBe(phase === 'catalog' ? cause : undefined);
			expectImmutableResponse(settlement.result.value);
			const response = thermostatCreationResponse.pin();
			expect(responseWire(response.materialize(settlement.result.value))).toEqual(originalWire);
			expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
			expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(1);
			expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(1);
			expect(values.write).toHaveBeenCalledTimes(input.configuration.settings.length);
		},
	);

	it.each([
		'first-hook',
		'first-hook-restored',
		'graph-settlement',
		'shape-first-hook',
		'shape-first-hook-restored',
	] as const)('observation expiry preserves every original publication after native ACK at %s', async (phase) => {
		const input = request(relayId),
			originalManager = database.manager,
			physical = Object.getOwnPropertyDescriptor(database.driver, 'databaseConnection')?.value as unknown;
		const baseType = Object.getOwnPropertyDescriptor(DeviceEntity.prototype, 'type');
		const virtualType = Object.getOwnPropertyDescriptor(VirtualDeviceEntity.prototype, 'type');
		const shapeExpiry = phase.startsWith('shape-');
		const ids = input.device.channels.flatMap((channel) => channel.properties.map(({ id }) => id));
		const hooks: string[] = [],
			reloads: string[] = [],
			emitted: string[] = [];
		const ownerChecks: boolean[] = [];
		let settlement: CreationSettlement<RetainedOriginalCreatedResponse>;
		const run = DeviceCreationContext.runPinned;
		jest.spyOn(DeviceCreationContext, 'runPinned').mockImplementation((...args) => {
			settlement = args[4] as CreationSettlement<RetainedOriginalCreatedResponse>;
			return run(...args);
		});
		const expire = () => {
			expect(settlement.outcome).toBe('committed');
			if (shapeExpiry) {
				Object.defineProperty(DeviceEntity.prototype, 'type', { ...baseType, enumerable: !baseType.enumerable });
				expect(database.manager).toBe(originalManager);
				expect(Object.getOwnPropertyDescriptor(VirtualDeviceEntity.prototype, 'type')).toEqual(virtualType);
			} else {
				expect(Reflect.set(database, 'manager', database.createEntityManager())).toBe(true);
				expect(database.manager).not.toBe(originalManager);
			}
			expect(database.isInitialized).toBe(true);
			expect(Object.getOwnPropertyDescriptor(database.driver, 'databaseConnection')?.value).toBe(physical);
		};
		const mapping = propertyMapper.getMapping('virtual');
		mapping.afterCreate = (property) => {
			hooks.push(property.id);
			ownerChecks.push(lock.hasCurrentStructuralLease());
			expect(settlement.outcome).toBe('committed');
			if (hooks.length === 1 && phase !== 'graph-settlement') expire();
			if (hooks.length === ids.length && phase.endsWith('restored')) {
				if (shapeExpiry) Object.defineProperty(DeviceEntity.prototype, 'type', baseType);
				else expect(Reflect.set(database, 'manager', originalManager)).toBe(true);
			}
			return Promise.resolve(property);
		};
		propertyMapper.registerMapping(mapping);
		const reload = properties.getOneOrThrow.bind(properties) as ChannelsPropertiesService['getOneOrThrow'];
		jest.spyOn(properties, 'getOneOrThrow').mockImplementation(async (id) => {
			reloads.push(id);
			ownerChecks.push(lock.hasCurrentStructuralLease());
			return reload(id);
		});
		const catalog = devices.captureCreationCatalog('virtual');
		for (const event of [EventType.CHANNEL_PROPERTY_CREATED, EventType.CHANNEL_CREATED, EventType.DEVICE_CREATED])
			events.on(event, (entity: { id: string }) => {
				emitted.push(entity.id);
				ownerChecks.push(lock.hasCurrentStructuralLease());
			});
		if (phase === 'graph-settlement') {
			const write = graph.withCreationWrite.bind(graph) as VirtualDependencyGraphService['withCreationWrite'];
			jest.spyOn(graph, 'withCreationWrite').mockImplementation(async (...args) => {
				const result = await write(...args);
				expire();
				return result;
			});
		}
		let configured = false,
			finalHydrations = 0;
		const afterCommit = configs.afterCommit.bind(configs) as VirtualThermostatConfigService['afterCommit'];
		const configuredSpy = jest.spyOn(configs, 'afterCommit').mockImplementation(async (...args) => {
			expect(hooks).toEqual(ids);
			expect(reloads).toEqual(ids);
			ownerChecks.push(lock.hasCurrentStructuralLease());
			const result = await afterCommit(...args);
			configured = true;
			return result;
		});
		const find = devices.findOne.bind(devices) as DevicesService['findOne'];
		jest.spyOn(devices, 'findOne').mockImplementation(async (...args) => {
			const selected = await find(...args);
			if (configured && args[0] === input.device.id) {
				finalHydrations++;
				ownerChecks.push(lock.hasCurrentStructuralLease());
				selected.name = 'later candidate after reader expiry';
			}
			return selected;
		});
		const baselineResponse = thermostatCreationResponse.pin();
		try {
			const created = await authoring.create(input);
			expect(hooks).toEqual(ids);
			expect(reloads).toEqual(ids);
			expect(emitted).toEqual([
				...input.device.channels.flatMap((channel) => [...channel.properties.map(({ id }) => id), channel.id]),
				input.device.id,
			]);
			expect(catalog.current()).toBe(true);
			expect(baselineResponse.current()).toBe(true);
			expect(settlement.receipt.outcome).toBe('committed');
			expect(settlement.legacyPublicationFailure).toBeUndefined();
			expect(configuredSpy).toHaveBeenCalledTimes(1);
			expect(finalHydrations).toBe(1);
			expect(ownerChecks.every(Boolean)).toBe(true);
			expect(responseWire(created)).toEqual(responseWire(baselineResponse.materialize(settlement.result.value)));
			expect(created.device.name).toBe(input.device.name);
		} finally {
			Object.defineProperty(DeviceEntity.prototype, 'type', baseType);
			Reflect.set(database, 'manager', originalManager);
		}
	});

	it.each(['reader', 'shape'] as const)(
		'refuses %s-only expiry at actual BeforeQuery COMMIT without native submission',
		async (kind) => {
			const input = request(relayId),
				originalManager = database.manager;
			const baseType = Object.getOwnPropertyDescriptor(DeviceEntity.prototype, 'type');
			type Native = { all(sql: string, parameters: unknown[], callback: (...args: unknown[]) => void): unknown };
			const native = (database.driver as SqliteDriver).databaseConnection as Native;
			const original = native.all;
			let submissions = 0,
				observed = 0;
			jest.spyOn(native, 'all').mockImplementation(function (this: Native, ...args) {
				if (args[0] === 'COMMIT') submissions++;
				return original.apply(this, args);
			});
			database.subscribers.push({
				beforeQuery: (event) => {
					if (event.query === 'COMMIT' && observed++ === 0) {
						if (kind === 'shape')
							Object.defineProperty(DeviceEntity.prototype, 'type', { ...baseType, enumerable: !baseType.enumerable });
						else Reflect.set(database, 'manager', database.createEntityManager());
					}
				},
			} satisfies EntitySubscriberInterface);
			try {
				await expect(authoring.create(input)).rejects.toMatchObject({ settlement: { outcome: 'refused' } });
				expect(observed).toBe(1);
				expect(submissions).toBe(0);
				await expectAbsent(input);
			} finally {
				Object.defineProperty(DeviceEntity.prototype, 'type', baseType);
				Reflect.set(database, 'manager', originalManager);
			}
		},
	);

	it.each(['copy', 'materialization'] as const)(
		'isolates candidate %s failure and keeps one hydration with the full original native result',
		async (phase) => {
			const input = request(relayId),
				find = devices.findOne.bind(devices) as DevicesService['findOne'];
			const afterCommit = configs.afterCommit.bind(configs) as VirtualThermostatConfigService['afterCommit'];
			let finalHydration = false,
				finalReads = 0;
			jest.spyOn(configs, 'afterCommit').mockImplementation(async (...args) => {
				const result = await afterCommit(...args);
				finalHydration = true;
				return result;
			});
			const hydrate = jest.spyOn(devices, 'findOne').mockImplementation(async (...args) => {
				const result = await find(...args);
				if (finalHydration) finalReads++;
				if (finalHydration && phase === 'copy') {
					result.name = {
						valueOf: () => {
							throw new Error('must not coerce');
						},
					} as never;
				}
				return result;
			});
			let materializationAttempts = 0;
			if (phase === 'materialization') {
				const define = Object.defineProperty;
				jest.spyOn(Object, 'defineProperty').mockImplementation((target, key, descriptor) => {
					if (target instanceof VirtualCreatedThermostatModel && key === 'device' && ++materializationAttempts === 1)
						throw new Error('candidate materialization failed');
					return define(target, key, descriptor);
				});
			}
			const result = await authoring.create(input);
			expect(result.device.name).toBe(input.device.name);
			if (phase === 'materialization') expect(materializationAttempts).toBe(2);
			expect(hydrate).toHaveBeenCalledTimes(2);
			expect(finalReads).toBe(1);
			expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
		},
	);

	it.each(
		(['V0', 'Before', 'After'] as const).flatMap((phase) =>
			[undefined, null, false, 0, '', new Error('original proof rejection')].map((cause, index) => ({
				phase,
				cause,
				index,
			})),
		),
	)('keeps original proof rejection by presence at $phase cause$index', async ({ phase, cause }) => {
		const input = request(relayId);
		const sourceQuery = database.query.bind(database) as SqliteDataSource['query'];
		const target = { V0: 1, Before: 2, After: 3 }[phase];
		let observed = 0,
			finalPhase = false,
			finalHydrations = 0;
		jest.spyOn(database, 'query').mockImplementation((async (...args: Parameters<SqliteDataSource['query']>) => {
			if (args[0].startsWith('WITH root AS') && ++observed === target) {
				// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Exact finite falsy/native cause fixture.
				return Promise.reject(cause);
			}
			const raw: unknown = await sourceQuery(...args);
			return raw;
		}) as SqliteDataSource['query']);
		const afterCommit = configs.afterCommit.bind(configs) as VirtualThermostatConfigService['afterCommit'];
		jest.spyOn(configs, 'afterCommit').mockImplementation(async (...args) => {
			const result = await afterCommit(...args);
			finalPhase = true;
			return result;
		});
		const find = devices.findOne.bind(devices) as DevicesService['findOne'];
		jest.spyOn(devices, 'findOne').mockImplementation(async (...args) => {
			const selected = await find(...args);
			if (finalPhase && args[0] === input.device.id) {
				finalHydrations++;
				if (selected) selected.name = 'later successful candidate';
			}
			return selected;
		});
		const run = DeviceCreationContext.runPinned;
		let settlement: CreationSettlement<RetainedOriginalCreatedResponse>;
		jest.spyOn(DeviceCreationContext, 'runPinned').mockImplementation((...args) => {
			settlement = args[4] as CreationSettlement<RetainedOriginalCreatedResponse>;
			return run(...args);
		});
		if (phase === 'V0') {
			let failure: { cause: unknown } | undefined;
			try {
				await authoring.create(input);
			} catch (caught) {
				failure = { cause: caught };
			}
			expect(failure).toBeDefined();
			expect(failure.cause).toBe(cause);
			expect(settlement.outcome).toBe('rolled_back');
			expect(finalHydrations).toBe(0);
			await expectAbsent(input);
		} else {
			const created = await authoring.create(input);
			expect(settlement.outcome).toBe('committed');
			expect(responseWire(created)).toEqual(
				responseWire(thermostatCreationResponse.pin().materialize(settlement.result.value)),
			);
			expect(created.device.name).toBe(input.device.name);
			expect(finalHydrations).toBe(1);
			expectImmutableResponse(settlement.result.value);
			expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
		}
		expect(observed).toBe(target);
	});
	it('keeps latest ordinary hydration on uninterrupted success without rewriting the native original', async () => {
		const input = request(relayId),
			afterCommit = configs.afterCommit.bind(configs) as VirtualThermostatConfigService['afterCommit'];
		jest.spyOn(configs, 'afterCommit').mockImplementation(async (...args) => {
			const result = await afterCommit(...args);
			await devices.update(
				input.device.id,
				plainToInstance(UpdateVirtualDeviceDto, { type: 'virtual', name: 'latest supported edit' }),
			);
			return result;
		});
		const run = DeviceCreationContext.runPinned;
		let settlement: CreationSettlement<RetainedOriginalCreatedResponse>;
		jest.spyOn(DeviceCreationContext, 'runPinned').mockImplementation((...args) => {
			settlement = args[4] as CreationSettlement<RetainedOriginalCreatedResponse>;
			return run(...args);
		});
		const created = await authoring.create(input);
		expect(created.device.name).toBe('latest supported edit');
		expect(settlement.result.value.fullWire.device.name).toBe(input.device.name);
		expectImmutableResponse(settlement.result.value);
		expect(settlement.legacyPublicationFailure).toBeUndefined();
	});

	it('keeps the original device without a retry when final ordinary hydration resolves null', async () => {
		const input = request(relayId),
			afterCommit = configs.afterCommit.bind(configs) as VirtualThermostatConfigService['afterCommit'];
		let finalPhase = false;
		jest.spyOn(configs, 'afterCommit').mockImplementation(async (...args) => {
			const result = await afterCommit(...args);
			finalPhase = true;
			return result;
		});
		const find = devices.findOne.bind(devices) as DevicesService['findOne'];
		const read = jest
			.spyOn(devices, 'findOne')
			.mockImplementation((...args) => (finalPhase ? Promise.resolve(null) : find(...args)));
		const created = await authoring.create(input);
		expect(created.device.name).toBe(input.device.name);
		expect(created.configuration.controller).toBe(input.device.id);
		expect(read).toHaveBeenCalledTimes(2); // Original catalog deferred read, then exactly one final hydrate.
		expect(values.write).toHaveBeenCalledTimes(input.configuration.settings.length);
	});

	it('pins the finite response getters before traversing the caller DTO', async () => {
		const input = request(relayId),
			original = Object.getOwnPropertyDescriptor(VirtualDeviceEntity.prototype, 'type');
		const replacement = jest.fn(() => 'replacement'),
			name = input.device.name;
		Object.defineProperty(input.device, 'name', {
			enumerable: true,
			get() {
				Object.defineProperty(VirtualDeviceEntity.prototype, 'type', { ...original, get: replacement });
				return name;
			},
		});
		try {
			await expect(authoring.create(input)).rejects.toThrow('expired');
			expect(replacement).not.toHaveBeenCalled();
			await expectAbsent(input);
		} finally {
			Object.defineProperty(VirtualDeviceEntity.prototype, 'type', original);
		}
	});

	it('treats original response capture failure as a body error before COMMIT', async () => {
		const input = request(relayId),
			snapshot = configs.snapshot.bind(configs) as VirtualThermostatConfigService['snapshot'];
		jest.spyOn(configs, 'snapshot').mockImplementation(async (...args) => {
			const configuration = await snapshot(...args);
			configuration.reasons.push({ bad: true } as never);
			return configuration;
		});
		await expect(authoring.create(input)).rejects.toThrow('scalar');
		await expectAbsent(input);
		expect(values.write).not.toHaveBeenCalled();
	});

	it('returns the durable creation when commit subscriber reconciliation fails closed', async () => {
		const subscriber = new VirtualThermostatOwnershipSubscriber(database, claims);
		await subscriber.onApplicationBootstrap();
		const commitRefresh = jest.spyOn(subscriber, 'afterTransactionCommit');
		await claims.refresh();
		const input = request(relayId);
		const target = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: relayId },
			relations: ['channel', 'channel.device'],
		});
		const admission = {
			property: target,
			channel: target.channel as ChannelEntity,
			device: (target.channel as ChannelEntity).device as DeviceEntity,
			value: true,
		};
		await claims.assertAllowed(admission);
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
		const originalFind = database.manager.find.bind(database.manager);
		let failRefresh = true;
		const refresh = jest.spyOn(database.manager, 'find').mockImplementation(async (...args) => {
			if (failRefresh && args[0] === VirtualThermostatActuatorClaimEntity)
				throw new Error('commit reconciliation failed');
			return (await originalFind(...args)) as Record<string, unknown>[];
		});
		const created = await authoring.create(input);
		expect(commitRefresh).toHaveBeenCalled();
		expect(refresh).toHaveBeenCalled();
		expect(created.device.id).toBe(input.device.id);
		expect(created.configuration.controller).toBe(input.device.id);
		expect(created.configuration.actuators).toEqual([
			expect.objectContaining({ source_property: relayId, state: 'reserved' }),
		]);
		expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
		expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(1);
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(1);
		expect(() => claims.assertAllowed(admission)).toThrow('reconciling');
		expect(jest.getTimerCount()).toBe(1);
		failRefresh = false;
		const retryRefresh = jest.spyOn(claims, 'refresh');
		await jest.advanceTimersByTimeAsync(1000);
		expect(retryRefresh).toHaveBeenCalledTimes(1);
		await (retryRefresh.mock.results[0].value as Promise<void>);
		expect(jest.getTimerCount()).toBe(0);
		expect(() => claims.assertAllowed(admission)).toThrow('reserved');
	});

	it('preserves a nontransactional catalog write when reconciliation fails', async () => {
		await new VirtualThermostatOwnershipSubscriber(database, claims).onApplicationBootstrap();
		jest.spyOn(claims, 'refresh').mockRejectedValue(new Error('reconciliation failed'));
		await database.manager.update(ChannelPropertyEntity, { id: ambientId }, { name: 'Renamed ambient' });
		expect((await database.manager.findOneByOrFail(ChannelPropertyEntity, { id: ambientId })).name).toBe(
			'Renamed ambient',
		);
	});

	it('preserves the original transaction error when rollback reconciliation fails', async () => {
		await new VirtualThermostatOwnershipSubscriber(database, claims).onApplicationBootstrap();
		jest.spyOn(claims, 'refresh').mockRejectedValue(new Error('reconciliation failed'));
		await expect(
			database.transaction(async (manager) => {
				await manager.update(ChannelPropertyEntity, { id: ambientId }, { name: 'Rolled back' });
				throw new Error('original transaction failure');
			}),
		).rejects.toThrow('original transaction failure');
		expect((await database.manager.findOneByOrFail(ChannelPropertyEntity, { id: ambientId })).name).not.toBe(
			'Rolled back',
		);
	});

	it('rolls back the full graph and claim if persistence fails after real creation hooks', async () => {
		const input = request(relayId);
		const original = configs.persist.bind(configs);
		jest.spyOn(configs, 'persist').mockImplementationOnce(async (manager, id, prepared) => {
			await original(manager, id, prepared);
			throw new Error('injected post-persist failure');
		});
		await expect(authoring.create(input)).rejects.toThrow('injected post-persist failure');
		expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(0);
		for (const channel of input.device.channels ?? []) {
			expect(await database.manager.countBy(ChannelEntity, { id: channel.id })).toBe(0);
			for (const property of channel.properties ?? [])
				expect(await database.manager.countBy(ChannelPropertyEntity, { id: property.id })).toBe(0);
		}
		expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(0);
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(0);
		expect(publications).toEqual([]);
		expect(values.write).not.toHaveBeenCalled();
	});
	function gate() {
		let resolve!: () => void;
		const promise = new Promise<void>((done) => {
			resolve = done;
		});
		return { promise, resolve };
	}
	async function expectAbsent(input: CreateVirtualThermostatProducerDto, revision = 0) {
		expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(0);
		for (const channel of input.device.channels) {
			expect(await database.manager.countBy(ChannelEntity, { id: channel.id })).toBe(0);
			for (const property of channel.properties)
				expect(await database.manager.countBy(ChannelPropertyEntity, { id: property.id })).toBe(0);
		}
		expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(0);
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(0);
		expect(await graph.revision()).toBe(revision);
		expect(publications).toEqual([]);
		expect(values.write).not.toHaveBeenCalled();
	}

	it('rolls back actual catalog work on same-object registration replacement inside a real beforeCreate pause', async () => {
		const input = request(relayId),
			entered = gate(),
			resume = gate();
		const mapping = propertyMapper.getMapping<
			VirtualChannelPropertyEntity,
			CreateVirtualChannelPropertyDto,
			UpdateVirtualChannelPropertyDto
		>('virtual');
		const original = mapping.beforeCreate;
		let paused = false;
		mapping.beforeCreate = async function (...args) {
			expect(this).toBe(mapping);
			await original.call(this, ...args);
			if (!paused) {
				paused = true;
				entered.resolve();
				await resume.promise;
			}
		};
		let expired!: DeviceCreationContext;
		const create = devices.create.bind(devices) as DevicesService['create'];
		jest.spyOn(devices, 'create').mockImplementation((dto, context) => {
			expired = context;
			return create(dto, context);
		});
		const pending = authoring.create(input);
		const rejected = expect(pending).rejects.toThrow('expired');
		try {
			await Promise.race([entered.promise, pending]);
			propertyMapper.registerMapping(mapping);
		} finally {
			resume.resolve();
		}
		await rejected;
		await expectAbsent(input);
		expect(await database.manager.countBy(ChannelPropertyEntity, { id: ambientId })).toBe(1);
		expect(await database.manager.countBy(ChannelPropertyEntity, { id: relayId })).toBe(1);
		const getter = jest.fn(() => {
			throw new Error('expired input');
		});
		const late = Object.defineProperty({}, 'type', { get: getter }) as CreateVirtualDeviceDto;
		await expect(devices.create(late, expired)).rejects.toThrow('not active');
		expect(getter).not.toHaveBeenCalled();
		const fresh = request(relayId);
		expect((await authoring.create(fresh)).device.id).toBe(fresh.device.id);
	});

	it('creates only original caller A while its captured request waits for the structural owner', async () => {
		const entered = gate(),
			resume = gate();
		const holder = lock.runExclusive(async () => {
			entered.resolve();
			await resume.promise;
		});
		await entered.promise;
		const input = request(relayId);
		const originalId = input.device.id;
		const originalChannels = input.device.channels.map(({ id }) => id).sort();
		const other = request(relayId);
		const pending = authoring.create(input);
		try {
			input.device.name = 'mutated B';
			input.configuration.policy.heatingSetpoint = 29;
			input.configuration.sources[0].maximumAgeSeconds = 999;
			input.device = other.device;
			input.configuration = other.configuration;
		} finally {
			resume.resolve();
		}
		await holder;
		const result = await pending;
		expect(result.device.id).toBe(originalId);
		expect(result.device.name).toBe('Draft thermostat');
		expect(result.device.channels.map(({ id }) => id).sort()).toEqual(originalChannels);
		expect(await database.manager.countBy(DeviceEntity, { id: other.device.id })).toBe(0);
		expect(
			(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: originalId })).policy
				.heatingSetpoint,
		).toBe(20);
		expect(
			(await database.manager.findOneByOrFail(VirtualThermostatSourceEntity, { controllerId: originalId }))
				.maximumAgeSeconds,
		).toBe(300);
		expect(Object.isFrozen(input)).toBe(false);
	});

	it('creates from the original normalized configuration when prepare retains and mutates its returned objects', async () => {
		const input = request(relayId);
		const original = configs.prepare.bind(configs) as VirtualThermostatConfigService['prepare'];
		let retained: Awaited<ReturnType<VirtualThermostatConfigService['prepare']>> | undefined;
		let prepares = 0,
			changed = 0;
		const prepare = jest.spyOn(configs, 'prepare').mockImplementation(async (...args) => {
			const value = await original(...args);
			if (++prepares === 2) retained = value;
			return value;
		});
		const observer: EntitySubscriberInterface = {
			beforeQuery() {
				if (!retained || changed) return;
				changed++;
				retained.config.policy.heatingSetpoint = 29;
				retained.sources[0].maximumAgeSeconds = 999;
			},
		};
		database.subscribers.push(observer);
		try {
			await authoring.create(input);
			expect(prepares).toBe(2);
			expect(changed).toBe(1);
			expect(
				(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: input.device.id }))
					.policy.heatingSetpoint,
			).toBe(20);
			expect(
				(await database.manager.findOneByOrFail(VirtualThermostatSourceEntity, { controllerId: input.device.id }))
					.maximumAgeSeconds,
			).toBe(300);
			expect(retained.config.policy.heatingSetpoint).toBe(29);
			expect(input.configuration.policy.heatingSetpoint).toBe(20);
		} finally {
			database.subscribers.splice(database.subscribers.indexOf(observer), 1);
			prepare.mockRestore();
		}
	});

	it.each(['device', 'configuration', 'expectedGraphRevision', 'nested type'])(
		'captures before the %s getter and snapshots caller data once',
		async (field) => {
			const input = request(relayId);
			const saved = JSON.stringify(input);
			let owner: object = input,
				key = field;
			if (field === 'expectedGraphRevision') {
				owner = input.configuration;
				key = field;
			}
			if (field === 'nested type') {
				owner = input.device.channels[0].properties[0];
				key = 'type';
			}
			const value: unknown = Reflect.get(owner, key);
			const getter = jest.fn(() => {
				propertyMapper.registerMapping(propertyMapper.getMapping('virtual'));
				return value;
			});
			Object.defineProperty(owner, key, { get: getter, enumerable: true, configurable: true });
			await expect(authoring.create(input)).rejects.toThrow('expired');
			expect(getter).toHaveBeenCalledTimes(1);
			Object.defineProperty(owner, key, { value, enumerable: true, configurable: true, writable: true });
			if (field === 'expectedGraphRevision') Reflect.deleteProperty(owner, key);
			expect(JSON.stringify(input)).toBe(saved);
			expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(0);
		},
	);

	it('refuses the original capture after replacement while queued for the existing lock', async () => {
		const entered = gate(),
			resume = gate();
		const holder = lock.runExclusive(async () => {
			entered.resolve();
			await resume.promise;
		});
		await entered.promise;
		const input = request(relayId);
		const pending = authoring.create(input);
		const rejected = expect(pending).rejects.toThrow('expired');
		propertyMapper.registerMapping(propertyMapper.getMapping('virtual'));
		resume.resolve();
		await holder;
		await rejected;
		await expectAbsent(input);
	});

	it('refuses replacement at actual BeforeQuery COMMIT even after all original configuration reads', async () => {
		const input = request(relayId);
		let commits = 0;
		database.subscribers.push({
			beforeQuery: (event) => {
				if (event.query === 'COMMIT' && commits++ === 0)
					propertyMapper.registerMapping(propertyMapper.getMapping('virtual'));
			},
		} satisfies EntitySubscriberInterface);
		await expect(authoring.create(input)).rejects.toMatchObject({ settlement: { outcome: 'refused' } });
		expect(commits).toBe(1);
		await expectAbsent(input);
	});

	it.each(['subscriber', 'release'] as const)(
		'retains native ACK and the original result when awaited %s rejects',
		async (phase) => {
			const input = request(relayId),
				cause = new Error('after native ACK');
			let commits = 0;
			database.subscribers.push({
				afterTransactionCommit: (event) => {
					commits++;
					if (phase === 'subscriber') throw cause;
					// The coordinated transaction releases through its original owning finalizer.
					failAfterOwnedRelease(event.queryRunner, cause);
				},
			});
			const failed = await authoring.create(input).catch((error: unknown) => error);
			expect(failed).toBeInstanceOf(DeviceCreationSettlementError);
			const error = failed as DeviceCreationSettlementError<RetainedOriginalCreatedResponse>;
			expect(error.cause).toBe(cause);
			expect(error.settlement.outcome).toBe('committed');
			expect(error.settlement.result.value).toMatchObject({
				fullWire: { device: { id: input.device.id }, configuration: { revision: 1 } },
				identity: { controller: input.device.id, configurationRevision: 1 },
			});
			expectImmutableResponse(error.settlement.result.value);
			expect(commits).toBe(1);
			expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
			expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(1);
			expect(publications).toEqual([]);
			expect(values.write).not.toHaveBeenCalled();
		},
	);

	it.each([false, true])(
		'keeps B serialized through A configuration publication and hydration, callbackFailure=%s',
		async (callbackFailure) => {
			const input = request(relayId),
				entered = gate(),
				resume = gate(),
				hydration = gate(),
				hydrateResume = gate();
			const writes: unknown[] = [];
			let postCommit = false;
			jest.spyOn(values, 'write').mockImplementation(async (_property, value) => {
				writes.push(value);
				if (value === 20) {
					entered.resolve();
					await resume.promise;
					postCommit = true;
					if (callbackFailure) throw new Error('A publication failed');
				}
				return true as never;
			});
			const find = devices.findOne.bind(devices) as DevicesService['findOne'];
			jest.spyOn(devices, 'findOne').mockImplementation(async (...args) => {
				if (postCommit && args[0] === input.device.id) {
					hydration.resolve();
					await hydrateResume.promise;
				}
				return find(...args);
			});
			const pendingA = authoring.create(input);
			await Promise.race([entered.promise, pendingA]);
			let bDone = false;
			const selected: { lease: boolean; bDone: boolean; published25: boolean }[] = [];
			const define = Object.defineProperty;
			jest.spyOn(Object, 'defineProperty').mockImplementation((target, key, descriptor) => {
				if (target instanceof VirtualCreatedThermostatModel && key === 'configuration')
					selected.push({ lease: lock.hasCurrentStructuralLease(), bDone, published25: writes.includes(25) });
				return define(target, key, descriptor);
			});
			const pendingB = configs
				.configure(input.device.id, {
					...input.configuration,
					expectedRevision: 1,
					policy: { ...input.configuration.policy, heatingSetpoint: 25 },
				})
				.then((result) => {
					bDone = true;
					return result;
				});
			try {
				await new Promise<void>((resolve) => setImmediate(resolve));
				expect(bDone).toBe(false);
				expect(writes).not.toContain(25);
				resume.resolve();
				await Promise.race([hydration.promise, pendingA]);
				expect(bDone).toBe(false);
				expect(writes).not.toContain(25);
			} finally {
				resume.resolve();
				hydrateResume.resolve();
			}
			expect((await pendingA).configuration.revision).toBe(1);
			expect(selected).toEqual([{ lease: true, bDone: false, published25: false }]);
			expect((await pendingB).revision).toBe(2);
			expect(writes.filter((value) => typeof value === 'number')).toEqual([20, 25]);
			expect((await configs.get(input.device.id)).policy.heatingSetpoint).toBe(25);
		},
	);

	it('refuses graph revision overflow atomically', async () => {
		expect(await database.manager.find(VirtualGraphRevisionEntity)).toEqual([{ id: 1, revision: 0 }]);
		const updated = await database.manager.update(
			VirtualGraphRevisionEntity,
			{ id: 1 },
			{ revision: Number.MAX_SAFE_INTEGER },
		);
		expect(updated.affected).toBe(1);
		expect(await database.manager.find(VirtualGraphRevisionEntity)).toEqual([
			{ id: 1, revision: Number.MAX_SAFE_INTEGER },
		]);
		const input = request(relayId);
		await expect(authoring.create(input)).rejects.toThrow('overflow');
		await expectAbsent(input, Number.MAX_SAFE_INTEGER);
	});

	it('drains an actual unawaited Device/Channel/Property traversal through body closure before COMMIT', async () => {
		const input = request(relayId),
			entered = gate(),
			resume = gate();
		const mapping = propertyMapper.getMapping<
			VirtualChannelPropertyEntity,
			CreateVirtualChannelPropertyDto,
			UpdateVirtualChannelPropertyDto
		>('virtual');
		const original = mapping.beforeCreate;
		let paused = false,
			root!: DeviceCreationContext,
			catalogPromise!: Promise<DeviceEntity>;
		mapping.beforeCreate = async function (...args) {
			await original.call(this, ...args);
			if (!paused) {
				paused = true;
				entered.resolve();
				await resume.promise;
			}
		};
		const catalog = devices.captureCreationCatalog('virtual');
		const settlement = new CreationSettlement<number>();
		const pending = lock.runExclusive(() =>
			DeviceCreationContext.runPinned(
				(work, admit) => graph.withCreationWrite(work, undefined, admit),
				catalog,
				AsyncLocalStorage.bind(() => lock.hasCurrentStructuralLease()),
				(context) => {
					root = context;
					catalogPromise = devices.create(input.device, context);
					return Promise.resolve(4);
				},
				settlement,
			),
		);
		try {
			await Promise.race([entered.promise, pending]);
			expect(settlement.outcome).toBe('pending');
			const getter = jest.fn(() => {
				throw new Error('detached input');
			});
			await expect(
				devices.create(Object.defineProperty({}, 'type', { get: getter }) as CreateVirtualDeviceDto, root),
			).rejects.toThrow('not active');
			expect(getter).not.toHaveBeenCalled();
		} finally {
			resume.resolve();
		}
		expect(await pending).toBe(4);
		expect((await catalogPromise).id).toBe(input.device.id);
		expect(settlement.outcome).toBe('committed');
		for (const channel of input.device.channels)
			for (const property of channel.properties)
				expect(await database.manager.countBy(ChannelPropertyEntity, { id: property.id })).toBe(1);
		expect(await graph.revision()).toBe(1);
	});

	it('skips expired original deferred dispatch after ACK without deleting the durable catalog', async () => {
		const input = request(relayId);
		let changed = false;
		database.subscribers.push({
			afterTransactionCommit: () => {
				if (!changed) {
					changed = true;
					propertyMapper.registerMapping(propertyMapper.getMapping('virtual'));
				}
			},
		});
		const created = await authoring.create(input);
		expect(created.device.id).toBe(input.device.id);
		expect(created.configuration.revision).toBe(1);
		expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
		expect(publications).toEqual([]);
		expect(values.write).not.toHaveBeenCalled();
	});

	it('rechecks original registration on actual SQLite busy redispatch without an application retry', async () => {
		Object.assign(database.options, { busyErrorRetry: 1 });
		interface Native {
			all(
				sql: string,
				params: unknown[],
				callback: (this: unknown, error: Error | null, rows?: unknown[]) => void,
			): unknown;
		}
		const native = (database.driver as SqliteDriver).databaseConnection as Native;
		const original = native.all.bind(native) as Native['all'];
		let attempts = 0;
		jest.spyOn(native, 'all').mockImplementation(function (this: Native, sql, params, callback) {
			if (sql === 'COMMIT' && ++attempts === 1) {
				propertyMapper.registerMapping(propertyMapper.getMapping('virtual'));
				queueMicrotask(() => {
					callback.call(this, new Error('SQLITE_BUSY: original dispatch test'));
				});
				return this;
			}
			return original(sql, params, callback);
		});
		const input = request(relayId);
		await expect(authoring.create(input)).rejects.toMatchObject({ settlement: { outcome: 'refused' } });
		expect(attempts).toBe(1);
		await expectAbsent(input);
	});

	it('authors required explicit floor protection with the actual catalog/configuration/claim transaction', async () => {
		const probe = await createProtectionProbe(database, relayId);
		const input = request(relayId);
		input.configuration.policy.floor = { limit: 30, recoveryHysteresis: 2 };
		input.configuration.actuators[0].protection = {
			schemaVersion: 1,
			kind: 'local_floor',
			sourcePropertyId: probe.sourceId,
			maximumAgeSeconds: 5,
		};
		const result = await authoring.create(input);
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
			controllerId: input.device.id,
		});
		expect(
			await database.manager.findOneByOrFail(ThermostatMemberProtectionEntity, { claimId: claim.id }),
		).toMatchObject({ sourcePropertyId: probe.sourceId, revision: 1, maximumAgeSeconds: 5 });
		expect(result.configuration.readiness).toBe('draft');
	});
	it('persists genuine cooled-surface dependencies and exact heating/cooling catalog branches in the creation transaction', async () => {
		const coolingRelay = await actuator(undefined, 'A8032ABE5198');
		await database.manager.update(ShellyNgDeviceEntity, { id: relayDeviceId }, { canonicalMac: 'A8032ABE5198' });
		const surface = await createProtectionProbe(database, coolingRelay);
		const humidityChannel = uuid(),
			humidity = uuid(),
			dewDevice = uuid(),
			dewChannel = uuid(),
			dew = uuid();
		await database.manager.insert(ChannelEntity, {
			id: humidityChannel,
			device: relayDeviceId,
			name: 'Humidity',
			category: ChannelCategory.HUMIDITY,
		} as never);
		await database.manager.insert(ChannelPropertyEntity, {
			id: humidity,
			channel: humidityChannel,
			identifier: 'humidity',
			category: PropertyCategory.HUMIDITY,
			dataType: DataTypeType.FLOAT,
			unit: '%',
			permissions: [PermissionType.READ_ONLY],
		} as never);
		await database.manager.insert(VirtualDeviceEntity, {
			id: dewDevice,
			name: 'Dedicated dew point',
			category: DeviceCategory.SENSOR,
			mode: VirtualDeviceMode.SENSOR_TRANSFORM,
			enabled: true,
		});
		await database.manager.insert(VirtualChannelEntity, {
			id: dewChannel,
			device: dewDevice,
			name: 'Dew point',
			category: ChannelCategory.ANALOG_INPUT,
		} as never);
		await database.manager.insert(VirtualChannelPropertyEntity, {
			id: dew,
			channel: dewChannel,
			identifier: 'value',
			category: PropertyCategory.VALUE,
			dataType: DataTypeType.FLOAT,
			unit: '°C',
			valueOrigin: VirtualValueOrigin.DERIVED,
			permissions: [PermissionType.READ_ONLY],
		} as never);
		const dewPoints = new VirtualDewPointConfigService(database, lock, graph, {} as never, events);
		await database.transaction(async (manager) => {
			const prepared = await dewPoints.prepare(manager, dew, {
				schemaVersion: 1,
				formulaVersion: DEW_POINT_FORMULA,
				expectedRevision: 0,
				maximumAgeSeconds: 300,
				maximumSkewSeconds: 60,
				sources: [
					{ role: 'dry_bulb', sourcePropertyId: ambientId },
					{ role: 'relative_humidity', sourcePropertyId: humidity },
				],
			});
			await dewPoints.persist(manager, prepared);
		});
		const input = request(relayId, coolingRelay);
		input.configuration.policy.cooling = { schemaVersion: 1, marginC: 2, recoveryHysteresisC: 1 };
		input.configuration.actuators[1].coolingProtection = {
			schemaVersion: 1,
			purpose: 'cooled_surface',
			dewPointPropertyId: dew,
			surfacePropertyId: surface.sourceId,
			maximumAgeSeconds: 5,
		};
		const result = await authoring.create(input);
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
			controllerId: input.device.id,
			role: 'cooling',
		});
		expect(
			await database.manager.findOneByOrFail(ThermostatCoolingDependencyEntity, { claimId: claim.id }),
		).toMatchObject({
			dewPointPropertyId: dew,
			surfacePropertyId: surface.sourceId,
			revision: 1,
			maximumAgeSeconds: 5,
		});
		expect(result.configuration.readiness).toBe('draft');
		expect(result.device.channels.map((channel) => channel.category)).toEqual(
			expect.arrayContaining([ChannelCategory.HEATER, ChannelCategory.COOLER]),
		);
		expect(
			await database.manager.countBy(VirtualThermostatActuatorClaimEntity, { controllerId: input.device.id }),
		).toBe(2);
	});

	it('keeps actual unknown native creation unavailable even when its full catalog/configuration committed', async () => {
		interface Native {
			all(
				sql: string,
				params: unknown[],
				callback: (this: unknown, error: Error | null, rows?: unknown[]) => void,
			): unknown;
		}
		const native = (database.driver as SqliteDriver).databaseConnection as Native;
		const original = native.all.bind(native) as Native['all'];
		const cause = new Error('native ACK unavailable');
		let commits = 0;
		jest.spyOn(native, 'all').mockImplementation((sql, params, callback) => {
			if (sql === 'COMMIT') commits++;
			return original(sql, params, function (error, rows) {
				callback.call(this, sql === 'COMMIT' && !error ? cause : error, rows);
			});
		});
		const input = request(relayId);
		const failed = await authoring.create(input).catch((error: unknown) => error);
		expect(failed).toMatchObject({
			settlement: { outcome: 'unknown', result: { value: { fullWire: { configuration: { revision: 1 } } } } },
			cause: { driverError: cause },
		});
		expectImmutableResponse(
			(failed as DeviceCreationSettlementError<RetainedOriginalCreatedResponse>).settlement.result.value,
		);
		expect(commits).toBe(1);
		expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
		expect(await database.manager.countBy(VirtualThermostatConfigEntity, { controllerId: input.device.id })).toBe(1);
		expect(publications).toEqual([]);
		expect(values.write).not.toHaveBeenCalled();
	});

	it('preserves historical ACK/result and exact later structural settlement cause', async () => {
		const cause = new Error('later structural settlement'),
			input = request(relayId);
		const original = lock.runExclusive.bind(lock) as DeviceStructureLockService['runExclusive'];
		let first = true;
		jest.spyOn(lock, 'runExclusive').mockImplementation(async (work) => {
			const outer = first;
			first = false;
			const result = await original(work);
			if (outer) throw cause;
			return result;
		});
		await expect(authoring.create(input)).rejects.toMatchObject({
			cause,
			settlementCause: cause,
			settlement: { outcome: 'committed', result: { value: { fullWire: { device: { id: input.device.id } } } } },
		});
		expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
	});

	it('returns the committed response when actual graph refresh fails closed after ACK', async () => {
		let acknowledged = false;
		database.subscribers.push({
			afterTransactionCommit: () => {
				acknowledged = true;
			},
		});
		const edges = graph.edges.bind(graph) as VirtualDependencyGraphService['edges'];
		jest
			.spyOn(graph, 'edges')
			.mockImplementation((manager) =>
				acknowledged ? Promise.reject(new Error('post-ACK validation read failed')) : edges(manager),
			);
		const input = request(relayId),
			result = await authoring.create(input);
		expect(result.device.id).toBe(input.device.id);
		expect(result.configuration.revision).toBe(1);
		expect(graph.isValidated()).toBe(false);
		expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
	});
});
