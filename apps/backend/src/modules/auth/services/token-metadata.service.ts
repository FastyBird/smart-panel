import {
	DataSource,
	EntitySubscriberInterface,
	InsertEvent,
	QueryRunner,
	RemoveEvent,
	TransactionCommitEvent,
	TransactionRollbackEvent,
	UpdateEvent,
} from 'typeorm';

import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { getEnvValue } from '../../../common/utils/config.utils';
import { LongLiveTokenEntity, TokenEntity } from '../entities/auth.entity';

export type AuthenticationToken = Pick<
	LongLiveTokenEntity,
	'id' | 'hashedToken' | 'ownerType' | 'ownerId' | 'revoked' | 'expiresAt'
>;
export const tokenMetadataCapacity = 1_000;

type PendingToken = { generation: number; promise: Promise<AuthenticationToken | null> };

/** Bounded credential facts for runtime authentication; never caches an authorization decision or usage telemetry. */
@Injectable()
export class TokenMetadataService implements EntitySubscriberInterface, OnModuleDestroy {
	private readonly enabled: boolean;
	private readonly tokens = new Map<string, AuthenticationToken>();
	private readonly loading = new Map<string, PendingToken>();
	private readonly dirtyTransactions = new Set<QueryRunner>();
	private generation = 0;
	private stopped = false;

	constructor(
		private readonly dataSource: DataSource,
		@Optional() config: ConfigService = new ConfigService(),
	) {
		this.enabled = !getEnvValue<boolean>(config, 'FB_PROPERTY_VALUE_LOCKS_ENABLED', false);
		dataSource.subscribers.push(this);
	}

	/** Returns detached facts; JWT verification, expiry, owner/role and MCP policy checks remain request-local. */
	async findByHash(hash: string): Promise<AuthenticationToken | null> {
		while (true) {
			if (!this.enabled || this.stopped || this.dirtyTransactions.size > 0) return this.query(hash);
			const cached = this.tokens.get(hash);
			if (cached) {
				// Refresh LRU order; expiration is still checked by the caller on every request.
				this.tokens.delete(hash);
				if (!cached.expiresAt || cached.expiresAt.getTime() >= Date.now()) this.tokens.set(hash, cached);
				return this.copy(cached);
			}
			const generation = this.generation;
			let pending = this.loading.get(hash);
			if (!pending || pending.generation !== generation) {
				// Invalid credentials and concurrent cold misses must not create an unbounded pending map.
				if (!pending && this.loading.size >= tokenMetadataCapacity) return this.query(hash);
				pending = { generation, promise: this.query(hash) };
				this.loading.set(hash, pending);
			}
			try {
				const token = await pending.promise;
				if (generation !== this.generation) continue;
				if (
					token &&
					!token.revoked &&
					(!token.expiresAt || token.expiresAt.getTime() >= Date.now()) &&
					!this.stopped &&
					this.dirtyTransactions.size === 0
				) {
					if (!this.tokens.has(hash) && this.tokens.size >= tokenMetadataCapacity) {
						const oldest: unknown = this.tokens.keys().next().value;
						if (typeof oldest === 'string') this.tokens.delete(oldest);
					}
					this.tokens.set(hash, token);
				}
				return token ? this.copy(token) : null;
			} finally {
				if (this.loading.get(hash) === pending) this.loading.delete(hash);
			}
		}
	}

	/** Explicit escape hatch for administrative raw SQL/bulk clears that bypass TypeORM subscribers. */
	invalidate(): void {
		this.generation++;
		this.tokens.clear();
	}

	beforeInsert(event: InsertEvent<unknown>): void {
		this.mutation(event);
	}
	afterInsert(event: InsertEvent<unknown>): void {
		this.mutation(event);
	}
	beforeRemove(event: RemoveEvent<unknown>): void {
		this.mutation(event);
	}
	afterRemove(event: RemoveEvent<unknown>): void {
		this.mutation(event);
	}
	beforeUpdate(event: UpdateEvent<unknown>): void {
		if (!this.isUsageOnly(event)) this.mutation(event);
	}
	afterUpdate(event: UpdateEvent<unknown>): void {
		if (!this.isUsageOnly(event)) this.mutation(event);
	}
	afterTransactionCommit(event: TransactionCommitEvent): void {
		this.settled(event.queryRunner);
	}
	afterTransactionRollback(event: TransactionRollbackEvent): void {
		this.settled(event.queryRunner);
	}

	onModuleDestroy(): void {
		this.stopped = true;
		const index = this.dataSource.subscribers.indexOf(this);
		if (index >= 0) this.dataSource.subscribers.splice(index, 1);
		this.invalidate();
		this.dirtyTransactions.clear();
	}

	private mutation(event: InsertEvent<unknown> | UpdateEvent<unknown> | RemoveEvent<unknown>): void {
		if (!event.metadata.inheritanceTree.includes(TokenEntity)) return;
		if (event.queryRunner.isTransactionActive) this.dirtyTransactions.add(event.queryRunner);
		this.invalidate();
	}

	private settled(runner: QueryRunner): void {
		if (!this.dirtyTransactions.has(runner)) return;
		this.invalidate();
		if (!runner.isTransactionActive) this.dirtyTransactions.delete(runner);
	}

	private isUsageOnly(event: UpdateEvent<unknown>): boolean {
		// Accept only the exact partial update emitted by TokenUsageService. Unknown/bulk updates invalidate.
		const keys = Object.keys(event.entity ?? {});
		return (
			event.metadata.inheritanceTree.includes(LongLiveTokenEntity) && keys.length === 1 && keys[0] === 'lastUsedAt'
		);
	}

	private async query(hash: string): Promise<AuthenticationToken | null> {
		const token = await this.dataSource.getRepository(LongLiveTokenEntity).findOne({
			select: { id: true, hashedToken: true, ownerType: true, tokenOwnerId: true, revoked: true, expiresAt: true },
			where: { hashedToken: hash },
		});
		return token
			? {
					id: token.id,
					hashedToken: token.hashedToken,
					ownerType: token.ownerType,
					ownerId: token.ownerId,
					revoked: token.revoked,
					expiresAt: token.expiresAt,
				}
			: null;
	}

	private copy(token: AuthenticationToken): AuthenticationToken {
		return { ...token, expiresAt: token.expiresAt ? new Date(token.expiresAt.getTime()) : null };
	}
}
