import { hashToken } from '../utils/token.utils';

import { LongLiveTokenEntity } from './auth.entity';

describe('LongLiveTokenEntity', () => {
	it('hashes a raw credential before persistence', () => {
		const entity = new LongLiveTokenEntity();
		entity.hashedToken = 'raw-mcp-token';

		entity.updateToken();

		expect(entity.hashedToken).toBe(hashToken('raw-mcp-token'));
		expect(entity.hashedToken).not.toContain('raw-mcp-token');
	});
});
