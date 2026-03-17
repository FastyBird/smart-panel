import { Injectable } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { StatsProvider } from '../../stats/stats.interfaces';
import { ModuleStatsModel } from '../models/devices.model';
import { ChannelsService } from '../services/channels.service';
import { DeviceConnectionStateService } from '../services/device-connection-state.service';
import { DevicesService } from '../services/devices.service';
import { StatsService } from '../services/stats.service';

@Injectable()
export class DevicesStatsProvider implements StatsProvider {
	constructor(
		private readonly stats: StatsService,
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly connectionState: DeviceConnectionStateService,
	) {}

	async getStats(): Promise<ModuleStatsModel> {
		const [devices, registeredChannels, updatesPerMin, updatesToday] = await Promise.all([
			this.devicesService.findAll(),
			this.channelsService.getCount(),
			this.stats.getUpdatesPerMin(),
			this.stats.getUpdatesToday(new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()),
		]);

		const currentDeviceIds = new Set(devices.map((d) => d.id));
		const onlineCount = await this.connectionState.getOnlineCountForDevices(currentDeviceIds);

		return toInstance(ModuleStatsModel, {
			registeredDevices: {
				value: devices.length,
				lastUpdated: new Date(),
			},
			registeredChannels: {
				value: registeredChannels,
				lastUpdated: new Date(),
			},
			updatesPerMin,
			updatesToday,
			onlineNow: {
				value: onlineCount,
				lastUpdated: new Date(),
			},
		});
	}
}
