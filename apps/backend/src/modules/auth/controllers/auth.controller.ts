import { plainToInstance } from 'class-transformer';

import {
	Body,
	Controller,
	ForbiddenException,
	Get,
	Headers,
	HttpCode,
	Logger,
	NotFoundException,
	Post,
	Req,
} from '@nestjs/common';

import { UserEntity } from '../../users/entities/users.entity';
import { UsersService } from '../../users/services/users.service';
import { DISPLAY_USERNAME } from '../../users/users.constants';
import { AuthenticatedRequest } from '../auth.constants';
import { AuthNotFoundException, AuthUnauthorizedException } from '../auth.exceptions';
import { CheckEmailDto } from '../dto/check-email.dto';
import { CheckResponseDto } from '../dto/check-response.dto';
import { CheckUsernameDto } from '../dto/check-username.dto';
import { LoggedInResponseDto } from '../dto/logged-in-response.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshResponseDto } from '../dto/refresh-response.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { RegisterDto } from '../dto/register.dto';
import { RegisteredDisplayResponseDto } from '../dto/registered-display-response.dto';
import { Public } from '../guards/auth.guard';
import { AuthService } from '../services/auth.service';
import { CryptoService } from '../services/crypto.service';

@Controller('auth')
export class AuthController {
	private readonly logger = new Logger(AuthController.name);

	constructor(
		private readonly authService: AuthService,
		private readonly userService: UsersService,
		private readonly cryptoService: CryptoService,
	) {}

	@Public()
	@Post('login')
	async login(@Body() body: LoginDto): Promise<LoggedInResponseDto> {
		try {
			this.logger.debug(`[LOGIN] Attempting login for username=${body.username}`);

			const response = await this.authService.login(body);

			this.logger.debug(`[LOGIN] Successful login for username=${body.username}`);

			return response;
		} catch (error) {
			if (error instanceof AuthNotFoundException) {
				throw new NotFoundException(error.message);
			}

			throw error;
		}
	}

	@Public()
	@HttpCode(204)
	@Post('register')
	async register(@Body() body: RegisterDto): Promise<void> {
		const owner = await this.userService.findOwner();

		if (owner) {
			this.logger.warn('[REGISTER] Owner already registered');

			throw new ForbiddenException('Application owner already exists');
		}

		if (body.username === DISPLAY_USERNAME) {
			this.logger.warn('[REGISTER] User is trying to use reserved username');

			throw new ForbiddenException('Trying to register with reserved username');
		}

		this.logger.debug(`[REGISTER] Registering new user username=${body.username}, email=${body.email}`);

		await this.authService.register(body);

		this.logger.debug(`[REGISTER] Successfully registered user username=${body.username}`);
	}

	@Public()
	@Post('refresh')
	async refreshAccessToken(@Body() body: RefreshDto): Promise<RefreshResponseDto> {
		try {
			const response = await this.authService.refreshAccessToken(body.token);

			this.logger.debug('[REFRESH] Successfully refreshed user access token');

			return response;
		} catch (error) {
			if (error instanceof AuthUnauthorizedException) {
				throw new ForbiddenException(error.message);
			}

			throw error;
		}
	}

	@Public()
	@Post('register-display')
	async registerDisplay(@Headers('User-Agent') userAgent: string) {
		this.logger.debug(`[REGISTER DISPLAY] User-Agent: ${userAgent}`);

		if (!userAgent || !userAgent.includes('FlutterApp')) {
			this.logger.warn('[REGISTER DISPLAY] Unauthorized User-Agent attempt');

			throw new ForbiddenException('Access Denied');
		}

		const displayUser = await this.userService.findByUsername(DISPLAY_USERNAME);

		if (displayUser !== null) {
			this.logger.warn('[REGISTER DISPLAY] Display user already registered');

			throw new ForbiddenException('Access Denied');
		}

		try {
			const password = this.cryptoService.generateSecureSecret();

			await this.authService.register({
				username: DISPLAY_USERNAME,
				password,
			});

			this.logger.debug('[REGISTER DISPLAY] Display user successfully registered');

			return plainToInstance(RegisteredDisplayResponseDto, { secret: password }, { excludeExtraneousValues: true });
		} catch (error) {
			const err = error as Error;

			this.logger.error('[REGISTER DISPLAY] Failed to register display', {
				message: err.message,
				stack: err.stack,
			});

			throw new ForbiddenException('An error occurred while registering the display');
		}
	}

	@Public()
	@Post('check/username')
	async checkUsername(@Body() body: CheckUsernameDto): Promise<CheckResponseDto> {
		this.logger.debug(`[CHECK] Checking availability for username=${body.username}`);

		const response = await this.authService.checkUsername(body);

		this.logger.debug(`[CHECK] Username=${body.username} available=${response.valid}`);

		return response;
	}

	@Public()
	@Post('check/email')
	async checkEmail(@Body() body: CheckEmailDto): Promise<CheckResponseDto> {
		this.logger.debug(`[CHECK] Checking availability for email=${body.email}`);

		const response = await this.authService.checkEmail(body);

		this.logger.debug(`[CHECK] Email=${body.email} available=${response.valid}`);

		return response;
	}

	@Get('profile')
	async getProfile(@Req() req: AuthenticatedRequest): Promise<UserEntity> {
		const { user } = req;

		if (!user) {
			throw new ForbiddenException('User not found');
		}

		this.logger.debug(`[PROFILE] Fetching profile for user=${user.id}`);

		const response = await this.authService.getProfile(user.id);

		this.logger.debug(`[PROFILE] Successfully fetched profile for user=${user.id}`);

		return response;
	}
}
