import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { IntentEventType, IntentType } from '../../intents/intents.constants';
import { ActionObserverService, ActionRecord } from '../services/action-observer.service';

@Injectable()
export class IntentEventListener {
	private readonly logger = new Logger(IntentEventListener.name);

	constructor(private readonly actionObserver: ActionObserverService) {}

	@OnEvent(IntentEventType.COMPLETED)
	handleIntentCompleted(payload: Record<string, unknown>): void {
		try {
			const intentId = payload.intent_id as string;
			const type = payload.type as IntentType;
			const context = payload.context as Record<string, unknown> | undefined;
			const targets = payload.targets as Array<Record<string, unknown>> | undefined;

			const spaceId = (context?.space_id as string) ?? null;

			const deviceIds: string[] = [];

			if (targets) {
				for (const target of targets) {
					const deviceId = target.device_id as string | null;

					if (deviceId) {
						deviceIds.push(deviceId);
					}
				}
			}

			const record: ActionRecord = {
				intentId,
				type,
				spaceId,
				deviceIds,
				timestamp: new Date(),
			};

			this.actionObserver.recordAction(record);
		} catch (error) {
			this.logger.warn(`Failed to process completed intent event: ${error}`);
		}
	}
}
