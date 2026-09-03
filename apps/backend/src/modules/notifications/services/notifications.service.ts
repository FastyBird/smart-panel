import { FindOptionsWhere, In, IsNull, LessThan, Not, Repository } from 'typeorm';

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
	/** Timestamps of the calls this source got through, oldest first. */
	acceptedAt: number[];
	/** When this source was last warned, so a flood costs one log line a minute. */
	warnedAt: number | null;
}

/**
 * Whether a driver error is SQLite refusing a row for the `(source, key)` partial unique
 * index - the sign that a concurrent `notify()` won the insert race this call just lost.
 *
 * Matched on the message because that is all the sqlite driver gives: TypeORM wraps it in
 * a `QueryFailedError` whose `driverError` carries the text.
 */
const isUniqueConstraintViolation = (error: unknown): boolean => {
	if (!(error instanceof Error)) {
		return false;
	}

	const driverMessage = (error as { driverError?: { message?: string } }).driverError?.message ?? '';
	const message = `${error.message} ${driverMessage}`;

	return message.includes('UNIQUE constraint failed') || message.includes('SQLITE_CONSTRAINT');
};

/**
 * One row above the client-facing page size cap (`NOTIFICATIONS_MAX_PAGE_SIZE`). The
 * controller requests `limit + 1` rows so it can tell whether another page follows
 * without a separate count query; if this service capped `take` at the same
 * `NOTIFICATIONS_MAX_PAGE_SIZE` the controller exposes to clients, a request for exactly
 * the maximum page size would never receive that extra row and `has_more` would be lost.
 * The client-visible maximum is unchanged - it is still `NOTIFICATIONS_MAX_PAGE_SIZE`,
 * enforced by the controller.
 */
const SERVICE_MAX_TAKE = NOTIFICATIONS_MAX_PAGE_SIZE + 1;

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
			return value.key === null ? await this.insert(value) : await this.upsertKeyed(value);
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

		// The list is a total order - creation time descending, the id descending to break
		// ties - so the cursor is "older than the cursor row, or the same age and lower down
		// the page". The comparison and the ordering have to name the same direction, or a
		// page would skip or repeat the rows sharing the cursor row's timestamp.
		const where: FindOptionsWhere<NotificationEntity>[] =
			cursor === null
				? [base]
				: [
						{ ...base, createdAt: LessThan(cursor.createdAt) },
						{ ...base, createdAt: cursor.createdAt, id: LessThan(cursor.id) },
					];

		return this.repository.find({
			where,
			order: { createdAt: 'DESC', id: 'DESC' },
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
		const now = new Date();

		notification.dismissedAt = dismissed ? now : null;
		notification.updatedAt = now;

		// A persistent issue is never re-detected by its source - that is what `persistent`
		// means - so the administrator dismissing it is the only way it ever ends. Folding
		// that dismissal into a resolution here is what lets the row leave the active list
		// and become eligible for retention like any other resolved issue, on the same
		// timestamp as the dismissal. Un-dismissing only reopens the dismissal: the
		// condition was never re-detected, so the resolution this set is left in place.
		if (dismissed && notification.kind === NotificationKind.ISSUE && notification.persistent) {
			notification.resolvedAt = now;
		}

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
			// A single row with no relations to cascade needs no transaction of its own, and
			// skipping it matters here: `save()` opens one by default, and SQLite's single
			// connection cannot run concurrent transactions - two notify() calls racing to
			// insert the same (source, key) would otherwise corrupt each other's writes
			// instead of one cleanly losing the unique-index race for upsertKeyed() to retry.
			{ transaction: false },
		);

		this.logger.debug(`Created notification id=${notification.id} source=${value.source} kind=${value.kind}`);

		this.emit(EventType.NOTIFICATION_CREATED, notification);

		return notification;
	}

	/**
	 * Folds a repeat into the row that already holds the condition, or opens a new one when
	 * none exists yet.
	 *
	 * The fold is a single atomic `UPDATE ... SET occurrences = occurrences + 1`, not a
	 * load-increment-save cycle: two concurrent `notify()` calls for the same `(source, key)`
	 * each run their own UPDATE against whatever row the database holds at that instant, so
	 * neither can load a stale copy and overwrite the other's increment. When the UPDATE
	 * matches nothing there is no active row yet, so this falls through to `insert()`; if that
	 * insert then loses the partial-unique-index race to a concurrent `notify()` that inserted
	 * first, the same UPDATE runs once more against the row the winner just created.
	 */
	private async upsertKeyed(value: ValidatedNotificationInput): Promise<NotificationEntity> {
		if (await this.applyKeyedUpdate(value)) {
			return await this.completeKeyedUpdate(value);
		}

		try {
			return await this.insert(value);
		} catch (error) {
			if (!isUniqueConstraintViolation(error) || !(await this.applyKeyedUpdate(value))) {
				throw error;
			}

			return await this.completeKeyedUpdate(value);
		}
	}

	/**
	 * The atomic UPDATE shared by the first attempt and the post-insert-race retry, run
	 * against the active row (`source`, `key`, `resolved_at IS NULL`). An event re-opens: the
	 * repeat is news, so `read_at` and `dismissed_at` are cleared. An issue does not: the
	 * administrator dismissed a condition that has not changed, and un-hiding it on every
	 * retry tick would make dismissing an issue meaningless.
	 */
	private async applyKeyedUpdate(value: ValidatedNotificationInput): Promise<boolean> {
		const set: Record<string, unknown> = {
			title: value.title,
			message: value.message,
			severity: value.severity,
			actions: value.actions,
			data: value.data,
			persistent: value.persistent,
			occurrences: () => 'occurrences + 1',
			updatedAt: new Date(),
		};

		if (value.kind === NotificationKind.EVENT) {
			set.readAt = null;
			set.dismissedAt = null;
		}

		const result = await this.repository
			.createQueryBuilder()
			.update(NotificationEntity)
			.set(set)
			.where('source = :source', { source: value.source })
			.andWhere('key = :key', { key: value.key })
			.andWhere('resolvedAt IS NULL')
			.execute();

		return Boolean(result.affected);
	}

	/**
	 * SQLite through TypeORM does not reliably hand back the row an UPDATE just touched, so
	 * the atomic path reloads by the same `(source, key)` that identifies it - the partial
	 * unique index guarantees at most one active match.
	 */
	private async completeKeyedUpdate(value: ValidatedNotificationInput): Promise<NotificationEntity> {
		const notification = await this.repository.findOne({
			where: { source: value.source, key: value.key, resolvedAt: IsNull() },
		});

		if (notification === null) {
			// Vanishingly unlikely: something resolved or removed the row between this call's
			// own UPDATE and this reload. Surfaced as the same storage failure the outer catch
			// in notify() already logs and returns null for.
			throw new Error(
				`Notification for source=${value.source} key=${String(value.key)} vanished between its atomic update and reload`,
			);
		}

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

		return Math.min(Math.max(Math.trunc(limit), 1), SERVICE_MAX_TAKE);
	}

	/**
	 * Sliding window per source: at most 60 accepted calls in any 60 seconds, not in each
	 * wall-clock minute. A fixed window would let a source spend its whole budget just before
	 * the boundary and the next one just after, which is 120 notifications inside one rolling
	 * minute - exactly the reconnect-loop burst the guard exists to absorb.
	 *
	 * The history is the accepted timestamps, so it is bounded by the limit itself, and a
	 * flooding source costs one log line a minute rather than one per dropped call.
	 */
	private consumeRateBudget(source: string): boolean {
		const now = Date.now();
		const window = this.rateWindows.get(source) ?? { acceptedAt: [], warnedAt: null };
		const windowStartedAt = now - NOTIFICATION_RATE_LIMIT_WINDOW_MS;

		this.rateWindows.set(source, window);

		while (window.acceptedAt.length > 0 && window.acceptedAt[0] <= windowStartedAt) {
			window.acceptedAt.shift();
		}

		if (window.acceptedAt.length < NOTIFICATION_RATE_LIMIT_PER_MINUTE) {
			window.acceptedAt.push(now);

			return true;
		}

		if (window.warnedAt === null || now - window.warnedAt >= NOTIFICATION_RATE_LIMIT_WINDOW_MS) {
			window.warnedAt = now;

			this.logger.warn(
				`Source=${source} exceeded ${NOTIFICATION_RATE_LIMIT_PER_MINUTE} notifications per minute, dropping the rest until its oldest calls age out`,
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
