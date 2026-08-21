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

export class HomeyAdoptionLockLostError extends Error {
	constructor() {
		super('Homey adoption lock ownership was lost');
		this.name = 'HomeyAdoptionLockLostError';
	}
}

export interface HomeyAdoptionLease {
	assertOwned(): Promise<void>;
}

@Injectable()
export class HomeyAdoptionLockService {
	private readonly logger = createExtensionLogger(DEVICES_HOMEY_PLUGIN_NAME, 'HomeyAdoptionLockService');

	constructor(private readonly dataSource: DataSource) {}

	async runExclusive<T>(deviceIdentifier: string, operation: (lease: HomeyAdoptionLease) => Promise<T>): Promise<T> {
		const ownerToken = `${process.pid}:${randomUUID()}`;
		await this.acquire(deviceIdentifier, ownerToken);
		let ownershipLost = false;
		const lease: HomeyAdoptionLease = {
			assertOwned: async (): Promise<void> => {
				if (ownershipLost || !(await this.isOwned(deviceIdentifier, ownerToken))) {
					ownershipLost = true;
					throw new HomeyAdoptionLockLostError();
				}
			},
		};

		let renewal = Promise.resolve();
		const heartbeat = setInterval(() => {
			renewal = renewal
				.then(async () => {
					if (!(await this.renew(deviceIdentifier, ownerToken))) {
						ownershipLost = true;
					}
				})
				.catch(() => {
					this.logger.warn('Homey adoption lock heartbeat failed; ownership will be rechecked');
				});
		}, ADOPTION_LOCK_HEARTBEAT_MS);
		heartbeat.unref();

		try {
			const result = await operation(lease);
			await renewal;

			if (!(await this.isOwned(deviceIdentifier, ownerToken))) {
				ownershipLost = true;
			}
			await lease.assertOwned();

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
				`ON CONFLICT("deviceIdentifier") DO NOTHING`,
			[deviceIdentifier, ownerToken, now + ADOPTION_LOCK_LEASE_MS],
		);

		if (await this.isOwned(deviceIdentifier, ownerToken)) {
			return true;
		}

		const claims = await this.dataSource.query<Array<{ ownerToken: string; expiresAt: number }>>(
			`SELECT "ownerToken", "expiresAt" FROM "${ADOPTION_LOCK_TABLE}" WHERE "deviceIdentifier" = ?`,
			[deviceIdentifier],
		);
		const claim = claims[0];

		// An expired timestamp is not sufficient proof that another process stopped. A paused live process
		// can resume between an ownership check and its mutation, so takeover is allowed only after the
		// same-host owner PID is no longer alive. Legacy tokens without a PID remain reclaimable.
		if (claim === undefined || claim.expiresAt > now || this.isOwnerProcessAlive(claim.ownerToken)) {
			return false;
		}

		await this.dataSource.query(
			`UPDATE "${ADOPTION_LOCK_TABLE}" SET "ownerToken" = ?, "expiresAt" = ? ` +
				`WHERE "deviceIdentifier" = ? AND "ownerToken" = ? AND "expiresAt" <= ?`,
			[ownerToken, now + ADOPTION_LOCK_LEASE_MS, deviceIdentifier, claim.ownerToken, now],
		);

		return this.isOwned(deviceIdentifier, ownerToken);
	}

	private isOwnerProcessAlive(ownerToken: string): boolean {
		const separator = ownerToken.indexOf(':');
		const pid = Number(separator > 0 ? ownerToken.slice(0, separator) : Number.NaN);

		if (!Number.isSafeInteger(pid) || pid <= 0) {
			return false;
		}

		try {
			process.kill(pid, 0);

			return true;
		} catch (error) {
			return (error as NodeJS.ErrnoException).code === 'EPERM';
		}
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
