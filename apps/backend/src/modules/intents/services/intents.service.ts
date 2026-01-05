import { v4 as uuid } from 'uuid';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import {
	DEFAULT_TTL_DEVICE_COMMAND,
	INTENTS_MODULE_NAME,
	INTENT_CLEANUP_INTERVAL,
	IntentEventType,
	IntentStatus,
	IntentTargetStatus,
} from '../intents.constants';
import { CreateIntentInput, IntentRecord, IntentTargetResult } from '../models/intent.model';

@Injectable()
export class IntentsService implements OnModuleInit, OnModuleDestroy {
	private readonly intents = new Map<string, IntentRecord>();
	private cleanupInterval: NodeJS.Timeout | null = null;
	private readonly logger = createExtensionLogger(INTENTS_MODULE_NAME, 'IntentsService');

	constructor(private readonly eventEmitter: EventEmitter2) {}

	onModuleInit(): void {
		this.cleanupInterval = setInterval(() => this.expireIntents(), INTENT_CLEANUP_INTERVAL);
		this.logger.log('IntentsService initialized with cleanup interval');
	}

	onModuleDestroy(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
		this.intents.clear();
		this.logger.log('IntentsService destroyed');
	}

	/**
	 * Create a new intent and emit the created event
	 */
	createIntent(input: CreateIntentInput): IntentRecord {
		const now = new Date();
		const ttlMs = input.ttlMs ?? DEFAULT_TTL_DEVICE_COMMAND;

		const intent: IntentRecord = {
			id: uuid(),
			requestId: input.requestId,
			type: input.type,
			scope: input.scope,
			context: input.context,
			targets: input.targets,
			value: input.value,
			status: IntentStatus.PENDING,
			ttlMs,
			createdAt: now,
			expiresAt: new Date(now.getTime() + ttlMs),
		};

		this.intents.set(intent.id, intent);
		this.logger.debug(
			`Intent created: ${intent.id} (${intent.type})${input.requestId ? ` requestId=${input.requestId}` : ''}`,
		);

		this.emitIntentEvent(IntentEventType.CREATED, intent);

		return intent;
	}

	/**
	 * Complete an intent with results and emit the completed event
	 */
	completeIntent(intentId: string, results: IntentTargetResult[]): IntentRecord | null {
		const intent = this.intents.get(intentId);

		if (!intent) {
			this.logger.warn(`Attempted to complete non-existent intent: ${intentId}`);
			return null;
		}

		// Already completed or expired - no-op
		if (intent.status !== IntentStatus.PENDING) {
			this.logger.warn(`Attempted to complete already finalized intent: ${intentId} (${intent.status})`);
			return intent;
		}

		const now = new Date();

		// Compute overall status from results
		const status = this.computeOverallStatus(results);

		intent.status = status;
		intent.completedAt = now;
		intent.results = results;

		this.logger.debug(`Intent completed: ${intentId} (${status})`);

		this.emitIntentEvent(IntentEventType.COMPLETED, intent);

		// Remove from registry (completed intents don't need cleanup)
		this.intents.delete(intentId);

		return intent;
	}

	/**
	 * Get an intent by ID
	 */
	getIntent(intentId: string): IntentRecord | undefined {
		return this.intents.get(intentId);
	}

	/**
	 * Find active (pending) intents matching query criteria
	 */
	findActiveIntents(query: { deviceId?: string; spaceId?: string }): IntentRecord[] {
		const results: IntentRecord[] = [];

		for (const intent of this.intents.values()) {
			if (intent.status !== IntentStatus.PENDING) {
				continue;
			}

			// Match by deviceId
			if (query.deviceId) {
				const hasDevice = intent.targets.some((t) => t.deviceId === query.deviceId);

				if (hasDevice) {
					results.push(intent);

					continue;
				}
			}

			// Match by spaceId (scope)
			if (query.spaceId && intent.scope?.spaceId === query.spaceId) {
				results.push(intent);
			}
		}

		return results;
	}

	/**
	 * Get count of active intents (for metrics/debugging)
	 */
	getActiveCount(): number {
		let count = 0;

		for (const intent of this.intents.values()) {
			if (intent.status === IntentStatus.PENDING) {
				count++;
			}
		}

		return count;
	}

	/**
	 * Expire intents that have passed their TTL
	 * Called periodically by cleanup interval
	 */
	private expireIntents(): void {
		const now = Date.now();
		const expiredIntents: IntentRecord[] = [];

		for (const intent of this.intents.values()) {
			if (intent.status === IntentStatus.PENDING && intent.expiresAt.getTime() <= now) {
				expiredIntents.push(intent);
			}
		}

		for (const intent of expiredIntents) {
			intent.status = IntentStatus.EXPIRED;
			intent.completedAt = new Date(now);

			this.logger.debug(`Intent expired: ${intent.id}`);

			this.emitIntentEvent(IntentEventType.EXPIRED, intent);

			this.intents.delete(intent.id);
		}
	}

	/**
	 * Compute overall intent status from per-target results
	 */
	private computeOverallStatus(results: IntentTargetResult[]): IntentStatus {
		if (results.length === 0) {
			return IntentStatus.COMPLETED_SUCCESS;
		}

		const successCount = results.filter((r) => r.status === IntentTargetStatus.SUCCESS).length;
		const totalCount = results.length;

		if (successCount === totalCount) {
			return IntentStatus.COMPLETED_SUCCESS;
		} else if (successCount > 0) {
			return IntentStatus.COMPLETED_PARTIAL;
		} else {
			return IntentStatus.COMPLETED_FAILED;
		}
	}

	/**
	 * Emit intent event to Socket.IO clients via EventEmitter2
	 * Build the payload directly with snake_case keys for Socket.IO
	 */
	private emitIntentEvent(eventType: IntentEventType, intent: IntentRecord): void {
		// Build payload directly with snake_case keys
		// (class-transformer doesn't handle 'unknown' type properly)
		const payload: Record<string, unknown> = {
			intent_id: intent.id,
			type: intent.type,
			targets: intent.targets.map((t) => ({
				device_id: t.deviceId ?? null,
				channel_id: t.channelId ?? null,
				property_id: t.propertyId ?? null,
				scene_id: t.sceneId ?? null,
			})),
			value: intent.value,
			status: intent.status,
			ttl_ms: intent.ttlMs,
			created_at: intent.createdAt.toISOString(),
			expires_at: intent.expiresAt.toISOString(),
		};

		// Add optional fields only if present
		if (intent.requestId) {
			payload.request_id = intent.requestId;
		}

		if (intent.scope?.spaceId) {
			payload.scope = { space_id: intent.scope.spaceId };
		}

		if (intent.context) {
			const ctx: Record<string, unknown> = {};

			if (intent.context.origin) ctx.origin = intent.context.origin;
			if (intent.context.displayId) ctx.display_id = intent.context.displayId;
			if (intent.context.spaceId) ctx.space_id = intent.context.spaceId;
			if (intent.context.roleKey) ctx.role_key = intent.context.roleKey;
			if (intent.context.extra) ctx.extra = intent.context.extra;

			if (Object.keys(ctx).length > 0) {
				payload.context = ctx;
			}
		}

		if (intent.completedAt) {
			payload.completed_at = intent.completedAt.toISOString();
		}

		if (intent.results) {
			payload.results = intent.results.map((r) => ({
				device_id: r.deviceId ?? null,
				channel_id: r.channelId ?? null,
				property_id: r.propertyId ?? null,
				scene_id: r.sceneId ?? null,
				status: r.status,
				...(r.error && { error: r.error }),
			}));
		}

		this.eventEmitter.emit(eventType, payload);
	}
}
