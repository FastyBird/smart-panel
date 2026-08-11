import { ServiceUnavailableException } from '@nestjs/common';

import {
	MCP_OAUTH_REQUIRED_READINESS_CONTROLS,
	McpOAuthReadinessControl,
	McpOAuthReadinessService,
} from './mcp-oauth-readiness.service';

describe('McpOAuthReadinessService', () => {
	it('remains unverified and fail-closed before application bootstrap', () => {
		const service = new McpOAuthReadinessService();

		expect(service.snapshot).toEqual({
			verified: false,
			ready: false,
			registered: [],
			missing: MCP_OAUTH_REQUIRED_READINESS_CONTROLS,
		});
		expect(() => service.verify()).toThrow(ServiceUnavailableException);
		expect(() => service.assertReady()).toThrow(ServiceUnavailableException);
	});

	it('reports every absent control after bootstrap instead of opening a partial profile', () => {
		const service = new McpOAuthReadinessService();
		service.register(
			McpOAuthReadinessControl.AUTHORIZATION_DEADLINE_ABORT,
			McpOAuthReadinessControl.TARGETED_SUBSCRIPTION_ABORT,
		);

		service.onApplicationBootstrap();

		expect(service.verify()).toEqual({
			verified: true,
			ready: false,
			registered: [
				McpOAuthReadinessControl.AUTHORIZATION_DEADLINE_ABORT,
				McpOAuthReadinessControl.TARGETED_SUBSCRIPTION_ABORT,
			],
			missing: MCP_OAUTH_REQUIRED_READINESS_CONTROLS.filter(
				(control) =>
					control !== McpOAuthReadinessControl.AUTHORIZATION_DEADLINE_ABORT &&
					control !== McpOAuthReadinessControl.TARGETED_SUBSCRIPTION_ABORT,
			),
		});
		expect(() => service.assertReady()).toThrow('MCP OAuth security controls are not ready');
	});

	it('reports ready only after every required control is registered', () => {
		const service = new McpOAuthReadinessService();
		service.register(...MCP_OAUTH_REQUIRED_READINESS_CONTROLS);

		service.onApplicationBootstrap();

		expect(service.verify()).toEqual({
			verified: true,
			ready: true,
			registered: MCP_OAUTH_REQUIRED_READINESS_CONTROLS,
			missing: [],
		});
		expect(() => service.assertReady()).not.toThrow();
	});

	it('seals registration at bootstrap while allowing idempotent pre-bootstrap registration', () => {
		const service = new McpOAuthReadinessService();
		service.register(McpOAuthReadinessControl.AUDIT_HOOKS);
		service.register(McpOAuthReadinessControl.AUDIT_HOOKS);
		service.onApplicationBootstrap();

		expect(service.snapshot.registered).toEqual([McpOAuthReadinessControl.AUDIT_HOOKS]);
		expect(() => service.register(McpOAuthReadinessControl.COMPLETE_ROUTE_SET)).toThrow(
			'MCP OAuth readiness registration is already sealed',
		);
	});
});
