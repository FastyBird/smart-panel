import { SpaceType } from '../../modules/spaces/spaces.constants';

export const SPACES_SYNTHETIC_MASTER_PLUGIN_PREFIX = 'spaces-synthetic-master';

export const SPACES_SYNTHETIC_MASTER_PLUGIN_NAME = 'spaces-synthetic-master-plugin';

export const SPACES_SYNTHETIC_MASTER_PLUGIN_API_TAG_NAME = 'Spaces synthetic master plugin';

export const SPACES_SYNTHETIC_MASTER_PLUGIN_API_TAG_DESCRIPTION =
	'Contributes the singleton Master synthetic space. The master space represents the whole-house overview surface and is the target for displays that show aggregated state across all rooms.';

/**
 * Space-type discriminator contributed by this plugin. Mirrors the core
 * `SpaceType.MASTER` enum value; re-exported as a plugin constant so local
 * imports within the plugin stay self-contained.
 */
export const SPACES_SYNTHETIC_MASTER_TYPE = SpaceType.MASTER;

/**
 * Deterministic UUID used by the legacy `displays.role` → `displays.spaceId`
 * backfill in migration 1000000000004 to map `role = 'master'` displays at the
 * master space. Kept as a constant so the migration stays self-contained; new
 * code should not hard-code this UUID — query by `type = master` instead.
 */
export const SPACES_SYNTHETIC_MASTER_SPACE_ID = 'a0000000-0000-4000-8000-000000000001';
