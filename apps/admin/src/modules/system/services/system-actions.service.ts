import { type App, type InjectionKey, inject as _inject, hasInjectionContext } from 'vue';
import type { Composer } from 'vue-i18n';
import type { Router } from 'vue-router';

import { ElLoading, ElNotification } from 'element-plus';
import type { LoadingInstance } from 'element-plus/es/components/loading/src/loading';

import { injectAccountManager } from '../../../common';
import { invalidateOnboardingStatus } from '../../onboarding/composables/useOnboardingStatus';
import { RouteNames } from '../system.constants';

export const systemActionsKey: InjectionKey<SystemActionsService | undefined> = Symbol('FB-System-Module-SystemActionsService');

export class SystemActionsService {
	private readonly app: App;

	private readonly router: Router;
	private readonly t: Composer['t'];

	private rebootLoading: LoadingInstance | null = null;
	private powerOffLoading: LoadingInstance | null = null;
	private factoryResetLoading: LoadingInstance | null = null;

	private rebootTriggeredBy: 'action' | 'event' | null = null;
	private powerOffTriggeredBy: 'action' | 'event' | null = null;
	private factoryResetTriggeredBy: 'action' | 'event' | null = null;

	constructor(app: App, router: Router, i18n: Composer) {
		this.app = app;

		this.router = router;
		this.t = i18n.t;
	}

	reboot(state: 'in-progress' | 'err' | 'ok', trigger: 'action' | 'event'): void {
		if (state === 'in-progress') {
			if (this.rebootLoading !== null) return;

			this.rebootTriggeredBy = trigger;

			if (trigger === 'event') {
				// External trigger — navigate directly, backend may go down before 'ok'
				void this.router.push({ name: RouteNames.REBOOTING });
			} else {
				this.rebootLoading = ElLoading.service({
					lock: true,
					text: this.t('systemModule.texts.manage.rebootInProcess'),
				});
			}
		} else if (state === 'ok') {
			this.rebootLoading?.close();
			this.rebootLoading = null;

			// Navigate regardless of trigger — handles both local action confirmation
			// and external event where 'processing' may have been missed
			setTimeout(() => {
				void this.router.push({ name: RouteNames.REBOOTING });
			}, 500);
		} else if (state === 'err') {
			this.rebootLoading?.close();
			this.rebootLoading = null;
		}
	}

	powerOff(state: 'in-progress' | 'err' | 'ok', trigger: 'action' | 'event'): void {
		if (state === 'in-progress') {
			if (this.powerOffLoading !== null) return;

			this.powerOffTriggeredBy = trigger;

			if (trigger === 'event') {
				void this.router.push({ name: RouteNames.POWER_OFF });
			} else {
				this.powerOffLoading = ElLoading.service({
					lock: true,
					text: this.t('systemModule.texts.manage.powerOffInProcess'),
				});
			}
		} else if (state === 'ok') {
			this.powerOffLoading?.close();
			this.powerOffLoading = null;

			setTimeout(() => {
				void this.router.push({ name: RouteNames.POWER_OFF });
			}, 500);
		} else if (state === 'err') {
			this.powerOffLoading?.close();
			this.powerOffLoading = null;
		}
	}

	factoryReset(state: 'in-progress' | 'err', trigger: 'action' | 'event'): void {
		if (state === 'in-progress') {
			if (this.factoryResetLoading !== null) return;

			this.factoryResetTriggeredBy = trigger;

			if (trigger === 'event') {
				// External trigger — sign out and navigate immediately
				void this.handleFactoryResetRedirect();
			} else {
				this.factoryResetLoading = ElLoading.service({
					lock: true,
					text: this.t('systemModule.texts.manage.factoryResetInProcess'),
				});
			}
		} else if (state === 'err') {
			this.factoryResetLoading?.close();
			this.factoryResetLoading = null;
		}
	}

	isFactoryResetDone(): boolean {
		return this.factoryResetTriggeredBy === null && this.factoryResetLoading === null;
	}

	async factoryResetDone(): Promise<void> {
		// Guard against duplicate execution from both action response and WS event
		if (this.factoryResetTriggeredBy === null) return;
		this.factoryResetTriggeredBy = null;

		this.factoryResetLoading?.close();
		this.factoryResetLoading = null;

		ElNotification.success(this.t('systemModule.messages.manage.factoryResetSuccess'));

		await this.handleFactoryResetRedirect();
	}

	private async handleFactoryResetRedirect(): Promise<void> {
		const accountManager = injectAccountManager(this.app);

		if (accountManager) {
			await accountManager.signOut();
		}

		// Clear cached onboarding status so the onboarding guard doesn't
		// redirect away based on stale "onboarding completed" data.
		invalidateOnboardingStatus();

		// Navigate to the factory reset waiting page which polls health
		// and redirects to sign-in when the backend comes back online.
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
