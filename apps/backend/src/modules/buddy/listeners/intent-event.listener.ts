import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { IntentEventType, IntentType } from '../../intents/intents.constants';
import { BUDDY_MODULE_NAME } from '../buddy.constants';
import { ActionObserverService, ActionRecord, ActionTarget } from '../services/action-observer.service';

@Injectable()
export class IntentEventListener {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'IntentEventListener');

	constructor(private readonly actionObserver: ActionObserverService) {}

	@OnEvent(IntentEventType.COMPLETED)
	handleIntentCompleted(payload: Record<string, unknown>): void {
		try {
			const intentId = payload.intent_id as string;
			const type = payload.type as IntentType;
			const context = payload.context as Record<string, unknown> | undefined;
			const rawTargets = payload.targets as Array<Record<string, unknown>> | undefined;
			const value = payload.value;

			const spaceId = (context?.space_id as string) ?? null;

			const deviceIds: string[] = [];
			const targets: ActionTarget[] = [];

			if (rawTargets) {
				for (const target of rawTargets) {
					const deviceId = target.device_id as string | undefined;
					const channelId = target.channel_id as string | undefined;
					const propertyId = target.property_id as string | undefined;

					if (deviceId) {
						deviceIds.push(deviceId);
						targets.push({
							deviceId,
							channelId,
							propertyId,
						});
					}
				}
			}

			const record: ActionRecord = {
				intentId,
				type,
				spaceId,
				deviceIds,
				targets,
				value,
				timestamp: new Date(),
			};

			this.actionObserver.recordAction(record);
		} catch (error) {
			this.logger.warn(`Failed to process completed intent event: ${error}`);
		}
	}
}
