import { createApp } from 'vue';
import { createMetaManager, plugin as metaPlugin } from 'vue-meta';
import type { RouteRecordRaw } from 'vue-router';

import { createPinia } from 'pinia';

import mitt, { type Emitter } from 'mitt';
import 'nprogress/nprogress.css';
import createClient from 'openapi-fetch';
import 'virtual:uno.css';

import AppMain from './app.main.vue';
import type { IModuleOptions } from './app.types';
import './assets/styles/base.scss';
import {
	type Events,
	RouterGuards,
	StoresManager,
	provideBackendClient,
	provideEventBus,
	provideRouterGuards,
	provideStoresManager,
	router,
} from './common';
import i18n from './locales';
import { AuthModule, sessionStoreKey } from './modules/auth-module';
import { UsersModule } from './modules/users-module';
import type { paths } from './openapi';

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

// Backend
const backendClient = createClient<paths>({
	baseUrl: `${import.meta.env.FB_APP_HOST}:${import.meta.env.MODE === 'development' ? import.meta.env.FB_ADMIN_PORT : import.meta.env.FB_BACKEND_PORT}/api/v1`,
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

// Modules
const moduleOptions: IModuleOptions = {
	router,
	store: pinia,
	i18n,
};

app.use(AuthModule, moduleOptions);
app.use(UsersModule, moduleOptions);

router.beforeEach((to) => {
	const sessionStore = storesManager.getStore(sessionStoreKey);

	const appUser = sessionStore.profile
		? { id: sessionStore.profile.id, role: sessionStore.profile.role, email: sessionStore.profile.email }
		: undefined;

	return routerGuards.handle(appUser, to as unknown as RouteRecordRaw);
});

// App router initialization
// INFO: Need to be placed as last because of dynamic routes inject
app.use(router);

router.isReady().then(() => app.mount('#app'));
