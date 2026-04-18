import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { CreateSpaceDto } from '../dto/create-space.dto';
import { UpdateSpaceDto } from '../dto/update-space.dto';
import { SpaceEntity } from '../entities/space.entity';
import { SPACES_MODULE_NAME } from '../spaces.constants';
import { SpacesException } from '../spaces.exceptions';

export interface SpaceTypeMapping<
	TSpace extends SpaceEntity,
	TCreateDTO extends CreateSpaceDto,
	TUpdateDTO extends UpdateSpaceDto,
> {
	type: string;
	class: new (...args: any[]) => TSpace;
	createDto: new (...args: any[]) => TCreateDTO;
	updateDto: new (...args: any[]) => TUpdateDTO;
}

@Injectable()
export class SpacesTypeMapperService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpacesTypeMapperService');

	private readonly mappings = new Map<string, SpaceTypeMapping<any, any, any>>();

	registerMapping<TSpace extends SpaceEntity, TCreateDTO extends CreateSpaceDto, TUpdateDTO extends UpdateSpaceDto>(
		mapping: SpaceTypeMapping<TSpace, TCreateDTO, TUpdateDTO>,
	): void {
		this.mappings.set(mapping.type, mapping);

		this.logger.log(`[REGISTERED] Space type '${mapping.type}' added. Total mappings: ${this.mappings.size}`);
	}

	getMapping<TSpace extends SpaceEntity, TCreateDTO extends CreateSpaceDto, TUpdateDTO extends UpdateSpaceDto>(
		type: string,
	): SpaceTypeMapping<TSpace, TCreateDTO, TUpdateDTO> {
		const mapping = this.mappings.get(type);

		if (!mapping) {
			this.logger.error(
				`[LOOKUP FAILED] Space mapping for '${type}' is not registered. Available types: ${
					Array.from(this.mappings.keys()).join(', ') || 'None'
				}`,
			);

			throw new SpacesException(`Unsupported space type: ${type}`);
		}

		return mapping as SpaceTypeMapping<TSpace, TCreateDTO, TUpdateDTO>;
	}

	getRegisteredTypes(): string[] {
		return Array.from(this.mappings.keys());
	}
}
