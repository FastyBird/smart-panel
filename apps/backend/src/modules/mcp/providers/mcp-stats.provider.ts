import { Injectable } from '@nestjs/common';

import { StatsProvider } from '../../stats/stats.interfaces';
import { McpAuditService } from '../services/mcp-audit.service';

interface StatValue {
	value: number;
	last_updated: Date;
}

export interface McpStatsSnapshot {
	activeSubscriptions: StatValue;
	callsByCapability: Record<string, StatValue>;
	callsByTool: Record<string, StatValue>;
	failures: StatValue;
	denials: StatValue;
	timeouts: StatValue;
}

@Injectable()
export class McpStatsProvider implements StatsProvider<McpStatsSnapshot> {
	constructor(private readonly auditService: McpAuditService) {}

	getStats(): Promise<McpStatsSnapshot> {
		const snapshot = this.auditService.getMetricsSnapshot();
		const lastUpdated = new Date();
		const values = (entries: Record<string, number>): Record<string, StatValue> =>
			Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, { value, last_updated: lastUpdated }]));

		return Promise.resolve({
			activeSubscriptions: { value: snapshot.activeSubscriptions, last_updated: lastUpdated },
			callsByCapability: values(snapshot.callsByCapability),
			callsByTool: values(snapshot.callsByTool),
			failures: { value: snapshot.failures, last_updated: lastUpdated },
			denials: { value: snapshot.denials, last_updated: lastUpdated },
			timeouts: { value: snapshot.timeouts, last_updated: lastUpdated },
		});
	}
}
