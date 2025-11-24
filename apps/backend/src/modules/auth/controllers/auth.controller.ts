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
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiForbiddenResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../../common/decorators/api-documentation.decorator';
import { toInstance } from '../../../common/utils/transform.utils';
import { CreateDisplayInstanceDto } from '../../users/dto/create-display-instance.dto';
import { UserEntity } from '../../users/entities/users.entity';
import { DisplaysInstancesService } from '../../users/services/displays-instances.service';
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

@ApiTags('auth-module')
@Controller('auth')
export class AuthController {
	private readonly logger = new Logger(AuthController.name);

	constructor(
		private readonly authService: AuthService,
		private readonly userService: UsersService,
		private readonly displayService: DisplaysInstancesService,
		private readonly cryptoService: CryptoService,
	) {}

	@Public()
	@Post('login')
	@ApiOperation({ summary: 'User login', description: 'Authenticate user and return access tokens' })
	@ApiBody({ type: ReqLoginDto, description: 'Login credentials' })
	@ApiSuccessResponse(LoggedInResponseDto, 'Successfully authenticated')
	@ApiNotFoundResponse('User not found')
	@ApiInternalServerErrorResponse()
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
	@ApiOperation({ summary: 'Register new user', description: 'Register the application owner account' })
	@ApiBody({ type: ReqRegisterDto, description: 'User registration data' })
	@ApiResponse({ status: 204, description: 'User successfully registered' })
	@ApiBadRequestResponse('Invalid input data')
	@ApiForbiddenResponse('Owner already exists')
	@ApiInternalServerErrorResponse()
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
	@ApiOperation({ summary: 'Refresh access token', description: 'Get a new access token using a refresh token' })
	@ApiBody({ type: ReqRefreshDto, description: 'Refresh token' })
	@ApiSuccessResponse(RefreshTokenResponseDto, 'Token successfully refreshed')
	@ApiBadRequestResponse()
	@ApiForbiddenResponse('Invalid or expired refresh token')
	@ApiInternalServerErrorResponse()
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
	@ApiOperation({
		summary: 'Register display device',
		description: 'Register a new display device and get credentials',
	})
	@ApiBody({ type: ReqRegisterDisplayDto, description: 'Display device information' })
	@ApiSuccessResponse(RegisteredDisplayResponseDto, 'Display successfully registered')
	@ApiBadRequestResponse()
	@ApiForbiddenResponse('Access denied or display already registered')
	@ApiInternalServerErrorResponse()
	async registerDisplay(@Headers('User-Agent') userAgent: string, @Body() createDto: ReqRegisterDisplayDto) {
		this.logger.debug(`[REGISTER DISPLAY] User-Agent: ${userAgent}`);

		if (!userAgent || !userAgent.includes('FlutterApp')) {
			this.logger.warn('[REGISTER DISPLAY] Unauthorized User-Agent attempt');

			throw new ForbiddenException('Access Denied');
		}

		const displayUser = await this.userService.findByUsername(createDto.data.uid);

		if (displayUser !== null && displayUser.password !== null) {
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

			const dtoInstance = toInstance(CreateDisplayInstanceDto, {
				...createDto.data,
				user: displayUser.id,
			});

			await this.displayService.create(displayUser.id, dtoInstance);

			this.logger.debug('[REGISTER DISPLAY] Display user successfully registered');

			return toInstance(RegisteredDisplayResponseDto, { secret: password });
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
	@ApiOperation({
		summary: 'Check username availability',
		description: 'Verify if a username is available for registration',
	})
	@ApiBody({ type: ReqCheckUsernameDto, description: 'Username to check' })
	@ApiSuccessResponse(CheckResponseDto, 'Username availability result')
	@ApiBadRequestResponse()
	@ApiInternalServerErrorResponse()
	async checkUsername(@Body() body: ReqCheckUsernameDto): Promise<CheckResponseDto> {
		this.logger.debug(`[CHECK] Checking availability for username=${body.data.username}`);

		const response = await this.authService.checkUsername(body.data);

		this.logger.debug(`[CHECK] Username=${body.data.username} available=${response.valid}`);

		return response;
	}

	@Public()
	@Post('check/email')
	@ApiOperation({
		summary: 'Check email availability',
		description: 'Verify if an email is available for registration',
	})
	@ApiBody({ type: ReqCheckEmailDto, description: 'Email to check' })
	@ApiSuccessResponse(CheckResponseDto, 'Email availability result')
	@ApiBadRequestResponse()
	@ApiInternalServerErrorResponse()
	async checkEmail(@Body() body: ReqCheckEmailDto): Promise<CheckResponseDto> {
		this.logger.debug(`[CHECK] Checking availability for email=${body.data.email}`);

		const response = await this.authService.checkEmail(body.data);

		this.logger.debug(`[CHECK] Email=${body.data.email} available=${response.valid}`);

		return response;
	}

	@Get('profile')
	@ApiOperation({ summary: 'Get user profile', description: 'Retrieve the authenticated user profile information' })
	@ApiSuccessResponse(UserEntity, 'User profile retrieved')
	@ApiNotFoundResponse('User not found')
	@ApiForbiddenResponse('User not authenticated')
	@ApiInternalServerErrorResponse()
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
