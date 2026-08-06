import { FastifyReply } from 'fastify';

import { UnauthorizedException } from '@nestjs/common';

import { McpPolicyRequest } from './mcp-policy.service';
import { McpServerService } from './mcp-server.service';
import { McpSubscriptionHandle, McpSubscriptionRegistryService } from './mcp-subscription-registry.service';

describe('McpServerService policy revision', () => {
	let service: McpServerService;
	let subscriptions: { closeAll: jest.Mock; closeClient: jest.Mock };

	beforeEach(() => {
		subscriptions = {
			closeAll: jest.fn(),
			closeClient: jest.fn(),
		};
		service = new McpServerService(subscriptions as unknown as McpSubscriptionRegistryService);
	});

	it('invalidates in-flight policies before closing a client', async () => {
		const revision = service.getPolicyRevision();

		await service.closeClient('client-id');

		expect(service.getPolicyRevision()).toBe(revision + 1);
		expect(subscriptions.closeClient).toHaveBeenCalledWith('client-id');
	});

	it('rejects a request whose policy was resolved before cleanup', async () => {
		const request = {
			headers: { authorization: 'Bearer token' },
			mcpPolicy: {
				client: { id: 'client-id' },
				policyRevision: service.getPolicyRevision(),
			},
		} as unknown as McpPolicyRequest;

		await service.closeClient('client-id');

		await expect(service.handle(request, {} as FastifyReply)).rejects.toThrow(
			new UnauthorizedException('MCP request policy is no longer current'),
		);
	});

	it('invalidates in-flight policies before closing all clients', async () => {
		const revision = service.getPolicyRevision();

		await service.closeAll();

		expect(service.getPolicyRevision()).toBe(revision + 1);
		expect(subscriptions.closeAll).toHaveBeenCalledTimes(1);
	});

	it('refreshes the idle deadline when subscription traffic is forwarded', async () => {
		const touch = jest.fn();
		const close = jest.fn();
		const upstream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array([1]));
				controller.close();
			},
		});
		const response = new Response(upstream, { headers: { 'content-type': 'text/event-stream' } });
		const subscription = { close, touch } as unknown as McpSubscriptionHandle;
		const tracked = (
			service as unknown as {
				trackSubscriptionResponse(response: Response, subscription: McpSubscriptionHandle): Response;
			}
		).trackSubscriptionResponse(response, subscription);
		const reader = tracked.body?.getReader();

		await expect(reader?.read()).resolves.toEqual({ done: false, value: new Uint8Array([1]) });
		expect(touch).toHaveBeenCalledTimes(1);
		expect(close).not.toHaveBeenCalled();

		await expect(reader?.read()).resolves.toEqual({ done: true, value: undefined });
		expect(close).toHaveBeenCalledTimes(1);
	});
});
