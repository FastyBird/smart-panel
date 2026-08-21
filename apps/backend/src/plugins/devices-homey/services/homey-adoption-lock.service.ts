import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { Server, createConnection, createServer } from 'node:net';
import { DataSource } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { sharedLockSocketPath } from '../../../common/utils/shared-lock-socket-path.utils';

const ADOPTION_LOCK_TABLE = 'devices_homey_adoption_locks';
const ADOPTION_LOCK_CLAIM_TTL_MS = 60_000;
const ADOPTION_LOCK_POLL_INTERVAL_MS = 50;
const ADOPTION_LOCK_WAIT_TIMEOUT_MS = 30_000;
const ADOPTION_LOCK_SOCKET_PROBE_MS = 250;

interface HomeyAdoptionOwnerSocket {
	readonly path: string;
	readonly server: Server;
}

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
	constructor(private readonly dataSource: DataSource) {}

	async runExclusive<T>(deviceIdentifier: string, operation: (lease: HomeyAdoptionLease) => Promise<T>): Promise<T> {
		const ownerToken = randomUUID();
		const ownerSocket = await this.openOwnerSocket(ownerToken);
		let acquired = false;

		try {
			await this.acquire(deviceIdentifier, ownerToken);
			acquired = true;
			const lease: HomeyAdoptionLease = {
				assertOwned: async (): Promise<void> => {
					if (!ownerSocket.server.listening || !(await this.isOwned(deviceIdentifier, ownerToken))) {
						throw new HomeyAdoptionLockLostError();
					}
				},
			};
			const result = await operation(lease);
			await lease.assertOwned();

			return result;
		} finally {
			if (acquired) {
				await this.release(deviceIdentifier, ownerToken).catch(() => undefined);
			}
			await this.closeOwnerSocket(ownerSocket);
		}
	}

	private async acquire(deviceIdentifier: string, ownerToken: string): Promise<void> {
		const deadline = Date.now() + ADOPTION_LOCK_WAIT_TIMEOUT_MS;

		while (!(await this.tryAcquire(deviceIdentifier, ownerToken))) {
			if (Date.now() >= deadline) {
				throw new Error('Homey adoption lock could not be acquired');
			}

			await new Promise<void>((resolvePoll) => setTimeout(resolvePoll, ADOPTION_LOCK_POLL_INTERVAL_MS));
		}
	}

	private async tryAcquire(deviceIdentifier: string, ownerToken: string): Promise<boolean> {
		const now = Date.now();
		await this.dataSource.query(
			`INSERT INTO "${ADOPTION_LOCK_TABLE}" ("deviceIdentifier", "ownerToken", "expiresAt") ` +
				`VALUES (?, ?, ?) ON CONFLICT("deviceIdentifier") DO NOTHING`,
			[deviceIdentifier, ownerToken, now + ADOPTION_LOCK_CLAIM_TTL_MS],
		);

		if (await this.isOwned(deviceIdentifier, ownerToken)) {
			return true;
		}

		const claims = await this.dataSource.query<Array<{ ownerToken: string }>>(
			`SELECT "ownerToken" FROM "${ADOPTION_LOCK_TABLE}" WHERE "deviceIdentifier" = ?`,
			[deviceIdentifier],
		);
		const currentOwnerToken = claims[0]?.ownerToken;

		if (currentOwnerToken === undefined || (await this.isOwnerSocketAlive(currentOwnerToken))) {
			return false;
		}

		// The candidate socket is already listening before this compare-and-swap publishes its token.
		// Exactly one contender can replace the dead owner, and every later contender can immediately
		// prove the winner is live even across PID namespaces.
		await this.dataSource.query(
			`UPDATE "${ADOPTION_LOCK_TABLE}" SET "ownerToken" = ?, "expiresAt" = ? ` +
				`WHERE "deviceIdentifier" = ? AND "ownerToken" = ?`,
			[ownerToken, now + ADOPTION_LOCK_CLAIM_TTL_MS, deviceIdentifier, currentOwnerToken],
		);
		await unlink(await this.ownerSocketPath(currentOwnerToken)).catch(() => undefined);

		return this.isOwned(deviceIdentifier, ownerToken);
	}

	private async isOwned(deviceIdentifier: string, ownerToken: string): Promise<boolean> {
		const rows = await this.dataSource.query<Array<{ ownerToken: string }>>(
			`SELECT "ownerToken" FROM "${ADOPTION_LOCK_TABLE}" ` + `WHERE "deviceIdentifier" = ? AND "ownerToken" = ?`,
			[deviceIdentifier, ownerToken],
		);

		return rows.some((row) => row.ownerToken === ownerToken);
	}

	private async release(deviceIdentifier: string, ownerToken: string): Promise<void> {
		await this.dataSource.query(
			`DELETE FROM "${ADOPTION_LOCK_TABLE}" WHERE "deviceIdentifier" = ? AND "ownerToken" = ?`,
			[deviceIdentifier, ownerToken],
		);
	}

	private async openOwnerSocket(ownerToken: string): Promise<HomeyAdoptionOwnerSocket> {
		const socketPath = await this.ownerSocketPath(ownerToken);
		const server = createServer((socket) => socket.destroy());

		await new Promise<void>((resolveListen, reject) => {
			const onError = (error: Error): void => {
				server.off('listening', onListening);
				reject(error);
			};
			const onListening = (): void => {
				server.off('error', onError);
				resolveListen();
			};
			server.once('error', onError);
			server.once('listening', onListening);
			server.listen(socketPath);
		});

		return { path: socketPath, server };
	}

	private async closeOwnerSocket(ownerSocket: HomeyAdoptionOwnerSocket): Promise<void> {
		await new Promise<void>((resolveClose) => {
			ownerSocket.server.close(() => resolveClose());
		});
		await unlink(ownerSocket.path).catch(() => undefined);
	}

	private async isOwnerSocketAlive(ownerToken: string): Promise<boolean> {
		const socketPath = await this.ownerSocketPath(ownerToken);

		return new Promise<boolean>((resolveProbe) => {
			const socket = createConnection(socketPath);
			let settled = false;
			const finish = (alive: boolean): void => {
				if (settled) {
					return;
				}
				settled = true;
				clearTimeout(timeout);
				socket.destroy();
				resolveProbe(alive);
			};
			const timeout = setTimeout(() => finish(false), ADOPTION_LOCK_SOCKET_PROBE_MS);
			timeout.unref();
			socket.once('connect', () => finish(true));
			socket.once('error', () => finish(false));
		});
	}

	private ownerSocketPath(ownerToken: string): Promise<string> {
		const database = this.dataSource.options.type === 'sqlite' ? this.dataSource.options.database : ':memory:';

		return sharedLockSocketPath('homey-adoption', database, ownerToken);
	}
}
