import { FastifyReply as Response } from 'fastify';
import { IncomingMessage } from 'node:http';

import { Body, Controller, ForbiddenException, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiConflictResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import {
	ApiBadRequestResponse,
	ApiForbiddenResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { ReqApproveMcpOAuthInteractionDto } from '../dto/mcp-oauth-interaction.dto';
import {
	MCP_MODULE_API_TAG_NAME,
	MCP_OAUTH_INTERACTION_RATE_LIMIT,
	MCP_OAUTH_RATE_LIMIT_TTL_MS,
} from '../mcp.constants';
import {
	McpOAuthInteractionCompletionResponseModel,
	McpOAuthInteractionResponseModel,
} from '../models/mcp-oauth-interaction-response.model';
import { McpOAuthInteractionService } from '../services/mcp-oauth-interaction.service';

@ApiTags(MCP_MODULE_API_TAG_NAME)
@Throttle({ default: { limit: MCP_OAUTH_INTERACTION_RATE_LIMIT, ttl: MCP_OAUTH_RATE_LIMIT_TTL_MS } })
@Controller('oauth/interactions')
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class McpOAuthInteractionsController {
	constructor(private readonly interactionsService: McpOAuthInteractionService) {}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Get an MCP OAuth interaction',
		description: 'Bind a browser interaction to the authenticated owner/admin and return consent details',
		operationId: 'get-mcp-module-oauth-interaction',
	})
	@ApiParam({ name: 'uid', description: 'One-time OAuth interaction identifier', type: 'string' })
	@ApiSuccessResponse(McpOAuthInteractionResponseModel, 'MCP OAuth interaction retrieved successfully')
	@ApiBadRequestResponse('Invalid or incomplete OAuth interaction')
	@ApiForbiddenResponse('Interaction does not belong to the current browser or user')
	@Get(':uid')
	async findOne(
		@Param('uid') uid: string,
		@Req() req: AuthenticatedRequest,
		@Res({ passthrough: true }) res: Response,
	): Promise<McpOAuthInteractionResponseModel> {
		const model = await this.interactionsService.getInteraction(uid, this.getActorId(req), this.getRawRequest(req));
		this.prepareResponse(res, model.setCookies);

		const response = new McpOAuthInteractionResponseModel();
		response.data = model;

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Approve an MCP OAuth interaction',
		description: 'Approve a bounded finite grant and resume the authorization-code flow',
		operationId: 'approve-mcp-module-oauth-interaction',
	})
	@ApiParam({ name: 'uid', description: 'One-time OAuth interaction identifier', type: 'string' })
	@ApiBody({ type: ReqApproveMcpOAuthInteractionDto })
	@ApiSuccessResponse(McpOAuthInteractionCompletionResponseModel, 'MCP OAuth interaction approved successfully')
	@ApiBadRequestResponse('Invalid scope selection or grant lifetime')
	@ApiForbiddenResponse('Interaction does not belong to the current browser or user')
	@ApiConflictResponse({ description: 'Interaction is expired or already completed' })
	@Post(':uid/approve')
	async approve(
		@Param('uid') uid: string,
		@Body() body: ReqApproveMcpOAuthInteractionDto,
		@Req() req: AuthenticatedRequest,
		@Res({ passthrough: true }) res: Response,
	): Promise<McpOAuthInteractionCompletionResponseModel> {
		const completion = await this.interactionsService.approve(
			uid,
			this.getActorId(req),
			body.data,
			this.getRawRequest(req),
		);
		this.prepareResponse(res, completion.setCookies);

		const response = new McpOAuthInteractionCompletionResponseModel();
		response.data = completion;

		return response;
	}

	@ApiOperation({
		tags: [MCP_MODULE_API_TAG_NAME],
		summary: 'Deny an MCP OAuth interaction',
		description: 'Deny the browser interaction and resume with a protocol-correct access_denied response',
		operationId: 'deny-mcp-module-oauth-interaction',
	})
	@ApiParam({ name: 'uid', description: 'One-time OAuth interaction identifier', type: 'string' })
	@ApiSuccessResponse(McpOAuthInteractionCompletionResponseModel, 'MCP OAuth interaction denied successfully')
	@ApiForbiddenResponse('Interaction does not belong to the current browser or user')
	@ApiConflictResponse({ description: 'Interaction is expired or already completed' })
	@Post(':uid/deny')
	async deny(
		@Param('uid') uid: string,
		@Req() req: AuthenticatedRequest,
		@Res({ passthrough: true }) res: Response,
	): Promise<McpOAuthInteractionCompletionResponseModel> {
		const completion = await this.interactionsService.deny(uid, this.getActorId(req), this.getRawRequest(req));
		this.prepareResponse(res, completion.setCookies);

		const response = new McpOAuthInteractionCompletionResponseModel();
		response.data = completion;

		return response;
	}

	private getActorId(req: AuthenticatedRequest): string {
		if (req.auth?.type === 'user') return req.auth.id;
		if (req.auth?.type === 'token' && req.auth.ownerId) return req.auth.ownerId;

		throw new ForbiddenException('The authenticated credential is not associated with a user');
	}

	private getRawRequest(req: AuthenticatedRequest): IncomingMessage {
		return (req as AuthenticatedRequest & { raw: IncomingMessage }).raw;
	}

	private prepareResponse(res: Response, setCookies: string[]): void {
		res.header('cache-control', 'no-store');
		res.header('pragma', 'no-cache');
		if (setCookies.length > 0) res.header('set-cookie', setCookies);
	}
}
