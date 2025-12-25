import { Injectable } from '@nestjs/common';

import { PageEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { IPageRelationsLoader } from '../../../modules/dashboard/entities/dashboard.relations';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import { SpacePageEntity } from '../entities/pages-space.entity';

@Injectable()
export class PageRelationsLoaderService implements IPageRelationsLoader {
	constructor(private readonly spacesService: SpacesService) {}

	async loadRelations(page: SpacePageEntity): Promise<void> {
		if (page.spaceId) {
			const space = await this.spacesService.findOne(page.spaceId);

			if (space) {
				page.space = space;
			}
		}
	}

	supports(entity: PageEntity): boolean {
		return entity instanceof SpacePageEntity;
	}
}
