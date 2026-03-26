import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IModuleOptions } from '../../app.types';
import { injectRouterGuard } from '../../common';

import { useOnboardingStatus } from './composables/composables';
import { locales } from './locales';
import { ModuleRoutes, onboardingGuard } from './router';

export default {
	install: (app: App, options: IModuleOptions): void => {
		const routerGuard = injectRouterGuard(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { onboardingModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		// Pre-fetch onboarding status before the synchronous guard chain runs.
		// Vue Router beforeEach supports async — this ensures the cache is warm
		// before onboardingGuard reads it synchronously.
		options.router.beforeEach(async () => {
			const { isOnboardingCompleted, fetchStatus } = useOnboardingStatus();

			// Once onboarding is known complete, skip fetching entirely
			if (isOnboardingCompleted.value) return;

			try {
				await fetchStatus();
			} catch {
				// If backend is unreachable, allow navigation
			}
		});

		// Register onboarding guard — runs BEFORE auth guards since this module is installed first
		routerGuard.register(onboardingGuard);

		// Add onboarding route at top level (not under ROOT — no auth required)
		ModuleRoutes.forEach((route): void => {
			options.router.addRoute(route);
		});
	},
};
