import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';

import { createExtensionLogger } from '../../../common/logger';
import { withTimeout } from '../../../common/utils/http.utils';
import { ConfigService } from '../../config/services/config.service';
import { SpacesService } from '../../spaces/services/spaces.service';
import { BUDDY_MODULE_NAME, HEARTBEAT_DEFAULT_INTERVAL_MS, HEARTBEAT_MAX_CYCLE_MS } from '../buddy.constants';
import { BuddyConfigModel } from '../models/config.model';

import { BuddyContextService } from './buddy-context.service';
import { EvaluatorResult, HeartbeatEvaluator } from './heartbeat.types';
import { SuggestionEngineService } from './suggestion-engine.service';

const HEARTBEAT_INTERVAL_NAME = 'buddyHeartbeat';
const EVALUATOR_TIMEOUT_MS = 10_000;

@Injectable()
export class HeartbeatService implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'HeartbeatService');
	private readonly evaluators: HeartbeatEvaluator[] = [];
	private running = false;

	constructor(
		private readonly schedulerRegistry: SchedulerRegistry,
		private readonly configService: ConfigService,
		private readonly spacesService: SpacesService,
		private readonly contextService: BuddyContextService,
		private readonly suggestionEngine: SuggestionEngineService,
	) {}

	onApplicationBootstrap(): void {
		const intervalMs = this.getIntervalMs();
		const intervalId = setInterval(() => void this.runCycle(), intervalMs);

		// Allow the Node.js process to exit even if the interval is still active
		// (prevents "worker process has failed to exit gracefully" warnings in tests)
		if (typeof intervalId === 'object' && 'unref' in intervalId) {
			intervalId.unref();
		}

		this.schedulerRegistry.addInterval(HEARTBEAT_INTERVAL_NAME, intervalId);

		this.logger.log(`Heartbeat started with interval=${intervalMs}ms`);
	}

	onModuleDestroy(): void {
		try {
			this.schedulerRegistry.deleteInterval(HEARTBEAT_INTERVAL_NAME);
		} catch {
			// Interval may not exist if bootstrap didn't complete
		}
	}

	/**
	 * Register an evaluator to run during each heartbeat cycle.
	 */
	registerEvaluator(evaluator: HeartbeatEvaluator): void {
		this.evaluators.push(evaluator);

		this.logger.log(`Evaluator registered: ${evaluator.name}`);
	}

	/**
	 * Execute a single heartbeat cycle:
	 * 1. Check if buddy is enabled
	 * 2. Find spaces with suggestionsEnabled
	 * 3. Build context per space
	 * 4. Run evaluators sequentially
	 * 5. Create suggestions from results
	 */
	async runCycle(): Promise<void> {
		if (this.running) {
			this.logger.debug('Heartbeat cycle already running, skipping');

			return;
		}

		if (!this.isBuddyEnabled()) {
			return;
		}

		if (this.evaluators.length === 0) {
			return;
		}

		this.running = true;
		const startTime = Date.now();

		try {
			const spaces = await this.spacesService.findAll();
			// `suggestionsEnabled` lives on home-control's RoomSpaceEntity / ZoneSpaceEntity,
			// not the abstract SpaceEntity. Read it via an indexed-property cast so non-home-control
			// spaces (master / entry / signage) — where the field is undefined — are excluded.
			const enabledSpaces = spaces.filter((s) => (s as { suggestionsEnabled?: boolean }).suggestionsEnabled === true);

			if (enabledSpaces.length === 0) {
				return;
			}

			this.logger.debug(
				`Heartbeat cycle starting: ${enabledSpaces.length} space(s), ${this.evaluators.length} evaluator(s)`,
			);

			let totalSuggestions = 0;

			for (const space of enabledSpaces) {
				const results = await this.evaluateSpace(space.id);
				const created = await this.suggestionEngine.createFromEvaluatorResults(results);

				totalSuggestions += created.length;
			}

			const elapsed = Date.now() - startTime;

			if (elapsed > HEARTBEAT_MAX_CYCLE_MS) {
				this.logger.warn(`Heartbeat cycle exceeded ${HEARTBEAT_MAX_CYCLE_MS}ms: took ${elapsed}ms`);
			}

			if (totalSuggestions > 0) {
				this.logger.debug(`Heartbeat cycle complete: ${totalSuggestions} suggestion(s) created in ${elapsed}ms`);
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Heartbeat cycle failed: ${err.message}`, { stack: err.stack });
		} finally {
			this.running = false;
		}
	}

	/**
	 * Run all evaluators for a single space with per-evaluator timeout.
	 */
	private async evaluateSpace(spaceId: string): Promise<EvaluatorResult[]> {
		const context = await this.contextService.buildContext(spaceId);
		const results: EvaluatorResult[] = [];

		for (const evaluator of this.evaluators) {
			try {
				const evaluatorResults = await withTimeout(evaluator.evaluate(context), EVALUATOR_TIMEOUT_MS, evaluator.name);

				results.push(...evaluatorResults);
			} catch (error) {
				const err = error as Error;

				this.logger.warn(`Evaluator "${evaluator.name}" failed for space=${spaceId}: ${err.message}`);
			}
		}

		return results;
	}

	private isBuddyEnabled(): boolean {
		try {
			const config = this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);

			return config.enabled !== false;
		} catch {
			return false;
		}
	}

	private getIntervalMs(): number {
		try {
			const config = this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);

			return config.heartbeatIntervalMs ?? HEARTBEAT_DEFAULT_INTERVAL_MS;
		} catch {
			return HEARTBEAT_DEFAULT_INTERVAL_MS;
		}
	}
}
