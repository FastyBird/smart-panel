import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { createExtensionLogger } from '../../../common/logger';
import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../notifications/notifications.constants';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { STORAGE_MODULE_NAME } from '../storage.constants';

import { StorageService } from './storage.service';

const SERVICES_LINK_ACTION = {
	type: NotificationActionType.LINK,
	label: 'Open services',
	url: '/extensions?tab=services',
	primary: true,
} as const;

/**
 * Polls the two storage health getters `StorageService` exposes but nothing else calls
 * (`isUsingFallback()`, `isConnected()`) and turns their transitions into notifications.
 *
 * Both getters are plain state reads with no transition hook of their own, so this is the
 * only place that knows "was it already like this a minute ago" - each flag's last observed
 * value doubles as the "is an issue currently raised for it" flag: raise on the transition
 * into the bad state, resolve on the transition out, stay silent on every tick in between.
 */
@Injectable()
export class StorageFallbackMonitorService {
	private readonly logger = createExtensionLogger(STORAGE_MODULE_NAME, 'StorageFallbackMonitorService');

	// Optimistic seed: assume healthy until a poll proves otherwise. A monitor that started
	// pessimistic would never observe a "transition" for a condition that was already bad at
	// boot and stays bad, so it would never raise it; starting optimistic guarantees exactly
	// one raise the first time a persistent condition is observed.
	private wasUsingFallback = false;
	private wasConnected = true;

	constructor(
		private readonly storageService: StorageService,
		private readonly notifications: NotificationsService,
	) {}

	@Cron('* * * * *')
	async checkStorageStatus(): Promise<void> {
		try {
			await this.checkFallback();
			await this.checkConnectivity();
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to check storage status: ${err.message}`, err.stack);
		}
	}

	private async checkFallback(): Promise<void> {
		const isUsingFallback = this.storageService.isUsingFallback();

		if (isUsingFallback && !this.wasUsingFallback) {
			this.wasUsingFallback = true;

			await this.notifications.notify({
				source: STORAGE_MODULE_NAME,
				kind: NotificationKind.ISSUE,
				key: 'fallback-active',
				severity: NotificationSeverity.WARNING,
				title: 'Storage is running on the fallback backend',
				message: 'The primary storage backend is unavailable; writes and reads are using the fallback.',
				actions: [SERVICES_LINK_ACTION],
			});

			return;
		}

		if (!isUsingFallback && this.wasUsingFallback) {
			this.wasUsingFallback = false;

			await this.resolveIssue('fallback-active');
		}
	}

	private async checkConnectivity(): Promise<void> {
		const isConnected = this.storageService.isConnected();

		if (!isConnected && this.wasConnected) {
			this.wasConnected = false;

			await this.notifications.notify({
				source: STORAGE_MODULE_NAME,
				kind: NotificationKind.ISSUE,
				key: 'storage-unavailable',
				severity: NotificationSeverity.ERROR,
				title: 'Storage is unavailable',
				message: 'Neither the primary nor the fallback storage backend is reachable.',
				actions: [SERVICES_LINK_ACTION],
			});

			return;
		}

		if (isConnected && !this.wasConnected) {
			this.wasConnected = true;

			await this.resolveIssue('storage-unavailable');
		}
	}

	/**
	 * Unlike notify(), resolve() can throw - caught and logged here so a storage hiccup on
	 * the resolve call never turns a successful recovery into a reported failure.
	 */
	private async resolveIssue(key: string): Promise<void> {
		try {
			await this.notifications.resolve(STORAGE_MODULE_NAME, key);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to resolve the ${key} issue: ${err.message}`, err.stack);
		}
	}
}
