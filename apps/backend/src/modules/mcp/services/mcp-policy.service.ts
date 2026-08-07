import { FastifyRequest } from 'fastify';

import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { getEnvValue } from '../../../common/utils/config.utils';
import { TokenOwnerType } from '../../auth/auth.constants';
import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import { ConfigService } from '../../config/services/config.service';
import { McpClientEntity } from '../entities/mcp-client.entity';
import { MCP_MODULE_NAME, McpCapability } from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';

import { McpClientService } from './mcp-client.service';
import { McpInstallationService } from './mcp-installation.service';

export interface McpPolicyContext {
	client: McpClientEntity;
	config: McpConfigModel;
	effectiveCapabilities: McpCapability[];
	installationId: string;
	clientPolicyRevision?: number;
	policyRevision?: number;
	tokenId: string;
}

export interface McpPolicyRequest extends AuthenticatedRequest {
	mcpPolicy?: McpPolicyContext;
}

@Injectable()
export class McpPolicyService {
	constructor(
		private readonly configService: ConfigService,
		private readonly nestConfigService: NestConfigService,
		private readonly clientService: McpClientService,
		private readonly installationService: McpInstallationService,
	) {}

	async resolve(auth: AuthenticatedRequest['auth']): Promise<McpPolicyContext> {
		if (!auth || auth.type !== 'token' || auth.ownerType !== TokenOwnerType.MCP || !auth.ownerId) {
			throw new UnauthorizedException('An MCP credential is required');
		}

		return this.resolveClient(auth.tokenId, auth.ownerId);
	}

	async resolveClient(tokenId: string, clientId: string): Promise<McpPolicyContext> {
		const config = this.configService.getModuleConfig<McpConfigModel>(MCP_MODULE_NAME);

		if (!config.enabled) {
			throw new NotFoundException('MCP endpoint is disabled');
		}

		const client = await this.clientService.findActiveByToken(tokenId, clientId);

		if (!client || !client.enabled || !client.token || client.token.revoked) {
			throw new UnauthorizedException('MCP client is disabled or its credential is no longer active');
		}

		if (client.token.expiresAt && client.token.expiresAt <= new Date()) {
			throw new UnauthorizedException('MCP credential has expired');
		}

		return {
			client,
			config,
			effectiveCapabilities: client.capabilities.filter((capability) => config.capabilities.includes(capability)),
			installationId: await this.installationService.getInstallationId(),
			tokenId,
		};
	}

	async authorize(auth: AuthenticatedRequest['auth'], capability: McpCapability): Promise<McpPolicyContext> {
		const policy = await this.resolve(auth);

		if (!policy.effectiveCapabilities.includes(capability)) {
			throw new ForbiddenException(`MCP capability '${capability}' is not granted`);
		}

		return policy;
	}

	async authorizeClient(tokenId: string, clientId: string, capability: McpCapability): Promise<McpPolicyContext> {
		const policy = await this.resolveClient(tokenId, clientId);

		if (!policy.effectiveCapabilities.includes(capability)) {
			throw new ForbiddenException(`MCP capability '${capability}' is not granted`);
		}

		return policy;
	}

	validateRequestOrigin(request: FastifyRequest, policy: McpPolicyContext): void {
		const host = this.getHeader(request.headers.host);
		const allowedOrigins = new Set(policy.config.allowedOrigins);
		const appOrigin = this.getAppOrigin();
		const allowedHostnames = new Set(['localhost', '127.0.0.1', '[::1]', appOrigin.hostname]);

		for (const origin of allowedOrigins) {
			allowedHostnames.add(new URL(origin).hostname);
		}

		let requestHostname: string;

		try {
			requestHostname = new URL(`http://${host}`).hostname;
		} catch {
			throw new ForbiddenException('Invalid Host header');
		}

		if (!allowedHostnames.has(requestHostname)) {
			throw new ForbiddenException('Host is not allowed for the MCP endpoint');
		}

		const origin = this.getHeader(request.headers.origin);

		if (!origin) {
			return;
		}

		const sameOrigin = `${request.protocol}://${host}`;

		if (origin !== sameOrigin && origin !== appOrigin.origin && !allowedOrigins.has(origin)) {
			throw new ForbiddenException('Origin is not allowed for the MCP endpoint');
		}
	}

	private getAppOrigin(): URL {
		const value = getEnvValue<string>(this.nestConfigService, 'FB_APP_HOST', 'http://localhost');

		try {
			return new URL(value);
		} catch {
			return new URL('http://localhost');
		}
	}

	private getHeader(value: string | string[] | undefined): string {
		return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
	}
}
