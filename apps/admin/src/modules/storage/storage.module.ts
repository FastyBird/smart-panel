import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IModuleOptions } from '../../app.types';
import {
	type IModule,
	type ModuleInjectionKey,
	injectModulesManager,
} from '../../common';
import { CONFIG_MODULE_MODULE_TYPE, CONFIG_MODULE_NAME } from '../config';

import { StorageConfigForm } from './components/components';
import { STORAGE_MODULE_NAME } from './storage.constants';
import { locales } from './locales';
import { StorageConfigEditFormSchema } from './schemas/config.schemas';
import { StorageConfigSchema, StorageConfigUpdateReqSchema } from './store/config.store.schemas';

const storageAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Storage');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const modulesManager = injectModulesManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { storageModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		modulesManager.addModule(storageAdminModuleKey, {
			type: STORAGE_MODULE_NAME,
			name: 'Storage',
			description: 'Data storage configuration for device data history and analytics',
			elements: [
				{
					type: CONFIG_MODULE_MODULE_TYPE,
					components: {
						moduleConfigEditForm: StorageConfigForm,
					},
					schemas: {
						moduleConfigSchema: StorageConfigSchema,
						moduleConfigEditFormSchema: StorageConfigEditFormSchema,
						moduleConfigUpdateReqSchema: StorageConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
