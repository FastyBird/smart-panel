import { SpaceType } from '../../modules/spaces';

export const SPACES_SYNTHETIC_ENTRY_PLUGIN_PREFIX = 'spaces-synthetic-entry';

export const SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME = 'spaces-synthetic-entry-plugin';

export const SPACES_SYNTHETIC_ENTRY_PLUGIN_SOURCE = 'com.fastybird.smart-panel.plugin.spaces-synthetic-entry';

/**
 * Space types contributed by the synthetic entry plugin. Must mirror the
 * backend discriminator value declared on `EntrySpaceEntity`.
 */
export const SPACES_SYNTHETIC_ENTRY_TYPES = [SpaceType.ENTRY] as const;

/** Human-readable label surfaced in admin plugin UI selectors. */
export const SPACES_SYNTHETIC_ENTRY_TYPE_LABELS: Record<(typeof SPACES_SYNTHETIC_ENTRY_TYPES)[number], string> = {
	[SpaceType.ENTRY]: 'Entry',
};
