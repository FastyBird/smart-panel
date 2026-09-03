import bcrypt from 'bcrypt';
import { validate } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { NotificationKind, NotificationSeverity } from '../../notifications/notifications.constants';
import { NotificationsService } from '../../notifications/services/notifications.service';
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

/** Caller-supplied request context `login()` needs only to report a failed attempt. */
export interface LoginContext {
	ip?: string;
}

/** Short snake_case token for `data.reason` on a `login-failed` event - never user input. */
type FailedLoginReason = 'user_not_found' | 'inactive' | 'wrong_password';

/**
 * Hard bound on {@link AuthService.failedLoginCounts} so a flood of distinct usernames or IPs
 * cannot grow it without limit - see {@link AuthService.pruneFailedLoginCounts}.
 */
const FAILED_LOGIN_COUNTER_MAX_KEYS = 1000;

@Injectable()
export class AuthService {
	private readonly logger = createExtensionLogger(AUTH_MODULE_NAME, 'AuthService');

	/**
	 * Per-`login-failed` key attempt count, so the notification message can carry "N attempts
	 * this hour". Bounded by {@link pruneFailedLoginCounts}: keys are insertion-ordered, so the
	 * oldest is evicted first once the map is full.
	 */
	private readonly failedLoginCounts = new Map<string, number>();

	constructor(
		private readonly usersService: UsersService,
		private readonly tokensService: TokensService,
		private readonly jwtService: JwtService,
		private readonly notifications: NotificationsService,
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

	async login(loginDto: LoginDto, context?: LoginContext): Promise<LoggedInModel> {
		this.logger.debug(`Attempting login for username=${loginDto.username}`);

		const dtoInstance = await this.validateDto<LoginDto>(LoginDto, loginDto);

		const { username, password } = dtoInstance;

		// Normalised once and used by every failure branch below: `user` bounds the notification
		// key and payload against a pathologically long username, `client` is the resolved
		// caller address or 'unknown' when the controller could not resolve one.
		const user = username.slice(0, 64);
		const client = context?.ip ?? 'unknown';

		// Try to find user by username or email
		const account =
			(await this.usersService.findByUsername(username)) ?? (await this.usersService.findByEmail(username));

		if (!account) {
			this.logger.warn(`Failed login attempt for username=${username} (User not found)`);

			await this.reportFailedLogin(user, client, 'user_not_found');

			throw new AuthNotFoundException('Invalid email or password');
		}

		if (account.password === null) {
			this.logger.warn(`Failed login attempt for username=${username} (User password not set)`);

			await this.reportFailedLogin(user, client, 'inactive');

			throw new AuthNotFoundException('User is not activated');
		}

		// Verify password
		const match = await bcrypt.compare(password, account.password);

		if (!match) {
			this.logger.warn(`Failed login attempt for username=${username} (Invalid password)`);

			await this.reportFailedLogin(user, client, 'wrong_password');

			throw new AuthNotFoundException('Invalid email or password');
		}

		const tokens = await this.createTokenPair(account);

		this.logger.debug(`Successful login for user=${account.id}`);

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
			role: ownerExists ? UserRole.USER : UserRole.OWNER,
		});

		this.logger.debug(`Successfully registered user id=${user.id}`);

		return user;
	}

	async refreshAccessToken(token: string): Promise<RefreshTokenModel> {
		let payload: { sub?: string; role: string };

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

	/**
	 * Reports one failed login attempt as a keyed `login-failed` event, aggregated per user, IP
	 * and UTC hour so a repeated attack shows one growing row instead of flooding the bell with a
	 * fresh one every time.
	 *
	 * Awaited by every caller (`notify()` never throws) so `login()` does not return - and race
	 * ahead of its own notification - before the count it just computed is persisted. That
	 * ordering matters here specifically because `count` is read from {@link failedLoginCounts}
	 * and baked into the message text before the write: without it, two overlapping failures for
	 * the same key could have their database writes reordered so the later, higher count is
	 * overwritten by the earlier, lower one.
	 */
	private async reportFailedLogin(user: string, client: string, reason: FailedLoginReason): Promise<void> {
		const bucket = this.currentHourBucket();
		const key = `login-failed:${user}:${client}:${bucket}`;

		this.pruneFailedLoginCounts(bucket, key);

		const count = (this.failedLoginCounts.get(key) ?? 0) + 1;

		this.failedLoginCounts.set(key, count);

		await this.notifications.notify({
			source: AUTH_MODULE_NAME,
			kind: NotificationKind.EVENT,
			key,
			severity: NotificationSeverity.WARNING,
			title: `Failed login attempt for "${user}"`,
			message: `From ${client} · ${count} attempt(s) this hour`,
			data: { username: user, ip: client, reason },
		});
	}

	/**
	 * Keeps {@link failedLoginCounts} bounded. A bucket keys on the hour it was raised in, so
	 * once that hour has passed the entry carries no further meaning and is dropped outright -
	 * the next failure for the same user and IP starts a fresh key (and a fresh notification
	 * aggregation) anyway. That alone does not bound a flood of *distinct* users or IPs within a
	 * single hour, so a hard cap evicts the oldest key (insertion order) whenever a genuinely new
	 * key would put the map over it; updating an existing key's count never counts as "new".
	 */
	private pruneFailedLoginCounts(currentBucket: string, incomingKey: string): void {
		for (const existingKey of this.failedLoginCounts.keys()) {
			if (!existingKey.endsWith(`:${currentBucket}`)) {
				this.failedLoginCounts.delete(existingKey);
			}
		}

		if (this.failedLoginCounts.has(incomingKey)) {
			return;
		}

		// A call adds at most one new key, so evicting one oldest entry (insertion order) is
		// always enough to stay at the cap. Iterate-and-break instead of `.keys().next().value`:
		// the latter's `IteratorResult` return type widens to `any` under our strict ESLint rules
		// (see the same pattern in ClientAddressService.warnUntrustedForwardedHeaders).
		if (this.failedLoginCounts.size >= FAILED_LOGIN_COUNTER_MAX_KEYS) {
			for (const oldestKey of this.failedLoginCounts.keys()) {
				this.failedLoginCounts.delete(oldestKey);

				break;
			}
		}
	}

	/** Current UTC hour as `yyyy-mm-dd-hh`, the bucket a `login-failed` key aggregates into. */
	private currentHourBucket(): string {
		const now = new Date();
		const year = now.getUTCFullYear();
		const month = String(now.getUTCMonth() + 1).padStart(2, '0');
		const day = String(now.getUTCDate()).padStart(2, '0');
		const hour = String(now.getUTCHours()).padStart(2, '0');

		return `${year}-${month}-${day}-${hour}`;
	}
}
