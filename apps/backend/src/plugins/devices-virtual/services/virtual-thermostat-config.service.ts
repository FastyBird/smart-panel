import { DataSource, EntityManager, Not } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable, NotFoundException } from '@nestjs/common';
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
import { ConfigureVirtualThermostatDto } from '../dto/thermostat-config.dto';
import {
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import {
	ThermostatSetting,
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatSettingEntity,
	VirtualThermostatSourceEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import {
	isEligibleVirtualMeasurement,
	isEligibleVirtualTransformedTemperature,
} from './virtual-source-eligibility.utils';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import {
	isThermostatTemperature,
	thermostatActuatorIdentity,
	thermostatFingerprint,
	thermostatPropertyContract,
} from './virtual-thermostat-contract.utils';
import { validateVirtualThermostatPolicy } from './virtual-thermostat-policy.utils';
import { transformContractErrors } from './virtual-transform-contract.utils';
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
	) {}

	async configure(controllerId: string, dto: ConfigureVirtualThermostatDto) {
		return this.structureLock.runExclusive(async () => {
			await this.graph.withStructuralWrite(async (manager) => {
				const prepared = await this.validate(manager, controllerId, dto);
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
			}, dto.expectedGraphRevision);
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
			await this.claims.refresh();
			this.events.emit(THERMOSTAT_CONFIG_CHANGED, controllerId);
			return current;
		});
	}
	async preview(controllerId: string, dto: ConfigureVirtualThermostatDto) {
		return this.structureLock.runExclusive(async () => {
			if (dto.expectedGraphRevision !== undefined && dto.expectedGraphRevision !== (await this.graph.revision()))
				fail('Virtual graph revision changed.');
			const prepared = await this.validate(this.dataSource.manager, controllerId, dto);
			return this.model(prepared.config, prepared.sources, prepared.actuators, prepared.settings);
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
		return this.structureLock.runExclusive(async () => {
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
	private async property(manager: EntityManager, id: string) {
		const property = await manager.findOne(ChannelPropertyEntity, {
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
	private async validate(manager: EntityManager, controllerId: string, dto: ConfigureVirtualThermostatDto) {
		const owner = await manager.findOneBy(VirtualDeviceEntity, { id: controllerId });
		if (!owner || owner.mode !== VirtualDeviceMode.CLIMATE_CONTROLLER || owner.category !== DeviceCategory.THERMOSTAT)
			fail('Thermostat configuration requires a climate-controller thermostat device.');
		const previous = await manager.findOneBy(VirtualThermostatConfigEntity, { controllerId });
		if (dto.schemaVersion !== 1 || dto.expectedRevision !== (previous?.revision ?? 0))
			fail('Thermostat configuration revision changed.');
		this.validatePolicy(dto.policy, dto.requestedMode);
		if (dto.heuristic && !validateVirtualWindowTrendPolicy(dto.heuristic))
			fail('Invalid independent window trend policy.');
		if (
			![dto.contactOpeningMs, dto.contactClosingMs].every(
				(value) => Number.isSafeInteger(value) && value >= 0 && value <= 86400000,
			)
		)
			fail('Invalid contact debounce policy.');
		if (
			!Array.isArray(dto.sources) ||
			dto.sources.length > 18 ||
			dto.sources.filter((source) => source.role === 'ambient').length !== 1 ||
			dto.sources.filter((source) => source.role === 'floor').length !== (dto.policy.floor ? 1 : 0)
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
			const target = await this.property(manager, input.sourcePropertyId);
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
					? (await this.property(manager, binding.sourcePropertyId)).property
					: null;
				if (
					!transform ||
					!binding ||
					transform.quantity !== String(PropertyCategory.TEMPERATURE) ||
					transform.unit !== '°C' ||
					transformContractErrors(transform, target.property, physical, binding).length
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
			dto.actuators.length > 2 ||
			new Set(dto.actuators.map((actuator) => actuator.role)).size !== dto.actuators.length ||
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
			const old = oldClaims.find((claim) => claim.role === input.role);
			if (old && old.sourcePropertyId !== input.sourcePropertyId)
				fail('Request and prove release before actuator repair, remap or detach.');
			const target = await this.property(manager, input.sourcePropertyId);
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
			if (conflict && conflict.id !== old?.id) fail('Canonical physical actuator is already reserved.');
			actuators.push(
				manager.create(VirtualThermostatActuatorClaimEntity, {
					id: old?.id ?? uuid(),
					controllerId,
					role: input.role,
					physicalIdentity: identity,
					sourcePropertyId: target.property.id,
					sourcePropertyIdentity: target.property.id,
					sourceDeviceId: target.device.id,
					sourceDeviceIdentity: target.device.id,
					contractFingerprint: fingerprint,
					revision: (old?.revision ?? 0) + 1,
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
			fail('Opposed branches cannot own the same physical actuator.');
		if (
			!Array.isArray(dto.settings) ||
			dto.settings.length > 5 ||
			new Set(dto.settings.map((input) => input.setting)).size !== dto.settings.length ||
			new Set(dto.settings.map((input) => input.propertyId)).size !== dto.settings.length
		)
			fail('Invalid or duplicate local setting registration.');
		const settings: VirtualThermostatSettingEntity[] = [];
		for (const input of dto.settings) {
			const target = await this.property(manager, input.propertyId);
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
			controllerId,
			ownerDeviceId: controllerId,
			schemaVersion: 1,
			revision: (previous?.revision ?? 0) + 1,
			requestedMode: dto.requestedMode,
			locked: previous?.locked ?? false,
			policy: { ...dto.policy, floor: dto.policy.floor ?? null },
			heuristic: dto.heuristic ?? null,
			contactOpeningMs: dto.contactOpeningMs,
			contactClosingMs: dto.contactClosingMs,
			configuredAt: new Date(),
			releaseRequestedAt: previous?.releaseRequestedAt ?? null,
		});
		return { config, sources, actuators, settings };
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
	) {
		const reasons = ['controller_runtime_unavailable'];
		for (const claim of actuators) {
			if (!claim.sourcePropertyId || !claim.sourceDeviceId) reasons.push(claim.role + '_actuator_missing');
			if (!this.claims.qualification(claim, actuators.length > 1))
				reasons.push(claim.role + '_hardware_qualification_missing');
			if (claim.state !== 'reserved') reasons.push(claim.role + '_' + claim.state);
		}
		for (const source of sources) if (!source.sourcePropertyId) reasons.push(source.role + '_source_missing');
		return {
			controller: config.controllerId,
			schema_version: 1,
			revision: config.revision,
			graph_revision: await this.graph.revision(),
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
			actuators: actuators.map((claim) => ({
				id: claim.id,
				role: claim.role,
				source_property: claim.sourcePropertyId,
				source_identity: claim.sourcePropertyIdentity,
				physical_identity: claim.physicalIdentity,
				revision: claim.revision,
				state: claim.state,
				lease_seconds: claim.leaseSeconds,
				reason: claim.reason,
			})),
			settings: settings.map((setting) => ({ property: setting.propertyId, setting: setting.setting })),
		};
	}
}
