import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { OpenApiResponseInterceptor } from '../src/modules/api/interceptors/open-api-response.interceptor';
import { TransformResponseInterceptor } from '../src/modules/api/interceptors/transform-response.interceptor';
import { McpController } from '../src/modules/mcp/controllers/mcp.controller';
import { McpClientEntity } from '../src/modules/mcp/entities/mcp-client.entity';
import { McpClientGuard } from '../src/modules/mcp/guards/mcp-client.guard';
import { McpCapability } from '../src/modules/mcp/mcp.constants';
import { McpConfigModel } from '../src/modules/mcp/models/config.model';
import { McpPolicyRequest } from '../src/modules/mcp/services/mcp-policy.service';
import { McpServerService } from '../src/modules/mcp/services/mcp-server.service';
import { McpSubscriptionRegistryService } from '../src/modules/mcp/services/mcp-subscription-registry.service';

const AUTH_TOKEN = 'phase-4-client';

@Injectable()
class TestMcpClientGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<McpPolicyRequest>();
		const clientId = request.headers.authorization?.replace(/^Bearer /, '') || AUTH_TOKEN;
		const client = {
			id: clientId,
			name: `Test ${clientId}`,
			enabled: true,
			capabilities: [McpCapability.READ],
			tokenId: `token-${clientId}`,
			token: {
				id: `token-${clientId}`,
				revoked: false,
				expiresAt: new Date(Date.now() + 60_000),
			},
		} as McpClientEntity;

		request.mcpPolicy = {
			client,
			config: Object.assign(new McpConfigModel(), {
				enabled: true,
				capabilities: [McpCapability.READ],
			}),
			effectiveCapabilities: [McpCapability.READ],
			installationId: 'phase-4-installation',
			tokenId: client.tokenId,
		};

		return true;
	}
}

describe('MCP endpoint', () => {
	let app: NestFastifyApplication;
	let endpoint: URL;
	let serverService: McpServerService;
	let subscriptions: McpSubscriptionRegistryService;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [McpController],
			providers: [McpServerService, McpSubscriptionRegistryService],
		})
			.overrideGuard(McpClientGuard)
			.useClass(TestMcpClientGuard)
			.compile();

		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		const reflector = app.get(Reflector);
		app.useGlobalInterceptors(new OpenApiResponseInterceptor(reflector), new TransformResponseInterceptor(reflector));

		await app.listen(0, '127.0.0.1');

		serverService = app.get(McpServerService);
		subscriptions = app.get(McpSubscriptionRegistryService);
		endpoint = new URL('/', await app.getUrl());
	});

	afterEach(async () => {
		await serverService.closeAll();
	});

	afterAll(async () => {
		await app.close();
	});

	it('serves modern discovery and empty tools/resources without response wrapping', async () => {
		const { client, transport } = createClient('modern-client', 'auto');

		try {
			await client.connect(transport);

			const serverVersion = client.getServerVersion();
			expect(serverVersion?.name).toBe('fastybird-smart-panel');
			expect(typeof serverVersion?.version).toBe('string');
			expect(client.getInstructions()).toContain('phase-4-installation');
			expect(client.getInstructions()).toContain('Effective capabilities: read');
			await expect(client.listTools()).resolves.toEqual(expect.objectContaining({ tools: [] }));
			await expect(client.listResources()).resolves.toEqual(expect.objectContaining({ resources: [] }));
		} finally {
			await client.close();
		}
	});

	it('serves the stateless legacy initialization path', async () => {
		const { client, transport } = createClient('legacy-client');

		try {
			await client.connect(transport);

			await expect(client.listTools()).resolves.toEqual(expect.objectContaining({ tools: [] }));
		} finally {
			await client.close();
		}
	});

	it.each(['GET', 'DELETE'])('returns the SDK-defined 405 for legacy %s operations', async (method) => {
		const response = await fetch(endpoint, {
			method,
			headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
		});

		expect(response.status).toBe(405);
	});

	it('rejects unsupported content types before JSON-RPC dispatch', async () => {
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				Accept: 'application/json, text/event-stream',
				Authorization: `Bearer ${AUTH_TOKEN}`,
				'Content-Type': 'text/plain',
			},
			body: '{}',
		});

		expect(response.status).toBe(415);
	});

	it('preserves JSON-RPC errors for malformed requests', async () => {
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				Accept: 'application/json, text/event-stream',
				Authorization: `Bearer ${AUTH_TOKEN}`,
				'Content-Type': 'application/json',
			},
			body: '{}',
		});
		const body = (await response.json()) as { jsonrpc?: string; error?: { code?: number } };

		expect(response.status).toBe(400);
		expect(body).toMatchObject({ jsonrpc: '2.0', error: { code: -32600 } });
	});

	it('delivers targeted list changes and closes only the selected client stream', async () => {
		const first = createClient('client-a', 'auto');
		const second = createClient('client-b', 'auto');
		let resolveNotification!: () => void;
		const notification = new Promise<void>((resolve) => {
			resolveNotification = resolve;
		});

		first.client.setNotificationHandler('notifications/tools/list_changed', () => resolveNotification());

		try {
			await first.client.connect(first.transport);
			await second.client.connect(second.transport);
			const firstSubscription = await first.client.listen({ toolsListChanged: true });
			const secondSubscription = await second.client.listen({ toolsListChanged: true });

			expect(subscriptions.countForClient('client-a')).toBe(1);
			expect(subscriptions.countForClient('client-b')).toBe(1);

			serverService.notifyToolsChanged('client-a');

			await expect(Promise.race([notification, timeout(2_000)])).resolves.toBeUndefined();

			const secondClosedBeforeTargetClose = await Promise.race([
				secondSubscription.closed.then(() => true),
				timeout(50).then(() => false),
			]);

			expect(secondClosedBeforeTargetClose).toBe(false);

			await serverService.closeClient('client-a');

			await expect(firstSubscription.closed).resolves.toBe('remote');
			expect(subscriptions.countForClient('client-a')).toBe(0);
			expect(subscriptions.countForClient('client-b')).toBe(1);

			await secondSubscription.close();
		} finally {
			await first.client.close();
			await second.client.close();
		}
	});

	function createClient(name: string, mode?: 'auto') {
		const client = new Client({ name, version: '1.0.0' }, mode ? { versionNegotiation: { mode } } : undefined);
		const transport = new StreamableHTTPClientTransport(endpoint, {
			requestInit: { headers: { Authorization: `Bearer ${name}` } },
		});

		return { client, transport };
	}

	function timeout(milliseconds: number): Promise<void> {
		return new Promise((resolve) => {
			const timer = setTimeout(resolve, milliseconds);
			timer.unref();
		});
	}
});
