import { Injectable } from '@nestjs/common';

import { IDataSourceNestedCreateBuilder } from '../entities/dashboard.relations';

@Injectable()
export class DataSourceCreateBuilderRegistryService {
	private builders: IDataSourceNestedCreateBuilder[] = [];

	register(builder: IDataSourceNestedCreateBuilder): void {
		this.builders.push(builder);
	}

	getBuilders(): IDataSourceNestedCreateBuilder[] {
		return this.builders;
	}
}
