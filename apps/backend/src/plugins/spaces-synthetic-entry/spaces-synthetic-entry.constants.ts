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
 * Deterministic UUID for the singleton entry space. Persisted once on first
 * boot by the plugin seeder. Later phases (display → space backfill, panel
 * view dispatch) may reference this ID directly.
 */
export const SPACES_SYNTHETIC_ENTRY_SPACE_ID = 'a0000000-0000-4000-8000-000000000002';

/**
 * Default name for the seeded entry space. User-editable after creation.
 */
export const SPACES_SYNTHETIC_ENTRY_DEFAULT_NAME = 'Entry';
