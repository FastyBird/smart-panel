import { DataSource } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { GroupCatalogDto } from '../dto/group-catalog.dto';
import {
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualLightGroupConfigEntity, VirtualLightGroupProfile } from '../entities/virtual-producer.entity';
import { GroupCatalogModel } from '../models/group-catalog.model';

import { coverContractReasons } from './virtual-cover-contract.utils';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { groupCapabilityChange } from './virtual-group-contract.utils';
import { GROUP_PROFILES, commonGroupCapabilities, groupField, requiredGroupFields } from './virtual-group-profile';

/** Shared structural metadata policy only. Neither candidate eligibility nor a preview grants command authority. */
@Injectable()
export class VirtualGroupCatalogService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly graph: VirtualDependencyGraphService,
	) {}
	async read(dto: GroupCatalogDto): Promise<GroupCatalogModel> {
		const profile = dto.profile ?? VirtualLightGroupProfile.LIGHT;
		if (!Object.hasOwn(GROUP_PROFILES, profile)) throw new DevicesValidationException('Unsupported group profile');
		const policy = GROUP_PROFILES[profile];
		const channels = await this.dataSource.manager
			.createQueryBuilder(ChannelEntity, 'channel')
			.leftJoinAndSelect('channel.device', 'device')
			.leftJoinAndSelect('channel.properties', 'property')
			.where('channel.category = :category', { category: policy.channelCategory })
			.andWhere('device.category = :deviceCategory', { deviceCategory: policy.deviceCategory })
			.andWhere('device.type NOT IN (:...virtualTypes)', {
				virtualTypes: ['virtual', this.dataSource.getMetadata(VirtualDeviceEntity).discriminatorValue],
			})
			.callListeners(false)
			.getMany();
		for (const channel of channels)
			for (const property of channel.properties ?? []) {
				property.channel = channel;
				property.unit = resolvePropertyUnit(property);
			}
		const selected = (dto.selectedChannels ?? []).flatMap((id) => channels.filter((channel) => channel.id === id));
		const diagnostics = (dto.selectedChannels ?? [])
			.filter((id) => !channels.some((channel) => channel.id === id))
			.map((id) => `selected_identity_missing_or_incompatible:${id}`);
		let outputs: ChannelPropertyEntity[] = [];
		if (dto.exposedGroup) {
			const group = await this.dataSource.manager.findOneBy(VirtualLightGroupConfigEntity, {
				groupChannelId: dto.exposedGroup,
			});
			if (!group || group.profile !== profile)
				throw new DevicesValidationException('Group profile changed; reload before repair');
			outputs = await this.dataSource.manager.find(VirtualChannelPropertyEntity, {
				where: { channel: { id: dto.exposedGroup }, valueOrigin: VirtualValueOrigin.DERIVED },
			});
		}
		return {
			profiles: Object.entries(GROUP_PROFILES).map(([key, value]) => ({
				profile: key as VirtualLightGroupProfile,
				device_category: value.deviceCategory,
				channel_category: value.channelCategory,
				required_capabilities: [...requiredGroupFields(key as VirtualLightGroupProfile)],
			})),
			diagnostics,
			candidates: channels.map((channel) => {
				const members = [...selected.filter((other) => other.id !== channel.id), channel];
				const common = commonGroupCapabilities(
					profile,
					members.map((member) => member.properties ?? []),
				);
				const requested = new Set([
					...(dto.capabilities ?? common.map((capability) => capability.category)),
					...requiredGroupFields(profile),
				]);
				const reasons = [...requested]
					.filter((category) => !common.some((field) => field.category === category))
					.map((category) => `group_capability_incompatible:${category}`);
				if (
					commonGroupCapabilities(
						profile,
						members.map((member) => (member.properties ?? []).filter((property) => requested.has(property.category))),
					).length !== common.filter((capability) => requested.has(capability.category)).length
				)
					reasons.push('group_capability_incomplete_tuple');
				if (profile === VirtualLightGroupProfile.COVER)
					for (const member of members) reasons.push(...coverContractReasons(member.properties ?? []));
				for (const output of outputs)
					if (
						groupCapabilityChange(
							profile,
							common.find((capability) => capability.category === output.category),
							output,
						)
					)
						reasons.push(`exposed_capability_changed:${output.category}`);
				if (
					members.some((member) =>
						member.properties?.some(
							(property) => requested.has(property.category) && this.graph.isQuarantined(property.id),
						),
					)
				)
					reasons.push('graph_quarantined');
				return {
					channel: channel.id,
					device: (channel.device as DeviceEntity).id,
					name: `${(channel.device as DeviceEntity).name} / ${channel.name}`,
					eligible: reasons.length === 0,
					reasons: [...new Set(reasons)],
					common_capabilities: common.map(({ dataType, ...field }) => ({
						...field,
						data_type: dataType,
						...(profile === VirtualLightGroupProfile.LIGHT
							? {}
							: { access: groupField(profile, field.category)?.access }),
					})),
				};
			}),
		};
	}
}
