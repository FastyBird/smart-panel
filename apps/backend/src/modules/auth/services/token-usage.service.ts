import { DataSource, IsNull, LessThan } from 'typeorm';

import { BeforeApplicationShutdown, Injectable, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { AUTH_MODULE_NAME } from '../auth.constants';
import { LongLiveTokenEntity } from '../entities/auth.entity';

export const tokenUsageFlushIntervalMs = 60_000;
export const tokenUsageMaxPending = 1_000;

type TokenIdentity = Pick<LongLiveTokenEntity, 'id' | 'hashedToken'>;
type UsageObservation = TokenIdentity & { lastUsedAt: Date };

/** Best-effort usage telemetry. Never used to decide whether a credential is valid. */
@Injectable()
export class TokenUsageService implements OnModuleInit, BeforeApplicationShutdown {
	private readonly logger = createExtensionLogger(AUTH_MODULE_NAME, 'TokenUsageService');
	private readonly pending = new Map<string, UsageObservation>();
	private timer?: NodeJS.Timeout;
	private inFlight?: Promise<void>;
	private stopping = false;
	private dropped = 0;

	constructor(private readonly dataSource: DataSource) {}

	onModuleInit(): void {
		this.timer = setInterval(() => void this.flush(), tokenUsageFlushIntervalMs);
		this.timer.unref();
	}

	/** Coalesces an already authenticated credential without ORM work; overflow drops new identities. */
	record(token: TokenIdentity): void {
		if (this.stopping) return;

		const key = `${token.id}:${token.hashedToken}`;
		const previous = this.pending.get(key);

		// Existing credentials can still advance when the queue is full. Do not fall back to SQL.
		if (!previous && this.pending.size >= tokenUsageMaxPending) {
			this.dropped++;
			return;
		}

		this.pending.set(key, {
			id: token.id,
			hashedToken: token.hashedToken,
			lastUsedAt: new Date(Math.max(Date.now(), previous?.lastUsedAt.getTime() ?? 0)),
		});
	}

	/** Flushes one snapshot, or joins the running flush while leaving newer observations queued. */
	flush(): Promise<void> {
		if (this.inFlight !== undefined) return this.inFlight;
		if (this.pending.size === 0) return Promise.resolve();

		const batch = [...this.pending.values()];
		this.pending.clear();

		if (this.dropped > 0) {
			this.logger.warn(`Dropped ${this.dropped} token usage observations because the telemetry queue was full`);
			this.dropped = 0;
		}

		// One bounded snapshot can be in flight while the next bounded snapshot collects observations.
		this.inFlight = this.persist(batch).finally(() => {
			this.inFlight = undefined;
		});
		return this.inFlight;
	}

	/** Stops intake and drains both snapshots before TypeORM tears down the data source. */
	async beforeApplicationShutdown(): Promise<void> {
		this.stopping = true;
		if (this.timer) clearInterval(this.timer);

		await this.flush();
		// An already running flush may have had newer observations queued behind it.
		await this.flush();
	}

	private async persist(batch: UsageObservation[]): Promise<void> {
		let failures = 0;

		for (const { id, hashedToken, lastUsedAt } of batch) {
			try {
				// Match the observed credential, not merely a potentially reused ID. Never recreate rows,
				// touch revoked/rotated credentials, or move a newer persisted timestamp backwards.
				const identity = { id, hashedToken, revoked: false };
				await this.dataSource.getRepository(LongLiveTokenEntity).update(
					[
						{ ...identity, lastUsedAt: IsNull() },
						{ ...identity, lastUsedAt: LessThan(lastUsedAt) },
					],
					{ lastUsedAt },
				);
			} catch {
				// Drop failed telemetry rather than retaining an unbounded retry backlog. A subsequent
				// authenticated request can enqueue a fresh observation. Do not log credential hashes.
				failures++;
			}
		}

		if (failures > 0) this.logger.warn(`Failed to persist ${failures} token usage observations`);
	}
}
