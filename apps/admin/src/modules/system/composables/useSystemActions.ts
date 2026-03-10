import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { useFlashMessage, useSockets } from '../../../common';
import { useConfigModule } from '../../config/composables/composables';
import type { IDisplaysConfigModule } from '../../displays/store/config.store.types';
import { useOnboardingStatus } from '../../onboarding/composables/composables';
import { injectSystemActionsService } from '../services/system-actions.service';
import { EventHandlerName, EventType } from '../system.constants';

import type { IUseSystemActions } from './types';

export const useSystemActions = (): IUseSystemActions => {
	const systemActions = injectSystemActionsService();

	const { t } = useI18n();
	const { sendCommand } = useSockets();
	const flashMessage = useFlashMessage();
	const { invalidate: invalidateOnboarding } = useOnboardingStatus();

	const { configModule: displaysConfig } = useConfigModule({ type: 'displays-module' });

	const isGatewayMode = (): boolean => {
		const config = displaysConfig.value as IDisplaysConfigModule | null;

		return config !== null && config.deploymentMode !== 'all-in-one';
	};

	const onRestart = (): void => {
		const gateway = isGatewayMode();
		const confirmMsg = gateway
			? t('systemModule.messages.manage.confirmRestartGateway')
			: t('systemModule.messages.manage.confirmRestart');

		ElMessageBox.confirm(confirmMsg, t('systemModule.headings.manage.restart'), {
			confirmButtonText: t('systemModule.buttons.yes.title'),
			cancelButtonText: t('systemModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				systemActions.reboot('in-progress', 'action');

				try {
					const response = await sendCommand(EventType.SYSTEM_REBOOT_SET, null, EventHandlerName.INTERNAL_PLATFORM_ACTION);

					if (response !== true) {
						systemActions.reboot('err', 'action');

						flashMessage.error(t('systemModule.messages.manage.rebootFailed'));

						return;
					}

					systemActions.reboot('ok', 'action');
				} catch {
					systemActions.reboot('err', 'action');

					flashMessage.error(t('systemModule.messages.manage.rebootFailed'));
				}
			})
			.catch((): void => {
				// Just ignore
			});
	};

	const onPowerOff = (): void => {
		const gateway = isGatewayMode();
		const confirmMsg = gateway
			? t('systemModule.messages.manage.confirmPowerOffGateway')
			: t('systemModule.messages.manage.confirmPowerOff');

		ElMessageBox.confirm(confirmMsg, t('systemModule.headings.manage.powerOff'), {
			confirmButtonText: t('systemModule.buttons.yes.title'),
			cancelButtonText: t('systemModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				systemActions.powerOff('in-progress', 'action');

				try {
					const response = await sendCommand(EventType.SYSTEM_POWER_OFF_SET, null, EventHandlerName.INTERNAL_PLATFORM_ACTION);

					if (response !== true) {
						systemActions.powerOff('err', 'action');

						flashMessage.error(t('systemModule.messages.manage.powerOffFailed'));

						return;
					}

					systemActions.powerOff('ok', 'action');
				} catch {
					systemActions.powerOff('err', 'action');

					flashMessage.error(t('systemModule.messages.manage.rebootFailed'));
				}
			})
			.catch((): void => {
				// Just ignore
			});
	};

	const onFactoryReset = (): void => {
		const gateway = isGatewayMode();
		const confirmMsg = gateway
			? t('systemModule.messages.manage.confirmFactoryResetGateway')
			: t('systemModule.messages.manage.confirmFactoryReset');

		ElMessageBox.confirm(confirmMsg, t('systemModule.headings.manage.factoryReset'), {
			confirmButtonText: t('systemModule.buttons.yes.title'),
			cancelButtonText: t('systemModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				systemActions.factoryReset('in-progress', 'action');

				try {
					const response = await sendCommand(EventType.SYSTEM_FACTORY_RESET_SET, null, EventHandlerName.INTERNAL_PLATFORM_ACTION, 30_000);

					if (response !== true) {
						systemActions.factoryReset('err', 'action');

						flashMessage.error(t('systemModule.messages.manage.factoryResetFailed'));

						return;
					}

					invalidateOnboarding();

					await systemActions.factoryResetDone();
				} catch {
					// Skip error if factory reset already completed via WS event
					// (the WS disconnect after token revocation triggers this catch)
					if (!systemActions.isFactoryResetDone()) {
						systemActions.factoryReset('err', 'action');

						flashMessage.error(t('systemModule.messages.manage.factoryResetFailed'));
					}
				}
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
