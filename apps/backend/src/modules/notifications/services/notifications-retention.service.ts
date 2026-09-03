import { IsNull, LessThan, Not, Repository } from 'typeorm';

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
import { NotificationEntity } from '../entities/notifications.entity';
import { NotificationsConfigModel } from '../models/config.model';
import {
	DEFAULT_MAX_NOTIFICATIONS,
	DEFAULT_RETENTION_DAYS,
	EventType,
	NOTIFICATIONS_MODULE_NAME,
	NotificationKind,
} from '../notifications.constants';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface RetentionSettings {
	retentionDays: number;
	maxNotifications: number;
}

/**
 * Keeps the notifications table honest and bounded.
 *
 * Three jobs: at boot, close the issues nobody has re-raised, so a condition that cleared
 * while the process was down does not greet the administrator as if it still held. Every
 * night, delete what has aged out of the retention window, then bring the active events
 * back under the cap.
 */
@Injectable()
export class NotificationsRetentionService implements OnApplicationBootstrap {
	private readonly logger = createExtensionLogger(NOTIFICATIONS_MODULE_NAME, 'NotificationsRetentionService');

	/**
	 * Captured when the service is constructed rather than when the cleanup runs, so an
	 * emitter that raises its issue inside its own `onModuleInit` writes a row newer than
	 * this and the cleanup leaves it alone. That makes the rule independent of module
	 * initialisation order.
	 */
	private readonly bootStartedAt = new Date();

	constructor(
		@InjectRepository(NotificationEntity)
		private readonly repository: Repository<NotificationEntity>,
		private readonly configService: ConfigService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Nothing in here may propagate: an `onApplicationBootstrap` rejection aborts Nest's
	 * bootstrap, and this hook queries a table that does not exist yet on a fresh install
	 * whose migrations have not run, or under `generate:openapi`, which boots the app purely
	 * to read Swagger metadata. A missed cleanup costs a few stale issues until the next
	 * start, not a dead process.
	 */
	async onApplicationBootstrap(): Promise<void> {
		try {
			const resolved = await this.resolveStaleIssues();

			if (resolved > 0) {
				this.logger.log(`Resolved ${resolved} issues that no source has re-raised since the last start`);
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to resolve stale issues at bootstrap: ${err.message}`);
		}
	}

	@Cron('15 3 * * *')
	async runRetention(): Promise<void> {
		const settings = this.getSettings();

		try {
			const deleted = await this.pruneExpired(settings.retentionDays);
			const evicted = await this.enforceCap(settings.maxNotifications);

			if (deleted > 0 || evicted > 0) {
				this.logger.log(`Retention removed ${deleted} expired and ${evicted} capped notifications`);
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Notifications retention run failed: ${err.message}`);
		}
	}

	/**
	 * Resolves the issues that were raised before this process started and that nothing has
	 * touched since. Persistent issues are exempt: nothing re-detects "the last update
	 * failed", so clearing it at boot would lose it.
	 */
	// Deliberately silent, like the nightly prune below: this runs during bootstrap, before
	// any websocket client has connected, so there is nobody to tell. The admin's first fetch
	// sees the resolved state.
	private async resolveStaleIssues(): Promise<number> {
		const stale = await this.repository.find({
			where: {
				kind: NotificationKind.ISSUE,
				persistent: false,
				resolvedAt: IsNull(),
				updatedAt: LessThan(this.bootStartedAt),
			},
		});

		if (stale.length === 0) {
			return 0;
		}

		const now = new Date();

		for (const notification of stale) {
			notification.resolvedAt = now;
			notification.updatedAt = now;
		}

		await this.repository.save(stale);

		return stale.length;
	}

	/**
	 * Deletes rows whose lifecycle ended more than `retentionDays` ago, counting from the
	 * later of `dismissedAt` and `resolvedAt` when both are set.
	 *
	 * Silent by design: every row it deletes is already dismissed or resolved, so it is not on
	 * an admin's active list, and a `Deleted` pointer would only make open sessions re-fetch a
	 * list that has not visibly changed.
	 *
	 * The two kinds end differently. An event is over once the administrator dismisses it -
	 * nothing will ever say more about it - so a dismissal alone starts its clock. An issue
	 * is only over once its source resolves it: a dismissed but unresolved issue describes a
	 * condition that still holds, and deleting it would let the source's next re-raise insert
	 * a fresh, undismissed row, undoing the dismissal the administrator asked for. Such rows
	 * are kept until the condition clears, and are bounded by their sources rather than by
	 * this job.
	 */
	private async pruneExpired(retentionDays: number): Promise<number> {
		const cutoff = new Date(Date.now() - retentionDays * DAY_IN_MS);

		const expired = await this.repository.find({
			where: [
				// Events: whichever marks are set must all have aged out.
				{ kind: NotificationKind.EVENT, dismissedAt: LessThan(cutoff), resolvedAt: IsNull() },
				{ kind: NotificationKind.EVENT, dismissedAt: IsNull(), resolvedAt: LessThan(cutoff) },
				{ kind: NotificationKind.EVENT, dismissedAt: LessThan(cutoff), resolvedAt: LessThan(cutoff) },
				// Issues: resolution is mandatory, and a dismissal on top must have aged out too.
				{ kind: NotificationKind.ISSUE, resolvedAt: LessThan(cutoff), dismissedAt: IsNull() },
				{ kind: NotificationKind.ISSUE, resolvedAt: LessThan(cutoff), dismissedAt: LessThan(cutoff) },
			],
			select: { id: true },
		});

		if (expired.length === 0) {
			return 0;
		}

		await this.repository.delete(expired.map((notification) => notification.id));

		return expired.length;
	}

	/**
	 * Brings the active events back under the cap, deleting the oldest read ones first and
	 * only then the oldest unread ones. Issues are never evicted: they are bounded by their
	 * sources resolving them, and dropping one would hide a condition that still holds.
	 *
	 * Unlike the prune, this announces every eviction: these rows are *active*, so an open
	 * admin session may be showing them, and a row that vanishes from under the reader without
	 * a `Deleted` pointer stays on screen until something else forces a refetch.
	 */
	private async enforceCap(maxNotifications: number): Promise<number> {
		const active = { kind: NotificationKind.EVENT, dismissedAt: IsNull(), resolvedAt: IsNull() };
		const excess = (await this.repository.count({ where: active })) - maxNotifications;

		if (excess <= 0) {
			return 0;
		}

		const read = await this.repository.find({
			where: { ...active, readAt: Not(IsNull()) },
			order: { createdAt: 'ASC', id: 'ASC' },
			take: excess,
			select: { id: true },
		});

		const unread =
			read.length < excess
				? await this.repository.find({
						where: { ...active, readAt: IsNull() },
						order: { createdAt: 'ASC', id: 'ASC' },
						take: excess - read.length,
						select: { id: true },
					})
				: [];

		const victims = [...read, ...unread].map((notification) => notification.id);

		await this.repository.delete(victims);

		for (const id of victims) {
			this.eventEmitter.emit(EventType.NOTIFICATION_DELETED, { id });
		}

		return victims.length;
	}

	private getSettings(): RetentionSettings {
		try {
			const config = this.configService.getModuleConfig<NotificationsConfigModel>(NOTIFICATIONS_MODULE_NAME);

			return { retentionDays: config.retentionDays, maxNotifications: config.maxNotifications };
		} catch (error) {
			const err = error as Error;

			this.logger.warn(`Falling back to the default retention settings: ${err.message}`);

			return { retentionDays: DEFAULT_RETENTION_DAYS, maxNotifications: DEFAULT_MAX_NOTIFICATIONS };
		}
	}
}
