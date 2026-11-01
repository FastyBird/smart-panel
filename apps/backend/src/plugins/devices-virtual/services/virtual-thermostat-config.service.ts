import { AsyncLocalStorage } from 'node:async_hooks';
import { DataSource, EntityManager, Not } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable, NotFoundException, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
	SqliteCommitGuardReceipt,
	observeSqliteOuterOutcome,
	registerSqliteCommitGuard,
} from '../../../common/database/sqlite-data-source';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { ControllerPublicationContext } from '../../../modules/devices/services/controller-publication-context';
import { captureCreation, invokeCreation, snapshotCreation } from '../../../modules/devices/services/creation-capture';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { permissionSatisfied } from '../../../modules/devices/utils/property-permissions.utils';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { REMOTE_DEW_POINT_PROFILE } from '../../devices-shelly-ng/services/remote-dew-point-lease.contract';
import {
	MAX_THERMOSTAT_ACTUATOR_MEMBERS,
	SHELLY_GUARDED_PROFILE,
	SHELLY_GUARDED_PROFILE_VERSION,
	thermostatBranchGroupIdentity,
	thermostatHasOpposedBranches,
} from '../contracts/thermostat-actuation.contract';
import { ConfigureVirtualThermostatDto, RestoreVirtualThermostatActuatorDto } from '../dto/thermostat-config.dto';
import {
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { NativeThermostatEntity } from '../entities/native-thermostat.entity';
import { ThermostatCoolingDependencyEntity } from '../entities/thermostat-cooling-dependency.entity';
import { ThermostatMemberProtectionEntity } from '../entities/thermostat-member-protection.entity';
import {
	ThermostatSetting,
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatRecoveryEntity,
	VirtualThermostatSettingEntity,
	VirtualThermostatSourceEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';
import { VirtualThermostatOwnershipSubscriber } from '../subscribers/virtual-thermostat-ownership.subscriber';

import { NativeThermostatService } from './native-thermostat.service';
import { thermostatComfortSelection } from './thermostat-comfort-selection';
import {
	ControllerMutationImage,
	assertControllerMutationImage,
	captureControllerBindings,
	controllerConfigurationUnchanged,
	readControllerMutationImage,
	writeControllerPartition,
	writeControllerSettingPermissions,
} from './thermostat-controller-mutation';
import { ThermostatCoolingDependencyService } from './thermostat-cooling-dependency.service';
import {
	resolveThermostatProtectionSource,
	validateProtectionConsumerIndex,
} from './thermostat-protection-source.utils';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualNumericTransformOperator } from './virtual-numeric-transform.utils';
import {
	isEligibleVirtualMeasurement,
	isEligibleVirtualTransformedTemperature,
} from './virtual-source-eligibility.utils';
import {
	ThermostatCreationAdmission,
	VirtualThermostatAutomationService,
} from './virtual-thermostat-automation.service';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { validateThermostatComfort } from './virtual-thermostat-comfort.utils';
import {
	isThermostatTemperature,
	thermostatActuatorIdentity,
	thermostatFingerprint,
	thermostatPropertyContract,
} from './virtual-thermostat-contract.utils';
import { validateVirtualThermostatPolicy } from './virtual-thermostat-policy.utils';
import { transformContractErrors } from './virtual-transform-contract.utils';
import { VirtualTransformResolver } from './virtual-transform-resolver';
import { validateVirtualWindowTrendPolicy } from './virtual-window-trend.utils';

export const THERMOSTAT_CONFIG_CHANGED = 'devices-virtual.thermostat.config.changed';
const fail = (message: string): never => {
	throw new DevicesValidationException(message);
};

@Injectable()
export class VirtualThermostatConfigService implements OnModuleInit, OnModuleDestroy {
	private stopAutomationPublication?: () => void;
	constructor(
		private readonly dataSource: DataSource,
		private readonly structureLock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly claims: VirtualThermostatClaimsService,
		private readonly events: EventEmitter2,
		private readonly values: PropertyValueService,
		@Optional() private readonly resolver: VirtualTransformResolver = new VirtualTransformResolver(),
		@Optional() private readonly automation?: VirtualThermostatAutomationService,
		@Optional() private readonly native?: NativeThermostatService,
	) {}

	onModuleInit(): void {
		if (process.env.FB_CLI === 'on') return;
		const publication = captureCreation(this, ['afterCommit']);
		this.stopAutomationPublication = this.automation?.registerPublication((id) =>
			publication.values.afterCommit.call(publication.receiver, id),
		);
	}
	onModuleDestroy(): void {
		this.stopAutomationPublication?.();
		this.stopAutomationPublication = undefined;
	}

	private coolingDependencies(): ThermostatCoolingDependencyService {
		return new ThermostatCoolingDependencyService(this.dataSource, this.values, this.claims);
	}

	async configure(controllerId: string, dto: ConfigureVirtualThermostatDto) {
		return ControllerPublicationContext.complete(async () => {
			// Revoke captured ON authority synchronously, before lock acquisition or any validation I/O.
			const release = this.claims.holdRecoveryFence();
			this.claims.revokeAllQualifications();
			this.events.emit(THERMOSTAT_CONFIG_CHANGED, controllerId);
			let input: ConfigureVirtualThermostatDto;
			let predecessors: Promise<void> | undefined;
			let captureFailure: { cause: unknown } | undefined;
			let ownerCurrent = () => false;
			let noop: ReturnType<typeof VirtualThermostatOwnershipSubscriber.captureNoopFence> | undefined;
			try {
				noop = VirtualThermostatOwnershipSubscriber.captureNoopFence(this.dataSource, () => ownerCurrent());
				predecessors = this.automation?.beginMutation(controllerId);
				void predecessors?.catch(() => undefined);
				input = snapshotCreation(dto);
			} catch (cause) {
				captureFailure = { cause };
			}
			try {
				try {
					if (predecessors !== undefined) await predecessors;
				} catch (cause: unknown) {
					captureFailure ??= { cause };
				}
				return await this.structureLock.runExclusive(
					ControllerPublicationContext.captureCallback(async () => {
						if (captureFailure) throw captureFailure.cause;
						ownerCurrent = this.structureLock.captureExclusiveOwner();
						let receipt: SqliteCommitGuardReceipt;
						let ready = false;
						let unchanged = false;
						const write = async (manager: EntityManager, advanceGraph?: () => Promise<number>) => {
							const slot = await this.automation?.captureManualSlot(manager, controllerId);
							const owned = await this.automation?.captureManualBaseline(manager, controllerId, 0);
							const before = await readControllerMutationImage(manager, controllerId);
							const edges = captureCreation(this.graph, ['edges']);
							registerSqliteCommitGuard(manager, () => edges.current());
							const bindings = await captureControllerBindings(
								manager,
								controllerId,
								before,
								[
									...(Array.isArray(input.sources) ? input.sources.map((source) => source?.sourcePropertyId) : []),
									...(Array.isArray(input.settings) ? input.settings.map((setting) => setting?.propertyId) : []),
									...(Array.isArray(input.actuators)
										? input.actuators.flatMap((actuator) => [
												actuator?.sourcePropertyId,
												actuator?.protection?.sourcePropertyId,
												actuator?.coolingProtection?.dewPointPropertyId,
												actuator?.coolingProtection?.surfacePropertyId,
											])
										: []),
								],
								() => edges.values.edges.call(edges.receiver, manager),
							);
							const prepared = snapshotCreation(await this.prepare(manager, controllerId, input));
							if (owned && prepared.config.comfort) prepared.config.comfort.automation_baseline = null;
							await bindings();
							await assertControllerMutationImage(manager, controllerId, before);
							unchanged =
								(!slot?.facts || (!['LIVE', 'PROVISIONAL'].includes(slot.facts.state) && slot.facts.manualHold)) &&
								controllerConfigurationUnchanged(
									manager,
									before,
									prepared,
									input.sources.map((source) => source.id),
								);
							if (unchanged) {
								await this.automation?.captureUnchangedAuthority(manager, controllerId);
								await this.graph.sealControllerLedger(manager);
								noop.arm();
								ready = true;
								return;
							}
							for (const row of [
								prepared.config,
								...prepared.actuators,
								...prepared.protections,
								...prepared.coolingDependencies,
							])
								if (!Number.isSafeInteger(row.revision) || row.revision < 1)
									fail('Thermostat configuration counter overflow.');
							const graphRevision = await advanceGraph();
							const expected = await this.persist(manager, controllerId, prepared, before);
							await bindings(expected.properties, manager, graphRevision);
							await this.automation?.manualFence(manager, controllerId, true, slot);
							await this.graph.sealControllerLedger(manager);
							noop.applied();
							ready = true;
						};
						await this.graph.withControllerMutationWrite(
							write,
							input.expectedGraphRevision,
							(manager) => {
								receipt = observeSqliteOuterOutcome(manager);
								noop.admit(manager);
								registerSqliteCommitGuard(manager, () => ready && ownerCurrent());
							},
							() => {
								if (receipt.outcome !== 'committed') fail('Missing original native configuration acknowledgement.');
							},
							write,
							noop,
						);
						return unchanged ? this.get(controllerId) : this.afterCommit(controllerId);
					}),
				);
			} finally {
				noop?.close();
				release();
				await this.claims.refresh().catch(() => undefined);
			}
		});
	}
	/** Shared by existing configuration and an admitted atomic creation transaction. */
	prepare(
		manager: EntityManager,
		controllerId: string,
		dto: ConfigureVirtualThermostatDto,
		draft?: VirtualDeviceEntity,
	) {
		return this.validate(manager, controllerId, dto, draft);
	}
	async captureCreationPredecessor(controllerId?: string): Promise<(manager: EntityManager) => Promise<void>> {
		return this.automation ? this.automation.captureCreationPredecessor(controllerId) : () => Promise.resolve();
	}
	async captureCreation(
		manager: EntityManager,
		controllerId: string,
		predecessor?: (manager: EntityManager) => Promise<void>,
	): Promise<ThermostatCreationAdmission> {
		return this.automation
			? this.automation.captureCreation(manager, controllerId, predecessor)
			: { finish: () => Promise.resolve() };
	}

	async persist(
		manager: EntityManager,
		controllerId: string,
		prepared: Awaited<ReturnType<VirtualThermostatConfigService['prepare']>>,
		before?: ControllerMutationImage,
		creation?: () => Promise<void>,
	): Promise<ControllerMutationImage | undefined> {
		// A reused history container is a new controller lifetime. Existing installed
		// physical evidence must not qualify its fresh claims, even for the same leaf.
		if (before && creation) for (const claim of prepared.actuators) claim.qualificationGeneration = uuid();
		const expected = before ? { ...before } : undefined;
		if (expected) {
			expected.configuration = await writeControllerPartition(manager, 'configuration', before.configuration, [
				prepared.config,
			]);
			expected.sources = await writeControllerPartition(manager, 'sources', before.sources, prepared.sources);
		} else {
			await manager.save(prepared.config);
			await manager.delete(VirtualThermostatSourceEntity, { controllerId });
			await manager.save(prepared.sources);
		}
		if (expected) {
			expected.properties = await writeControllerSettingPermissions(manager, before, prepared.settings);
		} else {
			const oldSettings = await manager.findBy(VirtualThermostatSettingEntity, { controllerId });
			for (const setting of oldSettings)
				if (!prepared.settings.some((row) => row.propertyId === setting.propertyId))
					await manager.update(
						VirtualChannelPropertyEntity,
						{ id: setting.propertyId },
						{ permissions: [PermissionType.READ_ONLY] },
					);
			for (const setting of prepared.settings)
				await manager.update(
					VirtualChannelPropertyEntity,
					{ id: setting.propertyId },
					{ permissions: [PermissionType.READ_WRITE] },
				);
		}
		if (expected) {
			expected.settings = await writeControllerPartition(manager, 'settings', before.settings, prepared.settings);
			expected.claims = await writeControllerPartition(manager, 'claims', before.claims, prepared.actuators, true);
			expected.protections = await writeControllerPartition(
				manager,
				'protections',
				before.protections,
				prepared.protections,
				true,
			);
			expected.cooling = await writeControllerPartition(
				manager,
				'cooling',
				before.cooling,
				prepared.coolingDependencies,
				true,
			);
			await assertControllerMutationImage(manager, controllerId, expected);
		} else {
			await manager.delete(VirtualThermostatSettingEntity, { controllerId });
			await manager.save(prepared.settings);
			await manager.save(prepared.actuators);
			await manager.save(ThermostatMemberProtectionEntity, prepared.protections);
			if (prepared.coolingDependencies.length)
				await manager.save(ThermostatCoolingDependencyEntity, prepared.coolingDependencies);
			if (!creation) await this.automation?.initializeCreated(manager, controllerId);
		}
		if (creation) await creation();
		return expected;
	}
	async describe(prepared: Awaited<ReturnType<VirtualThermostatConfigService['prepare']>>) {
		return this.model(
			prepared.config,
			prepared.sources,
			prepared.actuators,
			prepared.settings,
			undefined,
			prepared.protections,
			prepared.coolingDependencies,
		);
	}
	/** Capture the persisted response inside the creating transaction, before fallible publication. */
	async snapshot(manager: EntityManager, controllerId: string) {
		const config = await manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		const [sources, actuators, settings] = await Promise.all([
			manager.findBy(VirtualThermostatSourceEntity, { controllerId }),
			manager.findBy(VirtualThermostatActuatorClaimEntity, { controllerId, state: Not('released') }),
			manager.findBy(VirtualThermostatSettingEntity, { controllerId }),
		]);
		return this.model(config, sources, actuators, settings, manager);
	}
	/** Must run only after the owning writer commits; no preview or rollback may publish. */
	async afterCommit(controllerId: string) {
		const own = captureCreation(this, ['get', 'property'] as (keyof this)[]);
		const get = Reflect.get(own.values, 'get') as typeof this.get;
		const property = Reflect.get(own.values, 'property') as typeof this.property;
		const manager = this.dataSource.manager;
		const claims = captureCreation(this.claims, ['invalidate', 'refresh']);
		const values = captureCreation(this.values, ['write', 'readLatest']);
		const events = captureCreation(this.events, ['emit']);
		const graphCurrent = this.graph.capturePublishGuard();
		const publication = new ControllerPublicationContext(
			() => graphCurrent() && own.current() && claims.current() && values.current() && events.current(),
		);
		return publication.run(async () => {
			claims.values.invalidate.call(claims.receiver);
			const current = await invokeCreation(get, this, controllerId);
			for (const setting of current.settings) {
				const target = await invokeCreation(property, this, manager, setting.property);
				const value =
					setting.setting === 'heating_setpoint'
						? current.policy.heatingSetpoint
						: setting.setting === 'cooling_setpoint'
							? current.policy.coolingSetpoint
							: setting.setting === 'locked'
								? current.locked
								: setting.setting === 'heating_enabled'
									? ['heat', 'auto'].includes(current.requested_mode)
									: ['cool', 'auto'].includes(current.requested_mode);
				await values.values.write.call(values.receiver, target.property, value);
				target.property.value = await values.values.readLatest.call(values.receiver, target.property);
				events.values.emit.call(events.receiver, EventType.CHANNEL_PROPERTY_UPDATED, target.property);
			}
			// The structural write has committed. Reload fails closed and schedules retry without changing that outcome.
			await claims.values.refresh.call(claims.receiver).catch(() => undefined);
			events.values.emit.call(events.receiver, THERMOSTAT_CONFIG_CHANGED, controllerId);
			return current;
		});
	}
	async preview(controllerId: string, dto: ConfigureVirtualThermostatDto) {
		return this.structureLock.runExclusive(async () => {
			if (dto.expectedGraphRevision !== undefined && dto.expectedGraphRevision !== (await this.graph.revision()))
				fail('Virtual graph revision changed.');
			const prepared = await this.prepare(this.dataSource.manager, controllerId, dto);
			return this.describe(prepared);
		});
	}
	async get(controllerId: string) {
		return this.structureLock.runShared(async () => {
			const manager = this.dataSource.manager;
			const config = await manager.findOneBy(VirtualThermostatConfigEntity, { controllerId });
			if (!config) throw new NotFoundException('Thermostat configuration does not exist.');
			const [sources, actuators, settings] = await Promise.all([
				manager.findBy(VirtualThermostatSourceEntity, { controllerId }),
				manager.findBy(VirtualThermostatActuatorClaimEntity, { controllerId, state: Not('released') }),
				manager.findBy(VirtualThermostatSettingEntity, { controllerId }),
			]);
			return this.model(config, sources, actuators, settings);
		});
	}
	/** Durable release demand. Detach/remap/delete remains forbidden until qualified proof is recorded. */
	async requestRelease(controllerId: string, expectedRevision: number) {
		// The available entry/cleanup tuple is independent of new native/input capture faults.
		const entryClaims = captureCreation(this.claims, ['holdRecoveryFence', 'revokeAllQualifications', 'refresh']);
		const events = captureCreation(this.events, ['emit']);
		const exclusiveLock = captureCreation(this.structureLock, ['runExclusive']);
		const exclusive = exclusiveLock.values.runExclusive as (
			work: () => ReturnType<VirtualThermostatConfigService['get']>,
		) => ReturnType<VirtualThermostatConfigService['get']>;
		const read = captureCreation(this, ['get']);
		const get = Reflect.get(read.values, 'get') as VirtualThermostatConfigService['get'],
			configChanged = THERMOSTAT_CONFIG_CHANGED;
		let ownerCurrent = () => false;
		const captured = (() => {
			try {
				const lock = captureCreation(exclusiveLock.receiver, [
					'runShared',
					'hasCurrentStructuralLease',
					'context',
				] as (keyof DeviceStructureLockService)[]);
				const own = captureCreation(this, [
					'requestRelease',
					'dataSource',
					'structureLock',
					'graph',
					'claims',
					'events',
					'get',
				] as (keyof this)[]);
				const claims = captureCreation(entryClaims.receiver, ['invalidate']);
				const graph = captureCreation(this.graph, [
					'withComfortSelectionWrite',
					'sealControllerLedger',
					'structuralWrite',
					'refreshValidation',
					'dataSource',
					'revision',
				] as (keyof VirtualDependencyGraphService)[]);
				const helper = captureCreation(thermostatComfortSelection, ['pin']);
				const selection = helper.values.pin(this.dataSource, 'release-request');
				const input = selection.releaseInput(controllerId, expectedRevision);
				const pins = [own, entryClaims, claims, events, exclusiveLock, lock, graph, helper, selection];
				const current = () => pins.every((pin) => pin.current());
				const check = () => {
					if (!current()) fail('Original thermostat release dispatch expired.');
				};
				const operation = selection.operation(input, () => ownerCurrent(), current, true);
				return { value: { lock, graph, claims, input, operation, check } };
			} catch (cause: unknown) {
				return { failure: Object.freeze({ cause }) };
			}
		})();
		// Preserve the original pre-try entry topology, including an entry action's own short circuit.
		const release = entryClaims.values.holdRecoveryFence.call(entryClaims.receiver);
		entryClaims.values.revokeAllQualifications.call(entryClaims.receiver);
		events.values.emit.call(events.receiver, configChanged, controllerId);
		try {
			const predecessors = !captured.failure ? this.automation?.beginMutation(controllerId) : undefined;
			if (predecessors !== undefined) await predecessors;
			return await invokeCreation(exclusive, exclusiveLock.receiver, async () => {
				if (captured.failure) throw captured.failure.cause;
				const { lock, graph, claims, input, operation, check } = captured.value;
				check();
				ownerCurrent = AsyncLocalStorage.bind(() => lock.values.hasCurrentStructuralLease.call(lock.receiver));
				try {
					await graph.values.withComfortSelectionWrite.call(
						graph.receiver,
						async (manager) => {
							const slot = await this.automation?.captureManualSlot(manager, controllerId);
							const owned = await this.automation?.captureInstalledIntent(manager, controllerId);
							const result = await operation.write(manager, owned ?? undefined);
							await this.automation?.manualFence(manager, controllerId, true, slot);
							await graph.values.sealControllerLedger.call(graph.receiver, manager);
							operation.markReady();
							return result;
						},
						undefined,
						operation.admit,
						operation.accepted,
						'release-request',
					);
					operation.accepted();
				} catch (cause: unknown) {
					operation.settlement.transactionFailure = Object.freeze({ cause });
					throw cause;
				}
				let stage = 'claims.invalidate';
				try {
					claims.values.invalidate.call(claims.receiver);
					stage = 'claims.refresh';
					await entryClaims.values.refresh.call(entryClaims.receiver);
					stage = 'configChanged';
					events.values.emit.call(events.receiver, configChanged, input.id);
					stage = 'get';
					return await invokeCreation(get, read.receiver, input.id);
				} catch (cause: unknown) {
					operation.settlement.maintenanceFailure = Object.freeze({ stage, cause });
					throw cause;
				}
			});
		} catch (cause: unknown) {
			if (captured.value) captured.value.operation.settlement.structuralFailure = Object.freeze({ cause });
			throw cause;
		} finally {
			release();
			await entryClaims.values.refresh.call(entryClaims.receiver).catch(() => undefined);
		}
	}

	/** Rebind a lost database endpoint only to the same reserved physical switch. Operator intent is not release proof. */
	async restoreActuator(
		controllerId: string,
		claimId: string,
		dto: RestoreVirtualThermostatActuatorDto,
		actorId: string,
	) {
		return ControllerPublicationContext.complete(async () => {
			if (
				!actorId ||
				dto.disconnectionAcknowledged !== true ||
				typeof dto.reason !== 'string' ||
				dto.reason.trim().length < 10
			)
				fail('An identified operator, disconnection acknowledgement and meaningful reason are required.');
			const releaseFence = this.claims.holdRecoveryFence();
			let ownedInput: RestoreVirtualThermostatActuatorDto;
			let predecessors: Promise<void> | undefined;
			let captureFailure: { cause: unknown } | undefined;
			try {
				predecessors = this.automation?.beginMutation(controllerId);
				void predecessors?.catch(() => undefined);
				ownedInput = snapshotCreation(dto);
			} catch (cause) {
				captureFailure = { cause };
			}
			try {
				try {
					if (predecessors !== undefined) await predecessors;
				} catch (cause: unknown) {
					captureFailure ??= { cause };
				}
				return await this.structureLock.runExclusive(
					ControllerPublicationContext.captureCallback(async () => {
						if (captureFailure) throw captureFailure.cause;
						const dto = ownedInput;
						const ownerCurrent = this.structureLock.captureExclusiveOwner();
						let receipt: SqliteCommitGuardReceipt;
						let ready = false;
						await this.graph.withControllerMutationWrite(
							async (manager) => {
								const slot = await this.automation?.captureManualSlot(manager, controllerId);
								const owned = await this.automation?.captureManualBaseline(manager, controllerId);
								const before = await readControllerMutationImage(manager, controllerId);
								const config = await manager.findOneBy(VirtualThermostatConfigEntity, { controllerId });
								const edges = captureCreation(this.graph, ['edges']);
								registerSqliteCommitGuard(manager, () => edges.current());
								const bindings = await captureControllerBindings(
									manager,
									controllerId,
									before,
									[dto.sourcePropertyId],
									() => edges.values.edges.call(edges.receiver, manager),
								);
								const claim = await manager.findOneBy(VirtualThermostatActuatorClaimEntity, {
									id: claimId,
									controllerId,
								});
								if (
									!config ||
									!claim ||
									config.revision !== dto.expectedRevision ||
									claim.revision !== dto.expectedClaimRevision
								)
									fail('Thermostat or claim revision changed; reload the retained reservation.');
								if (
									![config.revision, claim.revision].every(
										(value) => Number.isSafeInteger(value) && value >= 1 && value < Number.MAX_SAFE_INTEGER,
									)
								)
									fail('Thermostat or claim revision overflowed; the retained reservation cannot be restored.');
								if (claim.state === 'released' || claim.physicalIdentity !== dto.physicalIdentity)
									fail('Only this exact retained canonical claim can be restored.');
								if (claim.sourcePropertyId) {
									if (claim.sourcePropertyId !== dto.sourcePropertyId)
										fail(
											'The old endpoint still exists; replacing its property requires a retained alias reservation.',
										);
									const previous = await this.property(manager, claim.sourcePropertyId);
									if (
										thermostatActuatorIdentity(previous.property, previous.channel, previous.device) !==
										claim.physicalIdentity
									)
										fail('Existing endpoint no longer matches the reserved canonical hardware.');
								}
								const target = await this.property(manager, dto.sourcePropertyId);
								const identity = thermostatActuatorIdentity(target.property, target.channel, target.device);
								if (
									identity !== claim.physicalIdentity ||
									!(target.channel instanceof ShellyNgChannelEntity) ||
									!(target.property instanceof ShellyNgChannelPropertyEntity) ||
									target.property.identifier !== 'output'
								)
									fail('Restored property must be the same canonical readable and writable Shelly output.');
								const conflict = await manager.findOneBy(VirtualThermostatActuatorClaimEntity, {
									physicalIdentity: identity,
									state: Not('released'),
								});
								if (conflict?.id !== claim.id) fail('Canonical physical actuator is reserved by another claim.');
								const priorProperty = claim.sourcePropertyIdentity;
								const releaseRequestedAt = claim.releaseRequestedAt ?? config.releaseRequestedAt;
								const releaseRequested = claim.state === 'releasing' || releaseRequestedAt !== null;
								if (owned && config.comfort) config.comfort.automation_baseline = null;
								config.revision++;
								config.requestedMode = 'off';
								claim.revision++;
								claim.qualificationGeneration = uuid();
								claim.state = releaseRequested ? 'releasing' : 'reserved';
								claim.sourcePropertyId = target.property.id;
								claim.sourcePropertyIdentity = target.property.id;
								claim.sourceDeviceId = target.device.id;
								claim.sourceDeviceIdentity = target.device.id;
								claim.contractFingerprint = thermostatPropertyContract(target.property, target.channel, target.device);
								claim.reason = releaseRequested ? claim.reason : 'operator_restored_same_physical_actuator';
								claim.releaseRequestedAt = releaseRequestedAt;
								claim.releasedAt = null;
								claim.releaseEvidence = null;
								await bindings();
								await assertControllerMutationImage(manager, controllerId, before);
								const configuration = await writeControllerPartition(manager, 'configuration', before.configuration, [
									config,
								]);
								const claims = await writeControllerPartition(manager, 'claims', before.claims, [claim], true);
								const audit = manager.create(VirtualThermostatRecoveryEntity, {
									id: uuid(),
									controllerId,
									claimId: claim.id,
									physicalIdentity: identity,
									previousPropertyIdentity: priorProperty,
									restoredPropertyId: target.property.id,
									actorId,
									reason: dto.reason.trim(),
									disconnectionAcknowledged: true,
									configurationRevision: config.revision,
									claimRevision: claim.revision,
									createdAt: new Date(),
								});
								const recoveries = await writeControllerPartition(
									manager,
									'recoveries',
									before.recoveries,
									[audit],
									true,
								);
								await assertControllerMutationImage(manager, controllerId, {
									...before,
									configuration,
									claims,
									recoveries,
								});
								await bindings();
								await this.automation?.manualFence(manager, controllerId, true, slot);
								await this.graph.sealControllerLedger(manager);
								ready = true;
							},
							undefined,
							(manager) => {
								receipt = observeSqliteOuterOutcome(manager);
								registerSqliteCommitGuard(manager, () => ready && ownerCurrent());
							},
							() => {
								if (receipt.outcome !== 'committed') fail('Missing original native restore acknowledgement.');
							},
						);
						this.claims.revokeQualification(dto.physicalIdentity);
						return this.afterCommit(controllerId);
					}),
				);
			} finally {
				releaseFence();
				// Reload schedules its own retry; preserve the committed result or original validation error.
				await this.claims.refresh().catch(() => undefined);
			}
		});
	}
	async recoveryEvents(controllerId: string) {
		await this.get(controllerId);
		return this.dataSource.manager.find(VirtualThermostatRecoveryEntity, {
			where: { controllerId },
			order: { createdAt: 'DESC' },
		});
	}
	/** Atomic merged settings validation: a single bound cannot create an overlapping persisted deadband. */
	async command(updates: readonly IDevicePropertyData[]): Promise<boolean> {
		return ControllerPublicationContext.complete(async () => {
			const own = captureCreation(this, [
				'command',
				'dataSource',
				'structureLock',
				'graph',
				'claims',
				'events',
				'values',
			] as (keyof this)[]);
			const lock = captureCreation(this.structureLock, [
				'runExclusive',
				'runShared',
				'hasCurrentStructuralLease',
				'context',
			] as (keyof DeviceStructureLockService)[]);
			const graph = captureCreation(this.graph, [
				'withComfortSelectionWrite',
				'sealControllerLedger',
				'structuralWrite',
				'refreshValidation',
				'dataSource',
				'revision',
			] as (keyof VirtualDependencyGraphService)[]);
			const claims = captureCreation(this.claims, ['invalidate', 'refresh']);
			const values = captureCreation(this.values, ['write', 'readLatest']);
			const events = captureCreation(this.events, ['emit']);
			const helper = captureCreation(thermostatComfortSelection, ['pin']);
			const valueSet = EventType.CHANNEL_PROPERTY_VALUE_SET,
				configChanged = THERMOSTAT_CONFIG_CHANGED;
			const selection = helper.values.pin(this.dataSource, 'registered-settings');
			const { input, destinations } = selection.registeredInput(updates);
			if (input === null) return true;
			// Route only after the original synchronous one-read input capture.
			if (this.native && (await this.native.ownsController(input.id)))
				return this.native.commandSettings(input.commands);
			const pins = [own, lock, graph, claims, values, events, helper, selection];
			const current = () => pins.every((pin) => pin.current());
			const check = () => {
				if (!current()) fail('Original thermostat settings dispatch expired.');
			};
			check();
			let ownerCurrent = () => false;
			const operation = selection.operation(input, () => ownerCurrent(), current, true);
			const noop = VirtualThermostatOwnershipSubscriber.captureNoopFence(this.dataSource, () => ownerCurrent());
			try {
				const predecessors = this.automation?.beginMutation(input.id);
				if (predecessors !== undefined) await predecessors;
				await lock.values.runExclusive.call(
					lock.receiver,
					ControllerPublicationContext.captureCallback(async () => {
						check();
						ownerCurrent = AsyncLocalStorage.bind(() => lock.values.hasCurrentStructuralLease.call(lock.receiver));
						try {
							const write = async (manager: EntityManager, advanceGraph?: () => Promise<number>) => {
								const slot = await this.automation?.captureManualSlot(manager, input.id);
								const owned = await this.automation?.captureInstalledIntent(manager, input.id);
								const before = await readControllerMutationImage(manager, input.id);
								const result = await operation.write(manager, owned ?? undefined, {
									advanceGraph,
									canRemainUnchanged: (takeover) =>
										!slot?.facts ||
										(!['LIVE', 'PROVISIONAL'].includes(slot.facts.state) && (!takeover || slot.facts.manualHold)),
									verifyUnchanged: async () => {
										await assertControllerMutationImage(manager, input.id, before);
										await this.automation?.captureUnchangedAuthority(manager, input.id);
									},
								});
								if (this.automation && operation.changed()) {
									const takeover = operation.takesManualHold();
									await this.automation.manualFence(manager, input.id, takeover ? true : undefined, slot, takeover);
								}
								await graph.values.sealControllerLedger.call(graph.receiver, manager);
								if (operation.changed()) noop.applied();
								else noop.arm();
								operation.markReady();
								return result;
							};
							await graph.values.withComfortSelectionWrite.call(
								graph.receiver,
								write,
								undefined,
								(manager) => {
									operation.admit(manager);
									noop.admit(manager);
								},
								operation.accepted,
								'registered-settings',
								write,
								noop,
							);
							operation.accepted();
						} catch (cause: unknown) {
							operation.settlement.transactionFailure = Object.freeze({ cause });
							throw cause;
						}
						const publication = new ControllerPublicationContext(this.graph.capturePublishGuard());
						return publication.run(async () => {
							// Ordinary inherited maintenance has no new post-ACK currentness veto.
							let stage = 'claims.invalidate';
							let index: number | undefined;
							try {
								claims.values.invalidate.call(claims.receiver);
								stage = 'claims.refresh';
								await claims.values.refresh.call(claims.receiver);
								// Even a native no-op must retry the original mirrors after an earlier publication failure.
								for (index = 0; index < destinations.length; index++) {
									const property = destinations[index],
										value = input.commands[index].value;
									stage = 'values.write';
									await invokeCreation(values.values.write, values.receiver, property, value);
									stage = 'values.readLatest';
									const latest = await invokeCreation(values.values.readLatest, values.receiver, property);
									stage = 'property.value';
									property.value = latest;
									stage = 'VALUE_SET';
									events.values.emit.call(events.receiver, valueSet, property);
								}
								index = undefined;
								stage = 'configChanged';
								events.values.emit.call(events.receiver, configChanged, input.id);
								return true;
							} catch (cause: unknown) {
								operation.settlement.maintenanceFailure = Object.freeze({ stage, index, cause });
								throw cause;
							}
						});
					}),
				);
				return true;
			} catch (cause: unknown) {
				operation.settlement.structuralFailure = Object.freeze({ cause });
				throw cause;
			} finally {
				noop.close();
			}
		});
	}

	async isRegisteredSetting(
		property: VirtualChannelPropertyEntity,
		manager: EntityManager = this.dataSource.manager,
	): Promise<boolean> {
		if (await this.native?.isRegisteredSetting(property, manager)) return true;
		const setting = await manager.findOneBy(VirtualThermostatSettingEntity, { propertyId: property.id });
		if (!setting) return false;
		const target = await this.property(manager, property.id);
		return (
			property.valueOrigin === VirtualValueOrigin.LOCAL &&
			!property.sourcePropertyId &&
			setting.contractFingerprint === thermostatPropertyContract(property, target.channel, target.device)
		);
	}
	private async property(manager: EntityManager, id: string, previewOnly = false) {
		const property = previewOnly
			? await manager
					.createQueryBuilder(ChannelPropertyEntity, 'property')
					.leftJoinAndSelect('property.channel', 'channel')
					.leftJoinAndSelect('channel.device', 'device')
					.where('property.id = :id', { id })
					.callListeners(false)
					.getOne()
			: await manager.findOne(ChannelPropertyEntity, {
					where: { id },
					relations: ['channel', 'channel.device'],
				});
		if (!property) fail('Thermostat source or setting property does not exist.');
		const channel = property.channel as ChannelEntity;
		return { property, channel, device: channel.device as VirtualDeviceEntity };
	}
	private validatePolicy(policy: ConfigureVirtualThermostatDto['policy'], mode: string): void {
		const errors = validateVirtualThermostatPolicy(policy);
		if (
			errors.length ||
			!['off', 'heat', 'cool', 'auto'].includes(mode) ||
			((mode === 'heat' || mode === 'auto') && policy.heatingSetpoint === null) ||
			((mode === 'cool' || mode === 'auto') && policy.coolingSetpoint === null)
		)
			fail(`Invalid thermostat mode/policy: ${errors.join(', ')}.`);
	}
	private async validate(
		manager: EntityManager,
		controllerId: string,
		dto: ConfigureVirtualThermostatDto,
		draft?: VirtualDeviceEntity,
	) {
		const owner = draft ?? (await manager.findOneBy(VirtualDeviceEntity, { id: controllerId }));
		if (!owner || owner.mode !== VirtualDeviceMode.CLIMATE_CONTROLLER || owner.category !== DeviceCategory.THERMOSTAT)
			fail('Thermostat configuration requires a climate-controller thermostat device.');
		const previous = await manager.findOneBy(VirtualThermostatConfigEntity, { controllerId });
		// Existing guarded no-op windows retain their closed read grammar. SQL uniqueness
		// and reciprocal insert triggers exclude a second strategy on the same controller.
		if (
			!previous &&
			this.dataSource.hasMetadata(NativeThermostatEntity) &&
			(await manager.existsBy(NativeThermostatEntity, { controllerId }))
		)
			fail('Guarded branches and native units are mutually exclusive.');
		if (dto.schemaVersion !== 1 || dto.expectedRevision !== (previous?.revision ?? 0))
			fail('Thermostat configuration revision changed.');
		if (dto.controlStrategy !== undefined && dto.controlStrategy !== 'guarded_branches')
			fail('Use the native thermostat API to configure the native_unit strategy.');
		this.validatePolicy(dto.policy, dto.requestedMode);
		const comfort = dto.comfort
			? {
					...dto.comfort,
					selected_preset: previous?.comfort?.selected_preset ?? null,
					user_off: dto.requestedMode === 'off',
					automation_enabled: dto.comfort.automation_enabled ?? previous?.comfort?.automation_enabled ?? false,
					automation_baseline:
						dto.comfort.automation_enabled === false ? null : (previous?.comfort?.automation_baseline ?? null),
					temporary_override: previous?.comfort?.temporary_override ?? null,
				}
			: previous?.comfort
				? { ...previous.comfort, user_off: dto.requestedMode === 'off' }
				: null;
		if (comfort) {
			const errors = validateThermostatComfort(comfort, dto.policy);
			if (errors.length) fail(`Reconfigure comfort before changing branches/ranges: ${errors.join(', ')}`);
		}
		if (dto.heuristic && !validateVirtualWindowTrendPolicy(dto.heuristic))
			fail('Invalid independent window trend policy.');
		if (
			![dto.contactOpeningMs, dto.contactClosingMs].every(
				(value) => Number.isSafeInteger(value) && value >= 0 && value <= 86400000,
			)
		)
			fail('Invalid contact debounce policy.');
		const heatingInputs = Array.isArray(dto.actuators)
			? dto.actuators.filter((member) => member.role === 'heating')
			: [];
		if (
			!Array.isArray(dto.sources) ||
			dto.sources.length > 18 ||
			dto.sources.filter((source) => source.role === 'ambient').length !== 1 ||
			dto.sources.filter((source) => source.role === 'floor').length > (dto.policy.floor ? 1 : 0) ||
			(dto.policy.floor &&
				!dto.sources.some((source) => source.role === 'floor') &&
				!(heatingInputs.length > 0 && heatingInputs.every((member) => !!member.protection)))
		)
			fail('One ambient and one independently configured floor source are required for their enabled roles.');
		const oldSources = await manager.findBy(VirtualThermostatSourceEntity, { controllerId });
		const sources: VirtualThermostatSourceEntity[] = [];
		for (const input of dto.sources) {
			if (
				!['ambient', 'floor', 'contact'].includes(input.role) ||
				!Number.isInteger(input.maximumAgeSeconds) ||
				input.maximumAgeSeconds < 1 ||
				input.maximumAgeSeconds > 86400
			)
				fail('Invalid thermostat source role or freshness bound.');
			const old = input.id ? oldSources.find((row) => row.id === input.id && row.role === input.role) : null;
			if (input.id && !old) fail('Source binding identity is not owned by this role/controller.');
			if (!input.sourcePropertyId) {
				if (!old || old.sourcePropertyId !== null) fail('Only an existing missing source may retain a null binding.');
				sources.push(
					manager.create(VirtualThermostatSourceEntity, { ...old, maximumAgeSeconds: input.maximumAgeSeconds }),
				);
				continue;
			}
			const target = await this.property(manager, input.sourcePropertyId, !!draft);
			if (input.role === 'contact') {
				const primitive = (value: unknown) =>
					['string', 'number', 'boolean'].includes(typeof value) &&
					(typeof value !== 'number' || Number.isFinite(value));
				if (
					target.device.type === 'virtual' ||
					target.channel.category !== ChannelCategory.CONTACT ||
					target.property.category !== PropertyCategory.DETECTED ||
					!permissionSatisfied(PermissionType.READ_ONLY, new Set(target.property.permissions)) ||
					!primitive(input.openValue) ||
					!primitive(input.closedValue) ||
					input.openValue === input.closedValue
				)
					fail('Contacts require physical readable detected properties and distinct explicit open/closed mappings.');
			} else if (
				!isThermostatTemperature(target.property, target.channel) ||
				(target.device.type === 'virtual' &&
					!isEligibleVirtualTransformedTemperature(target.property, target.channel, target.device) &&
					(input.role !== 'ambient' || !isEligibleVirtualMeasurement(target.property, target.channel, target.device)))
			)
				fail('Temperature roles require readable Celsius physical inputs or a materialized ambient producer.');
			let physicalIdentity: string | null = target.device.type === 'virtual' ? null : `property:${target.property.id}`;
			let contractFingerprint = thermostatPropertyContract(target.property, target.channel, target.device);
			if (target.device.mode === VirtualDeviceMode.SENSOR_TRANSFORM) {
				const transform = await manager.findOneBy(VirtualTransformConfigEntity, {
					outputPropertyId: target.property.id,
				});
				const binding = await manager.findOneBy(VirtualTransformSourceEntity, { outputPropertyId: target.property.id });
				const physical = binding?.sourcePropertyId
					? (await this.property(manager, binding.sourcePropertyId, !!draft)).property
					: null;
				if (
					!transform ||
					(input.role === 'floor' && transform.policy?.operator === VirtualNumericTransformOperator.EXTENSION) ||
					!binding ||
					transform.quantity !== String(PropertyCategory.TEMPERATURE) ||
					transform.unit !== '°C' ||
					transformContractErrors(transform, target.property, physical, binding, this.resolver).length
				)
					fail(
						'Transformed thermostat temperatures require a configured Celsius single-physical-input producer contract.',
					);
				physicalIdentity = `property:${binding.sourcePropertyIdentity}`;
				contractFingerprint = thermostatFingerprint({
					output: contractFingerprint,
					transformRevision: transform.revision,
					transformPolicy: transform.policy,
					physicalIdentity,
					sourceQuantity: binding.quantity,
					sourceUnit: binding.unit,
				});
			}
			sources.push(
				manager.create(VirtualThermostatSourceEntity, {
					id: old?.id ?? uuid(),
					controllerId,
					role: input.role,
					sourcePropertyId: target.property.id,
					sourcePropertyIdentity: target.property.id,
					physicalIdentity,
					contractFingerprint,
					maximumAgeSeconds: input.maximumAgeSeconds,
					openValue: input.openValue ?? null,
					closedValue: input.closedValue ?? null,
				}),
			);
		}
		if (new Set(sources.map((source) => source.role + ':' + source.sourcePropertyIdentity)).size !== sources.length)
			fail('Duplicate source binding.');
		if (
			!Array.isArray(dto.actuators) ||
			dto.actuators.length < 1 ||
			dto.actuators.length > MAX_THERMOSTAT_ACTUATOR_MEMBERS ||
			dto.actuators.some((actuator) => !['heating', 'cooling'].includes(actuator.role)) ||
			!!dto.actuators.find((actuator) => actuator.role === 'heating') !== (dto.policy.heatingSetpoint !== null) ||
			!!dto.actuators.find((actuator) => actuator.role === 'cooling') !== (dto.policy.coolingSetpoint !== null)
		)
			fail('Physical actuator branches must match configured comfort setpoints.');
		const oldClaims = await manager.findBy(VirtualThermostatActuatorClaimEntity, {
			controllerId,
			state: Not('released'),
		});
		const actuators: VirtualThermostatActuatorClaimEntity[] = [];
		for (const input of dto.actuators) {
			const old = oldClaims.find(
				(claim) => claim.role === input.role && claim.sourcePropertyIdentity === input.sourcePropertyId,
			);
			if (old && old.sourcePropertyId !== input.sourcePropertyId)
				fail('Request and prove release before actuator repair, remap or detach.');
			const target = await this.property(manager, input.sourcePropertyId, !!draft);
			const identity = thermostatActuatorIdentity(target.property, target.channel, target.device);
			if (
				!identity ||
				!(target.channel instanceof ShellyNgChannelEntity) ||
				!(target.property instanceof ShellyNgChannelPropertyEntity) ||
				target.property.identifier !== 'output' ||
				!Number.isFinite(input.leaseSeconds) ||
				input.leaseSeconds <= 0
			)
				fail('Actuator requires a supported physical guarded boolean leaf and explicit finite ON lease.');
			const fingerprint = thermostatPropertyContract(target.property, target.channel, target.device);
			if (old && (old.physicalIdentity !== identity || old.contractFingerprint !== fingerprint))
				fail('Actuator identity/contract changed; explicit release and repair required.');
			const conflict = await manager.findOneBy(VirtualThermostatActuatorClaimEntity, {
				physicalIdentity: identity,
				state: Not('released'),
			});
			if (conflict && conflict.id !== old?.id)
				fail('Canonical physical actuator is already reserved; qualified release is required before repair or remap.');
			actuators.push(
				manager.create(VirtualThermostatActuatorClaimEntity, {
					id: old?.id ?? uuid(),
					controllerId,
					role: input.role,
					physicalIdentity: identity,
					providerProfile:
						input.role === 'cooling' && dto.policy.cooling
							? REMOTE_DEW_POINT_PROFILE
							: (old?.providerProfile ?? SHELLY_GUARDED_PROFILE),
					providerProfileVersion: old?.providerProfileVersion ?? SHELLY_GUARDED_PROFILE_VERSION,
					sourcePropertyId: target.property.id,
					sourcePropertyIdentity: target.property.id,
					sourceDeviceId: target.device.id,
					sourceDeviceIdentity: target.device.id,
					contractFingerprint: fingerprint,
					revision: (old?.revision ?? 0) + 1,
					qualificationGeneration: old?.qualificationGeneration ?? null,
					state: old?.state ?? 'reserved',
					leaseSeconds: input.leaseSeconds,
					reason: old?.reason ?? null,
					releaseRequestedAt: old?.releaseRequestedAt ?? null,
					releasedAt: null,
					releaseEvidence: null,
				}),
			);
		}
		if (oldClaims.some((old) => !actuators.some((claim) => claim.id === old.id)))
			fail('Unresolved actuator reservation cannot be detached.');
		if (new Set(actuators.map((claim) => claim.physicalIdentity)).size !== actuators.length)
			fail('Branch members cannot own the same physical actuator more than once.');
		const coolingDependencies: ThermostatCoolingDependencyEntity[] = [];
		for (const claim of actuators) {
			const input = dto.actuators.find((member) => member.sourcePropertyId === claim.sourcePropertyIdentity);
			if (input.coolingProtection || (dto.policy.cooling && claim.role === 'cooling')) {
				if (!dto.policy.cooling) fail('Cooling dependency requires the separate cooling policy.');
				const dependency = await this.coolingDependencies().prepare(manager, claim, input.coolingProtection);
				if (
					sources.some(
						(source) =>
							source.role === 'ambient' &&
							(source.sourcePropertyId === dependency.surfacePropertyId ||
								source.physicalIdentity === `property:${dependency.physicalSurfaceIdentity}`),
					)
				)
					fail('Ambient temperature cannot substitute for a cooled-surface probe.');
				coolingDependencies.push(dependency);
				claim.qualificationGeneration = uuid();
			}
		}
		const protections: ThermostatMemberProtectionEntity[] = [];
		const heating = actuators.filter((claim) => claim.role === 'heating');
		for (const claim of actuators) {
			const input = dto.actuators.find((member) => member.sourcePropertyId === claim.sourcePropertyIdentity);
			const old = await manager.findOneBy(ThermostatMemberProtectionEntity, { claimId: claim.id });
			if (input.protection === undefined) {
				if (old || (claim.role === 'heating' && heating.length > 1))
					fail(
						'Every parallel or previously explicit heating member requires an explicit retained protection binding.',
					);
				continue;
			}
			const protection = input.protection;
			if (
				!protection ||
				claim.role !== 'heating' ||
				protection.schemaVersion !== 1 ||
				protection.kind !== 'local_floor' ||
				!dto.policy.floor ||
				!Number.isInteger(protection.maximumAgeSeconds) ||
				protection.maximumAgeSeconds < 1 ||
				protection.maximumAgeSeconds > 86400
			)
				fail('Invalid explicit local floor protection.');
			if (!protection.sourcePropertyId) {
				if (!old || old.sourcePropertyId !== null)
					fail('Null cannot remove protection; only retain an already missing source.');
				protections.push(
					manager.create(ThermostatMemberProtectionEntity, {
						...old,
						revision: old.revision + 1,
						maximumAgeSeconds: protection.maximumAgeSeconds,
					}),
				);
			} else {
				const source = await resolveThermostatProtectionSource(
					manager,
					protection.sourcePropertyId,
					claim.physicalIdentity,
				);
				protections.push(
					manager.create(ThermostatMemberProtectionEntity, {
						claimId: claim.id,
						schemaVersion: 1,
						kind: 'local_floor',
						revision: (old?.revision ?? 0) + 1,
						sourcePropertyId: source.property.id,
						sourcePropertyIdentity: source.property.id,
						physicalPropertyIdentity: source.leaf.id,
						contractFingerprint: source.fingerprint,
						maximumAgeSeconds: protection.maximumAgeSeconds,
					}),
				);
			}
			claim.qualificationGeneration = uuid();
		}
		if (dto.displayFloorClaimId && !protections.some((row) => row.claimId === dto.displayFloorClaimId))
			fail('Display floor must select an explicitly protected active member.');
		const otherConsumers = await manager
			.createQueryBuilder(ThermostatMemberProtectionEntity, 'protection')
			.innerJoin('protection.claim', 'claim')
			.where('claim.controllerId <> :controllerId AND claim.state <> :released', { controllerId, released: 'released' })
			.getMany();
		validateProtectionConsumerIndex([...otherConsumers, ...protections]);
		// Validate the producer DAG separately: consumer dependencies must never become measurement lineage.
		this.graph.validate(await this.graph.edges(manager));
		if (
			!Array.isArray(dto.settings) ||
			dto.settings.length > 5 ||
			new Set(dto.settings.map((input) => input.setting)).size !== dto.settings.length ||
			new Set(dto.settings.map((input) => input.propertyId)).size !== dto.settings.length
		)
			fail('Invalid or duplicate local setting registration.');
		const settings: VirtualThermostatSettingEntity[] = [];
		for (const input of dto.settings) {
			const draftProperty = draft?.channels
				?.flatMap((channel) => channel.properties ?? [])
				.find((property) => property.id === input.propertyId);
			const target = draftProperty
				? { property: draftProperty, channel: draftProperty.channel as ChannelEntity, device: draft }
				: await this.property(manager, input.propertyId);
			const expected = this.settingContract(input.setting);
			const property = target.property as VirtualChannelPropertyEntity;
			if (
				target.device.id !== controllerId ||
				property.valueOrigin !== VirtualValueOrigin.LOCAL ||
				property.sourcePropertyId ||
				!expected ||
				target.channel.category !== expected.channel ||
				property.category !== expected.property ||
				(expected.numeric
					? ![DataTypeType.FLOAT, DataTypeType.INT].includes(property.dataType)
					: property.dataType !== DataTypeType.BOOL) ||
				!property.permissions.some((permission) =>
					[PermissionType.READ_ONLY, PermissionType.READ_WRITE].includes(permission),
				) ||
				(input.setting.startsWith('heating') && dto.policy.heatingSetpoint === null) ||
				(input.setting.startsWith('cooling') && dto.policy.coolingSetpoint === null)
			)
				fail('Setting must be an owned writable property matching its thermostat role.');
			property.permissions = [PermissionType.READ_WRITE];
			settings.push(
				manager.create(VirtualThermostatSettingEntity, {
					propertyId: input.propertyId,
					controllerId,
					setting: input.setting,
					contractFingerprint: thermostatPropertyContract(property, target.channel, target.device),
				}),
			);
		}
		const config = manager.create(VirtualThermostatConfigEntity, {
			controlStrategy: 'guarded_branches',
			displayFloorClaimId: dto.displayFloorClaimId ?? null,
			controllerId,
			ownerDeviceId: controllerId,
			schemaVersion: 1,
			revision: (previous?.revision ?? 0) + 1,
			requestedMode: dto.requestedMode,
			comfort,
			locked: previous?.locked ?? false,
			policy: { ...dto.policy, floor: dto.policy.floor ?? null },
			heuristic: dto.heuristic ?? null,
			contactOpeningMs: dto.contactOpeningMs,
			contactClosingMs: dto.contactClosingMs,
			configuredAt: new Date(),
			releaseRequestedAt: previous?.releaseRequestedAt ?? null,
		});
		return { config, sources, actuators, settings, protections, coolingDependencies };
	}
	private settingContract(setting: ThermostatSetting) {
		if (setting === 'locked')
			return { channel: ChannelCategory.THERMOSTAT, property: PropertyCategory.LOCKED, numeric: false };
		if (!['heating_setpoint', 'cooling_setpoint', 'heating_enabled', 'cooling_enabled'].includes(setting)) return null;
		return {
			channel: setting.startsWith('heating') ? ChannelCategory.HEATER : ChannelCategory.COOLER,
			property: setting.endsWith('setpoint') ? PropertyCategory.TEMPERATURE : PropertyCategory.ON,
			numeric: setting.endsWith('setpoint'),
		};
	}
	private async model(
		config: VirtualThermostatConfigEntity,
		sources: VirtualThermostatSourceEntity[],
		actuators: VirtualThermostatActuatorClaimEntity[],
		settings: VirtualThermostatSettingEntity[],
		manager?: EntityManager,
		preparedProtections?: ThermostatMemberProtectionEntity[],
		preparedCoolingDependencies?: ThermostatCoolingDependencyEntity[],
	) {
		const protections =
			preparedProtections ?? (await (manager ?? this.dataSource.manager).find(ThermostatMemberProtectionEntity));
		const coolingDependencies =
			preparedCoolingDependencies ??
			(this.dataSource.hasMetadata?.(ThermostatCoolingDependencyEntity)
				? await (manager ?? this.dataSource.manager).find(ThermostatCoolingDependencyEntity)
				: []);
		const coolingService = this.coolingDependencies();
		const coolingDiagnostics = this.dataSource.hasMetadata?.(ThermostatCoolingDependencyEntity)
			? coolingService.read(await coolingService.load(config, actuators, coolingDependencies), Date.now())
			: [];
		const reasons = ['controller_runtime_unavailable'];
		if (
			config.policy.cooling &&
			coolingDiagnostics.some((d) => d.reasons.includes('cooling_remote_profile_installation_unqualified'))
		)
			reasons.push('cooling_remote_profile_installation_unqualified');
		for (const claim of actuators) {
			if (!claim.sourcePropertyId || !claim.sourceDeviceId) reasons.push(claim.role + '_actuator_missing');
			if (!this.claims.qualification(claim, thermostatHasOpposedBranches(actuators)))
				reasons.push(claim.role + '_hardware_qualification_missing');
			if (claim.state !== 'reserved') reasons.push(claim.role + '_' + claim.state);
		}
		for (const source of sources) if (!source.sourcePropertyId) reasons.push(source.role + '_source_missing');
		const modelClaim = (claim: VirtualThermostatActuatorClaimEntity) => ({
			cooling_diagnostics: coolingDiagnostics.find((entry) => entry.claim === claim.id) ?? null,
			cooling_protection:
				coolingDependencies
					.filter((row) => row.claimId === claim.id)
					.map((row) => ({
						schema_version: row.schemaVersion,
						revision: row.revision,
						purpose: row.purpose,
						dew_point_property: row.dewPointPropertyId,
						dew_point_identity: row.dewPointIdentity,
						surface_property: row.surfacePropertyId,
						surface_identity: row.surfaceIdentity,
						maximum_age_seconds: row.maximumAgeSeconds,
					}))[0] ?? null,
			protection:
				protections
					.filter((row) => row.claimId === claim.id)
					.map((row) => ({
						schema_version: row.schemaVersion,
						kind: row.kind,
						revision: row.revision,
						source_property: row.sourcePropertyId,
						source_identity: row.sourcePropertyIdentity,
						physical_property: row.physicalPropertyIdentity,
						maximum_age_seconds: row.maximumAgeSeconds,
					}))[0] ?? null,
			id: claim.id,
			group_identity: thermostatBranchGroupIdentity(config.controllerId, claim.role),
			provider_profile: claim.providerProfile ?? SHELLY_GUARDED_PROFILE,
			provider_profile_version: claim.providerProfileVersion ?? SHELLY_GUARDED_PROFILE_VERSION,
			role: claim.role,
			source_property: claim.sourcePropertyId,
			source_identity: claim.sourcePropertyIdentity,
			physical_identity: claim.physicalIdentity,
			revision: claim.revision,
			qualification_generation: claim.qualificationGeneration,
			state: claim.state,
			lease_seconds: claim.leaseSeconds,
			reason: claim.reason,
			release_requested_at: claim.releaseRequestedAt?.toISOString() ?? null,
			released_at: claim.releasedAt?.toISOString() ?? null,
			release_evidence: claim.releaseEvidence,
		});
		return {
			display_floor_claim: config.displayFloorClaimId ?? null,
			controller: config.controllerId,
			schema_version: 1,
			control_strategy: config.controlStrategy ?? 'guarded_branches',
			revision: config.revision,
			graph_revision: await this.graph.revision(manager),
			requested_mode: config.requestedMode,
			locked: config.locked,
			policy: config.policy,
			heuristic: config.heuristic,
			contact_opening_ms: config.contactOpeningMs,
			contact_closing_ms: config.contactClosingMs,
			readiness: 'draft' as const,
			reasons,
			sources: sources.map((source) => ({
				id: source.id,
				role: source.role,
				source_property: source.sourcePropertyId,
				source_identity: source.sourcePropertyIdentity,
				physical_identity: source.physicalIdentity,
				contract_fingerprint: source.contractFingerprint,
				maximum_age_seconds: source.maximumAgeSeconds,
				open_value: source.openValue,
				closed_value: source.closedValue,
			})),
			actuators: actuators.map(modelClaim),
			released_actuators: (
				await (manager ?? this.dataSource.manager).findBy(VirtualThermostatActuatorClaimEntity, {
					controllerId: config.controllerId,
					state: 'released',
				})
			).map(modelClaim),
			settings: settings.map((setting) => ({ property: setting.propertyId, setting: setting.setting })),
		};
	}
}
