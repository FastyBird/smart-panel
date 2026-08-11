import { FastifyReply } from 'fastify';

import { OAuthError } from '@modelcontextprotocol/server';
import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { RawRoute } from '../../api/decorators/raw-route.decorator';
import { McpEndpoint } from '../decorators/mcp-endpoint.decorator';
import { McpClientGuard } from '../guards/mcp-client.guard';
import { MCP_MODULE_API_TAG_NAME, McpCapability } from '../mcp.constants';
import { McpOAuthProxyPolicyService } from '../services/mcp-oauth-proxy-policy.service';
import { McpOAuthResourceServerService } from '../services/mcp-oauth-resource-server.service';
import { McpOAuthRouteGateService } from '../services/mcp-oauth-route-gate.service';
import { McpPolicyRequest } from '../services/mcp-policy.service';
import { McpPolicyService } from '../services/mcp-policy.service';
import { McpServerService } from '../services/mcp-server.service';

@ApiExcludeController()
@ApiTags(MCP_MODULE_API_TAG_NAME)
@McpEndpoint()
@SkipThrottle()
@UseGuards(McpClientGuard)
@Controller()
export class McpController {
	constructor(
		private readonly serverService: McpServerService,
		private readonly oauthRouteGate: McpOAuthRouteGateService,
		private readonly oauthProxyPolicy: McpOAuthProxyPolicyService,
		private readonly oauthResourceServer: McpOAuthResourceServerService,
		private readonly policyService: McpPolicyService,
	) {}

	@RawRoute()
	@All()
	async handle(@Req() request: McpPolicyRequest, @Res() reply: FastifyReply): Promise<void> {
		if (request.mcpPolicy) {
			await this.serverService.handle(request, reply);
			return;
		}

		this.oauthRouteGate.assertOpen();
		this.oauthProxyPolicy.assertForwardedHeadersTrusted(request);
		this.policyService.validateOAuthRequestOrigin(request);

		try {
			const authInfo = await this.oauthResourceServer.verifyMcpBearerToken(request.headers.authorization, [
				McpCapability.READ,
			]);
			await this.serverService.handleOAuth(request, reply, authInfo);
		} catch (error) {
			if (!OAuthError.isInstance(error)) throw error;

			await this.writeOAuthResponse(reply, this.oauthResourceServer.getBearerChallenge(error, [McpCapability.READ]));
		}
	}

	private async writeOAuthResponse(reply: FastifyReply, response: Response): Promise<void> {
		reply.hijack();
		reply.raw.statusCode = response.status;
		response.headers.forEach((value, name) => reply.raw.setHeader(name, value));
		reply.raw.end(Buffer.from(await response.arrayBuffer()));
	}
}
