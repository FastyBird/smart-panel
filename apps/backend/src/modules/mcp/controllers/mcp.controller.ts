import { FastifyReply } from 'fastify';

import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { RawRoute } from '../../api/decorators/raw-route.decorator';
import { McpEndpoint } from '../decorators/mcp-endpoint.decorator';
import { McpClientGuard } from '../guards/mcp-client.guard';
import { McpPolicyRequest } from '../services/mcp-policy.service';
import { McpServerService } from '../services/mcp-server.service';

@ApiExcludeController()
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
