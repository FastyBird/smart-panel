import { Socket } from 'socket.io';

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { TokenOwnerType } from '../../auth/auth.constants';
import { AccessTokenEntity, LongLiveTokenEntity } from '../../auth/entities/auth.entity';
import { TokensService } from '../../auth/services/tokens.service';
import { hashToken } from '../../auth/utils/token.utils';
import { UserEntity } from '../../users/entities/users.entity';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../dto/client-user.dto';
import { WEBSOCKET_MODULE_NAME } from '../websocket.constants';
import { WebsocketNotAllowedException } from '../websocket.exceptions';

@Injectable()
export class WsAuthService {
	private readonly logger = createExtensionLogger(WEBSOCKET_MODULE_NAME, 'WsAuthService');

	constructor(
		private readonly jwtService: JwtService,
		private readonly tokensService: TokensService,
		private readonly usersService: UsersService,
	) {}

	async validateClient(client: Socket): Promise<boolean> {
		// Try authenticating with JWT/token
		const token: unknown = client.handshake.auth.token ?? undefined;

		if (typeof token === 'string' && (await this.validateToken(client, token))) {
			return true;
		}

		// If auth method didn't work, reject the request
		this.logger.warn('Unauthorized request, missing valid credentials');

		return false;
	}

	private async validateToken(client: Socket, token: string): Promise<boolean> {
		let payload: { sub?: string; type?: string; role?: string } | null = null;

		try {
			payload = await this.jwtService.verifyAsync(token);
		} catch (error) {
			const err = error as Error;

			this.logger.error('JWT authentication failed', { message: err.message, stack: err.stack });

			throw new WebsocketNotAllowedException('Invalid or expired token');
		}

		// Check if this is a display token (type: TokenOwnerType.DISPLAY in payload)
		if ((payload.type as TokenOwnerType) === TokenOwnerType.DISPLAY && payload.sub) {
			return this.validateDisplayToken(client, token, payload.sub);
		}

		// Check if this is a user access token (has sub and role, but no type)
		if (payload.sub && !payload.type) {
			return this.validateUserAccessToken(client, token, payload.sub);
		}

		// Try to validate as a long-live token (third-party or user-created)
		return this.validateLongLiveToken(client, token);
	}

	private async validateUserAccessToken(client: Socket, token: string, userId: string): Promise<boolean> {
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
			throw new WebsocketNotAllowedException('Token not found');
		}

		if (storedAccessToken.revoked || storedAccessToken.refreshToken.revoked) {
			this.logger.warn('Access token is revoked');
			throw new WebsocketNotAllowedException('Token revoked');
		}

		let user: UserEntity;

		try {
			user = await this.usersService.getOneOrThrow(userId);
		} catch (error) {
			const err = error as Error;
			this.logger.warn('Token valid, but user not found', { message: err.message, stack: err.stack });
			throw new WebsocketNotAllowedException('Invalid user');
		}

		(client.data as object)['user'] = toInstance(ClientUserDto, { id: user.id, role: user.role, type: 'user' });

		return true;
	}

	private async validateDisplayToken(client: Socket, token: string, displayId: string): Promise<boolean> {
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
			throw new WebsocketNotAllowedException('Token not found');
		}

		if (storedToken.revoked) {
			this.logger.warn('Display token is revoked');
			throw new WebsocketNotAllowedException('Token revoked');
		}

		if (storedToken.expiresAt && storedToken.expiresAt < new Date()) {
			this.logger.warn('Display token is expired');
			throw new WebsocketNotAllowedException('Token expired');
		}

		// Set universal long-live token client data
		(client.data as object)['user'] = toInstance(ClientUserDto, {
			id: storedToken.ownerId,
			role: UserRole.USER,
			type: 'token',
			owner_type: storedToken.ownerType,
			token_id: storedToken.id,
		});

		return true;

		return true;
	}

	private async validateLongLiveToken(client: Socket, token: string): Promise<boolean> {
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
			throw new WebsocketNotAllowedException('Unknown token');
		}

		if (storedLongLiveToken.revoked) {
			this.logger.warn('Long-live token is revoked');
			throw new WebsocketNotAllowedException('Token revoked');
		}

		if (storedLongLiveToken.expiresAt && storedLongLiveToken.expiresAt < new Date()) {
			this.logger.warn('Long-live token is expired');
			throw new WebsocketNotAllowedException('Token expired');
		}

		// Determine the role based on owner type
		let role = UserRole.USER;

		if (storedLongLiveToken.ownerType === TokenOwnerType.USER && storedLongLiveToken.ownerId) {
			const user = await this.usersService.findOne(storedLongLiveToken.ownerId);
			if (user) {
				role = user.role;
			}
		}

		// Set universal long-live token client data
		(client.data as object)['user'] = toInstance(ClientUserDto, {
			id: storedLongLiveToken.ownerId,
			role: role,
			type: 'token',
			ownerType: storedLongLiveToken.ownerType,
			tokenId: storedLongLiveToken.id,
		});

		return true;
	}
}
