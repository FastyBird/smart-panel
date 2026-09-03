import { PluginConfigModel } from '../../config/models/config.model';
import { ConfigService } from '../../config/services/config.service';
import { NotificationEntity } from '../entities/notifications.entity';
import { NotificationSeverity } from '../notifications.constants';

/**
 * Contract every notification channel plugin implements and registers with
 * {@link import('../services/notification-channel-registry.service').NotificationChannelRegistryService}
 * in its own `onModuleInit`. The dispatcher only ever talks to this shape - never to a channel's
 * own service directly - so a channel plugin can live entirely outside this module.
 */
export interface INotificationChannel {
	/** Plugin type, e.g. `notifications-discord-plugin`. Doubles as the channel's registry key. */
	getType(): string;

	/** `false` means the dispatcher skips this channel silently - no attempt, no failure report. */
	isConfigured(): Promise<boolean>;

	/** The lowest severity this channel forwards, read from the plugin's own config. */
	getMinSeverity(): Promise<NotificationSeverity>;

	/**
	 * Delivers one notification. Throw to report failure - a {@link ChannelDeliveryError} to let the
	 * dispatcher decide whether the attempt is worth retrying, anything else ends the delivery
	 * immediately. Must honour `signal`, but the dispatcher races the returned promise against it
	 * regardless, so a channel that ignores it still settles.
	 */
	send(notification: NotificationEntity, signal: AbortSignal): Promise<void>;
}

/**
 * Connection-establishment failures the providers document as "not processed" - safe to retry
 * because nothing was ever accepted on the other end.
 */
const RETRYABLE_CONNECTION_ERROR_CODES = new Set([
	'ENOTFOUND',
	'EAI_AGAIN',
	'ECONNREFUSED',
	'EHOSTUNREACH',
	'ENETUNREACH',
]);

/**
 * TLS/certificate handshake failures, which likewise happen before any request reached the server.
 * Node's `fetch` (undici) surfaces these as the OpenSSL error code on `error.cause.code`; there is no
 * single canonical prefix, so this is a curated list of the codes actually seen in practice rather
 * than an exhaustive one - a code missing from it simply falls through to "not retryable", which is
 * always the safe default for an unrecognised cause.
 */
const RETRYABLE_TLS_ERROR_CODES = new Set([
	'CERT_HAS_EXPIRED',
	'DEPTH_ZERO_SELF_SIGNED_CERT',
	'SELF_SIGNED_CERT_IN_CHAIN',
	'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
	'UNABLE_TO_GET_ISSUER_CERT',
	'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
	'CERT_UNTRUSTED',
	'CERT_CHAIN_TOO_LONG',
	'HOSTNAME_MISMATCH',
	'ERR_TLS_CERT_ALTNAME_INVALID',
	'ERR_TLS_HANDSHAKE_TIMEOUT',
	'ERR_SSL_WRONG_VERSION_NUMBER',
	'EPROTO',
]);

/**
 * The dispatcher-facing contract every channel failure boils down to: was this attempt worth
 * retrying, and, for an HTTP failure, what status came back. The dispatcher never inspects a raw
 * error - only channels (through {@link BaseNotificationChannel.classify}) and their own `send()`
 * throw this.
 */
export class ChannelDeliveryError extends Error {
	constructor(
		message: string,
		readonly retryable: boolean,
		readonly status?: number,
	) {
		super(message);
		this.name = 'ChannelDeliveryError';
	}
}

/**
 * Shares the config lookup, severity filter and HTTP failure classification every `fetch`-based
 * channel needs, so `notifications-webhook`, `-discord`, `-slack` and `-telegram` differ only in
 * their payload shape and endpoint.
 */
export abstract class BaseNotificationChannel implements INotificationChannel {
	protected constructor(
		protected readonly configService: ConfigService,
		protected readonly type: string,
	) {}

	getType(): string {
		return this.type;
	}

	/**
	 * `false` when the plugin config cannot be read at all (missing or corrupted - the dispatcher
	 * treats a channel it cannot check as unconfigured, not as an error), when the plugin is
	 * disabled, or when the concrete channel reports its required fields (the webhook URL, the bot
	 * token, ...) are not set.
	 */
	// eslint-disable-next-line @typescript-eslint/require-await -- async by INotificationChannel's contract; nothing to await here
	async isConfigured(): Promise<boolean> {
		const config = this.readConfig();

		if (config === null || config.enabled === false) {
			return false;
		}

		return this.hasRequiredConfig(config);
	}

	/**
	 * Reads `min_severity` off the plugin's own config model. Defaults to `warning` when the config
	 * cannot be read, or the field is missing or not a recognised severity.
	 */
	// eslint-disable-next-line @typescript-eslint/require-await -- async by INotificationChannel's contract; reading the config is synchronous
	async getMinSeverity(): Promise<NotificationSeverity> {
		const config = this.readConfig();
		const value = (config as unknown as Record<string, unknown> | null)?.['min_severity'];

		return this.isNotificationSeverity(value) ? value : NotificationSeverity.WARNING;
	}

	/** Whether `config` carries everything this channel needs to attempt a delivery. */
	protected abstract hasRequiredConfig(config: PluginConfigModel): boolean;

	abstract send(notification: NotificationEntity, signal: AbortSignal): Promise<void>;

	/**
	 * Shared wording so every channel's plain-text rendering reads the same:
	 * `[SEVERITY] Title`, the message on its own line when present, then the source and, above one
	 * occurrence, a repeat count - e.g. `Source: home-assistant-plugin · 3 occurrences`.
	 */
	protected formatText(notification: NotificationEntity): string {
		const lines = [`[${notification.severity.toUpperCase()}] ${notification.title}`];

		if (notification.message) {
			lines.push(notification.message);
		}

		const occurrences = notification.occurrences > 1 ? ` · ${notification.occurrences} occurrences` : '';

		lines.push(`Source: ${notification.source}${occurrences}`);

		return lines.join('\n');
	}

	/**
	 * The one `fetch` call every channel makes: the dispatcher's signal, and `redirect: 'error'` so a
	 * redirect - which could carry a webhook secret or bearer header to another origin - fails
	 * instead of following. A rejected `fetch` (DNS, refused, unreachable, TLS, abort, reset, ...) is
	 * turned into a {@link ChannelDeliveryError} through {@link classify}. A non-2xx response is
	 * returned as-is - the caller decides whether that status is retryable by passing it back through
	 * `classify(error, response)`.
	 */
	protected async fetchWithSignal(url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
		try {
			return await fetch(url, { ...init, signal, redirect: 'error' });
		} catch (error) {
			throw this.classify(error);
		}
	}

	/**
	 * Retryable: a connection-establishment failure (DNS, refused, unreachable, TLS handshake) or an
	 * HTTP 429/5xx response - both documented by the providers as "not processed". Everything else -
	 * a reset or broken pipe after the request was written, an abort/timeout, a redirect, any other
	 * 4xx, or a cause this method does not recognise - is not retryable, because the request may
	 * already have been accepted.
	 */
	protected classify(error: unknown, response?: Response): ChannelDeliveryError {
		if (response) {
			const retryable = response.status === 429 || response.status >= 500;

			return new ChannelDeliveryError(`Channel responded with HTTP ${response.status}`, retryable, response.status);
		}

		if (error instanceof ChannelDeliveryError) {
			return error;
		}

		// eslint-disable-next-line @typescript-eslint/no-base-to-string -- error is genuinely unknown; a non-Error rejection still needs a message
		const message = error instanceof Error ? error.message : String(error);
		const code = this.causeCode(error);
		const retryable =
			code !== undefined && (RETRYABLE_CONNECTION_ERROR_CODES.has(code) || RETRYABLE_TLS_ERROR_CODES.has(code));

		return new ChannelDeliveryError(message, retryable);
	}

	/**
	 * Node's `fetch` wraps the actionable cause in a generic `TypeError: fetch failed`; the errno
	 * (`ENOTFOUND`, `ECONNREFUSED`, ...) or OpenSSL code lives on `error.cause`, not on `error` itself.
	 */
	private causeCode(error: unknown): string | undefined {
		const direct = error instanceof Error ? (error as { code?: unknown }).code : undefined;

		if (typeof direct === 'string') {
			return direct;
		}

		const cause = error instanceof Error ? (error as { cause?: unknown }).cause : undefined;
		const causeCode = cause instanceof Error ? (cause as { code?: unknown }).code : undefined;

		return typeof causeCode === 'string' ? causeCode : undefined;
	}

	private readConfig(): PluginConfigModel | null {
		try {
			return this.configService.getPluginConfig<PluginConfigModel>(this.type);
		} catch {
			return null;
		}
	}

	private isNotificationSeverity(value: unknown): value is NotificationSeverity {
		return typeof value === 'string' && Object.values(NotificationSeverity).includes(value as NotificationSeverity);
	}
}
