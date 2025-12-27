import { Injectable } from '@nestjs/common';

import { PageEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { IPageRelationsLoader } from '../../../modules/dashboard/entities/dashboard.relations';
import { HousePageEntity } from '../entities/pages-house.entity';

@Injectable()
export class PageRelationsLoaderService implements IPageRelationsLoader {
	async loadRelations(_page: HousePageEntity): Promise<void> {
		// House page doesn't have specific relations to load
		// All spaces are loaded separately by the panel when rendering
	}

	supports(entity: PageEntity): boolean {
		return entity instanceof HousePageEntity;
	}
}
