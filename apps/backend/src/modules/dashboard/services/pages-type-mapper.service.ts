import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import { CreatePageDto } from '../dto/create-page.dto';
import { UpdatePageDto } from '../dto/update-page.dto';
import { PageEntity } from '../entities/dashboard.entity';

export interface PageTypeMapping<
	TPage extends PageEntity,
	TCreateDTO extends CreatePageDto,
	TUpdateDTO extends UpdatePageDto,
> {
	type: string; // e.g., 'virtual', 'shelly'
	class: new (...args: any[]) => TPage; // Constructor for the page class
	createDto: new (...args: any[]) => TCreateDTO; // Constructor for the Create DTO
	updateDto: new (...args: any[]) => TUpdateDTO; // Constructor for the Update DTO
}

@Injectable()
export class PagesTypeMapperService {
	private readonly logger = createExtensionLogger(DASHBOARD_MODULE_NAME, 'PagesTypeMapperService');

	private readonly mappings = new Map<string, PageTypeMapping<any, any, any>>();

	registerMapping<TPage extends PageEntity, TCreateDTO extends CreatePageDto, TUpdateDTO extends UpdatePageDto>(
		mapping: PageTypeMapping<TPage, TCreateDTO, TUpdateDTO>,
	): void {
		this.mappings.set(mapping.type, mapping);

		this.logger.log(`[REGISTERED] Page type '${mapping.type}' added. Total mappings: ${this.mappings.size}`);
	}

	getMapping<TPage extends PageEntity, TCreateDTO extends CreatePageDto, TUpdateDTO extends UpdatePageDto>(
		type: string,
	): PageTypeMapping<TPage, TCreateDTO, TUpdateDTO> {
		const mapping = this.mappings.get(type);

		if (!mapping) {
			this.logger.error(
				`[LOOKUP FAILED] Page mapping for '${type}' is not registered. Available types: ${Array.from(this.mappings.keys()).join(', ') || 'None'}`,
			);

			throw new DashboardException(`Unsupported page type: ${type}`);
		}

		return mapping as PageTypeMapping<TPage, TCreateDTO, TUpdateDTO>;
	}
}
