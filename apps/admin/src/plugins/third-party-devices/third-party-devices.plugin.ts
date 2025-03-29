import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { DEVICES_MODULE_NAME, type IPluginsComponents, type IPluginsSchemas } from '../../modules/devices';

import { ThirdPartyDeviceAddForm, ThirdPartyDeviceEditForm } from './components';
import enUS from './locales/en-US.json';
import { ThirdPartyDeviceCreateReqSchema, ThirdPartyDeviceResSchema, ThirdPartyDeviceSchema, ThirdPartyDeviceUpdateReqSchema } from './store';

export const thirdPartyDevicesPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-ThirdPartyDevices');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { thirdPartyDevicesPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(thirdPartyDevicesPluginKey, {
			type: 'third-party',
			source: 'com.fastybird.smart-panel.third-party-devices',
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
				deviceCreateReqSchema: ThirdPartyDeviceCreateReqSchema,
				deviceUpdateReqSchema: ThirdPartyDeviceUpdateReqSchema,
				deviceResSchema: ThirdPartyDeviceResSchema,
			},
			modules: [DEVICES_MODULE_NAME],
			isCore: true,
		});
	},
};
