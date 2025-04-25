import { Injectable } from '@nestjs/common';

import { IPageNestedCreateBuilder } from '../entities/dashboard.relations';

@Injectable()
export class PageCreateBuilderRegistryService {
	private builders: IPageNestedCreateBuilder[] = [];

	register(builder: IPageNestedCreateBuilder): void {
		this.builders.push(builder);
	}

	getBuilders(): IPageNestedCreateBuilder[] {
		return this.builders;
	}
}
