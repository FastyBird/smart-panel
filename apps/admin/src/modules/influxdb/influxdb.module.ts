import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IModuleOptions } from '../../app.types';
import {
	type IModule,
	type ModuleInjectionKey,
	injectModulesManager,
} from '../../common';
import { CONFIG_MODULE_MODULE_TYPE, CONFIG_MODULE_NAME } from '../config';

import { InfluxDbConfigForm } from './components/components';
import { INFLUXDB_MODULE_NAME } from './influxdb.constants';
import enUS from './locales/en-US.json';
import { InfluxDbConfigEditFormSchema } from './schemas/config.schemas';
import { InfluxDbConfigSchema, InfluxDbConfigUpdateReqSchema } from './store/config.store.schemas';

const influxdbAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Influxdb');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const modulesManager = injectModulesManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { influxdbModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		modulesManager.addModule(influxdbAdminModuleKey, {
			type: INFLUXDB_MODULE_NAME,
			name: 'InfluxDB',
			description: 'Time-series database for device data history and analytics',
			elements: [
				{
					type: CONFIG_MODULE_MODULE_TYPE,
					components: {
						moduleConfigEditForm: InfluxDbConfigForm,
					},
					schemas: {
						moduleConfigSchema: InfluxDbConfigSchema,
						moduleConfigEditFormSchema: InfluxDbConfigEditFormSchema,
						moduleConfigUpdateReqSchema: InfluxDbConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
