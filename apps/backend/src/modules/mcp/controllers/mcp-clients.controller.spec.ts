import { FastifyReply as Response } from 'fastify';
import { v4 as uuid } from 'uuid';

import { MODULES_PREFIX } from '../../../app.constants';
import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import { UserRole } from '../../users/users.constants';
import { CreateMcpClientDto } from '../dto/mcp-client.dto';
import { McpClientEntity } from '../entities/mcp-client.entity';
import { MCP_MODULE_PREFIX, McpCapability } from '../mcp.constants';
import { McpClientCredentialModel } from '../models/mcp-client.model';
import { McpClientService } from '../services/mcp-client.service';

import { McpClientsController } from './mcp-clients.controller';

describe('McpClientsController', () => {
	it('returns the mounted module route in the created client Location header', async () => {
		const creatorId = uuid();
		const clientId = uuid();
		const createDto: CreateMcpClientDto = {
			name: 'Agent',
			capabilities: [McpCapability.READ],
			expiresInDays: 30,
		};
		const credential = {
			client: { id: clientId } as McpClientEntity,
			token: 'raw-mcp-token',
		} as McpClientCredentialModel;
		const create = jest.fn().mockResolvedValue(credential);
		const controller = new McpClientsController({ create } as unknown as McpClientService);
		const request = {
			url: `/api/v1/${MODULES_PREFIX}/${MCP_MODULE_PREFIX}/clients`,
			protocol: 'http',
			hostname: 'localhost',
			headers: { host: 'localhost:3000' },
			socket: { localPort: 3000 },
			auth: { type: 'user', id: creatorId, role: UserRole.ADMIN },
		} as unknown as AuthenticatedRequest;
		const header = jest.fn();
		const response = { header } as unknown as Response;

		const result = await controller.create({ data: createDto }, request, response);

		expect(result.data).toBe(credential);
		expect(create).toHaveBeenCalledWith(createDto, creatorId);
		expect(header).toHaveBeenCalledWith(
			'Location',
			`http://localhost:3000/api/v1/${MODULES_PREFIX}/${MCP_MODULE_PREFIX}/clients/${clientId}`,
		);
	});
});
