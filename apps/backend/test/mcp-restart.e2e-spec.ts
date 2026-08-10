import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { TokenOwnerType } from '../src/modules/auth/auth.constants';
import { AuthenticatedRequest } from '../src/modules/auth/guards/auth.guard';
import { ConfigService } from '../src/modules/config/services/config.service';
import { ModuleConfigMutationRegistryService } from '../src/modules/config/services/module-config-mutation-registry.service';
import { ModulesTypeMapperService } from '../src/modules/config/services/modules-type-mapper.service';
import { PluginsTypeMapperService } from '../src/modules/config/services/plugins-type-mapper.service';
import { McpController } from '../src/modules/mcp/controllers/mcp.controller';
import { UpdateMcpConfigDto } from '../src/modules/mcp/dto/update-config.dto';
import { McpClientEntity } from '../src/modules/mcp/entities/mcp-client.entity';
import { McpClientGuard } from '../src/modules/mcp/guards/mcp-client.guard';
import { MCP_CATALOG_REGISTRAR, MCP_MODULE_NAME } from '../src/modules/mcp/mcp.constants';
import { McpConfigModel } from '../src/modules/mcp/models/config.model';
import { McpAuditService } from '../src/modules/mcp/services/mcp-audit.service';
import { McpClientService } from '../src/modules/mcp/services/mcp-client.service';
import { McpInstallationService } from '../src/modules/mcp/services/mcp-installation.service';
import { McpOAuthResourceServerService } from '../src/modules/mcp/services/mcp-oauth-resource-server.service';
import { McpPolicyService } from '../src/modules/mcp/services/mcp-policy.service';
import { McpServerService } from '../src/modules/mcp/services/mcp-server.service';
import { McpSubscriptionRegistryService } from '../src/modules/mcp/services/mcp-subscription-registry.service';
import { PlatformService } from '../src/modules/platform/services/platform.service';
import { UserRole } from '../src/modules/users/users.constants';

const CLIENT_ID = 'restart-client';
const TOKEN_ID = 'restart-token-id';

@Injectable()
class TestAuthenticationGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

		request.auth = {
			type: 'token',
			tokenId: TOKEN_ID,
			ownerType: TokenOwnerType.MCP,
			ownerId: CLIENT_ID,
			role: UserRole.USER,
		};

		return true;
	}
}

describe('MCP disabled restart', () => {
	it('is reachable while enabled and unreachable after a disabled restart', async () => {
		const configPath = await mkdtemp(join(tmpdir(), 'smart-panel-mcp-restart-'));

		try {
			const first = await bootstrap(configPath);
			const client = new Client(
				{ name: 'restart-e2e-client', version: '1.0.0' },
				{ versionNegotiation: { mode: 'auto' } },
			);
			const firstTransport = new StreamableHTTPClientTransport(first.endpoint, {
				requestInit: { headers: { Authorization: `Bearer ${CLIENT_ID}` } },
			});

			try {
				first.configService.setModuleConfig(
					MCP_MODULE_NAME,
					Object.assign(new UpdateMcpConfigDto(), { enabled: true, capabilities: [] }),
				);
				await client.connect(firstTransport);
				await expect(client.listTools()).resolves.toMatchObject({ tools: [] });
				first.configService.setModuleConfig(
					MCP_MODULE_NAME,
					Object.assign(new UpdateMcpConfigDto(), { enabled: false }),
				);
			} finally {
				await client.close();
				await first.close();
			}

			const restarted = await bootstrap(configPath);

			try {
				expect(restarted.configService.getModuleConfig<McpConfigModel>(MCP_MODULE_NAME).enabled).toBe(false);

				const response = await fetch(restarted.endpoint, {
					method: 'POST',
					headers: {
						Accept: 'application/json, text/event-stream',
						Authorization: `Bearer ${CLIENT_ID}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						jsonrpc: '2.0',
						id: 1,
						method: 'initialize',
						params: {
							protocolVersion: '2026-07-28',
							capabilities: {},
							clientInfo: { name: 'restart-probe', version: '1.0.0' },
						},
					}),
				});

				expect(response.status).toBe(404);
				expect(await response.json()).toMatchObject({ statusCode: 404 });
			} finally {
				await restarted.close();
			}
		} finally {
			await rm(configPath, { recursive: true, force: true });
		}
	});

	async function bootstrap(
		configPath: string,
	): Promise<{ endpoint: URL; configService: ConfigService; close: () => Promise<void> }> {
		const modulesMapper = new ModulesTypeMapperService();
		const pluginsMapper = new PluginsTypeMapperService();
		const nestConfigService = {
			get: jest.fn((key: string) => (key === 'FB_CONFIG_PATH' ? configPath : undefined)),
		} as unknown as NestConfigService;
		const configService = new ConfigService(
			nestConfigService,
			pluginsMapper,
			modulesMapper,
			new ModuleConfigMutationRegistryService(),
			{} as PlatformService,
			{ emit: jest.fn() } as unknown as EventEmitter2,
		);

		modulesMapper.registerMapping({
			type: MCP_MODULE_NAME,
			class: McpConfigModel,
			configDto: UpdateMcpConfigDto,
		});

		const client = {
			id: CLIENT_ID,
			name: 'Restart test client',
			enabled: true,
			capabilities: [],
			tokenId: TOKEN_ID,
			token: { id: TOKEN_ID, revoked: false, expiresAt: new Date(Date.now() + 60_000) },
		} as McpClientEntity;
		const moduleRef = await Test.createTestingModule({
			controllers: [McpController],
			providers: [
				{ provide: APP_GUARD, useClass: TestAuthenticationGuard },
				{ provide: ConfigService, useValue: configService },
				{ provide: NestConfigService, useValue: nestConfigService },
				{ provide: McpClientService, useValue: { findActiveByToken: jest.fn().mockResolvedValue(client) } },
				{
					provide: McpInstallationService,
					useValue: { getInstallationId: jest.fn().mockResolvedValue('restart-installation') },
				},
				{
					provide: McpOAuthResourceServerService,
					useValue: { authorizeAccessToken: jest.fn(), verifyMcpBearerToken: jest.fn() },
				},
				McpAuditService,
				McpClientGuard,
				McpPolicyService,
				McpServerService,
				McpSubscriptionRegistryService,
				{ provide: MCP_CATALOG_REGISTRAR, useValue: { register: () => undefined } },
			],
		}).compile();
		const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

		await app.listen(0, '127.0.0.1');

		return {
			endpoint: new URL('/', await app.getUrl()),
			configService,
			close: async () => {
				await app.get(McpServerService).closeAll();
				await app.close();
			},
		};
	}
});
