import { FastifyReply as Response } from 'fastify';
import { IncomingMessage } from 'node:http';
import { v4 as uuid } from 'uuid';

import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';

import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import { UserRole } from '../../users/users.constants';
import { MCP_OAUTH_INTERACTION_RATE_LIMIT, MCP_OAUTH_RATE_LIMIT_TTL_MS, McpOAuthScope } from '../mcp.constants';
import {
	McpOAuthInteractionAction,
	McpOAuthInteractionCompletionModel,
	McpOAuthInteractionModel,
} from '../models/mcp-oauth-interaction.model';
import { McpOAuthInteractionService } from '../services/mcp-oauth-interaction.service';

import { McpOAuthInteractionsController } from './mcp-oauth-interactions.controller';

describe('McpOAuthInteractionsController', () => {
	const actorId = uuid();
	const uid = 'opaque-interaction-identifier-123456';
	const raw = {} as IncomingMessage;
	const request = {
		auth: { type: 'user', id: actorId, role: UserRole.ADMIN },
		raw,
	} as unknown as AuthenticatedRequest;
	const header = jest.fn();
	const response = { header } as unknown as Response;
	const interaction = Object.assign(new McpOAuthInteractionModel(), {
		action: McpOAuthInteractionAction.CONSENT,
		requestedScopes: [McpOAuthScope.READ],
	});
	const completion = Object.assign(new McpOAuthInteractionCompletionModel(), {
		redirectTo: '/auth/resume',
		setCookies: ['_interaction=next; HttpOnly'],
	});
	const service = {
		getInteraction: jest.fn(() => Promise.resolve(interaction)),
		approve: jest.fn(() => Promise.resolve(completion)),
		deny: jest.fn(() => Promise.resolve(completion)),
	};
	const controller = new McpOAuthInteractionsController(service as unknown as McpOAuthInteractionService);

	beforeEach(() => jest.clearAllMocks());

	it('marks interaction responses no-store', async () => {
		const result = await controller.findOne(uid, request, response);

		expect(result.data).toBe(interaction);
		expect(service.getInteraction).toHaveBeenCalledWith(uid, actorId, raw);
		expect(header).toHaveBeenCalledWith('cache-control', 'no-store');
		expect(header).toHaveBeenCalledWith('pragma', 'no-cache');
	});

	it('forwards provider cookies after approval without returning them in the public model', async () => {
		const body = { data: { scopes: [McpOAuthScope.READ], expiresInDays: 30 } };
		const result = await controller.approve(uid, body, request, response);

		expect(result.data.redirectTo).toBe('/auth/resume');
		expect(service.approve).toHaveBeenCalledWith(uid, actorId, body.data, raw);
		expect(header).toHaveBeenCalledWith('set-cookie', completion.setCookies);
	});

	it('applies the dedicated interaction throttle', () => {
		expect(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, McpOAuthInteractionsController)).toBe(
			MCP_OAUTH_INTERACTION_RATE_LIMIT,
		);
		expect(Reflect.getMetadata(`${THROTTLER_TTL}default`, McpOAuthInteractionsController)).toBe(
			MCP_OAUTH_RATE_LIMIT_TTL_MS,
		);
	});
});
