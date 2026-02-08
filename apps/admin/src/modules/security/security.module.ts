import type { App } from 'vue';

import type { IModuleOptions } from '../../app.types';
import { type IModule, type ModuleInjectionKey, injectModulesManager } from '../../common';

import { SECURITY_MODULE_NAME } from './security.constants';

const securityAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Security');

export default {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	install: (app: App, options: IModuleOptions): void => {
		const modulesManager = injectModulesManager(app);

		modulesManager.addModule(securityAdminModuleKey, {
			type: SECURITY_MODULE_NAME,
			name: 'Security',
			description: 'Security monitoring with armed state, alarm state, and active alerts management',
			elements: [],
			isCore: true,
		});
	},
};
