import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';
import {
	DEVICES_MODULE_NAME,
	type IChannelPluginsComponents,
	type IChannelPluginsSchemas,
	type IChannelPropertyPluginsComponents,
	type IChannelPropertyPluginsSchemas,
	type IDevicePluginsComponents,
	type IDevicePluginsSchemas,
} from '../../modules/devices';

import { ZigbeeHerdsmanConfigForm, ZigbeeHerdsmanDeviceAddForm, ZigbeeHerdsmanDeviceEditForm } from './components/components';
import { DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME, DEVICES_ZIGBEE_HERDSMAN_TYPE } from './devices-zigbee-herdsman.constants';
import { locales } from './locales';
import { ZigbeeHerdsmanConfigEditFormSchema } from './schemas/config.schemas';
import { ZigbeeHerdsmanDeviceAddFormSchema, ZigbeeHerdsmanDeviceEditFormSchema } from './schemas/devices.schemas';
import {
	ZigbeeHerdsmanChannelPropertyCreateReqSchema,
	ZigbeeHerdsmanChannelPropertySchema,
	ZigbeeHerdsmanChannelPropertyUpdateReqSchema,
} from './store/channels.properties.store.schemas';
import { ZigbeeHerdsmanChannelCreateReqSchema, ZigbeeHerdsmanChannelSchema, ZigbeeHerdsmanChannelUpdateReqSchema } from './store/channels.store.schemas';
import { ZigbeeHerdsmanConfigSchema, ZigbeeHerdsmanConfigUpdateReqSchema } from './store/config.store.schemas';
import { ZigbeeHerdsmanDeviceCreateReqSchema, ZigbeeHerdsmanDeviceSchema, ZigbeeHerdsmanDeviceUpdateReqSchema } from './store/devices.store.schemas';

export const devicesZigbeeHerdsmanPluginKey: PluginInjectionKey<
	IPlugin<
		IDevicePluginsComponents & IChannelPluginsComponents & IChannelPropertyPluginsComponents & IPluginsComponents,
		IDevicePluginsSchemas & IChannelPluginsSchemas & IChannelPropertyPluginsSchemas & IPluginsSchemas
	>
> = Symbol('FB-Plugin-DevicesZigbeeHerdsman');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { devicesZigbeeHerdsmanPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(devicesZigbeeHerdsmanPluginKey, {
			type: DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.devices-zigbee-herdsman',
			name: 'Zigbee Herdsman',
			description: 'Connect and control your Zigbee devices directly via Zigbee Herdsman from the FastyBird Smart Panel',
			links: {
				documentation: 'https://smart-panel.fastybird.com',
				devDocumentation: 'https://smart-panel.fastybird.com',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: ZigbeeHerdsmanConfigForm,
					},
					schemas: {
						pluginConfigSchema: ZigbeeHerdsmanConfigSchema,
						pluginConfigEditFormSchema: ZigbeeHerdsmanConfigEditFormSchema,
						pluginConfigUpdateReqSchema: ZigbeeHerdsmanConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
				{
					type: DEVICES_ZIGBEE_HERDSMAN_TYPE,
					components: {
						deviceAddForm: ZigbeeHerdsmanDeviceAddForm,
						deviceEditForm: ZigbeeHerdsmanDeviceEditForm,
					},
					schemas: {
						deviceSchema: ZigbeeHerdsmanDeviceSchema,
						deviceAddFormSchema: ZigbeeHerdsmanDeviceAddFormSchema,
						deviceEditFormSchema: ZigbeeHerdsmanDeviceEditFormSchema,
						deviceCreateReqSchema: ZigbeeHerdsmanDeviceCreateReqSchema,
						deviceUpdateReqSchema: ZigbeeHerdsmanDeviceUpdateReqSchema,
						channelSchema: ZigbeeHerdsmanChannelSchema,
						channelCreateReqSchema: ZigbeeHerdsmanChannelCreateReqSchema,
						channelUpdateReqSchema: ZigbeeHerdsmanChannelUpdateReqSchema,
						channelPropertySchema: ZigbeeHerdsmanChannelPropertySchema,
						channelPropertyCreateReqSchema: ZigbeeHerdsmanChannelPropertyCreateReqSchema,
						channelPropertyUpdateReqSchema: ZigbeeHerdsmanChannelPropertyUpdateReqSchema,
					},
					modules: [DEVICES_MODULE_NAME],
				},
			],
			modules: [DEVICES_MODULE_NAME, CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
