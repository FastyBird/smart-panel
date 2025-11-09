import { Injectable } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { StatsProvider } from '../../stats/stats.interfaces';
import { ModuleStatsModel } from '../models/devices.model';
import { ChannelsService } from '../services/channels.service';
import { DevicesService } from '../services/devices.service';
import { StatsService } from '../services/stats.service';

@Injectable()
export class DevicesStatsProvider implements StatsProvider {
	constructor(
		private readonly stats: StatsService,
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
	) {}

	async getStats(): Promise<ModuleStatsModel> {
		const [registeredDevices, registeredChannels, updatesPerMin, updatesToday, onlineNow] = await Promise.all([
			this.devicesService.getCount(),
			this.channelsService.getCount(),
			this.stats.getUpdatesPerMin(),
			this.stats.getUpdatesToday(new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()),
			this.stats.getOnlineNow(),
		]);

		return toInstance(ModuleStatsModel, {
			registeredDevices: {
				value: registeredDevices,
				lastUpdated: new Date(),
			},
			registeredChannels: {
				value: registeredChannels,
				lastUpdated: new Date(),
			},
			updatesPerMin,
			updatesToday,
			onlineNow,
		});
	}
}
