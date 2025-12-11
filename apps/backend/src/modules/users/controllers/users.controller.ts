import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';

import {
	Body,
	Controller,
	Delete,
	Get,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Req,
	Res,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { setLocationHeader } from '../../api/utils/location-header.utils';
import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { ReqCreateUserDto } from '../dto/create-user.dto';
import { ReqUpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/users.entity';
import { UserResponseModel, UsersResponseModel } from '../models/users-response.model';
import { UsersService } from '../services/users.service';
import { USERS_MODULE_API_TAG_NAME, USERS_MODULE_PREFIX } from '../users.constants';

@ApiTags(USERS_MODULE_API_TAG_NAME)
@Controller('users')
export class UsersController {
	private readonly logger = new Logger(UsersController.name);

	constructor(private readonly usersService: UsersService) {}

	@ApiOperation({
		tags: [USERS_MODULE_API_TAG_NAME],
		summary: 'Retrieve a list of all users',
		description:
			'Fetches a list of all users currently registered in the system. Each user includes their metadata such as ID, username, email, role, and profile information.',
		operationId: 'get-users-module-users',
	})
	@ApiSuccessResponse(
		UsersResponseModel,
		'A list of users successfully retrieved. Each user includes their metadata (ID, username, email, role, and profile information).',
	)
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(): Promise<UsersResponseModel> {
		this.logger.debug('[LOOKUP ALL] Fetching all users');

		const users = await this.usersService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${users.length} users`);

		const response = new UsersResponseModel();

		response.data = users;

		return response;
	}

	@ApiOperation({
		tags: [USERS_MODULE_API_TAG_NAME],
		summary: 'Retrieve details of a specific user',
		description:
			"Fetches the details of a specific user using their unique ID. The response includes the user's metadata such as ID, username, email, role, and profile information.",
		operationId: 'get-users-module-user',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'User ID' })
	@ApiSuccessResponse(
		UserResponseModel,
		"The user details were successfully retrieved. The response includes the user's metadata (ID, username, email, role, and profile information).",
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('User not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<UserResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching page id=${id}`);

		const user = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found user id=${user.id}`);

		const response = new UserResponseModel();

		response.data = user;

		return response;
	}

	@ApiOperation({
		tags: [USERS_MODULE_API_TAG_NAME],
		summary: 'Create a new user',
		description:
			'Creates a new user account in the system. The request requires user-specific attributes such as username, password, and optionally email and profile information. The response includes the full representation of the created user, including their unique identifier, username, email, role, and timestamps. Additionally, a Location header is provided with the URI of the newly created resource.',
		operationId: 'create-users-module-user',
	})
	@ApiCreatedSuccessResponse(
		UserResponseModel,
		'The user was successfully created. The response includes the complete details of the newly created user, such as its unique identifier, username, email, role, and timestamps.',
		'/api/v1/users-module/users/123e4567-e89b-12d3-a456-426614174000',
	)
	@ApiBadRequestResponse('Invalid request data or unsupported user data')
	@ApiUnprocessableEntityResponse('Username or email already exists')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	async create(
		@Body() createDto: ReqCreateUserDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<UserResponseModel> {
		this.logger.debug('[CREATE] Incoming request to create a new user');

		const existingUsername = await this.usersService.findByUsername(createDto.data.username);

		if (existingUsername) {
			this.logger.warn('[CREATE] User is trying to use used username');

			throw new UnprocessableEntityException('Trying to create user with used username');
		}

		if (createDto.data.email) {
			const existingEmail = await this.usersService.findByEmail(createDto.data.email);

			if (existingEmail) {
				this.logger.warn('[CREATE] User is trying to use used email');

				throw new UnprocessableEntityException('Trying to create user with used email');
			}
		}

		const user = await this.usersService.create(createDto.data);

		this.logger.debug(`[CREATE] Successfully created user id=${user.id}`);

		setLocationHeader(req, res, USERS_MODULE_PREFIX, 'users', user.id);

		const response = new UserResponseModel();

		response.data = user;

		return response;
	}

	@ApiOperation({
		tags: [USERS_MODULE_API_TAG_NAME],
		summary: 'Update an existing user',
		description:
			'Updates the details of an existing user using their unique ID. The request can include updates to username, email, password, role, or profile information. The response includes the complete updated representation of the user.',
		operationId: 'update-users-module-user',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'User ID' })
	@ApiSuccessResponse(
		UserResponseModel,
		'The user was successfully updated. The response includes the complete details of the updated user, such as its unique identifier, username, email, role, and timestamps.',
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiNotFoundResponse('User not found')
	@ApiUnprocessableEntityResponse('Email already exists')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateUserDto,
	): Promise<UserResponseModel> {
		this.logger.debug(`[UPDATE] Incoming update request for user id=${id}`);

		const user = await this.getOneOrThrow(id);

		if (updateDto.data.email) {
			const existingEmail = await this.usersService.findByEmail(updateDto.data.email);

			if (existingEmail && existingEmail.id !== id) {
				this.logger.warn('[UPDATE] User is trying to use used email');

				throw new UnprocessableEntityException('Trying to create user with used email');
			}
		}

		const updatedUser = await this.usersService.update(user.id, updateDto.data);

		this.logger.debug(`[UPDATE] Successfully updated user id=${updatedUser.id}`);

		const response = new UserResponseModel();

		response.data = updatedUser;

		return response;
	}

	@ApiOperation({
		tags: [USERS_MODULE_API_TAG_NAME],
		summary: 'Delete an existing user',
		description:
			'Deletes an existing user from the system using their unique ID. This operation is irreversible and will remove all associated user data. Users cannot delete their own account.',
		operationId: 'delete-users-module-user',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'User ID' })
	@ApiNoContentResponse({ description: 'User deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('User not found')
	@ApiUnprocessableEntityResponse('Cannot delete your own account')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
	async remove(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Req() req: AuthenticatedRequest,
	): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete user id=${id}`);

		const user = await this.getOneOrThrow(id);

		const { auth } = req;

		// Prevent user from deleting themselves
		if (auth && auth.type === 'user' && auth.id === id) {
			throw new UnprocessableEntityException('You cannot delete your own account');
		}

		await this.usersService.remove(user.id);

		this.logger.debug(`[DELETE] Successfully deleted user id=${id}`);
	}

	private async getOneOrThrow(id: string): Promise<UserEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of user id=${id}`);

		const user = await this.usersService.findOne(id);

		if (!user) {
			this.logger.error(`[ERROR] user with id=${id} not found`);

			throw new NotFoundException('Requested user does not exist');
		}

		return user;
	}
}
