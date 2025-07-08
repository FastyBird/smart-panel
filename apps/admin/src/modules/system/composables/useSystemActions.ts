import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElLoading, ElMessageBox } from 'element-plus';

import { injectAccountManager, useBackend, useFlashMessage, useSockets } from '../../../common';
import { EventHandlerName, EventType, RouteNames, SYSTEM_MODULE_PREFIX } from '../system.constants';

import type { IUseSystemActions } from './types';

export const useSystemActions = (): IUseSystemActions => {
	const router = useRouter();
	const { t } = useI18n();
	const { sendCommand } = useSockets();
	const flashMessage = useFlashMessage();
	const backend = useBackend();

	const accountManager = injectAccountManager();

	const onRestart = (): void => {
		ElMessageBox.confirm(t('systemModule.messages.confirmRestart'), t('systemModule.headings.restart'), {
			confirmButtonText: t('systemModule.buttons.yes.title'),
			cancelButtonText: t('systemModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				const loading = ElLoading.service({
					lock: true,
					text: t('systemModule.texts.rebootInProcess'),
				});

				try {
					const response = await sendCommand(EventType.SYSTEM_REBOOT, null, EventHandlerName.INTERNAL_PLATFORM_ACTION);

					if (response !== true) {
						loading.close();

						flashMessage.error(t('systemModule.messages.rebootFailed'));

						return;
					}

					const timeoutMs = 2 * 60 * 1000; // 2 minutes
					const pollIntervalMs = 3000;
					const startTime = Date.now();

					const waiting = ElLoading.service({
						lock: true,
						text: t('systemModule.messages.waitingToBoot'),
					});

					const checkHealth = async (): Promise<void> => {
						try {
							await backend.client.GET(`/${SYSTEM_MODULE_PREFIX}/system/health`);

							waiting.close();

							flashMessage.success(t('systemModule.messages.panelBackOnline'));
						} catch {
							if (Date.now() - startTime > timeoutMs) {
								waiting.close();

								flashMessage.error(t('systemModule.messages.rebootTakesTooLong'));

								return;
							}

							setTimeout(checkHealth, pollIntervalMs);
						}
					};

					setTimeout(() => {
						void (async () => {
							loading.close();

							await checkHealth();
						})();
					}, 1000);
				} catch {
					loading.close();

					flashMessage.error(t('systemModule.messages.rebootFailed'));
				}
			})
			.catch((): void => {
				// Just ignore
			});
	};

	const onPowerOff = (): void => {
		ElMessageBox.confirm(t('systemModule.messages.confirmPowerOff'), t('systemModule.headings.powerOff'), {
			confirmButtonText: t('systemModule.buttons.yes.title'),
			cancelButtonText: t('systemModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				const loading = ElLoading.service({
					lock: true,
					text: t('systemModule.texts.powerOffInProcess'),
				});

				try {
					const response = await sendCommand(EventType.SYSTEM_POWER_OFF, null, EventHandlerName.INTERNAL_PLATFORM_ACTION);

					if (response !== true) {
						loading.close();

						flashMessage.error(t('systemModule.messages.powerOffFailed'));

						return;
					}

					setTimeout(() => {
						void (async () => {
							loading.close();

							await router.push({ name: RouteNames.POWER_OFF });
						})();
					}, 1000);
				} catch {
					loading.close();

					flashMessage.error(t('systemModule.messages.rebootFailed'));
				}
			})
			.catch((): void => {
				// Just ignore
			});
	};

	const onFactoryReset = (): void => {
		ElMessageBox.confirm(t('systemModule.messages.confirmFactoryReset'), t('systemModule.headings.factoryReset'), {
			confirmButtonText: t('systemModule.buttons.yes.title'),
			cancelButtonText: t('systemModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				const loading = ElLoading.service({
					lock: true,
					text: 'Processing request...',
				});

				const response = await sendCommand(EventType.SYSTEM_FACTORY_RESET, null, EventHandlerName.INTERNAL_PLATFORM_ACTION);

				if (response !== true) {
					loading.close();

					flashMessage.error(t('systemModule.messages.factoryResetFailed'));

					return;
				}

				setTimeout(() => {
					void (async () => {
						loading.close();

						if (accountManager) {
							await accountManager.signOut();

							await router.push({ name: accountManager.routes.signIn });

							flashMessage.success(t('systemModule.messages.factoryResetSuccess'));
						}
					})();
				}, 1000);
			})
			.catch((): void => {
				// Just ignore
			});
	};

	return {
		onRestart,
		onPowerOff,
		onFactoryReset,
	};
};
