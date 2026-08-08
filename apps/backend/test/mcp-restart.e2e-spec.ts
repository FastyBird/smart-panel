import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { McpController } from '../src/modules/mcp/controllers/mcp.controller';
import { McpClientEntity } from '../src/modules/mcp/entities/mcp-client.entity';
import { McpClientGuard } from '../src/modules/mcp/guards/mcp-client.guard';
import { MCP_CATALOG_REGISTRAR } from '../src/modules/mcp/mcp.constants';
import { McpConfigModel } from '../src/modules/mcp/models/config.model';
import { McpAuditService } from '../src/modules/mcp/services/mcp-audit.service';
import { McpPolicyRequest } from '../src/modules/mcp/services/mcp-policy.service';
import { McpServerService } from '../src/modules/mcp/services/mcp-server.service';
import { McpSubscriptionRegistryService } from '../src/modules/mcp/services/mcp-subscription-registry.service';

const CLIENT_ID = 'restart-client';
let enabled = true;

@Injectable()
class RestartPolicyGuard implements CanActivate {
	constructor(private readonly serverService: McpServerService) {}

	canActivate(context: ExecutionContext): boolean {
		if (!enabled) {
			throw new NotFoundException('MCP endpoint is disabled');
		}

		const request = context.switchToHttp().getRequest<McpPolicyRequest>();
		const client = {
			id: CLIENT_ID,
			name: 'Restart test client',
			enabled: true,
			capabilities: [],
			tokenId: 'restart-token-id',
			token: { id: 'restart-token-id', revoked: false, expiresAt: new Date(Date.now() + 60_000) },
		} as McpClientEntity;

		request.mcpPolicy = {
			client,
			clientPolicyRevision: this.serverService.getClientPolicyRevision(client.id),
			config: Object.assign(new McpConfigModel(), { enabled, capabilities: [] }),
			effectiveCapabilities: [],
			installationId: 'restart-installation',
			policyRevision: this.serverService.getPolicyRevision(),
			tokenId: client.tokenId,
		};

		return true;
	}
}

describe('MCP disabled restart', () => {
	it('is reachable while enabled and unreachable after a disabled restart', async () => {
		enabled = true;
		const first = await bootstrap();
		const client = new Client(
			{ name: 'restart-e2e-client', version: '1.0.0' },
			{ versionNegotiation: { mode: 'auto' } },
		);
		const firstTransport = new StreamableHTTPClientTransport(first.endpoint, {
			requestInit: { headers: { Authorization: `Bearer ${CLIENT_ID}` } },
		});

		try {
			await client.connect(firstTransport);
			await expect(client.listTools()).resolves.toMatchObject({ tools: [] });
		} finally {
			await client.close();
			await first.close();
		}

		enabled = false;
		const restarted = await bootstrap();

		try {
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
			enabled = true;
		}
	});

	async function bootstrap(): Promise<{ endpoint: URL; close: () => Promise<void> }> {
		const moduleRef = await Test.createTestingModule({
			controllers: [McpController],
			providers: [
				McpAuditService,
				McpServerService,
				McpSubscriptionRegistryService,
				{ provide: MCP_CATALOG_REGISTRAR, useValue: { register: () => undefined } },
			],
		})
			.overrideGuard(McpClientGuard)
			.useClass(RestartPolicyGuard)
			.compile();
		const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

		await app.listen(0, '127.0.0.1');

		return {
			endpoint: new URL('/', await app.getUrl()),
			close: async () => {
				await app.get(McpServerService).closeAll();
				await app.close();
			},
		};
	}
});
