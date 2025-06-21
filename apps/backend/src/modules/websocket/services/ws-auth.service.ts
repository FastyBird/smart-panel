import bcrypt from 'bcrypt';
import { Cache } from 'cache-manager';
import { plainToInstance } from 'class-transformer';
import { Socket } from 'socket.io';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AccessTokenEntity, LongLiveTokenEntity } from '../../auth/entities/auth.entity';
import { TokensService } from '../../auth/services/tokens.service';
import { hashToken } from '../../auth/utils/token.utils';
import { UserEntity } from '../../users/entities/users.entity';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../dto/client-user.dto';
import { DISPLAY_SECRET_CACHE_KEY, DISPLAY_SECRET_HEADER } from '../websocket.constants';
import { WebsocketNotAllowedException } from '../websocket.exceptions';

@Injectable()
export class WsAuthService {
	private readonly logger = new Logger(WsAuthService.name);

	constructor(
		private readonly jwtService: JwtService,
		private readonly tokensService: TokensService,
		private readonly usersService: UsersService,
		@Inject(CACHE_MANAGER)
		private readonly cacheManager: Cache,
	) {}

	async validateClient(client: Socket): Promise<boolean> {
		// First, try authenticating with JWT
		const token: unknown = client.handshake.auth.token ?? undefined;

		if (typeof token === 'string' && (await this.validateJwt(client, token))) {
			return true;
		}

		// If no JWT, check for x-display-secret header
		const displaySecret = client.handshake.headers[DISPLAY_SECRET_HEADER] as string;

		if (displaySecret && (await this.validateDisplaySecret(client, displaySecret))) {
			return true;
		}

		// If neither auth method worked, reject the request
		this.logger.warn('[WS AUTH] Unauthorized request, missing valid credentials');

		return false;
	}

	private async validateJwt(client: Socket, token: string): Promise<boolean> {
		let user: UserEntity;

		let payload: { sub?: string; role: string } | null = null;

		try {
			payload = await this.jwtService.verifyAsync(token);
		} catch (error) {
			const err = error as Error;

			this.logger.error('[WS AUTH] JWT authentication failed', { message: err.message, stack: err.stack });

			throw new WebsocketNotAllowedException('Invalid or expired token');
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
				this.logger.warn('[WS AUTH] JWT token not exists');

				throw new WebsocketNotAllowedException('Token not found');
			}

			if (storedAccessToken.revoked || storedAccessToken.refreshToken.revoked) {
				this.logger.warn('[WS AUTH] JWT token is revoked');

				throw new WebsocketNotAllowedException('Token revoked');
			}

			try {
				user = await this.usersService.getOneOrThrow(payload.sub);
			} catch (error) {
				const err = error as Error;

				this.logger.warn('[WS AUTH] JWT token valid, but user not found', { message: err.message, stack: err.stack });

				throw new WebsocketNotAllowedException('Invalid user');
			}

			(client.data as object)['user'] = plainToInstance(ClientUserDto, { id: user.id, role: user.role });

			this.logger.debug(`[WS AUTH] JWT authentication successful for user=${user.id}`);

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
			(client.data as object)['user'] = plainToInstance(ClientUserDto, { id: null, role: UserRole.USER });

			this.logger.debug('[WS AUTH] JWT authentication successful for long live token');

			return true;
		}

		throw new WebsocketNotAllowedException('Unknown token');
	}

	private async validateDisplaySecret(client: Socket, providedSecret: string): Promise<boolean> {
		let usersSecrets: string[] | null = null;

		try {
			usersSecrets = await this.cacheManager.get<string[]>(DISPLAY_SECRET_CACHE_KEY);
		} catch (error) {
			const err = error as Error;

			this.logger.error('[WS AUTH] Failed to fetch authentication data', { message: err.message, stack: err.stack });
		}

		if (usersSecrets === null || usersSecrets.length === 0) {
			this.logger.debug('[WS AUTH] Display secret not in cache, fetching from database');

			const displayUsers = await this.usersService.findAllByRole(UserRole.DISPLAY);

			if (displayUsers.length === 0) {
				this.logger.warn('[WS AUTH] No display user found');

				throw new WebsocketNotAllowedException('Invalid display authentication');
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
			this.logger.warn(`[WS AUTH] Invalid ${DISPLAY_SECRET_HEADER} provided`);

			throw new WebsocketNotAllowedException('Invalid display authentication');
		}

		try {
			await this.cacheManager.set(DISPLAY_SECRET_CACHE_KEY, usersSecrets);
		} catch (error) {
			const err = error as Error;

			this.logger.error('[WS AUTH] Failed to store authentication data', { message: err.message, stack: err.stack });
		}

		(client.data as object)['user'] = plainToInstance(ClientUserDto, { id: null, role: UserRole.DISPLAY });

		this.logger.debug('[WS AUTH] Display authentication successful');

		return true;
	}
}
