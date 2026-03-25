import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { useSockets } from '../../../common';
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
				// Navigate first — the backend may go down before the command response
				systemActions.reboot();

				try {
					await sendCommand(EventType.SYSTEM_REBOOT_SET, null, EventHandlerName.INTERNAL_PLATFORM_ACTION);
				} catch {
					// Server going down before ack is expected
				}
			})
			.catch((): void => {
				// Dialog cancelled
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
				systemActions.powerOff();

				try {
					await sendCommand(EventType.SYSTEM_POWER_OFF_SET, null, EventHandlerName.INTERNAL_PLATFORM_ACTION);
				} catch {
					// Server going down before ack is expected
				}
			})
			.catch((): void => {
				// Dialog cancelled
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
				// Fire command (don't await — server will restart before ack)
				sendCommand(EventType.SYSTEM_FACTORY_RESET_SET, null, EventHandlerName.INTERNAL_PLATFORM_ACTION, 30_000).catch(() => {
					// Expected — server goes down during reset
				});

				// Sign out and navigate to waiting page immediately
				invalidateOnboarding();

				await systemActions.handleFactoryResetRedirect();
			})
			.catch((): void => {
				// Dialog cancelled
			});
	};

	return {
		onRestart,
		onPowerOff,
		onFactoryReset,
	};
};
