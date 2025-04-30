import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import {
	ChannelPropertySchema,
	ChannelSchema,
	DEVICES_MODULE_NAME,
	type IChannelPluginsComponents,
	type IChannelPluginsSchemas,
	type IChannelPropertyPluginsComponents,
	type IChannelPropertyPluginsSchemas,
	type IDevicePluginsComponents,
	type IDevicePluginsSchemas,
} from '../../modules/devices';

import { ThirdPartyDeviceAddForm, ThirdPartyDeviceEditForm } from './components/components';
import enUS from './locales/en-US.json';
import { ThirdPartyDeviceAddFormSchema, ThirdPartyDeviceEditFormSchema } from './schemas/devices.schemas';
import { ThirdPartyDeviceCreateReqSchema, ThirdPartyDeviceSchema, ThirdPartyDeviceUpdateReqSchema } from './store/devices.store.schemas';

export const devicesThirdPartyPluginKey: PluginInjectionKey<
	IPlugin<
		IDevicePluginsComponents & IChannelPluginsComponents & IChannelPropertyPluginsComponents,
		IDevicePluginsSchemas & IChannelPluginsSchemas & IChannelPropertyPluginsSchemas
	>
> = Symbol('FB-Plugin-DevicesThirdParty');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { devicesThirdPartyPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(devicesThirdPartyPluginKey, {
			type: 'third-party',
			source: 'com.fastybird.smart-panel.plugin.devices-third-party',
			name: 'Third Party Devices',
			description: 'Third party devices plugin for FastyBird IoT Smart Panel',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			components: {
				deviceAddForm: ThirdPartyDeviceAddForm,
				deviceEditForm: ThirdPartyDeviceEditForm,
			},
			schemas: {
				deviceSchema: ThirdPartyDeviceSchema,
				deviceAddFormSchema: ThirdPartyDeviceAddFormSchema,
				deviceEditFormSchema: ThirdPartyDeviceEditFormSchema,
				deviceCreateReqSchema: ThirdPartyDeviceCreateReqSchema,
				deviceUpdateReqSchema: ThirdPartyDeviceUpdateReqSchema,
				channelSchema: ChannelSchema,
				channelPropertySchema: ChannelPropertySchema,
			},
			modules: [DEVICES_MODULE_NAME],
			isCore: true,
		});
	},
};
