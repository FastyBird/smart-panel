import { Injectable, OnModuleInit } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ExtensionActionRegistryService } from '../../../modules/extensions/services/extension-action-registry.service';
import {
	ActionCategory,
	IActionResult,
	IExtensionAction,
} from '../../../modules/extensions/services/extension-action.interface';
import { DEVICES_HOMEKIT_PLUGIN_NAME } from '../devices-homekit.constants';

import { HomeKitBridgeService } from './homekit-bridge.service';

@Injectable()
export class HomeKitActionsService implements OnModuleInit {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOMEKIT_PLUGIN_NAME,
		'HomeKitActionsService',
	);

	constructor(
		private readonly actionRegistry: ExtensionActionRegistryService,
		private readonly bridgeService: HomeKitBridgeService,
	) {}

	onModuleInit(): void {
		this.actionRegistry.register(DEVICES_HOMEKIT_PLUGIN_NAME, this.createRestartBridgeAction());
		this.actionRegistry.register(DEVICES_HOMEKIT_PLUGIN_NAME, this.createResetPairingAction());
	}

	private createRestartBridgeAction(): IExtensionAction {
		return {
			id: 'restart-bridge',
			label: 'Restart Bridge',
			description: 'Restarts the HomeKit bridge service and re-publishes mDNS advertisements.',
			icon: 'mdi:restart',
			category: ActionCategory.MAINTENANCE,
			mode: 'immediate',
			execute: async (): Promise<IActionResult> => {
				try {
					await this.bridgeService.stop();
					await this.bridgeService.start();

					return { success: true, message: 'Apple HomeKit Bridge restarted successfully.' };
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					this.logger.warn(`Failed to restart Apple HomeKit Bridge: ${message}`);

					return { success: false, message: `Failed to restart bridge: ${message}` };
				}
			},
		};
	}

	private createResetPairingAction(): IExtensionAction {
		return {
			id: 'reset-pairing',
			label: 'Reset Pairing',
			description:
				'Clears all HomeKit pairing records and generates fresh bridge credentials. Existing paired Apple devices will need to be re-paired.',
			icon: 'mdi:link-variant-off',
			category: ActionCategory.MAINTENANCE,
			mode: 'immediate',
			dangerous: true,
			execute: async (): Promise<IActionResult> => {
				try {
					await this.bridgeService.resetPairing();

					return {
						success: true,
						message: 'Apple HomeKit Bridge pairing reset successfully. New setup code generated.',
					};
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					this.logger.warn(`Failed to reset Apple HomeKit Bridge pairing: ${message}`);

					return { success: false, message: `Failed to reset pairing: ${message}` };
				}
			},
		};
	}
}
