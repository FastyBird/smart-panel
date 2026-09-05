import { ExtensionActionRegistryService } from '../../../modules/extensions/services/extension-action-registry.service';
import { ActionCategory, IExtensionAction } from '../../../modules/extensions/services/extension-action.interface';
import { DEVICES_HOMEKIT_PLUGIN_NAME } from '../devices-homekit.constants';

import { HomeKitActionsService } from './homekit-actions.service';
import { HomeKitBridgeService } from './homekit-bridge.service';

type RegisteredAction = IExtensionAction & { execute: NonNullable<IExtensionAction['execute']> };

describe('HomeKitActionsService', () => {
	let actionRegistry: { register: jest.Mock };
	let bridgeService: { stop: jest.Mock; start: jest.Mock; resetPairing: jest.Mock };
	let service: HomeKitActionsService;

	beforeEach(() => {
		actionRegistry = { register: jest.fn() };
		bridgeService = {
			stop: jest.fn().mockResolvedValue(undefined),
			start: jest.fn().mockResolvedValue(undefined),
			resetPairing: jest.fn().mockResolvedValue(undefined),
		};

		service = new HomeKitActionsService(
			actionRegistry as unknown as ExtensionActionRegistryService,
			bridgeService as unknown as HomeKitBridgeService,
		);
	});

	describe('onModuleInit', () => {
		it('registers restart-bridge and reset-pairing actions for devices-homekit', () => {
			service.onModuleInit();

			expect(actionRegistry.register).toHaveBeenCalledTimes(2);

			const registered = actionRegistry.register.mock.calls as [string, RegisteredAction][];
			expect(registered[0][0]).toBe(DEVICES_HOMEKIT_PLUGIN_NAME);
			expect(registered[0][1].id).toBe('restart-bridge');
			expect(registered[0][1].category).toBe(ActionCategory.MAINTENANCE);

			expect(registered[1][0]).toBe(DEVICES_HOMEKIT_PLUGIN_NAME);
			expect(registered[1][1].id).toBe('reset-pairing');
			expect(registered[1][1].category).toBe(ActionCategory.MAINTENANCE);
			expect(registered[1][1].dangerous).toBe(true);
		});
	});

	describe('restart-bridge action', () => {
		it('stops and starts the bridge successfully', async () => {
			service.onModuleInit();
			const [, restartAction] = actionRegistry.register.mock.calls[0] as [string, RegisteredAction];

			const result = await restartAction.execute({});

			expect(bridgeService.stop).toHaveBeenCalledTimes(1);
			expect(bridgeService.start).toHaveBeenCalledTimes(1);
			expect(result.success).toBe(true);
			expect(result.message).toContain('restarted successfully');
		});

		it('handles error when restarting fails', async () => {
			bridgeService.stop.mockRejectedValue(new Error('HAP unpublish error'));

			service.onModuleInit();
			const [, restartAction] = actionRegistry.register.mock.calls[0] as [string, RegisteredAction];

			const result = await restartAction.execute({});

			expect(result.success).toBe(false);
			expect(result.message).toContain('HAP unpublish error');
		});
	});

	describe('reset-pairing action', () => {
		it('calls resetPairing successfully', async () => {
			service.onModuleInit();
			const [, resetAction] = actionRegistry.register.mock.calls[1] as [string, RegisteredAction];

			const result = await resetAction.execute({});

			expect(bridgeService.resetPairing).toHaveBeenCalledTimes(1);
			expect(result.success).toBe(true);
			expect(result.message).toContain('reset successfully');
		});

		it('handles error when resetPairing fails', async () => {
			bridgeService.resetPairing.mockRejectedValue(new Error('Filesystem lock failed'));

			service.onModuleInit();
			const [, resetAction] = actionRegistry.register.mock.calls[1] as [string, RegisteredAction];

			const result = await resetAction.execute({});

			expect(result.success).toBe(false);
			expect(result.message).toContain('Filesystem lock failed');
		});
	});
});
