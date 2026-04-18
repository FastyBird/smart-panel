import { Injectable } from '@nestjs/common';

import { ISpaceNestedCreateBuilder } from '../entities/space.relations';

@Injectable()
export class SpaceCreateBuilderRegistryService {
	private builders: ISpaceNestedCreateBuilder[] = [];

	register(builder: ISpaceNestedCreateBuilder): void {
		this.builders.push(builder);
	}

	getBuilders(): ISpaceNestedCreateBuilder[] {
		return this.builders;
	}
}
