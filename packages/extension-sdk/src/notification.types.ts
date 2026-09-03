/**
 * Plain mirrors of the backend notifications module contract
 * (`apps/backend/src/modules/notifications/`). See `docs/notifications.md` for the full
 * developer guide: the lifecycle table, the emitter rules, the REST and websocket surface,
 * and how to write a channel plugin.
 *
 * These are typing-only mirrors, not the backend's own classes: an emitter or channel
 * compiled as part of the backend (`apps/backend/src/modules/**`, `apps/backend/src/plugins/**`)
 * keeps using the real `NotificationsService` / `INotificationChannel` from
 * `apps/backend/src/modules/notifications/`. An installable extension package - one built
 * against this SDK, outside the backend's own TypeScript program - types against the shapes
 * below instead.
 */

/**
 * Whether a notification records something that happened (`event`) or a condition that
 * holds until its source resolves it (`issue`).
 */
export type NotificationKind = 'event' | 'issue';

/**
 * How urgent a notification is. Channels filter delivery against their own configured
 * minimum severity; the admin sorts by it. Ordered low to high.
 */
export type NotificationSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Discriminates the three `NotificationAction` variants.
 */
export type NotificationActionType = 'link' | 'extension_action' | 'service';

/**
 * Extension kinds a `service` action can target.
 */
export type NotificationServiceExtensionKind = 'module' | 'plugin';

/**
 * Operations a `service` action can request of a managed extension service.
 */
export type NotificationServiceOperation = 'start' | 'stop' | 'restart';

/**
 * A call to action attached to a notification.
 *
 * Actions are pure data pointing at endpoints that already exist - the notifications
 * module never executes them. Property names are snake_case because this shape is stored
 * verbatim in the backend's `actions` JSON column and handed to the admin as-is; keep the
 * same casing when building one. At most three actions per notification, and at most one
 * with `primary: true`.
 */
export type NotificationAction =
	| {
			type: 'link';
			label: string;
			/** An admin-relative path (`/system/info`) or an absolute http(s) URL. Anything else is rejected. */
			url: string;
			primary?: boolean;
	  }
	| {
			type: 'extension_action';
			label: string;
			/** Extension type owning the action, e.g. `devices-home-assistant-plugin`. */
			extension_type: string;
			/** Identifier of the extension action to execute. */
			action_id: string;
			params?: Record<string, string | number | boolean>;
			primary?: boolean;
	  }
	| {
			type: 'service';
			label: string;
			/** Whether the managed service belongs to a module or a plugin. */
			extension_kind: NotificationServiceExtensionKind;
			/** Extension type owning the managed service. */
			extension_type: string;
			/** Identifier of the managed service to operate on. */
			service_id: string;
			operation: NotificationServiceOperation;
			primary?: boolean;
	  };

/**
 * Free-form context shown as a key/value table in the notification detail drawer. Flat by
 * contract - the core never reads it, so nesting would only be a way to smuggle stack
 * traces or secrets into channels. Serialized size is capped at 4 KB by the backend.
 */
export type NotificationData = Record<string, string | number | boolean | null>;

/**
 * What an emitter passes to the backend's `NotificationsService.notify()`.
 *
 * `notify()` never throws: an invalid input is refused with a warning log and a `null`
 * return, `title`/`message` are truncated to their limits, a fifth action onward is
 * dropped. A repeat `notify()` for the same `(source, key)` upserts the existing row
 * (incrementing `occurrences`) instead of inserting a new one.
 */
export interface CreateNotificationInput {
	/** Extension type of the emitter, e.g. `system-module`, `devices-home-assistant-plugin`. */
	source: string;
	kind: NotificationKind;
	/** Required for `issue`, optional for `event`. Aggregates repeats of the same condition. */
	key?: string;
	severity: NotificationSeverity;
	/** Plain text, truncated to 120 characters. */
	title: string;
	/** Plain text, truncated to 1000 characters. Newlines allowed. */
	message?: string;
	/** At most three; a fourth onward is dropped. */
	actions?: NotificationAction[];
	data?: NotificationData;
	/** Issues only. A persistent issue survives the boot cleanup untouched. Defaults to `false`. */
	persistent?: boolean;
}

/**
 * The stored notification a channel's `send()` receives - a plain payload mirroring the
 * backend's `NotificationEntity` JSON shape, not its TypeORM entity class.
 */
export interface Notification {
	id: string;
	source: string;
	kind: NotificationKind;
	key: string | null;
	severity: NotificationSeverity;
	title: string;
	message: string | null;
	actions: NotificationAction[];
	data: NotificationData | null;
	persistent: boolean;
	/** How often the same `(source, key)` has been reported since the row was created. */
	occurrences: number;
	read_at: string | null;
	dismissed_at: string | null;
	resolved_at: string | null;
	created_at: string;
	updated_at: string;
}

/**
 * Thrown by a channel's `send()` to classify a delivery failure. The dispatcher never
 * guesses from a raw error - only this shape drives its retry decision, so a channel that
 * wants a failure retried has to throw one explicitly (the backend's own `ChannelDeliveryError`
 * extends `Error`; do the same so the message and stack survive logging).
 */
export interface ChannelDeliveryError {
	message: string;
	/**
	 * Whether this attempt is worth retrying: a connection-establishment failure (DNS,
	 * refused, unreachable, TLS handshake) or an HTTP 429/5xx response - both documented by
	 * providers as "not processed". Anything else (a reset after the request was written, a
	 * timeout, a redirect, any other 4xx) is not retryable, because the request may already
	 * have been accepted.
	 */
	retryable: boolean;
	/** The HTTP status the channel's own request received, when the failure was a response. */
	status?: number;
}

/**
 * Contract every notification channel plugin implements and registers with the backend's
 * `NotificationChannelRegistryService.register()` in its own `onModuleInit`. See
 * `docs/notifications.md` for the full contract: the dispatcher's retry policy and
 * per-attempt timeout, the loop guard, the `send-test` action, and the HTTPS rules.
 */
export interface NotificationChannel {
	/** Plugin type, e.g. `notifications-discord-plugin`. Doubles as the channel's registry key. */
	getType(): string;

	/** `false` means the dispatcher skips this channel silently - no attempt, no failure report. */
	isConfigured(): Promise<boolean>;

	/** The lowest severity this channel forwards, read from the plugin's own config. */
	getMinSeverity(): Promise<NotificationSeverity>;

	/**
	 * Delivers one notification. Throw a `ChannelDeliveryError` to let the dispatcher decide
	 * whether the attempt is worth retrying; throwing anything else ends the delivery
	 * immediately. Must honour `signal` - the dispatcher races the returned promise against
	 * it regardless, so a channel that ignores it still settles, but reading it (and passing
	 * it through to `fetch`) frees resources sooner.
	 */
	send(notification: Notification, signal: AbortSignal): Promise<void>;
}
