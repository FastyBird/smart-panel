import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { IntentEventType } from '../../intents/intents.constants';
import { ActionObserverService, ActionRecord } from '../services/action-observer.service';

/**
 * Safely extract a string from an unknown value.
 */
function toStr(value: unknown): string {
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return value.toString();

	return '';
}

@Injectable()
export class IntentEventListener {
	private readonly logger = new Logger(IntentEventListener.name);

	constructor(private readonly actionObserver: ActionObserverService) {}

	@OnEvent(IntentEventType.COMPLETED)
	handleIntentCompleted(payload: Record<string, unknown>): void {
		try {
			const targets = Array.isArray(payload.targets) ? (payload.targets as Record<string, unknown>[]) : [];
			const ctx =
				typeof payload.context === 'object' && payload.context !== null
					? (payload.context as Record<string, unknown>)
					: {};

			const action: ActionRecord = {
				intentId: toStr(payload.intent_id),
				type: toStr(payload.type),
				status: toStr(payload.status),
				spaceId: ctx.space_id ? toStr(ctx.space_id) : null,
				deviceIds: targets.filter((t) => t.device_id).map((t) => toStr(t.device_id)),
				origin: ctx.origin ? toStr(ctx.origin) : null,
				timestamp: new Date(),
			};

			this.actionObserver.recordAction(action);

			this.logger.debug(`Recorded completed intent: ${action.intentId} (${action.type})`);
		} catch (error) {
			this.logger.warn(`Failed to process completed intent event: ${String(error)}`);
		}
	}
}
