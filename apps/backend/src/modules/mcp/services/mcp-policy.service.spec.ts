import { FastifyRequest } from 'fastify';

import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { TokenOwnerType } from '../../auth/auth.constants';
import { ConfigService } from '../../config/services/config.service';
import { UserRole } from '../../users/users.constants';
import { McpClientEntity } from '../entities/mcp-client.entity';
import { McpCapability } from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';

import { McpClientService } from './mcp-client.service';
import { McpInstallationService } from './mcp-installation.service';
import { McpPolicyContext, McpPolicyService } from './mcp-policy.service';

const CLIENT_ID = 'client-id';
const TOKEN_ID = 'token-id';
const INSTALLATION_ID = 'installation-id';

const allCapabilitySets: McpCapability[][] = [
	[],
	[McpCapability.READ],
	[McpCapability.WRITE],
	[McpCapability.TRIGGER],
	[McpCapability.READ, McpCapability.WRITE],
	[McpCapability.READ, McpCapability.TRIGGER],
	[McpCapability.WRITE, McpCapability.TRIGGER],
	[McpCapability.READ, McpCapability.WRITE, McpCapability.TRIGGER],
];

describe('McpPolicyService', () => {
	let config: McpConfigModel;
	let client: McpClientEntity;
	let clientService: jest.Mocked<Pick<McpClientService, 'findActiveByToken'>>;
	let service: McpPolicyService;

	const auth = {
		type: 'token' as const,
		tokenId: TOKEN_ID,
		ownerType: TokenOwnerType.MCP,
		ownerId: CLIENT_ID,
		role: UserRole.USER,
	};

	beforeEach(() => {
		config = Object.assign(new McpConfigModel(), {
			enabled: true,
			capabilities: [...allCapabilitySets.at(-1)],
			allowedOrigins: [],
		});
		client = {
			id: CLIENT_ID,
			name: 'Test client',
			enabled: true,
			capabilities: [...allCapabilitySets.at(-1)],
			tokenId: TOKEN_ID,
			token: { id: TOKEN_ID, revoked: false, expiresAt: new Date(Date.now() + 60_000) },
		} as McpClientEntity;
		clientService = {
			findActiveByToken: jest.fn().mockResolvedValue(client),
		};
		service = new McpPolicyService(
			{ getModuleConfig: jest.fn(() => config) } as unknown as ConfigService,
			{
				get: jest.fn((key: string) => (key === 'FB_APP_HOST' ? 'https://panel.example.com' : undefined)),
			} as unknown as NestConfigService,
			clientService as unknown as McpClientService,
			{ getInstallationId: jest.fn().mockResolvedValue(INSTALLATION_ID) } as unknown as McpInstallationService,
		);
	});

	it.each(
		allCapabilitySets.flatMap((ceiling) =>
			allCapabilitySets.map((grants) => ({
				ceiling,
				grants,
				expected: grants.filter((capability) => ceiling.includes(capability)),
			})),
		),
	)('intersects module $ceiling with client $grants', async ({ ceiling, grants, expected }) => {
		config.capabilities = ceiling;
		client.capabilities = grants;

		await expect(service.resolve(auth)).resolves.toMatchObject({
			client,
			config,
			effectiveCapabilities: expected,
			installationId: INSTALLATION_ID,
			tokenId: TOKEN_ID,
		});
	});

	it('hides the endpoint while the module is disabled', async () => {
		config.enabled = false;

		await expect(service.resolve(auth)).rejects.toThrow(NotFoundException);
		expect(clientService.findActiveByToken).not.toHaveBeenCalled();
	});

	it('rejects missing, disabled, revoked, and expired client credentials', async () => {
		const inactiveClients = [
			null,
			{ ...client, enabled: false },
			{ ...client, token: null },
			{ ...client, token: { ...client.token, revoked: true } },
			{ ...client, token: { ...client.token, expiresAt: new Date(Date.now() - 1) } },
		];

		for (const inactiveClient of inactiveClients) {
			clientService.findActiveByToken.mockResolvedValueOnce(inactiveClient as McpClientEntity | null);

			await expect(service.resolve(auth)).rejects.toThrow(UnauthorizedException);
		}
	});

	it('rechecks a required capability immediately before authorization', async () => {
		config.capabilities = [McpCapability.READ];
		client.capabilities = [McpCapability.READ, McpCapability.WRITE];

		await expect(service.authorize(auth, McpCapability.WRITE)).rejects.toThrow(ForbiddenException);
		await expect(service.authorize(auth, McpCapability.READ)).resolves.toMatchObject({
			effectiveCapabilities: [McpCapability.READ],
		});
		expect(clientService.findActiveByToken).toHaveBeenCalledTimes(2);
	});

	it.each([
		['same origin', 'https://panel.example.com', 'panel.example.com'],
		['configured app origin', 'https://panel.example.com', '127.0.0.1:3000'],
		['allowlisted origin', 'https://agent.example.com', 'agent.example.com'],
		['non-browser request', undefined, 'localhost:3000'],
	])('accepts %s', (_label, origin, host) => {
		config.allowedOrigins = ['https://agent.example.com'];

		expect(() => service.validateRequestOrigin(request(origin, host), policy())).not.toThrow();
	});

	it('rejects untrusted origins and hosts', () => {
		config.allowedOrigins = ['https://agent.example.com'];

		expect(() =>
			service.validateRequestOrigin(request('https://evil.example.com', 'panel.example.com'), policy()),
		).toThrow(ForbiddenException);
		expect(() => service.validateRequestOrigin(request(undefined, 'evil.example.com'), policy())).toThrow(
			ForbiddenException,
		);
	});

	function policy(): McpPolicyContext {
		return {
			client,
			config,
			effectiveCapabilities: [],
			installationId: INSTALLATION_ID,
			tokenId: TOKEN_ID,
		};
	}

	function request(origin: string | undefined, host: string): FastifyRequest {
		return {
			headers: { host, ...(origin ? { origin } : {}) },
			protocol: 'https',
		} as FastifyRequest;
	}
});
