import { DataSource } from 'typeorm';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import {
	CompositeCommandChild,
	CompositeCommandPlan,
	CompositePropertyCommandPlanner,
	CompositePropertyCommandRegistryService,
} from '../../../modules/devices/services/composite-property-command.registry.service';
import { DeviceCommandGraphService } from '../../../modules/devices/services/device-command-graph.service';
import {
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
} from '../entities/devices-virtual.entity';
import {
	VirtualLightGroupBindingEntity,
	VirtualLightGroupConfigEntity,
	VirtualLightGroupMemberEntity,
} from '../entities/virtual-producer.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';

@Injectable()
export class VirtualLightGroupCommandService implements CompositePropertyCommandPlanner, OnModuleInit, OnModuleDestroy {
	private unregister?: () => void;
	constructor(
		private readonly dataSource: DataSource,
		private readonly registry: CompositePropertyCommandRegistryService,
		private readonly devices: DeviceCommandGraphService,
		private readonly graph: VirtualDependencyGraphService,
	) {}
	onModuleInit(): void {
		this.unregister = this.registry.register(this);
	}
	onModuleDestroy(): void {
		this.unregister?.();
	}
	canHandle(property: ChannelPropertyEntity): boolean {
		const channel = property.channel;
		return (
			property instanceof VirtualChannelPropertyEntity &&
			property.isDerived &&
			typeof channel !== 'string' &&
			typeof channel.device !== 'string' &&
			(channel.device as VirtualDeviceEntity).mode === VirtualDeviceMode.ACTUATOR_GROUP
		);
	}
	async plan(updates: readonly IDevicePropertyData[]): Promise<CompositeCommandPlan> {
		const graphRevision = await this.graph.revision();
		const revisions = new Map<string, number>();
		const children: CompositeCommandChild[] = [];
		for (const update of updates) {
			const channelId = update.channel.id;
			const config = await this.dataSource.manager.findOneBy(VirtualLightGroupConfigEntity, {
				groupChannelId: channelId,
			});
			if (!config) throw new Error('Light group is not configured');
			revisions.set(channelId, config.revision);
			const members = await this.dataSource.manager.find(VirtualLightGroupMemberEntity, {
				where: { groupChannelId: channelId },
			});
			if (members.length < 2 || members.length > 256) throw new Error('Invalid light group member count');
			for (const member of members) {
				const binding = await this.dataSource.manager.findOne(VirtualLightGroupBindingEntity, {
					where: { memberId: member.id, outputPropertyId: update.property.id },
					relations: ['sourceProperty', 'sourceProperty.channel', 'sourceProperty.channel.device'],
				});
				const property = binding?.sourceProperty;
				const channel = property?.channel as ChannelEntity;
				const device = channel ? await this.devices.findOne((channel.device as DeviceEntity).id) : null;
				const available =
					member.sourceChannelId &&
					property &&
					channel.id === member.sourceChannelId &&
					device?.enabled &&
					device.status.online;
				children.push({
					memberId: member.id,
					update: available ? { property, channel, device, value: update.value } : null,
					reason: available ? undefined : 'Member is missing, disabled or offline',
				});
			}
		}
		return {
			revision: Math.max(...revisions.values()),
			children,
			isCurrent: async () => {
				if ((await this.graph.revision()) !== graphRevision) return false;
				for (const [groupChannelId, revision] of revisions)
					if (
						(await this.dataSource.manager.findOneBy(VirtualLightGroupConfigEntity, { groupChannelId }))?.revision !==
						revision
					)
						return false;
				return true;
			},
		};
	}
}
