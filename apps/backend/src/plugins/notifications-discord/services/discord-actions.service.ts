import { randomUUID } from 'crypto';

import { Injectable, OnModuleInit } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ExtensionActionRegistryService } from '../../../modules/extensions/services/extension-action-registry.service';
import {
	ActionCategory,
	IActionResult,
	IExtensionAction,
} from '../../../modules/extensions/services/extension-action.interface';
import { NotificationEntity } from '../../../modules/notifications/entities/notifications.entity';
import { NotificationKind, NotificationSeverity } from '../../../modules/notifications/notifications.constants';
import { sanitizeErrorMessage } from '../../../modules/notifications/notifications.utils';
import { NOTIFICATIONS_DISCORD_PLUGIN_NAME } from '../notifications-discord.constants';
import { DiscordChannelPlatform } from '../platforms/discord-channel.platform';

/** Matches the dispatcher's own per-attempt budget, so a stuck endpoint cannot hang the action. */
const SEND_TEST_TIMEOUT_MS = 10_000;

/**
 * Registers the `send-test` diagnostic action for the Discord plugin - the only UI the channel
 * needs beyond its config form, since the Actions tab already renders it.
 */
@Injectable()
export class DiscordActionsService implements OnModuleInit {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		NOTIFICATIONS_DISCORD_PLUGIN_NAME,
		'DiscordActionsService',
	);

	constructor(
		private readonly actionRegistry: ExtensionActionRegistryService,
		private readonly channel: DiscordChannelPlatform,
	) {}

	onModuleInit(): void {
		this.actionRegistry.register(NOTIFICATIONS_DISCORD_PLUGIN_NAME, this.createSendTestAction());
	}

	private createSendTestAction(): IExtensionAction {
		return {
			id: 'send-test',
			label: 'Send test notification',
			description: 'Sends a sample notification through this Discord webhook to verify it is configured correctly.',
			icon: 'mdi:discord',
			category: ActionCategory.DIAGNOSTICS,
			mode: 'immediate',
			execute: async (): Promise<IActionResult> => {
				const sample = this.buildSampleNotification();
				const signal = AbortSignal.timeout(SEND_TEST_TIMEOUT_MS);

				try {
					await this.channel.send(sample, signal);

					return { success: true, message: 'Test notification sent to Discord.' };
				} catch (error) {
					const message = sanitizeErrorMessage(this.toErrorMessage(error));

					this.logger.warn(
						`Test notification failed for channel type=${NOTIFICATIONS_DISCORD_PLUGIN_NAME}: ${message}`,
					);

					return { success: false, message };
				}
			},
		};
	}

	private buildSampleNotification(): NotificationEntity {
		const now = new Date();

		return {
			id: randomUUID(),
			source: NOTIFICATIONS_DISCORD_PLUGIN_NAME,
			kind: NotificationKind.EVENT,
			key: null,
			severity: NotificationSeverity.INFO,
			title: 'Test notification from Smart Panel',
			message: 'This is a test notification. If you can see this, the Discord channel is configured correctly.',
			actions: [],
			data: null,
			persistent: false,
			occurrences: 1,
			readAt: null,
			dismissedAt: null,
			resolvedAt: null,
			createdAt: now,
			updatedAt: now,
		} as NotificationEntity;
	}

	/** `error instanceof Error ? error.message : String(error)`, guarded against a throwing `toString`. */
	private toErrorMessage(error: unknown): string {
		if (error instanceof Error) {
			return error.message;
		}

		try {
			// eslint-disable-next-line @typescript-eslint/no-base-to-string -- error is genuinely unknown; still needs a message
			return String(error);
		} catch {
			return 'unknown error';
		}
	}
}
