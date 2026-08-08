import { describe, expect, it } from 'vitest';

import { resolveMcpEndpoint } from './mcp.utils';

describe('resolveMcpEndpoint', () => {
	it('uses the installation origin', () => {
		expect(resolveMcpEndpoint({ origin: 'https://panel.example.com', pathname: '/dashboard' } as Location)).toBe(
			'https://panel.example.com/api/v1/modules/mcp'
		);
	});

	it('preserves a Home Assistant ingress prefix', () => {
		expect(
			resolveMcpEndpoint({
				origin: 'https://homeassistant.local',
				pathname: '/api/hassio_ingress/abc123/dashboard',
			} as Location)
		).toBe('https://homeassistant.local/api/hassio_ingress/abc123/api/v1/modules/mcp');
	});
});
