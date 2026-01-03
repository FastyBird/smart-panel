import { instanceToPlain } from 'class-transformer';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import { createExtensionLogger } from '../../../common/logger';
import { EventType, STATS_MODULE_NAME } from '../stats.constants';

import { StatsRegistryService } from './stats-registry.service';

type CachedValue<T> = { at: number; data: T };

@Injectable()
export class StatsAggregatorService {
	private readonly logger = createExtensionLogger(STATS_MODULE_NAME, 'StatsAggregatorService');

	private cache = new Map<string, CachedValue<unknown>>();

	private ttlMs = 30_000;

	constructor(
		private readonly registryService: StatsRegistryService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	listKeys(): string[] {
		return this.registryService.get().map((p) => p.name);
	}

	async get<T = unknown>(key: string, params?: Record<string, unknown>): Promise<T> {
		const provider = this.registryService.get().find((p) => p.name === key).provider;

		if (!provider) {
			throw new Error(`Stats provider '${key}' not found`);
		}

		const cacheKey = `${key}:${JSON.stringify(params ?? {})}`;

		const now = Date.now();

		const hit = this.cache.get(cacheKey) as CachedValue<T> | undefined;

		if (hit && now - hit.at < this.ttlMs) {
			return hit.data;
		}

		const data = (await provider.getStats(params)) as T;

		this.cache.set(cacheKey, { at: now, data });

		return data;
	}

	async getAll(params?: Record<string, unknown>): Promise<Record<string, unknown>> {
		const pairs: Array<[string, unknown]> = await Promise.all(
			this.registryService.get().map(async (p): Promise<[string, unknown]> => {
				try {
					const result = await this.get(p.name, params);
					return [p.name, result];
				} catch (e) {
					const err = e as Error;
					return [p.name, { error: true, message: err.message }];
				}
			}),
		);

		const out: Record<string, unknown> = {};

		for (const [k, v] of pairs) {
			out[k] = v;
		}

		return out;
	}

	@Cron(CronExpression.EVERY_5_SECONDS)
	async broadcastStatsInfo() {
		try {
			const stats = await this.getAll();

			this.eventEmitter.emit(EventType.STATS_INFO, instanceToPlain(stats));
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to broadcast stats info', { message: err.message, stack: err.stack });
		}
	}
}
