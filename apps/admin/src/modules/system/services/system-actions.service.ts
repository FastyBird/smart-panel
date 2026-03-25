import { type App, type InjectionKey, inject as _inject, hasInjectionContext } from 'vue';
import type { Composer } from 'vue-i18n';
import type { Router } from 'vue-router';

import { ElNotification } from 'element-plus';

import { injectAccountManager } from '../../../common';
import { invalidateOnboardingStatus } from '../../onboarding/composables/useOnboardingStatus';
import { RouteNames } from '../system.constants';

export const systemActionsKey: InjectionKey<SystemActionsService | undefined> = Symbol('FB-System-Module-SystemActionsService');

export class SystemActionsService {
	private readonly app: App;

	private readonly router: Router;
	private readonly t: Composer['t'];

	private factoryResetTriggeredBy: 'action' | 'event' | null = null;

	constructor(app: App, router: Router, i18n: Composer) {
		this.app = app;

		this.router = router;
		this.t = i18n.t;
	}

	reboot(): void {
		void this.router.push({ name: RouteNames.REBOOTING });
	}

	powerOff(): void {
		void this.router.push({ name: RouteNames.POWER_OFF });
	}

	factoryReset(): void {
		// No-op for in-progress — handled by factoryResetDone
	}

	isFactoryResetDone(): boolean {
		return this.factoryResetTriggeredBy === null;
	}

	async factoryResetDone(): Promise<void> {
		// Guard against duplicate execution from both action response and WS event
		if (this.factoryResetTriggeredBy === null) return;
		this.factoryResetTriggeredBy = null;

		ElNotification.success(this.t('systemModule.messages.manage.factoryResetSuccess'));

		await this.handleFactoryResetRedirect();
	}

	setFactoryResetTrigger(trigger: 'action' | 'event'): void {
		this.factoryResetTriggeredBy = trigger;
	}

	async handleFactoryResetRedirect(): Promise<void> {
		const accountManager = injectAccountManager(this.app);

		if (accountManager) {
			await accountManager.signOut();
		}

		invalidateOnboardingStatus();

		await this.router.push({ name: RouteNames.FACTORY_RESET });
	}
}

export const injectSystemActionsService = (app?: App): SystemActionsService => {
	if (app && app._context && app._context.provides && app._context.provides[systemActionsKey]) {
		return app._context.provides[systemActionsKey];
	}

	if (hasInjectionContext()) {
		const service = _inject(systemActionsKey, undefined);

		if (service) {
			return service;
		}
	}

	throw new Error('A system actions service has not been provided.');
};

export const provideSystemActionsService = (app: App, service: SystemActionsService): void => {
	app.provide(systemActionsKey, service);
};
