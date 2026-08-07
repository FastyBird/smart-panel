import { McpCapability } from '../mcp.constants';
import { McpAuditService } from '../services/mcp-audit.service';

import { McpStatsProvider } from './mcp-stats.provider';

describe('McpStatsProvider', () => {
	it('projects MCP counters into the shared stats leaf format', async () => {
		const auditService = {
			getMetricsSnapshot: jest.fn().mockReturnValue({
				activeSubscriptions: 2,
				callsByCapability: { read: 3, write: 1, trigger: 0 },
				callsByTool: { get_home_context: 3, set_device_property: 1 },
				failures: 1,
				denials: 2,
				timeouts: 1,
			}),
		};
		const provider = new McpStatsProvider(auditService as unknown as McpAuditService);

		const stats = await provider.getStats();

		expect(stats.activeSubscriptions.value).toBe(2);
		expect(stats.callsByCapability[McpCapability.READ]?.value).toBe(3);
		expect(stats.callsByTool.set_device_property?.value).toBe(1);
		expect(stats.failures.value).toBe(1);
		expect(stats.denials.value).toBe(2);
		expect(stats.timeouts.value).toBe(1);
		expect(stats.activeSubscriptions.last_updated).toBeInstanceOf(Date);
	});
});
