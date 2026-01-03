import { Cache } from 'cache-manager';
import { FastifyRequest as Request } from 'fastify';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
	CanActivate,
	ExecutionContext,
	Inject,
	Injectable,
	SetMetadata,
	UnauthorizedException,
	applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { createExtensionLogger } from '../../../common/logger';
import { ApiPublic } from '../../swagger/decorators/api-documentation.decorator';
import { UserEntity } from '../../users/entities/users.entity';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { ACCESS_TOKEN_TYPE, AUTH_MODULE_NAME, TokenOwnerType } from '../auth.constants';
import { AccessTokenEntity, LongLiveTokenEntity } from '../entities/auth.entity';
import { TokensService } from '../services/tokens.service';
import { hashToken } from '../utils/token.utils';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Authenticated user entity (via access token from login flow)
 */
export interface AuthenticatedUser {
	type: 'user';
	id: string;
	role: UserRole;
}

/**
 * Authenticated entity via long-live token (universal for display, user API tokens, third-party, etc.)
 */
export interface AuthenticatedLongLiveToken {
	type: 'token';
	tokenId: string;
	ownerType: TokenOwnerType;
	ownerId: string | null;
	role: UserRole;
}

/**
 * Union type for all authenticated entity types
 */
export type AuthenticatedEntity = AuthenticatedUser | AuthenticatedLongLiveToken;

/**
 * Extended request with authentication info
 */
export interface AuthenticatedRequest extends Request {
	auth?: AuthenticatedEntity;
}

/**
 * Decorator to mark a route as public (no authentication required).
 * Also marks the route as public in Swagger documentation.
 */
export const Public = () => applyDecorators(SetMetadata(IS_PUBLIC_KEY, true), ApiPublic());

@Injectable()
export class AuthGuard implements CanActivate {
	private readonly logger = createExtensionLogger(AUTH_MODULE_NAME, 'AuthGuard');

	constructor(
		private readonly jwtService: JwtService,
		private readonly reflector: Reflector,
		private readonly tokensService: TokensService,
		private readonly usersService: UsersService,
		@Inject(CACHE_MANAGER)
		private readonly cacheManager: Cache,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (isPublic) {
			return true;
		}

		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

		// Try authenticating with JWT (Bearer token)
		const token = this.extractTokenFromHeader(request);

		if (token && (await this.validateToken(request, token))) {
			return true;
		}

		// If auth method didn't work, reject the request
		this.logger.warn('Unauthorized request, missing valid credentials');

		throw new UnauthorizedException('Authentication required');
	}

	private async validateToken(request: AuthenticatedRequest, token: string): Promise<boolean> {
		let payload: { sub?: string; type?: string; role?: string } | null = null;

		try {
			payload = await this.jwtService.verifyAsync(token);
		} catch {
			throw new UnauthorizedException('Invalid or expired token');
		}

		// Check if this is a display token (type: TokenOwnerType.DISPLAY in payload)
		if ((payload.type as TokenOwnerType) === TokenOwnerType.DISPLAY && payload.sub) {
			return this.validateDisplayToken(request, token, payload.sub);
		}

		// Check if this is a user access token (has sub and role, but no type)
		if (payload.sub && !payload.type) {
			return this.validateUserAccessToken(request, token, payload.sub);
		}

		// Try to validate as a long-live token (third-party or user-created)
		return this.validateLongLiveToken(request, token);
	}

	private async validateUserAccessToken(
		request: AuthenticatedRequest,
		token: string,
		userId: string,
	): Promise<boolean> {
		const storedAccessTokens = await this.tokensService.findAllByOwner<AccessTokenEntity>(userId, AccessTokenEntity);

		let storedAccessToken: AccessTokenEntity | null = null;

		for (const accessToken of storedAccessTokens) {
			if (hashToken(token) === accessToken.hashedToken) {
				storedAccessToken = accessToken;
				break;
			}
		}

		if (!storedAccessToken) {
			this.logger.warn('Access token not found in database');
			throw new UnauthorizedException('Token not found');
		}

		if (storedAccessToken.revoked || storedAccessToken.refreshToken.revoked) {
			this.logger.warn('Access token is revoked');
			throw new UnauthorizedException('Token revoked');
		}

		let user: UserEntity;

		try {
			user = await this.usersService.getOneOrThrow(userId);
		} catch (error) {
			const err = error as Error;
			this.logger.warn('Token valid, but user not found', { message: err.message, stack: err.stack });
			throw new UnauthorizedException('Invalid user');
		}

		request.auth = { type: 'user', id: user.id, role: user.role };

		return true;
	}

	private async validateDisplayToken(
		request: AuthenticatedRequest,
		token: string,
		displayId: string,
	): Promise<boolean> {
		// Find the long-live token for this display
		const displayTokens = await this.tokensService.findByOwnerId(displayId, TokenOwnerType.DISPLAY);

		let storedToken: LongLiveTokenEntity | null = null;

		for (const displayToken of displayTokens) {
			if (hashToken(token) === displayToken.hashedToken) {
				storedToken = displayToken;
				break;
			}
		}

		if (!storedToken) {
			this.logger.warn('Display token not found in database');
			throw new UnauthorizedException('Token not found');
		}

		if (storedToken.revoked) {
			this.logger.warn('Display token is revoked');
			throw new UnauthorizedException('Token revoked');
		}

		if (storedToken.expiresAt && storedToken.expiresAt < new Date()) {
			this.logger.warn('Display token is expired');
			throw new UnauthorizedException('Token expired');
		}

		request.auth = {
			type: 'token',
			tokenId: storedToken.id,
			ownerType: storedToken.ownerType,
			ownerId: storedToken.ownerId,
			role: UserRole.USER,
		};

		return true;
	}

	private async validateLongLiveToken(request: AuthenticatedRequest, token: string): Promise<boolean> {
		const storedLongLiveTokens = await this.tokensService.findAll<LongLiveTokenEntity>(LongLiveTokenEntity);

		let storedLongLiveToken: LongLiveTokenEntity | null = null;

		for (const longLiveToken of storedLongLiveTokens) {
			if (hashToken(token) === longLiveToken.hashedToken) {
				storedLongLiveToken = longLiveToken;
				break;
			}
		}

		if (!storedLongLiveToken) {
			this.logger.warn('Long-live token not found');
			throw new UnauthorizedException('Unknown token');
		}

		if (storedLongLiveToken.revoked) {
			this.logger.warn('Long-live token is revoked');
			throw new UnauthorizedException('Token revoked');
		}

		if (storedLongLiveToken.expiresAt && storedLongLiveToken.expiresAt < new Date()) {
			this.logger.warn('Long-live token is expired');
			throw new UnauthorizedException('Token expired');
		}

		// Determine the role based on owner type
		let role = UserRole.USER;

		if (storedLongLiveToken.ownerType === TokenOwnerType.USER && storedLongLiveToken.ownerId) {
			const user = await this.usersService.findOne(storedLongLiveToken.ownerId);
			if (user) {
				role = user.role;
			}
		}

		request.auth = {
			type: 'token',
			tokenId: storedLongLiveToken.id,
			ownerType: storedLongLiveToken.ownerType,
			ownerId: storedLongLiveToken.ownerId,
			role: role,
		};

		return true;
	}

	private extractTokenFromHeader(request: Request): string | undefined {
		const authHeader = request.headers.authorization;

		if (!authHeader) {
			return undefined;
		}

		const [type, token] = authHeader.split(' ');

		return type === ACCESS_TOKEN_TYPE ? token : undefined;
	}
}
