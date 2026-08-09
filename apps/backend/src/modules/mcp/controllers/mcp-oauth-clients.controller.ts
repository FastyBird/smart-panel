import { FastifyReply as Response } from 'fastify';

import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { MODULES_PREFIX } from '../../../app.constants';
import { setLocationHeader } from '../../api/utils/location-header.utils';
import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { ReqCreateMcpOAuthClientDto, ReqUpdateMcpOAuthClientDto } from '../dto/mcp-oauth-client.dto';
import { MCP_MODULE_API_TAG_NAME, MCP_MODULE_PREFIX } from '../mcp.constants';
import { McpOAuthClientResponseModel, McpOAuthClientsResponseModel } from '../models/mcp-oauth-client-response.model';
import { McpOAuthClientService } from '../services/mcp-oauth-client.service';

@ApiTags(MCP_MODULE_API_TAG_NAME)
@Controller('oauth/clients')
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class McpOAuthClientsController {
	constructor(private readonly clientsService: McpOAuthClientService) {}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Get MCP OAuth clients',
		description: 'List pre-registered public OAuth clients without exposing any authorization artifacts',
		operationId: 'get-mcp-module-oauth-clients',
	})
	@ApiSuccessResponse(McpOAuthClientsResponseModel, 'MCP OAuth clients retrieved successfully')
	@Get()
	async findAll(): Promise<McpOAuthClientsResponseModel> {
		const response = new McpOAuthClientsResponseModel();
		response.data = await this.clientsService.findAll();

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Pre-register an MCP OAuth client',
		description: 'Create a public OAuth client ID with an exact redirect allowlist and no client secret',
		operationId: 'create-mcp-module-oauth-client',
	})
	@ApiBody({ type: ReqCreateMcpOAuthClientDto })
	@ApiCreatedSuccessResponse(McpOAuthClientResponseModel, 'MCP OAuth client created successfully')
	@ApiBadRequestResponse('Invalid redirect URI or scope maximum')
	@ApiForbiddenResponse('Owner or administrator access required')
	@Post()
	async create(
		@Body() body: ReqCreateMcpOAuthClientDto,
		@Req() req: AuthenticatedRequest,
		@Res({ passthrough: true }) res: Response,
	): Promise<McpOAuthClientResponseModel> {
		const client = await this.clientsService.create(body.data, this.getActorId(req));
		setLocationHeader(req, res, `${MODULES_PREFIX}/${MCP_MODULE_PREFIX}`, 'oauth', 'clients', client.id);

		const response = new McpOAuthClientResponseModel();
		response.data = client;

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Update an MCP OAuth client',
		description: 'Replace public-client metadata or authorization limits without creating a client secret',
		operationId: 'update-mcp-module-oauth-client',
	})
	@ApiParam({ name: 'id', description: 'MCP OAuth client record ID', type: 'string', format: 'uuid' })
	@ApiBody({ type: ReqUpdateMcpOAuthClientDto })
	@ApiSuccessResponse(McpOAuthClientResponseModel, 'MCP OAuth client updated successfully')
	@ApiBadRequestResponse('Invalid redirect URI or scope maximum')
	@ApiNotFoundResponse('MCP OAuth client not found')
	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqUpdateMcpOAuthClientDto,
	): Promise<McpOAuthClientResponseModel> {
		const response = new McpOAuthClientResponseModel();
		response.data = await this.clientsService.update(id, body.data);

		return response;
	}

	private getActorId(req: AuthenticatedRequest): string {
		if (req.auth?.type === 'user') return req.auth.id;
		if (req.auth?.type === 'token' && req.auth.ownerId) return req.auth.ownerId;

		throw new ForbiddenException('The authenticated credential is not associated with a user');
	}
}
