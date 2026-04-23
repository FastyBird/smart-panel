import { SpaceType } from '../../modules/spaces';

export const SPACES_SIGNAGE_INFO_PANEL_PLUGIN_PREFIX = 'spaces-signage-info-panel';

export const SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME = 'spaces-signage-info-panel-plugin';

export const SPACES_SIGNAGE_INFO_PANEL_PLUGIN_SOURCE = 'com.fastybird.smart-panel.plugin.spaces-signage-info-panel';

/**
 * Space types contributed by the signage info-panel plugin. Mirrors the
 * backend discriminator value on `SignageInfoPanelSpaceEntity`.
 */
export const SPACES_SIGNAGE_INFO_PANEL_TYPES = [SpaceType.SIGNAGE_INFO_PANEL] as const;

/**
 * Layout presets for the information-panel surface.
 */
export enum SignageInfoPanelLayout {
	CLOCK_WEATHER = 'clock_weather',
	CLOCK_WEATHER_ANNOUNCEMENTS = 'clock_weather_announcements',
	FULL = 'full',
}

/**
 * Event types emitted by the backend plugin. Mirrors the backend enum so
 * the admin store can filter WebSocket events.
 */
export const SPACES_SIGNAGE_INFO_PANEL_EVENT_PREFIX = 'SpacesSignageInfoPanelPlugin';

export enum EventType {
	ANNOUNCEMENT_CREATED = 'SpacesSignageInfoPanelPlugin.Announcement.Created',
	ANNOUNCEMENT_UPDATED = 'SpacesSignageInfoPanelPlugin.Announcement.Updated',
	ANNOUNCEMENT_DELETED = 'SpacesSignageInfoPanelPlugin.Announcement.Deleted',
}
