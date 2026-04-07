import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EXTENSIONS_MODULE_NAME } from '../extensions.constants';

export interface ActionExecutionRecord {
	id: string;
	extensionType: string;
	actionId: string;
	userId: string | null;
	userRole: string | null;
	params: Record<string, unknown>;
	success: boolean;
	message: string | null;
	durationMs: number;
	timestamp: Date;
}

const DEFAULT_MAX_ENTRIES = 1000;

@Injectable()
export class ActionAuditService {
	private readonly logger = createExtensionLogger(EXTENSIONS_MODULE_NAME, 'ActionAuditService');

	private readonly buffer: ActionExecutionRecord[] = [];
	private readonly maxEntries: number;
	private idCounter = 0;

	constructor() {
		this.maxEntries = DEFAULT_MAX_ENTRIES;
	}

	record(entry: Omit<ActionExecutionRecord, 'id' | 'timestamp'>): ActionExecutionRecord {
		const record: ActionExecutionRecord = {
			...entry,
			id: String(++this.idCounter),
			timestamp: new Date(),
		};

		this.buffer.push(record);

		// Evict oldest entries when buffer exceeds max size
		if (this.buffer.length > this.maxEntries) {
			this.buffer.splice(0, this.buffer.length - this.maxEntries);
		}

		this.logger.debug(
			`Recorded action execution: ${entry.extensionType}/${entry.actionId} (${entry.success ? 'ok' : 'fail'})`,
		);

		return record;
	}

	getHistory(extensionType: string, actionId: string, limit = 50): ActionExecutionRecord[] {
		return this.buffer
			.filter((r) => r.extensionType === extensionType && r.actionId === actionId)
			.slice(-limit)
			.reverse();
	}

	getExtensionHistory(extensionType: string, limit = 100): ActionExecutionRecord[] {
		return this.buffer
			.filter((r) => r.extensionType === extensionType)
			.slice(-limit)
			.reverse();
	}
}
