import { plainToInstance } from 'class-transformer';
import { DataSource, EntityManager, FindOptionsWhere, In, Not } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceCreationContext } from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
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
} from '../dto/create-device-structure.dto';
import { CreateModbusDeviceDto } from '../dto/create-device.dto';
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

type StaticValue = { propertyId: string; value: string | number | boolean };

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
	) {}

	async create(dto: CreateModbusDeviceStructureDto): Promise<ModbusDeviceEntity> {
		return this.lock.runExclusive(async () => {
			const endpoint = await this.endpoints.findOne(dto.endpoint_id);
			const structure = withDeviceInformation(
				dto,
				endpoint ? `${endpoint.host}:${endpoint.port}#${dto.unit_id}` : `#${dto.unit_id}`,
			);
			const issues = [
				...validateModbusStructure(structure, (input) => this.deviceValidation.validateDeviceStructure(input).issues),
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
	): Promise<void> {
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
			const propertyId = property.id ?? uuid();
			const metadata = getPropertyMetadata(dto.category, property.category);
			const specDefaults = metadata?.data_type === property.data_type ? metadata : null;

			await manager.insert(
				ModbusChannelPropertyEntity,
				manager.create(ModbusChannelPropertyEntity, {
					id: propertyId,
					channel: channelId,
					identifier: property.identifier ?? null,
					name: property.name ?? null,
					category: property.category,
					permissions: property.permissions,
					dataType: property.data_type,
					unit: property.unit ?? specDefaults?.unit ?? null,
					format: property.format ?? specDefaults?.format ?? null,
					step: specDefaults?.step ?? null,
				}),
			);

			if (property.static_value !== undefined && property.static_value !== null) {
				statics.push({ propertyId, value: property.static_value });
			}

			for (const [role, binding] of [
				[ModbusBindingRole.READ, property.read],
				[ModbusBindingRole.WRITE, property.write],
			] as const) {
				if (binding) {
					await manager.insert(ModbusBindingEntity, this.toBinding(manager, deviceId, propertyId, role, binding));
				}
			}
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

			this.logger.error(`Device id=${deviceId} was created but the runtime failed to load it`, {
				message: err.message,
				stack: err.stack,
			});
		}
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

	private async validateAgainstDatabase(
		dto: CreateModbusDeviceStructureDto,
		endpoint: ModbusEndpointEntity | null,
	): Promise<ModbusStructureIssue[]> {
		const issues: ModbusStructureIssue[] = [];

		if (!endpoint) {
			issues.push({ field: 'endpoint_id', reason: 'Endpoint does not exist.' });
		} else {
			const existing = await this.dataSource.getRepository(ModbusDeviceEntity).findOne({
				where: { endpointId: dto.endpoint_id, unitId: dto.unit_id } as FindOptionsWhere<ModbusDeviceEntity>,
			});

			if (existing) {
				issues.push(this.unitTaken(dto.unit_id, existing));
			}
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
