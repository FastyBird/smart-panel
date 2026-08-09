import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
	MCP_DEFAULT_ALLOWED_ORIGINS,
	MCP_DEFAULT_CAPABILITIES,
	MCP_DEFAULT_ENABLED,
	MCP_DEFAULT_OAUTH_PUBLIC_BASE_URL,
	MCP_MODULE_NAME,
	McpCapability,
} from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';

import { UpdateMcpConfigDto } from './update-config.dto';

const CAPABILITY_COMBINATIONS: McpCapability[][] = [
	[],
	[McpCapability.READ],
	[McpCapability.WRITE],
	[McpCapability.TRIGGER],
	[McpCapability.READ, McpCapability.WRITE],
	[McpCapability.READ, McpCapability.TRIGGER],
	[McpCapability.WRITE, McpCapability.TRIGGER],
	[McpCapability.READ, McpCapability.WRITE, McpCapability.TRIGGER],
];

describe('MCP configuration', () => {
	it('uses disabled, read-selected defaults', async () => {
		const config = new McpConfigModel();

		expect(config).toMatchObject({
			type: MCP_MODULE_NAME,
			enabled: MCP_DEFAULT_ENABLED,
			capabilities: MCP_DEFAULT_CAPABILITIES,
			allowedOrigins: MCP_DEFAULT_ALLOWED_ORIGINS,
			oauthPublicBaseUrl: MCP_DEFAULT_OAUTH_PUBLIC_BASE_URL,
		});
		expect(await validate(config)).toHaveLength(0);
	});

	it('accepts only a normalized HTTPS OAuth public base URL and permits clearing it', async () => {
		for (const value of ['https://panel.example.com', 'https://panel.example.com/smart-panel', null]) {
			const dto = plainToInstance(UpdateMcpConfigDto, {
				type: MCP_MODULE_NAME,
				oauth_public_base_url: value,
			});

			expect(await validate(dto)).toHaveLength(0);
		}

		for (const value of [
			'http://panel.example.com',
			'https://panel.example.com/',
			'https://panel.example.com/path/',
			'https://panel.example.com?redirect=other',
		]) {
			const dto = plainToInstance(UpdateMcpConfigDto, {
				type: MCP_MODULE_NAME,
				oauth_public_base_url: value,
			});

			expect(await validate(dto)).not.toHaveLength(0);
		}
	});

	it.each(CAPABILITY_COMBINATIONS)('accepts capability combination %j', async (...capabilities) => {
		const dto = plainToInstance(UpdateMcpConfigDto, {
			type: MCP_MODULE_NAME,
			capabilities,
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it('rejects duplicate and unknown capabilities', async () => {
		const duplicate = plainToInstance(UpdateMcpConfigDto, {
			type: MCP_MODULE_NAME,
			capabilities: [McpCapability.READ, McpCapability.READ],
		});
		const unknown = plainToInstance(UpdateMcpConfigDto, {
			type: MCP_MODULE_NAME,
			capabilities: ['read', 'admin'],
		});

		expect(await validate(duplicate)).not.toHaveLength(0);
		expect(await validate(unknown)).not.toHaveLength(0);
	});

	it('accepts normalized HTTP origins and rejects non-origin URLs', async () => {
		const valid = plainToInstance(UpdateMcpConfigDto, {
			type: MCP_MODULE_NAME,
			allowed_origins: ['https://panel.example.com', 'http://localhost:3000', 'http://[::1]:3000'],
		});
		const invalidOrigins = [
			'https://panel.example.com/',
			'https://panel.example.com/path',
			'https://panel.example.com?query=yes',
			'https://user:secret@panel.example.com',
			'ftp://panel.example.com',
			'*',
		];

		expect(await validate(valid)).toHaveLength(0);

		for (const origin of invalidOrigins) {
			const invalid = plainToInstance(UpdateMcpConfigDto, {
				type: MCP_MODULE_NAME,
				allowed_origins: [origin],
			});

			expect(await validate(invalid)).not.toHaveLength(0);
		}
	});

	it('serializes the persisted model using API field names', () => {
		const config = new McpConfigModel();
		config.enabled = true;
		config.capabilities = [McpCapability.WRITE, McpCapability.TRIGGER];
		config.allowedOrigins = ['https://panel.example.com'];
		config.oauthPublicBaseUrl = 'https://panel.example.com/smart-panel';

		expect(instanceToPlain(config)).toEqual({
			type: MCP_MODULE_NAME,
			enabled: true,
			capabilities: [McpCapability.WRITE, McpCapability.TRIGGER],
			allowed_origins: ['https://panel.example.com'],
			oauth_public_base_url: 'https://panel.example.com/smart-panel',
		});
	});
});
