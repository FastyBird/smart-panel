import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { EventType } from '../../../modules/buddy/buddy.constants';
import { BuddyConversationService } from '../../../modules/buddy/services/buddy-conversation.service';
import { BuddySuggestion, SuggestionEngineService } from '../../../modules/buddy/services/suggestion-engine.service';
import { EventType as ConfigModuleEventType } from '../../../modules/config/config.constants';
import { ConfigService } from '../../../modules/config/services/config.service';
import { SuggestionFeedback } from '../../../modules/spaces/spaces.constants';
import {
	BUDDY_WHATSAPP_PLUGIN_NAME,
	WHATSAPP_GRAPH_API_BASE_URL,
	WHATSAPP_GRAPH_API_VERSION,
	WHATSAPP_RETRY_DELAYS_MS,
} from '../buddy-whatsapp.constants';
import { BuddyWhatsappConfigModel } from '../models/config.model';

interface WhatsAppWebhookPayload {
	object?: string;
	entry?: Array<{
		id?: string;
		changes?: Array<{
			value?: {
				messaging_product?: string;
				metadata?: { phone_number_id?: string };
				messages?: Array<{
					from?: string;
					id?: string;
					type?: string;
					text?: { body?: string };
					interactive?: { type?: string; button_reply?: { id?: string; title?: string } };
				}>;
			};
		}>;
	}>;
}

/**
 * WhatsApp bot provider that bridges WhatsApp messages to buddy conversations.
 *
 * - Routes incoming WhatsApp text messages through BuddyConversationService
 * - Forwards suggestion notifications to registered WhatsApp numbers with interactive buttons
 * - Maps interactive button replies to suggestion feedback (accept/dismiss)
 * - Uses WhatsApp Cloud API (Meta Graph API) — no third-party library needed
 * - Enforces a phone number whitelist for security
 */
@Injectable()
export class WhatsAppBotProvider implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(WhatsAppBotProvider.name);

	/** Snapshot of the last applied config to detect actual changes */
	private activeConfig: {
		enabled: boolean;
		phoneNumberId: string | null;
		accessToken: string | null;
		webhookVerifyToken: string | null;
		allowedPhoneNumbers: string | null;
	} | null = null;

	/** WhatsApp phone number (E.164) → active buddy conversation ID */
	private readonly phoneConversations = new Map<string, string>();

	/** Registered phone numbers that have interacted (for suggestion forwarding) */
	private readonly registeredPhones = new Set<string>();

	constructor(
		private readonly configService: ConfigService,
		private readonly conversationService: BuddyConversationService,
		private readonly suggestionEngine: SuggestionEngineService,
	) {}

	onModuleInit(): void {
		const config = this.getPluginConfig();

		this.activeConfig = {
			enabled: config?.enabled ?? false,
			phoneNumberId: config?.phoneNumberId ?? null,
			accessToken: config?.accessToken ?? null,
			webhookVerifyToken: config?.webhookVerifyToken ?? null,
			allowedPhoneNumbers: config?.allowedPhoneNumbers ?? null,
		};

		if (config?.enabled && config.phoneNumberId && config.accessToken) {
			this.logger.log('WhatsApp bot provider initialized (webhook mode)');
		}
	}

	onModuleDestroy(): void {
		this.registeredPhones.clear();
		this.phoneConversations.clear();
	}

	/**
	 * Re-read config when configuration is updated.
	 */
	@OnEvent(ConfigModuleEventType.CONFIG_UPDATED)
	onConfigUpdated(): void {
		const config = this.getPluginConfig();

		const newSnapshot = {
			enabled: config?.enabled ?? false,
			phoneNumberId: config?.phoneNumberId ?? null,
			accessToken: config?.accessToken ?? null,
			webhookVerifyToken: config?.webhookVerifyToken ?? null,
			allowedPhoneNumbers: config?.allowedPhoneNumbers ?? null,
		};

		if (
			this.activeConfig &&
			this.activeConfig.enabled === newSnapshot.enabled &&
			this.activeConfig.phoneNumberId === newSnapshot.phoneNumberId &&
			this.activeConfig.accessToken === newSnapshot.accessToken &&
			this.activeConfig.webhookVerifyToken === newSnapshot.webhookVerifyToken &&
			this.activeConfig.allowedPhoneNumbers === newSnapshot.allowedPhoneNumbers
		) {
			return;
		}

		this.activeConfig = newSnapshot;

		if (newSnapshot.enabled && newSnapshot.phoneNumberId && newSnapshot.accessToken) {
			this.logger.log('WhatsApp bot provider config updated');
		} else {
			this.logger.log('WhatsApp bot provider disabled or not configured');
		}
	}

	/**
	 * Forward new suggestions to all registered WhatsApp phones with interactive buttons.
	 * Only sends to phones still on the current whitelist.
	 */
	@OnEvent(EventType.SUGGESTION_CREATED)
	async onSuggestionCreated(suggestion: BuddySuggestion): Promise<void> {
		const config = this.getPluginConfig();

		if (!config?.enabled || !config.phoneNumberId || !config.accessToken) {
			return;
		}

		const allowedPhones = this.parseAllowedPhoneNumbers(config.allowedPhoneNumbers);

		for (const phone of this.registeredPhones) {
			if (allowedPhones.size > 0 && !allowedPhones.has(phone)) {
				continue;
			}

			try {
				await this.sendInteractiveButtons(config, phone, `💡 *${suggestion.title}*\n\n${suggestion.reason}`, [
					{ id: `suggestion:accept:${suggestion.id}`, title: 'Accept' },
					{ id: `suggestion:dismiss:${suggestion.id}`, title: 'Dismiss' },
				]);
			} catch (error) {
				this.logger.warn(`Failed to send suggestion to WhatsApp ${phone}: ${String(error)}`);
			}
		}
	}

	/**
	 * Verify a webhook token against the configured verify token.
	 */
	verifyWebhookToken(token: string): boolean {
		const config = this.getPluginConfig();

		return Boolean(config?.webhookVerifyToken && config.webhookVerifyToken === token);
	}

	/**
	 * Handle an incoming WhatsApp webhook payload.
	 */
	async handleWebhookPayload(payload: unknown): Promise<void> {
		const config = this.getPluginConfig();

		if (!config?.enabled || !config.phoneNumberId || !config.accessToken) {
			return;
		}

		const typed = payload as WhatsAppWebhookPayload;

		if (typed.object !== 'whatsapp_business_account') {
			return;
		}

		const allowedPhones = this.parseAllowedPhoneNumbers(config.allowedPhoneNumbers);

		for (const entry of typed.entry ?? []) {
			for (const change of entry.changes ?? []) {
				const messages = change.value?.messages;

				if (!messages) {
					continue;
				}

				for (const message of messages) {
					try {
						const from = message.from;

						if (!from) {
							continue;
						}

						// Enforce phone number whitelist
						if (allowedPhones.size > 0 && !allowedPhones.has(from)) {
							this.logger.debug(`Rejected message from unauthorized WhatsApp number ${from}`);

							continue;
						}

						if (message.type === 'text' && message.text?.body) {
							await this.handleTextMessage(config, from, message.text.body);
						} else if (
							message.type === 'interactive' &&
							message.interactive?.type === 'button_reply' &&
							message.interactive.button_reply?.id
						) {
							await this.handleButtonReply(config, from, message.interactive.button_reply.id);
						}
					} catch (error) {
						this.logger.error(`Failed to process WhatsApp message: ${String(error)}`);
					}
				}
			}
		}
	}

	isConfigured(): boolean {
		const config = this.getPluginConfig();

		return Boolean(config?.enabled && config.phoneNumberId && config.accessToken);
	}

	private async handleTextMessage(
		config: BuddyWhatsappConfigModel & { phoneNumberId: string; accessToken: string },
		from: string,
		text: string,
	): Promise<void> {
		this.registeredPhones.add(from);

		try {
			const conversationId = await this.getOrCreateConversation(from);
			const response = await this.conversationService.sendMessage(conversationId, text);

			await this.sendTextMessage(config, from, response.content);
		} catch (error) {
			this.logger.error(`Error processing WhatsApp message from ${from}: ${String(error)}`);
			await this.sendTextMessage(
				config,
				from,
				'Sorry, I encountered an error processing your message. Please try again.',
			);
		}
	}

	private async handleButtonReply(
		config: BuddyWhatsappConfigModel & { phoneNumberId: string; accessToken: string },
		from: string,
		buttonId: string,
	): Promise<void> {
		const match = /^suggestion:(accept|dismiss):(.+)$/.exec(buttonId);

		if (!match) {
			return;
		}

		const [, action, suggestionId] = match;
		const feedback = action === 'accept' ? SuggestionFeedback.APPLIED : SuggestionFeedback.DISMISSED;

		let feedbackRecorded = false;

		try {
			this.suggestionEngine.recordFeedback(suggestionId, feedback);
			feedbackRecorded = true;
		} catch {
			await this.sendTextMessage(config, from, 'Suggestion not found or expired.');

			return;
		}

		if (feedbackRecorded) {
			const confirmText = action === 'accept' ? 'Suggestion accepted ✅' : 'Suggestion dismissed';

			try {
				await this.sendTextMessage(config, from, confirmText);
			} catch (error) {
				this.logger.warn(`Failed to send confirmation to WhatsApp ${from}: ${String(error)}`);
			}
		}
	}

	/**
	 * Get the active conversation for a WhatsApp phone number, or create a new one.
	 */
	private async getOrCreateConversation(phone: string): Promise<string> {
		const existingId = this.phoneConversations.get(phone);

		if (existingId) {
			const conversation = await this.conversationService.findOne(existingId);

			if (conversation) {
				return existingId;
			}
		}

		const conversation = await this.conversationService.create(`WhatsApp (${phone})`);

		this.phoneConversations.set(phone, conversation.id);

		return conversation.id;
	}

	/**
	 * Send a plain text message via WhatsApp Cloud API.
	 */
	private async sendTextMessage(
		config: { phoneNumberId: string; accessToken: string },
		to: string,
		text: string,
	): Promise<void> {
		const body = {
			messaging_product: 'whatsapp',
			to,
			type: 'text',
			text: { body: text },
		};

		await this.callWhatsAppApi(config, body);
	}

	/**
	 * Send an interactive message with buttons via WhatsApp Cloud API.
	 */
	private async sendInteractiveButtons(
		config: { phoneNumberId: string; accessToken: string },
		to: string,
		bodyText: string,
		buttons: Array<{ id: string; title: string }>,
	): Promise<void> {
		const body = {
			messaging_product: 'whatsapp',
			to,
			type: 'interactive',
			interactive: {
				type: 'button',
				body: { text: bodyText },
				action: {
					buttons: buttons.slice(0, 3).map((btn) => ({
						type: 'reply',
						reply: { id: btn.id, title: btn.title },
					})),
				},
			},
		};

		await this.callWhatsAppApi(config, body);
	}

	/**
	 * Make a WhatsApp Cloud API call with retry and exponential backoff.
	 */
	private async callWhatsAppApi(config: { phoneNumberId: string; accessToken: string }, body: unknown): Promise<void> {
		const url = `${WHATSAPP_GRAPH_API_BASE_URL}/${WHATSAPP_GRAPH_API_VERSION}/${config.phoneNumberId}/messages`;

		for (let attempt = 0; attempt <= WHATSAPP_RETRY_DELAYS_MS.length; attempt++) {
			try {
				const response = await fetch(url, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${config.accessToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(body),
				});

				if (!response.ok) {
					const errorText = await response.text();
					const error = new Error(`WhatsApp API error ${response.status}: ${errorText}`);

					// Client errors (4xx) are permanent failures — do not retry, except 429 (rate limit)
					if (response.status >= 400 && response.status < 500 && response.status !== 429) {
						throw Object.assign(error, { permanent: true });
					}

					throw error;
				}

				return;
			} catch (error) {
				// Do not retry permanent (4xx) client errors
				if ((error as { permanent?: boolean }).permanent || attempt >= WHATSAPP_RETRY_DELAYS_MS.length) {
					throw error;
				}

				const delay = WHATSAPP_RETRY_DELAYS_MS[attempt];

				const msg = `WhatsApp API call failed (attempt ${attempt + 1}), retrying in ${delay}ms: ${String(error)}`;

				this.logger.warn(msg);
				await this.sleep(delay);
			}
		}
	}

	/**
	 * Parse comma-separated phone numbers into a Set.
	 */
	private parseAllowedPhoneNumbers(raw?: string | null): Set<string> {
		const phones = new Set<string>();

		if (!raw || raw.trim() === '') {
			return phones;
		}

		for (const part of raw.split(',')) {
			const trimmed = part.trim();

			if (trimmed.length > 0) {
				// Strip leading '+' so entries match WhatsApp's from field (no '+' prefix)
				phones.add(trimmed.replace(/^\+/, ''));
			}
		}

		return phones;
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private getPluginConfig(): BuddyWhatsappConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyWhatsappConfigModel>(BUDDY_WHATSAPP_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
