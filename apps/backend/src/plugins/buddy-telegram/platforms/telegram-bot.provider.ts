import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { EventType } from '../../../modules/buddy/buddy.constants';
import { BuddyConversationService } from '../../../modules/buddy/services/buddy-conversation.service';
import { BuddySuggestion, SuggestionEngineService } from '../../../modules/buddy/services/suggestion-engine.service';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	ConfigChangeResult,
	IManagedPluginService,
	ServiceState,
} from '../../../modules/extensions/services/managed-plugin-service.interface';
import { SuggestionFeedback } from '../../../modules/spaces/spaces.constants';
import {
	BUDDY_TELEGRAM_PLUGIN_NAME,
	TELEGRAM_MAX_MESSAGE_LENGTH,
	TELEGRAM_RETRY_DELAYS_MS,
} from '../buddy-telegram.constants';
import { BuddyTelegramConfigModel } from '../models/config.model';

/**
 * Telegram bot provider that bridges Telegram messages to buddy conversations.
 *
 * - Routes incoming Telegram text messages through BuddyConversationService
 * - Forwards suggestion notifications to registered Telegram users with inline keyboards
 * - Maps inline keyboard callbacks to suggestion feedback (accept/dismiss)
 * - Uses long polling (works behind NAT, no webhook setup needed)
 * - Enforces a user whitelist for security
 */
@Injectable()
export class TelegramBotProvider implements IManagedPluginService {
	private readonly logger = createExtensionLogger(BUDDY_TELEGRAM_PLUGIN_NAME, 'TelegramBotProvider');

	readonly pluginName = BUDDY_TELEGRAM_PLUGIN_NAME;
	readonly serviceId = 'bot';

	private bot: Telegraf | null = null;
	private state: ServiceState = 'stopped';

	/** Snapshot of the last applied config to detect actual changes */
	private activeConfig: { botToken: string | null; allowedUserIds: string | null } | null = null;

	/** Telegram user ID → active buddy conversation ID */
	private readonly userConversations = new Map<number, string>();

	/** Registered Telegram chat ID → user ID for suggestion forwarding (populated on first message from allowed user) */
	private readonly registeredChats = new Map<number, number>();

	constructor(
		private readonly configService: ConfigService,
		private readonly conversationService: BuddyConversationService,
		private readonly suggestionEngine: SuggestionEngineService,
	) {}

	/**
	 * Start the Telegram bot service.
	 * Called by PluginServiceManagerService when the plugin is enabled.
	 */
	async start(): Promise<void> {
		if (this.state === 'started' || this.state === 'starting') {
			return;
		}

		const config = this.getPluginConfig();

		this.activeConfig = {
			botToken: config?.botToken ?? null,
			allowedUserIds: config?.allowedUserIds ?? null,
		};

		if (!config?.botToken) {
			this.state = 'stopped';

			throw new Error('Telegram bot token is not configured');
		}

		await this.startBot(config as BuddyTelegramConfigModel & { botToken: string });
	}

	/**
	 * Stop the Telegram bot service gracefully.
	 * Called by PluginServiceManagerService when the plugin is disabled or app shuts down.
	 *
	 * Preserve registeredChats and userConversations across restarts so users
	 * don't need to re-message after a config change. The maps are in-memory
	 * and will be garbage-collected on full shutdown anyway.
	 */
	// eslint-disable-next-line @typescript-eslint/require-await
	async stop(): Promise<void> {
		this.stopBot();
	}

	/**
	 * Get the current service state.
	 */
	getState(): ServiceState {
		return this.state;
	}

	/**
	 * Handle configuration changes.
	 * Called by PluginServiceManagerService when config updates occur.
	 */
	onConfigChanged(): Promise<ConfigChangeResult> {
		if (this.state !== 'started' || !this.activeConfig) {
			return Promise.resolve({ restartRequired: false });
		}

		const config = this.getPluginConfig();

		const newSnapshot = {
			botToken: config?.botToken ?? null,
			allowedUserIds: config?.allowedUserIds ?? null,
		};

		if (
			this.activeConfig.botToken === newSnapshot.botToken &&
			this.activeConfig.allowedUserIds === newSnapshot.allowedUserIds
		) {
			return Promise.resolve({ restartRequired: false });
		}

		this.logger.log('Config changed, restart required');

		return Promise.resolve({ restartRequired: true });
	}

	/**
	 * Forward new suggestions to all registered Telegram users with inline keyboard buttons.
	 * Only sends to users still on the current whitelist.
	 */
	@OnEvent(EventType.SUGGESTION_CREATED)
	async onSuggestionCreated(suggestion: BuddySuggestion): Promise<void> {
		if (!this.bot || this.state !== 'started') {
			return;
		}

		const config = this.getPluginConfig();
		const allowedUserIds = this.parseAllowedUserIds(config?.allowedUserIds);

		const text = `💡 *${this.escapeMarkdown(suggestion.title)}*\n\n${this.escapeMarkdown(suggestion.reason)}`;

		for (const [chatId, userId] of this.registeredChats) {
			if (allowedUserIds.size > 0 && !allowedUserIds.has(userId)) {
				continue;
			}

			try {
				await this.sendWithRetry(chatId, text, {
					parse_mode: 'MarkdownV2',
					reply_markup: {
						inline_keyboard: [
							[
								{ text: '✅ Accept', callback_data: `suggestion:accept:${suggestion.id}` },
								{ text: '❌ Dismiss', callback_data: `suggestion:dismiss:${suggestion.id}` },
							],
						],
					},
				});
			} catch (error) {
				this.logger.warn(`Failed to send suggestion to chat ${chatId}: ${String(error)}`);
			}
		}
	}

	isRunning(): boolean {
		return this.state === 'started';
	}

	private async startBot(config: BuddyTelegramConfigModel & { botToken: string }): Promise<void> {
		this.state = 'starting';

		try {
			this.bot = new Telegraf(config.botToken);

			// /start command — must be registered before the generic text handler
			// so that Telegraf matches `/start` as a command rather than plain text.
			this.bot.command('start', async (ctx) => {
				const userId = ctx.from.id;
				const currentConfig = this.getPluginConfig();
				const allowedUserIds = this.parseAllowedUserIds(currentConfig?.allowedUserIds);
				const allowed = allowedUserIds.size === 0 || allowedUserIds.has(userId);

				if (!allowed) {
					await ctx.reply('⛔ You are not authorized to use this bot.');

					return;
				}

				this.registeredChats.set(ctx.chat.id, userId);

				await ctx.reply(
					"👋 Hello! I'm your Smart Panel buddy.\n\n" +
						'Send me a message to ask about your home, devices, or to control your smart home.\n\n' +
						"I'll also send you alerts and suggestions here.",
				);
			});

			// Text message handler
			this.bot.on(message('text'), async (ctx) => {
				const userId = ctx.from.id;
				const currentConfig = this.getPluginConfig();
				const allowedUserIds = this.parseAllowedUserIds(currentConfig?.allowedUserIds);

				if (allowedUserIds.size > 0 && !allowedUserIds.has(userId)) {
					this.logger.debug(`Rejected message from unauthorized Telegram user ${userId}`);
					await ctx.reply('⛔ You are not authorized to use this bot.');

					return;
				}

				// Register chat for suggestion forwarding
				this.registeredChats.set(ctx.chat.id, userId);

				try {
					const conversationId = await this.getOrCreateConversation(userId);
					const response = await this.conversationService.sendMessage(conversationId, ctx.message.text);

					const chunks = this.splitMessage(response.content);

					for (const chunk of chunks) {
						await this.sendWithRetry(ctx.chat.id, chunk);
					}
				} catch (error) {
					this.logger.error(`Error processing Telegram message: ${String(error)}`);
					await ctx.reply('Sorry, I encountered an error processing your message. Please try again.');
				}
			});

			// Inline keyboard callback handler (suggestion feedback)
			this.bot.on('callback_query', async (ctx) => {
				const userId = ctx.from.id;
				const currentConfig = this.getPluginConfig();
				const cbAllowedUserIds = this.parseAllowedUserIds(currentConfig?.allowedUserIds);

				if (cbAllowedUserIds.size > 0 && !cbAllowedUserIds.has(userId)) {
					this.logger.debug(`Rejected callback from unauthorized Telegram user ${userId}`);
					await ctx.answerCbQuery('⛔ Not authorized');

					return;
				}

				const data = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;

				if (!data) {
					await ctx.answerCbQuery();

					return;
				}

				const match = /^suggestion:(accept|dismiss):(.+)$/.exec(data);

				if (!match) {
					await ctx.answerCbQuery('Unknown action');

					return;
				}

				const [, action, suggestionId] = match;
				const feedback = action === 'accept' ? SuggestionFeedback.APPLIED : SuggestionFeedback.DISMISSED;

				try {
					this.suggestionEngine.recordFeedback(suggestionId, feedback);

					await ctx.answerCbQuery(action === 'accept' ? 'Suggestion accepted ✅' : 'Suggestion dismissed');

					// Update the message to remove inline keyboard
					if (ctx.callbackQuery.message) {
						await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
					}
				} catch {
					await ctx.answerCbQuery('Suggestion not found or expired');
				}
			});

			await this.bot.launch({ dropPendingUpdates: true });
			this.state = 'started';

			this.logger.log('Telegram bot started (long polling)');
		} catch (error) {
			this.logger.error(`Failed to start Telegram bot: ${String(error)}`);
			this.bot = null;
			this.state = 'error';

			throw error;
		}
	}

	private stopBot(): void {
		if (this.bot) {
			const wasStarted = this.state === 'started';

			this.state = 'stopping';

			if (wasStarted) {
				this.bot.stop('reconfigure');
			}

			this.bot = null;
			this.state = 'stopped';
			this.logger.log('Telegram bot stopped');
		} else {
			this.state = 'stopped';
		}
	}

	/**
	 * Get the active conversation for a Telegram user, or create a new one.
	 */
	private async getOrCreateConversation(telegramUserId: number): Promise<string> {
		const existingId = this.userConversations.get(telegramUserId);

		if (existingId) {
			const conversation = await this.conversationService.findOne(existingId);

			if (conversation) {
				return existingId;
			}
		}

		// Create a new conversation for this Telegram user
		const conversation = await this.conversationService.create(`Telegram (user ${telegramUserId})`);

		this.userConversations.set(telegramUserId, conversation.id);

		return conversation.id;
	}

	/**
	 * Parse comma-separated user IDs into a Set.
	 */
	private parseAllowedUserIds(raw?: string | null): Set<number> {
		const ids = new Set<number>();

		if (!raw || raw.trim() === '') {
			return ids;
		}

		for (const part of raw.split(',')) {
			const trimmed = part.trim();
			const num = Number(trimmed);

			if (!Number.isNaN(num) && Number.isInteger(num) && num > 0) {
				ids.add(num);
			}
		}

		return ids;
	}

	/**
	 * Send a Telegram message with retry and exponential backoff.
	 */
	private async sendWithRetry(chatId: number, text: string, extra?: Record<string, unknown>): Promise<void> {
		if (!this.bot) {
			return;
		}

		for (let attempt = 0; attempt <= TELEGRAM_RETRY_DELAYS_MS.length; attempt++) {
			try {
				await this.bot.telegram.sendMessage(chatId, text, extra);

				return;
			} catch (error) {
				if (attempt < TELEGRAM_RETRY_DELAYS_MS.length) {
					const delay = TELEGRAM_RETRY_DELAYS_MS[attempt];

					this.logger.warn(`Telegram send failed (attempt ${attempt + 1}), retrying in ${delay}ms: ${String(error)}`);
					await this.sleep(delay);
				} else {
					throw error;
				}
			}
		}
	}

	/**
	 * Split a message into chunks that fit Telegram's character limit.
	 */
	private splitMessage(text: string): string[] {
		if (text.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
			return [text];
		}

		const chunks: string[] = [];
		let remaining = text;

		while (remaining.length > 0) {
			if (remaining.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
				chunks.push(remaining);
				break;
			}

			// Try to split at a newline
			let splitIndex = remaining.lastIndexOf('\n', TELEGRAM_MAX_MESSAGE_LENGTH);

			if (splitIndex <= 0) {
				// Fall back to splitting at a space
				splitIndex = remaining.lastIndexOf(' ', TELEGRAM_MAX_MESSAGE_LENGTH);
			}

			if (splitIndex <= 0) {
				// Last resort: hard split
				splitIndex = TELEGRAM_MAX_MESSAGE_LENGTH;
			}

			chunks.push(remaining.slice(0, splitIndex));
			remaining = remaining.slice(splitIndex).trimStart();
		}

		return chunks;
	}

	/**
	 * Escape special characters for Telegram MarkdownV2 format.
	 */
	private escapeMarkdown(text: string): string {
		return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private getPluginConfig(): BuddyTelegramConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyTelegramConfigModel>(BUDDY_TELEGRAM_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
