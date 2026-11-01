import { plainToInstance } from 'class-transformer';
import { DataSource, EntityManager, Not } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { registerSqliteCommitGuard } from '../../../common/database/sqlite-data-source';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import type { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import type {
	NativeClimateOperationResult,
	NativeClimateRequest,
	NativeClimateUnit,
} from '../../../modules/devices/platforms/native-climate.contract';
import { DeviceCreationContext } from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import {
	PropertyProducerLease,
	PropertyProducerRegistryService,
} from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { getPropertyMetadata } from '../../../modules/devices/utils/schema.utils';
import { CreateVirtualDeviceDto } from '../dto/create-device.dto';
import {
	CreateNativeThermostatDto,
	ReleaseNativeThermostatDto,
	RequestNativeThermostatDto,
	UpdateNativeThermostatDto,
} from '../dto/native-thermostat.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { NativeThermostatEntity, NativeThermostatRequestEntity } from '../entities/native-thermostat.entity';
import { VirtualThermostatConfigEntity } from '../entities/virtual-thermostat.entity';
import { NativeClimateCandidateModel, NativeThermostatModel } from '../models/native-thermostat-response.model';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';

const fail = (reason: string): never => {
	throw new DevicesValidationException(reason);
};

@Injectable()
export class NativeThermostatService implements OnApplicationBootstrap, OnModuleDestroy {
	private reservations: NativeThermostatEntity[] = [];
	private ready = false;
	private destroyed = false;
	private readonly units = new Map<string, NativeClimateUnit>();
	private epoch = 0;
	private stop?: () => void;
	private timer?: ReturnType<typeof setInterval>;
	private refreshing = false;
	private readonly leases = new Map<string, PropertyProducerLease>();
	private readonly generations = new Map<string, number>();
	private readonly requestedPublications = new Map<string, number>();
	private readonly work = new Set<Promise<unknown>>();
	private readonly observations = new Map<string, string>();
	private readonly attempts = new Map<string, Set<Promise<void>>>();
	private readonly releaseOwners = new Map<string, object>();
	private readonly pendingReleaseAdmissions = new Map<
		string,
		{ decision: Promise<void>; isOriginalOwner?: () => boolean }
	>();
	private readonly originalRequests = new Map<
		string,
		{ controller: string; intent: string; result: Promise<NativeThermostatModel | null> }
	>();

	constructor(
		private readonly database: DataSource,
		private readonly lock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly devices: DevicesService,
		private readonly platforms: PlatformRegistryService,
		private readonly admission: PropertyCommandAdmissionRegistryService,
		private readonly values: PropertyValueService,
		private readonly producers: PropertyProducerRegistryService,
	) {}

	async onApplicationBootstrap() {
		if (process.env.FB_CLI === 'on' || this.stop !== undefined || this.destroyed) return;
		this.stop = this.admission.register({
			capture: () => {
				const epoch = this.epoch;
				return {
					isCurrent: () => this.ready && epoch === this.epoch,
					assertAllowed: (update) => this.assertAllowed(update),
				};
			},
			requiresGuardedDispatch: (update) => this.requiresGuardedDispatch(update),
			assertAllowed: (update) => this.assertAllowed(update),
		});
		await this.lock.runExclusive(async () => {
			await this.database.manager.update(NativeThermostatRequestEntity, { state: 'pending' }, { state: 'interrupted' });
			// A fresh runtime has no issued work from the stopped process to drain. Complete only
			// its persisted metadata handback; never replay a request or send an OFF command.
			const releasing = await this.database.manager.findBy(NativeThermostatEntity, { bindingState: 'releasing' });
			if (releasing.length)
				await this.graph.withStructuralWrite(async (manager) => {
					for (const row of releasing) {
						if (!Number.isSafeInteger(row.revision) || row.revision >= Number.MAX_SAFE_INTEGER)
							fail('Native release recovery revision is invalid.');
						const result = await manager.update(
							NativeThermostatEntity,
							{ controllerId: row.controllerId, revision: row.revision, bindingState: 'releasing' },
							{ bindingState: 'released', revision: row.revision + 1 },
						);
						if (result.affected !== 1) fail('Native release recovery owner changed.');
					}
				});
			await this.reload();
		});
		this.timer = setInterval(() => {
			void this.refresh().catch(() => undefined);
		}, 1000);
		this.timer.unref();
		await this.refresh();
	}
	async onModuleDestroy() {
		this.destroyed = true;
		this.units.clear();
		this.ready = false;
		this.epoch++;
		this.stop?.();
		if (this.timer) clearInterval(this.timer);
		for (const lease of this.leases.values()) this.producers.unregister(lease);
		this.leases.clear();
		await Promise.allSettled([...this.work]);
	}
	@OnEvent(EventType.DEVICE_UPDATED)
	@OnEvent(EventType.DEVICE_DELETED)
	@OnEvent(EventType.CHANNEL_PROPERTY_UPDATED)
	@OnEvent(EventType.CHANNEL_PROPERTY_DELETED)
	onCatalogChanged(entity: { id?: string }) {
		if (entity.id) this.units.delete(entity.id);
		for (const row of this.reservations) {
			if (
				entity.id !== row.controllerId &&
				entity.id !== row.sourceDeviceId &&
				!row.ownedPropertyIds.includes(entity.id ?? '') &&
				!Object.values(row.propertyIds).includes(entity.id ?? '')
			)
				continue;
			this.epoch++;
			this.generations.set(row.controllerId, (this.generations.get(row.controllerId) ?? 0) + 1);
			for (const id of Object.values(row.propertyIds)) {
				const lease = this.leases.get(id);
				if (lease) this.producers.invalidate(lease, ['native_catalog_changed']);
				this.observations.delete(id);
			}
		}
	}
	private reserved(propertyId: string) {
		return this.reservations.some((row) => row.ownedPropertyIds.includes(propertyId));
	}
	private requiresGuardedDispatch(update: IDevicePropertyData) {
		if (this.reserved(update.property.id)) return true;
		const modeOrSetpoint =
			[ChannelCategory.THERMOSTAT, ChannelCategory.HEATER, ChannelCategory.COOLER].includes(update.channel.category) &&
			[PropertyCategory.MODE, PropertyCategory.ON, PropertyCategory.TEMPERATURE].includes(update.property.category);
		return (
			modeOrSetpoint &&
			this.reservations.some(
				(row) =>
					row.sourceDeviceId === update.device.id ||
					this.units.get(update.device.id)?.physicalIdentity === row.physicalIdentity,
			)
		);
	}
	private async assertAllowed(update: IDevicePropertyData) {
		let native = this.units.get(update.device.id);
		if (!native?.isCurrent())
			native = await this.platforms.get(update.device)?.captureNativeClimateUnit?.(update.device);
		const reservedCanonical =
			native &&
			this.reservations.some(
				(row) =>
					row.physicalIdentity === native.physicalIdentity && native.ownedPropertyIds.includes(update.property.id),
			);
		if (!this.ready || this.requiresGuardedDispatch(update) || reservedCanonical)
			fail('Native thermostat mode/setpoint bundle is reserved; use its controller.');
	}
	private async reload() {
		this.reservations = await this.database.manager.find(NativeThermostatEntity, {
			where: { bindingState: Not('released') },
		});
		this.ready = !this.destroyed;
		this.epoch++;
	}
	private async capture(id: string, manager = this.database.manager, fresh = false): Promise<NativeClimateUnit> {
		const device = await manager.findOneBy(DeviceEntity, { id });
		if (!device || !device.enabled) fail('Native source device is missing or disabled.');
		if (this.destroyed) fail('Native runtime is stopped.');
		let unit = fresh ? null : this.units.get(id);
		if (!unit?.isCurrent()) unit = await this.platforms.get(device)?.captureNativeClimateUnit?.(device);
		if (!unit || !unit.isCurrent()) fail('Source is not a supported current canonical native climate unit.');
		this.units.set(id, unit);
		return unit;
	}
	private conflictsWithBinding(row: NativeThermostatEntity, unit: NativeClimateUnit, controllerId?: string) {
		return (
			row.bindingState !== 'released' &&
			row.controllerId !== controllerId &&
			(row.physicalIdentity === unit.physicalIdentity ||
				row.sourceDeviceId === unit.deviceId ||
				row.ownedPropertyIds.some((id) => unit.ownedPropertyIds.includes(id)))
		);
	}
	async candidates() {
		return this.lock.runShared(async () => {
			const result: NativeClimateCandidateModel[] = [];
			for (const device of await this.database.manager.find(DeviceEntity)) {
				if (!device.enabled) continue;
				let unit: NativeClimateUnit;
				try {
					unit = await this.capture(device.id);
				} catch {
					continue;
				}
				result.push({
					device: device.id,
					name: device.name,
					provider: unit.provider,
					physical_identity: unit.physicalIdentity,
					fingerprint: unit.fingerprint,
					capabilities: unit.capabilities,
					reasons: this.reservations.some((row) => this.conflictsWithBinding(row, unit)) ? ['reserved'] : [],
				});
			}
			return result;
		});
	}
	async preview(dto: CreateNativeThermostatDto): Promise<NativeThermostatModel> {
		return this.lock.runShared(async () => {
			const unit = await this.capture(dto.sourceDevice);
			await this.assertUnbound(this.database.manager, unit);
			return {
				controller: null,
				binding_state: 'bound',
				control_strategy: 'native_unit',
				revision: 0,
				source_device: unit.deviceId,
				provider: unit.provider,
				physical_identity: unit.physicalIdentity,
				fingerprint: unit.fingerprint,
				requested: {},
				drift: [],
				observed: unit.observe(),
				capabilities: unit.capabilities,
				properties: {},
				latest_request: null,
			};
		});
	}
	private async assertUnbound(manager: EntityManager, unit: NativeClimateUnit, controllerId?: string) {
		for (const row of await manager.find(NativeThermostatEntity))
			if (this.conflictsWithBinding(row, unit, controllerId)) fail('Native unit is already reserved.');
		if (controllerId && (await manager.existsBy(VirtualThermostatConfigEntity, { controllerId })))
			fail('Guarded branches and native units are mutually exclusive.');
	}
	async create(dto: CreateNativeThermostatDto) {
		return this.lock.runExclusive(async () => {
			const unit = await this.capture(dto.sourceDevice);
			const id = uuid();
			const propertyIds: Record<string, string> = {};
			await DeviceCreationContext.run(
				(work) => this.graph.withStructuralWrite(work, dto.expectedGraphRevision),
				'virtual',
				async (context) => {
					await this.assertUnbound(context.manager, unit, id);
					registerSqliteCommitGuard(context.manager, () => unit.isCurrent());
					await this.devices.create(
						plainToInstance(CreateVirtualDeviceDto, {
							id,
							type: 'virtual',
							category: DeviceCategory.THERMOSTAT,
							mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
							name: dto.name,
							room_id: dto.room,
						}),
						context,
					);
					const add = async (
						category: ChannelCategory,
						fields: [string, PropertyCategory, DataTypeType, boolean][],
					) => {
						const channel = await context.manager.save(
							VirtualChannelEntity,
							context.manager.create(VirtualChannelEntity, {
								id: uuid(),
								device: { id },
								name: category,
								category,
							}),
						);
						for (const [key, propertyCategory, dataType, writable] of fields) {
							const metadata = getPropertyMetadata(category, propertyCategory);
							const limits =
								key === 'heating_setpoint'
									? unit.capabilities.heating
									: key === 'cooling_setpoint'
										? unit.capabilities.cooling
										: null;
							propertyIds[key] = uuid();
							await context.manager.save(
								VirtualChannelPropertyEntity,
								context.manager.create(VirtualChannelPropertyEntity, {
									id: propertyIds[key],
									channel,
									name: key,
									category: propertyCategory,
									dataType: metadata?.data_type ?? dataType,
									permissions: [writable ? PermissionType.READ_WRITE : PermissionType.READ_ONLY],
									valueOrigin: VirtualValueOrigin.LOCAL,
									sourcePropertyId: null,
									format:
										key === 'mode'
											? [...unit.capabilities.modes]
											: limits
												? [limits.minimum, limits.maximum]
												: (metadata?.format ?? null),
									step: limits?.step ?? metadata?.step ?? null,
								}),
							);
						}
					};
					await add(ChannelCategory.THERMOSTAT, [
						['mode', PropertyCategory.MODE, DataTypeType.ENUM, true],
						['locked', PropertyCategory.LOCKED, DataTypeType.BOOL, false],
					]);
					await add(ChannelCategory.TEMPERATURE, [
						['temperature', PropertyCategory.TEMPERATURE, DataTypeType.FLOAT, false],
					]);
					for (const [kind, category] of [
						['heating', ChannelCategory.HEATER],
						['cooling', ChannelCategory.COOLER],
					] as const) {
						if (!unit.capabilities[kind]) continue;
						await add(category, [
							[`${kind}_enabled`, PropertyCategory.ON, DataTypeType.BOOL, true],
							[`${kind}_setpoint`, PropertyCategory.TEMPERATURE, DataTypeType.FLOAT, true],
							[`${kind}_activity`, PropertyCategory.STATUS, DataTypeType.BOOL, false],
						]);
					}
					await context.manager.insert(NativeThermostatEntity, {
						controllerId: id,
						sourceDeviceId: unit.deviceId,
						physicalIdentity: unit.physicalIdentity,
						fingerprint: unit.fingerprint,
						provider: unit.provider,
						bindingState: 'bound',
						revision: 1,
						requested: {},
						propertyIds,
						ownedPropertyIds: [...unit.ownedPropertyIds],
						latestRequestId: null,
					});
					return id;
				},
				() => this.reload(),
			);
			return this.get(id);
		});
	}
	async get(id: string): Promise<NativeThermostatModel | null> {
		return this.lock.runShared(async () => {
			const row = await this.database.manager.findOneBy(NativeThermostatEntity, { controllerId: id });
			if (!row) return null;
			let unit: NativeClimateUnit | null = null;
			if (row.bindingState === 'bound') {
				try {
					unit = await this.capture(row.sourceDeviceId);
				} catch {
					/* Saved binding remains repairable. */
				}
			}
			if (unit?.fingerprint !== row.fingerprint || unit?.physicalIdentity !== row.physicalIdentity) unit = null;
			const observed = unit?.observe() ?? {
				available: false,
				temperature: null,
				mode: null,
				heatingSetpoint: null,
				coolingSetpoint: null,
				activity: null,
				observedAt: null,
				reasons: ['binding_unavailable'],
			};
			const drift: NativeThermostatModel['drift'] = [];
			if (observed.available) {
				if (row.requested.mode !== undefined && observed.mode !== null && row.requested.mode !== observed.mode)
					drift.push('mode');
				for (const [field, code, range] of [
					['heatingSetpoint', 'heating_setpoint', unit?.capabilities.heating],
					['coolingSetpoint', 'cooling_setpoint', unit?.capabilities.cooling],
				] as const) {
					const requested = row.requested[field];
					const actual = observed[field];
					if (
						requested !== undefined &&
						actual !== null &&
						Math.abs(requested - actual) > Math.max((range?.step ?? 0) / 2, 1e-6)
					)
						drift.push(code);
				}
			}
			const latest = row.latestRequestId
				? await this.database.manager.findOneBy(NativeThermostatRequestEntity, { id: row.latestRequestId })
				: null;
			return {
				controller: id,
				binding_state: row.bindingState,
				control_strategy: 'native_unit',
				revision: row.revision,
				source_device: row.sourceDeviceId,
				provider: row.provider,
				physical_identity: row.physicalIdentity,
				fingerprint: row.fingerprint,
				requested: row.requested,
				observed,
				drift,
				capabilities: unit?.capabilities ?? null,
				properties: row.propertyIds,
				latest_request: latest
					? {
							id: latest.id,
							revision: latest.revision,
							state: latest.state,
							request: latest.request,
							operations: latest.operations,
							created_at: latest.createdAt.toISOString(),
						}
					: null,
			};
		});
	}
	private async syncPropertyContracts(manager: EntityManager, row: NativeThermostatEntity, unit: NativeClimateUnit) {
		const contracts: {
			key: string;
			channel: ChannelCategory;
			category: PropertyCategory;
			dataType: DataTypeType;
			format: string[] | number[];
			step: number | null;
		}[] = [
			{
				key: 'mode',
				channel: ChannelCategory.THERMOSTAT,
				category: PropertyCategory.MODE,
				dataType: DataTypeType.ENUM,
				format: [...unit.capabilities.modes],
				step: null,
			},
		];
		for (const [branch, channel] of [
			['heating', ChannelCategory.HEATER],
			['cooling', ChannelCategory.COOLER],
		] as const) {
			const range = unit.capabilities[branch];
			if (range)
				contracts.push({
					key: `${branch}_setpoint`,
					channel,
					category: PropertyCategory.TEMPERATURE,
					dataType: DataTypeType.FLOAT,
					format: [range.minimum, range.maximum],
					step: range.step,
				});
		}
		for (const contract of contracts) {
			const propertyId = row.propertyIds[contract.key];
			if (!propertyId) fail('Native controller property changed; repair its original local contract first.');
			const property = await manager.findOne(VirtualChannelPropertyEntity, {
				where: {
					id: propertyId,
					category: contract.category,
					channel: { category: contract.channel, device: { id: row.controllerId } },
				},
			});
			if (
				!property ||
				property.valueOrigin !== VirtualValueOrigin.LOCAL ||
				property.sourcePropertyId ||
				property.dataType !== contract.dataType
			)
				fail('Native controller property changed; repair its original local contract first.');
			await manager.update(
				VirtualChannelPropertyEntity,
				{ id: propertyId },
				{ format: contract.format, step: contract.step },
			);
		}
	}
	async update(id: string, dto: UpdateNativeThermostatDto) {
		await this.lock.runExclusive(async () => {
			const unit = await this.capture(dto.sourceDevice, this.database.manager, true);
			await this.graph.withStructuralWrite(async (manager) => {
				const row = await manager.findOneByOrFail(NativeThermostatEntity, { controllerId: id });
				if (row.revision !== dto.expectedRevision) fail('Native thermostat revision changed.');
				if (row.bindingState !== 'bound' || this.releaseOwners.has(id)) fail('Native binding is not bound.');
				await this.assertUnbound(manager, unit, id);
				if (
					!!row.propertyIds.heating_setpoint !== !!unit.capabilities.heating ||
					!!row.propertyIds.cooling_setpoint !== !!unit.capabilities.cooling
				)
					fail('Changed heating/cooling topology requires a new controller.');
				if (row.sourceDeviceId !== unit.deviceId || row.physicalIdentity !== unit.physicalIdentity)
					fail('Native binding identity is immutable; create another controller to use another physical unit.');
				registerSqliteCommitGuard(manager, () => unit.isCurrent() && !this.releaseOwners.has(id));
				await this.syncPropertyContracts(manager, row, unit);
				await manager.update(
					NativeThermostatEntity,
					{ controllerId: id, revision: row.revision },
					{
						revision: row.revision + 1,
						fingerprint: unit.fingerprint,
						ownedPropertyIds: [...unit.ownedPropertyIds],
					},
				);
				this.generations.set(id, (this.generations.get(id) ?? 0) + 1);
			});
			await this.reload();
		});
		return this.get(id);
	}
	async request(id: string, dto: RequestNativeThermostatDto) {
		// Preserve scalar intent and idempotency identity before the first queued/async boundary.
		dto = Object.freeze({
			requestId: dto.requestId,
			expectedRevision: dto.expectedRevision,
			mode: dto.mode,
			heatingSetpoint: dto.heatingSetpoint,
			coolingSetpoint: dto.coolingSetpoint,
		});
		const intent = JSON.stringify({
			mode: dto.mode,
			heatingSetpoint: dto.heatingSetpoint,
			coolingSetpoint: dto.coolingSetpoint,
		});
		const original = this.originalRequests.get(dto.requestId);
		if (original) {
			if (original.controller !== id || original.intent !== intent)
				fail('Request id was already used for another intent.');
			return original.result;
		}
		// Enrollment precedes the first await and lock queueing. Release joins this exact finite group.
		let settle!: () => void;
		const completion = new Promise<void>((resolve) => {
			settle = resolve;
		});
		const group = this.attempts.get(id) ?? new Set<Promise<void>>();
		this.attempts.set(id, group);
		group.add(completion);
		this.work.add(completion);
		const issued = (async () => {
			try {
				return await this.requestOwned(id, dto);
			} finally {
				settle();
				group.delete(completion);
				this.work.delete(completion);
				this.originalRequests.delete(dto.requestId);
				if (!group.size && this.attempts.get(id) === group) this.attempts.delete(id);
			}
		})();
		this.originalRequests.set(dto.requestId, { controller: id, intent, result: issued });
		return issued;
	}
	private async requestOwned(id: string, dto: RequestNativeThermostatDto): Promise<NativeThermostatModel | null> {
		if (!this.ready || this.destroyed) fail('Native runtime is not ready.');
		const pendingRelease = this.pendingReleaseAdmissions.get(id);
		if (pendingRelease !== undefined) {
			if (pendingRelease.isOriginalOwner?.()) fail('Native release admission is still being decided.');
			await pendingRelease.decision;
		}
		if (!this.ready || this.destroyed) fail('Native runtime is not ready.');
		if (this.releaseOwners.has(id)) fail('Native binding is not bound.');
		const request: NativeClimateRequest = Object.fromEntries(
			Object.entries({
				mode: dto.mode,
				heatingSetpoint: dto.heatingSetpoint,
				coolingSetpoint: dto.coolingSetpoint,
			}).filter(([, value]) => value !== undefined),
		);
		let execute: (() => Promise<void>) | undefined;
		let releaseAdmission: Promise<void> | undefined;
		await this.lock.runExclusive(async () => {
			// Give a pending release its CAS decision without holding structure or discarding this request.
			const pending = this.pendingReleaseAdmissions.get(id);
			if (pending?.isOriginalOwner?.()) fail('Native release admission is still being decided.');
			releaseAdmission = pending?.decision;
			if (releaseAdmission !== undefined) return;
			const previous = await this.database.manager.findOneBy(NativeThermostatRequestEntity, { id: dto.requestId });
			if (previous) {
				if (previous.controllerId !== id || JSON.stringify(previous.request) !== JSON.stringify(request))
					fail('Request id was already used for another intent.');
				return;
			}
			const row = await this.database.manager.findOneByOrFail(NativeThermostatEntity, { controllerId: id });
			if (row.bindingState !== 'bound' || this.releaseOwners.has(id)) fail('Native binding is not bound.');
			const owner = await this.database.manager.findOneBy(DeviceEntity, { id });
			if (!owner?.enabled) fail('Native controller is disabled or missing.');
			if (dto.expectedRevision !== row.revision) fail('Native thermostat revision changed.');
			const unit = await this.capture(row.sourceDeviceId);
			if (unit.fingerprint !== row.fingerprint || unit.physicalIdentity !== row.physicalIdentity)
				fail('Native binding changed; explicitly revalidate first.');
			const prepared = unit.prepare(request);
			if (!Object.keys(request).length || !prepared?.isCurrent())
				fail('Unsupported native climate request or combination.');
			const revision = row.revision + 1;
			const generation = (this.generations.get(id) ?? 0) + 1;
			await this.graph.withStructuralWrite(async (manager) => {
				registerSqliteCommitGuard(
					manager,
					() => unit.isCurrent() && prepared.isCurrent() && !this.releaseOwners.has(id) && this.ready,
				);
				await manager.insert(NativeThermostatRequestEntity, {
					id: dto.requestId,
					controllerId: id,
					revision,
					request,
					operations: [],
					state: 'pending',
					createdAt: new Date(),
				});
				await manager.update(
					NativeThermostatEntity,
					{ controllerId: id, revision: row.revision },
					{
						revision,
						requested: { ...row.requested, ...request },
						latestRequestId: dto.requestId,
					},
				);
			});
			this.generations.set(id, generation);
			await this.reload();
			const current = () =>
				this.ready &&
				!this.releaseOwners.has(id) &&
				this.generations.get(id) === generation &&
				unit.isCurrent() &&
				prepared.isCurrent();
			execute = async () => {
				const admitted = async () =>
					this.lock.runShared(async () => {
						const liveOwner = await this.database.manager.findOneBy(DeviceEntity, { id });
						const live = await this.database.manager.findOneBy(NativeThermostatEntity, { controllerId: id });
						return (
							!!liveOwner?.enabled &&
							live?.bindingState === 'bound' &&
							live.revision === revision &&
							live.latestRequestId === dto.requestId &&
							current()
						);
					});
				let operations: readonly NativeClimateOperationResult[];
				try {
					operations = (await admitted())
						? await prepared.dispatch(current)
						: [
								{
									operation: 'request',
									outcome: 'refused' as const,
									reason: 'request_superseded',
									confirmed: false as const,
								},
							];
				} catch {
					operations = [
						{ operation: 'request', outcome: 'unknown' as const, reason: 'transport_error', confirmed: false as const },
					];
				}
				await this.lock.runExclusive(() =>
					this.graph.withStructuralWrite(async (manager) => {
						await manager.update(
							NativeThermostatRequestEntity,
							{ id: dto.requestId, controllerId: id, revision, state: 'pending' },
							{ operations: [...operations], state: 'settled' },
						);
					}),
				);
			};
		});
		if (releaseAdmission !== undefined) {
			await releaseAdmission;
			return this.requestOwned(id, dto);
		}
		if (execute) {
			const issued = execute();
			this.work.add(issued);
			try {
				await issued;
			} finally {
				this.work.delete(issued);
			}
		}
		await this.refresh();
		return this.get(id);
	}
	async release(id: string, dto: ReleaseNativeThermostatDto) {
		if (this.destroyed || !this.ready) fail('Native runtime is stopped.');
		if (this.releaseOwners.has(id) || this.pendingReleaseAdmissions.has(id))
			fail('Native binding release is already in progress.');
		const expectedRevision = dto.expectedRevision;
		const token = Object.freeze({});
		let decide!: () => void;
		const admission = new Promise<void>((resolve) => {
			decide = resolve;
		});
		const pending: { decision: Promise<void>; isOriginalOwner?: () => boolean } = { decision: admission };
		this.pendingReleaseAdmissions.set(id, pending);
		const completeAdmission = () => {
			if (this.pendingReleaseAdmissions.get(id) === pending) this.pendingReleaseAdmissions.delete(id);
			decide();
		};
		const originalAttempts = [...(this.attempts.get(id) ?? [])];
		let settle!: () => void;
		const completion = new Promise<void>((resolve) => {
			settle = resolve;
		});
		this.work.add(completion);
		try {
			const revision = await this.lock.runExclusive(() => {
				pending.isOriginalOwner = this.lock.captureExclusiveOwner();
				return this.graph.withStructuralWrite(async (manager) => {
					try {
						const row = await manager.findOneByOrFail(NativeThermostatEntity, { controllerId: id });
						if (row.revision !== expectedRevision) fail('Native thermostat revision changed.');
						if (row.bindingState === 'released') return null;
						this.releaseOwners.set(id, token);
						const next = row.revision + 1;
						await manager.update(
							NativeThermostatEntity,
							{ controllerId: id, revision: row.revision, bindingState: row.bindingState },
							{ bindingState: 'releasing', revision: next },
						);
						return next;
					} finally {
						// No-op/refusal can settle before callbacks. An admitted mutation must keep external
						// requests waiting for COMMIT/rollback; original-writer callbacks still fail fast.
						if (this.releaseOwners.get(id) !== token) completeAdmission();
					}
				});
			});
			if (revision !== null) {
				this.generations.set(id, (this.generations.get(id) ?? 0) + 1);
				this.epoch++;
			}
			completeAdmission();
			// No structural or SQLite lock is held while original issued attempts drain.
			await Promise.allSettled(originalAttempts);
			if (revision !== null)
				await this.lock.runExclusive(async () => {
					await this.graph.withStructuralWrite(async (manager) => {
						const row = await manager.findOneByOrFail(NativeThermostatEntity, { controllerId: id });
						if (this.releaseOwners.get(id) !== token || row.revision !== revision || row.bindingState !== 'releasing')
							fail('Native binding release owner changed.');
						await manager.update(
							NativeThermostatEntity,
							{ controllerId: id, revision, bindingState: 'releasing' },
							{ bindingState: 'released', revision: revision + 1 },
						);
					});
					for (const propertyId of Object.values(
						this.reservations.find((row) => row.controllerId === id)?.propertyIds ?? {},
					)) {
						const lease = this.leases.get(propertyId);
						if (lease) this.producers.unregister(lease);
						this.leases.delete(propertyId);
					}
					await this.reload();
				});
			return this.get(id);
		} finally {
			if (this.releaseOwners.get(id) === token) this.releaseOwners.delete(id);
			completeAdmission();
			settle();
			this.work.delete(completion);
		}
	}
	async isRegisteredSetting(property: VirtualChannelPropertyEntity, manager: EntityManager) {
		if (property.valueOrigin !== VirtualValueOrigin.LOCAL || property.sourcePropertyId) return false;
		return (await manager.find(NativeThermostatEntity)).some((row) =>
			['mode', 'heating_setpoint', 'cooling_setpoint', 'heating_enabled', 'cooling_enabled'].some(
				(key) => row.propertyIds[key] === property.id,
			),
		);
	}
	async ownsController(id: string) {
		return this.database.manager.existsBy(NativeThermostatEntity, { controllerId: id });
	}
	async command(updates: readonly IDevicePropertyData[]) {
		return this.commandSettings(
			updates.map((entry) => ({ deviceId: entry.device.id, propertyId: entry.property.id, value: entry.value })),
		);
	}
	async commandSettings(
		input: readonly Readonly<{ deviceId: string; propertyId: string; value: IDevicePropertyData['value'] }>[],
	) {
		const updates = input.map((entry) =>
			Object.freeze({ deviceId: entry.deviceId, propertyId: entry.propertyId, value: entry.value }),
		);
		if (!updates.length) return true;
		const id = updates[0].deviceId;
		const row = await this.database.manager.findOneBy(NativeThermostatEntity, { controllerId: id });
		if (
			!row ||
			row.bindingState !== 'bound' ||
			this.releaseOwners.has(id) ||
			updates.some((entry) => entry.deviceId !== id)
		)
			return false;
		const request = new RequestNativeThermostatDto();
		request.requestId = uuid();
		request.expectedRevision = row.revision;
		const seen = new Set<string>();
		let modeControl = false;
		for (const update of updates) {
			const key = Object.keys(row.propertyIds).find((key) => row.propertyIds[key] === update.propertyId);
			if (!key || seen.has(key)) return false;
			seen.add(key);
			if (key === 'mode') {
				if (modeControl) return false;
				modeControl = true;
				request.mode = update.value as RequestNativeThermostatDto['mode'];
			} else if (key === 'heating_enabled' || key === 'cooling_enabled') {
				if (typeof update.value !== 'boolean' || modeControl) return false;
				modeControl = true;
				const branch = key === 'heating_enabled' ? 'heat' : 'cool';
				const opposite = branch === 'heat' ? 'cool' : 'heat';
				if (update.value) request.mode = branch;
				else if (row.requested.mode === opposite) continue;
				else request.mode = row.requested.mode === 'auto' ? opposite : 'off';
			} else if (key === 'heating_setpoint') request.heatingSetpoint = update.value as number;
			else if (key === 'cooling_setpoint') request.coolingSetpoint = update.value as number;
			else return false;
		}
		if (request.mode === undefined && request.heatingSetpoint === undefined && request.coolingSetpoint === undefined)
			return true;
		try {
			await this.request(id, request);
			const original = await this.database.manager.findOneBy(NativeThermostatRequestEntity, { id: request.requestId });
			return (
				original?.state === 'settled' &&
				original.operations.length > 0 &&
				original.operations.every((operation) => operation.outcome === 'accepted')
			);
		} catch (error) {
			if (error instanceof DevicesValidationException) return false;
			throw error;
		}
	}
	private async refresh() {
		const issued = this.refreshOwned();
		this.work.add(issued);
		try {
			await issued;
		} finally {
			this.work.delete(issued);
		}
	}
	private async refreshOwned() {
		if (!this.ready || this.refreshing) return;
		this.refreshing = true;
		try {
			await this.lock.runShared(async () => {
				for (const row of this.reservations) {
					if (row.bindingState !== 'bound' || this.releaseOwners.has(row.controllerId)) continue;
					const generation = this.generations.get(row.controllerId) ?? 0;
					let unit: NativeClimateUnit | null = null;
					try {
						unit = await this.capture(row.sourceDeviceId);
					} catch {
						/* unavailable feedback */
					}
					const owner = await this.database.manager.findOneBy(DeviceEntity, { id: row.controllerId });
					const observed = unit?.observe() ?? {
						available: false,
						temperature: null,
						mode: null,
						heatingSetpoint: null,
						coolingSetpoint: null,
						activity: null,
						observedAt: null,
						reasons: ['native_source_unavailable'],
						isCurrent: () => false,
					};
					const feedbackCurrent = () =>
						this.ready &&
						!!owner?.enabled &&
						!!unit?.isCurrent() &&
						observed?.isCurrent?.() === true &&
						unit.fingerprint === row.fingerprint &&
						unit.physicalIdentity === row.physicalIdentity &&
						(this.generations.get(row.controllerId) ?? 0) === generation;
					for (const [key, propertyId] of Object.entries(row.propertyIds)) {
						const property = await this.database.manager.findOneBy(VirtualChannelPropertyEntity, {
							id: propertyId,
							channel: { device: { id: row.controllerId } },
							valueOrigin: VirtualValueOrigin.LOCAL,
						});
						if (!property || property.sourcePropertyId) {
							const previous = this.leases.get(propertyId);
							if (previous) this.producers.unregister(previous);
							this.leases.delete(propertyId);
							this.observations.delete(propertyId);
							this.requestedPublications.delete(propertyId);
							continue;
						}
						if (key === 'mode' || key === 'locked' || key.endsWith('_setpoint') || key.endsWith('_enabled')) {
							const field =
								key === 'mode' ? 'mode' : key === 'heating_setpoint' ? 'heatingSetpoint' : 'coolingSetpoint';
							const value =
								key === 'locked'
									? false
									: key.endsWith('_enabled')
										? row.requested.mode === undefined
											? undefined
											: row.requested.mode === (key === 'heating_enabled' ? 'heat' : 'cool') ||
												row.requested.mode === 'auto'
										: row.requested[field];
							if (
								value !== undefined &&
								this.ready &&
								!!owner?.enabled &&
								!this.releaseOwners.has(row.controllerId) &&
								(this.generations.get(row.controllerId) ?? 0) === generation &&
								this.requestedPublications.get(propertyId) !== row.revision
							) {
								let written = false;
								try {
									written = await this.values.write(property, value);
								} catch {
									/* A local mirror failure must not starve other properties or retry physical transport. */
								}
								if (
									written &&
									this.ready &&
									!this.releaseOwners.has(row.controllerId) &&
									(this.generations.get(row.controllerId) ?? 0) === generation
								)
									this.requestedPublications.set(propertyId, row.revision);
							}
							continue;
						}
						let lease = this.leases.get(propertyId);
						if (!lease || lease.revision !== row.revision || !this.producers.isAvailable(lease)) {
							lease = this.producers.register(property, row.revision, {
								isCurrent: feedbackCurrent,
								reason: 'native_feedback_expired',
							});
							this.leases.set(propertyId, lease);
						}
						const value =
							key === 'temperature'
								? observed.temperature
								: observed.activity === null
									? null
									: observed.activity === (key === 'heating_activity' ? 'heating' : 'cooling');
						if (!feedbackCurrent() || !observed.available || !observed.observedAt || value === null) {
							this.producers.invalidate(
								lease,
								observed.reasons.length ? [...observed.reasons] : ['native_feedback_unavailable'],
							);
							continue;
						}
						const sampledAt = new Date(observed.observedAt);
						const observationKey = JSON.stringify([row.revision, observed.observedAt, value]);
						if (this.observations.get(propertyId) === observationKey && this.producers.isAvailable(lease)) continue;
						const publication = await this.values.publishDerived(property, lease, value, {
							quality: 'good',
							reasons: [],
							sampledAt,
							evaluatedAt: new Date(),
							expiresAt: new Date(sampledAt.getTime() + 30_000),
						});
						if (publication.state) this.observations.set(propertyId, observationKey);
					}
				}
			});
		} finally {
			this.refreshing = false;
		}
	}
}
