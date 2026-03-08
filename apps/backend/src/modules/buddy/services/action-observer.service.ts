import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { IntentType } from '../../intents/intents.constants';
import { ACTION_OBSERVER_BUFFER_SIZE, BUDDY_MODULE_NAME } from '../buddy.constants';

export interface ActionRecord {
	intentId: string;
	type: IntentType;
	spaceId: string | null;
	deviceIds: string[];
	timestamp: Date;
}

@Injectable()
export class ActionObserverService {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'ActionObserverService');
	private readonly buffer: ActionRecord[] = [];
	private readonly maxSize: number = ACTION_OBSERVER_BUFFER_SIZE;

	/**
	 * Record a completed intent action in the ring buffer.
	 */
	recordAction(record: ActionRecord): void {
		if (this.buffer.length >= this.maxSize) {
			this.buffer.shift();
		}

		this.buffer.push(record);

		this.logger.debug(`Action recorded: ${record.type} (buffer size: ${this.buffer.length})`);
	}

	/**
	 * Get the most recent actions from the buffer.
	 */
	getRecentActions(limit?: number): ActionRecord[] {
		if (limit == null || limit >= this.buffer.length) {
			return [...this.buffer];
		}

		return this.buffer.slice(-limit);
	}

	/**
	 * Get recent actions filtered by space ID.
	 */
	getRecentActionsBySpace(spaceId: string, limit?: number): ActionRecord[] {
		const filtered = this.buffer.filter((a) => a.spaceId === spaceId);

		if (limit == null || limit >= filtered.length) {
			return filtered;
		}

		return filtered.slice(-limit);
	}

	/**
	 * Get the current buffer size.
	 */
	getBufferSize(): number {
		return this.buffer.length;
	}
}
