import { FastifyReply as Response } from 'fastify';

import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Req,
	Res,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { MODULES_PREFIX } from '../../../app.constants';
import { setLocationHeader } from '../../api/utils/location-header.utils';
import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiForbiddenResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { ReqCreateMcpClientDto, ReqRotateMcpClientTokenDto, ReqUpdateMcpClientDto } from '../dto/mcp-client.dto';
import { MCP_MODULE_API_TAG_NAME, MCP_MODULE_PREFIX } from '../mcp.constants';
import {
	McpClientCredentialResponseModel,
	McpClientResponseModel,
	McpClientsResponseModel,
} from '../models/mcp-client-response.model';
import { McpClientService } from '../services/mcp-client.service';

@ApiTags(MCP_MODULE_API_TAG_NAME)
@Controller('clients')
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class McpClientsController {
	constructor(private readonly clientsService: McpClientService) {}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Get MCP clients',
		description: 'List installation-local MCP client credentials and grants',
		operationId: 'get-mcp-module-clients',
	})
	@ApiSuccessResponse(McpClientsResponseModel, 'MCP clients retrieved successfully')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(): Promise<McpClientsResponseModel> {
		const response = new McpClientsResponseModel();
		response.data = await this.clientsService.findAll();

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Get an MCP client',
		description: 'Retrieve an MCP client by identifier',
		operationId: 'get-mcp-module-client',
	})
	@ApiParam({ name: 'id', description: 'MCP client ID', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(McpClientResponseModel, 'MCP client retrieved successfully')
	@ApiNotFoundResponse('MCP client not found')
	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<McpClientResponseModel> {
		const response = new McpClientResponseModel();
		response.data = await this.clientsService.getOneOrThrow(id);

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Create an MCP client',
		description: 'Create an MCP client and return its credential exactly once',
		operationId: 'create-mcp-module-client',
	})
	@ApiBody({ type: ReqCreateMcpClientDto })
	@ApiCreatedSuccessResponse(McpClientCredentialResponseModel, 'MCP client created successfully')
	@ApiBadRequestResponse('Invalid client data or capability grant')
	@ApiForbiddenResponse('Owner or administrator access required')
	@Post()
	async create(
		@Body() body: ReqCreateMcpClientDto,
		@Req() req: AuthenticatedRequest,
		@Res({ passthrough: true }) res: Response,
	): Promise<McpClientCredentialResponseModel> {
		const creatorId = this.getActorId(req);
		const credential = await this.clientsService.create(body.data, creatorId);
		setLocationHeader(req, res, `${MODULES_PREFIX}/${MCP_MODULE_PREFIX}`, 'clients', credential.client.id);

		const response = new McpClientCredentialResponseModel();
		response.data = credential;

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Update an MCP client',
		description: 'Update client metadata, enabled state, or capability grant',
		operationId: 'update-mcp-module-client',
	})
	@ApiParam({ name: 'id', description: 'MCP client ID', type: 'string', format: 'uuid' })
	@ApiBody({ type: ReqUpdateMcpClientDto })
	@ApiSuccessResponse(McpClientResponseModel, 'MCP client updated successfully')
	@ApiBadRequestResponse('Invalid client data or capability grant')
	@ApiNotFoundResponse('MCP client not found')
	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqUpdateMcpClientDto,
	): Promise<McpClientResponseModel> {
		const response = new McpClientResponseModel();
		response.data = await this.clientsService.update(id, body.data);

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Rotate an MCP client credential',
		description: 'Issue a replacement credential and revoke the previous credential',
		operationId: 'rotate-mcp-module-client-token',
	})
	@ApiParam({ name: 'id', description: 'MCP client ID', type: 'string', format: 'uuid' })
	@ApiBody({ type: ReqRotateMcpClientTokenDto })
	@ApiSuccessResponse(McpClientCredentialResponseModel, 'MCP client credential rotated successfully')
	@ApiNotFoundResponse('MCP client not found')
	@Post(':id/rotate')
	async rotate(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqRotateMcpClientTokenDto,
	): Promise<McpClientCredentialResponseModel> {
		const response = new McpClientCredentialResponseModel();
		response.data = await this.clientsService.rotate(id, body.data);

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Revoke an MCP client',
		description: 'Disable the client and revoke its current credential',
		operationId: 'revoke-mcp-module-client',
	})
	@ApiParam({ name: 'id', description: 'MCP client ID', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(McpClientResponseModel, 'MCP client revoked successfully')
	@ApiNotFoundResponse('MCP client not found')
	@Post(':id/revoke')
	async revoke(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<McpClientResponseModel> {
		const response = new McpClientResponseModel();
		response.data = await this.clientsService.revoke(id);

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Delete an MCP client',
		description: 'Revoke the current credential and delete the client record',
		operationId: 'delete-mcp-module-client',
	})
	@ApiParam({ name: 'id', description: 'MCP client ID', type: 'string', format: 'uuid' })
	@ApiNoContentResponse({ description: 'MCP client deleted successfully' })
	@ApiNotFoundResponse('MCP client not found')
	@HttpCode(204)
	@Delete(':id')
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		await this.clientsService.remove(id);
	}

	private getActorId(req: AuthenticatedRequest): string {
		if (req.auth?.type === 'user') return req.auth.id;
		if (req.auth?.type === 'token' && req.auth.ownerId) return req.auth.ownerId;

		throw new ForbiddenException('The authenticated credential is not associated with a user');
	}
}
