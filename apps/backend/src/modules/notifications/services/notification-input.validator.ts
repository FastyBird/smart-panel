import { Injectable } from '@nestjs/common';

import { NotificationData } from '../entities/notifications.entity';
import {
	NotificationActionInput,
	NotificationServiceExtensionKind,
	NotificationServiceOperation,
} from '../models/notification-action.model';
import {
	NOTIFICATION_ACTIONS_MAX,
	NOTIFICATION_DATA_MAX_BYTES,
	NOTIFICATION_MESSAGE_MAX_LENGTH,
	NOTIFICATION_TITLE_MAX_LENGTH,
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../notifications.constants';

import type { CreateNotificationInput } from './notifications.service';

/**
 * A {@link CreateNotificationInput} with every optional field resolved, ready to be written.
 */
export interface ValidatedNotificationInput {
	source: string;
	kind: NotificationKind;
	key: string | null;
	severity: NotificationSeverity;
	title: string;
	message: string | null;
	actions: NotificationActionInput[];
	data: NotificationData | null;
	persistent: boolean;
}

export type NotificationInputValidationResult =
	| { outcome: 'accepted'; value: ValidatedNotificationInput }
	| { outcome: 'rejected'; reason: string };

const SERVICE_EXTENSION_KINDS: readonly NotificationServiceExtensionKind[] = ['module', 'plugin'];

const SERVICE_OPERATIONS: readonly NotificationServiceOperation[] = ['start', 'stop', 'restart'];

const reject = (reason: string): NotificationInputValidationResult => ({ outcome: 'rejected', reason });

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

const truncate = (value: string, maxLength: number): string =>
	value.length > maxLength ? value.slice(0, maxLength) : value;

/**
 * Turns whatever an emitter passed into a row the module is willing to store, or explains
 * why it will not store it.
 *
 * Everything an emitter can plausibly get slightly wrong (an over-long title, a fourth
 * action) is repaired; everything that would store something misleading or unsafe (an
 * issue with no key to resolve it by, a `javascript:` call to action, a config dump in
 * `data`) is refused. The caller turns a refusal into one warning and a `null`, never an
 * exception - an emitter inside a reconnect loop must not be taken down by this module.
 */
@Injectable()
export class NotificationInputValidator {
	validate(input: CreateNotificationInput): NotificationInputValidationResult {
		// Guarded rather than assumed: `notify()` promises never to throw at its emitter, and
		// `input` itself crosses that same untyped boundary, so a caller that hands over `null`
		// or a bare string must be a refusal here rather than a TypeError on `input.source`.
		if (!isPlainObject(input)) {
			return reject('input must be an object');
		}

		if (!isNonEmptyString(input.source)) {
			return reject('source is required');
		}

		if (!Object.values(NotificationKind).includes(input.kind)) {
			return reject(`kind '${String(input.kind)}' is not a known notification kind`);
		}

		if (!Object.values(NotificationSeverity).includes(input.severity)) {
			return reject(`severity '${String(input.severity)}' is not a known notification severity`);
		}

		const key = isNonEmptyString(input.key) ? input.key.trim() : null;

		if (input.kind === NotificationKind.ISSUE && key === null) {
			return reject('an issue needs a key so that its source can resolve it');
		}

		// Guarded rather than assumed: `notify()` promises never to throw at its emitter, and
		// the input crosses an untyped boundary often enough (config, JSON, JavaScript callers)
		// that a non-array here has to be a refusal rather than a TypeError.
		if (input.actions !== undefined && input.actions !== null && !Array.isArray(input.actions)) {
			return reject('actions must be an array');
		}

		const actions = (input.actions ?? []).slice(0, NOTIFICATION_ACTIONS_MAX);

		for (const action of actions) {
			const actionRejection = this.validateAction(action);

			if (actionRejection !== null) {
				return reject(actionRejection);
			}
		}

		const dataRejection = this.validateData(input.data);

		if (dataRejection !== null) {
			return reject(dataRejection);
		}

		return {
			outcome: 'accepted',
			value: {
				source: input.source.trim(),
				kind: input.kind,
				key,
				severity: input.severity,
				title: truncate(input.title ?? '', NOTIFICATION_TITLE_MAX_LENGTH),
				message: isNonEmptyString(input.message) ? truncate(input.message, NOTIFICATION_MESSAGE_MAX_LENGTH) : null,
				actions,
				data: input.data ?? null,
				// `persistent` is an issue concept; an event is never re-raised at boot.
				persistent: input.kind === NotificationKind.ISSUE && input.persistent === true,
			},
		};
	}

	private validateAction(action: NotificationActionInput): string | null {
		if (!isNonEmptyString(action?.label)) {
			return 'an action needs a label';
		}

		switch (action.type) {
			case NotificationActionType.LINK:
				return this.validateLinkUrl(action.url);

			case NotificationActionType.EXTENSION_ACTION:
				if (!isNonEmptyString(action.extension_type)) {
					return 'an extension action needs an extension_type';
				}

				if (!isNonEmptyString(action.action_id)) {
					return 'an extension action needs an action_id';
				}

				return this.validateActionParams(action.params);

			case NotificationActionType.SERVICE:
				if (!SERVICE_EXTENSION_KINDS.includes(action.extension_kind)) {
					return `a service action needs an extension_kind of ${SERVICE_EXTENSION_KINDS.join(' or ')}`;
				}

				if (!isNonEmptyString(action.extension_type)) {
					return 'a service action needs an extension_type';
				}

				if (!isNonEmptyString(action.service_id)) {
					return 'a service action needs a service_id';
				}

				if (!SERVICE_OPERATIONS.includes(action.operation)) {
					return `a service action needs an operation of ${SERVICE_OPERATIONS.join(', ')}`;
				}

				return null;

			default: {
				const { type } = action as { type?: string };

				return `action type '${type ?? 'undefined'}' is not a known action type`;
			}
		}
	}

	/**
	 * Admin-relative paths and absolute http(s) URLs only. Scheme-relative `//host` is
	 * refused with the other schemes: it inherits the admin's scheme and is an off-site
	 * jump the reader cannot tell from an in-app link.
	 */
	private validateLinkUrl(url: unknown): string | null {
		if (!isNonEmptyString(url)) {
			return 'a link action needs a url';
		}

		if (url.startsWith('//')) {
			return `link url '${url}' must be an admin path or an absolute http(s) url`;
		}

		if (url.startsWith('/') || /^https?:\/\//i.test(url)) {
			return null;
		}

		return `link url '${url}' must be an admin path or an absolute http(s) url`;
	}

	private validateActionParams(params: unknown): string | null {
		if (params === undefined || params === null) {
			return null;
		}

		if (!isPlainObject(params)) {
			return 'extension action params must be a flat object';
		}

		for (const value of Object.values(params)) {
			if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
				return 'extension action params must be a flat object of strings, numbers and booleans';
			}
		}

		return null;
	}

	private validateData(data: unknown): string | null {
		if (data === undefined || data === null) {
			return null;
		}

		if (!isPlainObject(data)) {
			return 'data must be a flat object';
		}

		for (const value of Object.values(data)) {
			if (value !== null && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
				return 'data must be a flat object of strings, numbers, booleans and nulls';
			}
		}

		if (Buffer.byteLength(JSON.stringify(data), 'utf8') > NOTIFICATION_DATA_MAX_BYTES) {
			return `data exceeds the ${NOTIFICATION_DATA_MAX_BYTES} byte limit`;
		}

		return null;
	}
}
