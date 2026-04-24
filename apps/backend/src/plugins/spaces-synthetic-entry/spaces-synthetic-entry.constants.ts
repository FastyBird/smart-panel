import { SpaceType } from '../../modules/spaces/spaces.constants';

export const SPACES_SYNTHETIC_ENTRY_PLUGIN_PREFIX = 'spaces-synthetic-entry';

export const SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME = 'spaces-synthetic-entry-plugin';

export const SPACES_SYNTHETIC_ENTRY_PLUGIN_API_TAG_NAME = 'Spaces synthetic entry plugin';

export const SPACES_SYNTHETIC_ENTRY_PLUGIN_API_TAG_DESCRIPTION =
	'Contributes the singleton Entry synthetic space. The entry space represents the security / front-door surface and is the target for displays that surface arming state, intrusion alerts, and access control.';

/**
 * Space-type discriminator contributed by this plugin. Mirrors the core
 * `SpaceType.ENTRY` enum value; re-exported as a plugin constant so local
 * imports within the plugin stay self-contained.
 */
export const SPACES_SYNTHETIC_ENTRY_TYPE = SpaceType.ENTRY;

/**
 * Deterministic UUID used by the legacy `displays.role` → `displays.spaceId`
 * backfill in migration 1000000000004 to map `role = 'entry'` displays at the
 * entry space. Kept as a constant so the migration stays self-contained; new
 * code should not hard-code this UUID — query by `type = entry` instead.
 */
export const SPACES_SYNTHETIC_ENTRY_SPACE_ID = 'a0000000-0000-4000-8000-000000000002';
