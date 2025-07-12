import { type App, type InjectionKey, inject as _inject, hasInjectionContext } from 'vue';
import type { Composer } from 'vue-i18n';
import type { Router } from 'vue-router';

import { ElLoading, ElNotification } from 'element-plus';
import type { LoadingInstance } from 'element-plus/es/components/loading/src/loading';
import type { Client } from 'openapi-fetch';

import { type IAccountManager, injectAccountManager, injectBackendClient } from '../../../common';
import type { paths } from '../../../openapi';
import { RouteNames, SYSTEM_MODULE_PREFIX } from '../system.constants';

export const systemActionsKey: InjectionKey<SystemActionsService | undefined> = Symbol('FB-System-Module-SystemActionsService');

export class SystemActionsService {
	private readonly backend: Client<paths>;
	private readonly accountManager: IAccountManager | undefined;
	private readonly router: Router;
	private readonly t: Composer['t'];

	private rebootLoading: LoadingInstance | null = null;
	private powerOffLoading: LoadingInstance | null = null;
	private factoryResetLoading: LoadingInstance | null = null;

	private rebootWaiting: LoadingInstance | null = null;

	constructor(app: App, router: Router, i18n: Composer) {
		this.backend = injectBackendClient(app);
		this.accountManager = injectAccountManager(app);
		this.router = router;
		this.t = i18n.t; // store the `t` function
	}

	reboot(state: 'in-progress' | 'err' | 'ok'): void {
		if (this.rebootLoading === null && state === 'in-progress') {
			this.rebootLoading = ElLoading.service({
				lock: true,
				text: this.t('systemModule.texts.rebootInProcess'),
			});
		} else if (state === 'err' || state === 'ok') {
			setTimeout(() => {
				if (this.rebootWaiting !== null) {
					return;
				}

				this.rebootLoading?.close();

				this.rebootLoading = null;

				if (state === 'ok') {
					const startTime = Date.now();

					this.rebootWaiting = ElLoading.service({
						lock: true,
						text: this.t('systemModule.messages.waitingToBoot'),
					});

					void (async () => {
						await this.checkHealth({
							startTime,
							timeoutMs: 2 * 60 * 1000,
							onDone: () => {
								this.rebootWaiting?.close();

								this.rebootWaiting = null;
							},
							onFail: () => {
								this.rebootWaiting?.close();

								this.rebootWaiting = null;
							},
						});
					})();
				}
			}, 1000);
		}
	}

	powerOff(state: 'in-progress' | 'err' | 'ok'): void {
		if (this.powerOffLoading === null && state === 'in-progress') {
			this.powerOffLoading = ElLoading.service({
				lock: true,
				text: this.t('systemModule.texts.powerOffInProcess'),
			});
		} else if (state === 'err' || state === 'ok') {
			setTimeout(() => {
				this.powerOffLoading?.close();

				this.powerOffLoading = null;

				if (state === 'ok') {
					void (async () => {
						await this.router.push({ name: RouteNames.POWER_OFF });
					})();
				}
			}, 1000);
		}
	}

	factoryReset(state: 'in-progress' | 'err' | 'ok'): void {
		if (this.factoryResetLoading === null && state === 'in-progress') {
			this.factoryResetLoading = ElLoading.service({
				lock: true,
				text: this.t('systemModule.texts.factoryResetInProcess'),
			});
		} else if (state === 'err' || state === 'ok') {
			setTimeout(() => {
				this.factoryResetLoading?.close();

				this.factoryResetLoading = null;

				if (state === 'ok') {
					void (async () => {
						if (this.accountManager) {
							await this.accountManager.signOut();

							await this.router.push({ name: this.accountManager.routes.signIn });

							ElNotification.success(this.t('systemModule.messages.factoryResetSuccess'));
						}
					})();
				}
			}, 1000);
		}
	}

	private async checkHealth({
		startTime,
		timeoutMs,
		onDone,
		onFail,
	}: {
		startTime: number;
		timeoutMs: number;
		onDone?: () => void;
		onFail?: () => void;
	}): Promise<void> {
		try {
			await this.backend.GET(`/${SYSTEM_MODULE_PREFIX}/system/health`);

			ElNotification.success(this.t('systemModule.messages.panelBackOnline'));

			onDone?.();
		} catch {
			if (Date.now() - startTime > timeoutMs) {
				ElNotification.error(this.t('systemModule.messages.rebootTakesTooLong'));

				onFail?.();

				return;
			}

			setTimeout(() => {
				this.checkHealth({ startTime, timeoutMs, onDone, onFail });
			}, 3000);
		}
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
