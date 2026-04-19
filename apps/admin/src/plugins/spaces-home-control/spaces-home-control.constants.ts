import { SpaceType } from '../../modules/spaces';

export const SPACES_HOME_CONTROL_PLUGIN_PREFIX = 'spaces-home-control';

export const SPACES_HOME_CONTROL_PLUGIN_NAME = 'spaces-home-control-plugin';

export const SPACES_HOME_CONTROL_PLUGIN_SOURCE = 'com.fastybird.smart-panel.plugin.spaces-home-control';

/**
 * Space types contributed by the home-control plugin. Must mirror the discriminator
 * values declared on the backend `RoomSpaceEntity` / `ZoneSpaceEntity` child entities.
 */
export const SPACES_HOME_CONTROL_TYPES = [SpaceType.ROOM, SpaceType.ZONE] as const;

/**
 * Human-readable labels per space type, surfaced in admin UI selectors via
 * `pluginsManager` elements. Keep these here so translations / changes are
 * co-located with the plugin rather than scattered.
 */
export const SPACES_HOME_CONTROL_TYPE_LABELS: Record<(typeof SPACES_HOME_CONTROL_TYPES)[number], string> = {
	[SpaceType.ROOM]: 'Room',
	[SpaceType.ZONE]: 'Zone',
};
