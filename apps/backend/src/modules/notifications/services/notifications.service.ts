import { FindOptionsWhere, In, IsNull, LessThan, MoreThan, Not, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { NotificationData, NotificationEntity } from '../entities/notifications.entity';
import { NotificationActionInput } from '../models/notification-action.model';
import {
	EventType,
	NOTIFICATIONS_DEFAULT_PAGE_SIZE,
	NOTIFICATIONS_MAX_PAGE_SIZE,
	NOTIFICATIONS_MODULE_NAME,
	NOTIFICATION_RATE_LIMIT_PER_MINUTE,
	NOTIFICATION_RATE_LIMIT_WINDOW_MS,
	NotificationKind,
	NotificationSeverity,
} from '../notifications.constants';
import { NotificationsNotFoundException } from '../notifications.exceptions';

import { NotificationInputValidator, ValidatedNotificationInput } from './notification-input.validator';

/**
 * What an emitter hands to {@link NotificationsService.notify}.
 */
export interface CreateNotificationInput {
	source: string;
	kind: NotificationKind;
	/** Required for issues, optional for events; aggregates repeats of the same condition. */
	key?: string;
	severity: NotificationSeverity;
	title: string;
	message?: string;
	actions?: NotificationActionInput[];
	data?: NotificationData;
	/** Issues only. A persistent issue is not resolved by the boot cleanup. */
	persistent?: boolean;
}

export type NotificationsStatusFilter = 'active' | 'dismissed' | 'resolved' | 'all';

export interface NotificationsFilter {
	/** Defaults to `active`, meaning neither dismissed nor resolved. */
	status?: NotificationsStatusFilter;
	severity?: NotificationSeverity[];
	source?: string;
	kind?: NotificationKind;
	unread?: boolean;
	/** Cursor: return the rows that follow this row in the list order. */
	afterId?: string;
	limit?: number;
}

/**
 * Thin pointer broadcast over the websocket. Clients fetch the row through the guarded
 * REST endpoint rather than reading a body off the exchange room.
 */
export interface NotificationEventPayload {
	id: string;
	kind: NotificationKind;
	severity: NotificationSeverity;
	source: string;
}

interface RateWindow {
	startedAt: number;
	count: number;
	warned: boolean;
}

@Injectable()
export class NotificationsService {
	private readonly logger = createExtensionLogger(NOTIFICATIONS_MODULE_NAME, 'NotificationsService');

	private readonly rateWindows = new Map<string, RateWindow>();

	constructor(
		@InjectRepository(NotificationEntity)
		private readonly repository: Repository<NotificationEntity>,
		private readonly validator: NotificationInputValidator,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Records an event or raises an issue.
	 *
	 * Never throws: a refused input and a failed write are both one log line and a `null`,
	 * because the callers are reconnect loops, cron jobs and request handlers that must not
	 * fail because the notifications table did.
	 */
	async notify(input: CreateNotificationInput): Promise<NotificationEntity | null> {
		const validation = this.validator.validate(input);

		if (validation.outcome === 'rejected') {
			this.logger.warn(`Refused a notification from source=${String(input?.source)}: ${validation.reason}`);

			return null;
		}

		const value = validation.value;

		if (!this.consumeRateBudget(value.source)) {
			return null;
		}

		try {
			if (value.key === null) {
				return await this.insert(value);
			}

			const existing = await this.repository.findOne({
				where: { source: value.source, key: value.key, resolvedAt: IsNull() },
			});

			return existing === null ? await this.insert(value) : await this.upsert(existing, value);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to store a notification from source=${value.source}: ${err.message}`);

			return null;
		}
	}

	/**
	 * Closes the aggregation window of one keyed row. The next `notify()` with the same key
	 * starts a fresh row, which the partial unique index permits once this one is resolved.
	 */
	async resolve(source: string, key: string): Promise<boolean> {
		if (!source || !key) {
			this.logger.warn(`Ignored a resolve without both a source and a key (source=${source}, key=${key})`);

			return false;
		}

		const notification = await this.repository.findOne({ where: { source, key, resolvedAt: IsNull() } });

		if (notification === null) {
			this.logger.debug(`No active notification to resolve for source=${source} key=${key}`);

			return false;
		}

		const now = new Date();

		notification.resolvedAt = now;
		notification.updatedAt = now;

		const resolved = await this.repository.save(notification);

		this.emit(EventType.NOTIFICATION_UPDATED, resolved);

		return true;
	}

	/**
	 * Resolves every unresolved keyed row of one source, for when a plugin is disabled or its
	 * service stops and nothing is left to re-raise its issues.
	 *
	 * Dismissed rows are resolved too, exactly as `resolve()` treats them: the source going
	 * away means all of its conditions are over. Skipping them would leave a dismissed but
	 * unresolved issue outliving the plugin that raised it - invisible in the active list, and
	 * never pruned, because retention only counts an issue from its resolution.
	 */
	async resolveAll(source: string): Promise<number> {
		const notifications = await this.repository.find({
			where: { source, key: Not(IsNull()), resolvedAt: IsNull() },
		});

		if (notifications.length === 0) {
			return 0;
		}

		const now = new Date();

		for (const notification of notifications) {
			notification.resolvedAt = now;
			notification.updatedAt = now;
		}

		const resolved = await this.repository.save(notifications);

		for (const notification of resolved) {
			this.emit(EventType.NOTIFICATION_UPDATED, notification);
		}

		this.logger.log(`Resolved ${resolved.length} active notifications of source=${source}`);

		return resolved.length;
	}

	async findAll(filter: NotificationsFilter): Promise<NotificationEntity[]> {
		const base = this.buildWhere(filter);
		const cursor = filter.afterId ? await this.repository.findOne({ where: { id: filter.afterId } }) : null;

		if (filter.afterId && cursor === null) {
			this.logger.debug(`Ignoring cursor after_id=${filter.afterId}, the row no longer exists`);
		}

		// The list is ordered by creation time, newest first, with the id breaking ties, so
		// the cursor is "older than the cursor row, or the same age and further down the page".
		const where: FindOptionsWhere<NotificationEntity>[] =
			cursor === null
				? [base]
				: [
						{ ...base, createdAt: LessThan(cursor.createdAt) },
						{ ...base, createdAt: cursor.createdAt, id: MoreThan(cursor.id) },
					];

		return this.repository.find({
			where,
			order: { createdAt: 'DESC', id: 'ASC' },
			take: this.resolveLimit(filter.limit),
		});
	}

	async findOne(id: string): Promise<NotificationEntity | null> {
		return this.repository.findOne({ where: { id } });
	}

	async markRead(id: string, read: boolean): Promise<NotificationEntity> {
		const notification = await this.getOneOrThrow(id);

		notification.readAt = read ? new Date() : null;
		notification.updatedAt = new Date();

		const saved = await this.repository.save(notification);

		this.emit(EventType.NOTIFICATION_UPDATED, saved);

		return saved;
	}

	async dismiss(id: string, dismissed: boolean): Promise<NotificationEntity> {
		const notification = await this.getOneOrThrow(id);

		notification.dismissedAt = dismissed ? new Date() : null;
		notification.updatedAt = new Date();

		const saved = await this.repository.save(notification);

		this.emit(EventType.NOTIFICATION_UPDATED, saved);

		return saved;
	}

	/**
	 * Deletes the row outright. The source is not told: an issue whose condition still holds
	 * is raised again by its source, which is the truthful outcome.
	 */
	async remove(id: string): Promise<void> {
		const notification = await this.getOneOrThrow(id);

		await this.repository.delete(notification.id);

		this.eventEmitter.emit(EventType.NOTIFICATION_DELETED, { id: notification.id });
	}

	/**
	 * Drives the bell badge: unread rows that are neither dismissed nor resolved.
	 */
	async countUnread(): Promise<number> {
		return this.repository.count({ where: { readAt: IsNull(), dismissedAt: IsNull(), resolvedAt: IsNull() } });
	}

	private async insert(value: ValidatedNotificationInput): Promise<NotificationEntity> {
		const now = new Date();

		const notification = await this.repository.save(
			this.repository.create({
				...value,
				occurrences: 1,
				readAt: null,
				dismissedAt: null,
				resolvedAt: null,
				createdAt: now,
				updatedAt: now,
			}),
		);

		this.logger.debug(`Created notification id=${notification.id} source=${value.source} kind=${value.kind}`);

		this.emit(EventType.NOTIFICATION_CREATED, notification);

		return notification;
	}

	/**
	 * Folds a repeat into the row that already holds the condition.
	 *
	 * An event re-opens: the repeat is news, so read and dismissed marks are cleared. An
	 * issue does not: the administrator dismissed a condition that has not changed, and
	 * un-hiding it on every retry tick would make dismissing an issue meaningless.
	 */
	private async upsert(existing: NotificationEntity, value: ValidatedNotificationInput): Promise<NotificationEntity> {
		const now = new Date();

		existing.severity = value.severity;
		existing.title = value.title;
		existing.message = value.message;
		existing.actions = value.actions;
		existing.data = value.data;
		existing.persistent = value.persistent;
		existing.occurrences += 1;
		existing.updatedAt = now;

		if (value.kind === NotificationKind.EVENT) {
			existing.readAt = null;
			existing.dismissedAt = null;
		}

		const notification = await this.repository.save(existing);

		this.logger.debug(
			`Updated notification id=${notification.id} source=${value.source} occurrences=${notification.occurrences}`,
		);

		this.emit(EventType.NOTIFICATION_UPDATED, notification);

		return notification;
	}

	private async getOneOrThrow(id: string): Promise<NotificationEntity> {
		const notification = await this.findOne(id);

		if (notification === null) {
			throw new NotificationsNotFoundException(`Notification with id=${id} not found`);
		}

		return notification;
	}

	private buildWhere(filter: NotificationsFilter): FindOptionsWhere<NotificationEntity> {
		const where: FindOptionsWhere<NotificationEntity> = {};

		switch (filter.status ?? 'active') {
			case 'dismissed':
				where.dismissedAt = Not(IsNull());
				break;

			case 'resolved':
				where.resolvedAt = Not(IsNull());
				break;

			case 'all':
				break;

			default:
				where.dismissedAt = IsNull();
				where.resolvedAt = IsNull();
				break;
		}

		if (filter.severity && filter.severity.length > 0) {
			where.severity = In(filter.severity);
		}

		if (filter.source) {
			where.source = filter.source;
		}

		if (filter.kind) {
			where.kind = filter.kind;
		}

		if (filter.unread !== undefined) {
			where.readAt = filter.unread ? IsNull() : Not(IsNull());
		}

		return where;
	}

	private resolveLimit(limit?: number): number {
		if (limit === undefined || !Number.isFinite(limit)) {
			return NOTIFICATIONS_DEFAULT_PAGE_SIZE;
		}

		return Math.min(Math.max(Math.trunc(limit), 1), NOTIFICATIONS_MAX_PAGE_SIZE);
	}

	/**
	 * Fixed window per source. A source that floods loses the rest of its minute after one
	 * warning, which keeps a spinning reconnect loop from filling the table and every
	 * configured channel, without touching the sources that behave.
	 */
	private consumeRateBudget(source: string): boolean {
		const now = Date.now();
		const window = this.rateWindows.get(source);

		if (window === undefined || now - window.startedAt >= NOTIFICATION_RATE_LIMIT_WINDOW_MS) {
			this.rateWindows.set(source, { startedAt: now, count: 1, warned: false });

			return true;
		}

		window.count += 1;

		if (window.count <= NOTIFICATION_RATE_LIMIT_PER_MINUTE) {
			return true;
		}

		if (!window.warned) {
			window.warned = true;

			this.logger.warn(
				`Source=${source} exceeded ${NOTIFICATION_RATE_LIMIT_PER_MINUTE} notifications per minute, dropping the rest of the window`,
			);
		}

		return false;
	}

	private emit(event: EventType, notification: NotificationEntity): void {
		const payload: NotificationEventPayload = {
			id: notification.id,
			kind: notification.kind,
			severity: notification.severity,
			source: notification.source,
		};

		this.eventEmitter.emit(event, payload);
	}
}
