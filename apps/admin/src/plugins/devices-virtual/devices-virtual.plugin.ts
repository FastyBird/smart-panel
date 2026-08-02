import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import {
	DEVICES_MODULE_NAME,
	type IChannelPluginsComponents,
	type IChannelPluginsSchemas,
	type IChannelPropertyPluginsComponents,
	type IChannelPropertyPluginsSchemas,
	type IDevicePluginsComponents,
	type IDevicePluginsSchemas,
} from '../../modules/devices';

import { VirtualDeviceAddForm, VirtualDeviceEditForm } from './components/components';
import { DEVICES_VIRTUAL_PLUGIN_NAME, DEVICES_VIRTUAL_TYPE } from './devices-virtual.constants';
import { locales } from './locales';
import { VirtualDeviceAddFormSchema, VirtualDeviceEditFormSchema } from './schemas/devices.schemas';
import { VirtualChannelPropertySchema } from './store/channels.properties.store.schemas';
import { VirtualChannelSchema } from './store/channels.store.schemas';
import { VirtualDeviceCreateReqSchema, VirtualDeviceSchema, VirtualDeviceUpdateReqSchema } from './store/devices.store.schemas';

export const devicesVirtualPluginKey: PluginInjectionKey<
	IPlugin<
		IDevicePluginsComponents & IChannelPluginsComponents & IChannelPropertyPluginsComponents,
		IDevicePluginsSchemas & IChannelPluginsSchemas & IChannelPropertyPluginsSchemas
	>
> = Symbol('FB-Plugin-DevicesVirtual');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { devicesVirtualPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(devicesVirtualPluginKey, {
			type: DEVICES_VIRTUAL_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.devices-virtual',
			name: 'Virtual Devices',
			description: 'Build devices by splitting or combining the channels and properties of other devices',
			links: {
				documentation: 'https://smart-panel.fastybird.com',
				devDocumentation: 'https://smart-panel.fastybird.com',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: DEVICES_VIRTUAL_TYPE,
					components: {
						deviceAddForm: VirtualDeviceAddForm,
						deviceEditForm: VirtualDeviceEditForm,
					},
					schemas: {
						deviceSchema: VirtualDeviceSchema,
						deviceAddFormSchema: VirtualDeviceAddFormSchema,
						deviceEditFormSchema: VirtualDeviceEditFormSchema,
						deviceCreateReqSchema: VirtualDeviceCreateReqSchema,
						deviceUpdateReqSchema: VirtualDeviceUpdateReqSchema,
						channelSchema: VirtualChannelSchema,
						channelPropertySchema: VirtualChannelPropertySchema,
					},
				},
			],
			modules: [DEVICES_MODULE_NAME],
			isCore: true,
		});
	},
};
