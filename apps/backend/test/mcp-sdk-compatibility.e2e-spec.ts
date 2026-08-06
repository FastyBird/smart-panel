import { FastifyReply, FastifyRequest } from 'fastify';
import { IncomingMessage } from 'http';
import { z } from 'zod';

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { AuthInfo, McpRequestContext, McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { All, Controller, Req, Res } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { RawRoute } from '../src/modules/api/decorators/raw-route.decorator';
import { OpenApiResponseInterceptor } from '../src/modules/api/interceptors/open-api-response.interceptor';
import { TransformResponseInterceptor } from '../src/modules/api/interceptors/transform-response.interceptor';

const AUTH_TOKEN = 'phase-0-token';
const CLIENT_ID = 'phase-0-client';

type AuthenticatedIncomingMessage = IncomingMessage & { auth?: AuthInfo };

const observedContexts: McpRequestContext[] = [];

const handler = createMcpHandler(
	(context) => {
		observedContexts.push(context);

		const server = new McpServer({
			name: 'smart-panel-mcp-compatibility-spike',
			version: '1.0.0',
		});

		server.registerTool(
			'echo',
			{
				description: 'Returns the supplied message.',
				inputSchema: z.object({ message: z.string() }),
				outputSchema: z.object({ message: z.string() }),
			},
			({ message }) => ({
				content: [{ type: 'text', text: message }],
				structuredContent: { message },
			}),
		);

		return server;
	},
	{
		legacy: 'stateless',
		maxSubscriptions: 4,
	},
);

const nodeHandler = toNodeHandler(handler);

@Controller('mcp-sdk-compatibility')
class McpSdkCompatibilityController {
	@RawRoute()
	@All()
	async handle(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
		const rawRequest = request.raw as AuthenticatedIncomingMessage;

		rawRequest.auth = {
			token: request.headers.authorization?.replace(/^Bearer /, '') ?? '',
			clientId: CLIENT_ID,
			scopes: ['read'],
			extra: { source: 'compatibility-spike' },
		};

		reply.hijack();

		await nodeHandler(rawRequest, reply.raw, request.body);
	}
}

describe('MCP SDK v2 compatibility', () => {
	let app: NestFastifyApplication;
	let endpoint: URL;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [McpSdkCompatibilityController],
		}).compile();

		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

		const reflector = app.get(Reflector);

		app.useGlobalInterceptors(new OpenApiResponseInterceptor(reflector), new TransformResponseInterceptor(reflector));

		await app.listen(0, '127.0.0.1');

		endpoint = new URL('/mcp-sdk-compatibility', await app.getUrl());
	});

	afterEach(() => {
		observedContexts.length = 0;
	});

	afterAll(async () => {
		await handler.close();
		await app.close();
	});

	it('serves the modern protocol through the NestJS Fastify raw response', async () => {
		const client = new Client(
			{ name: 'modern-compatibility-client', version: '1.0.0' },
			{ versionNegotiation: { mode: 'auto' } },
		);
		const transport = new StreamableHTTPClientTransport(endpoint, {
			requestInit: { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } },
		});

		try {
			await client.connect(transport);

			const tools = await client.listTools();
			const result = await client.callTool({ name: 'echo', arguments: { message: 'modern' } });
			const modernContext = observedContexts.find(({ era }) => era === 'modern');

			expect(tools.tools.map(({ name }) => name)).toEqual(['echo']);
			expect(result.structuredContent).toEqual({ message: 'modern' });
			expect(modernContext?.authInfo?.token).toBe(AUTH_TOKEN);
			expect(modernContext?.authInfo?.clientId).toBe(CLIENT_ID);
		} finally {
			await client.close();
		}
	});

	it('serves a legacy client through the stateless compatibility path', async () => {
		const client = new Client({ name: 'legacy-compatibility-client', version: '1.0.0' });
		const transport = new StreamableHTTPClientTransport(endpoint, {
			requestInit: { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } },
		});

		try {
			await client.connect(transport);

			const result = await client.callTool({ name: 'echo', arguments: { message: 'legacy' } });
			const legacyContext = observedContexts.find(({ era }) => era === 'legacy');

			expect(result.structuredContent).toEqual({ message: 'legacy' });
			expect(legacyContext?.authInfo?.token).toBe(AUTH_TOKEN);
			expect(legacyContext?.authInfo?.clientId).toBe(CLIENT_ID);
		} finally {
			await client.close();
		}
	});
});
