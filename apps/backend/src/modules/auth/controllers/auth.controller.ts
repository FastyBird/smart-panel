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
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiForbiddenResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { CreateDisplayInstanceDto } from '../../users/dto/create-display-instance.dto';
import { DisplaysInstancesService } from '../../users/services/displays-instances.service';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { AUTH_MODULE_API_TAG_NAME } from '../auth.constants';
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

@ApiTags(AUTH_MODULE_API_TAG_NAME)
@Controller('auth')
export class AuthController {
	private readonly logger = new Logger(AuthController.name);

	constructor(
		private readonly authService: AuthService,
		private readonly userService: UsersService,
		private readonly displayService: DisplaysInstancesService,
		private readonly cryptoService: CryptoService,
	) {}

	@ApiOperation({
		tags: [AUTH_MODULE_API_TAG_NAME],
		summary: 'User login',
		description: 'Authenticate user and return access tokens',
		operationId: 'create-auth-module-login',
	})
	@ApiBody({ type: ReqLoginDto, description: 'Login credentials' })
	@ApiSuccessResponse(LoginResponseModel, 'Successfully authenticated')
	@ApiBadRequestResponse('Invalid login credentials')
	@ApiNotFoundResponse('User not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Public()
	@Post('login')
	async login(@Body() body: ReqLoginDto): Promise<LoginResponseModel> {
		try {
			this.logger.debug(`[LOGIN] Attempting login for username=${body.data.username}`);

			const data = await this.authService.login(body.data);

			this.logger.debug(`[LOGIN] Successful login for username=${body.data.username}`);

			const response = new LoginResponseModel();
			response.data = data;

			return response;
		} catch (error) {
			if (error instanceof AuthNotFoundException) {
				throw new NotFoundException(error.message);
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [AUTH_MODULE_API_TAG_NAME],
		summary: 'Register new user',
		description: 'Register the application owner account',
		operationId: 'create-auth-module-register',
	})
	@ApiBody({ type: ReqRegisterDto, description: 'User registration data' })
	@ApiNoContentResponse({ description: 'User successfully registered' })
	@ApiBadRequestResponse('Invalid input data')
	@ApiForbiddenResponse('Owner already exists')
	@ApiInternalServerErrorResponse('Internal server error')
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

	@ApiOperation({
		tags: [AUTH_MODULE_API_TAG_NAME],
		summary: 'Refresh access token',
		description: 'Get a new access token using a refresh token',
		operationId: 'update-auth-module-refresh',
	})
	@ApiBody({ type: ReqRefreshDto, description: 'Refresh token' })
	@ApiCreatedSuccessResponse(RefreshResponseModel, 'Token successfully refreshed')
	@ApiBadRequestResponse('Invalid refresh token data')
	@ApiNotFoundResponse('Refresh token not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Public()
	@Post('refresh')
	async refreshAccessToken(@Body() body: ReqRefreshDto): Promise<RefreshResponseModel> {
		try {
			const data = await this.authService.refreshAccessToken(body.data.token);

			this.logger.debug('[REFRESH] Successfully refreshed user access token');

			const response = new RefreshResponseModel();
			response.data = data;

			return response;
		} catch (error) {
			if (error instanceof AuthUnauthorizedException) {
				throw new ForbiddenException(error.message);
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [AUTH_MODULE_API_TAG_NAME],
		summary: 'Register display device',
		description: 'Register a new display device and get credentials',
		operationId: 'create-auth-module-register-display',
	})
	@ApiBody({ type: ReqRegisterDisplayDto, description: 'Display device information' })
	@ApiCreatedSuccessResponse(RegisterDisplayResponseModel, 'Display successfully registered')
	@ApiBadRequestResponse('Invalid display registration data')
	@ApiInternalServerErrorResponse('Internal server error')
	@Public()
	@Post('register-display')
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

			const response = new RegisterDisplayResponseModel();
			response.data = toInstance(RegisteredDisplayModel, { secret: password });

			return response;
		} catch (error) {
			const err = error as Error;

			this.logger.error('[REGISTER DISPLAY] Failed to register display', {
				message: err.message,
				stack: err.stack,
			});

			throw new ForbiddenException('An error occurred while registering the display');
		}
	}

	@ApiOperation({
		tags: [AUTH_MODULE_API_TAG_NAME],
		summary: 'Check username availability',
		description: 'Verify if a username is available for registration',
		operationId: 'validate-auth-module-check-username',
	})
	@ApiBody({ type: ReqCheckUsernameDto, description: 'Username to check' })
	@ApiSuccessResponse(CheckUsernameResponseModel, 'Username availability result')
	@ApiBadRequestResponse('Invalid username')
	@ApiInternalServerErrorResponse('Internal server error')
	@Public()
	@Post('check/username')
	async checkUsername(@Body() body: ReqCheckUsernameDto): Promise<CheckUsernameResponseModel> {
		this.logger.debug(`[CHECK] Checking availability for username=${body.data.username}`);

		const data = await this.authService.checkUsername(body.data);

		this.logger.debug(`[CHECK] Username=${body.data.username} available=${data.valid}`);

		const response = new CheckUsernameResponseModel();
		response.data = data;

		return response;
	}

	@ApiOperation({
		tags: [AUTH_MODULE_API_TAG_NAME],
		summary: 'Check email availability',
		description: 'Verify if an email is available for registration',
		operationId: 'validate-auth-module-check-email',
	})
	@ApiBody({ type: ReqCheckEmailDto, description: 'Email to check' })
	@ApiSuccessResponse(CheckEmailResponseModel, 'Email availability result')
	@ApiBadRequestResponse('Invalid email')
	@ApiInternalServerErrorResponse('Internal server error')
	@Public()
	@Post('check/email')
	async checkEmail(@Body() body: ReqCheckEmailDto): Promise<CheckEmailResponseModel> {
		this.logger.debug(`[CHECK] Checking availability for email=${body.data.email}`);

		const data = await this.authService.checkEmail(body.data);

		this.logger.debug(`[CHECK] Email=${body.data.email} available=${data.valid}`);

		const response = new CheckEmailResponseModel();
		response.data = data;

		return response;
	}

	@ApiOperation({
		tags: [AUTH_MODULE_API_TAG_NAME],
		summary: 'Get user profile',
		description: 'Retrieve the authenticated user profile information',
		operationId: 'get-auth-module-profile',
	})
	@ApiSuccessResponse(ProfileResponseModel, 'User profile retrieved')
	@ApiBadRequestResponse('Invalid request')
	@ApiNotFoundResponse('User not found')
	@ApiForbiddenResponse('User not authenticated')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('profile')
	async getProfile(@Req() req: AuthenticatedRequest): Promise<ProfileResponseModel> {
		const { user } = req;

		if (!user) {
			throw new ForbiddenException('User not found');
		}

		this.logger.debug(`[PROFILE] Fetching profile for user=${user.id}`);

		const userData = await this.authService.getProfile(user.id);

		this.logger.debug(`[PROFILE] Successfully fetched profile for user=${user.id}`);

		const response = new ProfileResponseModel();
		response.data = userData;

		return response;
	}
}
