import { plainToInstance } from 'class-transformer';
import { DataSource, EntityManager, FindOptionsWhere, In, Not } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, EventType } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceCreationContext } from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import {
	DeviceDataInput,
	DeviceValidationService,
	ValidationIssue,
} from '../../../modules/devices/services/device-validation.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { getPropertyMetadata } from '../../../modules/devices/utils/schema.utils';
import {
	DEVICES_MODBUS_PLUGIN_NAME,
	DEVICES_MODBUS_TYPE,
	MODBUS_DEFAULTS,
	ModbusBindingRole,
} from '../devices-modbus.constants';
import { ModbusValidationException } from '../devices-modbus.exceptions';
import { ModbusBindingDto } from '../dto/binding.dto';
import {
	CreateModbusDeviceStructureChannelDto,
	CreateModbusDeviceStructureDto,
	CreateModbusDeviceStructurePropertyDto,
} from '../dto/create-device-structure.dto';
import { CreateModbusDeviceDto } from '../dto/create-device.dto';
import { UpdateModbusDeviceStructureDto } from '../dto/update-device-structure.dto';
import {
	ModbusChannelEntity,
	ModbusChannelPropertyEntity,
	ModbusDeviceEntity,
} from '../entities/devices-modbus.entity';
import { ModbusBindingEntity } from '../entities/modbus-binding.entity';
import { ModbusEndpointEntity } from '../entities/modbus-endpoint.entity';
import {
	ModbusStructureIssue,
	readLimitIssue,
	validateModbusStructure,
	withDeviceInformation,
} from '../lib/structure-validation';

import { ModbusEndpointsService } from './modbus-endpoints.service';
import { ModbusRuntimeService } from './modbus-runtime.service';
import { ModbusTemplatesService } from './modbus-templates.service';

type StaticValue = { propertyId: string; value: string | number | boolean };

/** Rows a points update created or changed, announced with the core events after COMMIT. */
type PointChanges = {
	createdChannels: string[];
	updatedChannels: string[];
	createdProperties: string[];
	updatedProperties: string[];
};

/** Specification-check ID of the device_information channel a points update keeps; it is not part of the request. */
const KEPT_INFORMATION = 'kept-device-information';

const changed = (current: object, fields: object): boolean =>
	Object.entries(fields).some(
		([key, value]) =>
			JSON.stringify((current as Record<string, unknown>)[key] ?? null) !== JSON.stringify(value ?? null),
	);

const isUnitCollision = (error: unknown): boolean => {
	const message = `${error instanceof Error ? error.message : ''} ${
		(error as { driverError?: { message?: string } })?.driverError?.message ?? ''
	}`;

	return message.includes('UNIQUE constraint failed') && message.includes('modbusUnitId');
};

/**
 * Creates a Modbus device with its channels, properties and register bindings as one unit: the request is validated
 * completely before anything is written, and every row is written in one transaction through the core device
 * creation context, so a failure leaves nothing behind.
 */
@Injectable()
export class ModbusDeviceStructureService {
	private readonly logger = createExtensionLogger(DEVICES_MODBUS_PLUGIN_NAME, 'ModbusDeviceStructureService');

	constructor(
		private readonly dataSource: DataSource,
		private readonly lock: DeviceStructureLockService,
		private readonly devicesService: DevicesService,
		private readonly deviceValidation: DeviceValidationService,
		private readonly endpoints: ModbusEndpointsService,
		private readonly runtime: ModbusRuntimeService,
		private readonly propertyValues: PropertyValueService,
		private readonly templates: ModbusTemplatesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async create(dto: CreateModbusDeviceStructureDto): Promise<ModbusDeviceEntity> {
		return this.lock.runExclusive(async () => {
			const endpoint = await this.endpoints.findOne(dto.endpoint_id);
			const structure = withDeviceInformation(
				dto,
				endpoint ? `${endpoint.host}:${endpoint.port}#${dto.unit_id}` : `#${dto.unit_id}`,
			);
			const issues = [
				...this.validateCategory(dto.category),
				...validateModbusStructure(structure, (input) => this.validateSpecification(input, null)),
				...this.validateProvenance(dto),
				...(await this.validateAgainstDatabase(structure, endpoint)),
			];

			if (issues.length > 0) {
				throw new ModbusValidationException(issues.map((issue) => JSON.stringify(issue)));
			}

			const deviceId = dto.id ?? uuid();
			const statics: StaticValue[] = [];

			try {
				await DeviceCreationContext.run(
					(work) => this.dataSource.transaction(work),
					DEVICES_MODBUS_TYPE,
					async (context) => {
						await this.devicesService.create(this.toDeviceDto(dto, deviceId), context);

						for (const channel of structure.channels) {
							await this.insertChannel(context.manager, deviceId, channel, statics);
						}

						return deviceId;
					},
					() => this.activate(deviceId, statics),
				);
			} catch (error) {
				if (isUnitCollision(error)) {
					throw this.unitInUse(dto.unit_id);
				}

				throw error;
			}

			return (await this.devicesService.getOneOrThrow(deviceId)) as ModbusDeviceEntity;
		});
	}

	/**
	 * Replaces the points of a Modbus device. Channels and properties sent with an `id` are updated in place and keep
	 * it, so virtual devices, tiles and history that refer to them keep working; channels of the device that are not
	 * listed are removed, and every register binding is replaced by the ones in the request. The device_information
	 * channel, name, room, endpoint, unit and template provenance are left as they are.
	 *
	 * The request is validated completely before the first write, and all writes share one transaction under the
	 * structure lock. Removals go through the core services, which take the transaction's manager and run the core
	 * cleanup; updates and inserts are written with that manager directly, as `create()` writes, and are announced with
	 * the core events after COMMIT. The runtime then reloads the device, which is what makes the new bindings poll.
	 */
	async update(id: string, body: UpdateModbusDeviceStructureDto): Promise<ModbusDeviceEntity> {
		// An explicit `null` id means "no id", as an omitted one does (create reads `id ?? uuid()` the same way).
		const dto: UpdateModbusDeviceStructureDto = {
			...body,
			channels: body.channels.map((channel) => ({
				...channel,
				id: channel.id ?? undefined,
				properties: channel.properties.map((property) => ({ ...property, id: property.id ?? undefined })),
			})),
		};

		return this.lock.runExclusive(async () => {
			const device = await this.devicesService.findOne<ModbusDeviceEntity>(id, DEVICES_MODBUS_TYPE);

			if (!device) {
				throw new NotFoundException('Requested Modbus device does not exist');
			}

			const existing = await this.dataSource
				.getRepository(ChannelEntity)
				.find({ where: { device: { id } }, relations: { properties: true } });
			const information = existing.find((channel) => channel.category === ChannelCategory.DEVICE_INFORMATION) ?? null;
			const endpoint = device.endpointId ? await this.endpoints.findOne(device.endpointId) : null;
			// The request judged as a whole device, with the fields this endpoint does not change taken from the row.
			const requested = Object.assign(new CreateModbusDeviceStructureDto(), {
				id: device.id,
				name: device.name,
				category: dto.category,
				endpoint_id: device.endpointId,
				unit_id: device.unitId,
				max_read_registers: device.maxReadRegisters ?? undefined,
				channels: dto.channels,
			});

			// A device that lost its device_information channel gets the default one back, as on create.
			const structure = information
				? requested
				: withDeviceInformation(
						requested,
						endpoint ? `${endpoint.host}:${endpoint.port}#${device.unitId}` : `#${device.unitId}`,
					);
			const issues = [
				...this.validateCategory(dto.category),
				...this.validateOwnership(dto, existing, information),
				...validateModbusStructure(structure, (input) => this.validateSpecification(input, information)),
				...(await this.validateAgainstDatabase(structure, endpoint, device)),
			];

			if (issues.length > 0) {
				throw new ModbusValidationException(issues.map((issue) => JSON.stringify(issue)));
			}

			// As the core property update does before stored fields change: queued history of the old data types and
			// categories is written first, so it cannot land after the remapping. The runtime keeps polling the old
			// bindings until the reload below, which is why this runs on every update rather than only on changed rows.
			await this.propertyValues.flushHistory();

			const statics: StaticValue[] = [];
			const changes = await this.dataSource.transaction((manager) =>
				this.replacePoints(manager, device.id, dto, structure.channels, existing, statics),
			);

			await this.publishPointChanges(changes);

			// Announced before the reload below: the runtime's own reload on this event is superseded by it.
			this.eventEmitter.emit(EventType.DEVICE_UPDATED, await this.devicesService.getOneOrThrow(device.id));

			await this.activate(device.id, statics);

			return (await this.devicesService.getOneOrThrow(device.id)) as ModbusDeviceEntity;
		});
	}

	/**
	 * `beforeUpdate` hook of the Modbus device type mapping: judges a core `PATCH /devices/:id` on the merged row before
	 * it is written. Only fields the PATCH changed are judged, so a device can always be renamed. It runs under the
	 * core's structure lock, which `create()` takes as well, so the endpoint and unit check cannot race a creation.
	 */
	async validateUpdate(device: ModbusDeviceEntity, previous: Readonly<Partial<ModbusDeviceEntity>>): Promise<void> {
		const issues: ModbusStructureIssue[] = [];

		if (device.endpointId !== previous.endpointId || device.unitId !== previous.unitId) {
			const endpoint = device.endpointId ? await this.endpoints.findOne(device.endpointId) : null;

			if (!endpoint) {
				issues.push({ field: 'endpoint_id', reason: 'Endpoint does not exist.' });
			} else {
				const existing = await this.dataSource.getRepository(ModbusDeviceEntity).findOne({
					where: {
						id: Not(device.id),
						endpointId: device.endpointId,
						unitId: device.unitId,
					} as FindOptionsWhere<ModbusDeviceEntity>,
				});

				if (existing) {
					issues.push(this.unitTaken(device.unitId, existing));
				}
			}
		}

		if (device.maxReadRegisters !== previous.maxReadRegisters) {
			const reads = await this.dataSource
				.getRepository(ModbusBindingEntity)
				.find({ where: { deviceId: device.id, role: ModbusBindingRole.READ } });
			const issue = readLimitIssue(
				device.maxReadRegisters ?? MODBUS_DEFAULTS.MAX_READ_REGISTERS,
				reads.map((binding) => ({ registerType: binding.registerType, dataType: binding.dataType })),
			);

			if (issue) {
				issues.push(issue);
			}
		}

		if (issues.length > 0) {
			throw new ModbusValidationException(issues.map((issue) => JSON.stringify(issue)));
		}
	}

	private toDeviceDto(dto: CreateModbusDeviceStructureDto, deviceId: string): CreateModbusDeviceDto {
		const fields: Record<string, unknown> = {
			id: deviceId,
			type: DEVICES_MODBUS_TYPE,
			name: dto.name,
			category: dto.category,
			room_id: dto.room_id,
			endpoint_id: dto.endpoint_id,
			unit_id: dto.unit_id,
			poll_interval_ms: dto.poll_interval_ms,
			byte_order: dto.byte_order,
			word_order: dto.word_order,
			max_read_registers: dto.max_read_registers,
			max_read_bits: dto.max_read_bits,
			max_read_gap: dto.max_read_gap,
			template_id: dto.template_id,
			template_revision: dto.template_revision,
		};

		return plainToInstance(
			CreateModbusDeviceDto,
			Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== null)),
		);
	}

	private async insertChannel(
		manager: EntityManager,
		deviceId: string,
		dto: CreateModbusDeviceStructureChannelDto,
		statics: StaticValue[],
	): Promise<string> {
		const channelId = dto.id ?? uuid();

		await manager.insert(
			ModbusChannelEntity,
			manager.create(ModbusChannelEntity, {
				id: channelId,
				device: deviceId,
				identifier: dto.identifier ?? null,
				name: dto.name,
				category: dto.category,
			}),
		);

		for (const property of dto.properties) {
			await this.insertProperty(manager, deviceId, channelId, dto.category, property, statics);
		}

		return channelId;
	}

	private async insertProperty(
		manager: EntityManager,
		deviceId: string,
		channelId: string,
		channelCategory: ChannelCategory,
		dto: CreateModbusDeviceStructurePropertyDto,
		statics: StaticValue[],
	): Promise<string> {
		const propertyId = dto.id ?? uuid();

		await manager.insert(
			ModbusChannelPropertyEntity,
			manager.create(ModbusChannelPropertyEntity, {
				id: propertyId,
				channel: channelId,
				...this.propertyFields(channelCategory, dto),
				unit: dto.unit ?? this.specDefaults(channelCategory, dto)?.unit ?? null,
			}),
		);

		await this.insertBindings(manager, deviceId, propertyId, dto, statics);

		return propertyId;
	}

	/** The specification's metadata of a property, when the property keeps the specified data type. */
	private specDefaults(channelCategory: ChannelCategory, dto: CreateModbusDeviceStructurePropertyDto) {
		const metadata = getPropertyMetadata(channelCategory, dto.category);

		return metadata?.data_type === dto.data_type ? metadata : null;
	}

	/** The stored columns of a property; format and step default to the specification for its data type. */
	private propertyFields(channelCategory: ChannelCategory, dto: CreateModbusDeviceStructurePropertyDto) {
		const specDefaults = this.specDefaults(channelCategory, dto);

		return {
			identifier: dto.identifier ?? null,
			name: dto.name ?? null,
			category: dto.category,
			permissions: dto.permissions,
			dataType: dto.data_type,
			format: dto.format ?? specDefaults?.format ?? null,
			step: specDefaults?.step ?? null,
		};
	}

	/** Stores the property's bindings, and queues its static value for after COMMIT. */
	private async insertBindings(
		manager: EntityManager,
		deviceId: string,
		propertyId: string,
		dto: CreateModbusDeviceStructurePropertyDto,
		statics: StaticValue[],
	): Promise<void> {
		if (dto.static_value !== undefined && dto.static_value !== null) {
			statics.push({ propertyId, value: dto.static_value });
		}

		for (const [role, binding] of [
			[ModbusBindingRole.READ, dto.read],
			[ModbusBindingRole.WRITE, dto.write],
		] as const) {
			if (binding) {
				await manager.insert(ModbusBindingEntity, this.toBinding(manager, deviceId, propertyId, role, binding));
			}
		}
	}

	/** The write phase of `update()`; everything it is given has been validated. */
	private async replacePoints(
		manager: EntityManager,
		deviceId: string,
		dto: UpdateModbusDeviceStructureDto,
		channels: CreateModbusDeviceStructureChannelDto[],
		existing: ChannelEntity[],
		statics: StaticValue[],
	): Promise<PointChanges> {
		const changes: PointChanges = {
			createdChannels: [],
			updatedChannels: [],
			createdProperties: [],
			updatedProperties: [],
		};
		const listed = new Map(
			channels.filter((channel) => channel.id !== undefined).map((channel) => [channel.id, channel] as const),
		);
		const kept = existing.filter((channel) => listed.has(channel.id));

		await manager.delete(ModbusBindingEntity, { deviceId });

		for (const channel of existing) {
			if (channel.category !== ChannelCategory.DEVICE_INFORMATION && !listed.has(channel.id)) {
				await this.channelsService.remove(channel.id, manager);
			}
		}

		for (const channel of kept) {
			const ids = new Set(listed.get(channel.id).properties.map((property) => property.id));

			for (const property of channel.properties) {
				if (!ids.has(property.id)) {
					await this.channelsPropertiesService.remove(property.id, manager);
				}
			}
		}

		// Identifiers are unique per device and per channel: release the ones that change first, so kept rows can swap.
		for (const channel of kept) {
			const request = listed.get(channel.id);

			if (channel.identifier !== null && channel.identifier !== (request.identifier ?? null)) {
				await manager.update(ChannelEntity, { id: channel.id }, { identifier: null });
			}

			for (const property of channel.properties) {
				const next = request.properties.find((candidate) => candidate.id === property.id);

				if (next && property.identifier !== null && property.identifier !== (next.identifier ?? null)) {
					await manager.update(ChannelPropertyEntity, { id: property.id }, { identifier: null });
				}
			}
		}

		for (const channel of channels) {
			const current = kept.find((candidate) => candidate.id === channel.id);

			if (!current) {
				changes.createdChannels.push(await this.insertChannel(manager, deviceId, channel, statics));

				continue;
			}

			const fields = { identifier: channel.identifier ?? null, name: channel.name };

			await manager.update(ChannelEntity, { id: current.id }, fields);

			if (changed(current, fields)) {
				changes.updatedChannels.push(current.id);
			}

			for (const property of channel.properties) {
				const previous = current.properties.find((candidate) => candidate.id === property.id);

				if (!previous) {
					changes.createdProperties.push(
						await this.insertProperty(manager, deviceId, current.id, channel.category, property, statics),
					);

					continue;
				}

				const propertyFields = this.propertyFields(channel.category, property);

				await manager.update(ChannelPropertyEntity, { id: previous.id }, propertyFields);
				await this.insertBindings(manager, deviceId, previous.id, property, statics);

				if (changed(previous, propertyFields)) {
					changes.updatedProperties.push(previous.id);
				}
			}
		}

		const deviceFields = Object.fromEntries(
			Object.entries({
				category: dto.category,
				pollIntervalMs: dto.poll_interval_ms,
				byteOrder: dto.byte_order,
				wordOrder: dto.word_order,
			}).filter(([, value]) => value !== undefined && value !== null),
		);

		await manager.update(ModbusDeviceEntity, { id: deviceId }, deviceFields);

		return changes;
	}

	/** The core events a channel or property write announces, sent once the points update has committed. */
	private async publishPointChanges(changes: PointChanges): Promise<void> {
		for (const id of changes.createdChannels) {
			this.eventEmitter.emit(EventType.CHANNEL_CREATED, await this.channelsService.getOneOrThrow(id));
		}

		for (const id of changes.updatedChannels) {
			this.eventEmitter.emit(EventType.CHANNEL_UPDATED, await this.channelsService.getOneOrThrow(id));
		}

		for (const id of changes.createdProperties) {
			this.eventEmitter.emit(
				EventType.CHANNEL_PROPERTY_CREATED,
				await this.channelsPropertiesService.getOneOrThrow(id),
			);
		}

		for (const id of changes.updatedProperties) {
			this.eventEmitter.emit(
				EventType.CHANNEL_PROPERTY_UPDATED,
				await this.channelsPropertiesService.getOneOrThrow(id),
			);
		}
	}

	private toBinding(
		manager: EntityManager,
		deviceId: string,
		propertyId: string,
		role: ModbusBindingRole,
		dto: ModbusBindingDto,
	): ModbusBindingEntity {
		return manager.create(ModbusBindingEntity, {
			id: uuid(),
			propertyId,
			deviceId,
			role,
			registerType: dto.register_type,
			address: dto.address,
			dataType: dto.data_type,
			bit: dto.bit ?? null,
			byteOrder: dto.byte_order ?? null,
			wordOrder: dto.word_order ?? null,
			scale: dto.scale ?? 1,
			offset: dto.offset ?? 0,
			invert: dto.invert ?? false,
			valueMap: dto.value_map ? dto.value_map.map(({ raw, value }) => ({ raw, value })) : null,
			writeFunction: dto.write_function ?? null,
			pollIntervalMs: dto.poll_interval_ms ?? null,
			longPressMs: dto.long_press_ms ?? null,
		});
	}

	/**
	 * Runs after COMMIT. The device exists at this point, so neither a static value write nor a runtime failure may
	 * turn the request into an error: both are logged, and the runtime loads the device again on its next start.
	 */
	private async activate(deviceId: string, statics: StaticValue[]): Promise<void> {
		if (statics.length > 0) {
			try {
				const properties = await this.dataSource
					.getRepository(ChannelPropertyEntity)
					.find({ where: { id: In(statics.map((entry) => entry.propertyId)) } });

				for (const entry of statics) {
					const property = properties.find((candidate) => candidate.id === entry.propertyId);

					if (property) {
						await this.propertyValues.write(property, entry.value);
					}
				}
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Failed to store static property values for device id=${deviceId}`, {
					message: err.message,
					stack: err.stack,
				});
			}
		}

		try {
			await this.runtime.loadDevice(deviceId);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Device id=${deviceId} was stored but the runtime failed to load it`, {
				message: err.message,
				stack: err.stack,
			});
		}
	}

	/** `generic` is a reserved device category; a Modbus device always names what it is (plan ruling R7). */
	private validateCategory(category: DeviceCategory): ModbusStructureIssue[] {
		return category === DeviceCategory.GENERIC
			? [{ field: 'category', reason: 'The generic category is reserved and cannot be used for Modbus devices.' }]
			: [];
	}

	/**
	 * R5 rules of a points update: every ID must belong to this device (a property ID to the channel it is sent in), a
	 * kept channel keeps its category, and the device_information channel is never part of the request.
	 */
	private validateOwnership(
		dto: UpdateModbusDeviceStructureDto,
		existing: ChannelEntity[],
		information: ChannelEntity | null,
	): ModbusStructureIssue[] {
		const issues: ModbusStructureIssue[] = [];

		dto.channels.forEach((channel, index) => {
			const field = `channels[${index}]`;
			const current = channel.id === undefined ? null : (existing.find((row) => row.id === channel.id) ?? null);

			if (channel.category === ChannelCategory.DEVICE_INFORMATION) {
				issues.push({
					field: `${field}.category`,
					reason: 'The device_information channel is kept by the device and cannot be sent.',
				});
			} else if (current && current.category !== channel.category) {
				issues.push({ field: `${field}.category`, reason: 'The category of an existing channel cannot change.' });
			}

			if (channel.id !== undefined && !current) {
				issues.push({ field: `${field}.id`, reason: `Channel ${channel.id} does not belong to this device.` });
			}

			if (information?.identifier && channel.identifier === information.identifier) {
				issues.push({ field: `${field}.identifier`, reason: 'Channel identifiers must be unique.' });
			}

			channel.properties.forEach((property, propertyIndex) => {
				if (property.id !== undefined && !current?.properties.some((row) => row.id === property.id)) {
					issues.push({
						field: `${field}.properties[${propertyIndex}].id`,
						reason: `Property ${property.id} does not belong to this channel.`,
					});
				}
			});
		});

		return issues;
	}

	/**
	 * The core device specification check. A points update judges the request together with the device_information
	 * channel the device keeps; issues of that channel are reported on `channels`, as it has no index in the request.
	 */
	private validateSpecification(input: DeviceDataInput, information: ChannelEntity | null): ValidationIssue[] {
		if (!information) {
			return this.deviceValidation.validateDeviceStructure(input).issues;
		}

		const kept = {
			id: KEPT_INFORMATION,
			category: information.category,
			properties: information.properties.map((property) => ({
				category: property.category,
				dataType: property.dataType,
				permissions: property.permissions,
			})),
		};

		return this.deviceValidation
			.validateDeviceStructure({ ...input, channels: [...(input.channels ?? []), kept] })
			.issues.map((issue) => (issue.channelId === KEPT_INFORMATION ? { ...issue, channelId: undefined } : issue));
	}

	/** The revision is required but not compared: a reload between preview and create is legitimate. */
	private validateProvenance(dto: CreateModbusDeviceStructureDto): ModbusStructureIssue[] {
		if (typeof dto.template_id !== 'string') {
			return [];
		}

		const issues: ModbusStructureIssue[] = [];

		if (typeof dto.template_revision !== 'string') {
			issues.push({ field: 'template_revision', reason: 'is required when template_id is set.' });
		}

		if (!this.templates.has(dto.template_id)) {
			issues.push({ field: 'template_id', reason: `Template ${dto.template_id} is not loaded.` });
		}

		return issues;
	}

	private unitInUse(unitId: number): ModbusValidationException {
		return new ModbusValidationException([
			JSON.stringify({
				field: 'unit_id',
				reason: `Unit ${unitId} is already used by another device on this endpoint.`,
			}),
		]);
	}

	private unitTaken(unitId: number | null, existing: ModbusDeviceEntity): ModbusStructureIssue {
		return {
			field: 'unit_id',
			reason: `Unit ${unitId} is already used by device "${existing.name}" on this endpoint.`,
		};
	}

	/**
	 * `current` is the device a points update changes: it does not collide with its own endpoint and unit, and the IDs
	 * of its rows are judged by `validateOwnership` instead of being refused as taken.
	 */
	private async validateAgainstDatabase(
		dto: CreateModbusDeviceStructureDto,
		endpoint: ModbusEndpointEntity | null,
		current?: ModbusDeviceEntity,
	): Promise<ModbusStructureIssue[]> {
		const issues: ModbusStructureIssue[] = [];

		if (!endpoint) {
			issues.push({ field: 'endpoint_id', reason: 'Endpoint does not exist.' });
		} else {
			const existing = await this.dataSource.getRepository(ModbusDeviceEntity).findOne({
				where: {
					...(current ? { id: Not(current.id) } : {}),
					endpointId: dto.endpoint_id,
					unitId: dto.unit_id,
				} as FindOptionsWhere<ModbusDeviceEntity>,
			});

			if (existing) {
				issues.push(this.unitTaken(dto.unit_id, existing));
			}
		}

		if (current) {
			return issues;
		}

		const channelIds = dto.channels.map((channel, index) => ({ id: channel.id, field: `channels[${index}].id` }));
		const propertyIds = dto.channels.flatMap((channel, index) =>
			channel.properties.map((property, propertyIndex) => ({
				id: property.id,
				field: `channels[${index}].properties[${propertyIndex}].id`,
			})),
		);

		for (const [entity, ids] of [
			[ChannelEntity, channelIds],
			[ChannelPropertyEntity, propertyIds],
		] as const) {
			const supplied = ids.filter((entry): entry is { id: string; field: string } => typeof entry.id === 'string');

			if (supplied.length === 0) {
				continue;
			}

			const taken = await this.dataSource
				.getRepository<ChannelEntity | ChannelPropertyEntity>(entity)
				.find({ select: { id: true }, where: { id: In(supplied.map((entry) => entry.id)) } });

			for (const entry of supplied) {
				if (taken.some((row) => row.id === entry.id)) {
					issues.push({ field: entry.field, reason: `ID ${entry.id} is already in use.` });
				}
			}
		}

		return issues;
	}
}
