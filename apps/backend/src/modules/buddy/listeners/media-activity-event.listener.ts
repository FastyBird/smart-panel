import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { EventType } from '../../../plugins/spaces-home-control/spaces-home-control.constants';
import { IntentType } from '../../intents/intents.constants';
import { BUDDY_MODULE_NAME } from '../buddy.constants';
import { ActionObserverService, ActionRecord } from '../services/action-observer.service';

interface MediaActivityPayload {
	space_id?: string;
	activity_key?: string | null;
	resolved?: {
		display_device_id?: string;
		audio_device_id?: string;
		source_device_id?: string;
		remote_device_id?: string;
	};
}

@Injectable()
export class MediaActivityEventListener {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'MediaActivityEventListener');

	constructor(private readonly actionObserver: ActionObserverService) {}

	@OnEvent(EventType.MEDIA_ACTIVITY_ACTIVATED)
	handleMediaActivated(payload: MediaActivityPayload): void {
		this.recordMediaAction(IntentType.SPACE_MEDIA_ACTIVATE, payload);
	}

	@OnEvent(EventType.MEDIA_ACTIVITY_DEACTIVATED)
	handleMediaDeactivated(payload: MediaActivityPayload): void {
		this.recordMediaAction(IntentType.SPACE_MEDIA_DEACTIVATE, payload);
	}

	private recordMediaAction(type: IntentType, payload: MediaActivityPayload): void {
		try {
			const spaceId = payload.space_id ?? null;

			const deviceIds: string[] = [];
			const resolved = payload.resolved;

			if (resolved) {
				for (const id of [
					resolved.display_device_id,
					resolved.audio_device_id,
					resolved.source_device_id,
					resolved.remote_device_id,
				]) {
					if (id) {
						deviceIds.push(id);
					}
				}
			}

			const record: ActionRecord = {
				intentId: `media-${payload.activity_key ?? 'off'}-${Date.now()}`,
				type,
				spaceId,
				deviceIds,
				timestamp: new Date(),
			};

			this.actionObserver.recordAction(record);
		} catch (error) {
			this.logger.warn(`Failed to process media activity event: ${error}`);
		}
	}
}
