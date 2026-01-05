import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IModuleOptions } from '../../app.types';
import { type IModule, type ModuleInjectionKey, injectModulesManager } from '../../common';

import { INTENTS_MODULE_NAME } from './intents.constants';
import enUS from './locales/en-US.json';

const intentsAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Intents');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const modulesManager = injectModulesManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { intentsModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		modulesManager.addModule(intentsAdminModuleKey, {
			type: INTENTS_MODULE_NAME,
			name: 'Intents',
			description: 'Intent orchestration for UI anti-jitter and optimistic updates',
			elements: [],
			isCore: true,
		});
	},
};
