import { Injectable } from '@nestjs/common';

import { ITileNestedCreateBuilder } from '../entities/dashboard.relations';

@Injectable()
export class TileCreateBuilderRegistryService {
	private builders: ITileNestedCreateBuilder[] = [];

	register(builder: ITileNestedCreateBuilder): void {
		this.builders.push(builder);
	}

	getBuilders(): ITileNestedCreateBuilder[] {
		return this.builders;
	}
}
