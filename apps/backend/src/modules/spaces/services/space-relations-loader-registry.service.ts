import { Injectable } from '@nestjs/common';

import { ISpaceRelationsLoader } from '../entities/space.relations';

@Injectable()
export class SpaceRelationsLoaderRegistryService {
	private readonly loaders: ISpaceRelationsLoader[] = [];

	register(loader: ISpaceRelationsLoader): void {
		this.loaders.push(loader);
	}

	getLoaders(): ISpaceRelationsLoader[] {
		return this.loaders;
	}
}
