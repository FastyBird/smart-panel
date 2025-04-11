import { Injectable } from '@nestjs/common';

import { IDataSourceRelationsLoader } from '../entities/dashboard.relations';

@Injectable()
export class DataSourceRelationsLoaderRegistryService {
	private readonly loaders: IDataSourceRelationsLoader[] = [];

	register(loader: IDataSourceRelationsLoader): void {
		this.loaders.push(loader);
	}

	getLoaders(): IDataSourceRelationsLoader[] {
		return this.loaders;
	}
}
