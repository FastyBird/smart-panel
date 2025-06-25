import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Req,
	UnprocessableEntityException,
} from '@nestjs/common';

import { AuthenticatedRequest } from '../../auth/auth.constants';
import { ReqCreateUserDto } from '../dto/create-user.dto';
import { ReqUpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/users.entity';
import { UsersService } from '../services/users.service';
import { USERS_MODULE_PREFIX } from '../users.constants';

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
	@Header('Location', `:baseUrl/${USERS_MODULE_PREFIX}/users/:id`)
	async create(@Body() createDto: ReqCreateUserDto): Promise<UserEntity> {
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

		return user;
	}

	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateUserDto,
	): Promise<UserEntity> {
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
