import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { DEVICES_HOMEY_PLUGIN_NAME } from '../devices-homey.constants';

const ADOPTION_LOCK_TABLE = 'devices_homey_adoption_locks';
const ADOPTION_LOCK_LEASE_MS = 60_000;
const ADOPTION_LOCK_HEARTBEAT_MS = 20_000;
const ADOPTION_LOCK_POLL_INTERVAL_MS = 50;
const ADOPTION_LOCK_WAIT_TIMEOUT_MS = 30_000;

@Injectable()
export class HomeyAdoptionLockService {
	private readonly logger = createExtensionLogger(DEVICES_HOMEY_PLUGIN_NAME, 'HomeyAdoptionLockService');

	constructor(private readonly dataSource: DataSource) {}

	async runExclusive<T>(deviceIdentifier: string, operation: () => Promise<T>): Promise<T> {
		const ownerToken = randomUUID();
		await this.acquire(deviceIdentifier, ownerToken);

		let renewal = Promise.resolve();
		const heartbeat = setInterval(() => {
			renewal = renewal
				.then(async () => {
					await this.renew(deviceIdentifier, ownerToken);
				})
				.catch(() => {
					this.logger.warn('Homey adoption lock heartbeat failed; ownership will be rechecked');
				});
		}, ADOPTION_LOCK_HEARTBEAT_MS);
		heartbeat.unref();

		try {
			const result = await operation();
			await renewal;

			if (!(await this.isOwned(deviceIdentifier, ownerToken))) {
				throw new Error('Homey adoption lock ownership was lost');
			}

			return result;
		} finally {
			clearInterval(heartbeat);
			await renewal.catch(() => undefined);
			await this.release(deviceIdentifier, ownerToken).catch(() => {
				this.logger.warn('Homey adoption lock release was deferred to lease expiry');
			});
		}
	}

	private async acquire(deviceIdentifier: string, ownerToken: string): Promise<void> {
		const deadline = Date.now() + ADOPTION_LOCK_WAIT_TIMEOUT_MS;

		while (!(await this.tryAcquire(deviceIdentifier, ownerToken))) {
			if (Date.now() >= deadline) {
				throw new Error('Homey adoption lock could not be acquired');
			}

			await new Promise<void>((resolve) => setTimeout(resolve, ADOPTION_LOCK_POLL_INTERVAL_MS));
		}
	}

	private async tryAcquire(deviceIdentifier: string, ownerToken: string): Promise<boolean> {
		const now = Date.now();
		await this.dataSource.query(
			`INSERT INTO "${ADOPTION_LOCK_TABLE}" ("deviceIdentifier", "ownerToken", "expiresAt") ` +
				`VALUES (?, ?, ?) ` +
				`ON CONFLICT("deviceIdentifier") DO UPDATE SET ` +
				`"ownerToken" = excluded."ownerToken", "expiresAt" = excluded."expiresAt" ` +
				`WHERE "${ADOPTION_LOCK_TABLE}"."expiresAt" <= ?`,
			[deviceIdentifier, ownerToken, now + ADOPTION_LOCK_LEASE_MS, now],
		);

		return this.isOwned(deviceIdentifier, ownerToken);
	}

	private async renew(deviceIdentifier: string, ownerToken: string): Promise<boolean> {
		await this.dataSource.query(
			`UPDATE "${ADOPTION_LOCK_TABLE}" SET "expiresAt" = ? ` + `WHERE "deviceIdentifier" = ? AND "ownerToken" = ?`,
			[Date.now() + ADOPTION_LOCK_LEASE_MS, deviceIdentifier, ownerToken],
		);

		return this.isOwned(deviceIdentifier, ownerToken);
	}

	private async isOwned(deviceIdentifier: string, ownerToken: string): Promise<boolean> {
		const rows = await this.dataSource.query<Array<{ ownerToken: string }>>(
			`SELECT "ownerToken" FROM "${ADOPTION_LOCK_TABLE}" ` +
				`WHERE "deviceIdentifier" = ? AND "ownerToken" = ? AND "expiresAt" > ?`,
			[deviceIdentifier, ownerToken, Date.now()],
		);

		return rows.some((row) => row.ownerToken === ownerToken);
	}

	private async release(deviceIdentifier: string, ownerToken: string): Promise<void> {
		await this.dataSource.query(
			`DELETE FROM "${ADOPTION_LOCK_TABLE}" WHERE "deviceIdentifier" = ? AND "ownerToken" = ?`,
			[deviceIdentifier, ownerToken],
		);
	}
}
