import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { BUDDY_WHATSAPP_PLUGIN_NAME } from './buddy-whatsapp.constants';
import { WhatsappConfigForm } from './components/components';
import enUS from './locales/en-US.json';
import { WhatsappConfigEditFormSchema } from './schemas/schemas';
import { WhatsappConfigSchema, WhatsappConfigUpdateReqSchema } from './store/config.store.schemas';

export const buddyWhatsappPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-BuddyWhatsapp');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { buddyWhatsappPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(buddyWhatsappPluginKey, {
			type: BUDDY_WHATSAPP_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.buddy-whatsapp',
			name: 'WhatsApp',
			description: 'WhatsApp adapter plugin for Buddy module',
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				devDocumentation: 'https://smart-panel.fastybird.com/docs',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: WhatsappConfigForm,
					},
					schemas: {
						pluginConfigSchema: WhatsappConfigSchema,
						pluginConfigEditFormSchema: WhatsappConfigEditFormSchema,
						pluginConfigUpdateReqSchema: WhatsappConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
