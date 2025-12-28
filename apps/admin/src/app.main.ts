import { createApp } from 'vue';
import { createMetaManager, plugin as metaPlugin } from 'vue-meta';
import type { RouteRecordRaw } from 'vue-router';

import { createPinia } from 'pinia';

import mitt, { type Emitter } from 'mitt';
import 'nprogress/nprogress.css';
import createClient from 'openapi-fetch';
import 'virtual:uno.css';

import { extensions as staticExtensions } from '@root-config/extensions';

import AppMain from './app.main.vue';
import type { IModuleOptions } from './app.types';
import './assets/styles/base.scss';
import {
	type Events,
	ModulesManager,
	PluginsManager,
	RouterGuards,
	SocketsPlugin,
	StoresManager,
	injectAccountManager,
	logger,
	provideBackendClient,
	provideEventBus,
	provideModulesManager,
	providePluginsManager,
	provideRouterGuards,
	provideStoresManager,
	router,
} from './common';
import { provideLogger } from './common';
import CommonModule from './common/common.module';
import i18n from './locales';
import { AuthModule } from './modules/auth';
import { ConfigModule } from './modules/config';
import { DashboardModule } from './modules/dashboard';
import { DevicesModule } from './modules/devices';
import { DisplaysModule } from './modules/displays';
import { ExtensionsModule, installRemoteExtensions, installStaticExtensions } from './modules/extensions';
import { InfluxDbModule } from './modules/influxdb';
import { MdnsModule } from './modules/mdns';
import { SpacesModule } from './modules/spaces';
import { StatsModule } from './modules/stats';
import { SystemModule } from './modules/system';
import { UsersModule } from './modules/users';
import { WeatherModule } from './modules/weather';
import type { OpenApiPaths } from './openapi.constants';
import { DeviceChannelDataSourcesPlugin } from './plugins/data-sources-device-channel';
import { DataSourcesWeatherPlugin } from './plugins/data-sources-weather';
import { DevicesHomeAssistantPlugin } from './plugins/devices-home-assistant';
import { DevicesShellyNgPlugin } from './plugins/devices-shelly-ng';
import { DevicesShellyV1Plugin } from './plugins/devices-shelly-v1';
import { DevicesThirdPartyPlugin } from './plugins/devices-third-party';
import { DevicesWledPlugin } from './plugins/devices-wled';
import { DevicesZigbee2mqttPlugin } from './plugins/devices-zigbee2mqtt';
import { LoggerRotatingFilePlugin } from './plugins/logger-rotating-file';
import { PagesCardsPlugin } from './plugins/pages-cards';
import { PagesDeviceDetailPlugin } from './plugins/pages-device-detail';
import { PagesHousePlugin } from './plugins/pages-house';
import { PagesHouseModesPlugin } from './plugins/pages-house-modes';
import { PagesSpacePlugin } from './plugins/pages-space';
import { PagesTilesPlugin } from './plugins/pages-tiles';
import { TilesDevicePreviewPlugin } from './plugins/tiles-device-preview';
import { TilesTimePlugin } from './plugins/tiles-time';
import { TilesWeatherPlugin } from './plugins/tiles-weather';
import { WeatherOpenweathermapPlugin } from './plugins/weather-openweathermap';
import { weatherOpenweathermapOnecallPlugin as WeatherOpenweathermapOnecallPlugin } from './plugins/weather-openweathermap-onecall';

const app = createApp(AppMain);

app.use(i18n);
app.use(createMetaManager());
app.use(metaPlugin);

// Store
const pinia = createPinia();
app.use(pinia);

const storesManager = new StoresManager();
app.config.globalProperties['storesManager'] = storesManager;
provideStoresManager(app, storesManager);

// Plugins
const pluginsManager = new PluginsManager();
app.config.globalProperties['pluginsManager'] = pluginsManager;
providePluginsManager(app, pluginsManager);

// Modules
const modulesManager = new ModulesManager();
app.config.globalProperties['modulesManager'] = modulesManager;
provideModulesManager(app, modulesManager);

// Backend
const backendClient = createClient<OpenApiPaths>({
	baseUrl: `${window.location.protocol}//${window.location.hostname}:${import.meta.env.MODE === 'development' ? import.meta.env.FB_ADMIN_PORT : import.meta.env.FB_BACKEND_PORT}/api/v1`,
});
app.config.globalProperties['backend'] = backendClient;
provideBackendClient(app, backendClient);

// Logger
app.config.globalProperties['logger'] = logger;
provideLogger(app, logger);

// Event bus
const eventBus: Emitter<Events> = mitt<Events>();
app.config.globalProperties['eventBus'] = eventBus;
provideEventBus(app, eventBus);

// Router
const routerGuards = new RouterGuards();
app.config.globalProperties['routerGuards'] = routerGuards;
provideRouterGuards(app, routerGuards);

// Sockets
app.use(SocketsPlugin, {
	baseUrl: `${window.location.protocol}//${window.location.hostname}:${import.meta.env.FB_BACKEND_PORT}`,
});

// Common module
app.use(CommonModule, { store: pinia });

// Modules
const moduleOptions: IModuleOptions = {
	router,
	store: pinia,
	i18n,
};

app.use(SystemModule, moduleOptions);
app.use(ConfigModule, moduleOptions);
app.use(AuthModule, moduleOptions);
app.use(DashboardModule, moduleOptions);
app.use(DevicesModule, moduleOptions);
app.use(DisplaysModule, moduleOptions);
app.use(SpacesModule, moduleOptions);
app.use(ExtensionsModule, moduleOptions);
app.use(UsersModule, moduleOptions);
app.use(StatsModule, moduleOptions);
app.use(WeatherModule, moduleOptions);
app.use(MdnsModule, moduleOptions);
app.use(InfluxDbModule, moduleOptions);

// Plugins
const pluginOptions: IModuleOptions = {
	router,
	store: pinia,
	i18n,
};

app.use(DevicesThirdPartyPlugin, pluginOptions);
app.use(DevicesHomeAssistantPlugin, pluginOptions);
app.use(DevicesShellyNgPlugin, pluginOptions);
app.use(DevicesShellyV1Plugin, pluginOptions);
app.use(DevicesWledPlugin, pluginOptions);
app.use(DevicesZigbee2mqttPlugin, pluginOptions);
app.use(PagesCardsPlugin, pluginOptions);
app.use(PagesDeviceDetailPlugin, pluginOptions);
app.use(PagesHousePlugin, pluginOptions);
app.use(PagesHouseModesPlugin, pluginOptions);
app.use(PagesSpacePlugin, pluginOptions);
app.use(PagesTilesPlugin, pluginOptions);
app.use(TilesDevicePreviewPlugin, pluginOptions);
app.use(TilesTimePlugin);
app.use(TilesWeatherPlugin, pluginOptions);
app.use(DeviceChannelDataSourcesPlugin, pluginOptions);
app.use(DataSourcesWeatherPlugin, pluginOptions);
app.use(LoggerRotatingFilePlugin, pluginOptions);
app.use(WeatherOpenweathermapPlugin, pluginOptions);
app.use(WeatherOpenweathermapOnecallPlugin, pluginOptions);

const installedNames = new Set<string>();

installStaticExtensions(
	app,
	logger,
	{
		router,
		store: pinia,
		i18n,
	},
	installedNames,
	staticExtensions
);

await installRemoteExtensions(
	app,
	backendClient,
	logger,
	{
		router,
		store: pinia,
		i18n,
	},
	installedNames
);

router.beforeEach((to) => {
	const accountManager = injectAccountManager(app);

	return routerGuards.handle(accountManager?.details.value ?? undefined, to as unknown as RouteRecordRaw);
});

// App router initialization
// INFO: Need to be placed as last because of dynamic routes inject
app.use(router);

router.isReady().then(() => app.mount('#app'));
