/**
 * Central collection point for all Swagger extra models
 *
 * This file aggregates all *_SWAGGER_EXTRA_MODELS from modules and plugins
 * into a single array for use in SwaggerModule.createDocument()
 */
import { Type } from '@nestjs/common';

// Plugins
import { DATA_SOURCES_DEVICE_CHANNEL_PLUGIN_SWAGGER_EXTRA_MODELS } from '../../plugins/data-sources-device-channel/data-sources-device-channel.openapi';
import { DEVICES_HOME_ASSISTANT_PLUGIN_SWAGGER_EXTRA_MODELS } from '../../plugins/devices-home-assistant/devices-home-assistant.openapi';
import { DEVICES_SHELLY_NG_PLUGIN_SWAGGER_EXTRA_MODELS } from '../../plugins/devices-shelly-ng/devices-shelly-ng.openapi';
import { DEVICES_SHELLY_V1_PLUGIN_SWAGGER_EXTRA_MODELS } from '../../plugins/devices-shelly-v1/devices-shelly-v1.openapi';
import { DEVICES_THIRD_PARTY_PLUGIN_SWAGGER_EXTRA_MODELS } from '../../plugins/devices-third-party/devices-third-party.openapi';
import { LOGGER_ROTATING_FILE_PLUGIN_SWAGGER_EXTRA_MODELS } from '../../plugins/logger-rotating-file/logger-rotating-file.openapi';
import { PAGES_CARDS_PLUGIN_SWAGGER_EXTRA_MODELS } from '../../plugins/pages-cards/pages-cards.openapi';
import { PAGES_DEVICE_DETAIL_PLUGIN_SWAGGER_EXTRA_MODELS } from '../../plugins/pages-device-detail/pages-device-detail.openapi';
import { PAGES_TILES_PLUGIN_SWAGGER_EXTRA_MODELS } from '../../plugins/pages-tiles/pages-tiles.openapi';
import { TILES_DEVICE_PREVIEW_PLUGIN_SWAGGER_EXTRA_MODELS } from '../../plugins/tiles-device-preview/tiles-device-preview.openapi';
import { TILES_TIME_PLUGIN_SWAGGER_EXTRA_MODELS } from '../../plugins/tiles-time/tiles-time.openapi';
import { TILES_WEATHER_PLUGIN_SWAGGER_EXTRA_MODELS } from '../../plugins/tiles-weather/tiles-weather.openapi';
import { API_SWAGGER_EXTRA_MODELS } from '../api/api.openapi';
// Modules
import { AUTH_SWAGGER_EXTRA_MODELS } from '../auth/auth.openapi';
import { CONFIG_SWAGGER_EXTRA_MODELS } from '../config/config.openapi';
import { DASHBOARD_SWAGGER_EXTRA_MODELS } from '../dashboard/dashboard.openapi';
import { DEVICES_SWAGGER_EXTRA_MODELS } from '../devices/devices.openapi';
import { STATS_SWAGGER_EXTRA_MODELS } from '../stats/stats.openapi';
import { SYSTEM_SWAGGER_EXTRA_MODELS } from '../system/system.openapi';
import { USERS_SWAGGER_EXTRA_MODELS } from '../users/users.openapi';
import { WEATHER_SWAGGER_EXTRA_MODELS } from '../weather/weather.openapi';
import { WEBSOCKET_SWAGGER_EXTRA_MODELS } from '../websocket/websocket.openapi';

/**
 * Aggregated array of all Swagger extra models from all modules and plugins
 */
export const SWAGGER_EXTRA_MODELS: Type<any>[] = [
	// Modules
	...AUTH_SWAGGER_EXTRA_MODELS,
	...API_SWAGGER_EXTRA_MODELS,
	...CONFIG_SWAGGER_EXTRA_MODELS,
	...DASHBOARD_SWAGGER_EXTRA_MODELS,
	...DEVICES_SWAGGER_EXTRA_MODELS,
	...STATS_SWAGGER_EXTRA_MODELS,
	...SYSTEM_SWAGGER_EXTRA_MODELS,
	...USERS_SWAGGER_EXTRA_MODELS,
	...WEATHER_SWAGGER_EXTRA_MODELS,
	...WEBSOCKET_SWAGGER_EXTRA_MODELS,

	// Plugins
	...DATA_SOURCES_DEVICE_CHANNEL_PLUGIN_SWAGGER_EXTRA_MODELS,
	...DEVICES_HOME_ASSISTANT_PLUGIN_SWAGGER_EXTRA_MODELS,
	...DEVICES_SHELLY_NG_PLUGIN_SWAGGER_EXTRA_MODELS,
	...DEVICES_SHELLY_V1_PLUGIN_SWAGGER_EXTRA_MODELS,
	...DEVICES_THIRD_PARTY_PLUGIN_SWAGGER_EXTRA_MODELS,
	...LOGGER_ROTATING_FILE_PLUGIN_SWAGGER_EXTRA_MODELS,
	...PAGES_CARDS_PLUGIN_SWAGGER_EXTRA_MODELS,
	...PAGES_DEVICE_DETAIL_PLUGIN_SWAGGER_EXTRA_MODELS,
	...PAGES_TILES_PLUGIN_SWAGGER_EXTRA_MODELS,
	...TILES_DEVICE_PREVIEW_PLUGIN_SWAGGER_EXTRA_MODELS,
	...TILES_TIME_PLUGIN_SWAGGER_EXTRA_MODELS,
	...TILES_WEATHER_PLUGIN_SWAGGER_EXTRA_MODELS,
];
