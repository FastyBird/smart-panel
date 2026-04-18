import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { SpaceRoleEntity } from '../entities/space-role.entity';
import { SPACES_MODULE_NAME } from '../spaces.constants';
import { SpacesException } from '../spaces.exceptions';

export interface SpaceRoleTypeMapping<TRole extends SpaceRoleEntity> {
	type: string;
	class: new (...args: any[]) => TRole;
}

/**
 * Registry of discriminator strings → concrete subclass for the unified
 * `spaces_module_space_roles` inheritance table.
 *
 * Mirrors the pattern established by `SpacesTypeMapperService`. Plugins register
 * new role subtypes here during their `onModuleInit` so generic consumers (seeders,
 * factory-reset, etc.) can resolve the concrete class + scoped repository for a
 * given discriminator without hardcoding the built-in set.
 */
@Injectable()
export class SpaceRolesTypeMapperService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceRolesTypeMapperService');

	private readonly mappings = new Map<string, SpaceRoleTypeMapping<any>>();

	registerMapping<TRole extends SpaceRoleEntity>(mapping: SpaceRoleTypeMapping<TRole>): void {
		this.mappings.set(mapping.type, mapping);

		this.logger.log(`[REGISTERED] Space role type '${mapping.type}' added. Total mappings: ${this.mappings.size}`);
	}

	getMapping<TRole extends SpaceRoleEntity>(type: string): SpaceRoleTypeMapping<TRole> {
		const mapping = this.mappings.get(type);

		if (!mapping) {
			this.logger.error(
				`[LOOKUP FAILED] Space role mapping for '${type}' is not registered. Available types: ${
					Array.from(this.mappings.keys()).join(', ') || 'None'
				}`,
			);

			throw new SpacesException(`Unsupported space role type: ${type}`);
		}

		return mapping as SpaceRoleTypeMapping<TRole>;
	}

	getAllMappings(): ReadonlyMap<string, SpaceRoleTypeMapping<any>> {
		return this.mappings;
	}
}
