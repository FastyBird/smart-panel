import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager, injectStoresManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';
import { configPluginsStoreKey } from '../../modules/config/store/keys';
import {
	DEVICES_MODULE_NAME,
	RouteNames as DevicesRouteNames,
	type IChannelPluginsComponents,
	type IChannelPluginsSchemas,
	type IChannelPropertyPluginsComponents,
	type IChannelPropertyPluginsSchemas,
	type IDevicePluginRoutes,
	type IDevicePluginsComponents,
	type IDevicePluginsSchemas,
} from '../../modules/devices';

import ModbusConfigForm from './components/modbus-config-form.vue';
import ModbusDeviceSection from './components/modbus-device-section.vue';
import { DEVICES_MODBUS_PLUGIN_NAME, DEVICES_MODBUS_TYPE, RouteNames } from './devices-modbus.constants';
import { locales } from './locales';
import { PluginRoutes } from './router';
import { ModbusConfigEditFormSchema } from './schemas/config.schemas';
import {
	ModbusChannelPropertyCreateReqSchema,
	ModbusChannelPropertySchema,
	ModbusChannelPropertyUpdateReqSchema,
} from './store/channels.properties.store.schemas';
import { ModbusChannelCreateReqSchema, ModbusChannelSchema, ModbusChannelUpdateReqSchema } from './store/channels.store.schemas';
import { ModbusConfigSchema, ModbusConfigUpdateReqSchema } from './store/config.store.schemas';
import { ModbusDeviceCreateReqSchema, ModbusDeviceSchema, ModbusDeviceUpdateReqSchema } from './store/devices.store.schemas';
import { registerModbusEndpointsStore } from './store/endpoints.store';
import { modbusEndpointsStoreKey, modbusTemplatesStoreKey } from './store/keys';
import { registerModbusTemplatesStore } from './store/templates.store';

export const devicesModbusPluginKey: PluginInjectionKey<
	IPlugin<
		IDevicePluginsComponents & IChannelPluginsComponents & IChannelPropertyPluginsComponents & IPluginsComponents,
		IDevicePluginsSchemas & IChannelPluginsSchemas & IChannelPropertyPluginsSchemas & IPluginsSchemas,
		IDevicePluginRoutes
	>
> = Symbol('FB-Plugin-DevicesModbus');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);
		const storesManager = injectStoresManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { devicesModbusPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const endpointsStore = registerModbusEndpointsStore(options.store);
		const templatesStore = registerModbusTemplatesStore(options.store);
		app.provide(modbusEndpointsStoreKey, endpointsStore);
		app.provide(modbusTemplatesStoreKey, templatesStore);
		storesManager.addStore(modbusEndpointsStoreKey, endpointsStore);
		storesManager.addStore(modbusTemplatesStoreKey, templatesStore);

		// Guarded on the devices list route existing so a router that has not finished registering the
		// devices module cannot end up with an orphaned child route.
		const devicesRoute = options.router.getRoutes().find((route) => route.name === DevicesRouteNames.DEVICES);

		if (devicesRoute) {
			PluginRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(DevicesRouteNames.DEVICES, {
					...route,
					beforeEnter: async () => {
						// Resolve at navigation time: plugin installation precedes async config hydration.
						const configPluginsStore = injectStoresManager(app).getStore(configPluginsStoreKey);

						try {
							if (!configPluginsStore.firstLoadFinished()) {
								await configPluginsStore.fetch();
							}
						} catch {
							return { name: DevicesRouteNames.DEVICES };
						}

						return configPluginsStore.findByType(DEVICES_MODBUS_PLUGIN_NAME)?.enabled === true ? true : { name: DevicesRouteNames.DEVICES };
					},
				});
			});
		}

		pluginsManager.addPlugin(devicesModbusPluginKey, {
			type: DEVICES_MODBUS_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.devices-modbus',
			name: 'Modbus',
			description: 'Connect Modbus TCP gateways and map their registers to Smart Panel devices',
			links: {
				documentation: 'https://smart-panel.fastybird.com',
				devDocumentation: 'https://smart-panel.fastybird.com',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: ModbusConfigForm,
					},
					schemas: {
						pluginConfigSchema: ModbusConfigSchema,
						pluginConfigEditFormSchema: ModbusConfigEditFormSchema,
						pluginConfigUpdateReqSchema: ModbusConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
				{
					// Wizard-only: Modbus devices are created through the plugin's own route, so there is no
					// `deviceAddForm`.
					type: DEVICES_MODBUS_TYPE,
					components: {
						deviceDetailSection: ModbusDeviceSection,
					},
					schemas: {
						deviceSchema: ModbusDeviceSchema,
						deviceCreateReqSchema: ModbusDeviceCreateReqSchema,
						deviceUpdateReqSchema: ModbusDeviceUpdateReqSchema,
						channelSchema: ModbusChannelSchema,
						channelCreateReqSchema: ModbusChannelCreateReqSchema,
						channelUpdateReqSchema: ModbusChannelUpdateReqSchema,
						channelPropertySchema: ModbusChannelPropertySchema,
						channelPropertyCreateReqSchema: ModbusChannelPropertyCreateReqSchema,
						channelPropertyUpdateReqSchema: ModbusChannelPropertyUpdateReqSchema,
					},
					modules: [DEVICES_MODULE_NAME],
				},
			],
			...(devicesRoute
				? {
						routes: {
							wizard: {
								label: 'devicesModbusPlugin.wizard.title',
								icon: 'mdi:lan-connect',
								to: { name: RouteNames.WIZARD },
								testId: 'modbus-device-wizard',
								// Endpoint and unit ID are collected only by the wizard; the generic form cannot create a device.
								exclusive: true,
							},
						},
					}
				: {}),
			modules: [DEVICES_MODULE_NAME, CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
