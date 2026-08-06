import { FastifyReply } from 'fastify';

import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { RawRoute } from '../../api/decorators/raw-route.decorator';
import { McpEndpoint } from '../decorators/mcp-endpoint.decorator';
import { McpClientGuard } from '../guards/mcp-client.guard';
import { MCP_MODULE_API_TAG_NAME } from '../mcp.constants';
import { McpPolicyRequest } from '../services/mcp-policy.service';
import { McpServerService } from '../services/mcp-server.service';

@ApiExcludeController()
@ApiTags(MCP_MODULE_API_TAG_NAME)
@McpEndpoint()
@SkipThrottle()
@UseGuards(McpClientGuard)
@Controller()
export class McpController {
	constructor(private readonly serverService: McpServerService) {}

	@RawRoute()
	@All()
	async handle(@Req() request: McpPolicyRequest, @Res() reply: FastifyReply): Promise<void> {
		await this.serverService.handle(request, reply);
	}
}
