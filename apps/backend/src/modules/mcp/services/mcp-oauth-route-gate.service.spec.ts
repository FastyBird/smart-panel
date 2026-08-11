import { ServiceUnavailableException } from '@nestjs/common';

import {
	MCP_OAUTH_REQUIRED_READINESS_CONTROLS,
	McpOAuthReadinessControl,
	McpOAuthReadinessService,
} from './mcp-oauth-readiness.service';
import { McpOAuthRouteGateService } from './mcp-oauth-route-gate.service';

describe('McpOAuthRouteGateService', () => {
	it('stays closed when application readiness is incomplete', () => {
		const readiness = new McpOAuthReadinessService();
		readiness.register(McpOAuthReadinessControl.AUDIT_HOOKS);
		readiness.onApplicationBootstrap();
		const gate = new McpOAuthRouteGateService(readiness);

		expect(gate.isOpen).toBe(false);
		expect(() => gate.openInternal()).toThrow(ServiceUnavailableException);
		expect(() => gate.assertOpen()).toThrow('The MCP OAuth route gate is closed');
	});

	it('opens only after complete readiness and closes synchronously', () => {
		const readiness = new McpOAuthReadinessService();
		readiness.register(...MCP_OAUTH_REQUIRED_READINESS_CONTROLS);
		readiness.onApplicationBootstrap();
		const gate = new McpOAuthRouteGateService(readiness);

		gate.openInternal();

		expect(gate.isOpen).toBe(true);
		expect(() => gate.assertOpen()).not.toThrow();

		gate.closeInternal();

		expect(gate.isOpen).toBe(false);
		expect(() => gate.assertOpen()).toThrow(ServiceUnavailableException);
	});

	it('rejects a request generation that crossed a close and reopen boundary', () => {
		const readiness = new McpOAuthReadinessService();
		readiness.register(...MCP_OAUTH_REQUIRED_READINESS_CONTROLS);
		readiness.onApplicationBootstrap();
		const gate = new McpOAuthRouteGateService(readiness);
		gate.openInternal();
		const generation = gate.assertOpen();

		gate.closeInternal();
		gate.openInternal();

		expect(() => gate.assertOpenGeneration(generation)).toThrow(
			'The MCP OAuth route gate changed while the request was queued',
		);
	});
});
