import { FastifyRequest } from 'fastify';
import { isIP } from 'node:net';

import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { getEnvValue } from '../../../common/utils/config.utils';

const FORWARDED_HEADERS = ['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-port', 'x-forwarded-proto'];

@Injectable()
export class McpOAuthProxyPolicyService {
	constructor(private readonly configService: ConfigService) {}

	assertForwardedHeadersTrusted(request: FastifyRequest): void {
		if (!FORWARDED_HEADERS.some((header) => request.headers[header] !== undefined)) {
			return;
		}

		const immediateProxy = request.raw.socket.remoteAddress ?? '';
		const trustedProxies = this.getTrustedProxies();

		if (!trustedProxies.has(immediateProxy)) {
			throw new ForbiddenException('Forwarded headers are not accepted from this proxy');
		}
	}

	private getTrustedProxies(): Set<string> {
		const configured = getEnvValue<string>(this.configService, 'FB_MCP_OAUTH_TRUSTED_PROXIES', '');

		return new Set(
			configured
				.split(',')
				.map((value) => value.trim())
				.filter((value) => isIP(value) !== 0),
		);
	}
}
