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
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiForbiddenResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../../common/decorators/api-documentation.decorator';
import { ApiTag } from '../../../common/decorators/api-tag.decorator';
import { toInstance } from '../../../common/utils/transform.utils';
import { CreateDisplayInstanceDto } from '../../users/dto/create-display-instance.dto';
import { DisplaysInstancesService } from '../../users/services/displays-instances.service';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { AUTH_MODULE_API_TAG_DESCRIPTION, AUTH_MODULE_API_TAG_NAME, AUTH_MODULE_NAME } from '../auth.constants';
import { AuthenticatedRequest } from '../auth.constants';
import { AuthNotFoundException, AuthUnauthorizedException } from '../auth.exceptions';
import { ReqCheckEmailDto } from '../dto/check-email.dto';
import { ReqCheckUsernameDto } from '../dto/check-username.dto';
import { ReqLoginDto } from '../dto/login.dto';
import { ReqRefreshDto } from '../dto/refresh-token.dto';
import { ReqRegisterDisplayDto } from '../dto/register-display.dto';
import { ReqRegisterDto } from '../dto/register.dto';
import { Public } from '../guards/auth.guard';
import {
	CheckEmailResponseModel,
	CheckUsernameResponseModel,
	LoginResponseModel,
	ProfileResponseModel,
	RefreshResponseModel,
	RegisterDisplayResponseModel,
} from '../models/auth-response.model';
import { RegisteredDisplayModel } from '../models/auth.model';
import { AuthService } from '../services/auth.service';
import { CryptoService } from '../services/crypto.service';

@ApiTag({
	tagName: AUTH_MODULE_NAME,
	displayName: AUTH_MODULE_API_TAG_NAME,
	description: AUTH_MODULE_API_TAG_DESCRIPTION,
})
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
	@ApiSuccessResponse(LoginResponseModel, 'Successfully authenticated')
	@ApiNotFoundResponse('User not found')
	@ApiInternalServerErrorResponse()
	async login(@Body() body: ReqLoginDto): Promise<LoginResponseModel> {
		try {
			this.logger.debug(`[LOGIN] Attempting login for username=${body.data.username}`);

			const data = await this.authService.login(body.data);

			this.logger.debug(`[LOGIN] Successful login for username=${body.data.username}`);

			return toInstance(LoginResponseModel, { data });
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
	@ApiSuccessResponse(RefreshResponseModel, 'Token successfully refreshed')
	@ApiBadRequestResponse()
	@ApiForbiddenResponse('Invalid or expired refresh token')
	@ApiInternalServerErrorResponse()
	async refreshAccessToken(@Body() body: ReqRefreshDto): Promise<RefreshResponseModel> {
		try {
			const data = await this.authService.refreshAccessToken(body.data.token);

			this.logger.debug('[REFRESH] Successfully refreshed user access token');

			return toInstance(RefreshResponseModel, { data });
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
	@ApiSuccessResponse(RegisterDisplayResponseModel, 'Display successfully registered')
	@ApiBadRequestResponse()
	@ApiForbiddenResponse('Access denied or display already registered')
	@ApiInternalServerErrorResponse()
	async registerDisplay(
		@Headers('User-Agent') userAgent: string,
		@Body() createDto: ReqRegisterDisplayDto,
	): Promise<RegisterDisplayResponseModel> {
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

			const data = toInstance(RegisteredDisplayModel, { secret: password });

			return toInstance(RegisterDisplayResponseModel, { data });
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
	@ApiSuccessResponse(CheckUsernameResponseModel, 'Username availability result')
	@ApiBadRequestResponse()
	@ApiInternalServerErrorResponse()
	async checkUsername(@Body() body: ReqCheckUsernameDto): Promise<CheckUsernameResponseModel> {
		this.logger.debug(`[CHECK] Checking availability for username=${body.data.username}`);

		const data = await this.authService.checkUsername(body.data);

		this.logger.debug(`[CHECK] Username=${body.data.username} available=${data.valid}`);

		return toInstance(CheckUsernameResponseModel, { data });
	}

	@Public()
	@Post('check/email')
	@ApiOperation({
		summary: 'Check email availability',
		description: 'Verify if an email is available for registration',
	})
	@ApiBody({ type: ReqCheckEmailDto, description: 'Email to check' })
	@ApiSuccessResponse(CheckEmailResponseModel, 'Email availability result')
	@ApiBadRequestResponse()
	@ApiInternalServerErrorResponse()
	async checkEmail(@Body() body: ReqCheckEmailDto): Promise<CheckEmailResponseModel> {
		this.logger.debug(`[CHECK] Checking availability for email=${body.data.email}`);

		const data = await this.authService.checkEmail(body.data);

		this.logger.debug(`[CHECK] Email=${body.data.email} available=${data.valid}`);

		return toInstance(CheckEmailResponseModel, { data });
	}

	@Get('profile')
	@ApiOperation({ summary: 'Get user profile', description: 'Retrieve the authenticated user profile information' })
	@ApiSuccessResponse(ProfileResponseModel, 'User profile retrieved')
	@ApiNotFoundResponse('User not found')
	@ApiForbiddenResponse('User not authenticated')
	@ApiInternalServerErrorResponse()
	async getProfile(@Req() req: AuthenticatedRequest): Promise<ProfileResponseModel> {
		const { user } = req;

		if (!user) {
			throw new ForbiddenException('User not found');
		}

		this.logger.debug(`[PROFILE] Fetching profile for user=${user.id}`);

		const userData = await this.authService.getProfile(user.id);

		this.logger.debug(`[PROFILE] Successfully fetched profile for user=${user.id}`);

		return toInstance(ProfileResponseModel, { data: userData });
	}
}
