import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, EntityManager } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	DataTypeType,
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
import { getPropertyMetadata, getRequiredProperties } from '../../../modules/devices/utils/schema.utils';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceType, isFloorZoneCategory } from '../../../modules/spaces/spaces.constants';
import { CreateVirtualDeviceChannelDto } from '../dto/create-device-channel.dto';
import { CreateVirtualDeviceDto } from '../dto/create-device.dto';
import {
	CreateVirtualAggregateProducerDto,
	CreateVirtualTransformProducerDto,
	PreviewVirtualTransformProducerDto,
} from '../dto/measurement-authoring.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';
import {
	VirtualCreatedAggregateModel,
	VirtualCreatedTransformModel,
} from '../models/measurement-authoring-response.model';
import { VirtualAggregateConfigurationModel } from '../models/producer-response.model';
import { VirtualTransformConfigurationModel } from '../models/transform-response.model';

import { VirtualAggregateRuntimeService } from './virtual-aggregate-runtime.service';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualProducerConfigService } from './virtual-producer-config.service';
import { VirtualProducerStateService } from './virtual-producer-state.service';
import { VirtualTransformConfigService } from './virtual-transform-config.service';
import { attachTransformPreview } from './virtual-transform-preview.utils';

@Injectable()
export class VirtualMeasurementAuthoringService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly lock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly devices: DevicesService,
		private readonly validation: DeviceValidationService,
		private readonly aggregates: VirtualProducerConfigService,
		private readonly transforms: VirtualTransformConfigService,
		private readonly state: VirtualProducerStateService,
		private readonly aggregateRuntime: VirtualAggregateRuntimeService,
	) {}

	async previewAggregate(dto: CreateVirtualAggregateProducerDto): Promise<VirtualAggregateConfigurationModel> {
		return this.lock.runExclusive(async () => {
			const draft = await this.draft(
				this.dataSource.manager,
				dto.device,
				dto.outputPropertyId,
				VirtualDeviceMode.SENSOR_AGGREGATE,
			);
			const revision = await this.graph.revision();
			this.graphFence(dto.configuration.expectedGraphRevision, revision);
			const prepared = await this.aggregates.prepareAggregate(
				this.dataSource.manager,
				dto.outputPropertyId,
				dto.configuration,
				draft.output,
				true,
			);
			return this.aggregates.describeAggregate(prepared, revision);
		});
	}

	async previewTransform(dto: PreviewVirtualTransformProducerDto): Promise<VirtualTransformConfigurationModel> {
		return this.lock.runExclusive(async () => {
			const draft = await this.draft(
				this.dataSource.manager,
				dto.device,
				dto.outputPropertyId,
				VirtualDeviceMode.SENSOR_TRANSFORM,
			);
			const revision = await this.graph.revision();
			this.graphFence(dto.configuration.expectedGraphRevision, revision);
			const prepared = await this.transforms.prepare(
				this.dataSource.manager,
				dto.outputPropertyId,
				dto.configuration,
				draft.output,
				true,
			);
			return attachTransformPreview(this.transforms.describe(prepared, revision), dto.previewInput);
		});
	}

	async createAggregate(dto: CreateVirtualAggregateProducerDto): Promise<VirtualCreatedAggregateModel> {
		return this.lock.runExclusive(async () => {
			const committed = await DeviceCreationContext.run<{
				device: VirtualDeviceEntity;
				prepared: Awaited<ReturnType<VirtualProducerConfigService['prepareAggregate']>>;
				freshSources: { sourceId: string; leafId: string }[];
			}>(
				(operation) => this.graph.withStructuralWrite(operation, dto.configuration.expectedGraphRevision),
				'virtual',
				async (context) => {
					const draft = await this.draft(
						context.manager,
						dto.device,
						dto.outputPropertyId,
						VirtualDeviceMode.SENSOR_AGGREGATE,
					);
					// Validate before creating, then revalidate against the actual catalog within the same writer.
					await this.aggregates.prepareAggregate(
						context.manager,
						dto.outputPropertyId,
						dto.configuration,
						draft.output,
						true,
					);
					const device = await this.devices.create<VirtualDeviceEntity, CreateVirtualDeviceDto>(draft.dto, context);
					const prepared = await this.aggregates.prepareAggregate(
						context.manager,
						dto.outputPropertyId,
						dto.configuration,
						undefined,
						true,
					);
					await this.aggregates.persistAggregate(context.manager, prepared);
					const freshSources = await Promise.all(
						prepared.inputs
							.filter((input) => input.sourcePropertyId !== null)
							.map(async (input) => {
								const transform = await context.manager.findOneBy(VirtualTransformSourceEntity, {
									outputPropertyId: input.sourcePropertyId,
								});
								return {
									sourceId: input.sourcePropertyId,
									leafId: transform?.sourcePropertyId ?? input.sourcePropertyId,
								};
							}),
					);
					return { device, prepared, freshSources };
				},
				({ prepared, freshSources }) => {
					this.state.installUnavailable(prepared.output, prepared.config.revision);
					this.aggregateRuntime.requireFreshInputs(prepared.output.id, freshSources);
				},
			);
			return Object.assign(new VirtualCreatedAggregateModel(), {
				device: await this.devices.findOne(committed.device.id),
				configuration: await this.aggregates.getAggregate(dto.outputPropertyId),
			});
		});
	}

	async createTransform(dto: CreateVirtualTransformProducerDto): Promise<VirtualCreatedTransformModel> {
		return this.lock.runExclusive(async () => {
			const committed = await DeviceCreationContext.run<{
				device: VirtualDeviceEntity;
				prepared: Awaited<ReturnType<VirtualTransformConfigService['prepare']>>;
			}>(
				(operation) => this.graph.withStructuralWrite(operation, dto.configuration.expectedGraphRevision),
				'virtual',
				async (context) => {
					const draft = await this.draft(
						context.manager,
						dto.device,
						dto.outputPropertyId,
						VirtualDeviceMode.SENSOR_TRANSFORM,
					);
					await this.transforms.prepare(context.manager, dto.outputPropertyId, dto.configuration, draft.output, true);
					const device = await this.devices.create<VirtualDeviceEntity, CreateVirtualDeviceDto>(draft.dto, context);
					const prepared = await this.transforms.prepare(
						context.manager,
						dto.outputPropertyId,
						dto.configuration,
						undefined,
						true,
					);
					await this.transforms.persist(context.manager, prepared);
					return { device, prepared };
				},
				({ prepared }) => this.transforms.activate(prepared.output, prepared.config, prepared.source),
			);
			return Object.assign(new VirtualCreatedTransformModel(), {
				device: await this.devices.findOne(committed.device.id),
				configuration: await this.transforms.get(dto.outputPropertyId),
			});
		});
	}

	private graphFence(expected: number | undefined, actual: number): void {
		if (expected !== undefined && expected !== actual)
			throw new DevicesValidationException('Virtual dependency graph revision changed; reload and retry.');
	}

	private async draft(
		manager: EntityManager,
		supplied: CreateVirtualDeviceDto,
		outputPropertyId: string,
		mode: VirtualDeviceMode,
	) {
		if (!supplied) throw new DevicesValidationException('A proposed sensor device is required.');
		const dto = plainToInstance(CreateVirtualDeviceDto, supplied);
		if ((await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).length)
			throw new DevicesValidationException('Proposed device data are invalid.');
		if (
			dto.type !== 'virtual' ||
			dto.mode !== mode ||
			dto.category !== DeviceCategory.SENSOR ||
			!dto.channels?.length ||
			dto.channels.length > 2
		)
			throw new DevicesValidationException(
				'Measurement creation requires the requested virtual sensor mode and one measurement channel.',
			);
		if (dto.controls?.length)
			throw new DevicesValidationException('Readonly measurement creation does not accept command controls.');
		// Persist the same complete owned metadata structure that draft validation judges.
		// The legacy listener remains idempotent; no metadata values are seeded before COMMIT.
		if (!dto.channels.some((channel) => channel.category === ChannelCategory.DEVICE_INFORMATION)) {
			dto.channels.push(
				plainToInstance(CreateVirtualDeviceChannelDto, {
					id: uuid(),
					type: 'virtual',
					identifier: 'device_information',
					name: 'Device Information',
					category: ChannelCategory.DEVICE_INFORMATION,
					properties: [...getRequiredProperties(ChannelCategory.DEVICE_INFORMATION), PropertyCategory.STATUS].map(
						(category) => {
							const metadata = getPropertyMetadata(ChannelCategory.DEVICE_INFORMATION, category);
							return {
								id: uuid(),
								type: 'virtual',
								identifier: category,
								category,
								data_type: metadata.data_type,
								permissions: metadata.permissions,
								format: metadata.format,
								value_origin: VirtualValueOrigin.LOCAL,
							};
						},
					),
				}),
			);
		}
		dto.id ??= uuid();
		const deviceFields = Object.fromEntries(
			Object.entries(dto).filter(([key]) => !['type', 'channels', 'zone_ids'].includes(key)),
		);
		const device = toInstance(VirtualDeviceEntity, deviceFields);
		const fakeChannels = dto.channels.map((channelDto) => {
			channelDto.id ??= uuid();
			const channelFields = Object.fromEntries(
				Object.entries(channelDto).filter(([key]) => !['type', 'properties'].includes(key)),
			);
			const channel = Object.assign(toInstance(VirtualChannelEntity, channelFields), { device });
			channel.properties = (channelDto.properties ?? []).map((propertyDto) => {
				propertyDto.id ??= uuid();
				const propertyFields = Object.fromEntries(Object.entries(propertyDto).filter(([key]) => key !== 'type'));
				return Object.assign(toInstance(VirtualChannelPropertyEntity, propertyFields), { channel });
			});
			return channel;
		});
		const measurements = fakeChannels.filter((channel) => channel.category !== ChannelCategory.DEVICE_INFORMATION);
		if (measurements.length !== 1 || measurements[0].properties.length !== 1)
			throw new DevicesValidationException('A measurement requires exactly one materialized output.');
		const output = measurements[0].properties[0] as VirtualChannelPropertyEntity;
		if (
			output.id !== outputPropertyId ||
			!output.isDerived ||
			output.dataType !== DataTypeType.FLOAT ||
			output.permissions.length !== 1 ||
			output.permissions[0] !== PermissionType.READ_ONLY ||
			output.sourcePropertyId
		)
			throw new DevicesValidationException(
				'The selected output must be an owned readonly derived float without a projection source.',
			);
		if (
			fakeChannels.some((channel) =>
				channel.properties.some(
					(property) =>
						property.value != null ||
						(channel.category === ChannelCategory.DEVICE_INFORMATION &&
							(property as VirtualChannelPropertyEntity).valueOrigin !== VirtualValueOrigin.LOCAL),
				),
			)
		)
			throw new DevicesValidationException('Measurements cannot be seeded with client values.');
		const shape = this.validation.validateDeviceStructure({
			category: dto.category,
			channels: fakeChannels.map((channel) => ({ category: channel.category, properties: channel.properties })),
		});
		if (!shape.isValid || shape.issues.length)
			throw new DevicesValidationException('Proposed measurement device does not match its sensor specification.');
		for (const [entity, ids] of [
			[DeviceEntity, [dto.id]],
			[ChannelEntity, fakeChannels.map((channel) => channel.id)],
			[ChannelPropertyEntity, fakeChannels.flatMap((channel) => channel.properties.map((property) => property.id))],
		] as const) {
			if (new Set(ids).size !== ids.length || ids.some((id) => !id))
				throw new DevicesValidationException('Proposed catalog UUIDs must be explicit and distinct.');
			for (const id of ids)
				if (
					await manager.createQueryBuilder(entity, 'row').where('row.id = :id', { id }).callListeners(false).getCount()
				)
					throw new DevicesValidationException(`Catalog UUID ${id} already exists.`);
		}
		if (dto.room_id) {
			const room = await manager
				.createQueryBuilder(SpaceEntity, 'space')
				.where('space.id = :id', { id: dto.room_id })
				.callListeners(false)
				.getOne();
			if (!room || room.type !== SpaceType.ROOM) throw new DevicesValidationException('Room assignment is not a room.');
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
				throw new DevicesValidationException('Zone assignment is not an assignable zone.');
		}
		return { dto, output };
	}
}
