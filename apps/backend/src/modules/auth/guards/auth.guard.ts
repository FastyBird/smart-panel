import * as bcrypt from 'bcrypt';
import { Cache } from 'cache-manager';
import { Request } from 'express';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
	CanActivate,
	ExecutionContext,
	Inject,
	Injectable,
	Logger,
	SetMetadata,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { UserEntity } from '../../users/entities/users.entity';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { AccessTokenType, DisplaySecretHeader } from '../auth.constants';
import { AccessTokenEntity, LongLiveTokenEntity } from '../entities/auth.entity';
import { TokensService } from '../services/tokens.service';

export const IS_PUBLIC_KEY = 'isPublic';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class AuthGuard implements CanActivate {
	private readonly logger = new Logger(AuthGuard.name);
	private readonly DISPLAY_SECRET_CACHE_KEY = 'display-secret';

	constructor(
		private jwtService: JwtService,
		private reflector: Reflector,
		private tokensService: TokensService,
		private usersService: UsersService,
		@Inject(CACHE_MANAGER)
		private cacheManager: Cache,
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
		const displaySecret = request.headers[DisplaySecretHeader] as string;

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

			this.logger.error('[AUTH] JWT authentication failed', { message: err.message, stack: err.stack });

			throw new UnauthorizedException('Invalid or expired token');
		}

		if (payload.sub) {
			const storedAccessTokens = await this.tokensService.findAllByOwner<AccessTokenEntity>(
				payload.sub,
				AccessTokenEntity,
			);

			let storedAccessToken: AccessTokenEntity | null = null;

			for (const accessToken of storedAccessTokens) {
				if (await bcrypt.compare(token, accessToken.hashedToken)) {
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
			if (await bcrypt.compare(token, longLiveToken.hashedToken)) {
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
		let userSecret: string | undefined;

		try {
			userSecret = await this.cacheManager.get<string>(this.DISPLAY_SECRET_CACHE_KEY);
		} catch (error) {
			const err = error as Error;

			this.logger.error('[AUTH] Failed to fetch authentication data', { message: err.message, stack: err.stack });
		}

		if (!userSecret) {
			this.logger.debug('[AUTH] Display secret not in cache, fetching from database');

			const displayUser = await this.usersService.findByUsername('display');

			if (!displayUser) {
				this.logger.warn('[AUTH] No display user found');

				throw new UnauthorizedException('Invalid display authentication');
			}

			userSecret = displayUser.password;
		}

		if (providedSecret !== userSecret) {
			this.logger.warn(`[AUTH] Invalid ${DisplaySecretHeader} provided`);

			throw new UnauthorizedException('Invalid display authentication');
		}

		try {
			await this.cacheManager.set(this.DISPLAY_SECRET_CACHE_KEY, userSecret);
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

		return type === AccessTokenType ? token : undefined;
	}
}
