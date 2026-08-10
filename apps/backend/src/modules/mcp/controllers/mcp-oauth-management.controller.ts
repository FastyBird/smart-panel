import {
	Body,
	Controller,
	ForbiddenException,
	Get,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Req,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import {
	ApiBadRequestResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { ReqUpdateMcpOAuthGrantDto } from '../dto/mcp-oauth-grant.dto';
import { MCP_MODULE_API_TAG_NAME } from '../mcp.constants';
import {
	McpOAuthAccessTokenResponseModel,
	McpOAuthAccessTokensResponseModel,
	McpOAuthGrantResponseModel,
	McpOAuthGrantsResponseModel,
	McpOAuthRefreshFamiliesResponseModel,
	McpOAuthRefreshFamilyResponseModel,
} from '../models/mcp-oauth-management-response.model';
import { McpOAuthManagementService } from '../services/mcp-oauth-management.service';

@ApiTags(MCP_MODULE_API_TAG_NAME)
@Controller('oauth')
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class McpOAuthManagementController {
	constructor(private readonly managementService: McpOAuthManagementService) {}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Get MCP OAuth grants',
		description: 'List OAuth consent grants without exposing provider identifiers or token material',
		operationId: 'get-mcp-module-oauth-grants',
	})
	@ApiSuccessResponse(McpOAuthGrantsResponseModel, 'MCP OAuth grants retrieved successfully')
	@Get('grants')
	async findGrants(): Promise<McpOAuthGrantsResponseModel> {
		const response = new McpOAuthGrantsResponseModel();
		response.data = await this.managementService.findGrants();

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Get an MCP OAuth grant',
		description: 'Inspect one OAuth consent grant without exposing provider identifiers or token material',
		operationId: 'get-mcp-module-oauth-grant',
	})
	@ApiParam({ name: 'id', description: 'OAuth grant management identifier', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(McpOAuthGrantResponseModel, 'MCP OAuth grant retrieved successfully')
	@ApiNotFoundResponse('MCP OAuth grant not found')
	@Get('grants/:id')
	async findGrant(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<McpOAuthGrantResponseModel> {
		const response = new McpOAuthGrantResponseModel();
		response.data = await this.managementService.getGrant(id);

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Reduce MCP OAuth grant scopes',
		description:
			'Replace the approved scopes with a subset and close only subscriptions whose effective scopes contract',
		operationId: 'update-mcp-module-oauth-grant',
	})
	@ApiParam({ name: 'id', description: 'OAuth grant management identifier', type: 'string', format: 'uuid' })
	@ApiBody({ type: ReqUpdateMcpOAuthGrantDto })
	@ApiSuccessResponse(McpOAuthGrantResponseModel, 'MCP OAuth grant scopes updated successfully')
	@ApiBadRequestResponse('Approved scopes must be a non-empty subset of the existing grant')
	@ApiNotFoundResponse('MCP OAuth grant not found')
	@Patch('grants/:id')
	async updateGrant(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqUpdateMcpOAuthGrantDto,
		@Req() req: AuthenticatedRequest,
	): Promise<McpOAuthGrantResponseModel> {
		const response = new McpOAuthGrantResponseModel();
		response.data = await this.managementService.updateGrant(id, body.data, this.getActorId(req));

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Revoke an MCP OAuth grant',
		description: 'Revoke the grant and its artifacts, then close only subscriptions bound to that grant',
		operationId: 'revoke-mcp-module-oauth-grant',
	})
	@ApiParam({ name: 'id', description: 'OAuth grant management identifier', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(McpOAuthGrantResponseModel, 'MCP OAuth grant revoked successfully')
	@ApiNotFoundResponse('MCP OAuth grant not found')
	@Post('grants/:id/revoke')
	async revokeGrant(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Req() req: AuthenticatedRequest,
	): Promise<McpOAuthGrantResponseModel> {
		const response = new McpOAuthGrantResponseModel();
		response.data = await this.managementService.revokeGrant(id, this.getActorId(req));

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Get active MCP OAuth access tokens',
		description: 'List active access tokens by non-secret management identifier',
		operationId: 'get-mcp-module-oauth-access-tokens',
	})
	@ApiSuccessResponse(McpOAuthAccessTokensResponseModel, 'MCP OAuth access tokens retrieved successfully')
	@Get('access-tokens')
	async findAccessTokens(): Promise<McpOAuthAccessTokensResponseModel> {
		const response = new McpOAuthAccessTokensResponseModel();
		response.data = await this.managementService.findAccessTokens();

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Get an active MCP OAuth access token',
		description: 'Inspect one active access token by its non-secret management identifier',
		operationId: 'get-mcp-module-oauth-access-token',
	})
	@ApiParam({ name: 'id', description: 'Access-token management identifier', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(McpOAuthAccessTokenResponseModel, 'MCP OAuth access token retrieved successfully')
	@ApiNotFoundResponse('MCP OAuth access token not found')
	@Get('access-tokens/:id')
	async findAccessToken(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<McpOAuthAccessTokenResponseModel> {
		const response = new McpOAuthAccessTokenResponseModel();
		response.data = await this.managementService.getAccessToken(id);

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Revoke an MCP OAuth access token',
		description: 'Revoke one access token and close only the subscription bound to that token',
		operationId: 'revoke-mcp-module-oauth-access-token',
	})
	@ApiParam({ name: 'id', description: 'Access-token management identifier', type: 'string', format: 'uuid' })
	@ApiNoContentResponse({ description: 'MCP OAuth access token revoked successfully' })
	@ApiNotFoundResponse('MCP OAuth access token not found')
	@HttpCode(204)
	@Post('access-tokens/:id/revoke')
	async revokeAccessToken(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Req() req: AuthenticatedRequest,
	): Promise<void> {
		await this.managementService.revokeAccessToken(id, this.getActorId(req));
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Get active MCP OAuth refresh families',
		description: 'List active refresh-token families by non-secret management identifier',
		operationId: 'get-mcp-module-oauth-refresh-families',
	})
	@ApiSuccessResponse(McpOAuthRefreshFamiliesResponseModel, 'MCP OAuth refresh families retrieved successfully')
	@Get('refresh-families')
	async findRefreshFamilies(): Promise<McpOAuthRefreshFamiliesResponseModel> {
		const response = new McpOAuthRefreshFamiliesResponseModel();
		response.data = await this.managementService.findRefreshFamilies();

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Get an active MCP OAuth refresh family',
		description: 'Inspect one active refresh-token family by its non-secret management identifier',
		operationId: 'get-mcp-module-oauth-refresh-family',
	})
	@ApiParam({ name: 'id', description: 'Refresh-family management identifier', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(McpOAuthRefreshFamilyResponseModel, 'MCP OAuth refresh family retrieved successfully')
	@ApiNotFoundResponse('MCP OAuth refresh family not found')
	@Get('refresh-families/:id')
	async findRefreshFamily(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<McpOAuthRefreshFamilyResponseModel> {
		const response = new McpOAuthRefreshFamilyResponseModel();
		response.data = await this.managementService.getRefreshFamily(id);

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Revoke an MCP OAuth refresh family',
		description: 'Revoke a refresh family and its access tokens, then close only subscriptions bound to that family',
		operationId: 'revoke-mcp-module-oauth-refresh-family',
	})
	@ApiParam({ name: 'id', description: 'Refresh-family management identifier', type: 'string', format: 'uuid' })
	@ApiNoContentResponse({ description: 'MCP OAuth refresh family revoked successfully' })
	@ApiNotFoundResponse('MCP OAuth refresh family not found')
	@HttpCode(204)
	@Post('refresh-families/:id/revoke')
	async revokeRefreshFamily(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Req() req: AuthenticatedRequest,
	): Promise<void> {
		await this.managementService.revokeRefreshFamily(id, this.getActorId(req));
	}

	private getActorId(req: AuthenticatedRequest): string {
		if (req.auth?.type === 'user') return req.auth.id;
		if (req.auth?.type === 'token' && req.auth.ownerId) return req.auth.ownerId;

		throw new ForbiddenException('The authenticated credential is not associated with a user');
	}
}
