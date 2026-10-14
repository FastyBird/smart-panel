import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, EntityManager } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceCreationContext } from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { buildDeviceGraphQuery } from '../../../modules/devices/utils/device-graph-query.utils';
import { getPropertyMetadata, getRequiredProperties } from '../../../modules/devices/utils/schema.utils';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceType, isFloorZoneCategory } from '../../../modules/spaces/spaces.constants';
import { CreateVirtualDeviceDto } from '../dto/create-device.dto';
import { CreateVirtualThermostatProducerDto } from '../dto/thermostat-authoring.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualCreatedThermostatModel } from '../models/thermostat-authoring-response.model';
import { VirtualThermostatConfigurationModel } from '../models/thermostat-response.model';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualThermostatConfigService } from './virtual-thermostat-config.service';

const fail = (message: string): never => {
	throw new DevicesValidationException(message);
};

@Injectable()
export class VirtualThermostatAuthoringService {
	private readonly logger = new Logger(VirtualThermostatAuthoringService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly lock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly devices: DevicesService,
		private readonly validation: DeviceValidationService,
		private readonly configurations: VirtualThermostatConfigService,
	) {}

	async preview(dto: CreateVirtualThermostatProducerDto): Promise<VirtualThermostatConfigurationModel> {
		return this.lock.runExclusive(async () => {
			const draft = await this.draft(this.dataSource.manager, dto);
			const revision = await this.graph.revision();
			if (dto.configuration.expectedGraphRevision !== undefined && dto.configuration.expectedGraphRevision !== revision)
				fail('Virtual dependency graph revision changed; reload and retry.');
			const prepared = await this.configurations.prepare(
				this.dataSource.manager,
				draft.dto.id,
				dto.configuration,
				draft.device,
			);
			return this.configurations.describe(prepared);
		});
	}

	async create(dto: CreateVirtualThermostatProducerDto): Promise<VirtualCreatedThermostatModel> {
		return this.lock.runExclusive(async () => {
			const committed = await DeviceCreationContext.run<VirtualCreatedThermostatModel>(
				(operation) => this.graph.withStructuralWrite(operation, dto.configuration.expectedGraphRevision),
				'virtual',
				async (context) => {
					const draft = await this.draft(context.manager, dto);
					await this.configurations.prepare(context.manager, draft.dto.id, dto.configuration, draft.device);
					const device = await this.devices.create<VirtualDeviceEntity, CreateVirtualDeviceDto>(draft.dto, context);
					const prepared = await this.configurations.prepare(context.manager, device.id, dto.configuration);
					await this.configurations.persist(context.manager, device.id, prepared);
					const persistedDevice = await buildDeviceGraphQuery(context.manager.getRepository(VirtualDeviceEntity))
						.where('device.id = :id', { id: device.id })
						.getOneOrFail();
					const configuration = await this.configurations.snapshot(context.manager, device.id);
					return Object.assign(new VirtualCreatedThermostatModel(), { device: persistedDevice, configuration });
				},
				() => undefined,
			);
			try {
				await this.configurations.afterCommit(committed.device.id);
			} catch (error) {
				this.logger.error('Thermostat committed but post-commit publication failed', error);
			}
			try {
				const refreshed = await this.devices.findOne<VirtualDeviceEntity>(committed.device.id);
				if (refreshed) committed.device = refreshed;
			} catch (error) {
				this.logger.error('Thermostat committed but post-commit device hydration failed', error);
			}
			return committed;
		});
	}

	async propertyBinding(id: string): Promise<{ property: string; channel: string; device: string } | null> {
		const property = await this.dataSource.manager.findOne(ChannelPropertyEntity, {
			where: { id },
			relations: ['channel', 'channel.device'],
		});
		const channel = property?.channel;
		if (!channel || typeof channel === 'string' || typeof channel.device === 'string' || !channel.device) return null;
		return { property: property.id, channel: channel.id, device: channel.device.id };
	}

	private async draft(manager: EntityManager, request: CreateVirtualThermostatProducerDto) {
		if (!request?.device || !request.configuration)
			fail('A complete thermostat device and configuration are required.');
		const dto = plainToInstance(CreateVirtualDeviceDto, request.device);
		if ((await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).length)
			fail('Proposed thermostat device data are invalid.');
		if (
			!dto.id ||
			dto.type !== 'virtual' ||
			dto.category !== DeviceCategory.THERMOSTAT ||
			dto.mode !== VirtualDeviceMode.CLIMATE_CONTROLLER ||
			dto.controls?.length
		)
			fail('Thermostat creation requires an explicit climate-controller thermostat identity without controls.');
		const requiredChannels = [
			ChannelCategory.TEMPERATURE,
			ChannelCategory.THERMOSTAT,
			ChannelCategory.DEVICE_INFORMATION,
		];
		if (request.configuration.policy.heatingSetpoint !== null) requiredChannels.push(ChannelCategory.HEATER);
		if (request.configuration.policy.coolingSetpoint !== null) requiredChannels.push(ChannelCategory.COOLER);
		if (
			dto.channels?.length !== requiredChannels.length ||
			new Set(dto.channels.map((channel) => channel.category)).size !== requiredChannels.length ||
			dto.channels.some(
				(channel) =>
					!requiredChannels.includes(channel.category) || !channel.id || channel.controls?.length || channel.parent,
			)
		)
			fail('Thermostat channels must exactly match required temperature, policy, information and comfort branches.');
		const deviceFields = Object.fromEntries(
			Object.entries(dto).filter(([key]) => !['type', 'channels', 'zone_ids'].includes(key)),
		);
		const device = toInstance(VirtualDeviceEntity, deviceFields);
		device.channels = dto.channels.map((channelDto) => {
			const channelFields = Object.fromEntries(
				Object.entries(channelDto).filter(([key]) => !['type', 'properties'].includes(key)),
			);
			const channel = Object.assign(toInstance(VirtualChannelEntity, channelFields), { device });
			const expected =
				channel.category === ChannelCategory.TEMPERATURE
					? [PropertyCategory.TEMPERATURE]
					: channel.category === ChannelCategory.THERMOSTAT
						? [PropertyCategory.LOCKED]
						: channel.category === ChannelCategory.DEVICE_INFORMATION
							? [...getRequiredProperties(ChannelCategory.DEVICE_INFORMATION), PropertyCategory.STATUS]
							: [PropertyCategory.ON, PropertyCategory.TEMPERATURE, PropertyCategory.STATUS];
			if (
				channelDto.properties?.length !== expected.length ||
				new Set(channelDto.properties.map((property) => property.category)).size !== expected.length
			)
				fail(`Thermostat ${channel.category} channel must contain its exact local property template.`);
			channel.properties = channelDto.properties.map((propertyDto) => {
				const metadata = getPropertyMetadata(channel.category, propertyDto.category);
				if (
					!propertyDto.id ||
					!expected.includes(propertyDto.category) ||
					!metadata ||
					propertyDto.data_type !== metadata.data_type ||
					JSON.stringify(propertyDto.format ?? null) !== JSON.stringify(metadata.format ?? null) ||
					propertyDto.permissions?.length !== 1 ||
					propertyDto.permissions[0] !== PermissionType.READ_ONLY ||
					propertyDto.value_origin !== VirtualValueOrigin.LOCAL ||
					propertyDto.source_property ||
					propertyDto.value != null
				)
					fail(`Thermostat ${channel.category}/${propertyDto.category} must be an unseeded local readonly spec slot.`);
				const propertyFields = Object.fromEntries(Object.entries(propertyDto).filter(([key]) => key !== 'type'));
				return Object.assign(toInstance(VirtualChannelPropertyEntity, propertyFields), { channel });
			});
			return channel;
		});
		const requiredSettings = [
			{ setting: 'locked', channel: ChannelCategory.THERMOSTAT, property: PropertyCategory.LOCKED },
			...(request.configuration.policy.heatingSetpoint === null
				? []
				: [
						{ setting: 'heating_enabled', channel: ChannelCategory.HEATER, property: PropertyCategory.ON },
						{ setting: 'heating_setpoint', channel: ChannelCategory.HEATER, property: PropertyCategory.TEMPERATURE },
					]),
			...(request.configuration.policy.coolingSetpoint === null
				? []
				: [
						{ setting: 'cooling_enabled', channel: ChannelCategory.COOLER, property: PropertyCategory.ON },
						{ setting: 'cooling_setpoint', channel: ChannelCategory.COOLER, property: PropertyCategory.TEMPERATURE },
					]),
		];
		if (
			request.configuration.settings?.length !== requiredSettings.length ||
			requiredSettings.some((required) => {
				const property = device.channels
					.find((channel) => channel.category === required.channel)
					?.properties.find((entry) => entry.category === required.property);
				return (
					request.configuration.settings.filter(
						(setting) => setting.setting === required.setting && setting.propertyId === property?.id,
					).length !== 1
				);
			})
		)
			fail('Every thermostat command slot must be registered against its exact local branch property.');
		const shape = this.validation.validateDeviceStructure({
			category: dto.category,
			// The request intentionally creates command slots RO. Registration makes precisely these
			// properties RW in the same transaction; judge the committed shape without mutating the draft.
			channels: device.channels.map((channel) => ({
				category: channel.category,
				properties: channel.properties.map((property) => ({
					...property,
					permissions: request.configuration.settings.some((setting) => setting.propertyId === property.id)
						? [PermissionType.READ_WRITE]
						: property.permissions,
				})),
			})),
		});
		if (!shape.isValid || shape.issues.length)
			fail(
				`Proposed thermostat does not match its device specification: ${shape.issues.map((issue) => issue.message).join('; ')}`,
			);
		for (const [entity, ids] of [
			[DeviceEntity, [dto.id]],
			[ChannelEntity, device.channels.map((channel) => channel.id)],
			[ChannelPropertyEntity, device.channels.flatMap((channel) => channel.properties.map((property) => property.id))],
		] as const) {
			if (new Set(ids).size !== ids.length || ids.some((id) => !id))
				fail('Every catalog UUID must be explicit and distinct.');
			for (const id of ids)
				if (
					await manager.createQueryBuilder(entity, 'row').where('row.id = :id', { id }).callListeners(false).getCount()
				)
					fail(`Catalog UUID ${id} already exists.`);
		}
		if (dto.room_id) {
			const room = await manager
				.createQueryBuilder(SpaceEntity, 'space')
				.where('space.id = :id', { id: dto.room_id })
				.callListeners(false)
				.getOne();
			if (!room || room.type !== SpaceType.ROOM) fail('Room assignment is not a room.');
		}
		for (const id of dto.zone_ids ?? []) {
			const zone = await manager
				.createQueryBuilder(SpaceEntity, 'space')
				.where('space.id = :id', { id })
				.callListeners(false)
				.getOne();
			if (
				!zone ||
				zone.type !== SpaceType.ZONE ||
				isFloorZoneCategory((zone as { category?: string | null }).category ?? null)
			)
				fail('Zone assignment is not an assignable zone.');
		}
		return { dto, device };
	}
}
