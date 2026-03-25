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
		if (this.rebootLoading === null && state === 'in-progress') {
			this.rebootTriggeredBy = trigger;

			this.rebootLoading = ElLoading.service({
				lock: true,
				text: this.t('systemModule.texts.manage.rebootInProcess'),
			});
		} else if (this.rebootTriggeredBy === trigger && this.rebootLoading !== null && (state === 'err' || state === 'ok')) {
			setTimeout(() => {
				this.rebootLoading?.close();
				this.rebootLoading = null;

				if (state === 'ok') {
					void this.router.push({ name: RouteNames.REBOOTING });
				}
			}, 1000);
		}
	}

	powerOff(state: 'in-progress' | 'err' | 'ok', trigger: 'action' | 'event'): void {
		if (this.powerOffLoading === null && state === 'in-progress') {
			this.powerOffTriggeredBy = trigger;

			this.powerOffLoading = ElLoading.service({
				lock: true,
				text: this.t('systemModule.texts.manage.powerOffInProcess'),
			});
		} else if (this.powerOffTriggeredBy === trigger && this.powerOffLoading !== null && (state === 'err' || state === 'ok')) {
			setTimeout(() => {
				this.powerOffLoading?.close();
				this.powerOffLoading = null;

				if (state === 'ok') {
					void this.router.push({ name: RouteNames.POWER_OFF });
				}
			}, 1000);
		}
	}

	factoryReset(state: 'in-progress' | 'err', trigger: 'action' | 'event'): void {
		if (this.factoryResetLoading === null && state === 'in-progress') {
			this.factoryResetTriggeredBy = trigger;

			this.factoryResetLoading = ElLoading.service({
				lock: true,
				text: this.t('systemModule.texts.manage.factoryResetInProcess'),
			});
		} else if (this.factoryResetTriggeredBy === trigger && this.factoryResetLoading !== null && state === 'err') {
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

		const accountManager = injectAccountManager(this.app);

		if (accountManager) {
			await accountManager.signOut();
		}

		// Clear cached onboarding status so the onboarding guard doesn't
		// redirect away based on stale "onboarding completed" data.
		invalidateOnboardingStatus();

		ElNotification.success(this.t('systemModule.messages.manage.factoryResetSuccess'));

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
