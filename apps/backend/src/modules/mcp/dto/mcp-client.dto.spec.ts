import { validate } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { MCP_DEFAULT_TOKEN_EXPIRATION_DAYS, McpCapability } from '../mcp.constants';

import { CreateMcpClientDto, RotateMcpClientTokenDto } from './mcp-client.dto';

describe('MCP client credential DTOs', () => {
	it('uses the default lifetime when client creation omits expiry', async () => {
		const dto = toInstance(CreateMcpClientDto, {
			name: 'Agent',
			capabilities: [McpCapability.READ],
		});

		expect(dto.expiresInDays).toBe(MCP_DEFAULT_TOKEN_EXPIRATION_DAYS);
		await expect(validate(dto)).resolves.toEqual([]);
	});

	it('uses the default lifetime when credential rotation omits expiry', async () => {
		const dto = toInstance(RotateMcpClientTokenDto, {});

		expect(dto.expiresInDays).toBe(MCP_DEFAULT_TOKEN_EXPIRATION_DAYS);
		await expect(validate(dto)).resolves.toEqual([]);
	});
});
