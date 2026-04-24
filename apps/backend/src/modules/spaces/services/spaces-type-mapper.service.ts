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
	/**
	 * When true, the core `SpacesService.create` flow refuses to produce a
	 * second row of this type — at most one such space may exist per install.
	 * Used by synthetic singleton plugins (master, entry) so a caller cannot
	 * `POST /spaces` with `{ type: 'master', ... }` and duplicate the singleton
	 * after the user has already created it.
	 */
	singleton?: boolean;
	/**
	 * Columns on the shared STI table (`spaces_module_spaces`) that this
	 * subtype's DTOs whitelist, mapped to the value core should write when
	 * transitioning AWAY from this subtype (i.e. the "wipe value"). Core
	 * `SpacesService.update()` consults the map on a type change:
	 *
	 * - **wipes** columns owned by the OLD subtype but NOT the new one, so
	 *   a row that transitions to a type whose DTO can't clear them doesn't
	 *   carry stale values forward (e.g. a room's `category` surviving a
	 *   flip to `signage_info_panel`, whose update DTO has no `category`).
	 *   The wipe VALUE is plugin-declared so NOT NULL columns get their
	 *   column default (e.g. `suggestionsEnabled` defaults to `true`)
	 *   rather than violating the constraint with a blind `null`.
	 * - **gates the raw-column fallback** in `readRawSpaceCategory` to only
	 *   run when the *target* subtype actually carries the column — avoiding
	 *   an extra SQL round-trip on every ordinary update.
	 *
	 * Defaults to `undefined` (treated as empty) so existing plugins keep
	 * working; only subtypes that genuinely own per-subtype columns on the
	 * shared table need to declare this.
	 */
	subtypeColumns?: Readonly<Record<string, unknown>>;
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
}
