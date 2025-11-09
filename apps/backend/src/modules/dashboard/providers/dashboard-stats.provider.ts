import { Injectable } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { StatsProvider } from '../../stats/stats.interfaces';
import { ModuleStatsModel } from '../models/dashboard.model';
import { DataSourcesService } from '../services/data-sources.service';
import { PagesService } from '../services/pages.service';
import { TilesService } from '../services/tiles.service';

@Injectable()
export class DashboardStatsProvider implements StatsProvider {
	constructor(
		private readonly pagesService: PagesService,
		private readonly tilesService: TilesService,
		private readonly dataSourcesService: DataSourcesService,
	) {}

	async getStats(): Promise<ModuleStatsModel> {
		const [registeredPages, registeredTiles, registeredDataSources] = await Promise.all([
			this.pagesService.getCount(),
			this.tilesService.getCount(),
			this.dataSourcesService.getCount(),
		]);

		return toInstance(ModuleStatsModel, {
			registeredPages: {
				value: registeredPages,
				lastUpdated: new Date(),
			},
			registeredTiles: {
				value: registeredTiles,
				lastUpdated: new Date(),
			},
			registeredDataSources: {
				value: registeredDataSources,
				lastUpdated: new Date(),
			},
		});
	}
}
