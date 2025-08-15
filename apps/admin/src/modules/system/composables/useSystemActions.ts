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
		ElMessageBox.confirm(t('systemModule.messages.manage.confirmRestart'), t('systemModule.headings.manage.restart'), {
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
		ElMessageBox.confirm(t('systemModule.messages.manage.confirmPowerOff'), t('systemModule.headings.manage.powerOff'), {
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
		ElMessageBox.confirm(t('systemModule.messages.manage.confirmFactoryReset'), t('systemModule.headings.manage.factoryReset'), {
			confirmButtonText: t('systemModule.buttons.yes.title'),
			cancelButtonText: t('systemModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				systemActions.factoryReset('in-progress', 'action');

				try {
					const response = await sendCommand(EventType.SYSTEM_FACTORY_RESET_SET, null, EventHandlerName.INTERNAL_PLATFORM_ACTION);

					if (response !== true) {
						systemActions.factoryReset('err', 'action');

						flashMessage.error(t('systemModule.messages.manage.factoryResetFailed'));

						return;
					}

					systemActions.factoryReset('ok', 'action');
				} catch {
					systemActions.factoryReset('err', 'action');

					flashMessage.error(t('systemModule.messages.manage.factoryResetFailed'));
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
