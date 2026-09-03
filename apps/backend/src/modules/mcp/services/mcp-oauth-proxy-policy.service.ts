import { FastifyRequest } from 'fastify';
import { isIP } from 'node:net';

import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { getEnvValue } from '../../../common/utils/config.utils';
import { TrustedProxyRegistryService } from '../../api/services/trusted-proxy-registry.service';

const FORWARDED_HEADERS = ['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-port', 'x-forwarded-proto'];

@Injectable()
export class McpOAuthProxyPolicyService {
	constructor(
		private readonly configService: ConfigService,
		private readonly trustedProxyRegistry: TrustedProxyRegistryService,
	) {}

	assertForwardedHeadersTrusted(request: FastifyRequest): void {
		if (!FORWARDED_HEADERS.some((header) => request.headers[header] !== undefined)) {
			return;
		}

		const immediateProxy = request.raw.socket.remoteAddress ?? '';

		if (!this.isTrustedProxy(immediateProxy)) {
			throw new ForbiddenException('Forwarded headers are not accepted from this proxy');
		}
	}

	// The immediate peer is trusted when it is either explicitly configured
	// via `FB_MCP_OAUTH_TRUSTED_PROXIES` or trusted by the platform-wide
	// `TrustedProxyRegistryService` (e.g. a connected remote-access provider
	// such as Tailscale Serve terminating on this device). The env list keeps
	// working unchanged for operators behind an existing reverse proxy who
	// never enable the remote-access module.
	private isTrustedProxy(peer: string): boolean {
		if (this.getEnvTrustedProxies().has(peer)) {
			return true;
		}

		return this.trustedProxyRegistry.isTrusted(peer);
	}

	private getEnvTrustedProxies(): Set<string> {
		const configured = getEnvValue<string>(this.configService, 'FB_MCP_OAUTH_TRUSTED_PROXIES', '');

		return new Set(
			configured
				.split(',')
				.map((value) => value.trim())
				.filter((value) => isIP(value) !== 0),
		);
	}
}
