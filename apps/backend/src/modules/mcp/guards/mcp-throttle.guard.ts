import { FastifyRequest } from 'fastify';

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectThrottlerStorage, ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';

import { TokenOwnerType } from '../../auth/auth.constants';
import { extractAccessTokenFromHeader, hashToken } from '../../auth/utils/token.utils';
import {
	IS_MCP_ENDPOINT_KEY,
	MCP_AUTHENTICATED_RATE_LIMIT,
	MCP_RATE_LIMIT_TTL_MS,
	MCP_UNAUTHENTICATED_RATE_LIMIT,
} from '../mcp.constants';
import { McpInstallationService } from '../services/mcp-installation.service';

interface McpJwtPayload {
	sub?: string;
	type?: TokenOwnerType;
}

interface VerifyCacheEntry {
	clientId: string | null;
	expiresAt: number;
}

const VERIFY_CACHE_TTL_MS = 60_000;
const VERIFY_CACHE_MAX_ENTRIES = 1_000;
const MAX_VERIFY_PER_SEC = 200;

@Injectable()
export class McpThrottleGuard implements CanActivate {
	private readonly verifyCache = new Map<string, VerifyCacheEntry>();
	private verifyTokens = MAX_VERIFY_PER_SEC;
	private verifyTokensRefilledAt = Date.now();

	constructor(
		private readonly reflector: Reflector,
		private readonly jwtService: JwtService,
		private readonly installationService: McpInstallationService,
		@InjectThrottlerStorage()
		private readonly storage: ThrottlerStorage,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const isMcpEndpoint = this.reflector.getAllAndOverride<boolean>(IS_MCP_ENDPOINT_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (!isMcpEndpoint || context.getType() !== 'http') {
			return true;
		}

		const request = context.switchToHttp().getRequest<FastifyRequest>();
		const clientId = await this.getVerifiedClientId(request);
		const limit = clientId ? MCP_AUTHENTICATED_RATE_LIMIT : MCP_UNAUTHENTICATED_RATE_LIMIT;
		const key = clientId ? `mcp-client:${clientId}` : `mcp-ip:${request.ip}`;
		const result = await this.storage.increment(key, MCP_RATE_LIMIT_TTL_MS, limit, MCP_RATE_LIMIT_TTL_MS, 'mcp');

		if (result.isBlocked) {
			throw new ThrottlerException();
		}

		return true;
	}

	private async getVerifiedClientId(request: FastifyRequest): Promise<string | null> {
		const token = extractAccessTokenFromHeader(request);

		if (!token) {
			return null;
		}

		const decoded = this.safeDecode(token);

		if (!decoded || decoded.type !== TokenOwnerType.MCP || !decoded.sub) {
			return null;
		}

		const cached = this.readVerifyCache(token);

		if (cached !== undefined) {
			return cached;
		}

		if (!this.tryConsumeVerifyToken()) {
			return null;
		}

		try {
			const verified = await this.jwtService.verifyAsync<McpJwtPayload>(token, {
				audience: await this.installationService.getAudience(),
			});

			const clientId = verified.type === TokenOwnerType.MCP && verified.sub ? verified.sub : null;
			this.writeVerifyCache(token, clientId);

			return clientId;
		} catch {
			this.writeVerifyCache(token, null);
			return null;
		}
	}

	private safeDecode(token: string): McpJwtPayload | null {
		try {
			const decoded: unknown = this.jwtService.decode(token);

			return typeof decoded === 'object' && decoded !== null ? (decoded as McpJwtPayload) : null;
		} catch {
			return null;
		}
	}

	private tryConsumeVerifyToken(): boolean {
		const now = Date.now();
		const elapsedSeconds = (now - this.verifyTokensRefilledAt) / 1000;
		this.verifyTokens = Math.min(MAX_VERIFY_PER_SEC, this.verifyTokens + elapsedSeconds * MAX_VERIFY_PER_SEC);
		this.verifyTokensRefilledAt = now;

		if (this.verifyTokens < 1) {
			return false;
		}

		this.verifyTokens -= 1;

		return true;
	}

	private readVerifyCache(token: string): string | null | undefined {
		const key = hashToken(token);
		const entry = this.verifyCache.get(key);

		if (!entry) {
			return undefined;
		}

		if (entry.expiresAt <= Date.now()) {
			this.verifyCache.delete(key);
			return undefined;
		}

		return entry.clientId;
	}

	private writeVerifyCache(token: string, clientId: string | null): void {
		const key = hashToken(token);

		if (this.verifyCache.size >= VERIFY_CACHE_MAX_ENTRIES && !this.verifyCache.has(key)) {
			for (const oldestKey of this.verifyCache.keys()) {
				this.verifyCache.delete(oldestKey);
				break;
			}
		}

		this.verifyCache.set(key, { clientId, expiresAt: Date.now() + VERIFY_CACHE_TTL_MS });
	}
}
