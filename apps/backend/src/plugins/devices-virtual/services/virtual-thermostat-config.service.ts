import { DataSource, EntityManager, Not } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
export class VirtualThermostatConfigService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly structureLock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly claims: VirtualThermostatClaimsService,
		private readonly events: EventEmitter2,
		private readonly values: PropertyValueService,
		@Optional() private readonly resolver: VirtualTransformResolver = new VirtualTransformResolver(),
	) {}

	private coolingDependencies(): ThermostatCoolingDependencyService {
		return new ThermostatCoolingDependencyService(this.dataSource, this.values, this.claims);
	}

	async configure(controllerId: string, dto: ConfigureVirtualThermostatDto) {
		// Revoke captured ON authority synchronously, before lock acquisition or any validation I/O.
		const release = this.claims.holdRecoveryFence();
		this.claims.revokeAllQualifications();
		this.events.emit(THERMOSTAT_CONFIG_CHANGED, controllerId);
		try {
			return await this.structureLock.runExclusive(async () => {
				await this.graph.withStructuralWrite(async (manager) => {
					const prepared = await this.prepare(manager, controllerId, dto);
					await this.persist(manager, controllerId, prepared);
				}, dto.expectedGraphRevision);
				return this.afterCommit(controllerId);
			});
		} finally {
			release();
			await this.claims.refresh().catch(() => undefined);
		}
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
	async persist(
		manager: EntityManager,
		controllerId: string,
		prepared: Awaited<ReturnType<VirtualThermostatConfigService['prepare']>>,
	): Promise<void> {
		await manager.save(prepared.config);
		await manager.delete(VirtualThermostatSourceEntity, { controllerId });
		await manager.save(prepared.sources);
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
		await manager.delete(VirtualThermostatSettingEntity, { controllerId });
		await manager.save(prepared.settings);
		await manager.save(prepared.actuators);
		await manager.save(ThermostatMemberProtectionEntity, prepared.protections);
		if (prepared.coolingDependencies.length)
			await manager.save(ThermostatCoolingDependencyEntity, prepared.coolingDependencies);
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
		this.claims.invalidate();
		const current = await this.get(controllerId);
		for (const setting of current.settings) {
			const target = await this.property(this.dataSource.manager, setting.property);
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
			await this.values.write(target.property, value);
			target.property.value = await this.values.readLatest(target.property);
			this.events.emit(EventType.CHANNEL_PROPERTY_UPDATED, target.property);
		}
		// The structural write has committed. Reload fails closed and schedules retry without changing that outcome.
		await this.claims.refresh().catch(() => undefined);
		this.events.emit(THERMOSTAT_CONFIG_CHANGED, controllerId);
		return current;
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
		const release = this.claims.holdRecoveryFence();
		this.claims.revokeAllQualifications();
		this.events.emit(THERMOSTAT_CONFIG_CHANGED, controllerId);
		try {
			return await this.structureLock.runExclusive(async () => {
				await this.graph.withStructuralWrite(async (manager) => {
					const config = await manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
					if (config.revision !== expectedRevision) fail('Thermostat revision changed.');
					config.revision++;
					config.requestedMode = 'off';
					config.releaseRequestedAt = new Date();
					await manager.save(config);
					const claims = await manager.findBy(VirtualThermostatActuatorClaimEntity, {
						controllerId,
						state: Not('released'),
					});
					for (const claim of claims) {
						claim.state = claim.sourcePropertyId ? 'releasing' : 'missing';
						claim.revision++;
						claim.releaseRequestedAt = config.releaseRequestedAt;
						claim.reason = 'explicit_release_requested';
					}
					await manager.save(claims);
				});
				this.claims.invalidate();
				await this.claims.refresh();
				this.events.emit(THERMOSTAT_CONFIG_CHANGED, controllerId);
				return this.get(controllerId);
			});
		} finally {
			release();
			await this.claims.refresh().catch(() => undefined);
		}
	}
	/** Rebind a lost database endpoint only to the same reserved physical switch. Operator intent is not release proof. */
	async restoreActuator(
		controllerId: string,
		claimId: string,
		dto: RestoreVirtualThermostatActuatorDto,
		actorId: string,
	) {
		if (
			!actorId ||
			dto.disconnectionAcknowledged !== true ||
			typeof dto.reason !== 'string' ||
			dto.reason.trim().length < 10
		)
			fail('An identified operator, disconnection acknowledgement and meaningful reason are required.');
		const releaseFence = this.claims.holdRecoveryFence();
		try {
			return await this.structureLock.runExclusive(async () => {
				await this.graph.withStructuralWrite(async (manager) => {
					const config = await manager.findOneBy(VirtualThermostatConfigEntity, { controllerId });
					const claim = await manager.findOneBy(VirtualThermostatActuatorClaimEntity, { id: claimId, controllerId });
					if (
						!config ||
						!claim ||
						config.revision !== dto.expectedRevision ||
						claim.revision !== dto.expectedClaimRevision
					)
						fail('Thermostat or claim revision changed; reload the retained reservation.');
					if (claim.state === 'released' || claim.physicalIdentity !== dto.physicalIdentity)
						fail('Only this exact retained canonical claim can be restored.');
					if (claim.sourcePropertyId) {
						if (claim.sourcePropertyId !== dto.sourcePropertyId)
							fail('The old endpoint still exists; replacing its property requires a retained alias reservation.');
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
					await manager.save(config);
					await manager.save(claim);
					await manager.save(
						manager.create(VirtualThermostatRecoveryEntity, {
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
						}),
					);
				});
				this.claims.revokeQualification(dto.physicalIdentity);
				return this.afterCommit(controllerId);
			});
		} finally {
			releaseFence();
			// Reload schedules its own retry; preserve the committed result or original validation error.
			await this.claims.refresh().catch(() => undefined);
		}
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
		if (!updates.length) return true;
		return this.structureLock.runExclusive(async () => {
			let controllerId: string;
			await this.graph.withStructuralWrite(async (manager) => {
				const rows = [] as VirtualThermostatSettingEntity[];
				for (const update of updates) {
					const setting = await manager.findOneBy(VirtualThermostatSettingEntity, { propertyId: update.property.id });
					if (
						!setting ||
						setting.contractFingerprint !== thermostatPropertyContract(update.property, update.channel, update.device)
					)
						fail('Only registered unchanged local thermostat settings accept commands.');
					rows.push(setting);
				}
				controllerId = rows[0].controllerId;
				if (rows.some((row) => row.controllerId !== controllerId))
					fail('Thermostat setting batch must have one owner.');
				const config = await manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				const owner = await manager.findOneBy(VirtualDeviceEntity, { id: controllerId });
				if (!owner?.enabled || (config.locked && rows.some((row) => row.setting !== 'locked')))
					fail('Thermostat is disabled or locked.');
				let heat = ['heat', 'auto'].includes(config.requestedMode),
					cool = ['cool', 'auto'].includes(config.requestedMode);
				for (const [index, row] of rows.entries()) {
					const value = updates[index].value;
					if (row.setting.endsWith('setpoint')) {
						if (typeof value !== 'number' || !Number.isFinite(value)) fail('Setpoint must be finite.');
						if (row.setting === 'heating_setpoint') config.policy.heatingSetpoint = value as number;
						else config.policy.coolingSetpoint = value as number;
					} else {
						if (typeof value !== 'boolean') fail('Thermostat enable and lock settings must be boolean.');
						if (row.setting === 'heating_enabled') heat = value as boolean;
						else if (row.setting === 'cooling_enabled') cool = value as boolean;
						else config.locked = value as boolean;
					}
				}
				if (config.comfort) {
					if (rows.some((row) => row.setting.endsWith('setpoint'))) config.comfort.selected_preset = null;
					if (rows.some((row) => row.setting.endsWith('enabled'))) config.comfort.user_off = !heat && !cool;
					const errors = validateThermostatComfort(config.comfort, config.policy);
					if (errors.length) fail(errors.join(', '));
				}
				config.requestedMode = heat ? (cool ? 'auto' : 'heat') : cool ? 'cool' : 'off';
				this.validatePolicy(config.policy, config.requestedMode);
				config.revision++;
				await manager.save(config);
			});
			this.claims.invalidate();
			await this.claims.refresh();
			for (const update of updates) {
				await this.values.write(update.property, update.value);
				update.property.value = await this.values.readLatest(update.property);
				this.events.emit(EventType.CHANNEL_PROPERTY_VALUE_SET, update.property);
			}
			this.events.emit(THERMOSTAT_CONFIG_CHANGED, controllerId);
			return true;
		});
	}
	async isRegisteredSetting(
		property: VirtualChannelPropertyEntity,
		manager: EntityManager = this.dataSource.manager,
	): Promise<boolean> {
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
		if (dto.schemaVersion !== 1 || dto.expectedRevision !== (previous?.revision ?? 0))
			fail('Thermostat configuration revision changed.');
		if (dto.controlStrategy !== undefined && dto.controlStrategy !== 'guarded_branches')
			fail('Native unit adapters are not implemented; guarded branches are required.');
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
