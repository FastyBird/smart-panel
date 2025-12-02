import bcrypt from 'bcrypt';
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
import { ACCESS_TOKEN_TYPE, DISPLAY_SECRET_CACHE_KEY, DISPLAY_SECRET_HEADER } from '../auth.constants';
import { AccessTokenEntity, LongLiveTokenEntity } from '../entities/auth.entity';
import { TokensService } from '../services/tokens.service';
import { hashToken } from '../utils/token.utils';

export const IS_PUBLIC_KEY = 'isPublic';

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

		const request = context.switchToHttp().getRequest<Request>();

		// First, try authenticating with JWT
		const token = this.extractTokenFromHeader(request);

		if (token && (await this.validateJwt(request, token))) {
			return true;
		}

		// If no JWT, check for x-display-secret header
		const displaySecret = request.headers[DISPLAY_SECRET_HEADER] as string;

		if (displaySecret && (await this.validateDisplaySecret(request, displaySecret))) {
			return true;
		}

		// If neither auth method worked, reject the request
		this.logger.warn('[AUTH] Unauthorized request, missing valid credentials');

		throw new UnauthorizedException('Authentication required');
	}

	private async validateJwt(request: Request, token: string): Promise<boolean> {
		let user: UserEntity;

		let payload: { sub?: string; role: string } | null = null;

		try {
			payload = await this.jwtService.verifyAsync(token);
		} catch (error) {
			const err = error as Error;

			this.logger.debug('[AUTH] JWT authentication failed', { message: err.message, stack: err.stack });

			throw new UnauthorizedException('Invalid or expired token');
		}

		if (payload.sub) {
			const storedAccessTokens = await this.tokensService.findAllByOwner<AccessTokenEntity>(
				payload.sub,
				AccessTokenEntity,
			);

			let storedAccessToken: AccessTokenEntity | null = null;

			for (const accessToken of storedAccessTokens) {
				if (hashToken(token) === accessToken.hashedToken) {
					storedAccessToken = accessToken;

					break;
				}
			}

			if (!storedAccessToken) {
				this.logger.warn('[AUTH] JWT token not exists');

				throw new UnauthorizedException('Token not found');
			}

			if (storedAccessToken.revoked || storedAccessToken.refreshToken.revoked) {
				this.logger.warn('[AUTH] JWT token is revoked');

				throw new UnauthorizedException('Token revoked');
			}

			try {
				user = await this.usersService.getOneOrThrow(payload.sub);
			} catch (error) {
				const err = error as Error;

				this.logger.warn('[AUTH] JWT token valid, but user not found', { message: err.message, stack: err.stack });

				throw new UnauthorizedException('Invalid user');
			}

			request['user'] = { id: user.id, role: user.role };

			this.logger.debug(`[AUTH] JWT authentication successful for user=${user.id}`);

			return true;
		}

		const storedLongLiveTokens = await this.tokensService.findAll<LongLiveTokenEntity>(LongLiveTokenEntity);

		let storedLongLiveToken: LongLiveTokenEntity | null = null;

		for (const longLiveToken of storedLongLiveTokens) {
			if (hashToken(token) === longLiveToken.hashedToken) {
				storedLongLiveToken = longLiveToken;

				break;
			}
		}

		if (storedLongLiveToken) {
			request['user'] = { id: null, role: UserRole.USER };

			this.logger.debug('[AUTH] JWT authentication successful for long live token');

			return true;
		}

		throw new UnauthorizedException('Unknown token');
	}

	private async validateDisplaySecret(request: Request, providedSecret: string): Promise<boolean> {
		let usersSecrets: string[] | null = null;

		try {
			usersSecrets = await this.cacheManager.get<string[]>(DISPLAY_SECRET_CACHE_KEY);
		} catch (error) {
			const err = error as Error;

			this.logger.error('[AUTH] Failed to fetch authentication data', { message: err.message, stack: err.stack });
		}

		if (usersSecrets === null || usersSecrets.length === 0) {
			this.logger.debug('[AUTH] Display secret not in cache, fetching from database');

			const displayUsers = await this.usersService.findAllByRole(UserRole.DISPLAY);

			if (displayUsers.length === 0) {
				this.logger.warn('[AUTH] No display user found');

				throw new UnauthorizedException('Invalid display authentication');
			}

			usersSecrets = displayUsers.map((user) => user.password);
		}

		let found = false;

		for (const userSecret of usersSecrets) {
			const match = await bcrypt.compare(providedSecret, userSecret);

			if (match) {
				found = true;
				break;
			}
		}

		if (!found) {
			this.logger.warn(`[AUTH] Invalid ${DISPLAY_SECRET_HEADER} provided`);

			throw new UnauthorizedException('Invalid display authentication');
		}

		try {
			await this.cacheManager.set(DISPLAY_SECRET_CACHE_KEY, usersSecrets);
		} catch (error) {
			const err = error as Error;

			this.logger.error('[AUTH] Failed to store authentication data', { message: err.message, stack: err.stack });
		}

		request['user'] = { id: null, role: UserRole.DISPLAY };

		this.logger.debug('[AUTH] Display authentication successful');

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
