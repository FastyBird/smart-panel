import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import {
	CONFIG_MODULE_NAME,
	CONFIG_MODULE_PLUGIN_TYPE,
	type IPluginsComponents,
	type IPluginsSchemas,
} from '../../modules/config';
import {
	DEVICES_MODULE_NAME,
	type IChannelPluginsComponents,
	type IChannelPluginsSchemas,
	type IChannelPropertyPluginsComponents,
	type IChannelPropertyPluginsSchemas,
	type IDevicePluginsComponents,
	type IDevicePluginsSchemas,
} from '../../modules/devices';

import { SimulatorConfigForm } from './components/components';
import { DEVICES_SIMULATOR_PLUGIN_NAME, DEVICES_SIMULATOR_TYPE } from './devices-simulator.constants';
import enUS from './locales/en-US.json';
import { SimulatorConfigEditFormSchema } from './schemas/config.schemas';
import { SimulatorDeviceAddFormSchema, SimulatorDeviceEditFormSchema } from './schemas/devices.schemas';
import { SimulatorChannelPropertySchema } from './store/channels.properties.store.schemas';
import { SimulatorChannelSchema } from './store/channels.store.schemas';
import { SimulatorConfigSchema, SimulatorConfigUpdateReqSchema } from './store/config.store.schemas';
import { SimulatorDeviceCreateReqSchema, SimulatorDeviceSchema, SimulatorDeviceUpdateReqSchema } from './store/devices.store.schemas';

export const devicesSimulatorPluginKey: PluginInjectionKey<
	IPlugin<
		IDevicePluginsComponents & IChannelPluginsComponents & IChannelPropertyPluginsComponents & IPluginsComponents,
		IDevicePluginsSchemas & IChannelPluginsSchemas & IChannelPropertyPluginsSchemas & IPluginsSchemas
	>
> = Symbol('FB-Plugin-DevicesSimulator');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { devicesSimulatorPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(devicesSimulatorPluginKey, {
			type: DEVICES_SIMULATOR_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.devices-simulator',
			name: 'Device Simulator',
			description: 'Create virtual devices for testing and development without physical hardware',
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				devDocumentation: 'https://smart-panel.fastybird.com/docs',
				bugsTracking: 'https://github.com/FastyBird/smart-panel/issues',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: SimulatorConfigForm,
					},
					schemas: {
						pluginConfigSchema: SimulatorConfigSchema,
						pluginConfigEditFormSchema: SimulatorConfigEditFormSchema,
						pluginConfigUpdateReqSchema: SimulatorConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
				{
					type: DEVICES_SIMULATOR_TYPE,
					schemas: {
						deviceSchema: SimulatorDeviceSchema,
						deviceAddFormSchema: SimulatorDeviceAddFormSchema,
						deviceEditFormSchema: SimulatorDeviceEditFormSchema,
						deviceCreateReqSchema: SimulatorDeviceCreateReqSchema,
						deviceUpdateReqSchema: SimulatorDeviceUpdateReqSchema,
						channelSchema: SimulatorChannelSchema,
						channelPropertySchema: SimulatorChannelPropertySchema,
					},
				},
			],
			modules: [DEVICES_MODULE_NAME, CONFIG_MODULE_NAME],
			isCore: false,
		});
	},
};
