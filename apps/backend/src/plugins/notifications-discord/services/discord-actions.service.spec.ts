import { ExtensionActionRegistryService } from '../../../modules/extensions/services/extension-action-registry.service';
import { ActionCategory, IExtensionAction } from '../../../modules/extensions/services/extension-action.interface';
import { NotificationEntity } from '../../../modules/notifications/entities/notifications.entity';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';
import { ChannelDeliveryError } from '../../../modules/notifications/platforms/notification-channel.platform';
import { NOTIFICATIONS_DISCORD_PLUGIN_NAME } from '../notifications-discord.constants';
import { DiscordChannelPlatform } from '../platforms/discord-channel.platform';

import { DiscordActionsService } from './discord-actions.service';

/** The registered action always carries `execute` in practice; narrowed so tests can call it directly. */
type RegisteredAction = IExtensionAction & { execute: NonNullable<IExtensionAction['execute']> };

describe('DiscordActionsService', () => {
	let actionRegistry: { register: jest.Mock };
	let channel: { send: jest.Mock };
	let service: DiscordActionsService;

	beforeEach(() => {
		actionRegistry = { register: jest.fn() };
		channel = { send: jest.fn().mockResolvedValue(undefined) };

		service = new DiscordActionsService(
			actionRegistry as unknown as ExtensionActionRegistryService,
			channel as unknown as DiscordChannelPlatform,
		);
	});

	const getRegisteredAction = (): RegisteredAction => {
		service.onModuleInit();

		expect(actionRegistry.register).toHaveBeenCalledWith(NOTIFICATIONS_DISCORD_PLUGIN_NAME, expect.any(Object));

		const [, action] = actionRegistry.register.mock.calls[0] as [string, RegisteredAction];

		return action;
	};

	describe('onModuleInit', () => {
		it('registers a single send-test action for the discord plugin', () => {
			const action = getRegisteredAction();

			expect(action).toMatchObject({
				id: 'send-test',
				label: 'Send test notification',
				category: ActionCategory.DIAGNOSTICS,
				mode: 'immediate',
			});
			expect(typeof action.execute).toBe('function');
		});
	});

	describe('send-test action', () => {
		it('builds a sample info notification and sends it through the channel', async () => {
			const action = getRegisteredAction();

			const result = await action.execute({});

			expect(channel.send).toHaveBeenCalledTimes(1);

			const [sample, signal] = channel.send.mock.calls[0] as [NotificationEntity, AbortSignal];

			expect(sample.severity).toBe(NotificationSeverity.INFO);
			expect(sample.title).toBe('Test notification from Smart Panel');
			expect(signal).toBeInstanceOf(AbortSignal);
			// `expect.any(String)` inside a `toEqual` object literal trips no-unsafe-assignment.
			expect(result.success).toBe(true);
			expect(typeof result.message).toBe('string');
		});

		it('returns a sanitized failure message when the channel throws', async () => {
			channel.send.mockRejectedValue(
				new ChannelDeliveryError(
					'Channel responded with HTTP 401 for https://discord.com/api/webhooks/123/secret-token',
					false,
					401,
				),
			);

			const action = getRegisteredAction();

			const result = await action.execute({});

			expect(result.success).toBe(false);
			expect(result.message).not.toContain('secret-token');
			expect(result.message).toContain('Channel responded with HTTP 401');
		});
	});
});
