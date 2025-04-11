import { validate as uuidValidate } from 'uuid';

import { Injectable } from '@nestjs/common';

import { DataSourceEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { IDataSourceRelationsLoader } from '../../../modules/dashboard/entities/dashboard.relations';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DeviceChannelDataSourceEntity } from '../entities/data-sources-device-channel.entity';

@Injectable()
export class DataSourceRelationsLoaderService implements IDataSourceRelationsLoader {
	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
	) {}

	async loadRelations(dataSource: DeviceChannelDataSourceEntity): Promise<void> {
		if (typeof dataSource.deviceId === 'string' && uuidValidate(dataSource.deviceId)) {
			dataSource.device = await this.devicesService.findOne(dataSource.deviceId);

			if (dataSource.device && typeof dataSource.channelId === 'string' && uuidValidate(dataSource.channelId)) {
				dataSource.channel = await this.channelsService.findOne(dataSource.channelId, dataSource.deviceId);

				if (dataSource.channel && typeof dataSource.propertyId === 'string' && uuidValidate(dataSource.propertyId)) {
					dataSource.property = await this.channelsPropertiesService.findOne(
						dataSource.propertyId,
						dataSource.channelId,
					);
				}
			}
		}
	}

	supports(entity: DataSourceEntity): boolean {
		return entity instanceof DeviceChannelDataSourceEntity;
	}
}
