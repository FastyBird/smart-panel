import { Cache } from 'cache-manager';
import { FastifyRequest as Request } from 'fastify';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
	CanActivate,
	ExecutionContext,
	Inject,
	Injectable,
	Logger,
	SetMetadata,
	UnauthorizedException,
	applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { ApiPublic } from '../../swagger/decorators/api-documentation.decorator';
import { UserEntity } from '../../users/entities/users.entity';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { ACCESS_TOKEN_TYPE, TokenOwnerType } from '../auth.constants';
import { AccessTokenEntity, LongLiveTokenEntity } from '../entities/auth.entity';
import { TokensService } from '../services/tokens.service';
import { hashToken } from '../utils/token.utils';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Authenticated user entity
 */
export interface AuthenticatedUser {
	type: 'user';
	id: string;
	role: UserRole;
}

/**
 * Authenticated display entity
 */
export interface AuthenticatedDisplay {
	type: typeof TokenOwnerType.DISPLAY;
	id: string;
}

/**
 * Authenticated third-party entity
 */
export interface AuthenticatedThirdParty {
	type: typeof TokenOwnerType.THIRD_PARTY;
	tokenId: string;
}

/**
 * Union type for all authenticated entity types
 */
export type AuthenticatedEntity = AuthenticatedUser | AuthenticatedDisplay | AuthenticatedThirdParty;

/**
 * Extended request with authentication info
 */
export interface AuthenticatedRequest extends Request {
	auth?: AuthenticatedEntity;
	user?: { id: string | null; role: UserRole }; // Legacy support
}

/**
 * Decorator to mark a route as public (no authentication required).
 * Also marks the route as public in Swagger documentation.
 */
export const Public = () => applyDecorators(SetMetadata(IS_PUBLIC_KEY, true), ApiPublic());

@Injectable()
export class AuthGuard implements CanActivate {
	private readonly logger = new Logger(AuthGuard.name);

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
			this.logger.debug('[AUTH] Route is public, allowing access');

			return true;
		}

		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

		// Try authenticating with JWT (Bearer token)
		const token = this.extractTokenFromHeader(request);

		if (token && (await this.validateToken(request, token))) {
			return true;
		}

		// If auth method didn't work, reject the request
		this.logger.warn('[AUTH] Unauthorized request, missing valid credentials');

		throw new UnauthorizedException('Authentication required');
	}

	private async validateToken(request: AuthenticatedRequest, token: string): Promise<boolean> {
		let payload: { sub?: string; type?: string; role?: string } | null = null;

		try {
			payload = await this.jwtService.verifyAsync(token);
		} catch (error) {
			const err = error as Error;

			this.logger.debug('[AUTH] JWT validation failed', { message: err.message, stack: err.stack });

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
			this.logger.warn('[AUTH] Access token not found in database');
			throw new UnauthorizedException('Token not found');
		}

		if (storedAccessToken.revoked || storedAccessToken.refreshToken.revoked) {
			this.logger.warn('[AUTH] Access token is revoked');
			throw new UnauthorizedException('Token revoked');
		}

		let user: UserEntity;

		try {
			user = await this.usersService.getOneOrThrow(userId);
		} catch (error) {
			const err = error as Error;
			this.logger.warn('[AUTH] Token valid, but user not found', { message: err.message, stack: err.stack });
			throw new UnauthorizedException('Invalid user');
		}

		// Set new auth format
		request.auth = { type: 'user', id: user.id, role: user.role };
		// Legacy support
		request['user'] = { id: user.id, role: user.role };

		this.logger.debug(`[AUTH] User authentication successful for user=${user.id}`);

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
			this.logger.warn('[AUTH] Display token not found in database');
			throw new UnauthorizedException('Token not found');
		}

		if (storedToken.revoked) {
			this.logger.warn('[AUTH] Display token is revoked');
			throw new UnauthorizedException('Token revoked');
		}

		if (storedToken.expiresAt && storedToken.expiresAt < new Date()) {
			this.logger.warn('[AUTH] Display token is expired');
			throw new UnauthorizedException('Token expired');
		}

		// Set new auth format
		request.auth = { type: TokenOwnerType.DISPLAY, id: displayId };
		// Legacy support - treat display as a special user type for backwards compatibility
		request['user'] = { id: displayId, role: UserRole.USER };

		this.logger.debug(`[AUTH] Display authentication successful for display=${displayId}`);

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
			this.logger.warn('[AUTH] Long-live token not found');
			throw new UnauthorizedException('Unknown token');
		}

		if (storedLongLiveToken.revoked) {
			this.logger.warn('[AUTH] Long-live token is revoked');
			throw new UnauthorizedException('Token revoked');
		}

		if (storedLongLiveToken.expiresAt && storedLongLiveToken.expiresAt < new Date()) {
			this.logger.warn('[AUTH] Long-live token is expired');
			throw new UnauthorizedException('Token expired');
		}

		// Handle based on owner type
		switch (storedLongLiveToken.ownerType) {
			case TokenOwnerType.DISPLAY:
				if (!storedLongLiveToken.ownerId) {
					throw new UnauthorizedException('Invalid display token');
				}
				request.auth = { type: TokenOwnerType.DISPLAY, id: storedLongLiveToken.ownerId };
				request['user'] = { id: storedLongLiveToken.ownerId, role: UserRole.USER };
				this.logger.debug(`[AUTH] Display long-live token authentication successful`);
				break;

			case TokenOwnerType.USER:
				if (storedLongLiveToken.ownerId) {
					const user = await this.usersService.findOne(storedLongLiveToken.ownerId);
					if (user) {
						request.auth = { type: 'user', id: user.id, role: user.role };
						request['user'] = { id: user.id, role: user.role };
					} else {
						request.auth = { type: TokenOwnerType.THIRD_PARTY, tokenId: storedLongLiveToken.id };
						request['user'] = { id: null, role: UserRole.USER };
					}
				} else {
					request.auth = { type: TokenOwnerType.THIRD_PARTY, tokenId: storedLongLiveToken.id };
					request['user'] = { id: null, role: UserRole.USER };
				}
				this.logger.debug(`[AUTH] User long-live token authentication successful`);
				break;

			case TokenOwnerType.THIRD_PARTY:
			default:
				request.auth = { type: TokenOwnerType.THIRD_PARTY, tokenId: storedLongLiveToken.id };
				request['user'] = { id: null, role: UserRole.USER };
				this.logger.debug(`[AUTH] Third-party long-live token authentication successful`);
				break;
		}

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
