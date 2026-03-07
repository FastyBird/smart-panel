import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	Client,
	GatewayIntentBits,
	type GuildMember,
	type Interaction,
	type Message,
	Partials,
	type TextChannel,
} from 'discord.js';

import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { EventType } from '../../../modules/buddy/buddy.constants';
import { BuddyConversationService } from '../../../modules/buddy/services/buddy-conversation.service';
import { BuddySuggestion, SuggestionEngineService } from '../../../modules/buddy/services/suggestion-engine.service';
import { EventType as ConfigModuleEventType } from '../../../modules/config/config.constants';
import { ConfigService } from '../../../modules/config/services/config.service';
import { SuggestionFeedback } from '../../../modules/spaces/spaces.constants';
import {
	BUDDY_DISCORD_PLUGIN_NAME,
	DISCORD_MAX_MESSAGE_LENGTH,
	DISCORD_RETRY_DELAYS_MS,
} from '../buddy-discord.constants';
import { BuddyDiscordConfigModel } from '../models/config.model';

/**
 * Discord bot provider that bridges Discord messages to buddy conversations.
 *
 * - Routes incoming Discord text messages through BuddyConversationService
 * - Supports multi-channel space mapping: each Discord channel can be associated with a smart home space
 * - Forwards suggestion notifications to the relevant space channel (or general channel as fallback)
 * - Uses Discord.js gateway (WebSocket-based, no webhook setup needed)
 * - Enforces role-based access control
 */
@Injectable()
export class DiscordBotProvider implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = new Logger(DiscordBotProvider.name);

	private client: Client | null = null;
	private running = false;

	/** Snapshot of the last applied config to detect actual changes */
	private activeConfig: {
		enabled: boolean;
		botToken: string | null;
		guildId: string | null;
		generalChannelId: string | null;
		spaceChannelMappings: string | null;
		allowedRoleId: string | null;
	} | null = null;

	/** Discord channel ID → active buddy conversation ID */
	private readonly channelConversations = new Map<string, string>();

	constructor(
		private readonly configService: ConfigService,
		private readonly conversationService: BuddyConversationService,
		private readonly suggestionEngine: SuggestionEngineService,
	) {}

	onApplicationBootstrap(): void {
		if (process.env.FB_CLI === 'on') {
			return;
		}

		const config = this.getPluginConfig();

		// Record config snapshot eagerly so that CONFIG_UPDATED events
		// for unrelated plugins are correctly ignored even while startBot is in progress.
		this.activeConfig = {
			enabled: config?.enabled ?? false,
			botToken: config?.botToken ?? null,
			guildId: config?.guildId ?? null,
			generalChannelId: config?.generalChannelId ?? null,
			spaceChannelMappings: config?.spaceChannelMappings ?? null,
			allowedRoleId: config?.allowedRoleId ?? null,
		};

		if (config?.enabled && config.botToken) {
			void this.startBot(config);
		}
	}

	async onModuleDestroy(): Promise<void> {
		await this.stopBot();
		this.channelConversations.clear();
	}

	/**
	 * Restart bot only when Discord plugin configuration actually changes.
	 */
	@OnEvent(ConfigModuleEventType.CONFIG_UPDATED)
	async onConfigUpdated(): Promise<void> {
		const config = this.getPluginConfig();

		const newSnapshot = {
			enabled: config?.enabled ?? false,
			botToken: config?.botToken ?? null,
			guildId: config?.guildId ?? null,
			generalChannelId: config?.generalChannelId ?? null,
			spaceChannelMappings: config?.spaceChannelMappings ?? null,
			allowedRoleId: config?.allowedRoleId ?? null,
		};

		if (
			this.activeConfig &&
			this.activeConfig.enabled === newSnapshot.enabled &&
			this.activeConfig.botToken === newSnapshot.botToken &&
			this.activeConfig.guildId === newSnapshot.guildId &&
			this.activeConfig.generalChannelId === newSnapshot.generalChannelId &&
			this.activeConfig.spaceChannelMappings === newSnapshot.spaceChannelMappings &&
			this.activeConfig.allowedRoleId === newSnapshot.allowedRoleId
		) {
			return;
		}

		await this.stopBot();

		this.activeConfig = newSnapshot;

		if (config?.enabled && config.botToken) {
			await this.startBot(config);
		}
	}

	/**
	 * Forward new suggestions to the relevant space channel (or general channel as fallback).
	 */
	@OnEvent(EventType.SUGGESTION_CREATED)
	async onSuggestionCreated(suggestion: BuddySuggestion): Promise<void> {
		if (!this.client || !this.running) {
			return;
		}

		const config = this.getPluginConfig();

		if (!config) {
			return;
		}

		const channelId = this.getChannelForSpace(config, suggestion.spaceId) ?? config.generalChannelId;

		if (!channelId) {
			return;
		}

		try {
			const channel = await this.client.channels.fetch(channelId);

			if (!channel || !channel.isTextBased()) {
				this.logger.warn(`Channel ${channelId} is not a text channel, skipping suggestion`);

				return;
			}

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(`suggestion:accept:${suggestion.id}`)
					.setLabel('Accept')
					.setStyle(ButtonStyle.Success)
					.setEmoji('✅'),
				new ButtonBuilder()
					.setCustomId(`suggestion:dismiss:${suggestion.id}`)
					.setLabel('Dismiss')
					.setStyle(ButtonStyle.Secondary)
					.setEmoji('❌'),
			);

			await this.sendWithRetry(channel as TextChannel, `💡 **${suggestion.title}**\n\n${suggestion.reason}`, [row]);
		} catch (error) {
			this.logger.warn(`Failed to send suggestion to channel ${channelId}: ${String(error)}`);
		}
	}

	isRunning(): boolean {
		return this.running;
	}

	private async startBot(config: BuddyDiscordConfigModel & { botToken: string }): Promise<void> {
		try {
			this.client = new Client({
				intents: [
					GatewayIntentBits.Guilds,
					GatewayIntentBits.GuildMessages,
					GatewayIntentBits.DirectMessages,
					GatewayIntentBits.MessageContent,
					GatewayIntentBits.GuildMembers,
				],
				partials: [Partials.Channel],
			});

			this.client.on('messageCreate', (message: Message) => {
				void this.handleMessage(message, config);
			});

			this.client.on('interactionCreate', (interaction: Interaction) => {
				void this.handleInteraction(interaction, config);
			});

			await this.client.login(config.botToken);
			this.running = true;

			this.activeConfig = {
				enabled: config.enabled,
				botToken: config.botToken,
				guildId: config.guildId ?? null,
				generalChannelId: config.generalChannelId ?? null,
				spaceChannelMappings: config.spaceChannelMappings ?? null,
				allowedRoleId: config.allowedRoleId ?? null,
			};

			this.logger.log('Discord bot started (gateway)');
		} catch (error) {
			this.logger.error(`Failed to start Discord bot: ${String(error)}`);
			this.client = null;
			this.running = false;
		}
	}

	private async stopBot(): Promise<void> {
		if (this.client) {
			await this.client.destroy();
			this.client = null;
			this.running = false;
			this.logger.log('Discord bot stopped');
		}
	}

	/**
	 * Handle a button interaction (suggestion feedback).
	 */
	private async handleInteraction(interaction: Interaction, config: BuddyDiscordConfigModel): Promise<void> {
		if (!interaction.isButton()) {
			return;
		}

		const match = /^suggestion:(accept|dismiss):(.+)$/.exec(interaction.customId);

		if (!match) {
			await interaction.reply({ content: 'Unknown action', ephemeral: true });

			return;
		}

		// Check role-based access
		if (config.allowedRoleId && interaction.member) {
			const member = interaction.member as GuildMember;
			const hasRole = member.roles.cache.has(config.allowedRoleId);

			if (!hasRole) {
				await interaction.reply({
					content: '🔒 You do not have permission to perform this action.',
					ephemeral: true,
				});

				return;
			}
		}

		const [, action, suggestionId] = match;
		const feedback = action === 'accept' ? SuggestionFeedback.APPLIED : SuggestionFeedback.DISMISSED;

		try {
			this.suggestionEngine.recordFeedback(suggestionId, feedback);

			await interaction.reply({
				content: action === 'accept' ? 'Suggestion accepted ✅' : 'Suggestion dismissed',
				ephemeral: true,
			});

			// Update the original message to remove buttons — failure here is non-critical
			try {
				await interaction.message.edit({ components: [] });
			} catch (editError) {
				this.logger.warn(`Failed to remove buttons from suggestion message: ${String(editError)}`);
			}
		} catch {
			// Only reply if we haven't already replied (recordFeedback may throw before reply)
			if (!interaction.replied) {
				await interaction.reply({ content: 'Suggestion not found or expired', ephemeral: true });
			}
		}
	}

	/**
	 * Handle an incoming Discord message.
	 */
	private async handleMessage(message: Message, config: BuddyDiscordConfigModel): Promise<void> {
		// Ignore bot messages
		if (message.author.bot) {
			return;
		}

		const isDm = message.channel.type === ChannelType.DM;

		if (!isDm) {
			// Only handle messages from the configured guild
			if (config.guildId && message.guildId !== config.guildId) {
				return;
			}

			// Check if the message is in a configured channel
			const allowedChannels = this.getAllowedChannelIds(config);

			if (allowedChannels.size > 0 && !allowedChannels.has(message.channelId)) {
				return;
			}

			// Role-based access control
			if (config.allowedRoleId && message.member) {
				const hasRole = message.member.roles.cache.has(config.allowedRoleId);

				if (!hasRole) {
					this.logger.debug(`Rejected message from user ${message.author.id} without required role`);

					try {
						await message.react('🔒');
					} catch {
						// Ignore reaction failures
					}

					return;
				}
			}
		}

		const content = message.content.trim();

		if (!content) {
			return;
		}

		if (!('send' in message.channel)) {
			return;
		}

		try {
			// Determine space context from channel mapping (DMs have no space context)
			const spaceId = isDm ? null : this.getSpaceForChannel(config, message.channelId);

			// Use user ID as conversation key for DMs, channel ID for guild messages
			const conversationKey = isDm ? `dm:${message.author.id}` : message.channelId;
			const conversationId = await this.getOrCreateConversation(conversationKey, spaceId);

			const response = await this.conversationService.sendMessage(conversationId, content);

			// Split long messages if needed
			const chunks = this.splitMessage(response.content);

			for (const chunk of chunks) {
				await message.channel.send(chunk);
			}
		} catch (error) {
			this.logger.error(`Error processing Discord message: ${String(error)}`);

			try {
				await message.channel.send('Sorry, I encountered an error processing your message. Please try again.');
			} catch {
				// Ignore send failure for error message
			}
		}
	}

	/**
	 * Get the active conversation for a Discord channel, or create a new one.
	 */
	private async getOrCreateConversation(channelId: string, spaceId: string | null): Promise<string> {
		const existingId = this.channelConversations.get(channelId);

		if (existingId) {
			const conversation = await this.conversationService.findOne(existingId);

			if (conversation) {
				return existingId;
			}
		}

		const isDm = channelId.startsWith('dm:');
		const name = isDm
			? `Discord DM (${channelId.slice(3)})`
			: spaceId
				? `Discord (channel ${channelId}, space ${spaceId})`
				: `Discord (channel ${channelId})`;

		const conversation = await this.conversationService.create(name, spaceId);

		this.channelConversations.set(channelId, conversation.id);

		return conversation.id;
	}

	/**
	 * Parse space-channel mappings from the config JSON string.
	 */
	parseSpaceChannelMappings(raw?: string | null): Record<string, string> {
		if (!raw || raw.trim() === '') {
			return {};
		}

		try {
			const parsed = JSON.parse(raw) as unknown;

			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
				return {};
			}

			return parsed as Record<string, string>;
		} catch {
			this.logger.warn('Failed to parse space-channel mappings JSON');

			return {};
		}
	}

	/**
	 * Get the space ID associated with a Discord channel.
	 */
	getSpaceForChannel(config: BuddyDiscordConfigModel, channelId: string): string | null {
		const mappings = this.parseSpaceChannelMappings(config.spaceChannelMappings);

		for (const [spaceId, mappedChannelId] of Object.entries(mappings)) {
			if (mappedChannelId === channelId) {
				return spaceId;
			}
		}

		return null;
	}

	/**
	 * Get the Discord channel ID associated with a space.
	 */
	getChannelForSpace(config: BuddyDiscordConfigModel, spaceId: string): string | null {
		const mappings = this.parseSpaceChannelMappings(config.spaceChannelMappings);

		return mappings[spaceId] ?? null;
	}

	/**
	 * Get all allowed channel IDs (general + all space-mapped channels).
	 */
	getAllowedChannelIds(config: BuddyDiscordConfigModel): Set<string> {
		const ids = new Set<string>();

		if (config.generalChannelId) {
			ids.add(config.generalChannelId);
		}

		const mappings = this.parseSpaceChannelMappings(config.spaceChannelMappings);

		for (const channelId of Object.values(mappings)) {
			ids.add(channelId);
		}

		return ids;
	}

	/**
	 * Split a message into chunks that fit Discord's character limit.
	 */
	splitMessage(text: string): string[] {
		if (text.length <= DISCORD_MAX_MESSAGE_LENGTH) {
			return [text];
		}

		const chunks: string[] = [];
		let remaining = text;

		while (remaining.length > 0) {
			if (remaining.length <= DISCORD_MAX_MESSAGE_LENGTH) {
				chunks.push(remaining);
				break;
			}

			// Try to split at a newline
			let splitIndex = remaining.lastIndexOf('\n', DISCORD_MAX_MESSAGE_LENGTH);

			if (splitIndex <= 0) {
				// Fall back to splitting at a space
				splitIndex = remaining.lastIndexOf(' ', DISCORD_MAX_MESSAGE_LENGTH);
			}

			if (splitIndex <= 0) {
				// Last resort: hard split
				splitIndex = DISCORD_MAX_MESSAGE_LENGTH;
			}

			chunks.push(remaining.slice(0, splitIndex));
			remaining = remaining.slice(splitIndex).trimStart();
		}

		return chunks;
	}

	/**
	 * Send a Discord message with retry and exponential backoff.
	 */
	private async sendWithRetry(
		channel: TextChannel,
		text: string,
		components?: ActionRowBuilder<ButtonBuilder>[],
	): Promise<void> {
		for (let attempt = 0; attempt <= DISCORD_RETRY_DELAYS_MS.length; attempt++) {
			try {
				await channel.send({ content: text, components });

				return;
			} catch (error) {
				if (attempt < DISCORD_RETRY_DELAYS_MS.length) {
					const delay = DISCORD_RETRY_DELAYS_MS[attempt];

					this.logger.warn(`Discord send failed (attempt ${attempt + 1}), retrying in ${delay}ms: ${String(error)}`);
					await this.sleep(delay);
				} else {
					throw error;
				}
			}
		}
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private getPluginConfig(): BuddyDiscordConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyDiscordConfigModel>(BUDDY_DISCORD_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
