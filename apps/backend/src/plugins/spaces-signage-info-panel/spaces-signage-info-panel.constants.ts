import { SpaceType } from '../../modules/spaces/spaces.constants';

export const SPACES_SIGNAGE_INFO_PANEL_PLUGIN_PREFIX = 'spaces-signage-info-panel';

export const SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME = 'spaces-signage-info-panel-plugin';

export const SPACES_SIGNAGE_INFO_PANEL_PLUGIN_API_TAG_NAME = 'Spaces signage info panel plugin';

export const SPACES_SIGNAGE_INFO_PANEL_PLUGIN_API_TAG_DESCRIPTION =
	'Contributes the information-panel signage space type — a read-only, full-screen surface with configurable sections (clock, weather, announcements, optional feed) and its nested announcement CRUD endpoints.';

/**
 * Space-type discriminator contributed by this plugin. Mirrors the core
 * `SpaceType.SIGNAGE_INFO_PANEL` enum value; re-exported as a plugin
 * constant so local imports within the plugin stay self-contained.
 */
export const SPACES_SIGNAGE_INFO_PANEL_TYPE = SpaceType.SIGNAGE_INFO_PANEL;

/**
 * Layout options for the information-panel surface. The layout decides
 * the grid of sections rendered by the panel; individual sections can
 * additionally be toggled on/off via the per-section boolean flags.
 */
export enum SignageInfoPanelLayout {
	CLOCK_WEATHER = 'clock_weather',
	CLOCK_WEATHER_ANNOUNCEMENTS = 'clock_weather_announcements',
	FULL = 'full',
}

export enum EventType {
	ANNOUNCEMENT_CREATED = 'SpacesSignageInfoPanelPlugin.Announcement.Created',
	ANNOUNCEMENT_UPDATED = 'SpacesSignageInfoPanelPlugin.Announcement.Updated',
	ANNOUNCEMENT_DELETED = 'SpacesSignageInfoPanelPlugin.Announcement.Deleted',
	SIGNAGE_SPACE_CREATED = 'SpacesSignageInfoPanelPlugin.SignageSpace.Created',
}

/**
 * Event prefix used to filter WebSocket events contributed by the plugin
 * (mirrors the pattern used by `pages-cards`' event listener).
 */
export const SPACES_SIGNAGE_INFO_PANEL_PLUGIN_EVENT_PREFIX = 'SpacesSignageInfoPanelPlugin';
