import { Injectable } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { StatsProvider } from '../../stats/stats.interfaces';
import { ModuleStatsModel } from '../models/system.model';
import { SystemService } from '../services/system.service';

@Injectable()
export class SystemStatsProvider implements StatsProvider {
	constructor(private readonly systemService: SystemService) {}

	async getStats(): Promise<ModuleStatsModel> {
		const info = await this.systemService.getSystemInfo();

		const totalMem = info.memory.total;
		const usedMem = info.memory.used;
		const memUsedPct = Math.round((usedMem / totalMem) * 100);

		const totalDisk = info.storage.reduce((acc, s) => acc + s.size, 0);
		const usedDisk = info.storage.reduce((acc, s) => acc + s.used, 0);
		const diskUsedPct = Math.round((usedDisk / totalDisk) * 100);

		return toInstance(ModuleStatsModel, {
			cpuLoad1m: {
				value: info.cpuLoad,
				lastUpdated: new Date(),
			},
			memUsedPct: {
				value: memUsedPct,
				lastUpdated: new Date(),
			},
			diskUsedPct: {
				value: diskUsedPct,
				lastUpdated: new Date(),
			},
			systemUptimeSec: {
				value: info.os.uptime,
				lastUpdated: new Date(),
			},
			processUptimeSec: {
				value: info.process.uptime,
				lastUpdated: new Date(),
			},
			temperatureCpu: {
				value: info.temperature.cpu ?? null,
				lastUpdated: new Date(),
			},
			temperatureGpu: {
				value: info.temperature.gpu ?? null,
				lastUpdated: new Date(),
			},
		});
	}
}
