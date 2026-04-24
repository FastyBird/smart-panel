import { BaseEntity } from '../entities/base.entity';

/**
 * Contract shared by every plugin-contributed relations loader.
 *
 * Each plugin-host module (spaces, dashboard pages / tiles / data-sources,
 * …) exposes a registry service that accepts loaders implementing a
 * module-specific extender of this interface. The extenders narrow
 * `BaseEntity` down to the module's own entity type and are declared next
 * to those entities; the base contract stays here so the two trees don't
 * have to redeclare it verbatim.
 */
export interface IRelationLoader {
	supports(entity: BaseEntity): boolean;

	loadRelations(entity: BaseEntity): Promise<void>;
}
