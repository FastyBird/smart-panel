import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { useFlashMessage, useSockets } from '../../../common';
import { injectSystemActionsService } from '../services/system-actions-service';
import { EventHandlerName, EventType } from '../system.constants';

import type { IUseSystemActions } from './types';

export const useSystemActions = (): IUseSystemActions => {
	const systemActions = injectSystemActionsService();

	const { t } = useI18n();
	const { sendCommand } = useSockets();
	const flashMessage = useFlashMessage();

	const onRestart = (): void => {
		ElMessageBox.confirm(t('systemModule.messages.confirmRestart'), t('systemModule.headings.restart'), {
			confirmButtonText: t('systemModule.buttons.yes.title'),
			cancelButtonText: t('systemModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				systemActions.reboot('in-progress');

				try {
					const response = await sendCommand(EventType.SYSTEM_REBOOT_SET, null, EventHandlerName.INTERNAL_PLATFORM_ACTION);

					if (response !== true) {
						systemActions.reboot('err');

						flashMessage.error(t('systemModule.messages.rebootFailed'));

						return;
					}

					systemActions.reboot('ok');
				} catch {
					systemActions.reboot('err');

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
				systemActions.powerOff('in-progress');

				try {
					const response = await sendCommand(EventType.SYSTEM_POWER_OFF_SET, null, EventHandlerName.INTERNAL_PLATFORM_ACTION);

					if (response !== true) {
						systemActions.powerOff('err');

						flashMessage.error(t('systemModule.messages.powerOffFailed'));

						return;
					}

					systemActions.powerOff('ok');
				} catch {
					systemActions.powerOff('err');

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
				systemActions.factoryReset('in-progress');

				try {
					const response = await sendCommand(EventType.SYSTEM_FACTORY_RESET_SET, null, EventHandlerName.INTERNAL_PLATFORM_ACTION);

					if (response !== true) {
						systemActions.factoryReset('err');

						flashMessage.error(t('systemModule.messages.factoryResetFailed'));

						return;
					}

					systemActions.factoryReset('ok');
				} catch {
					systemActions.factoryReset('err');

					flashMessage.error(t('systemModule.messages.factoryResetFailed'));
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
