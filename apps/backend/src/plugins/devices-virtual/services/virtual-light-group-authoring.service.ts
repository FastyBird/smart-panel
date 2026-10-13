import { plainToInstance } from 'class-transformer';
import { DataSource, EntityManager } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable } from '@nestjs/common';

import {
	ChannelCategory,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceCreationContext } from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { getPropertyMetadata, getRequiredProperties } from '../../../modules/devices/utils/schema.utils';
import { CreateVirtualDeviceDto } from '../dto/create-device.dto';
import { CreateLightGroupDraftDto, LightGroupDraftDto } from '../dto/light-group-draft.dto';
import { ConfigureVirtualLightGroupDto } from '../dto/producer-config.dto';
import { VirtualDeviceEntity, VirtualDeviceMode, VirtualValueOrigin } from '../entities/devices-virtual.entity';
import { VirtualLightGroupProfile } from '../entities/virtual-producer.entity';
import { CreatedLightGroupModel, LightGroupDraftModel } from '../models/light-group-draft.model';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { commonLightCapabilities } from './virtual-light-group.utils';
import { VirtualProducerConfigService } from './virtual-producer-config.service';

const initialLightCapabilities = [
	PropertyCategory.ON,
	PropertyCategory.BRIGHTNESS,
	PropertyCategory.COLOR_TEMPERATURE,
	PropertyCategory.COLOR_RED,
	PropertyCategory.COLOR_GREEN,
	PropertyCategory.COLOR_BLUE,
	PropertyCategory.HUE,
	PropertyCategory.SATURATION,
];

@Injectable()
export class VirtualLightGroupAuthoringService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly structureLock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly devices: DevicesService,
		private readonly configs: VirtualProducerConfigService,
	) {}

	async preview(dto: LightGroupDraftDto): Promise<LightGroupDraftModel> {
		return this.structureLock.runShared(async () => (await this.prepare(this.dataSource.manager, dto)).model);
	}

	async create(dto: CreateLightGroupDraftDto): Promise<CreatedLightGroupModel> {
		if (!Number.isInteger(dto.expectedGraphRevision) || dto.expectedGraphRevision < 0)
			throw new DevicesValidationException('A validated preview graph revision is required');
		return this.structureLock.runExclusive(async () => {
			const channelId = uuid();
			const deviceId = uuid();
			await DeviceCreationContext.run<Awaited<ReturnType<VirtualProducerConfigService['prepareLightGroup']>>>(
				(operation) => this.graph.withStructuralWrite(operation, dto.expectedGraphRevision),
				'virtual',
				async (context) => {
					const draft = await this.prepare(context.manager, dto);
					const outputs = draft.capabilities.map((capability) => ({
						id: uuid(),
						type: 'virtual',
						identifier: capability.category,
						category: capability.category,
						data_type: capability.dataType,
						permissions: [PermissionType.READ_ONLY],
						format: capability.format,
						step: capability.step,
						value_origin: VirtualValueOrigin.DERIVED,
					}));
					const deviceDto = plainToInstance(CreateVirtualDeviceDto, {
						...dto.device,
						id: deviceId,
						type: 'virtual',
						category: DeviceCategory.LIGHTING,
						mode: VirtualDeviceMode.ACTUATOR_GROUP,
						channels: [
							{
								id: channelId,
								type: 'virtual',
								identifier: 'light',
								name: 'Light',
								category: ChannelCategory.LIGHT,
								properties: outputs,
							},
							{
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
							},
						],
					});
					await this.devices.create<VirtualDeviceEntity, CreateVirtualDeviceDto>(deviceDto, context);
					const configDto = Object.assign(new ConfigureVirtualLightGroupDto(), {
						profile: VirtualLightGroupProfile.LIGHT,
						expectedRevision: 0,
						members: draft.channels.map((channel) => ({
							sourceChannelId: channel.id,
							bindings: outputs.map((output) => ({
								outputPropertyId: output.id,
								sourcePropertyId: channel.properties.find((property) => property.category === output.category).id,
							})),
						})),
					});
					const prepared = await this.configs.prepareLightGroup(context.manager, channelId, configDto);
					await this.configs.persistLightGroup(context.manager, prepared);
					return prepared;
				},
				(prepared) => this.configs.installLightGroup(prepared),
			);
			return Object.assign(new CreatedLightGroupModel(), {
				device: await this.devices.findOne(deviceId),
				configuration: await this.configs.getLightGroup(channelId),
			});
		});
	}

	/** Shared validator for dry-run and admitted persistence; no sample or producer writes. */
	async prepare(manager: EntityManager, dto: LightGroupDraftDto) {
		if (!Array.isArray(dto.members) || dto.members.length < 2 || dto.members.length > 256)
			throw new DevicesValidationException('Select between two and 256 distinct physical light channels');
		const identities = dto.members.map((member) => member.sourceChannelId);
		if (new Set(identities).size !== identities.length)
			throw new DevicesValidationException('A physical light channel may occur only once in a group');
		const channels: ChannelEntity[] = [];
		for (const id of identities) {
			const channel = await manager.findOne(ChannelEntity, { where: { id }, relations: ['device', 'properties'] });
			const device = channel?.device as DeviceEntity | undefined;
			if (
				!channel ||
				!device ||
				device.type === 'virtual' ||
				device.category !== DeviceCategory.LIGHTING ||
				channel.category !== ChannelCategory.LIGHT
			)
				throw new DevicesValidationException('Every light group member must be an existing physical lighting channel');
			for (const property of channel.properties ?? []) property.channel = channel;
			channels.push(channel);
		}
		const common = commonLightCapabilities(channels.map((channel) => channel.properties ?? []));
		if (!common.some((capability) => capability.category === PropertyCategory.ON))
			throw new DevicesValidationException(
				'Every light group member must provide the same readable/writable boolean on contract',
			);
		const requested = dto.capabilities ?? common.map((capability) => capability.category);
		if (
			!requested.includes(PropertyCategory.ON) ||
			requested.some((category) => !common.some((capability) => capability.category === category))
		)
			throw new DevicesValidationException(
				'Requested controls must include on and belong to the validated common capability contract',
			);
		const selected = common.filter((capability) => requested.includes(capability.category));
		// Apply the complete-color rule after optional control selection too.
		if (
			commonLightCapabilities(
				channels.map((channel) =>
					(channel.properties ?? []).filter((property) => requested.includes(property.category)),
				),
			).length !== selected.length
		)
			throw new DevicesValidationException(
				'Select complete RGB or hue/saturation controls; individual color components are not supported',
			);
		const model = Object.assign(new LightGroupDraftModel(), {
			graph_revision: await this.graph.revision(manager),
			common_capabilities: selected.map((capability) => ({
				category: capability.category,
				data_type: capability.dataType,
				unit: capability.unit,
				format: capability.format,
				step: capability.step,
			})),
			unavailable_capabilities: initialLightCapabilities.filter(
				(category) => !common.some((capability) => capability.category === category),
			),
			members: channels.map((channel) => ({
				source_channel: channel.id,
				device_id: (channel.device as DeviceEntity).id,
				name: `${(channel.device as DeviceEntity).name} / ${channel.name}`,
			})),
		});
		return { channels, capabilities: selected, model };
	}
}
