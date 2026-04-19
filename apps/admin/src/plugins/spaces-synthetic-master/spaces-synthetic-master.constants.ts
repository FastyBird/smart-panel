import { SpaceType } from '../../modules/spaces';

export const SPACES_SYNTHETIC_MASTER_PLUGIN_PREFIX = 'spaces-synthetic-master';

export const SPACES_SYNTHETIC_MASTER_PLUGIN_NAME = 'spaces-synthetic-master-plugin';

export const SPACES_SYNTHETIC_MASTER_PLUGIN_SOURCE = 'com.fastybird.smart-panel.plugin.spaces-synthetic-master';

/**
 * Space types contributed by the synthetic master plugin. Must mirror the
 * backend discriminator value declared on `MasterSpaceEntity`.
 */
export const SPACES_SYNTHETIC_MASTER_TYPES = [SpaceType.MASTER] as const;

/** Human-readable label surfaced in admin plugin UI selectors. */
export const SPACES_SYNTHETIC_MASTER_TYPE_LABELS: Record<(typeof SPACES_SYNTHETIC_MASTER_TYPES)[number], string> = {
	[SpaceType.MASTER]: 'Master',
};
