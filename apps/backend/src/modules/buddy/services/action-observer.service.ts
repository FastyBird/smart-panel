import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ACTION_OBSERVER_DEFAULT_BUFFER_SIZE } from '../buddy.constants';

export interface ActionRecord {
	intentId: string;
	type: string;
	status: string;
	spaceId: string | null;
	deviceIds: string[];
	origin: string | null;
	timestamp: Date;
}

@Injectable()
export class ActionObserverService implements OnModuleInit {
	private readonly logger = new Logger(ActionObserverService.name);
	private readonly buffer: ActionRecord[] = [];
	private readonly maxSize: number = ACTION_OBSERVER_DEFAULT_BUFFER_SIZE;

	onModuleInit(): void {
		this.logger.debug('ActionObserverService initialized');
	}

	recordAction(action: ActionRecord): void {
		if (this.buffer.length >= this.maxSize) {
			this.buffer.shift();
		}

		this.buffer.push(action);
	}

	getRecentActions(limit?: number): ActionRecord[] {
		const count = limit ?? this.buffer.length;

		return this.buffer.slice(-count);
	}

	getRecentActionsForSpace(spaceId: string, limit?: number): ActionRecord[] {
		const filtered = this.buffer.filter((a) => a.spaceId === spaceId);
		const count = limit ?? filtered.length;

		return filtered.slice(-count);
	}

	getBufferSize(): number {
		return this.buffer.length;
	}
}
