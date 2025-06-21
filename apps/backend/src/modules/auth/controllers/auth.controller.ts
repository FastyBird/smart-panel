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

import { CreateDisplayDto } from '../../users/dto/create-display.dto';
import { UserEntity } from '../../users/entities/users.entity';
import { DisplaysService } from '../../users/services/displays.service';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { AuthenticatedRequest } from '../auth.constants';
import { AuthNotFoundException, AuthUnauthorizedException } from '../auth.exceptions';
import { ReqCheckEmailDto } from '../dto/check-email.dto';
import { CheckResponseDto } from '../dto/check-response.dto';
import { ReqCheckUsernameDto } from '../dto/check-username.dto';
import { LoggedInResponseDto } from '../dto/logged-in-response.dto';
import { ReqLoginDto } from '../dto/login.dto';
import { RefreshTokenResponseDto } from '../dto/refresh-token-response.dto';
import { ReqRefreshDto } from '../dto/refresh-token.dto';
import { ReqRegisterDisplayDto } from '../dto/register-display.dto';
import { ReqRegisterDto } from '../dto/register.dto';
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
		private readonly displayService: DisplaysService,
		private readonly cryptoService: CryptoService,
	) {}

	@Public()
	@Post('login')
	async login(@Body() body: ReqLoginDto): Promise<LoggedInResponseDto> {
		try {
			this.logger.debug(`[LOGIN] Attempting login for username=${body.data.username}`);

			const response = await this.authService.login(body.data);

			this.logger.debug(`[LOGIN] Successful login for username=${body.data.username}`);

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
	async register(@Body() body: ReqRegisterDto): Promise<void> {
		const owner = await this.userService.findOwner();

		if (owner) {
			this.logger.warn('[REGISTER] Owner already registered');

			throw new ForbiddenException('Application owner already exists');
		}

		this.logger.debug(`[REGISTER] Registering new user username=${body.data.username}, email=${body.data.email}`);

		await this.authService.register(body.data);

		this.logger.debug(`[REGISTER] Successfully registered user username=${body.data.username}`);
	}

	@Public()
	@Post('refresh')
	async refreshAccessToken(@Body() body: ReqRefreshDto): Promise<RefreshTokenResponseDto> {
		try {
			const response = await this.authService.refreshAccessToken(body.data.token);

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
	async registerDisplay(@Headers('User-Agent') userAgent: string, @Body() createDto: ReqRegisterDisplayDto) {
		this.logger.debug(`[REGISTER DISPLAY] User-Agent: ${userAgent}`);

		if (!userAgent || !userAgent.includes('FlutterApp')) {
			this.logger.warn('[REGISTER DISPLAY] Unauthorized User-Agent attempt');

			throw new ForbiddenException('Access Denied');
		}

		const displayUser = await this.userService.findByUsername(createDto.data.uid);

		if (displayUser !== null) {
			this.logger.warn('[REGISTER DISPLAY] Display user already registered');

			throw new ForbiddenException('Access Denied');
		}

		try {
			const password = this.cryptoService.generateSecureSecret();

			const displayUser = await this.authService.register({
				username: createDto.data.uid,
				password,
				role: UserRole.DISPLAY,
			});

			const dtoInstance = plainToInstance(
				CreateDisplayDto,
				{
					...createDto.data,
					user: displayUser.id,
				},
				{
					enableImplicitConversion: true,
					exposeUnsetFields: false,
				},
			);

			await this.displayService.create(displayUser.id, dtoInstance);

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
	async checkUsername(@Body() body: ReqCheckUsernameDto): Promise<CheckResponseDto> {
		this.logger.debug(`[CHECK] Checking availability for username=${body.data.username}`);

		const response = await this.authService.checkUsername(body.data);

		this.logger.debug(`[CHECK] Username=${body.data.username} available=${response.valid}`);

		return response;
	}

	@Public()
	@Post('check/email')
	async checkEmail(@Body() body: ReqCheckEmailDto): Promise<CheckResponseDto> {
		this.logger.debug(`[CHECK] Checking availability for email=${body.data.email}`);

		const response = await this.authService.checkEmail(body.data);

		this.logger.debug(`[CHECK] Email=${body.data.email} available=${response.valid}`);

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
