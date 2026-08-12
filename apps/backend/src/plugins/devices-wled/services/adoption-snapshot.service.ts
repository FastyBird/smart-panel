import { In } from 'typeorm';
import { DataSource } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { WledChannelEntity, WledChannelPropertyEntity } from '../entities/devices-wled.entity';

export interface WledAdoptionStructureSnapshot {
	deviceId: string;
	channels: WledChannelEntity[];
	properties: WledChannelPropertyEntity[];
}

@Injectable()
export class WledAdoptionSnapshotService {
	constructor(private readonly dataSource: DataSource) {}

	async capture(deviceId: string): Promise<WledAdoptionStructureSnapshot> {
		const channels = await this.dataSource.getRepository(WledChannelEntity).find({
			where: { device: { id: deviceId } },
			relations: ['device'],
		});
		const channelIds = channels.map(({ id }) => id);
		const properties =
			channelIds.length === 0
				? []
				: await this.dataSource.getRepository(WledChannelPropertyEntity).find({
						where: { channel: { id: In(channelIds) } },
						relations: ['channel'],
					});

		return { deviceId, channels, properties };
	}

	async restore(snapshot: WledAdoptionStructureSnapshot): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			const channelRepository = manager.getRepository(WledChannelEntity);
			const propertyRepository = manager.getRepository(WledChannelPropertyEntity);
			const currentChannels = await channelRepository.find({ where: { device: { id: snapshot.deviceId } } });
			const currentChannelIds = currentChannels.map(({ id }) => id);
			const snapshotChannelIds = new Set(snapshot.channels.map(({ id }) => id));
			const extraChannelIds = currentChannelIds.filter((id) => !snapshotChannelIds.has(id));

			if (extraChannelIds.length > 0) {
				await channelRepository.delete({ id: In(extraChannelIds) });
			}

			for (const channel of snapshot.channels) {
				await channelRepository.save({
					...channel,
					device: snapshot.deviceId,
					properties: undefined,
					controls: undefined,
					children: undefined,
					parent: undefined,
				});
			}

			const restoredChannelIds = snapshot.channels.map(({ id }) => id);
			if (restoredChannelIds.length === 0) {
				return;
			}

			const currentProperties = await propertyRepository.find({
				where: { channel: { id: In(restoredChannelIds) } },
			});
			const snapshotPropertyIds = new Set(snapshot.properties.map(({ id }) => id));
			const extraPropertyIds = currentProperties.map(({ id }) => id).filter((id) => !snapshotPropertyIds.has(id));

			if (extraPropertyIds.length > 0) {
				await propertyRepository.delete({ id: In(extraPropertyIds) });
			}

			for (const property of snapshot.properties) {
				const channelId = typeof property.channel === 'string' ? property.channel : property.channel.id;
				await propertyRepository.save({ ...property, channel: channelId });
			}
		});
	}
}
