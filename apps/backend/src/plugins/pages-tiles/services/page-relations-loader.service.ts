import { Injectable } from '@nestjs/common';

import { PageEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { IPageRelationsLoader } from '../../../modules/dashboard/entities/dashboard.relations';
import { TilesService } from '../../../modules/dashboard/services/tiles.service';
import { TilesPageEntity } from '../entities/pages-tiles.entity';

@Injectable()
export class PageRelationsLoaderService implements IPageRelationsLoader {
	constructor(private readonly tilesService: TilesService) {}

	async loadRelations(page: TilesPageEntity): Promise<void> {
		page.tiles = await this.tilesService.findAll({
			parentType: 'page',
			parentId: page.id,
		});
	}

	supports(entity: PageEntity): boolean {
		return entity instanceof TilesPageEntity;
	}
}
