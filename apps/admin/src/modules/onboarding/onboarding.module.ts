import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IModuleOptions } from '../../app.types';
import { injectRouterGuard } from '../../common';

import enUS from './locales/en-US.json';
import { ModuleRoutes, onboardingGuard } from './router';

export default {
	install: (app: App, options: IModuleOptions): void => {
		const routerGuard = injectRouterGuard(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { onboardingModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		// Register onboarding guard — runs BEFORE auth guards since this module is installed first
		routerGuard.register(onboardingGuard);

		// Add onboarding route at top level (not under ROOT — no auth required)
		ModuleRoutes.forEach((route): void => {
			options.router.addRoute(route);
		});
	},
};
