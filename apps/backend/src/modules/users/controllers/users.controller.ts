import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Header,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Req,
} from '@nestjs/common';

import { AuthenticatedRequest } from '../../auth/auth.constants';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/users.entity';
import { UsersService } from '../services/users.service';
import { DISPLAY_USERNAME, UsersModulePrefix } from '../users.constants';

@Controller('users')
export class UsersController {
	private readonly logger = new Logger(UsersController.name);

	constructor(private readonly usersService: UsersService) {}

	@Get()
	async findAll(): Promise<UserEntity[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all users');

		const users = await this.usersService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${users.length} users`);

		return users;
	}

	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<UserEntity> {
		this.logger.debug(`[LOOKUP] Fetching page id=${id}`);

		const user = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found user id=${user.id}`);

		return user;
	}

	@Post()
	@Header('Location', `:baseUrl/${UsersModulePrefix}/users/:id`)
	async create(@Body() createDto: CreateUserDto): Promise<UserEntity> {
		this.logger.debug('[CREATE] Incoming request to create a new user');

		if (createDto.username === DISPLAY_USERNAME) {
			this.logger.warn('[REGISTER] User is trying to use reserved username');

			throw new ForbiddenException('Trying to create user with reserved username');
		}

		const user = await this.usersService.create(createDto);

		this.logger.debug(`[CREATE] Successfully created user id=${user.id}`);

		return user;
	}

	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: UpdateUserDto,
	): Promise<UserEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for user id=${id}`);

		const user = await this.getOneOrThrow(id);

		const updatedUser = await this.usersService.update(user.id, updateDto);

		this.logger.debug(`[UPDATE] Successfully updated user id=${updatedUser.id}`);

		return updatedUser;
	}

	@Delete(':id')
	async remove(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Req() req: AuthenticatedRequest,
	): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete user id=${id}`);

		const user = await this.getOneOrThrow(id);

		const { user: actualUser } = req;

		// Prevent user from deleting themselves
		if (actualUser && actualUser.id === id) {
			throw new ForbiddenException('You cannot delete your own account');
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
