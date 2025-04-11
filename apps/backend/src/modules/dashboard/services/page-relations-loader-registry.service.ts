import { Injectable } from '@nestjs/common';

import { IPageRelationsLoader } from '../entities/dashboard.relations';

@Injectable()
export class PageRelationsLoaderRegistryService {
	private readonly loaders: IPageRelationsLoader[] = [];

	register(loader: IPageRelationsLoader): void {
		this.loaders.push(loader);
	}

	getLoaders(): IPageRelationsLoader[] {
		return this.loaders;
	}
}
