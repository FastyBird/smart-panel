import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { Server, createConnection, createServer } from 'node:net';
import { DataSource } from 'typeorm';

import { Injectable, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { getEnvValue } from '../../../common/utils/config.utils';
import { sharedLockSocketPath } from '../../../common/utils/shared-lock-socket-path.utils';

const PROPERTY_VALUE_LOCK_TABLE = 'devices_module_property_value_locks';
const PROPERTY_VALUE_LOCK_CLAIM_TTL_MS = 60_000;
const PROPERTY_VALUE_LOCK_POLL_INTERVAL_MS = 25;
const PROPERTY_VALUE_LOCK_WAIT_TIMEOUT_MS = 30_000;
const PROPERTY_VALUE_LOCK_SOCKET_PROBE_MS = 250;

interface PropertyValueOwnerSocket {
	readonly path: string;
	readonly server: Server;
}

export class PropertyValueLockLostError extends Error {
	constructor() {
		super('Property value lock ownership was lost');
		this.name = 'PropertyValueLockLostError';
	}
}

export interface PropertyValueLease {
	assertOwned(): Promise<void>;
}

@Injectable()
export class PropertyValueLockService {
	private readonly enabled: boolean;

	constructor(
		private readonly dataSource: DataSource,
		@Optional() configService: NestConfigService = new NestConfigService(),
	) {
		// Read once: switching synchronization modes during an operation would break ownership.
		this.enabled = getEnvValue<boolean>(configService, 'FB_PROPERTY_VALUE_LOCKS_ENABLED', false);
	}

	async runExclusive<T>(propertyId: string, operation: (lease: PropertyValueLease) => Promise<T>): Promise<T> {
		if (!this.enabled) {
			// PropertyValueService still serializes writes and deletion with its local keyed queue.
			// A single backend needs no SQLite claim or filesystem socket for a value operation.
			return operation({ assertOwned: () => Promise.resolve() });
		}

		const ownerToken = randomUUID();
		const ownerSocket = await this.openOwnerSocket(ownerToken);
		let acquired = false;

		try {
			await this.acquire(propertyId, ownerToken);
			acquired = true;
			const lease: PropertyValueLease = {
				assertOwned: async (): Promise<void> => {
					if (!ownerSocket.server.listening || !(await this.isOwned(propertyId, ownerToken))) {
						throw new PropertyValueLockLostError();
					}
				},
			};
			const result = await operation(lease);
			await lease.assertOwned();

			return result;
		} finally {
			if (acquired) {
				await this.release(propertyId, ownerToken).catch(() => undefined);
			}
			await this.closeOwnerSocket(ownerSocket);
		}
	}

	isEnabled(): boolean {
		return this.enabled;
	}

	private async acquire(propertyId: string, ownerToken: string): Promise<void> {
		const deadline = Date.now() + PROPERTY_VALUE_LOCK_WAIT_TIMEOUT_MS;

		while (!(await this.tryAcquire(propertyId, ownerToken))) {
			if (Date.now() >= deadline) {
				throw new Error('Property value lock could not be acquired');
			}

			await new Promise<void>((resolvePoll) => setTimeout(resolvePoll, PROPERTY_VALUE_LOCK_POLL_INTERVAL_MS));
		}
	}

	private async tryAcquire(propertyId: string, ownerToken: string): Promise<boolean> {
		const now = Date.now();
		await this.dataSource.query(
			`INSERT INTO "${PROPERTY_VALUE_LOCK_TABLE}" ("propertyId", "ownerToken", "expiresAt") ` +
				`VALUES (?, ?, ?) ON CONFLICT("propertyId") DO NOTHING`,
			[propertyId, ownerToken, now + PROPERTY_VALUE_LOCK_CLAIM_TTL_MS],
		);

		if (await this.isOwned(propertyId, ownerToken)) {
			return true;
		}

		const claims = await this.dataSource.query<Array<{ ownerToken: string }>>(
			`SELECT "ownerToken" FROM "${PROPERTY_VALUE_LOCK_TABLE}" WHERE "propertyId" = ?`,
			[propertyId],
		);
		const currentOwnerToken = claims[0]?.ownerToken;

		if (currentOwnerToken === undefined || (await this.isOwnerSocketAlive(currentOwnerToken))) {
			return false;
		}

		await this.dataSource.query(
			`UPDATE "${PROPERTY_VALUE_LOCK_TABLE}" SET "ownerToken" = ?, "expiresAt" = ? ` +
				`WHERE "propertyId" = ? AND "ownerToken" = ?`,
			[ownerToken, now + PROPERTY_VALUE_LOCK_CLAIM_TTL_MS, propertyId, currentOwnerToken],
		);
		await unlink(await this.ownerSocketPath(currentOwnerToken)).catch(() => undefined);

		return this.isOwned(propertyId, ownerToken);
	}

	private async isOwned(propertyId: string, ownerToken: string): Promise<boolean> {
		const rows = await this.dataSource.query<Array<{ ownerToken: string }>>(
			`SELECT "ownerToken" FROM "${PROPERTY_VALUE_LOCK_TABLE}" WHERE "propertyId" = ? AND "ownerToken" = ?`,
			[propertyId, ownerToken],
		);

		return rows.some((row) => row.ownerToken === ownerToken);
	}

	private async release(propertyId: string, ownerToken: string): Promise<void> {
		await this.dataSource.query(
			`DELETE FROM "${PROPERTY_VALUE_LOCK_TABLE}" WHERE "propertyId" = ? AND "ownerToken" = ?`,
			[propertyId, ownerToken],
		);
	}

	private async openOwnerSocket(ownerToken: string): Promise<PropertyValueOwnerSocket> {
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

	private async closeOwnerSocket(ownerSocket: PropertyValueOwnerSocket): Promise<void> {
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
			const timeout = setTimeout(() => finish(false), PROPERTY_VALUE_LOCK_SOCKET_PROBE_MS);
			timeout.unref();
			socket.once('connect', () => finish(true));
			socket.once('error', () => finish(false));
		});
	}

	private ownerSocketPath(ownerToken: string): Promise<string> {
		const database = this.dataSource.options.type === 'sqlite' ? this.dataSource.options.database : ':memory:';

		return sharedLockSocketPath('property-value', database, ownerToken);
	}
}
