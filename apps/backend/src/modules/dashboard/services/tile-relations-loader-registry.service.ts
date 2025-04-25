import { Injectable } from '@nestjs/common';

import { ITileRelationsLoader } from '../entities/dashboard.relations';

@Injectable()
export class TileRelationsLoaderRegistryService {
	private readonly loaders: ITileRelationsLoader[] = [];

	register(loader: ITileRelationsLoader): void {
		this.loaders.push(loader);
	}

	getLoaders(): ITileRelationsLoader[] {
		return this.loaders;
	}
}
