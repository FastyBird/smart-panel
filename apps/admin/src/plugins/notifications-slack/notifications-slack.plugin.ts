import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { SlackConfigForm } from './components/components';
import { locales } from './locales';
import { NOTIFICATIONS_SLACK_PLUGIN_NAME } from './notifications-slack.constants';
import { SlackConfigEditFormSchema } from './schemas/schemas';
import { SlackConfigSchema, SlackConfigUpdateReqSchema } from './store/config.store.schemas';

export const notificationsSlackPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-NotificationsSlack');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { notificationsSlackPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(notificationsSlackPluginKey, {
			type: NOTIFICATIONS_SLACK_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.notifications-slack',
			name: 'Slack',
			description: 'Forwards system notifications to a Slack channel through an incoming webhook',
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				devDocumentation: 'https://api.slack.com/messaging/webhooks',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: SlackConfigForm,
					},
					schemas: {
						pluginConfigSchema: SlackConfigSchema,
						pluginConfigEditFormSchema: SlackConfigEditFormSchema,
						pluginConfigUpdateReqSchema: SlackConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
