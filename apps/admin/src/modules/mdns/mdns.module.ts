import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IModuleOptions } from '../../app.types';
import {
	type IModule,
	type ModuleInjectionKey,
	injectModulesManager,
} from '../../common';
import { CONFIG_MODULE_MODULE_TYPE, CONFIG_MODULE_NAME } from '../config';

import { MdnsConfigForm } from './components/components';
import { MDNS_MODULE_NAME } from './mdns.constants';
import enUS from './locales/en-US.json';
import { MdnsConfigEditFormSchema } from './schemas/config.schemas';
import { MdnsConfigSchema, MdnsConfigUpdateReqSchema } from './store/config.store.schemas';

const mdnsAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Mdns');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const modulesManager = injectModulesManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { mdnsModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		modulesManager.addModule(mdnsAdminModuleKey, {
			type: MDNS_MODULE_NAME,
			name: 'mDNS Module',
			description: 'Configure mDNS service advertisement settings',
			elements: [
				{
					type: CONFIG_MODULE_MODULE_TYPE,
					components: {
						moduleConfigEditForm: MdnsConfigForm,
					},
					schemas: {
						moduleConfigSchema: MdnsConfigSchema,
						moduleConfigEditFormSchema: MdnsConfigEditFormSchema,
						moduleConfigUpdateReqSchema: MdnsConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
