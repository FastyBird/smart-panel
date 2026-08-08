import { LongLiveTokenEntity } from '../../auth/entities/auth.entity';

import { McpClientEntity } from './mcp-client.entity';

describe('McpClientEntity', () => {
	it('exposes the current credential state without exposing the token relation', () => {
		const expiresAt = new Date('2030-01-01T00:00:00.000Z');
		const lastUsedAt = new Date('2026-08-08T10:00:00.000Z');
		const client = new McpClientEntity();
		client.token = {
			expiresAt,
			lastUsedAt,
			revoked: false,
		} as LongLiveTokenEntity;

		expect(client.credentialExpiresAt).toBe(expiresAt);
		expect(client.credentialRevoked).toBe(false);
		expect(client.lastUsedAt).toBe(lastUsedAt);
	});

	it('treats a missing credential as revoked', () => {
		const client = new McpClientEntity();

		expect(client.credentialExpiresAt).toBeNull();
		expect(client.credentialRevoked).toBe(true);
		expect(client.lastUsedAt).toBeNull();
	});
});
