import { createApp } from 'vue';
import { createMetaManager, plugin as metaPlugin } from 'vue-meta';
import type { RouteRecordRaw } from 'vue-router';

import { createPinia } from 'pinia';

import mitt, { type Emitter } from 'mitt';
import 'nprogress/nprogress.css';
import createClient from 'openapi-fetch';
import 'virtual:uno.css';

import { RouteNames } from './app.constants';
import AppMain from './app.main.vue';
import type { IModuleOptions } from './app.types';
import './assets/styles/base.scss';
import {
	type Events,
	PluginsManager,
	RouterGuards,
	SocketsPlugin,
	StoresManager,
	injectAccountManager,
	provideBackendClient,
	provideEventBus,
	providePluginsManager,
	provideRouterGuards,
	provideStoresManager,
	router,
} from './common';
import i18n from './locales';
import { AuthModule } from './modules/auth';
import { ConfigModule } from './modules/config';
import { DashboardModule } from './modules/dashboard';
import { DevicesModule } from './modules/devices';
import { SystemModule } from './modules/system';
import { UsersModule } from './modules/users';
import type { paths } from './openapi';
import { DeviceChannelDataSourcesPlugin } from './plugins/data-sources-device-channel';
import { DevicesHomeAssistantPlugin } from './plugins/devices-home-assistant';
import { DevicesThirdPartyPlugin } from './plugins/devices-third-party';
import { PagesCardsPlugin } from './plugins/pages-cards';
import { PagesDeviceDetailPlugin } from './plugins/pages-device-detail';
import { PagesTilesPlugin } from './plugins/pages-tiles';
import { TilesDevicePreviewPlugin } from './plugins/tiles-device-preview';
import { TilesTimePlugin } from './plugins/tiles-time';
import { TilesWeatherPlugin } from './plugins/tiles-weather';

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

// Backend
const backendClient = createClient<paths>({
	baseUrl: `${window.location.protocol}//${window.location.hostname}:${import.meta.env.MODE === 'development' ? import.meta.env.FB_ADMIN_PORT : import.meta.env.FB_BACKEND_PORT}/api/v1`,
});
app.config.globalProperties['backend'] = backendClient;
provideBackendClient(app, backendClient);

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

// Default route
router.addRoute(RouteNames.ROOT, {
	path: 'dashboard',
	name: RouteNames.DASHBOARD,
	component: () => import('./views/HomeView.vue'),
	meta: {
		guards: ['authenticated'],
		title: 'Dashboard',
		icon: 'mdi:monitor-dashboard',
		menu: true,
	},
});

// Modules
const moduleOptions: IModuleOptions = {
	router,
	store: pinia,
	i18n,
};

app.use(SystemModule, moduleOptions);
app.use(ConfigModule, moduleOptions);
app.use(DashboardModule, moduleOptions);
app.use(DevicesModule, moduleOptions);
app.use(UsersModule, moduleOptions);
app.use(AuthModule, moduleOptions);

// Plugins
const pluginOptions: IModuleOptions = {
	router,
	store: pinia,
	i18n,
};

app.use(DevicesThirdPartyPlugin, pluginOptions);
app.use(DevicesHomeAssistantPlugin, pluginOptions);
app.use(PagesCardsPlugin, pluginOptions);
app.use(PagesDeviceDetailPlugin, pluginOptions);
app.use(PagesTilesPlugin, pluginOptions);
app.use(TilesDevicePreviewPlugin, pluginOptions);
app.use(TilesTimePlugin);
app.use(TilesWeatherPlugin);
app.use(DeviceChannelDataSourcesPlugin, pluginOptions);

router.beforeEach((to) => {
	const accountManager = injectAccountManager(app);

	return routerGuards.handle(accountManager?.details.value ?? undefined, to as unknown as RouteRecordRaw);
});

// App router initialization
// INFO: Need to be placed as last because of dynamic routes inject
app.use(router);

router.isReady().then(() => app.mount('#app'));
