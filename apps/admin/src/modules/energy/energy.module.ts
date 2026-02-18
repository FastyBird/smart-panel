import type { App } from 'vue';

import type { IModuleOptions } from '../../app.types';
import { type IModule, type ModuleInjectionKey, injectModulesManager } from '../../common';

import { ENERGY_MODULE_NAME } from './energy.constants';

const energyAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Energy');

export default {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	install: (app: App, options: IModuleOptions): void => {
		const modulesManager = injectModulesManager(app);

		modulesManager.addModule(energyAdminModuleKey, {
			type: ENERGY_MODULE_NAME,
			name: 'Energy',
			description: 'Energy consumption and production monitoring with per-space tracking and historical analysis',
			elements: [],
			isCore: true,
		});
	},
};
