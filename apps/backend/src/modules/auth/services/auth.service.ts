import bcrypt from 'bcrypt';
import { validate } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { UserEntity } from '../../users/entities/users.entity';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { ACCESS_TOKEN_TYPE, AUTH_MODULE_NAME, TokenType } from '../auth.constants';
import {
	AuthException,
	AuthNotFoundException,
	AuthUnauthorizedException,
	AuthValidationException,
} from '../auth.exceptions';
import { CheckEmailDto } from '../dto/check-email.dto';
import { CheckUsernameDto } from '../dto/check-username.dto';
import { CreateAccessTokenDto, CreateRefreshTokenDto } from '../dto/create-token.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { UpdateRefreshTokenDto } from '../dto/update-token.dto';
import { AccessTokenEntity, RefreshTokenEntity } from '../entities/auth.entity';
import { CheckModel, LoggedInModel, RefreshTokenModel } from '../models/auth.model';
import { hashToken } from '../utils/token.utils';

import { TokensService } from './tokens.service';

@Injectable()
export class AuthService {
	private readonly logger = createExtensionLogger(AUTH_MODULE_NAME, 'AuthService');

	constructor(
		private readonly usersService: UsersService,
		private readonly tokensService: TokensService,
		private readonly jwtService: JwtService,
	) {}

	generateToken(user: UserEntity, role?: UserRole, options?: JwtSignOptions): string {
		this.logger.debug(`Generating token for user=${user.id} role=${role || user.role}`);

		const payload = {
			sub: user.id,
			role: role || user.role,
			iat: Math.floor(Date.now() / 1000),
			jti: uuid().toString(),
		};

		const token = this.jwtService.sign(payload, options);

		this.logger.debug(`Successfully generated token for user=${user.id}`);

		return token;
	}

	async checkUsername({ username }: CheckUsernameDto): Promise<CheckModel> {
		this.logger.debug(`Checking if username=${username} exists`);

		const user = await this.usersService.findByUsername(username);
		const isTaken = user !== null;

		this.logger.debug(`Username=${username} taken=${isTaken}`);

		return toInstance(CheckModel, { valid: !isTaken });
	}

	async checkEmail({ email }: CheckEmailDto): Promise<CheckModel> {
		this.logger.debug(`Checking if email=${email} exists`);

		const user = await this.usersService.findByEmail(email);
		const isTaken = user !== null;

		this.logger.debug(`Email=${email} taken=${isTaken}`);

		return toInstance(CheckModel, { valid: !isTaken });
	}

	async getProfile(id: string): Promise<UserEntity> {
		this.logger.debug(`Fetching profile for user=${id}`);

		const user = await this.usersService.getOneOrThrow(id);

		this.logger.debug(`Successfully fetched profile for user=${id}`);

		return user;
	}

	async login(loginDto: LoginDto): Promise<LoggedInModel> {
		this.logger.debug(`Attempting login for username=${loginDto.username}`);

		const dtoInstance = await this.validateDto<LoginDto>(LoginDto, loginDto);

		const { username, password } = dtoInstance;

		// Try to find user by username or email
		const user = (await this.usersService.findByUsername(username)) ?? (await this.usersService.findByEmail(username));

		if (!user) {
			this.logger.warn(`Failed login attempt for username=${username} (User not found)`);

			throw new AuthNotFoundException('Invalid email or password');
		}

		if (user.password === null) {
			this.logger.warn(`Failed login attempt for username=${username} (User password not set)`);

			throw new AuthNotFoundException('User is not activated');
		}

		// Verify password
		const match = await bcrypt.compare(password, user.password);

		if (!match) {
			this.logger.warn(`Failed login attempt for username=${username} (Invalid password)`);

			throw new AuthNotFoundException('Invalid email or password');
		}

		const tokens = await this.createTokenPair(user);

		this.logger.debug(`Successful login for user=${user.id}`);

		const accessTokenExpiresAt = this.getExpiryDate(tokens.accessToken) || new Date();

		return toInstance(LoggedInModel, { ...tokens, type: ACCESS_TOKEN_TYPE, expiration: accessTokenExpiresAt });
	}

	async register(registerDto: RegisterDto): Promise<UserEntity> {
		this.logger.debug(`Registering new user username=${registerDto.username}, email=${registerDto.email}`);

		const dtoInstance = await this.validateDto<RegisterDto>(RegisterDto, registerDto);

		const { password, email, username } = dtoInstance;

		// Ensure only one owner can be registered
		if (await this.usersService.findOwner()) {
			this.logger.warn('Registration failed - owner already exists');

			throw new AuthException('Owner already registered');
		}

		// Check if email or username already exists
		const [emailExists, usernameExists, ownerExists] = await Promise.all([
			email ? this.usersService.findByEmail(email) : null,
			this.usersService.findByUsername(username),
			this.usersService.findOwner(),
		]);

		if (emailExists) {
			this.logger.warn(`Registration failed - email=${email} already exists`);

			throw new AuthException('Email already registered');
		}

		if (usernameExists) {
			this.logger.warn(`Registration failed - username=${username} already exists`);

			throw new AuthException('Username already registered');
		}

		const user = await this.usersService.create({
			...dtoInstance,
			password,
			role: dtoInstance.role ?? (ownerExists ? UserRole.USER : UserRole.OWNER),
		});

		this.logger.debug(`Successfully registered user id=${user.id}`);

		return user;
	}

	async refreshAccessToken(token: string): Promise<RefreshTokenModel> {
		let payload: { sub?: string; role: string } | null = null;

		try {
			payload = await this.jwtService.verifyAsync(token);
		} catch (error) {
			const err = error as Error;

			this.logger.debug('JWT validation failed', { message: err.message, stack: err.stack });

			throw new AuthUnauthorizedException('Invalid or expired token');
		}

		const existingRefreshTokens = await this.tokensService.findAllByOwner<RefreshTokenEntity>(
			payload.sub,
			RefreshTokenEntity,
		);

		let existingRefreshToken: RefreshTokenEntity | null = null;

		for (const refreshToken of existingRefreshTokens) {
			if (hashToken(token) === refreshToken.hashedToken) {
				existingRefreshToken = refreshToken;

				break;
			}
		}

		if (
			!existingRefreshToken ||
			existingRefreshToken.expiresAt < new Date() ||
			existingRefreshToken.revoked ||
			existingRefreshToken.type !== TokenType.REFRESH ||
			existingRefreshToken.owner === null
		) {
			throw new AuthUnauthorizedException('Invalid or expired token');
		}

		const user = await this.usersService.getOneOrThrow(existingRefreshToken.owner.id);

		try {
			await this.tokensService.update<RefreshTokenEntity, UpdateRefreshTokenDto>(existingRefreshToken.id, {
				type: TokenType.REFRESH,
				revoked: true,
			});
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to revoke user refresh token', { message: err.message, stack: err.stack });

			throw new AuthException('Something went wrong. Token can not be refreshed.');
		}

		const tokens = await this.createTokenPair(user);

		if (existingRefreshToken.parent) {
			try {
				await this.tokensService.remove(existingRefreshToken.parent.id);
			} catch (error) {
				const err = error as Error;

				this.logger.error('Failed to remove user access token', { message: err.message, stack: err.stack });

				throw new AuthException('Something went wrong. Token can not be refreshed.');
			}
		}

		const accessTokenExpiresAt = this.getExpiryDate(tokens.accessToken) || new Date();

		return toInstance(RefreshTokenModel, {
			...tokens,
			type: ACCESS_TOKEN_TYPE,
			expiration: accessTokenExpiresAt,
		});
	}

	private async createTokenPair(user: UserEntity): Promise<{ accessToken: string; refreshToken: string }> {
		const accessToken = this.generateToken(user);
		const accessTokenExpiresAt = this.getExpiryDate(accessToken) || new Date();

		let accessTokenEntity: AccessTokenEntity;

		try {
			// Pass user entity directly to ensure relation is properly set
			accessTokenEntity = await this.tokensService.create<AccessTokenEntity, CreateAccessTokenDto>({
				token: accessToken,
				type: TokenType.ACCESS,
				owner: user,
				expiresAt: accessTokenExpiresAt,
			});
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to create access token', { message: err.message, stack: err.stack });

			throw new AuthException('Access token can not be saved');
		}

		const refreshToken = this.generateToken(user, user.role, { expiresIn: '30d' });
		const refreshTokenExpiresAt = this.getExpiryDate(refreshToken) || new Date();

		try {
			// Pass user entity and parent token entity directly to ensure relations are properly set
			await this.tokensService.create<RefreshTokenEntity, CreateRefreshTokenDto>({
				token: refreshToken,
				type: TokenType.REFRESH,
				owner: user,
				parent: accessTokenEntity,
				expiresAt: refreshTokenExpiresAt,
			});
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to create refresh token', { message: err.message, stack: err.stack });

			throw new AuthException('Refresh token can not be saved');
		}

		return { accessToken, refreshToken };
	}

	private async validateDto<T extends object>(DtoClass: new () => T, dto: any): Promise<T> {
		this.logger.debug(`Validating DTO for class=${DtoClass.name}`);

		const dtoInstance = toInstance(DtoClass, dto, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length) {
			this.logger.error(`Validation failed: ${JSON.stringify(errors)}`);

			throw new AuthValidationException('Provided user data are invalid.');
		}

		this.logger.debug(`DTO validation successful for class=${DtoClass.name}`);

		return dtoInstance;
	}

	private getExpiryDate(token: string): Date | null {
		const decodedToken = this.jwtService.decode<{ exp: number }>(token);

		return decodedToken?.exp ? new Date(decodedToken.exp * 1000) : null;
	}
}
