import { MCP_MODULE_NAME, McpCapability } from '../mcp.constants';

import { McpAuditOutcome, McpAuditService } from './mcp-audit.service';

describe('McpAuditService', () => {
	let service: McpAuditService;
	let log: jest.SpyInstance;

	beforeEach(() => {
		service = new McpAuditService();
		const logger = (service as unknown as { logger: { log: (...args: unknown[]) => void } }).logger;
		log = jest.spyOn(logger, 'log').mockImplementation(() => undefined);
	});

	it('logs only allowlisted write targets and never records raw values or credentials', () => {
		service.recordToolResult({
			requestId: 'request-1',
			clientId: 'client-1',
			tool: 'set_device_property',
			capability: McpCapability.WRITE,
			durationMs: 12.4,
			outcome: McpAuditOutcome.COMPLETED,
			arguments: {
				property_id: 'property-1',
				value: 'private-device-value',
				authorization: 'Bearer raw-secret',
				token_hash: 'hashed-secret',
			},
		});

		expect(log).toHaveBeenCalledWith('MCP audit event', {
			event: 'tool_execution',
			request_id: 'request-1',
			client_id: 'client-1',
			tool: 'set_device_property',
			capability: McpCapability.WRITE,
			duration_ms: 12,
			outcome: McpAuditOutcome.COMPLETED,
			property_id: 'property-1',
		});
		const captured = JSON.stringify(log.mock.calls);

		expect(captured).not.toContain('private-device-value');
		expect(captured).not.toContain('raw-secret');
		expect(captured).not.toContain('hashed-secret');
		expect(captured).not.toContain('authorization');
		expect(captured).not.toContain('token_hash');
	});

	it('tracks calls by capability and tool plus failure outcomes', () => {
		service.recordToolResult({
			requestId: '1',
			tool: 'get_weather',
			capability: McpCapability.READ,
			durationMs: 1,
			outcome: McpAuditOutcome.FAILED,
		});
		service.recordToolResult({
			requestId: '2',
			tool: 'set_device_property',
			capability: McpCapability.WRITE,
			durationMs: 2,
			outcome: McpAuditOutcome.DENIED,
		});
		service.recordPolicyDenial({ requestId: '2', clientId: 'client-1' }, 'capability_denied', {
			capability: McpCapability.WRITE,
			tool: 'set_device_property',
		});
		service.recordToolResult({
			requestId: '3',
			tool: 'run_scene',
			capability: McpCapability.TRIGGER,
			durationMs: 3,
			outcome: McpAuditOutcome.TIMED_OUT,
		});

		expect(service.getMetricsSnapshot()).toEqual({
			activeSubscriptions: 0,
			callsByCapability: { read: 1, write: 1, trigger: 1 },
			callsByTool: { get_weather: 1, set_device_property: 1, run_scene: 1 },
			failures: 1,
			denials: 1,
			timeouts: 1,
		});
	});

	it('counts a policy denial without tool execution and avoids double-counting tool denials', () => {
		service.recordPolicyDenial({ requestId: '1', clientId: 'client-1' }, 'origin_denied');
		service.recordPolicyDenial({ requestId: '2', clientId: 'client-1' }, 'capability_denied', {
			capability: McpCapability.READ,
			tool: 'get_home_context',
		});
		service.recordToolResult({
			requestId: '2',
			clientId: 'client-1',
			tool: 'get_home_context',
			capability: McpCapability.READ,
			durationMs: 2,
			outcome: McpAuditOutcome.DENIED,
		});

		expect(service.getMetricsSnapshot().denials).toBe(2);
	});

	it('tracks the active subscription gauge without allowing it to become negative', () => {
		service.recordSubscriptionOpened({ requestId: '1', clientId: 'client-1' }, 'subscription-1');
		service.recordSubscriptionClosed({ requestId: '1', clientId: 'client-1' }, 'subscription-1', 'completed');
		service.recordSubscriptionClosed({ requestId: '1', clientId: 'client-1' }, 'subscription-1', 'completed');

		expect(service.getMetricsSnapshot().activeSubscriptions).toBe(0);
	});

	it('normalizes client-controlled string request identifiers before logging', () => {
		const bearerLikeId = 'Bearer raw-secret';
		const normalizedId = service.getRequestId({ id: bearerLikeId });

		expect(service.getRequestId({ id: 17, token: 'secret' })).toBe('17');
		expect(normalizedId).toMatch(/^string:[A-Za-z0-9_-]{16}$/);
		expect(service.getRequestId({ id: bearerLikeId })).toBe(normalizedId);
		expect(service.getRequestId({ id: 'another-id' })).not.toBe(normalizedId);
		expect(service.getRequestId({ id: 'x'.repeat(10_000) })).toMatch(/^string:[A-Za-z0-9_-]{16}$/);
		expect(normalizedId).not.toContain('raw-secret');
		expect(service.getRequestId({ id: Number.POSITIVE_INFINITY })).toBe('unknown');
		expect(service.getRequestId({ id: { nested: true } })).toBe('unknown');
		expect(service.getRequestId(null)).toBe('unknown');
	});

	it('uses the MCP module logger source for every record', () => {
		service.recordAuthenticationFailure({ requestId: '1' }, 'invalid_credential');
		const logger = (service as unknown as { logger: { extensionType: string } }).logger;

		expect(logger.extensionType).toBe(MCP_MODULE_NAME);
	});

	it('counts policy-resolution outages as failures without incrementing denials', () => {
		service.recordRequestFailure({ requestId: '1', clientId: 'client-1' }, 'policy_resolution_error');

		expect(service.getMetricsSnapshot()).toMatchObject({ failures: 1, denials: 0 });
	});

	it('counts authentication backend errors as failures without counting credential rejections', () => {
		service.recordAuthenticationFailure({ requestId: '1' }, 'invalid_credential');
		service.recordAuthenticationFailure({ requestId: '2' }, 'authentication_error');

		expect(service.getMetricsSnapshot()).toMatchObject({ failures: 1, denials: 0 });
	});
});
