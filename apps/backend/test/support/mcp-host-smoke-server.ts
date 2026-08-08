import Fastify from 'fastify';
import { IncomingMessage } from 'http';
import { z } from 'zod';

import { toNodeHandler } from '@modelcontextprotocol/node';
import { AuthInfo, McpServer, createMcpHandler } from '@modelcontextprotocol/server';

const TOKEN = 'phase-11-host-smoke-token';
type AuthenticatedIncomingMessage = IncomingMessage & { auth?: AuthInfo };

const handler = createMcpHandler(
	() => {
		const server = new McpServer({ name: 'smart-panel-mcp-host-smoke', version: '1.0.0' });

		server.registerTool(
			'get_installation_identity',
			{
				description: 'Returns the identity of the compatibility smoke-test installation.',
				inputSchema: z.object({}),
				outputSchema: z.object({ installation: z.string() }),
			},
			() => ({
				content: [{ type: 'text', text: 'MCP Phase 11 host smoke test' }],
				structuredContent: { installation: 'MCP Phase 11 host smoke test' },
			}),
		);

		return server;
	},
	{ legacy: 'stateless' },
);
const nodeHandler = toNodeHandler(handler);
const app = Fastify();

app.all('/', async (request, reply) => {
	if (request.headers.authorization !== `Bearer ${TOKEN}`) {
		await reply.code(401).send({ error: 'Unauthorized' });

		return;
	}

	const rawRequest = request.raw as AuthenticatedIncomingMessage;

	rawRequest.auth = {
		token: TOKEN,
		clientId: 'phase-11-host-client',
		scopes: ['read'],
		extra: { installationId: 'phase-11-host-smoke' },
	};
	reply.hijack();
	await nodeHandler(rawRequest, reply.raw, request.body);
});

async function main(): Promise<void> {
	const address = await app.listen({ host: '127.0.0.1', port: 0 });

	process.stdout.write(
		`${JSON.stringify({ endpoint: `${address}/`, tokenEnvironmentVariable: 'MCP_PHASE_11_TOKEN' })}\n`,
	);

	await new Promise<void>((resolve) => {
		process.once('SIGINT', resolve);
		process.once('SIGTERM', resolve);
	});
	await handler.close();
	await app.close();
}

void main();
