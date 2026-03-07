import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { EventType } from '../../../modules/buddy/buddy.constants';
import { BuddyConversationService } from '../../../modules/buddy/services/buddy-conversation.service';
import { BuddySuggestion, SuggestionEngineService } from '../../../modules/buddy/services/suggestion-engine.service';
import { EventType as ConfigModuleEventType } from '../../../modules/config/config.constants';
import { ConfigService } from '../../../modules/config/services/config.service';
import { BUDDY_WHATSAPP_PLUGIN_NAME, WHATSAPP_AUTH_DIR, WhatsAppConnectionStatus } from '../buddy-whatsapp.constants';
import { BuddyWhatsappConfigModel } from '../models/config.model';

/**
 * WhatsApp bot provider using Baileys (WhatsApp Web protocol).
 *
 * - Connects via QR code scan (no Meta Business account needed)
 * - Routes incoming text messages through BuddyConversationService
 * - Forwards suggestion notifications to registered phone numbers
 * - Persists authentication state across restarts
 * - Enforces a phone number whitelist for security
 */
@Injectable()
export class WhatsAppBotProvider implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = new Logger(WhatsAppBotProvider.name);

	private socket: import('@whiskeysockets/baileys').WASocket | null = null;
	private status: WhatsAppConnectionStatus = WhatsAppConnectionStatus.DISCONNECTED;
	private currentQr: string | null = null;
	private reconnecting = false;

	/** Snapshot of the last applied config to detect actual changes */
	private activeConfig: {
		enabled: boolean;
		allowedPhoneNumbers: string | null;
	} | null = null;

	/** WhatsApp JID → active buddy conversation ID */
	private readonly jidConversations = new Map<string, string>();

	/** Registered JIDs that have interacted (for suggestion forwarding) */
	private readonly registeredJids = new Set<string>();

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

		this.activeConfig = {
			enabled: config?.enabled ?? false,
			allowedPhoneNumbers: config?.allowedPhoneNumbers ?? null,
		};

		if (config?.enabled) {
			void this.startBot();
		}
	}

	onModuleDestroy(): void {
		this.stopBot();
		this.jidConversations.clear();
		this.registeredJids.clear();
	}

	/**
	 * Restart bot when WhatsApp plugin configuration changes.
	 */
	@OnEvent(ConfigModuleEventType.CONFIG_UPDATED)
	onConfigUpdated(): void {
		const config = this.getPluginConfig();

		const newSnapshot = {
			enabled: config?.enabled ?? false,
			allowedPhoneNumbers: config?.allowedPhoneNumbers ?? null,
		};

		if (
			this.activeConfig &&
			this.activeConfig.enabled === newSnapshot.enabled &&
			this.activeConfig.allowedPhoneNumbers === newSnapshot.allowedPhoneNumbers
		) {
			return;
		}

		this.stopBot();

		this.activeConfig = newSnapshot;

		if (config?.enabled) {
			void this.startBot();
		}
	}

	/**
	 * Forward new suggestions to all registered WhatsApp users.
	 */
	@OnEvent(EventType.SUGGESTION_CREATED)
	async onSuggestionCreated(suggestion: BuddySuggestion): Promise<void> {
		if (!this.socket || this.status !== WhatsAppConnectionStatus.CONNECTED) {
			return;
		}

		const config = this.getPluginConfig();

		if (!config?.enabled) {
			return;
		}

		const allowedPhones = this.parseAllowedPhoneNumbers(config.allowedPhoneNumbers);

		for (const jid of this.registeredJids) {
			const phone = jid.split('@')[0];

			if (allowedPhones.size > 0 && !allowedPhones.has(phone)) {
				continue;
			}

			try {
				await this.socket.sendMessage(jid, {
					text: `*${suggestion.title}*\n\n${suggestion.reason}`,
				});
			} catch (error) {
				this.logger.warn(`Failed to send suggestion to ${jid}: ${String(error)}`);
			}
		}
	}

	getConnectionStatus(): WhatsAppConnectionStatus {
		return this.status;
	}

	getCurrentQr(): string | null {
		return this.currentQr;
	}

	isConnected(): boolean {
		return this.status === WhatsAppConnectionStatus.CONNECTED;
	}

	/**
	 * Disconnect and clear authentication state so a new QR code can be generated.
	 *
	 * We intentionally do NOT call `this.socket.logout()` because that tells
	 * WhatsApp servers to invalidate the session. A fresh socket connecting
	 * shortly after would be immediately rejected with a loggedOut status code.
	 * Instead we just close the connection and delete the local auth state —
	 * the old server-side session will expire on its own.
	 */
	logout(): void {
		this.stopBot();

		// Clear auth state so a fresh QR code is generated on next start
		const authDir = join(process.cwd(), WHATSAPP_AUTH_DIR);

		if (existsSync(authDir)) {
			rmSync(authDir, { recursive: true, force: true });
		}

		const config = this.getPluginConfig();

		if (config?.enabled) {
			void this.startBot();
		}
	}

	private async startBot(): Promise<void> {
		if (this.socket) {
			return;
		}

		try {
			this.status = WhatsAppConnectionStatus.CONNECTING;

			// Dynamic import to avoid Jest ESM parse errors (baileys is ESM-only)
			const {
				default: makeWASocket,
				DisconnectReason,
				fetchLatestBaileysVersion,
				makeCacheableSignalKeyStore,
				useMultiFileAuthState,
			} = await import('@whiskeysockets/baileys');

			const authDir = join(process.cwd(), WHATSAPP_AUTH_DIR);

			if (!existsSync(authDir)) {
				mkdirSync(authDir, { recursive: true });
			}

			const { state, saveCreds } = await useMultiFileAuthState(authDir);
			const { version } = await fetchLatestBaileysVersion();

			const noopLogger = {
				level: 'silent',
				child: () => noopLogger,
				trace: () => {},
				debug: () => {},
				info: () => {},
				warn: () => {},
				error: () => {},
				fatal: () => {},
			};

			this.socket = makeWASocket({
				version,
				auth: {
					creds: state.creds,
					keys: makeCacheableSignalKeyStore(state.keys, noopLogger as never),
				},
				logger: noopLogger as never,
			});

			// Capture a reference so that async event handlers from a stale socket
			// (e.g., after logout → stopBot → startBot) do not clobber the new socket.
			const currentSocket = this.socket;

			currentSocket.ev.on('creds.update', () => void saveCreds());

			currentSocket.ev.on('connection.update', (update) => {
				// Ignore events from a socket that is no longer active
				if (this.socket !== currentSocket) {
					this.logger.debug('Ignoring connection.update from stale socket');

					return;
				}

				const { connection, lastDisconnect, qr } = update;

				if (qr) {
					this.currentQr = qr;
					this.status = WhatsAppConnectionStatus.QR_READY;
					this.logger.log('WhatsApp QR code ready — scan with your phone');
				}

				if (connection === 'open') {
					this.currentQr = null;
					this.status = WhatsAppConnectionStatus.CONNECTED;
					this.reconnecting = false;
					this.logger.log('WhatsApp bot connected');
				}

				if (connection === 'close') {
					this.currentQr = null;

					const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;

					this.logger.log(`WhatsApp connection closed (statusCode=${statusCode}, reconnecting=${this.reconnecting})`);

					this.socket = null;

					if (this.reconnecting) {
						// Intentional disconnect (stopBot was called) — do not auto-reconnect
						this.status = WhatsAppConnectionStatus.DISCONNECTED;
					} else {
						// Unexpected disconnect — clear auth state and reconnect
						const authDir = join(process.cwd(), WHATSAPP_AUTH_DIR);

						if (statusCode === Number(DisconnectReason.loggedOut) && existsSync(authDir)) {
							this.logger.log('Clearing auth state after loggedOut disconnect');
							rmSync(authDir, { recursive: true, force: true });
						}

						this.status = WhatsAppConnectionStatus.CONNECTING;
						this.reconnecting = true;
						this.logger.log('WhatsApp reconnecting...');
						void this.startBot();
					}
				}
			});

			currentSocket.ev.on('messages.upsert', ({ messages }) => {
				// Ignore events from a stale socket
				if (this.socket !== currentSocket) {
					return;
				}

				for (const msg of messages) {
					if (msg.key.fromMe || !msg.message) {
						continue;
					}

					void this.handleMessage(msg);
				}
			});
		} catch (error) {
			this.logger.error(`Failed to start WhatsApp bot: ${String(error)}`);
			this.socket = null;
			this.status = WhatsAppConnectionStatus.DISCONNECTED;
		}
	}

	private stopBot(): void {
		this.reconnecting = true; // Prevent auto-reconnect

		if (this.socket) {
			this.socket.end(undefined);
			this.socket = null;
		}

		this.status = WhatsAppConnectionStatus.DISCONNECTED;
		this.currentQr = null;
		this.reconnecting = false;
	}

	private async handleMessage(msg: { key: { remoteJid?: string | null }; message?: object | null }): Promise<void> {
		const jid = msg.key.remoteJid;

		if (!jid || jid.endsWith('@g.us')) {
			// Ignore group messages
			return;
		}

		const config = this.getPluginConfig();

		if (!config?.enabled) {
			return;
		}

		// Extract text from various message types
		const text = this.extractText(msg.message);

		if (!text) {
			return;
		}

		const phone = jid.split('@')[0];
		const allowedPhones = this.parseAllowedPhoneNumbers(config.allowedPhoneNumbers);

		if (allowedPhones.size > 0 && !allowedPhones.has(phone)) {
			this.logger.debug(`Rejected message from unauthorized WhatsApp number ${phone}`);

			return;
		}

		this.registeredJids.add(jid);

		try {
			const conversationId = await this.getOrCreateConversation(jid, phone);
			const response = await this.conversationService.sendMessage(conversationId, text);

			await this.socket?.sendMessage(jid, { text: response.content });
		} catch (error) {
			this.logger.error(`Error processing WhatsApp message from ${phone}: ${String(error)}`);

			try {
				await this.socket?.sendMessage(jid, {
					text: 'Sorry, I encountered an error processing your message. Please try again.',
				});
			} catch {
				// Ignore send failure for error message
			}
		}
	}

	private extractText(message?: object | null): string | null {
		if (!message) {
			return null;
		}

		const msg = message as Record<string, unknown>;

		// Plain text message
		if (typeof msg.conversation === 'string') {
			return msg.conversation.trim() || null;
		}

		// Extended text message (e.g., replies, links)
		const ext = msg.extendedTextMessage as { text?: string } | undefined;

		if (ext?.text) {
			return ext.text.trim() || null;
		}

		return null;
	}

	private async getOrCreateConversation(jid: string, phone: string): Promise<string> {
		const existingId = this.jidConversations.get(jid);

		if (existingId) {
			const conversation = await this.conversationService.findOne(existingId);

			if (conversation) {
				return existingId;
			}
		}

		const conversation = await this.conversationService.create(`WhatsApp (${phone})`);

		this.jidConversations.set(jid, conversation.id);

		return conversation.id;
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
				// Strip leading '+' so entries match WhatsApp's JID format (no '+' prefix)
				phones.add(trimmed.replace(/^\+/, ''));
			}
		}

		return phones;
	}

	private getPluginConfig(): BuddyWhatsappConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyWhatsappConfigModel>(BUDDY_WHATSAPP_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
