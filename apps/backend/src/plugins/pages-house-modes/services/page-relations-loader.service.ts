import { Injectable } from '@nestjs/common';

import { PageEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { IPageRelationsLoader } from '../../../modules/dashboard/entities/dashboard.relations';
import { HouseModesPageEntity } from '../entities/pages-house-modes.entity';

@Injectable()
export class PageRelationsLoaderService implements IPageRelationsLoader {
	async loadRelations(_page: HouseModesPageEntity): Promise<void> {
		// House modes page doesn't have specific relations to load
		// The current house mode is loaded separately from the system config
	}

	supports(entity: PageEntity): boolean {
		return entity instanceof HouseModesPageEntity;
	}
}
